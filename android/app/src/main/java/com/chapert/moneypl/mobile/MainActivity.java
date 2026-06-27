package com.chapert.moneypl.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(MoneyplAutoCapturePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
