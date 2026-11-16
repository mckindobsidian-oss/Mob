package com.northdesigner.mob;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

public final class ReminderReceiver extends BroadcastReceiver {
    private static final String CHANNEL = "mob-reminders";
    @Override public void onReceive(Context context, Intent intent) {
        SharedPreferences prefs = context.getSharedPreferences("mob", Context.MODE_PRIVATE);
        if (!prefs.getBoolean("notifications", false)) return;
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            reschedule(context);
        } else if ("mob.reminder".equals(intent.getAction())) {
            notify(context, intent.getDataString(), "Task due", intent.getStringExtra("title"));
        }
    }

    static void replace(Context context, JSONArray items) {
        SharedPreferences prefs = context.getSharedPreferences("mob", Context.MODE_PRIVATE);
        String current = items.toString();
        String previous = prefs.getString("reminders", "[]");
        if (current.equals(previous)) return;
        try {
            JSONArray old = new JSONArray(previous);
            AlarmManager alarms = context.getSystemService(AlarmManager.class);
            for (int i = 0; i < old.length(); i++) {
                JSONObject item = old.optJSONObject(i);
                if (item != null) alarms.cancel(alarm(context, item));
            }
        } catch (Exception ignored) { }
        prefs.edit().putString("reminders", current).apply();
        schedule(context, items);
    }

    static void reschedule(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("mob", Context.MODE_PRIVATE);
        if (!prefs.getBoolean("notifications", false)) return;
        try { schedule(context, new JSONArray(prefs.getString("reminders", "[]"))); }
        catch (Exception ignored) { }
    }

    private static void schedule(Context context, JSONArray items) {
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        for (int i = 0; i < Math.min(200, items.length()); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item == null || item.optLong("at") <= System.currentTimeMillis()) continue;
            PendingIntent pending = alarm(context, item);
            long timestamp = item.optLong("at");
            if (Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms()) {
                manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pending);
            } else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pending);
        }
    }

    private static PendingIntent alarm(Context context, JSONObject item) {
        Intent intent = new Intent(context, ReminderReceiver.class).setAction("mob.reminder")
            .setData(Uri.parse("mobnorth://reminder/" + Uri.encode(item.optString("id"))))
            .putExtra("title", item.optString("title"));
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void notify(Context context, String tag, String title, String body) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (!manager.areNotificationsEnabled()) return;
        manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Mob reminders", NotificationManager.IMPORTANCE_DEFAULT));
        Intent launch = new Intent(context, MainActivity.class).putExtra("tasks", true);
        PendingIntent tap = PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification notification = new Notification.Builder(context, CHANNEL).setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(title).setContentText(body).setContentIntent(tap).setAutoCancel(true).build();
        manager.notify(tag, 1, notification);
    }
}
