/**
 * Chick N Sak - Stripe Checkout Cloud Function
 *
 * Creates a Stripe Checkout Session for K-Town Krack shop orders.
 * Validates product prices server-side for security.
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

function getStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2025-02-24.acacia",
  });
}

interface CartItem {
  productId: string;
  quantity: number;
}

interface CheckoutRequest {
  items: CartItem[];
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export const cnsCreateCheckoutSession = onCall(
  {
    region: "us-central1",
    secrets: [stripeSecretKey],
  },
  async (request) => {
    const { items, customerEmail, successUrl, cancelUrl } =
      request.data as CheckoutRequest;

    // Validate required parameters
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new HttpsError("invalid-argument", "At least one item is required.");
    }
    if (!successUrl || !cancelUrl) {
      throw new HttpsError(
        "invalid-argument",
        "successUrl and cancelUrl are required."
      );
    }

    const db = admin.firestore();
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    let totalCents = 0;

    // Validate each product and build line items using SERVER-SIDE prices
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        throw new HttpsError(
          "invalid-argument",
          `Invalid item: ${JSON.stringify(item)}`
        );
      }

      const productDoc = await db
        .collection("products")
        .doc(item.productId)
        .get();

      if (!productDoc.exists) {
        throw new HttpsError(
          "not-found",
          `Product ${item.productId} not found.`
        );
      }

      const product = productDoc.data()!;

      if (!product.inStock) {
        throw new HttpsError(
          "failed-precondition",
          `${product.name} is currently out of stock.`
        );
      }

      const unitAmount = product.priceCents as number;
      totalCents += unitAmount * item.quantity;

      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name as string,
            description: product.description as string,
            images: product.imageUrl ? [product.imageUrl as string] : [],
          },
          unit_amount: unitAmount,
        },
        quantity: item.quantity,
      });
    }

    // Create Stripe Checkout Session
    const stripe = getStripe(stripeSecretKey.value());

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      customer_email: customerEmail || undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      shipping_address_collection: {
        allowed_countries: ["US"],
      },
      metadata: {
        source: "chicknsak_shop",
      },
    });

    // Create order document
    await db.collection("orders").add({
      customerEmail: customerEmail || "",
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      totalCents,
      status: "pending",
      stripeSessionId: session.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { checkoutUrl: session.url };
  }
);
