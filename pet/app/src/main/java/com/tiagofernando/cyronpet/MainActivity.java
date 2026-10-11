package com.tiagofernando.cyronpet;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.ViewConfiguration;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/*
 * A base da aventura: a cena grande (a mesma que roda no canto), as melhorias
 * compradas com moedas, os acessórios comprados com cristais e o botão que põe
 * (ou tira) a aventura no cantinho da tela. Tudo montado em código.
 */
public class MainActivity extends Activity {
    static final int FUNDO = 0xFF121833, CARTAO = 0xFF1B2347, BORDA = 0xFF2C3768;
    static final int TEXTO = 0xFFEEF0F7, FRACO = 0xFF9AA3C8, CIANO = 0xFF36C6F0, LILAS = 0xFF9A78E8, OURO = 0xFFF3C13F;

    private Jogo jogo;
    private CenaView cena;
    private TextView sub, moedas, cristais, status, aviso;
    private Button botaoTela;
    private Button[] tamanhos;
    private final TextView[] upNivel = new TextView[6], upTexto = new TextView[6];
    private final Button[] upBotao = new Button[6];
    private LinearLayout visual;
    private String visualMontado = "";
    private final Handler h = new Handler(Looper.getMainLooper());
    private boolean querTela, ligarDepoisDaPermissao;
    private long ultimoTexto;

    private int dp(float v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        jogo = Salvo.jogo(this);

        ScrollView rolar = new ScrollView(this);
        rolar.setBackgroundColor(FUNDO);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(16), dp(16), dp(16), dp(28));
        rolar.addView(col);

        // cabeçalho
        LinearLayout topo = new LinearLayout(this);
        topo.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout nomes = new LinearLayout(this);
        nomes.setOrientation(LinearLayout.VERTICAL);
        TextView nome = texto("CYRON", 26, TEXTO, true);
        nome.setLetterSpacing(0.06f);
        sub = texto("", 13, CIANO, true);
        nomes.addView(nome);
        nomes.addView(sub);
        topo.addView(nomes, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        LinearLayout bolsa = new LinearLayout(this);
        bolsa.setOrientation(LinearLayout.VERTICAL);
        bolsa.setGravity(Gravity.END);
        moedas = pilula(OURO);
        cristais = pilula(0xFF7FE6F2);
        bolsa.addView(moedas);
        LinearLayout.LayoutParams lc = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lc.topMargin = dp(4);
        bolsa.addView(cristais, lc);
        topo.addView(bolsa);
        col.addView(topo);

        // a cena grande
        FrameLayout palco = new FrameLayout(this);
        palco.setBackground(fundo(CARTAO, BORDA, 18));
        palco.setClipToOutline(true);
        cena = new CenaView(this, jogo, CenaView.APP);
        palco.addView(cena, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        int folga = ViewConfiguration.get(this).getScaledTouchSlop();
        final float[] inicio = new float[2];
        cena.setOnTouchListener((v, e) -> {
            if (e.getActionMasked() == MotionEvent.ACTION_DOWN) { inicio[0] = e.getX(); inicio[1] = e.getY(); }
            else if (e.getActionMasked() == MotionEvent.ACTION_UP && Math.hypot(e.getX() - inicio[0], e.getY() - inicio[1]) < folga) {
                cena.toque(e.getX(), e.getY());
                atualizarTextos();
            }
            return true;
        });
        LinearLayout.LayoutParams lpPalco = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(220));
        lpPalco.topMargin = dp(12);
        col.addView(palco, lpPalco);
        TextView dicaCena = texto("Toque na tela para ela bater mais forte. Toque nos baús e nas moedas douradas antes que sumam.", 12.5f, FRACO, false);
        dicaCena.setPadding(dp(2), dp(8), dp(2), 0);
        col.addView(dicaCena);

        // jogar no cantinho
        botaoTela = botao("", CIANO, 0xFF06233A);
        botaoTela.setTextSize(17);
        botaoTela.setOnClickListener(v -> alternarTela());
        LinearLayout.LayoutParams lt = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56));
        lt.topMargin = dp(14);
        col.addView(botaoTela, lt);
        aviso = texto("", 12.5f, FRACO, false);
        aviso.setPadding(dp(2), dp(8), dp(2), 0);
        col.addView(aviso);
        LinearLayout linhaTam = new LinearLayout(this);
        linhaTam.setGravity(Gravity.CENTER_VERTICAL);
        linhaTam.setPadding(0, dp(10), 0, 0);
        linhaTam.addView(texto("Tamanho no canto", 14, FRACO, true), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        String[] nomesTam = { "Pequena", "Média", "Grande" };
        tamanhos = new Button[3];
        for (int i = 0; i < 3; i++) {
            final int tam = i;
            Button bt = botao(nomesTam[i], CARTAO, TEXTO);
            bt.setTextSize(13);
            bt.setOnClickListener(v -> mudarTamanho(tam));
            LinearLayout.LayoutParams l = new LinearLayout.LayoutParams(dp(80), dp(40));
            l.setMarginStart(dp(6));
            linhaTam.addView(bt, l);
            tamanhos[i] = bt;
        }
        col.addView(linhaTam);

        // melhorias
        col.addView(titulo("Melhorias"));
        status = texto("", 13, FRACO, false);
        col.addView(status);
        for (int i = 0; i < 6; i++) col.addView(linhaMelhoria(i));

        // visual
        col.addView(titulo("Visual"));
        col.addView(texto("Acessórios saem por cristais. Os cristais vêm dos baús e a cada 5 zonas.", 13, FRACO, false));
        visual = new LinearLayout(this);
        visual.setOrientation(LinearLayout.VERTICAL);
        visual.setPadding(0, dp(8), 0, 0);
        col.addView(visual);

        TextView rodape = texto("A CYRON também é um bot do Discord que traduz o seu servidor para várias línguas ao mesmo tempo. Conheça em hicyron.github.io", 12.5f, FRACO, false);
        rodape.setPadding(dp(2), dp(22), dp(2), 0);
        rodape.setOnClickListener(v -> {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://hicyron.github.io"))); } catch (Exception ignorado) { }
        });
        col.addView(rodape);

        setContentView(rolar);
    }

    @Override
    protected void onResume() {
        super.onResume();
        jogo.avancar(System.currentTimeMillis());
        if (jogo.ausencia != null) {
            String a = jogo.ausencia;
            jogo.ausencia = null;
            new AlertDialog.Builder(this).setTitle("Bem-vindo de volta!").setMessage(a).setPositiveButton("Boa!", null).show();
        }
        if (querTela && Settings.canDrawOverlays(this)) { querTela = false; ligarNaTela(); }
        // se era para estar no canto mas o serviço morreu (reinício do celular, limpeza de memória), volta
        else if (jogo.naTela && PetService.ativo == null && Settings.canDrawOverlays(this)) ligarServico();
        visualMontado = "";
        atualizarTextos();
        h.post(laco);
    }

    @Override
    protected void onPause() {
        super.onPause();
        h.removeCallbacks(laco);
        Salvo.salvar(this);
    }

    private final Runnable laco = new Runnable() {
        @Override
        public void run() {
            jogo.avancar(System.currentTimeMillis());
            cena.invalidate();
            long agora = SystemClock.uptimeMillis();
            if (agora - ultimoTexto > 300) { ultimoTexto = agora; atualizarTextos(); }
            h.postDelayed(this, 33);
        }
    };

    /* ---------- melhorias ---------- */
    private LinearLayout linhaMelhoria(int i) {
        LinearLayout linha = new LinearLayout(this);
        linha.setGravity(Gravity.CENTER_VERTICAL);
        linha.setPadding(dp(14), dp(10), dp(10), dp(10));
        linha.setBackground(fundo(CARTAO, BORDA, 14));
        LinearLayout info = new LinearLayout(this);
        info.setOrientation(LinearLayout.VERTICAL);
        LinearLayout titulo = new LinearLayout(this);
        titulo.setGravity(Gravity.BOTTOM);
        titulo.addView(texto(Jogo.UP_NOME[i], 16, TEXTO, true));
        upNivel[i] = texto("", 13, OURO, true);
        upNivel[i].setPadding(dp(8), 0, 0, 0);
        titulo.addView(upNivel[i]);
        info.addView(titulo);
        upTexto[i] = texto("", 12.5f, FRACO, false);
        info.addView(upTexto[i]);
        linha.addView(info, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        Button b = botao("", OURO, 0xFF2A1A04);
        b.setTextSize(14);
        b.setOnClickListener(v -> {
            if (jogo.comprar(i)) { Salvo.salvar(this); atualizarTextos(); }
        });
        upBotao[i] = b;
        LinearLayout.LayoutParams lb = new LinearLayout.LayoutParams(dp(108), dp(46));
        lb.setMarginStart(dp(8));
        linha.addView(b, lb);
        LinearLayout.LayoutParams l = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        l.topMargin = dp(8);
        linha.setLayoutParams(l);
        return linha;
    }

    private String descricao(int i) {
        switch (i) {
            case Jogo.ARMA: {
                int prox = (jogo.tierArma() + 1) * 25;
                String arma = Jogo.ARMAS[jogo.tierArma()];
                return arma + ": " + Jogo.curto(jogo.ataque()) + " por golpe" + (jogo.tierArma() < 4 ? ". Arma nova no nível " + prox + "." : ".");
            }
            case Jogo.MOLETOM: return "Vida: " + Jogo.curto(jogo.vidaMax()) + ". Aguenta mais antes de desmaiar.";
            case Jogo.TENIS:
                return String.format(java.util.Locale.ROOT, "%.2f", 1 / jogo.intervalo()).replace('.', ',') + " golpes por segundo" + (jogo.up[Jogo.TENIS] >= Jogo.UP_MAX[Jogo.TENIS] ? " (máximo)." : ".");
            case Jogo.MUNDINHO:
                return jogo.up[Jogo.MUNDINHO] == 0 ? "O planetinha aprende a soltar raios junto com ela." : "Raio de " + Jogo.curto(jogo.danoMundinho()) + " a cada 2,5 segundos.";
            case Jogo.SORTE: return "+" + (jogo.up[Jogo.SORTE] * 10) + "% de moedas de cada monstro, baú e moeda dourada.";
            default: return "Seu toque na tela: " + Jogo.curto(jogo.danoToque()) + " de dano.";
        }
    }

    private void atualizarTextos() {
        sub.setText("Nível " + jogo.nivel + "  ·  " + Jogo.regiaoDa(jogo.zona) + "  ·  recorde: zona " + jogo.recorde);
        moedas.setText("● " + Jogo.curto(jogo.ouro));
        cristais.setText("◆ " + jogo.cristais);
        status.setText("Ataque " + Jogo.curto(jogo.ataque()) + "  ·  Vida " + Jogo.curto(jogo.vidaMax()) + "  ·  " + Jogo.curto(jogo.totalAbates) + " monstros derrotados");
        for (int i = 0; i < 6; i++) {
            upNivel[i].setText("nv " + jogo.up[i]);
            upTexto[i].setText(descricao(i));
            boolean maximo = jogo.up[i] >= Jogo.UP_MAX[i];
            boolean pode = !maximo && jogo.ouro >= jogo.custo(i);
            upBotao[i].setText(maximo ? "Máximo" : "● " + Jogo.curto(jogo.custo(i)));
            upBotao[i].setEnabled(pode);
            upBotao[i].setBackground(fundo(pode ? OURO : CARTAO, pode ? OURO : BORDA, 12));
            upBotao[i].setTextColor(pode ? 0xFF2A1A04 : FRACO);
        }
        botaoTela.setText(jogo.naTela ? "Tirar do cantinho da tela" : "Jogar no cantinho da tela");
        botaoTela.setBackground(fundo(jogo.naTela ? CARTAO : CIANO, jogo.naTela ? BORDA : CIANO, 16));
        botaoTela.setTextColor(jogo.naTela ? TEXTO : 0xFF06233A);
        aviso.setText(jogo.naTela
            ? "A aventura está rodando no canto. Arraste para mudar de lugar, toque no – para virar uma bolinha e na bolsa para voltar aqui."
            : "A aventura fica numa janelinha no canto, por cima dos outros apps, enquanto você usa o celular. Só a janelinha recebe toque; o resto funciona normal.");
        for (int i = 0; i < tamanhos.length; i++) {
            boolean sel = i == jogo.tamanho;
            tamanhos[i].setBackground(fundo(sel ? LILAS : CARTAO, sel ? LILAS : BORDA, 12));
            tamanhos[i].setTextColor(sel ? 0xFF140A30 : TEXTO);
        }
        montarVisual();
    }

    private void montarVisual() {
        StringBuilder sb = new StringBuilder().append(jogo.acessorio).append('|').append(jogo.comprados);
        for (String[] a : Jogo.ACESSORIOS) sb.append(jogo.cristais >= Long.parseLong(a[2]) ? '1' : '0');
        if (sb.toString().equals(visualMontado)) return;
        visualMontado = sb.toString();
        visual.removeAllViews();
        for (int i = 0; i < Jogo.ACESSORIOS.length; i++) {
            String[] a = Jogo.ACESSORIOS[i];
            boolean tem = jogo.comprados.contains(a[0]), usando = a[0].equals(jogo.acessorio);
            long preco = Long.parseLong(a[2]);
            LinearLayout linha = new LinearLayout(this);
            linha.setGravity(Gravity.CENTER_VERTICAL);
            linha.setPadding(dp(14), dp(8), dp(10), dp(8));
            linha.setBackground(fundo(CARTAO, BORDA, 14));
            LinearLayout info = new LinearLayout(this);
            info.setOrientation(LinearLayout.VERTICAL);
            info.addView(texto(a[1], 15, TEXTO, true));
            info.addView(texto(tem ? (usando ? "Usando agora" : "Já é dela") : "◆ " + preco + " cristais", 12.5f, tem ? CIANO : FRACO, false));
            linha.addView(info, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            final int idx = i;
            Button b;
            if (tem) {
                b = botao(usando ? "Tirar" : "Usar", usando ? CARTAO : CIANO, usando ? TEXTO : 0xFF06233A);
                if (usando) b.setBackground(fundo(CARTAO, BORDA, 12));
                b.setOnClickListener(v -> { jogo.vestir(a[0]); Salvo.salvar(this); atualizarTextos(); });
            } else {
                boolean pode = jogo.cristais >= preco;
                b = botao("Comprar", pode ? 0xFF7FE6F2 : CARTAO, pode ? 0xFF06233A : FRACO);
                if (!pode) b.setBackground(fundo(CARTAO, BORDA, 12));
                b.setEnabled(pode);
                b.setOnClickListener(v -> { if (jogo.comprarAcessorio(idx)) { Salvo.salvar(this); atualizarTextos(); } });
            }
            linha.addView(b, new LinearLayout.LayoutParams(dp(100), dp(42)));
            LinearLayout.LayoutParams l = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            l.bottomMargin = dp(8);
            visual.addView(linha, l);
        }
    }

    /* ---------- no cantinho da tela ---------- */
    private void alternarTela() {
        if (jogo.naTela) {
            jogo.naTela = false;
            Salvo.salvar(this);
            stopService(new Intent(this, PetService.class));
            atualizarTextos();
            return;
        }
        if (!Settings.canDrawOverlays(this)) {
            new AlertDialog.Builder(this)
                .setTitle("Jogar no cantinho da tela")
                .setMessage("Para a aventura ficar por cima dos outros apps, o Android pede uma permissão. Na próxima tela, ative \"Aparecer sobre outros apps\" para o CYRON Pet e depois volte aqui.")
                .setPositiveButton("Abrir configurações", (dlg, w) -> {
                    querTela = true;
                    try {
                        startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName())));
                    } catch (Exception e) {
                        startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION));
                    }
                })
                .setNegativeButton("Agora não", null)
                .show();
            return;
        }
        ligarNaTela();
    }

    private void ligarNaTela() {
        // O aviso fixo (com o botão Guardar) precisa da permissão de notificação no Android 13+.
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED && !ligarDepoisDaPermissao) {
            ligarDepoisDaPermissao = true;
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 1);
            return;
        }
        ligarDepoisDaPermissao = false;
        ligarServico();
        Toast.makeText(this, "Pronto! A aventura está no cantinho da tela.", Toast.LENGTH_SHORT).show();
        h.postDelayed(() -> moveTaskToBack(true), 700);
    }

    @Override
    public void onRequestPermissionsResult(int codigo, String[] permissoes, int[] resultados) {
        super.onRequestPermissionsResult(codigo, permissoes, resultados);
        if (ligarDepoisDaPermissao) ligarNaTela();
    }

    private void ligarServico() {
        jogo.naTela = true;
        Salvo.salvar(this);
        try { startForegroundService(new Intent(this, PetService.class)); }
        catch (Exception e) { Toast.makeText(this, "O Android não deixou abrir agora. Tente de novo.", Toast.LENGTH_LONG).show(); }
        atualizarTextos();
    }

    private void mudarTamanho(int tam) {
        if (jogo.tamanho == tam) return;
        jogo.tamanho = tam;
        Salvo.salvar(this);
        if (PetService.ativo != null) PetService.ativo.tamanhoMudou();
        atualizarTextos();
    }

    /* ---------- peças de interface ---------- */
    private TextView texto(String s, float sp, int cor, boolean negrito) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(cor);
        if (negrito) t.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        return t;
    }

    private TextView titulo(String s) {
        TextView t = texto(s, 21, TEXTO, true);
        t.setPadding(0, dp(22), 0, dp(2));
        return t;
    }

    private TextView pilula(int cor) {
        TextView t = texto("", 15, cor, true);
        t.setPadding(dp(12), dp(5), dp(12), dp(5));
        t.setBackground(fundo(CARTAO, BORDA, 16));
        return t;
    }

    private GradientDrawable fundo(int cor, int borda, float raio) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(cor);
        g.setCornerRadius(dp(raio));
        g.setStroke(dp(1), borda);
        return g;
    }

    private Button botao(String s, int cor, int corTexto) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(15);
        b.setTextColor(corTexto);
        b.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        b.setBackground(fundo(cor, cor, 14));
        b.setStateListAnimator(null);
        b.setPadding(dp(8), 0, dp(8), 0);
        return b;
    }
}
