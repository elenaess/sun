package com.sun.stream;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.*;
import android.widget.Toast;
import java.io.*;
import java.net.URLConnection;
import java.util.Collections;
import org.json.*;

public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String HOME = "https://" + HOST + "/assets/index.html";
    private static final int FILE_PICK = 41, PLAY = 42, IMPORT = 43, EXPORT = 44;
    WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private String exportText;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(16, 16, 18));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!HOST.equals(u.getHost()) || !"https".equals(u.getScheme())) return null;
                String p = u.getPath();
                if (p != null && p.startsWith("/assets/") && !p.contains("..")) {
                    String file = p.substring(8);
                    try {
                        String type = URLConnection.guessContentTypeFromName(file);
                        if (file.endsWith(".js")) type="application/javascript";
                        if (file.endsWith(".css")) type="text/css";
                        if (file.endsWith(".webmanifest") || file.endsWith(".json")) type="application/json";
                        return new WebResourceResponse(type == null ? "application/octet-stream" : type, "UTF-8", getAssets().open(file));
                    } catch(IOException ignored) {}
                }
                return new WebResourceResponse("text/plain","UTF-8",404,"Not Found", Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!req.isForMainFrame()) return true;
                if ("sun".equals(u.getScheme())) {
                    if (HOME.equals(view.getUrl())) command(u);
                    return true;
                }
                if ("https".equals(u.getScheme()) && HOST.equals(u.getHost())) return !HOME.equals(u.toString());
                if ("https".equals(u.getScheme()) || "http".equals(u.getScheme())) {
                    try {startActivity(new Intent(Intent.ACTION_VIEW,u));} catch(Exception ignored) {}
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if(fileCallback!=null) fileCallback.onReceiveValue(null);
                fileCallback=cb;
                try {startActivityForResult(params.createIntent(),IMPORT);return true;}
                catch(Exception e){fileCallback=null;return false;}
            }
        });
        setContentView(web);
        applyInsets(web);
        if (state != null) exportText=state.getString("export");
        web.loadUrl(HOME);
    }
    static void applyInsets(View root) {
        if (android.os.Build.VERSION.SDK_INT < 35) return;
        root.setOnApplyWindowInsetsListener((v,w)->{
            android.graphics.Insets p=w.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()|WindowInsets.Type.ime());
            v.setPadding(p.left,p.top,p.right,p.bottom); return w;
        });
        root.requestApplyInsets();
    }
    private void command(Uri u) {
        try {
            switch(String.valueOf(u.getHost())) {
                case "play":
                    String data=u.getQueryParameter("data");
                    if(data==null || data.length()>90000) throw new IllegalArgumentException();
                    startActivityForResult(new Intent(this,PlayerActivity.class).putExtra("data",data),PLAY);break;
                case "file":
                    Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("video/*");
                    startActivityForResult(pick,FILE_PICK);break;
                case "export":
                    exportText=u.getQueryParameter("data");
                    if(exportText==null) return;
                    startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                        .setType("application/json").putExtra(Intent.EXTRA_TITLE,"sun-biblioteca.json"),EXPORT);break;
            }
        } catch(Exception e) { Toast.makeText(this,"Não foi possível abrir esta opção.",Toast.LENGTH_SHORT).show(); }
    }
    @Override protected void onActivityResult(int code,int result,Intent data) {
        super.onActivityResult(code,result,data);
        if(code==IMPORT && fileCallback!=null){fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));fileCallback=null;return;}
        if(result!=RESULT_OK || data==null) return;
        if(code==PLAY) {
            String payload=data.getStringExtra("progress");
            if(payload!=null) web.evaluateJavascript("window.sunProgress && window.sunProgress("+JSONObject.quote(payload)+")",null);
        } else if(code==FILE_PICK && data.getData()!=null) {
            Uri uri=data.getData();
            if(!"content".equals(uri.getScheme()))return;
            startActivityForResult(new Intent(this,PlayerActivity.class).setData(uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),PLAY);
        } else if(code==EXPORT && data.getData()!=null && exportText!=null) {
            try(OutputStream out=getContentResolver().openOutputStream(data.getData())){
                if(out!=null)out.write(exportText.getBytes("UTF-8"));
            } catch(IOException e){Toast.makeText(this,"Falha ao salvar o backup.",Toast.LENGTH_SHORT).show();}
            exportText=null;
        }
    }
    @Override protected void onSaveInstanceState(Bundle out){super.onSaveInstanceState(out);out.putString("export",exportText);}
    @Override public void onBackPressed(){web.evaluateJavascript("Boolean(window.sunBack && window.sunBack())",v->{if(!"true".equals(v))super.onBackPressed();});}
    @Override protected void onDestroy(){web.destroy();super.onDestroy();}
}
