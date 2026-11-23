package com.sun.stream;

import android.content.Context;
import android.net.Uri;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/** Stremio JSON add-on adapter. No JS evaluation, account, browser, DRM bypass or scraping. */
final class SunPlugins {
    private static Context app;
    private static final int LIMIT = 6;
    static final String MAIN_BASE = "https://animesfhd.net/stremio";
    static void init(Context context) { app = context.getApplicationContext(); }

    static List<String> installed() {
        ArrayList<String> result = new ArrayList<>();
        if (app == null) return result;
        String serialized = app.getSharedPreferences("sun-plugins", Context.MODE_PRIVATE)
                .getString("manifests", "[]");
        try {
            JSONArray entries = new JSONArray(serialized);
            for (int i=0; i<entries.length() && result.size()<LIMIT; i++) {
                String url = validManifest(entries.optString(i));
                if (url != null && !result.contains(url)) result.add(url);
            }
        } catch(Exception ignored) {}
        return result;
    }
    static String validManifest(String raw) {
        if(raw == null || raw.length()>500) return null;
        try {
            Uri uri = Uri.parse(raw.trim());
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null ||
                uri.getUserInfo() != null || uri.getPort()!=-1 || uri.getFragment()!=null ||
                uri.getQuery()!=null || !uri.getPath().endsWith("/manifest.json") ||
                host.equalsIgnoreCase("localhost") || host.endsWith(".local") ||
                host.equals("127.0.0.1") || host.equals("0.0.0.0") || host.equals("[::1]") ||
                host.matches("[0-9.]+") || host.contains(":")) return null;
            return uri.toString();
        } catch (Exception ignored) { return null; }
    }
    static boolean install(String raw) {
        try {
            JSONArray proposed = new JSONArray(raw);
            if(proposed.length()>LIMIT || app==null) return false;
            JSONArray cleaned = new JSONArray();
            LinkedHashSet<String> seen = new LinkedHashSet<>();
            for (int i=0;i<proposed.length();i++) {
                String u=validManifest(proposed.optString(i));
                if(u==null) return false;
                if(seen.add(u)) cleaned.put(u);
            }
            return app.getSharedPreferences("sun-plugins",Context.MODE_PRIVATE).edit()
                .putString("manifests",cleaned.toString()).commit();
        } catch(Exception ignored) { return false; }
    }
    private static String base(int index) {
        if(index==0) return MAIN_BASE;
        List<String> entries=installed();
        if(index<1 || index>entries.size()) return null;
        String manifest=entries.get(index-1);
        return manifest.substring(0,manifest.length()-"/manifest.json".length());
    }
    static String http(String url) throws Exception {
        if(!url.startsWith("https://"))throw new java.io.IOException("HTTPS obrigatório");
        HttpURLConnection c = (HttpURLConnection)new URL(url).openConnection();
        c.setConnectTimeout(7500);
        c.setReadTimeout(11000);
        c.setRequestProperty("Accept","application/json");
        c.setRequestProperty("User-Agent",CatalogApi.AGENT);
        c.setInstanceFollowRedirects(false);
        try {
            if(c.getResponseCode()!=200) throw new java.io.IOException("HTTP "+c.getResponseCode());
            try (InputStream in=c.getInputStream(); ByteArrayOutputStream out=new ByteArrayOutputStream()) {
                byte[] block=new byte[8192];int n;
                while((n=in.read(block))>=0) {
                    if(out.size()+n > 1024*1024) throw new java.io.IOException("Resposta longa");
                    out.write(block,0,n);
                }
                return out.toString("UTF-8");
            }
        } finally {c.disconnect();}
    }
    private static String allowedPath(String path) throws Exception {
        if (path==null || path.length()>1450 || path.contains("..") || path.contains("#") || path.contains("?") ||
          !(path.startsWith("/catalog/")||path.startsWith("/meta/")||path.startsWith("/stream/")))
            throw new java.io.IOException("Rota desconhecida");
        return path;
    }
    static String readPlugin(int index,String path) throws Exception {
        String origin=base(index);
        if(origin==null) throw new java.io.IOException("Plugin ausente");
        return http(origin+allowedPath(path));
    }
    static String providers() {
        JSONArray list=new JSONArray();
        try {
            JSONObject main=new JSONObject().put("index",0).put("name","Fonte principal")
               .put("catalogs",new JSONArray());
            list.put(main);
            List<String> manifests=installed();
            ExecutorService pool=Executors.newFixedThreadPool(Math.min(LIMIT,Math.max(1,manifests.size())));
            try {
                List<Future<JSONObject>> futures=new ArrayList<>();
                for(int i=0;i<manifests.size();i++) {
                    final int source=i+1; final String url=manifests.get(i);
                    futures.add(pool.submit(()->{
                        JSONObject manifest=new JSONObject(http(url));
                        JSONArray catalogs=manifest.optJSONArray("catalogs");
                        JSONArray resources=manifest.optJSONArray("resources");
                        boolean meta=false;
                        for(int j=0;resources!=null && j<resources.length();j++) {
                           Object item=resources.opt(j);
                           if("meta".equals(item)) meta=true;
                           if(item instanceof JSONObject && "meta".equals(((JSONObject)item).optString("name"))) meta=true;
                        }
                        return new JSONObject().put("index",source)
                            .put("name",manifest.optString("name","Plugin "+source))
                            .put("catalogs",meta && catalogs!=null?catalogs:new JSONArray());
                    }));
                }
                for(Future<JSONObject> task:futures) {
                    try {list.put(task.get(12,TimeUnit.SECONDS));}
                    catch(Exception ignored){task.cancel(true);}
                }
            } finally {pool.shutdownNow();}
        } catch(Exception ignored) {}
        return new JSONObject(java.util.Collections.singletonMap("plugins",list)).toString();
    }
    static JSONObject streams(String type,String episode,int preferred) throws Exception {
        if(!"series".equals(type) && !"movie".equals(type))
            throw new java.io.IOException("Tipo inválido");
        if(episode==null || episode.length()>400)throw new java.io.IOException("Episódio inválido");
        int total=installed().size()+1;
        ArrayList<Integer> order=new ArrayList<>();
        if(preferred>=0 && preferred<total) order.add(preferred);
        for(int i=0;i<total;i++)if(!order.contains(i))order.add(i);
        ExecutorService pool=Executors.newFixedThreadPool(Math.min(4,order.size()));
        JSONArray streams=new JSONArray();LinkedHashSet<String> seen=new LinkedHashSet<>();
        try {
            List<Future<JSONArray>> tasks=new ArrayList<>();
            for(final int source:order) {
                tasks.add(pool.submit(()->{
                    JSONArray out=new JSONArray();
                    String path="/stream/"+type+"/"+Uri.encode(episode)+".json";
                    JSONObject json=new JSONObject(readPlugin(source,path));
                    JSONArray options=json.optJSONArray("streams");
                    for(int j=0;options!=null && j<options.length() && out.length()<12;j++) {
                        JSONObject item=options.optJSONObject(j);
                        if(item==null)continue;
                        Uri link=Uri.parse(item.optString("url"));
                        if(!"https".equalsIgnoreCase(link.getScheme())||link.getHost()==null)continue;
                        String label=item.optString("title",item.optString("name","Vídeo"));
                        out.put(new JSONObject().put("url",link.toString())
                            .put("title","Fonte "+source+" · "+label)
                            .put("subtitles",item.optJSONArray("subtitles")));
                    }
                    return out;
                }));
            }
            for(Future<JSONArray> task:tasks) {
                try {
                    JSONArray options=task.get(13,TimeUnit.SECONDS);
                    for(int j=0;j<options.length() && streams.length()<24;j++) {
                        JSONObject item=options.getJSONObject(j);
                        if(seen.add(item.optString("url")))streams.put(item);
                    }
                } catch(Exception ignored) {task.cancel(true);}
            }
        } finally {pool.shutdownNow();}
        return new JSONObject().put("streams",streams);
    }
    private SunPlugins() {}
}
