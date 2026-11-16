package com.northdesigner.mob;

import android.content.Context;
import android.content.SharedPreferences;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONArray;
import org.json.JSONObject;

final class YouTubeBudget {
    private static final String API = "https://xrvqyraafmwpfenysmfo.supabase.co/rest/v1/rpc/mob_youtube_budget";
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final AtomicBoolean syncing = new AtomicBoolean();

    static String day() { return LocalDate.now(ZoneOffset.UTC).toString(); }

    static int total(SharedPreferences prefs, int local) {
        return local + (day().equals(prefs.getString("youtube-day", "")) ? prefs.getInt("youtube-other", 0) : 0);
    }

    static void sync(Context context, int local) {
        SharedPreferences prefs = context.getSharedPreferences("mob", Context.MODE_PRIVATE);
        String token = prefs.getString("youtube-token", "");
        long now = System.currentTimeMillis();
        if (token.isEmpty() || now - prefs.getLong("youtube-last-sync", 0) < 900_000L
            || !syncing.compareAndSet(false, true)) return;
        prefs.edit().putLong("youtube-last-sync", now).apply();
        String day = day();
        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(API).openConnection();
                connection.setConnectTimeout(4000);
                connection.setReadTimeout(4000);
                connection.setRequestMethod("POST");
                connection.setRequestProperty("apikey", prefs.getString("youtube-key", ""));
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setDoOutput(true);
                byte[] payload = new JSONObject().put("p_token", token).put("p_day", day)
                    .put("p_seconds", local).toString().getBytes(StandardCharsets.UTF_8);
                try (java.io.OutputStream stream = connection.getOutputStream()) { stream.write(payload); }
                if (connection.getResponseCode() != 200) return;
                StringBuilder body = new StringBuilder();
                try (java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                    for (String line; (line = reader.readLine()) != null;) body.append(line);
                }
                JSONArray rows = new JSONArray(body.toString());
                if (!token.equals(prefs.getString("youtube-token", ""))) return;
                if (rows.length() == 0) { clear(prefs); return; }
                JSONObject row = rows.getJSONObject(0);
                prefs.edit().putBoolean("shorts", row.getBoolean("block_shorts"))
                    .putInt("limit", row.getInt("daily_limit_minutes")).putString("youtube-day", day)
                    .putInt("youtube-other", Math.max(0, row.getInt("total_seconds") - local)).apply();
            } catch (Exception ignored) {
                // Keep the last known budget while the device is offline.
            } finally {
                if (connection != null) connection.disconnect();
                syncing.set(false);
            }
        });
    }

    static void clear(SharedPreferences prefs) {
        prefs.edit().remove("youtube-token").remove("youtube-key").remove("youtube-owner")
            .remove("youtube-day").remove("youtube-other").remove("youtube-last-sync").apply();
    }
}
