package com.chapert.moneypl.compat;

import android.content.Intent;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class MoneyplAutoCaptureBridge {
    private final MainActivity activity;

    MoneyplAutoCaptureBridge(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public String isNotificationAccessEnabled() {
        JSONObject result = new JSONObject();
        try {
            result.put("enabled", MoneyplAutoCaptureStore.isNotificationAccessEnabled(activity));
            result.put("smsEnabled", activity.isSmsPermissionGranted());
        } catch (JSONException ignored) {
            // Return whatever was already written.
        }
        return result.toString();
    }

    @JavascriptInterface
    public String getPendingNotifications() {
        return MoneyplAutoCaptureStore.pendingResult(activity).toString();
    }

    @JavascriptInterface
    public void removePendingNotifications(String optionsJson) {
        try {
            JSONObject options = new JSONObject(optionsJson);
            JSONArray ids = options.optJSONArray("ids");
            MoneyplAutoCaptureStore.removePending(activity, ids == null ? new JSONArray() : ids);
        } catch (JSONException ignored) {
            // Ignore malformed requests from the WebView.
        }
    }

    @JavascriptInterface
    public void openNotificationAccessSettings() {
        activity.runOnUiThread(() -> {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
        });
    }

    @JavascriptInterface
    public String isSmsPermissionGranted() {
        JSONObject result = new JSONObject();
        try {
            result.put("enabled", activity.isSmsPermissionGranted());
        } catch (JSONException ignored) {
            // Return default object.
        }
        return result.toString();
    }

    @JavascriptInterface
    public void requestSmsPermission() {
        activity.runOnUiThread(activity::requestSmsPermissionFromBridge);
    }
}
