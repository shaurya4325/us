package com.shaurya.us;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        UsPoller.schedule(this);
    }

    @Override
    public void onResume() {
        super.onResume();
        UsPoller.foreground = true;
        // the open app already showed everything up to now
        getSharedPreferences("us_poller", MODE_PRIVATE).edit().putLong("lastAt", System.currentTimeMillis()).apply();
    }

    @Override
    public void onPause() { UsPoller.foreground = false; super.onPause(); }
}
