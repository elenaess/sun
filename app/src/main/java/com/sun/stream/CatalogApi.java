package com.sun.stream;

import android.net.Uri;
import java.io.*;
import java.net.*;
import org.json.JSONObject;

final class CatalogApi {
    static final String ROOT="https://animesfhd.net/stremio";
    static final String AGENT="SunAndroid/0.4 (+https://github.com/elenaess/sun)";
    static String read(String path) throws IOException {
        if(path.startsWith("/sdk/")) {
            try{return SunApiBridge.read(path);}
            catch(IOException e){throw e;}
            catch(Exception e){throw new IOException("Gateway indisponível",e);}
        }
        if("/providers.json".equals(path))return SunPlugins.providers();
        if(path.startsWith("/plugin/")) {
            try {
                String rest=path.substring("/plugin/".length());
                int slash=rest.indexOf('/');
                if(slash<1 || slash>2)throw new IOException("Plugin inválido");
                int plugin=Integer.parseInt(rest.substring(0,slash));
                return SunPlugins.readPlugin(plugin,rest.substring(slash));
            } catch(IOException e){throw e;}
            catch(Exception e){throw new IOException("Plugin indisponível",e);}
        }
        if(!path.startsWith("/catalog/") && !path.startsWith("/meta/") && !path.startsWith("/stream/"))
            throw new IOException("Recurso desconhecido");
        if(path.contains("..") || path.contains("#") || path.contains("?") || path.length()>1600)
            throw new IOException("Caminho inválido");
        HttpURLConnection connection=(HttpURLConnection)new URL(ROOT+path).openConnection();
        connection.setConnectTimeout(9500);connection.setReadTimeout(15000);
        connection.setRequestProperty("Accept","application/json");
        connection.setRequestProperty("User-Agent",AGENT);
        try(InputStream in=connection.getInputStream(); ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
            byte[] chunk=new byte[8192];int read;
            while((read=in.read(chunk))!=-1){
                if(bytes.size()+read>6*1024*1024)throw new IOException("Resposta muito grande");
                bytes.write(chunk,0,read);
            }
            return bytes.toString("UTF-8");
        } finally {connection.disconnect();}
    }
    static JSONObject streams(String type,String episode,int index) throws Exception {
        return SunPlugins.streams(type,episode,index);
    }
    private CatalogApi(){}
}
