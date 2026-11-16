package com.northdesigner.mob;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.os.Process;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityManager;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;
import java.util.Arrays;
import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;

public final class YouTubeBlocker extends AccessibilityService {
    private static final String YOUTUBE = "com.google.android.youtube";
    private static final Set<String> SHORTS = new HashSet<>(Arrays.asList(
        "reel_player_page_container", "reel_watch_fragment_root", "reel_watch_fragment",
        "reel_content_container", "shorts_player", "reel_player", "reel_player_overlay"
    ));
    private final Handler handler = new Handler(Looper.getMainLooper());
    private long lastBlocked, lastLimitCheck;
    private boolean heartbeatScheduled;
    private int localSeconds;
    private final Runnable heartbeat = new Runnable() {
        @Override public void run() {
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null || !YOUTUBE.equals(String.valueOf(root.getPackageName()))) { heartbeatScheduled = false; return; }
            check(root, false);
            handler.postDelayed(this, 5_000);
        }
    };

    @Override public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getPackageName() == null || !YOUTUBE.contentEquals(event.getPackageName())) return;
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null || !YOUTUBE.equals(String.valueOf(root.getPackageName()))) return;
        check(root, true);
        if (!heartbeatScheduled) {
            heartbeatScheduled = true;
            handler.postDelayed(heartbeat, 5_000);
        }
    }

    private void check(AccessibilityNodeInfo root, boolean checkShorts) {
        long now = SystemClock.elapsedRealtime();
        if (now - lastBlocked < 700) return;
        SharedPreferences prefs = getSharedPreferences("mob", MODE_PRIVATE);
        int limit = prefs.getInt("limit", 0);
        if (lastLimitCheck == 0 || now - lastLimitCheck >= 5_000) {
            boolean upload = lastLimitCheck == 0 || now / 30_000 > lastLimitCheck / 30_000;
            lastLimitCheck = now;
            localSeconds = todaySeconds(this);
            if (upload && hasUsageAccess(this)) YouTubeBudget.sync(this, localSeconds);
        }
        boolean overLimit = limit > 0 && YouTubeBudget.total(prefs, localSeconds) >= limit * 60;
        if (overLimit || (checkShorts && prefs.getBoolean("shorts", false) && isShorts(root, 0))) {
            lastBlocked = now;
            performGlobalAction(overLimit ? GLOBAL_ACTION_HOME : GLOBAL_ACTION_BACK);
            Toast.makeText(this, overLimit ? "YouTube time limit reached" : "Shorts blocked by Mob", Toast.LENGTH_SHORT).show();
        }
    }

    private boolean isShorts(AccessibilityNodeInfo node, int depth) {
        if (node == null || depth > 20 || !node.isVisibleToUser()) return false;
        String id = node.getViewIdResourceName();
        if (id != null && SHORTS.contains(id.substring(id.lastIndexOf('/') + 1))) return true;
        for (int i = 0; i < node.getChildCount(); i++) {
            if (isShorts(node.getChild(i), depth + 1)) return true;
        }
        return false;
    }

    static int todaySeconds(Context context) {
        if (!hasUsageAccess(context)) return 0;
        Calendar morning = Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"));
        morning.set(Calendar.HOUR_OF_DAY, 0);
        morning.set(Calendar.MINUTE, 0);
        morning.set(Calendar.SECOND, 0);
        morning.set(Calendar.MILLISECOND, 0);
        long start = morning.getTimeInMillis();
        long now = System.currentTimeMillis();
        UsageStatsManager manager = context.getSystemService(UsageStatsManager.class);
        UsageEvents events = manager.queryEvents(start - 86_400_000, now);
        if (events == null) return 0;
        UsageEvents.Event event = new UsageEvents.Event();
        long total = 0;
        long open = -1;
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            if (!YOUTUBE.equals(event.getPackageName())) continue;
            if (event.getEventType() == UsageEvents.Event.MOVE_TO_FOREGROUND && open == -1) open = Math.max(start, event.getTimeStamp());
            if (event.getEventType() == UsageEvents.Event.MOVE_TO_BACKGROUND && open >= 0) {
                total += Math.max(0, event.getTimeStamp() - open);
                open = -1;
            }
        }
        return (int) Math.min(86_400, (total + (open >= 0 ? Math.max(0, now - open) : 0)) / 1000);
    }

    static boolean hasUsageAccess(Context context) {
        AppOpsManager operations = context.getSystemService(AppOpsManager.class);
        return operations.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.getPackageName()) == AppOpsManager.MODE_ALLOWED;
    }

    static boolean enabled(Context context) {
        AccessibilityManager manager = context.getSystemService(AccessibilityManager.class);
        ComponentName service = new ComponentName(context, YouTubeBlocker.class);
        for (AccessibilityServiceInfo info : manager.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)) {
            if (service.equals(ComponentName.unflattenFromString(info.getId()))) return true;
        }
        return false;
    }

    @Override public void onInterrupt() { handler.removeCallbacks(heartbeat); heartbeatScheduled = false; }
    @Override public void onDestroy() { handler.removeCallbacks(heartbeat); super.onDestroy(); }
}
