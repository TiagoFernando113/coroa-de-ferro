package com.tiagofernando.coroadeferro;

import android.app.Activity;
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

        web.setWebViewClient(new WebViewClient() {
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

        new Thread(this::procurarAtualizacao).start();
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
                JSONArray arqs = info.getJSONArray("arquivos");
                for (int i = 0; i < arqs.length(); i++) {
                    String a = arqs.getString(i);
                    gravar(new File(tmp, a), baixar(ramo, a));
                }
                gravar(new File(tmp, "versao.json"), vj);

                File velho = new File(getFilesDir(), "jogo_velho");
                apagar(velho);
                if (disco.exists() && !disco.renameTo(velho)) throw new Exception("rename");
                if (!tmp.renameTo(disco)) throw new Exception("rename");
                apagar(velho);

                runOnUiThread(() -> {
                    usarDisco = true;
                    Toast.makeText(this, "Atualizado para a versão " + nova, Toast.LENGTH_SHORT).show();
                    web.reload();
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
}
