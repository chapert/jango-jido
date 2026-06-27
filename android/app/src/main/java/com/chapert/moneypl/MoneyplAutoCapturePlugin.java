package com.chapert.moneypl;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.text.TextUtils;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "MoneyplAutoCapture")
public class MoneyplAutoCapturePlugin extends Plugin {
    private static final String PREF_NAME = "moneypl_auto_capture";
    private static final String PREF_PENDING = "pending_notifications";
    private static final int MAX_PENDING = 80;
    private static WeakReference<MoneyplAutoCapturePlugin> activePlugin;

    @Override
    public void load() {
        activePlugin = new WeakReference<>(this);
    }

    @PluginMethod
    public void isNotificationAccessEnabled(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabled", isNotificationAccessEnabled(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void openNotificationAccessSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void getPendingNotifications(PluginCall call) {
        JSObject result = new JSObject();
        try {
            result.put("items", new JSArray(readPending(getContext()).toString()));
        } catch (JSONException ignored) {
            result.put("items", new JSArray());
        }
        call.resolve(result);
    }

    @PluginMethod
    public void removePendingNotifications(PluginCall call) {
        JSArray ids = call.getArray("ids", new JSArray());
        Set<String> removeIds = new HashSet<>();
        for (int i = 0; i < ids.length(); i += 1) {
            removeIds.add(ids.optString(i));
        }

        JSONArray current = readPending(getContext());
        JSONArray kept = new JSONArray();
        for (int i = 0; i < current.length(); i += 1) {
            JSONObject item = current.optJSONObject(i);
            if (item == null || removeIds.contains(item.optString("id"))) {
                continue;
            }
            kept.put(item);
        }
        writePending(getContext(), kept);
        call.resolve();
    }

    static void captureNotification(Context context, JSONObject item) {
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
        MoneyplAutoCapturePlugin plugin = activePlugin == null ? null : activePlugin.get();
        if (plugin != null) {
            JSObject event = new JSObject();
            try {
                event.put("item", JSObject.fromJSONObject(item));
                plugin.notifyListeners("notificationCaptured", event, true);
            } catch (JSONException ignored) {
                // The item has already been stored, so UI refresh can pick it up later.
            }
        }
    }

    private static boolean isNotificationAccessEnabled(Context context) {
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
