package com.sun.stream;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.*;
import android.widget.*;
import androidx.media3.common.*;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;
import org.json.*;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;

public class PlayerActivity extends Activity {
    private ExoPlayer player;
    private final ExecutorService network=Executors.newFixedThreadPool(2);
    private int request;
    private boolean visible;
    private boolean online(){return media!=null && ("fhd".equals(media.optString("provider")) || "plugin".equals(media.optString("provider")));}
    private String episodeTag(){return online()?current().optString("id"):"acervo";}
    private PlayerView surface;
    private JSONObject media;
    private JSONArray episodes;
    private Uri local;
    private int episode, quality;
    private long position;
    private boolean playWhenReady=true, fullscreen, rendered;
    private final JSONObject progress=new JSONObject();
    private int px(float dp){return Math.round(dp*getResources().getDisplayMetrics().density);}
    private JSONObject current(){return episodes.optJSONObject(episode);}
    private JSONArray streams(){return current().optJSONArray("streams");}
    private String bookmark(){return media.optString("id")+"/"+current().optString("id");}
    private long resumeAt(){
        long offered=current().optLong("position",0);
        return Math.max(0,getSharedPreferences("native-position",MODE_PRIVATE).getLong(bookmark(),offered));
    }

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        try {
            local=getIntent().getData();
            if(local!=null) {
                if(!"content".equals(local.getScheme()))throw new JSONException("uri");
                JSONObject ep=new JSONObject().put("id","local").put("name","Arquivo do aparelho");
                media=new JSONObject().put("id","local-"+local.toString().hashCode()).put("title","Meu vídeo")
                    .put("episodes",new JSONArray().put(ep));
            } else {
                media=new JSONObject(getIntent().getStringExtra("data"));
            }
            episodes=media.getJSONArray("episodes");
            episode=saved==null?media.optInt("index",0):saved.getInt("episode");
            if(episode<0||episode>=episodes.length()||current()==null)throw new JSONException("episode");
            position=saved==null?resumeAt():saved.getLong("position");
            if(saved!=null){playWhenReady=saved.getBoolean("play");quality=saved.getInt("quality");}
        } catch(Exception e){Toast.makeText(this,"Este vídeo não está disponível.",Toast.LENGTH_SHORT).show();finish();return;}
        setContentView(R.layout.activity_player);
        MainActivity.applyInsets(findViewById(R.id.player_root));
        surface=findViewById(R.id.native_video);
        findViewById(R.id.player_back).setOnClickListener(v->onBackPressed());
        findViewById(R.id.fullscreen).setOnClickListener(v->toggleScreen());
        surface.setFullscreenButtonClickListener(isFull->toggleScreen());
        findViewById(R.id.quality).setOnClickListener(v->chooseQuality());
        findViewById(R.id.retry).setOnClickListener(v->{quality=0;if(online())current().remove("streams");playWhenReady=true;startVideo();});
        ((TextView)findViewById(R.id.watch_title)).setText(media.optString("title"));
        ((TextView)findViewById(R.id.watch_credit)).setText(media.optString("credit"));
        layoutForOrientation();
        updateEpisodes();
    }
    private void updateEpisodes(){
        ((TextView)findViewById(R.id.watch_episode)).setText(current().optString("name"));
        ((TextView)findViewById(R.id.list_title)).setText(episodes.length()>1||media.optBoolean("series")?"Episódios":"Neste vídeo");
        LinearLayout rows=findViewById(R.id.episode_list);
        rows.removeAllViews();
        for(int i=0;i<episodes.length();i++){
            final int index=i;JSONObject ep=episodes.optJSONObject(i);if(ep==null)continue;
            Button b=new Button(this);b.setAllCaps(false);b.setGravity(Gravity.START|Gravity.CENTER_VERTICAL);
            b.setPadding(px(16),0,px(16),0);b.setText((i==episode?"▶    ":"▷    ")+ep.optString("name"));b.setTextColor(Color.WHITE);
            GradientDrawable bg=new GradientDrawable();bg.setColor(0xff242124);bg.setCornerRadius(px(12));
            if(i==episode)bg.setStroke(px(1.3f),0xffbca8ff);
            b.setBackground(bg);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,px(55));lp.bottomMargin=px(7);
            rows.addView(b,lp);b.setOnClickListener(v->{if(index!=episode){checkpoint();episode=index;quality=0;position=resumeAt();playWhenReady=true;updateEpisodes();startVideo();}});
        }
        findViewById(R.id.quality).setVisibility(local==null && streams()!=null && streams().length()>1?View.VISIBLE:View.GONE);
    }
    private void chooseQuality(){
        JSONArray sources=streams();if(sources==null)return;
        String[] names=new String[sources.length()];
        for(int i=0;i<names.length;i++)names[i]=sources.optJSONObject(i).optString("quality");
        new AlertDialog.Builder(this).setTitle("Fonte e qualidade").setSingleChoiceItems(names,quality,(dialog,index)->{
            dialog.dismiss();if(index==quality)return;
            if(player!=null){position=player.getCurrentPosition();playWhenReady=player.getPlayWhenReady();}
            quality=index;startVideo();
        }).show();
    }
    private void startVideo(){
        final int ticket=++request;
        if(!visible)return;
        if(online() && (streams()==null || streams().length()==0)){
            releasePlayer();
            rendered=false;
            findViewById(R.id.play_error).setVisibility(View.GONE);
            final JSONObject ep=current();
            final String type=media.optString("mediaType");
            network.execute(()->{
                try {
                    JSONArray results=CatalogApi.streams(type,ep.getString("id"),media.optInt("sourceIndex",0)).optJSONArray("streams");
                    JSONArray choices=new JSONArray();
                    for(int i=0;results!=null&&i<results.length();i++){
                        JSONObject option=results.optJSONObject(i);if(option==null)continue;
                        Uri address=Uri.parse(option.optString("url"));
                        if(!"https".equalsIgnoreCase(address.getScheme())||address.getHost()==null)continue;
                        String title=option.optString("title",option.optString("name","Fonte "+(i+1)));
                        choices.put(new JSONObject().put("url",address.toString()).put("quality",title)
                            .put("subtitles",option.optJSONArray("subtitles")));
                    }
                    if(choices.length()==0)throw new java.io.IOException("Sem vídeo direto");
                    runOnUiThread(()->{
                        if(!visible||request!=ticket)return;
                        try{ep.put("streams",choices);}catch(JSONException e){return;}
                        updateEpisodes();startVideo();
                    });
                }catch(Exception e){
                    runOnUiThread(()->{if(visible&&ticket==request)error("O provedor não entregou um vídeo para este episódio. Tente novamente.");});
                }
            });
            return;
        }
        releasePlayer();
        findViewById(R.id.play_error).setVisibility(View.GONE);
        rendered=false;surface.setContentDescription("Carregando vídeo");
        try {
            Uri uri=local;
            if(uri==null){
                JSONObject variant=streams().getJSONObject(quality);
                uri=Uri.parse(variant.getString("url"));
                if(!"https".equalsIgnoreCase(uri.getScheme())||uri.getHost()==null)throw new IllegalArgumentException();
            }
            MediaItem.Builder item=new MediaItem.Builder().setUri(uri);
            String path=uri.getPath()==null?"":uri.getPath().toLowerCase(java.util.Locale.ROOT);
            if("hls".equals(current().optString("type")) || path.endsWith(".m3u8") ||
                (online() && !path.endsWith(".mp4") && !path.endsWith(".mkv") && !path.endsWith(".webm")))
                item.setMimeType(MimeTypes.APPLICATION_M3U8);
            if(online()){
                JSONArray subs=streams().getJSONObject(quality).optJSONArray("subtitles");
                List<MediaItem.SubtitleConfiguration> tracks=new ArrayList<>();
                for(int i=0;subs!=null&&i<subs.length();i++){
                    JSONObject sub=subs.optJSONObject(i);if(sub==null)continue;
                    Uri address=Uri.parse(sub.optString("url"));if(!"https".equalsIgnoreCase(address.getScheme()))continue;
                    String language=sub.optString("lang","und");
                    String mime=String.valueOf(address.getPath()).endsWith(".srt")?MimeTypes.APPLICATION_SUBRIP:MimeTypes.TEXT_VTT;
                    tracks.add(new MediaItem.SubtitleConfiguration.Builder(address).setLanguage(language).setMimeType(mime).build());
                }
                item.setSubtitleConfigurations(tracks);
            }
            if("morevna-pt-BR.vtt".equals(current().optString("subtitle"))) {
                MediaItem.SubtitleConfiguration sub=new MediaItem.SubtitleConfiguration.Builder(Uri.parse("asset:///cinema/morevna-pt-BR.vtt"))
                    .setLanguage("pt-BR").setLabel("Português (Brasil)").setMimeType(MimeTypes.TEXT_VTT).setSelectionFlags(C.SELECTION_FLAG_DEFAULT).build();
                item.setSubtitleConfigurations(Collections.singletonList(sub));
            }
            DefaultHttpDataSource.Factory http=new DefaultHttpDataSource.Factory().setUserAgent(CatalogApi.AGENT)
                .setConnectTimeoutMs(15000).setReadTimeoutMs(25000);
            DefaultMediaSourceFactory sources=new DefaultMediaSourceFactory(new DefaultDataSource.Factory(this,http));
            ExoPlayer next=new ExoPlayer.Builder(this).setMediaSourceFactory(sources).setSeekBackIncrementMs(10000).setSeekForwardIncrementMs(10000).build();
            player=next;surface.setPlayer(next);
            next.setTrackSelectionParameters(next.getTrackSelectionParameters().buildUpon()
                .setPreferredTextLanguages("pt-BR","pt","por").setPreferredAudioLanguages("pt-BR","pt","por","ja").build());
            next.setAudioAttributes(AudioAttributes.DEFAULT,true);
            next.setHandleAudioBecomingNoisy(true);
            next.addListener(new Player.Listener(){
                @Override public void onRenderedFirstFrame(){
                    if(player!=next)return;rendered=true;android.util.Log.i("SunPlayback","first-frame "+episodeTag());surface.setContentDescription("Vídeo em reprodução");checkpoint();
                }
                @Override public void onPlaybackStateChanged(int state){if(player==next && state==Player.STATE_ENDED)checkpoint();}
                @Override public void onIsPlayingChanged(boolean active){if(player==next)surface.setKeepScreenOn(active);}
                @Override public void onPlayerError(PlaybackException e){
                    if(player!=next)return;
                    android.util.Log.w("SunPlayback","provider-error "+e.getErrorCodeName()+" "+episodeTag()+" "+safeError(e));
                    if(rendered)position=next.getCurrentPosition();
                    if(local==null && quality+1<streams().length()){quality++;surface.post(()->{if(player==next)startVideo();});}
                    else error("Não foi possível reproduzir esta fonte. Confira sua conexão e tente de novo.");
                }
            });
            next.setMediaItem(item.build(),Math.max(0,position));next.prepare();next.setPlayWhenReady(playWhenReady);
        } catch(Exception e){error("O endereço deste vídeo não pôde ser aberto.");}
    }
    private String safeError(Throwable cause){
        StringBuilder out=new StringBuilder();
        while(cause!=null){
            out.append(cause.getClass().getSimpleName()).append(' ');
            if(cause instanceof androidx.media3.datasource.HttpDataSource.InvalidResponseCodeException){
                out.append(((androidx.media3.datasource.HttpDataSource.InvalidResponseCodeException)cause).responseCode);
            }
            cause=cause.getCause();
        }
        return out.toString();
    }
    private void error(String message){
        ((TextView)findViewById(R.id.error_message)).setText(message);
        findViewById(R.id.play_error).setVisibility(View.VISIBLE);
    }
    private void checkpoint(){
        if(player==null||!rendered)return;
        long elapsed=Math.max(0,player.getCurrentPosition()), duration=player.getDuration();
        boolean ended=player.getPlaybackState()==Player.STATE_ENDED;
        long resume=ended?0:elapsed;
        getSharedPreferences("native-position",MODE_PRIVATE).edit().putLong(bookmark(),resume).apply();
        if(local!=null)return;
        try {
            progress.put(current().optString("id"),new JSONObject().put("position",resume).put("duration",Math.max(0,duration)).put("ended",ended));
            JSONObject payload=new JSONObject().put("id",media.optString("id")).put("last",current().optString("id")).put("episodes",progress);
            setResult(RESULT_OK,new Intent().putExtra("progress",payload.toString()));
        } catch(JSONException ignored){}
    }
    private void releasePlayer(){
        if(player!=null){ExoPlayer old=player;player=null;surface.setPlayer(null);old.release();}
    }
    private void toggleScreen(){
        setRequestedOrientation(fullscreen?ActivityInfo.SCREEN_ORIENTATION_PORTRAIT:ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
    }
    private void layoutForOrientation(){
        fullscreen=getResources().getConfiguration().orientation==Configuration.ORIENTATION_LANDSCAPE;
        getWindow().getDecorView().setSystemUiVisibility(fullscreen?View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY:View.SYSTEM_UI_FLAG_VISIBLE);
        findViewById(R.id.player_details).setVisibility(fullscreen?View.GONE:View.VISIBLE);
        findViewById(R.id.player_toolbar).setVisibility(fullscreen?View.GONE:View.VISIBLE);
        View frame=findViewById(R.id.video_frame);
        int w=getResources().getDisplayMetrics().widthPixels;
        frame.setLayoutParams(new LinearLayout.LayoutParams(-1,fullscreen?-1:Math.max(px(210),w*9/16)));
    }
    @Override public void onConfigurationChanged(Configuration c){super.onConfigurationChanged(c);layoutForOrientation();}
    @Override protected void onStart(){super.onStart();visible=true;if(surface!=null)startVideo();}
    @Override protected void onStop(){
        visible=false;++request;if(player!=null){checkpoint();position=player.getCurrentPosition();playWhenReady=player.getPlayWhenReady();}
        releasePlayer();super.onStop();
    }
    @Override protected void onDestroy(){network.shutdownNow();super.onDestroy();}
    @Override protected void onSaveInstanceState(Bundle b){super.onSaveInstanceState(b);b.putInt("episode",episode);b.putInt("quality",quality);b.putLong("position",player==null?position:player.getCurrentPosition());b.putBoolean("play",player==null?playWhenReady:player.getPlayWhenReady());}
    @Override public void onBackPressed(){if(fullscreen){toggleScreen();return;}checkpoint();super.onBackPressed();}
}
