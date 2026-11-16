package com.shaurya.us;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Closed-app notifications without a server: every ~15 min Android wakes this receiver, which asks Firestore (REST)
 * for new events addressed to this phone and shows them as notifications. While the app is open the JS side
 * notifies instantly instead. Config (room, who, keys) is written by the web app into Capacitor Preferences.
 */
public class UsPoller extends BroadcastReceiver {
    public static volatile boolean foreground = false;
    static final String CHANNEL = "us_partner";
    static final String ACTION = "com.shaurya.us.POLL";

    public static void schedule(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        Intent i = new Intent(c, UsPoller.class).setAction(ACTION);
        PendingIntent pi = PendingIntent.getBroadcast(c, 4325, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.setInexactRepeating(AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + 60_000, AlarmManager.INTERVAL_FIFTEEN_MINUTES, pi);
    }

    @Override
    public void onReceive(final Context c, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) { schedule(c); return; }
        if (foreground) return;
        final PendingResult pr = goAsync();
        new Thread(new Runnable() {
            public void run() {
                try { poll(c); } catch (Exception e) { android.util.Log.w("UsPoller", e); } finally { pr.finish(); }
            }
        }).start();
    }

    static void poll(Context c) throws Exception {
        String cfg = c.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).getString("us_native", null);
        if (cfg == null) return;
        JSONObject k = new JSONObject(cfg);
        String who = k.getString("who");
        SharedPreferences sp = c.getSharedPreferences("us_poller", Context.MODE_PRIVATE);
        long last = sp.getLong("lastAt", 0);
        if (last == 0) { sp.edit().putLong("lastAt", System.currentTimeMillis()).apply(); return; }

        String q = "{\"structuredQuery\":{\"from\":[{\"collectionId\":\"events\"}],\"where\":{\"fieldFilter\":{\"field\":{\"fieldPath\":\"at\"},\"op\":\"GREATER_THAN\",\"value\":{\"integerValue\":\"" + last + "\"}}},"
                + "\"orderBy\":[{\"field\":{\"fieldPath\":\"at\"},\"direction\":\"ASCENDING\"}],\"limit\":20}}";
        URL url = new URL("https://firestore.googleapis.com/v1/projects/" + k.getString("projectId") + "/databases/(default)/documents/us/"
                + k.getString("roomId") + ":runQuery?key=" + k.getString("apiKey"));
        HttpURLConnection h = (HttpURLConnection) url.openConnection();
        h.setRequestMethod("POST"); h.setDoOutput(true); h.setConnectTimeout(15000); h.setReadTimeout(15000);
        h.setRequestProperty("Content-Type", "application/json");
        OutputStream os = h.getOutputStream(); os.write(q.getBytes("UTF-8")); os.close();
        InputStream in = h.getInputStream(); ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] b = new byte[8192]; int n;
        while ((n = in.read(b)) > 0) bo.write(b, 0, n);
        in.close();

        JSONArray rows = new JSONArray(bo.toString("UTF-8"));
        long max = last;
        for (int i = 0; i < rows.length(); i++) {
            JSONObject d = rows.getJSONObject(i).optJSONObject("document");
            if (d == null) continue;
            JSONObject f = d.getJSONObject("fields");
            long at = Long.parseLong(f.getJSONObject("at").optString("integerValue", "0"));
            max = Math.max(max, at);
            if (!who.equals(str(f, "to")) || who.equals(str(f, "from"))) continue;
            show(c, i, str(f, "from"), str(f, "type"), str(f, "text"));
        }
        sp.edit().putLong("lastAt", max).apply();
    }

    static String str(JSONObject f, String key) { JSONObject o = f.optJSONObject(key); return o == null ? "" : o.optString("stringValue", ""); }

    static void show(Context c, int i, String from, String type, String text) {
        String n = "arushi".equals(from) ? "Arushi" : "Shaurya";
        String title; String body = text; long[] vib = {0, 40};
        switch (type) {
            case "flare": title = "🚨 " + n + " needs you"; body = "Emergency Comfort Flare — hold them close right now."; vib = new long[]{0, 120, 80, 120, 400, 120, 80, 120}; break;
            case "bothered": title = "💗 " + n + ": something is bothering me…"; vib = new long[]{0, 60, 60, 200}; break;
            case "tell": title = "💌 " + n + " wants to tell you something"; break;
            case "mood": title = n + " changed their mood"; body = "Open us!! to see their photo."; break;
            case "squeeze": title = "🧸 " + n + " is squeezing " + text; body = "wants real cuddles"; vib = new long[]{0, 30, 40, 30, 40, 90}; break;
            case "poke": title = "👉 " + n + " poked you"; body = "thinking of you"; break;
            case "need": title = "🫶 What " + n + " needs right now"; break;
            case "coupon": title = "🎟️ " + n + " sent you a coupon"; break;
            case "zipper": title = "🤐 " + n + " hid something inside " + text; body = "Unzip the heart to find it."; break;
            case "summon": title = "💗 " + n + " is waiting at the gate of us!!"; body = "Tap to enter our world together"; vib = new long[]{0, 200, 100, 200, 100, 400}; break;
            case "update": title = "✨ " + n + " pushed a new update to us!!"; break;
            case "build": title = "🏡 " + n + " built " + text; body = "Come see our house"; break;
            case "cook": title = "🍳 " + n + " cooked " + text + " for you"; break;
            case "adopt": title = "🐾 " + n + " adopted " + text; break;
            default: title = "💗 " + n; break;
        }
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "From your partner", NotificationManager.IMPORTANCE_HIGH);
            ch.enableVibration(true); nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        nm.notify((int) (System.currentTimeMillis() % 100000) + i, new NotificationCompat.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_heart).setColor(0xFFFF3E8A).setContentTitle(title).setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body)).setVibrate(vib)
                .setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).setContentIntent(pi).build());
    }
}
