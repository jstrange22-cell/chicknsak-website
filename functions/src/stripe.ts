/**
 * Stripe Cloud Functions for ProjectWorks
 *
 * createCheckoutSession - Callable function that creates a Stripe Checkout Session
 * stripeWebhook        - HTTP endpoint that handles Stripe webhook events
 */

import * as admin from "firebase-admin";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";

// ============================================================================
// Secrets (set via `firebase functions:secrets:set <KEY>`)
// ============================================================================

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecretParam = defineSecret("STRIPE_WEBHOOK_SECRET");

// ============================================================================
// Helpers
// ============================================================================

function getStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2025-02-24.acacia",
  });
}

// ============================================================================
// 1. createCheckoutSession - Callable function
// ============================================================================

/**
 * Creates a Stripe Checkout Session for a given payment request.
 *
 * Expects:
 *   - paymentRequestId: string  (Firestore document ID)
 *   - successUrl: string        (URL to redirect on success)
 *   - cancelUrl: string         (URL to redirect on cancel)
 *
 * Returns:
 *   - checkoutUrl: string       (Stripe-hosted Checkout URL)
 */
export const createCheckoutSession = onCall(
  {
    region: "us-central1",
    secrets: [stripeSecretKey],
  },
  async (request) => {
    const { paymentRequestId, successUrl, cancelUrl } = request.data as {
      paymentRequestId: string;
      successUrl: string;
      cancelUrl: string;
    };

    // Validate required parameters
    if (!paymentRequestId || !successUrl || !cancelUrl) {
      throw new HttpsError(
        "invalid-argument",
        "paymentRequestId, successUrl, and cancelUrl are required."
      );
    }

    const db = admin.firestore();

    // Fetch the payment request document
    const paymentRef = db.collection("payment_requests").doc(paymentRequestId);
    const paymentDoc = await paymentRef.get();

    if (!paymentDoc.exists) {
      throw new HttpsError("not-found", "Payment request not found.");
    }

    const paymentData = paymentDoc.data()!;

    // Prevent creating sessions for already-paid requests
    if (paymentData.status === "paid") {
      throw new HttpsError(
        "failed-precondition",
        "This payment request has already been paid."
      );
    }

    // Build Stripe line items from the payment request line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      (paymentData.lineItems as Array<{
        description: string;
        amount: number;
        quantity: number;
      }>) .map((item) => ({
        price_data: {
          currency: (paymentData.currency as string) || "usd",
          product_data: {
            name: item.description,
          },
          unit_amount: item.amount, // already in cents
        },
        quantity: item.quantity,
      }));

    // If no line items, create a single line item from the total
    if (lineItems.length === 0) {
      lineItems.push({
        price_data: {
          currency: (paymentData.currency as string) || "usd",
          product_data: {
            name: (paymentData.description as string) || "Payment",
          },
          unit_amount: paymentData.amountCents as number,
        },
        quantity: 1,
      });
    }

    // Create the Stripe Checkout Session
    const stripe = getStripe(stripeSecretKey.value());

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: (paymentData.customerEmail as string) || undefined,
      metadata: {
        paymentRequestId,
        companyId: (paymentData.companyId as string) || "",
        projectId: (paymentData.projectId as string) || "",
      },
    });

    // Update the payment request document with the Stripe session info
    await paymentRef.update({
      stripeCheckoutUrl: session.url,
      stripePaymentIntentId: session.id,
      status: paymentData.status === "pending" ? "sent" : paymentData.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { checkoutUrl: session.url };
  }
);

// ============================================================================
// 2. stripeWebhook - HTTP endpoint for Stripe webhook events
// ============================================================================

/**
 * Handles incoming Stripe webhook events.
 * Primarily listens for `checkout.session.completed` to mark payments as paid.
 *
 * The webhook signature is verified using STRIPE_WEBHOOK_SECRET.
 */
export const stripeWebhook = onRequest(
  {
    region: "us-central1",
    secrets: [stripeSecretKey, stripeWebhookSecretParam],
  },
  async (req, res) => {
    // Only accept POST requests
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const stripe = getStripe(stripeSecretKey.value());
    const webhookSecret = stripeWebhookSecretParam.value();

    // Verify webhook signature
    const sig = req.headers["stripe-signature"] as string | undefined;

    if (!sig) {
      console.error("Missing stripe-signature header");
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    let event: Stripe.Event;

    try {
      // req.rawBody is provided by Firebase Functions for raw body access
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        webhookSecret
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Webhook signature verification failed:", message);
      res.status(400).json({ error: `Webhook Error: ${message}` });
      return;
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentRequestId = session.metadata?.paymentRequestId;

        if (!paymentRequestId) {
          console.warn(
            "checkout.session.completed missing paymentRequestId in metadata"
          );
          break;
        }

        const db = admin.firestore();
        const paymentRef = db
          .collection("payment_requests")
          .doc(paymentRequestId);

        await paymentRef.update({
          status: "paid",
          stripePaymentIntentId:
            (session.payment_intent as string) || session.id,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(
          `Payment request ${paymentRequestId} marked as paid (session: ${session.id})`
        );
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentRequestId = session.metadata?.paymentRequestId;

        if (paymentRequestId) {
          const db = admin.firestore();
          const paymentRef = db
            .collection("payment_requests")
            .doc(paymentRequestId);

          // Reset to sent status so the user can try again
          await paymentRef.update({
            stripeCheckoutUrl: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(
            `Checkout session expired for payment request ${paymentRequestId}`
          );
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Always acknowledge receipt
    res.status(200).json({ received: true });
  }
);
