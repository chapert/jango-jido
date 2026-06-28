package com.chapert.moneypl.compat;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.provider.Settings;
import android.text.TextUtils;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class MoneyplAutoCaptureStore {
    private static final String PREF_NAME = "moneypl_auto_capture";
    private static final String PREF_PENDING = "pending_notifications";
    private static final int MAX_PENDING = 120;
    private static final Pattern AMOUNT_PATTERN = Pattern.compile("(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\\s*원");
    private static final Pattern FINANCE_PATTERN = Pattern.compile("(입금|출금|결제|승인|카드|체크|계좌|이체|송금|자동이체|환불|취소|급여|사용|매출|잔액)");

    private MoneyplAutoCaptureStore() {}

    static boolean looksFinancial(String value) {
        if (TextUtils.isEmpty(value)) {
            return false;
        }
        return AMOUNT_PATTERN.matcher(value).find() && FINANCE_PATTERN.matcher(value).find();
    }

    static void capture(Context context, JSONObject item) {
        JSONArray current = readPending(context);
        String id = item.optString("id");
        JSONArray next = new JSONArray();
        next.put(item);

        int count = 1;
        for (int i = 0; i < current.length() && count < MAX_PENDING; i += 1) {
            JSONObject existing = current.optJSONObject(i);
            if (existing == null || TextUtils.equals(existing.optString("id"), id)) {
                continue;
            }
            next.put(existing);
            count += 1;
        }

        writePending(context, next);
        MainActivity.dispatchAutoCapture(item);
    }

    static JSONObject pendingResult(Context context) {
        JSONObject result = new JSONObject();
        try {
            result.put("items", readPending(context));
        } catch (JSONException ignored) {
            // Empty result below is still valid JSON.
        }
        return result;
    }

    static void removePending(Context context, JSONArray ids) {
        Set<String> removeIds = new HashSet<>();
        for (int i = 0; i < ids.length(); i += 1) {
            removeIds.add(ids.optString(i));
        }

        JSONArray current = readPending(context);
        JSONArray kept = new JSONArray();
        for (int i = 0; i < current.length(); i += 1) {
            JSONObject item = current.optJSONObject(i);
            if (item == null || removeIds.contains(item.optString("id"))) {
                continue;
            }
            kept.put(item);
        }
        writePending(context, kept);
    }

    static boolean isNotificationAccessEnabled(Context context) {
        String enabledListeners = Settings.Secure.getString(context.getContentResolver(), "enabled_notification_listeners");
        if (enabledListeners == null) {
            return false;
        }

        ComponentName expected = new ComponentName(context, MoneyplNotificationListenerService.class);
        String[] components = enabledListeners.split(":");
        for (String component : components) {
            ComponentName enabled = ComponentName.unflattenFromString(component);
            if (enabled != null && TextUtils.equals(enabled.flattenToString(), expected.flattenToString())) {
                return true;
            }
        }
        return false;
    }

    static String appName(Context context, String packageName) {
        PackageManager manager = context.getPackageManager();
        try {
            ApplicationInfo info = manager.getApplicationInfo(packageName, 0);
            CharSequence label = manager.getApplicationLabel(info);
            return label == null ? packageName : label.toString();
        } catch (PackageManager.NameNotFoundException ignored) {
            return packageName;
        }
    }

    static String clip(String value, int max) {
        if (value == null) {
            return "";
        }
        String normalized = value.replaceAll("\\s+", " ").trim();
        return normalized.length() <= max ? normalized : normalized.substring(0, max);
    }

    static String buildId(String prefix, long postedAt, String packageOrSender, String text) {
        return prefix + "-" + Long.toHexString(postedAt) + "-" + Integer.toHexString((packageOrSender + text).hashCode());
    }

    private static JSONArray readPending(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        String raw = preferences.getString(PREF_PENDING, "[]");
        try {
            return new JSONArray(raw);
        } catch (JSONException ignored) {
            return new JSONArray();
        }
    }

    private static void writePending(Context context, JSONArray items) {
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(PREF_PENDING, items.toString())
            .apply();
    }
}
