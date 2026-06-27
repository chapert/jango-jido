package com.chapert.moneypl;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;
import java.util.regex.Pattern;
import org.json.JSONObject;

public class MoneyplNotificationListenerService extends NotificationListenerService {
    private static final Pattern AMOUNT_PATTERN = Pattern.compile("(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\\s*원");
    private static final Pattern FINANCE_PATTERN = Pattern.compile("(입금|출금|결제|승인|카드|체크|계좌|이체|송금|자동이체|환불|취소|급여)");

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

        if (!looksFinancial(joined)) {
            return;
        }

        try {
            JSONObject item = new JSONObject();
            item.put("id", buildId(packageName, sbn.getPostTime(), joined));
            item.put("packageName", packageName);
            item.put("appName", appName(packageName));
            item.put("title", clip(title, 180));
            item.put("text", clip(text, 420));
            item.put("bigText", clip(bigText, 820));
            item.put("subText", clip(subText, 180));
            item.put("postedAt", sbn.getPostTime());
            item.put("capturedAt", System.currentTimeMillis());
            MoneyplAutoCapturePlugin.captureNotification(getApplicationContext(), item);
        } catch (Exception ignored) {
            // Ignore malformed notifications.
        }
    }

    private boolean looksFinancial(String value) {
        if (TextUtils.isEmpty(value)) {
            return false;
        }
        return AMOUNT_PATTERN.matcher(value).find() && FINANCE_PATTERN.matcher(value).find();
    }

    private String appName(String packageName) {
        PackageManager manager = getPackageManager();
        try {
            ApplicationInfo info = manager.getApplicationInfo(packageName, 0);
            CharSequence label = manager.getApplicationLabel(info);
            return label == null ? packageName : label.toString();
        } catch (PackageManager.NameNotFoundException ignored) {
            return packageName;
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

    private static String buildId(String packageName, long postTime, String text) {
        return Long.toHexString(postTime) + "-" + Integer.toHexString((packageName + text).hashCode());
    }

    private static String clip(String value, int max) {
        if (value == null) {
            return "";
        }
        String normalized = value.replaceAll("\\s+", " ").trim();
        return normalized.length() <= max ? normalized : normalized.substring(0, max);
    }
}
