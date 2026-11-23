package com.northdesigner.mob;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.util.Arrays;
import java.util.Collections;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String HOME = ORIGIN + "/assets/index.html";
    private static final String SUPABASE = "xrvqyraafmwpfenysmfo.supabase.co";
    private static final int NOTIFICATIONS = 91;
    private static final int PICK_IMAGE = 92;
    private ValueCallback<Uri[]> imageSelection;
    private WebView web;
    private boolean ready;
    private final android.os.Handler statusHandler=new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable refreshStatus=new Runnable() {
        @Override public void run() {
            if (ready) reportPermissions(false);
            statusHandler.postDelayed(this,30000);
        }
    };

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        stopService(new Intent().setClassName(this,getPackageName()+".FlowService"));
        SharedPreferences old=getSharedPreferences("mob", MODE_PRIVATE);
        SharedPreferences.Editor cleanup=old.edit();
        for (String key : old.getAll().keySet()) if (key.startsWith("flow-") || key.startsWith("youtube-") || key.startsWith("account-")) cleanup.remove(key);
        cleanup.putBoolean("flow-enabled",false).putInt("limit",0).apply();
        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        if (Build.VERSION.SDK_INT >= 35) {
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return android.view.WindowInsets.CONSUMED;
            });
        }
        setContentView(root);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(true);
        web.getSettings().setMediaPlaybackRequiresUserGesture(true);
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!request.isForMainFrame()) return false;
                if (HOME.startsWith(uri.getScheme() + "://" + uri.getHost() + "/") && "/assets/index.html".equals(uri.getPath())) return false;
                if ("https".equals(uri.getScheme())) open(uri);
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (view.getUrl() == null || !view.getUrl().startsWith(HOME)) return false;
                if (imageSelection != null) imageSelection.onReceiveValue(null);
                imageSelection = callback;
                Intent picker = new Intent(Intent.ACTION_GET_CONTENT);
                picker.setType("image/*").addCategory(Intent.CATEGORY_OPENABLE);
                try { startActivityForResult(picker, PICK_IMAGE); }
                catch (ActivityNotFoundException error) {
                    imageSelection = null;
                    callback.onReceiveValue(null);
                }
                return true;
            }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "MobAndroid", Collections.singleton(ORIGIN),
                (view, message, origin, mainFrame, reply) -> {
                    if (mainFrame && ORIGIN.equals(origin.toString())) receive(message.getData());
                });
        }
        load(getIntent());
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != PICK_IMAGE || imageSelection == null) return;
        ValueCallback<Uri[]> callback = imageSelection;
        imageSelection = null;
        Uri image = data == null ? null : data.getData();
        callback.onReceiveValue(result == RESULT_OK && image != null && "content".equals(image.getScheme()) ? new Uri[] {image} : null);
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        load(intent);
    }

    private void load(Intent intent) {
        Uri callback = intent.getData();
        if (callback != null && "mobnorth".equals(callback.getScheme()) && "auth".equals(callback.getHost())
                && "/callback".equals(callback.getPath())) {
            String code = callback.getQueryParameter("code");
            ready = false;
            if (code != null && code.length() <= 500) {
                web.loadUrl(HOME + "?code=" + Uri.encode(code));
                return;
            }
            web.loadUrl(HOME + "?auth-error=1");
            return;
        }
        if (web.getUrl() == null) web.loadUrl(HOME + (intent.getBooleanExtra("tasks", false) ? "#tasks" : ""));
        else if (intent.getBooleanExtra("tasks", false)) web.loadUrl(HOME + "#tasks");
    }

    @Override protected void onResume() {
        super.onResume();
        statusHandler.removeCallbacks(refreshStatus);
        statusHandler.postDelayed(refreshStatus,30000);
        if (ready) {  reportPermissions(false); ReminderReceiver.reschedule(this); }
    }

    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override protected void onPause() {
        statusHandler.removeCallbacks(refreshStatus);
        super.onPause();
    }

    private void receive(String text) {
        if (text == null || text.length() > 100_000) return;
        try {
            JSONObject message = new JSONObject(text);
            SharedPreferences prefs = getSharedPreferences("mob", MODE_PRIVATE);
            switch (message.optString("type")) {
                case "ready": ready = true;  reportPermissions(false); break;
                case "blocking-permission":
                    startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
                    break;
                case "notification-permission":
                    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATIONS);
                    } else setNotifications();
                    break;
                case "notification-disable":
                    prefs.edit().putBoolean("notifications", false).apply();
                    break;
                case "exact-reminders":
                    if (Build.VERSION.SDK_INT >= 31 && !getSystemService(AlarmManager.class).canScheduleExactAlarms()) {
                        startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));
                    }
                    break;
                case "policy":
                    prefs.edit().putLong("policy-revision",System.nanoTime()).putBoolean("shorts", message.optBoolean("blockShorts"))
                        .putInt("limit", 0).apply();
                    break;
                case "reminders": ReminderReceiver.replace(this, message.getJSONArray("items")); break;
                case "notify":
                    if (prefs.getBoolean("notifications", false)) ReminderReceiver.notify(this, message.optString("tag"), message.optString("title"), message.optString("body"));
                    break;
                case "oauth":
                    Uri destination = Uri.parse(message.getString("url"));
                    if ("https".equals(destination.getScheme()) && SUPABASE.equals(destination.getHost())
                        && "/auth/v1/authorize".equals(destination.getPath())) open(destination);
                    break;
                case "youtube":
                    Uri youtube = Uri.parse(message.getString("url"));
                    if ("https".equals(youtube.getScheme()) && Arrays.asList("youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be").contains(youtube.getHost())) open(youtube);
                    break;
            }
        } catch (Exception ignored) { }
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == NOTIFICATIONS) setNotifications();
    }

    private void setNotifications() {
        boolean allowed = getSystemService(NotificationManager.class).areNotificationsEnabled();
        getSharedPreferences("mob", MODE_PRIVATE).edit().putBoolean("notifications", allowed).apply();
        reportPermissions(true);
    }

    private void reportPermissions(boolean notificationRequested) {
        JSONObject data = new JSONObject();
        try {
            data.put("blocking", YouTubeBlocker.enabled(this));
            if (notificationRequested) data.put("notifications", getSharedPreferences("mob", MODE_PRIVATE).getBoolean("notifications", false));
            web.evaluateJavascript("window.dispatchEvent(new CustomEvent('mob-native-status',{detail:" + data + "}))", null);
        } catch (Exception ignored) { }
    }

    private void open(Uri destination) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, destination)); }
        catch (ActivityNotFoundException error) {
            Toast.makeText(this, "Install a browser to open this link.", Toast.LENGTH_SHORT).show();
        }
    }
}
