/**
 * Push Notification Cloud Functions for JobMate
 *
 * Firestore-triggered function that sends FCM push notifications
 * when new messages are created in channels.
 */

import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

const db = admin.firestore();

// ============================================================================
// onMessageCreated — Firestore v2 trigger on messages collection
// ============================================================================

/**
 * When a new message document is created:
 * 1. Get the channel to find its members
 * 2. For each member (except the sender), look up their FCM tokens
 * 3. Send a push notification via admin.messaging().sendEachForMulticast()
 * 4. Clean up any invalid/expired tokens
 */
export const onMessageCreated = onDocumentCreated(
  "messages/{messageId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data in event, skipping notification");
      return;
    }

    const messageData = snapshot.data();
    const messageId = event.params.messageId;

    if (!messageData) {
      console.log(`Message ${messageId} has no data, skipping notification`);
      return;
    }

    const channelId = messageData.channelId as string;
    const senderId = messageData.userId as string;
    const messageBody = messageData.body as string;

    if (!channelId || !senderId) {
      console.log(
        `Message ${messageId} missing channelId or userId, skipping`
      );
      return;
    }

    try {
      // 1. Get channel details for the notification title
      const channelDoc = await db
        .collection("channels")
        .doc(channelId)
        .get();
      const channelName = channelDoc.exists
        ? (channelDoc.data()?.name as string) ?? "Message"
        : "Message";

      // 2. Get sender name for the notification
      const senderDoc = await db.collection("users").doc(senderId).get();
      const senderName = senderDoc.exists
        ? (senderDoc.data()?.fullName as string) ?? "Someone"
        : "Someone";

      // 3. Get all channel members except the sender
      const membersSnap = await db
        .collection("channelMembers")
        .where("channelId", "==", channelId)
        .get();

      const recipientUserIds = membersSnap.docs
        .map((d) => d.data().userId as string)
        .filter((uid) => uid !== senderId);

      if (recipientUserIds.length === 0) {
        console.log(`No recipients for message ${messageId}`);
        return;
      }

      // 4. Collect FCM tokens for all recipients
      const allTokens: string[] = [];
      const tokenToUserId: Record<string, string> = {};

      for (const userId of recipientUserIds) {
        // Check if user has push notifications enabled
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          const pushEnabled =
            userData?.notificationSettings?.push !== false;
          if (!pushEnabled) continue;
        }

        // Get all FCM tokens for this user
        const tokensSnap = await db
          .collection(`users/${userId}/fcmTokens`)
          .get();

        for (const tokenDoc of tokensSnap.docs) {
          const token = tokenDoc.data().token as string;
          if (token) {
            allTokens.push(token);
            tokenToUserId[token] = userId;
          }
        }
      }

      if (allTokens.length === 0) {
        console.log(
          `No FCM tokens found for message ${messageId} recipients`
        );
        return;
      }

      // 5. Truncate message body for notification
      const truncatedBody =
        messageBody.length > 100
          ? messageBody.substring(0, 100) + "..."
          : messageBody;

      // 6. Send push notification via multicast
      const message: admin.messaging.MulticastMessage = {
        tokens: allTokens,
        notification: {
          title: `${senderName} in ${channelName}`,
          body: truncatedBody,
        },
        data: {
          channelId,
          messageId,
          senderId,
          url: `/messages?channel=${channelId}`,
        },
        webpush: {
          fcmOptions: {
            link: `/messages?channel=${channelId}`,
          },
        },
      };

      const response = await admin
        .messaging()
        .sendEachForMulticast(message);

      console.log(
        `Push notification sent for message ${messageId}: ` +
          `${response.successCount} success, ${response.failureCount} failures`
      );

      // 7. Clean up invalid tokens
      if (response.failureCount > 0) {
        const tokensToRemove: Array<{
          token: string;
          userId: string;
        }> = [];

        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            const errorCode = resp.error.code;
            // Remove tokens that are invalid or unregistered
            if (
              errorCode === "messaging/invalid-registration-token" ||
              errorCode ===
                "messaging/registration-token-not-registered"
            ) {
              const failedToken = allTokens[idx];
              tokensToRemove.push({
                token: failedToken,
                userId: tokenToUserId[failedToken],
              });
            }
          }
        });

        if (tokensToRemove.length > 0) {
          console.log(
            `Cleaning up ${tokensToRemove.length} invalid FCM tokens`
          );

          await Promise.all(
            tokensToRemove.map(({ token, userId }) =>
              db
                .doc(`users/${userId}/fcmTokens/${token}`)
                .delete()
            )
          );
        }
      }
    } catch (error) {
      console.error(
        `onMessageCreated error for ${messageId}:`,
        error
      );
    }
  }
);
