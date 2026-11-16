package com.shaurya.us;

import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        UsPoller.schedule(this);
        immersive();
    }

    /** full-screen game: hide status + navigation bars (swipe from an edge to peek), dark letterbox behind the camera cutout */
    private void immersive() {
        getWindow().getDecorView().setBackgroundColor(0xFF0B0509);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
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
