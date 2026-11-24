package com.sun.stream;

import android.net.Uri;
import java.io.IOException;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

final class AnimeDrive {
    private static final String ROOT = "https://animesdrive.cloud";
    private static final Pattern EP = Pattern.compile("(?i)(?:epis[oó]dio|episode|epis|ep)[\\s._-]*(\\d+(?:[.,]\\d+)?)");
    private static final Pattern SEASON = Pattern.compile("(?i)(?:temporada|season)[\\s._-]*(\\d+)");
    private static Document get(String path) throws IOException {
        return Jsoup.connect(ROOT + path).userAgent(CatalogApi.AGENT).timeout(10000)
            .followRedirects(false).maxBodySize(3 * 1024 * 1024).get();
    }
    private static String slug(Element link, String section) {
        Uri url = Uri.parse(link.absUrl("href"));
        String path = url.getPath();
        if (!"animesdrive.cloud".equalsIgnoreCase(url.getHost()) || path == null) return "";
        String prefix = "/" + section + "/";
        if (!path.startsWith(prefix)) return "";
        String value = path.substring(prefix.length()).replaceFirst("/$", "");
        return value.matches("[A-Za-z0-9_-]{1,230}") ? value : "";
    }
    static JSONArray search(String term) throws Exception {
        JSONArray rows = new JSONArray();
        if (term.trim().length()<2 || term.length()>120) return rows;
        Document page = get("/?s=" + Uri.encode(term));
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        for (Element entry : page.select("div.result-item article, article.w_item_a, article.item, div.search-page .item")) {
            Element link = entry.selectFirst("div.title a[href*=/anime/], a[href*=/anime/]");
            if (link == null) continue;
            String key = slug(link, "anime");
            if (key.isEmpty() || !seen.add(key)) continue;
            String title = link.text();
            Element heading = entry.selectFirst("div.title, h3, h2");
            if (heading != null && !heading.text().trim().isEmpty()) title = heading.text().trim();
            if (title.isEmpty()) title = link.attr("title");
            if (title.isEmpty()) continue;
            Element art = entry.selectFirst("img");
            String poster = art == null ? "" : art.absUrl("data-src");
            if (poster.isEmpty() && art != null) poster = art.absUrl("src");
            rows.put(new JSONObject().put("id", key).put("name", title).put("poster", poster));
            if (rows.length()>=40) break;
        }
        return rows;
    }
    static JSONArray episodes(String key) throws Exception {
        Document page = get("/anime/" + valid(key));
        JSONArray result = new JSONArray();
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        for (Element link : page.select(".episode-info a[href*=/episodio/], .episodios a[href*=/episodio/], .episode-card a[href*=/episodio/], #episodes a[href*=/episodio/]")) {
            String id = slug(link, "episodio");
            if (id.isEmpty() || !seen.add(id)) continue;
            String title = link.text().trim();
            Matcher number = EP.matcher(id);
            String value = number.find() ? number.group(1) : "";
            if (value.isEmpty()) {
                number = EP.matcher(title);
                if (number.find()) value = number.group(1);
            }
            Matcher season = SEASON.matcher(id);
            JSONObject ep = new JSONObject().put("id",id).put("name",title.isEmpty() ? id.replace('-', ' ') : title)
                .put("numbered",!value.isEmpty()).put("season",season.find()?Integer.parseInt(season.group(1)):1);
            if (!value.isEmpty()) ep.put("number",Double.parseDouble(value.replace(',','.')));
            result.put(ep);
        }
        return result;
    }
    private static String valid(String slug) throws IOException {
        if (slug==null || !slug.matches("[A-Za-z0-9_-]{1,230}")) throw new IOException("Identificador inválido");
        return slug;
    }
    static JSONObject streams(String id) throws Exception {
        Document page = get("/episodio/" + valid(id));
        JSONArray options = new JSONArray();
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        for (Element element : page.select("video source[src], video[src]")) {
            String url = element.absUrl("src");
            if (!url.startsWith("https://") || !seen.add(url)) continue;
            String type = element.attr("type");
            options.put(new JSONObject().put("url", url).put("mimeType",type)
                .put("title","AnimesDrive · "+(type.contains("mp4")?"MP4":"Vídeo")));
        }
        return new JSONObject().put("streams",options);
    }
    static String read(String route) throws Exception {
        String[] parts=route.split("/",4);
        if (parts.length!=4) throw new IOException("Rota inválida");
        String value=Uri.decode(parts[3]);
        if ("search".equals(parts[2])) return search(value).toString();
        if ("episodes".equals(parts[2])) return episodes(value).toString();
        throw new IOException("Rota desconhecida");
    }
    private AnimeDrive() {}
}
