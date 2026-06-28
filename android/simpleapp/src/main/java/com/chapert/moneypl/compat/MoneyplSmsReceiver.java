package com.chapert.moneypl.compat;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.text.TextUtils;
import org.json.JSONObject;

public class MoneyplSmsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
            return;
        }

        SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (messages == null || messages.length == 0) {
            return;
        }

        String sender = messages[0].getDisplayOriginatingAddress();
        long postedAt = messages[0].getTimestampMillis();
        StringBuilder body = new StringBuilder();
        for (SmsMessage message : messages) {
            if (message == null || TextUtils.isEmpty(message.getMessageBody())) {
                continue;
            }
            body.append(message.getMessageBody());
        }

        String text = body.toString();
        String joined = sender + "\n" + text;
        if (!MoneyplAutoCaptureStore.looksFinancial(joined)) {
            return;
        }

        try {
            JSONObject item = new JSONObject();
            item.put("id", MoneyplAutoCaptureStore.buildId("sms", postedAt, sender, text));
            item.put("packageName", "android.telephony.sms");
            item.put("appName", "문자");
            item.put("source", "sms");
            item.put("title", MoneyplAutoCaptureStore.clip(sender, 180));
            item.put("text", MoneyplAutoCaptureStore.clip(text, 820));
            item.put("bigText", "");
            item.put("subText", "");
            item.put("postedAt", postedAt);
            item.put("capturedAt", System.currentTimeMillis());
            MoneyplAutoCaptureStore.capture(context.getApplicationContext(), item);
        } catch (Exception ignored) {
            // Ignore malformed SMS payloads.
        }
    }
}
