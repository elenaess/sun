package com.sun.stream;

import android.net.Uri;
import androidx.media3.common.MimeTypes;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.json.JSONObject;

/** Resolve playlists served at opaque URLs, before Media3 chooses an extractor. */
final class MediaFormat {
    static boolean needsProbe(Uri address, JSONObject source) {
        if (source == null || source.has("checkedFormat")) return false;
        String type = source.optString("mimeType", "").toLowerCase(Locale.ROOT);
        String path = String.valueOf(address.getPath()).toLowerCase(Locale.ROOT);
        return !(type.startsWith("video/") || type.contains("dash") || type.contains("mpegurl") ||
                type.equals("hls") || type.contains("m3u8") ||
                path.matches(".*\\.(m3u8|mpd|mp4|webm|mkv|m4v|mov|ts)$"));
    }

    static String detect(Uri address) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(address.toString()).openConnection();
            connection.setConnectTimeout(4500);
            connection.setReadTimeout(5000);
            connection.setRequestProperty("User-Agent", CatalogApi.AGENT);
            try (InputStream stream = connection.getInputStream()) {
                String content = String.valueOf(connection.getContentType()).toLowerCase(Locale.ROOT);
                if (content.contains("mpegurl")) return MimeTypes.APPLICATION_M3U8;
                if (content.contains("dash+xml")) return MimeTypes.APPLICATION_MPD;
                byte[] head = new byte[512];
                int size = 0;
                while (size < head.length) {
                    int count = stream.read(head, size, head.length - size);
                    if (count < 0) break;
                    size += count;
                    if (size >= 8 && head[0] == '#') break;
                }
                String prefix = new String(head, 0, size, StandardCharsets.UTF_8).replace("\uFEFF", "").trim();
                if (prefix.startsWith("#EXTM3U")) return MimeTypes.APPLICATION_M3U8;
                if (prefix.startsWith("<MPD") || (prefix.startsWith("<?xml") && prefix.contains("<MPD")))
                    return MimeTypes.APPLICATION_MPD;
            }
        } catch (Exception ignored) {
            // An inconclusive probe still allows Media3 to try the actual source.
        } finally {
            if (connection != null) connection.disconnect();
        }
        return "";
    }
    private MediaFormat() {}
}
