package com.sun.stream;

import android.content.Context;
import android.net.Uri;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

/** Optional adapter for a user-configured, permissioned anime-sdk HTTP gateway.
 * No scraper, credential extraction, anti-bot bypass or bundled third-party stream URLs.
 */
final class SunApiBridge {
    private static final String[] ROUTES = {"health", "search", "content"};
    private static Context app;
    static void init(Context ctx){app=ctx.getApplicationContext();}
    static boolean configure(String raw){
        if(app==null)return false;
        String base=validateBase(raw);
        if(base==null)return false;
        return app.getSharedPreferences("sun-sdk",Context.MODE_PRIVATE).edit().putString("base",base).commit();
    }
    static String configured(){
        return app==null?"":app.getSharedPreferences("sun-sdk",Context.MODE_PRIVATE).getString("base","");
    }
    static String validateBase(String raw){
        if(raw==null || raw.length()>480)return null;
        String text=raw.trim();
        if(text.isEmpty())return "";
        try{
            Uri uri=Uri.parse(text);
            String host=uri.getHost();
            if(!"https".equalsIgnoreCase(uri.getScheme()) || host==null || host.length()>220 ||
                uri.getUserInfo()!=null || uri.getPort()!=-1 || uri.getFragment()!=null ||
                uri.getQuery()!=null || !host.contains(".") || host.equalsIgnoreCase("localhost") ||
                host.toLowerCase(Locale.ROOT).endsWith(".local") || host.matches("[0-9.]+") ||
                host.contains(":") || !host.matches("[a-zA-Z0-9.-]+"))return null;
            String path=uri.getPath();
            if(path!=null && (path.contains("..")||path.contains("//")||path.length()>120))return null;
            return text.replaceAll("/+$","");
        }catch(Exception e){return null;}
    }
    private static boolean provider(String id){return id!=null&&id.matches("[a-z0-9_-]{1,40}");}
    private static String request(String path) throws IOException{
        String base=configured();
        if(base.isEmpty())throw new IOException("Configure uma API no Perfil");
        if(path.length()>1700 || !path.startsWith("/"))throw new IOException("Rota inválida");
        HttpURLConnection conn=(HttpURLConnection)new URL(base+path).openConnection();
        conn.setConnectTimeout(6500);conn.setReadTimeout(13500);
        conn.setInstanceFollowRedirects(false);
        conn.setRequestProperty("Accept","application/json");
        conn.setRequestProperty("User-Agent",CatalogApi.AGENT);
        try{
            if(conn.getResponseCode()!=200)throw new IOException("API HTTP "+conn.getResponseCode());
            String content=conn.getContentType();
            if(content!=null && !content.toLowerCase(Locale.ROOT).contains("json"))
                throw new IOException("API não retornou JSON");
            try(InputStream in=conn.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] b=new byte[8192];int n;
                while((n=in.read(b))!=-1){
                    if(out.size()+n>1800000)throw new IOException("Resposta excedeu limite");
                    out.write(b,0,n);
                }
                return out.toString("UTF-8");
            }
        }finally{conn.disconnect();}
    }
    /** URL local /sun-api/sdk/{health | search/PROVIDER/TERM | content/PROVIDER/ID}.json */
    static String read(String route) throws Exception{
        if("/sdk/health.json".equals(route)) {
            if(configured().isEmpty())return "{\"ok\":false,\"providers\":[],\"reason\":\"not-configured\"}";
            JSONObject data=new JSONObject(request("/health"));
            JSONArray safe=new JSONArray(), raw=data.optJSONArray("providers");
            for(int i=0;raw!=null&&i<raw.length()&&safe.length()<30;i++){
                String value=raw.optString(i);
                if(provider(value))safe.put(value);
            }
            return new JSONObject().put("ok",data.optBoolean("ok",false)).put("providers",safe).toString();
        }
        String plain=route;
        if(!plain.startsWith("/sdk/") || !plain.endsWith(".json"))throw new IOException("Rota desconhecida");
        plain=plain.substring(5,plain.length()-5);
        String[] parts=plain.split("/",3);
        if(parts.length!=3 || !provider(parts[1]))throw new IOException("Provedor inválido");
        String key=Uri.decode(parts[2]);
        if(key.isEmpty()||key.length()>400 || key.indexOf('\u0000')>=0)throw new IOException("Identificador inválido");
        if("search".equals(parts[0]))return request("/search?provider="+parts[1]+"&q="+Uri.encode(key));
        if("content".equals(parts[0]))return request("/content?provider="+parts[1]+"&mediaId="+Uri.encode(key));
        throw new IOException("Rota desconhecida");
    }
    static JSONObject streams(String id,String unit,String language) throws Exception{
        if(!provider(id)||unit==null||unit.length()>400)throw new IOException("Fonte inválida");
        String lang="dub".equals(language)?"dub":"raw".equals(language)?"raw":"sub";
        JSONObject data=new JSONObject(request("/stream?provider="+id+"&unitId="+Uri.encode(unit)+"&language="+lang));
        JSONArray out=new JSONArray();
        if(!"video".equals(data.optString("type")))return new JSONObject().put("streams",out);
        JSONArray input=data.optJSONArray("streams");
        for(int i=0;input!=null&&i<input.length()&&out.length()<16;i++){
            JSONObject stream=input.optJSONObject(i);
            if(stream==null)continue;
            Uri link=Uri.parse(stream.optString("sourceUrl"));
            if(!"https".equalsIgnoreCase(link.getScheme()) || link.getHost()==null)continue;
            JSONObject row=new JSONObject().put("url",link.toString())
                .put("quality",id+" · "+stream.optString("quality","auto")+" · "+stream.optString("language",lang));
            if(stream.optBoolean("isHLS"))row.put("mimeType","application/x-mpegURL");
            JSONArray subs=stream.optJSONArray("subtitles"), filtered=new JSONArray();
            for(int j=0;subs!=null&&j<subs.length()&&j<20;j++){
                JSONObject sub=subs.optJSONObject(j);
                if(sub==null)continue;
                Uri addr=Uri.parse(sub.optString("url"));
                if("https".equalsIgnoreCase(addr.getScheme()) && addr.getHost()!=null)
                    filtered.put(new JSONObject().put("url",addr.toString()).put("lang",sub.optString("language","und")));
            }
            row.put("subtitles",filtered);
            // Does not forward cookies, authentication headers or unblock restricted servers.
            out.put(row);
        }
        return new JSONObject().put("streams",out);
    }
    private SunApiBridge(){}
}
