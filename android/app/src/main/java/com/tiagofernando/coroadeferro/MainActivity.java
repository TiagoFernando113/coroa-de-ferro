package com.tiagofernando.coroadeferro;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/*
 * O jogo vai dentro do APK (assets/jogo) e abre sem internet.
 * A cada abertura o app confere o versao.json do repositório; se houver
 * versão maior, baixa os arquivos para files/jogo e recarrega. Assim cada
 * mudança enviada ao GitHub chega ao celular sem instalar APK novo.
 *
 * Tudo é servido pelo endereço fixo https://coroa.app/ (interceptado aqui),
 * para o save no localStorage ser o mesmo venha o jogo do APK ou do download.
 */
public class MainActivity extends Activity {
    static final String HOST = "coroa.app";
    static final String INICIO = "https://" + HOST + "/index.html";
    static final String REPO = "https://api.github.com/repos/TiagoFernando113/coroa-de-ferro/contents/";
    static final String[] RAMOS = { "claude/kingshot-style-game-oxhg2l", "main" };

    private WebView web;
    private File disco;
    private volatile boolean usarDisco;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        disco = new File(getFilesDir(), "jogo");
        usarDisco = versaoDisco() > versaoApk();

        web = new WebView(this);
        web.setBackgroundColor(0xff16110b);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // o save do jogo fica no localStorage
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.addJavascriptInterface(new Avisos.Js(this), "Avisos"); // notificações locais
        web.addJavascriptInterface(new App(), "App"); // compartilhar convite, conferir avisos
        Avisos.criarCanal(this);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[] { "android.permission.POST_NOTIFICATIONS" }, 1);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                if (HOST.equals(req.getUrl().getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, req.getUrl())); } catch (Exception e) { }
                return true; // links de fora (WhatsApp, download do app) abrem fora do jogo
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                if (!HOST.equals(req.getUrl().getHost())) return null; // fontes etc. vêm da rede
                String nome = req.getUrl().getLastPathSegment();
                if (nome == null || nome.contains("..")) nome = "index.html";
                try {
                    InputStream in = usarDisco ? new FileInputStream(new File(disco, nome)) : getAssets().open("jogo/" + nome);
                    return new WebResourceResponse(mime(nome), "utf-8", in);
                } catch (Exception e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
                }
            }
        });

        if (saved != null) web.restoreState(saved);
        else web.loadUrl(INICIO);

        checarAgora();
    }

    // ---- ponte com o JavaScript: window.App ----
    class App {
        @JavascriptInterface
        public void compartilhar(String texto) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, texto);
                try { startActivity(Intent.createChooser(i, "Chamar amigo")); } catch (Exception e) { }
            });
        }

        @JavascriptInterface
        public void recarregar() { runOnUiThread(() -> web.reload()); }

        @JavascriptInterface
        public boolean avisosLigados() {
            return getSystemService(NotificationManager.class).areNotificationsEnabled();
        }

        @JavascriptInterface
        public void ajustesAvisos() {
            runOnUiThread(() -> {
                Intent i = Build.VERSION.SDK_INT >= 26
                    ? new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())
                    : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
                try { startActivity(i); } catch (Exception e) { }
            });
        }
    }

    static String mime(String nome) {
        if (nome.endsWith(".html")) return "text/html";
        if (nome.endsWith(".css")) return "text/css";
        if (nome.endsWith(".js")) return "application/javascript";
        if (nome.endsWith(".json")) return "application/json";
        if (nome.endsWith(".svg")) return "image/svg+xml";
        if (nome.endsWith(".png")) return "image/png";
        return "application/octet-stream";
    }

    int versaoApk() {
        try { return new JSONObject(ler(getAssets().open("jogo/versao.json"))).getInt("versao"); }
        catch (Exception e) { return 0; }
    }

    int versaoDisco() {
        try { return new JSONObject(ler(new FileInputStream(new File(disco, "versao.json")))).getInt("versao"); }
        catch (Exception e) { return -1; }
    }

    static String ler(InputStream in) throws Exception {
        return new String(bytes(in), "UTF-8");
    }

    static byte[] bytes(InputStream in) throws Exception {
        try (InputStream i = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            for (int n; (n = i.read(buf)) > 0; ) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }

    static byte[] baixar(String ramo, String arquivo) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(REPO + arquivo + "?ref=" + ramo).openConnection();
        c.setRequestProperty("Accept", "application/vnd.github.raw");
        c.setRequestProperty("User-Agent", "CoroaDeFerro");
        c.setUseCaches(false);
        c.setConnectTimeout(10000);
        c.setReadTimeout(20000);
        if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
        return bytes(c.getInputStream());
    }

    // versao.json do jogo que está rodando agora (do download ou do APK)
    JSONObject infoAtual() {
        try { return new JSONObject(ler(usarDisco ? new FileInputStream(new File(disco, "versao.json")) : getAssets().open("jogo/versao.json"))); }
        catch (Exception e) { return new JSONObject(); }
    }

    byte[] lerLocal(String a) throws Exception {
        return bytes(usarDisco ? new FileInputStream(new File(disco, a)) : getAssets().open("jogo/" + a));
    }

    // confere de novo ao voltar para o app e a cada 3 min com ele aberto (não só ao abrir)
    private final long abertoEm = System.currentTimeMillis();
    private volatile long ultimaChecagem = 0;
    private volatile boolean checando = false;
    private final android.os.Handler relogio = new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable periodica = new Runnable() { public void run() { checarAgora(); relogio.postDelayed(this, 180000); } };

    void checarAgora() {
        if (checando || System.currentTimeMillis() - ultimaChecagem < 60000) return;
        checando = true; ultimaChecagem = System.currentTimeMillis();
        new Thread(() -> { try { procurarAtualizacao(); } finally { checando = false; } }).start();
    }

    void procurarAtualizacao() {
        int atual = Math.max(versaoApk(), versaoDisco());
        for (String ramo : RAMOS) {
            try {
                byte[] vj = baixar(ramo, "versao.json");
                JSONObject info = new JSONObject(new String(vj, "UTF-8"));
                int nova = info.getInt("versao");
                if (nova <= atual) return;

                // baixa tudo numa pasta temporária; só troca se tudo chegou
                File tmp = new File(getFilesDir(), "jogo_novo");
                apagar(tmp);
                tmp.mkdirs();
                // só baixa o que mudou: arquivo com a mesma impressão digital é copiado do que já está no celular
                JSONArray arqs = info.getJSONArray("arquivos");
                JSONObject hNovo = info.optJSONObject("hash"), hVelho = infoAtual().optJSONObject("hash");
                for (int i = 0; i < arqs.length(); i++) {
                    String a = arqs.getString(i), h = hNovo != null ? hNovo.optString(a, "") : "";
                    byte[] b = null;
                    if (!h.isEmpty() && hVelho != null && h.equals(hVelho.optString(a, ""))) { try { b = lerLocal(a); } catch (Exception e) { b = null; } }
                    gravar(new File(tmp, a), b != null ? b : baixar(ramo, a));
                }
                gravar(new File(tmp, "versao.json"), vj);

                File velho = new File(getFilesDir(), "jogo_velho");
                apagar(velho);
                if (disco.exists() && !disco.renameTo(velho)) throw new Exception("rename");
                if (!tmp.renameTo(disco)) throw new Exception("rename");
                apagar(velho);

                runOnUiThread(() -> {
                    usarDisco = true;
                    if (System.currentTimeMillis() - abertoEm < 15000) { // acabou de abrir: recarrega direto
                        Toast.makeText(this, "Atualizado para a versão " + nova, Toast.LENGTH_SHORT).show();
                        web.reload();
                    } else web.evaluateJavascript("window.__novaVersao&&window.__novaVersao(" + nova + ")", null); // no meio do jogo: o jogo mostra o botão
                });
                return;
            } catch (Exception e) {
                // sem internet ou ramo inexistente: tenta o próximo, senão segue com o que tem
            }
        }
    }

    static void gravar(File f, byte[] b) throws Exception {
        try (FileOutputStream o = new FileOutputStream(f)) { o.write(b); }
    }

    static void apagar(File f) {
        File[] fs = f.listFiles();
        if (fs != null) for (File x : fs) apagar(x);
        f.delete();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    // app em segundo plano: pausa o jogo e o som (a página recebe visibilitychange)
    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) { web.evaluateJavascript("window.__pausar&&window.__pausar(true)", null); web.onPause(); }
        relogio.removeCallbacks(periodica);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) { web.onResume(); web.evaluateJavascript("window.__pausar&&window.__pausar(false)", null); }
        relogio.removeCallbacks(periodica); relogio.postDelayed(periodica, 3000);
    }
}
