package com.tiagofernando.coroadeferro;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/*
 * O app é só uma janela para o jogo publicado no GitHub Pages.
 * Por isso qualquer mudança enviada ao repositório aparece aqui sem
 * instalar APK novo: basta fechar e abrir o app.
 */
public class MainActivity extends Activity {
    static final String URL = "https://tiagofernando113.github.io/coroa-de-ferro/";

    static final String ERRO = "<html><body style='background:#16110b;color:#f1e6d0;font-family:sans-serif;"
        + "display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;text-align:center'>"
        + "<h2 style='color:#e9b949'>Sem conexão</h2><p>O reino precisa de internet para carregar.</p>"
        + "<button style='padding:12px 20px;border:0;border-radius:10px;background:#e9b949;font-weight:bold'"
        + " onclick=\"location.href='" + URL + "'\">Tentar de novo</button></body></html>";

    private WebView web;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        web.setBackgroundColor(0xff16110b);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // o save do jogo fica no localStorage
        s.setDatabaseEnabled(true);

        // Fase de desenvolvimento: sempre buscar a versão mais nova.
        // (limpa só o cache de arquivos; o save não é apagado)
        web.clearCache(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) v.loadDataWithBaseURL(null, ERRO, "text/html", "utf-8", null);
            }
        });

        if (saved != null) web.restoreState(saved);
        else web.loadUrl(URL);
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
