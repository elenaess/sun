package com.sun.stream;

import android.net.Uri;
import java.text.Normalizer;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** Only switch catalogues after matching a unique title and numbered episode. */
final class EpisodeFallback {
    private static String key(String text) {
        String title=Normalizer.normalize(text,Normalizer.Form.NFD).replaceAll("\\p{M}+", "")
            .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+"," ").trim();
        if(title.equals("frieren beyond journey s end") || title.equals("frieren beyond journeys end")) return "sousou no frieren";
        if(title.equals("attack on titan")) return "shingeki no kyojin";
        if(title.equals("demon slayer kimetsu no yaiba")) return "kimetsu no yaiba";
        return title;
    }
    private static JSONObject match(JSONArray entries, String field, String value) {
        JSONObject only=null;
        for(int i=0;entries!=null && i<entries.length();i++){
            JSONObject row=entries.optJSONObject(i);
            if(row!=null && key(row.optString(field)).equals(value)){
                if(only!=null)return null;
                only=row;
            }
        }
        return only;
    }
    static JSONArray resolve(String from,String name,JSONObject selected) throws Exception {
        JSONArray empty=new JSONArray();
        if (!selected.optBoolean("numbered") || !selected.has("number") || selected.optInt("season",0)!=1) return empty;
        boolean useDrive="fhd".equals(from);
        if (!useDrive && !"drive".equals(from)) return empty;
        String canon=key(name);
        if(canon.isEmpty())return empty;
        String term=canon.equals("sousou no frieren")?"Frieren":name;
        JSONArray titles=useDrive?AnimeDrive.search(term):new JSONObject(CatalogApi.read(
            "/catalog/series/afhd-populares/search="+Uri.encode(term)+".json")).optJSONArray("metas");
        JSONObject title=match(titles,"name",canon);
        if(title==null)return empty;
        String id=title.getString("id");
        JSONArray eps=useDrive?AnimeDrive.episodes(id):new JSONObject(CatalogApi.read("/meta/series/"+Uri.encode(id)+".json"))
            .getJSONObject("meta").optJSONArray("videos");
        String episodeId=null;
        for(int i=0;eps!=null && i<eps.length();i++){
            JSONObject ep=eps.optJSONObject(i);
            if(ep==null || ep.optInt("season",1)!=1 || ep.optDouble(useDrive?"number":"episode",-1)!=selected.optDouble("number"))continue;
            if(episodeId!=null)return empty;
            episodeId=ep.optString("id");
        }
        if(episodeId==null)return empty;
        JSONObject response=useDrive?AnimeDrive.streams(episodeId):CatalogApi.streams("series",episodeId,0);
        JSONArray streams=response.optJSONArray("streams");
        return streams==null?empty:streams;
    }
    private EpisodeFallback() {}
}
