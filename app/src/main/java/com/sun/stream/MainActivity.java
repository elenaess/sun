package com.sun.stream;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.graphics.Color;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.InputStream;
import java.io.ByteArrayInputStream;
import java.util.HashMap;
import java.util.Map;

/** Native Android shell for Sun's local, installable web UI. */
public class MainActivity extends Activity {
    private static final String HOME = "https://appassets.androidplatform.net/assets/index.html";
    private static final int FILE_PICK = 1041;
    private WebView webView;
    private android.webkit.ValueCallback<Uri[]> fileCallback;
    private View fullScreenView;
    private WebChromeClient.CustomViewCallback fullScreenCallback;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(251,247,247));
        getWindow().setNavigationBarColor(Color.rgb(251,247,247));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(251,247,247));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri uri = req.getUrl();
                if (!"https".equals(uri.getScheme()) || !"appassets.androidplatform.net".equals(uri.getHost())) return null;
                String path = uri.getPath();
                if (path == null || !path.startsWith("/assets/") || path.contains("..")) return notFound();
                String name = path.substring("/assets/".length());
                try {
                    InputStream data = getAssets().open(name);
                    String mime = "application/octet-stream";
                    if (name.endsWith(".html")) mime = "text/html";
                    else if (name.endsWith(".css")) mime = "text/css";
                    else if (name.endsWith(".js")) mime = "text/javascript";
                    else if (name.endsWith(".json") || name.endsWith(".webmanifest")) mime = "application/json";
                    else if (name.endsWith(".png")) mime = "image/png";
                    else if (name.endsWith(".svg")) mime = "image/svg+xml";
                    else if (name.endsWith(".jpg") || name.endsWith(".jpeg")) mime = "image/jpeg";
                    WebResourceResponse response = new WebResourceResponse(mime, "UTF-8", data);
                    Map<String,String> headers = new HashMap<>();
                    headers.put("Access-Control-Allow-Origin", "*");
                    headers.put("Cache-Control", "no-cache");
                    response.setResponseHeaders(headers);
                    return response;
                } catch (Exception e) { return notFound(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri uri = req.getUrl();
                if (!req.isForMainFrame() || "appassets.androidplatform.net".equals(uri.getHost())) return false;
                if (!"https".equals(uri.getScheme()) && !"http".equals(uri.getScheme())) return true;
                try {startActivity(new Intent(Intent.ACTION_VIEW,uri));} catch(Exception ignored){}
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, android.webkit.ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback!=null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = params.createIntent();
                try {startActivityForResult(intent,FILE_PICK);}
                catch(Exception e){ fileCallback=null;callback.onReceiveValue(null);return false; }
                return true;
            }
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullScreenView!=null) { callback.onCustomViewHidden(); return; }
                fullScreenView = view;
                fullScreenCallback = callback;
                ((ViewGroup)getWindow().getDecorView()).addView(view, new ViewGroup.LayoutParams(-1,-1));
                webView.setVisibility(View.GONE);
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            }
            @Override public void onHideCustomView() {
                if(fullScreenView==null)return;
                ((ViewGroup)getWindow().getDecorView()).removeView(fullScreenView);
                fullScreenView=null;
                webView.setVisibility(View.VISIBLE);
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
                if(fullScreenCallback!=null)fullScreenCallback.onCustomViewHidden();
                fullScreenCallback=null;
            }
        });
        setContentView(webView);
        webView.loadUrl(HOME);
    }
    private WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
            new HashMap<String,String>(), new ByteArrayInputStream(new byte[0]));
    }
    @Override protected void onActivityResult(int code,int result,Intent intent){
        super.onActivityResult(code,result,intent);
        if(code!=FILE_PICK||fileCallback==null)return;
        Uri[] results=WebChromeClient.FileChooserParams.parseResult(result,intent);
        fileCallback.onReceiveValue(results);
        fileCallback=null;
    }
    @Override public void onBackPressed(){
        if(fullScreenView!=null){webView.getWebChromeClient().onHideCustomView();return;}
        webView.evaluateJavascript("Boolean(window.sunBack&&window.sunBack())",s->{if(!"true".equals(s)){if(webView.canGoBack())webView.goBack();else super.onBackPressed();}});
    }
    @Override protected void onDestroy(){
        if(webView!=null){webView.destroy();webView=null;}
        super.onDestroy();
    }
}
