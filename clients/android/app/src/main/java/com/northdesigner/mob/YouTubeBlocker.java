package com.northdesigner.mob;
import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.ComponentName;
import android.content.Context;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityManager;
import android.view.accessibility.AccessibilityNodeInfo;
import android.os.SystemClock;
import java.util.*;
public final class YouTubeBlocker extends AccessibilityService {
 private long lastBlocked;
 private static final Set<String> SHORTS = new HashSet<>(Arrays.asList("reel_player_page_container","reel_watch_fragment_root","reel_watch_fragment","reel_content_container","shorts_player","reel_player","reel_player_overlay"));
 @Override public void onAccessibilityEvent(AccessibilityEvent event) {
  if (!"com.google.android.youtube".contentEquals(event.getPackageName()==null ? "" : event.getPackageName())) return;
  if (!getSharedPreferences("mob",MODE_PRIVATE).getBoolean("shorts",false)) return;
  if (SystemClock.elapsedRealtime()-lastBlocked<700) return;
  AccessibilityNodeInfo root=getRootInActiveWindow();
  if (root!=null && "com.google.android.youtube".contentEquals(root.getPackageName()) && isShorts(root,0)) {
   lastBlocked=SystemClock.elapsedRealtime(); performGlobalAction(GLOBAL_ACTION_BACK);
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

    static boolean enabled(Context context) {
        AccessibilityManager manager = context.getSystemService(AccessibilityManager.class);
        ComponentName service = new ComponentName(context, YouTubeBlocker.class);
        for (AccessibilityServiceInfo info : manager.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)) {
            if (service.equals(ComponentName.unflattenFromString(info.getId()))) return true;
        }
        return false;
    }

 @Override public void onInterrupt() {}
}
