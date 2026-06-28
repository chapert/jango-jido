package com.chapert.moneypl.compat;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;
import org.json.JSONObject;

public class MoneyplNotificationListenerService extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String packageName = sbn.getPackageName();
        if (TextUtils.equals(packageName, getPackageName())) {
            return;
        }

        Notification notification = sbn.getNotification();
        if (notification == null) {
            return;
        }

        Bundle extras = notification.extras;
        String title = readExtra(extras, Notification.EXTRA_TITLE);
        String text = readExtra(extras, Notification.EXTRA_TEXT);
        String bigText = readExtra(extras, Notification.EXTRA_BIG_TEXT);
        String subText = readExtra(extras, Notification.EXTRA_SUB_TEXT);
        String joined = join(title, text, bigText, subText);

        if (!MoneyplAutoCaptureStore.looksFinancial(joined)) {
            return;
        }

        try {
            JSONObject item = new JSONObject();
            item.put("id", MoneyplAutoCaptureStore.buildId("notice", sbn.getPostTime(), packageName, joined));
            item.put("packageName", packageName);
            item.put("appName", MoneyplAutoCaptureStore.appName(getApplicationContext(), packageName));
            item.put("source", "notification");
            item.put("title", MoneyplAutoCaptureStore.clip(title, 180));
            item.put("text", MoneyplAutoCaptureStore.clip(text, 420));
            item.put("bigText", MoneyplAutoCaptureStore.clip(bigText, 820));
            item.put("subText", MoneyplAutoCaptureStore.clip(subText, 180));
            item.put("postedAt", sbn.getPostTime());
            item.put("capturedAt", System.currentTimeMillis());
            MoneyplAutoCaptureStore.capture(getApplicationContext(), item);
        } catch (Exception ignored) {
            // Ignore malformed notifications.
        }
    }

    private static String readExtra(Bundle extras, String key) {
        if (extras == null) {
            return "";
        }
        CharSequence value = extras.getCharSequence(key);
        return value == null ? "" : value.toString();
    }

    private static String join(String... values) {
        StringBuilder builder = new StringBuilder();
        for (String value : values) {
            if (TextUtils.isEmpty(value)) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append('\n');
            }
            builder.append(value);
        }
        return builder.toString();
    }
}
