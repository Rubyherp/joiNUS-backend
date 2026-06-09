import { Expo } from 'expo-server-sdk';

const expo = new Expo();

export async function sendPushNotification(tokens, title, body, data = {}) {
    const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
    const messages = [];

    for (const token of tokenArray) {
        if (!Expo.isExpoPushToken(token)) {
            console.warn(`Invalid Expo push token: ${token}`);
            continue;
        };

        messages.push({
            to: token,
            sound: 'default',
            title,
            body,
            data,
        });
    }

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
        try {
            await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
            console.error('Push notification delivery error:', error);
        }
    }
}
