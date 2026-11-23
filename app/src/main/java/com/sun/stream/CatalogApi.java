package com.sun.stream;

import android.net.Uri;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

final class CatalogApi {
    static final String ROOT="https://animesfhd.net/stremio";
    static final String AGENT="SunAndroid/0.3 (+https://github.com/elenaess/sun)";
    static String read(String path) throws IOException {
        if(!path.startsWith("/catalog/") && !path.startsWith("/meta/") && !path.startsWith("/stream/"))
            throw new IOException("Recurso desconhecido");
        if(path.contains("..") || path.contains("#") || path.length()>1600)throw new IOException("Caminho inválido");
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
    static JSONObject streams(String type,String episode) throws Exception {
        if(!"movie".equals(type)&&!"series".equals(type))throw new IOException("Tipo desconhecido");
        return new JSONObject(read("/stream/"+type+"/"+Uri.encode(episode)+".json"));
    }
    private CatalogApi(){}
}
