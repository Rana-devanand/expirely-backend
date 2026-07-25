import admin from "firebase-admin";

let isInitialized = false;

export const initFirebase = () => {
  if (isInitialized) return;

  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (!base64) {
    console.warn(
      "⚠️  [Firebase] FIREBASE_SERVICE_ACCOUNT_BASE64 not set. Push notifications will be disabled.",
    );
    return;
  }

  try {
    const serviceAccount = JSON.parse(
      Buffer.from(base64, "base64").toString("utf8"),
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    isInitialized = true;
    console.log("✅ Firebase Admin SDK initialized (from env).");
  } catch (err: any) {
    console.error("❌ [Firebase] Failed to initialize:", err.message);
  }
};

/**
 * Send a push notification to a single device via FCM token.
 * Returns true if sent successfully, false otherwise.
 */
export const sendPushNotification = async (
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  options?: {
    imageUrl?: string;
    channelId?: string;
    tag?: string;
    collapseKey?: string;
  },
): Promise<boolean> => {
  if (!isInitialized) {
    console.warn("⚠️  [Firebase] SDK not initialized. Skipping push notification.");
    return false;
  }

  if (!fcmToken) {
    console.warn("⚠️  [Firebase] No FCM token provided. Skipping push notification.");
    return false;
  }

  const notificationTag = options?.tag || options?.collapseKey;

  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title,
        body,
        ...(options?.imageUrl && { imageUrl: options.imageUrl }),
      },
      android: {
        priority: "high",
        ...(notificationTag && { collapseKey: notificationTag }),
        notification: {
          sound: "default",
          channelId: options?.channelId || "expiry-alerts",
          icon: "notification_icon",
          color: "#10b981",
          ...(notificationTag && { tag: notificationTag }),
          ...(options?.imageUrl && { imageUrl: options.imageUrl }),
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            ...(notificationTag && { threadId: notificationTag }),
          },
        },
      },
      ...(data && { data }),
    };

    const response = await admin.messaging().send(message);
    console.log(`✅ [FCM] Push sent successfully. Message ID: ${response}`);
    return true;
  } catch (err: any) {
    // If token is invalid/expired, log and return false (don't crash worker)
    console.error(`❌ [FCM] Failed to send push to token: ${err.message}`);
    return false;
  }
};
