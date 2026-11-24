package com.shaurya.us;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

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

    /* In-game voice chat: while WebRTC holds the phone in "call" mode, Android routes the other person's voice to the
       quiet earpiece. Keep it on the loudspeaker instead, unless headphones / a Bluetooth headset are connected. */
    private final Handler speakerLoop = new Handler(Looper.getMainLooper());
    private final Runnable speakerCheck = new Runnable() {
        @Override public void run() { routeToSpeaker(); speakerLoop.postDelayed(this, 1500); }
    };
    private void routeToSpeaker() {
        try {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (am == null || am.getMode() != AudioManager.MODE_IN_COMMUNICATION) return;
            boolean headset = false;
            if (Build.VERSION.SDK_INT >= 23) {
                for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
                    int t = d.getType();
                    if (t == AudioDeviceInfo.TYPE_WIRED_HEADSET || t == AudioDeviceInfo.TYPE_WIRED_HEADPHONES || t == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
                        || t == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || (Build.VERSION.SDK_INT >= 26 && t == AudioDeviceInfo.TYPE_USB_HEADSET)) headset = true;
                }
            }
            if (headset) return;
            if (Build.VERSION.SDK_INT >= 31) {
                AudioDeviceInfo cur = am.getCommunicationDevice();
                if (cur != null && cur.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) return;
                for (AudioDeviceInfo d : am.getAvailableCommunicationDevices()) if (d.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) { am.setCommunicationDevice(d); break; }
            } else if (!am.isSpeakerphoneOn()) {
                am.setSpeakerphoneOn(true);
            }
        } catch (Exception ignored) { }
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
        speakerLoop.post(speakerCheck);
        // the open app already showed everything up to now
        getSharedPreferences("us_poller", MODE_PRIVATE).edit().putLong("lastAt", System.currentTimeMillis()).apply();
    }

    @Override
    public void onPause() { UsPoller.foreground = false; speakerLoop.removeCallbacks(speakerCheck); super.onPause(); }
}
