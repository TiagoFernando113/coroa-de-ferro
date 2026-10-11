package com.tiagofernando.cyronpet;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
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
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/*
 * A tela de cuidar da CYRON: ver como ela está, dar comida, brincar, mandar
 * dormir, comprar acessórios e colocar (ou guardar) ela na tela.
 * Tudo montado em código, sem XML de layout.
 */
public class MainActivity extends Activity {
    static final int FUNDO = 0xFF121833, CARTAO = 0xFF1B2347, BORDA = 0xFF2C3768;
    static final int TEXTO = 0xFFEEF0F7, FRACO = 0xFF9AA3C8, CIANO = 0xFF36C6F0, LILAS = 0xFF9A78E8;
    static final int OURO = 0xFFF3C13F, LARANJA = 0xFFF3A23F, ROSA = 0xFFFF6FA8;

    private Pet pet;
    private VistaPet vista;
    private TextView nivel, moedas, estado, aviso;
    private Barra barriga, energia, humor;
    private Button botaoTela, botaoDormir, botaoBrincar;
    private LinearLayout loja;
    private final Handler h = new Handler(Looper.getMainLooper());
    private boolean querTela, ligarDepoisDaPermissao;
    private Button[] tamanhos;
    private long fimDaAcao;

    private int dp(float v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        pet = Pet.de(this);

        ScrollView rolar = new ScrollView(this);
        rolar.setBackgroundColor(FUNDO);
        rolar.setFillViewport(true);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(18), dp(18), dp(18), dp(28));
        rolar.addView(col);

        // cabeçalho: nome, amizade e moedas
        LinearLayout topo = new LinearLayout(this);
        topo.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout nomes = new LinearLayout(this);
        nomes.setOrientation(LinearLayout.VERTICAL);
        TextView nome = texto("CYRON", 28, TEXTO, true);
        nome.setLetterSpacing(0.06f);
        nivel = texto("", 14, CIANO, true);
        nomes.addView(nome);
        nomes.addView(nivel);
        topo.addView(nomes, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        moedas = texto("", 18, OURO, true);
        moedas.setPadding(dp(14), dp(8), dp(14), dp(8));
        moedas.setBackground(fundo(CARTAO, BORDA, 20));
        topo.addView(moedas);
        col.addView(topo);

        // a CYRON grande
        FrameLayout palco = new FrameLayout(this);
        palco.setBackground(fundo(CARTAO, BORDA, 22));
        vista = new VistaPet(this, getResources().getDisplayMetrics().density * 2.2f);
        vista.animarSozinha = true;
        palco.addView(vista, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(250)));
        palco.setOnClickListener(v -> carinho());
        LinearLayout.LayoutParams lpPalco = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(250));
        lpPalco.topMargin = dp(14);
        col.addView(palco, lpPalco);

        estado = texto("", 15, TEXTO, false);
        estado.setPadding(0, dp(12), 0, dp(4));
        col.addView(estado);

        barriga = barra(col, "Barriga", LARANJA);
        energia = barra(col, "Energia", CIANO);
        humor = barra(col, "Humor", ROSA);

        // ações
        LinearLayout acoes = new LinearLayout(this);
        acoes.setPadding(0, dp(12), 0, 0);
        Button comer = botao("Dar comida", LARANJA, 0xFF2A1A04);
        comer.setOnClickListener(v -> escolherComida());
        botaoBrincar = botao("Brincar", ROSA, 0xFF3A0A1E);
        botaoBrincar.setOnClickListener(v -> brincar());
        botaoDormir = botao("Dormir", LILAS, 0xFF140A30);
        botaoDormir.setOnClickListener(v -> dormirOuAcordar());
        for (Button bt : new Button[] { comer, botaoBrincar, botaoDormir }) {
            LinearLayout.LayoutParams l = new LinearLayout.LayoutParams(0, dp(52), 1);
            l.setMarginEnd(bt == botaoDormir ? 0 : dp(8));
            acoes.addView(bt, l);
        }
        col.addView(acoes);

        botaoTela = botao("", CIANO, 0xFF06233A);
        botaoTela.setTextSize(17);
        botaoTela.setOnClickListener(v -> alternarTela());
        LinearLayout.LayoutParams lt = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(58));
        lt.topMargin = dp(16);
        col.addView(botaoTela, lt);
        aviso = texto("", 13, FRACO, false);
        aviso.setPadding(dp(2), dp(8), dp(2), 0);
        col.addView(aviso);

        LinearLayout linhaTam = new LinearLayout(this);
        linhaTam.setGravity(Gravity.CENTER_VERTICAL);
        linhaTam.setPadding(0, dp(12), 0, 0);
        linhaTam.addView(texto("Tamanho na tela", 14, FRACO, true), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        String[] nomesTam = { "Pequena", "Média", "Grande" };
        tamanhos = new Button[3];
        for (int i = 0; i < 3; i++) {
            final int tam = i;
            Button bt = botao(nomesTam[i], CARTAO, TEXTO);
            bt.setTextSize(13);
            bt.setOnClickListener(v -> mudarTamanho(tam));
            LinearLayout.LayoutParams l = new LinearLayout.LayoutParams(dp(82), dp(40));
            l.setMarginStart(dp(6));
            linhaTam.addView(bt, l);
            tamanhos[i] = bt;
        }
        col.addView(linhaTam);

        TextView tituloLoja = texto("Loja", 22, TEXTO, true);
        tituloLoja.setPadding(0, dp(22), 0, dp(4));
        col.addView(tituloLoja);
        TextView dicaLoja = texto("Ela junta moedas enquanto fica com você na tela: uma por minuto, duas se estiver feliz.", 13, FRACO, false);
        col.addView(dicaLoja);
        loja = new LinearLayout(this);
        loja.setOrientation(LinearLayout.VERTICAL);
        loja.setPadding(0, dp(8), 0, 0);
        col.addView(loja);

        TextView rodape = texto("A CYRON também é um bot do Discord que traduz o seu servidor para várias línguas ao mesmo tempo. Conheça em hicyron.github.io", 13, FRACO, false);
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
        if (querTela && Settings.canDrawOverlays(this)) { querTela = false; ligarNaTela(); }
        // se ela devia estar na tela mas o serviço morreu (reinício do celular, limpeza de memória), volta
        else if (pet.naTela && PetService.ativo == null && Settings.canDrawOverlays(this)) ligarServico();
        h.post(relogio);
    }

    @Override
    protected void onPause() {
        super.onPause();
        h.removeCallbacks(relogio);
        pet.salvar();
    }

    private final Runnable relogio = new Runnable() {
        @Override
        public void run() {
            atualizar();
            h.postDelayed(this, 1000);
        }
    };

    /* ---------- ações ---------- */
    private void carinho() {
        if (pet.dormindo) { Toast.makeText(this, "Shhh... ela está dormindo.", Toast.LENGTH_SHORT).show(); return; }
        pet.carinho();
        pet.salvar();
        vista.coracao();
        mostrarAcao(Desenho.Pose.BRINCANDO, Desenho.Olhos.FELIZ, 1200);
        atualizar();
    }

    private void escolherComida() {
        String[] itens = new String[Pet.COMIDAS.length];
        for (int i = 0; i < itens.length; i++) itens[i] = Pet.COMIDAS[i][1] + "  ·  " + Pet.COMIDAS[i][2] + " moedas  ·  +" + Pet.COMIDAS[i][3] + " de barriga";
        new AlertDialog.Builder(this)
            .setTitle("O que ela vai comer?")
            .setItems(itens, (d, i) -> {
                pet.atualizar(System.currentTimeMillis());
                if (pet.barriga >= 98) { Toast.makeText(this, "Ela já está cheia!", Toast.LENGTH_SHORT).show(); return; }
                if (!pet.comer(i)) { Toast.makeText(this, "Faltam moedas. Deixe ela um pouco na tela para juntar.", Toast.LENGTH_LONG).show(); return; }
                pet.salvar();
                vista.comida = i;
                vista.coracao();
                mostrarAcao(Desenho.Pose.COMENDO, Desenho.Olhos.FELIZ, 2600);
                if (PetService.ativo != null) PetService.ativo.comeu(i);
                atualizar();
            })
            .setNegativeButton("Agora não", null)
            .show();
    }

    private void brincar() {
        pet.atualizar(System.currentTimeMillis());
        if (!pet.brincar()) {
            String motivo = pet.dormindo ? "Ela está dormindo." : pet.energia < 15 ? "Ela está cansada demais. Deixe ela dormir." : "Ela está com fome. Dê comida antes.";
            Toast.makeText(this, motivo, Toast.LENGTH_SHORT).show();
            return;
        }
        pet.salvar();
        vista.coracao();
        mostrarAcao(Desenho.Pose.BRINCANDO, Desenho.Olhos.FELIZ, 3000);
        if (PetService.ativo != null) PetService.ativo.brincou();
        atualizar();
    }

    private void dormirOuAcordar() {
        pet.atualizar(System.currentTimeMillis());
        pet.dormindo = !pet.dormindo;
        pet.salvar();
        fimDaAcao = 0;
        if (PetService.ativo != null) PetService.ativo.mudou();
        atualizar();
    }

    private void mostrarAcao(Desenho.Pose pose, Desenho.Olhos olhos, long ms) {
        vista.pose = pose;
        vista.olhos = olhos;
        fimDaAcao = SystemClock.uptimeMillis() + ms;
    }

    /* ---------- na tela, por cima dos apps ---------- */
    private void alternarTela() {
        if (pet.naTela) {
            pet.naTela = false;
            pet.salvar();
            stopService(new Intent(this, PetService.class));
            atualizar();
            return;
        }
        if (!Settings.canDrawOverlays(this)) {
            new AlertDialog.Builder(this)
                .setTitle("Deixar a CYRON passear na tela")
                .setMessage("Para ela ficar por cima dos outros apps, o Android pede uma permissão. Na próxima tela, ative \"Aparecer sobre outros apps\" para o CYRON Pet e depois volte aqui.")
                .setPositiveButton("Abrir configurações", (d, w) -> {
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
        // Pergunta antes e só sai para a tela inicial depois da resposta.
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED && !ligarDepoisDaPermissao) {
            ligarDepoisDaPermissao = true;
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 1);
            return;
        }
        ligarDepoisDaPermissao = false;
        ligarServico();
        Toast.makeText(this, "Pronto! Ela está passeando na sua tela.", Toast.LENGTH_SHORT).show();
        h.postDelayed(() -> moveTaskToBack(true), 700);
    }

    @Override
    public void onRequestPermissionsResult(int codigo, String[] permissoes, int[] resultados) {
        super.onRequestPermissionsResult(codigo, permissoes, resultados);
        if (ligarDepoisDaPermissao) ligarNaTela();
    }

    private void mudarTamanho(int tam) {
        if (pet.tamanho == tam) return;
        pet.tamanho = tam;
        pet.salvar();
        // a janelinha muda de tamanho: reinicia o passeio com o tamanho novo
        if (pet.naTela && PetService.ativo != null) {
            stopService(new Intent(this, PetService.class));
            h.postDelayed(this::ligarServico, 300);
        }
        atualizar();
    }

    private void ligarServico() {
        pet.naTela = true;
        pet.salvar();
        try { startForegroundService(new Intent(this, PetService.class)); }
        catch (Exception e) { Toast.makeText(this, "O Android não deixou ela sair agora. Tente de novo.", Toast.LENGTH_LONG).show(); }
        atualizar();
    }

    /* ---------- desenho da tela ---------- */
    private void atualizar() {
        pet.atualizar(System.currentTimeMillis());
        int n = pet.nivel();
        long falta = pet.amizadeDoNivel(n + 1) - pet.amizade;
        nivel.setText("Amizade nível " + n + "  ·  faltam " + falta + " para o próximo");
        moedas.setText("● " + pet.moedas);
        barriga.valor(pet.barriga);
        energia.valor(pet.energia);
        humor.valor(pet.humor);

        if (SystemClock.uptimeMillis() > fimDaAcao) {
            vista.comida = -1;
            if (pet.dormindo) { vista.pose = Desenho.Pose.DORMINDO; vista.olhos = Desenho.Olhos.FECHADOS; }
            else {
                vista.pose = Desenho.Pose.PARADA;
                vista.olhos = "triste".equals(pet.queixa()) || "fome".equals(pet.queixa()) ? Desenho.Olhos.TRISTE : Desenho.Olhos.NORMAL;
            }
        }
        vista.mundinhoDormindo = pet.dormindo;
        vista.acessorio = pet.acessorio;

        String q = pet.queixa();
        if (pet.dormindo) estado.setText("Dormindo. Acorda sozinha quando a energia encher.");
        else if (q.equals("fome")) estado.setText("Ela está com fome.");
        else if (q.equals("sono")) estado.setText("Ela está com sono. Mande dormir um pouco.");
        else if (q.equals("triste")) estado.setText("Ela está tristinha. Brinque com ela.");
        else if (pet.humor > 80) estado.setText("Feliz da vida! Toque nela para um carinho.");
        else estado.setText("Tudo certo por aqui. Toque nela para um carinho.");

        botaoDormir.setText(pet.dormindo ? "Acordar" : "Dormir");
        for (int i = 0; i < tamanhos.length; i++) {
            boolean sel = i == pet.tamanho;
            tamanhos[i].setBackground(fundo(sel ? LILAS : CARTAO, sel ? LILAS : BORDA, 12));
            tamanhos[i].setTextColor(sel ? 0xFF140A30 : TEXTO);
        }
        botaoTela.setText(pet.naTela ? "Guardar a CYRON" : "Colocar a CYRON na tela");
        botaoTela.setBackground(fundo(pet.naTela ? CARTAO : CIANO, pet.naTela ? BORDA : CIANO, 16));
        botaoTela.setTextColor(pet.naTela ? TEXTO : 0xFF06233A);
        aviso.setText(pet.naTela
            ? "Ela está passeando por cima dos apps. Toque nela para um carinho, arraste para mudar de lugar e toque duas vezes para voltar aqui. Ficou no caminho (no teclado, por exemplo)? Segure o dedo nela: ela sai para dar uma volta e volta em 10 minutos."
            : "Ela anda pela parte de baixo da tela enquanto você usa outros apps. Só o espaço dela recebe toque: o resto do celular funciona normal.");
        montarLoja();
    }

    private String lojaMontada = "";

    private void montarLoja() {
        int n = pet.nivel();
        StringBuilder sb = new StringBuilder().append(n).append('|').append(pet.acessorio).append('|').append(pet.comprados);
        for (String[] a : Pet.ACESSORIOS) sb.append(pet.moedas >= Long.parseLong(a[2]) ? '1' : '0');
        if (sb.toString().equals(lojaMontada)) return;
        lojaMontada = sb.toString();
        loja.removeAllViews();
        for (int i = 0; i < Pet.ACESSORIOS.length; i++) {
            String[] a = Pet.ACESSORIOS[i];
            boolean tem = pet.comprados.contains(a[0]);
            boolean usando = a[0].equals(pet.acessorio);
            int precisa = Integer.parseInt(a[3]);
            long preco = Long.parseLong(a[2]);

            LinearLayout linha = new LinearLayout(this);
            linha.setGravity(Gravity.CENTER_VERTICAL);
            linha.setPadding(dp(14), dp(10), dp(10), dp(10));
            linha.setBackground(fundo(CARTAO, BORDA, 14));
            LinearLayout info = new LinearLayout(this);
            info.setOrientation(LinearLayout.VERTICAL);
            info.addView(texto(a[1], 16, TEXTO, true));
            String sub = tem ? (usando ? "Usando agora" : "Já é dela") : n < precisa ? "Libera na amizade nível " + precisa : preco + " moedas";
            info.addView(texto(sub, 13, tem ? CIANO : FRACO, false));
            linha.addView(info, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

            Button b;
            final int idx = i;
            if (tem) {
                b = botao(usando ? "Tirar" : "Usar", usando ? CARTAO : CIANO, usando ? TEXTO : 0xFF06233A);
                if (usando) b.setBackground(fundo(CARTAO, BORDA, 12));
                b.setOnClickListener(v -> { pet.vestir(a[0]); pet.salvar(); if (PetService.ativo != null) PetService.ativo.mudou(); atualizar(); });
            } else {
                boolean pode = n >= precisa && pet.moedas >= preco;
                b = botao("Comprar", pode ? OURO : CARTAO, pode ? 0xFF2A1A04 : FRACO);
                if (!pode) b.setBackground(fundo(CARTAO, BORDA, 12));
                b.setEnabled(pode);
                b.setOnClickListener(v -> {
                    if (pet.comprar(idx)) {
                        pet.salvar();
                        vista.coracao();
                        mostrarAcao(Desenho.Pose.ACENANDO, Desenho.Olhos.FELIZ, 1800);
                        if (PetService.ativo != null) PetService.ativo.mudou();
                        atualizar();
                    }
                });
            }
            linha.addView(b, new LinearLayout.LayoutParams(dp(104), dp(44)));
            LinearLayout.LayoutParams l = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            l.bottomMargin = dp(8);
            loja.addView(linha, l);
        }
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

    private Barra barra(LinearLayout col, String nome, int cor) {
        LinearLayout l = new LinearLayout(this);
        l.setGravity(Gravity.CENTER_VERTICAL);
        l.setPadding(0, dp(6), 0, dp(2));
        TextView rotulo = texto(nome, 14, FRACO, true);
        l.addView(rotulo, new LinearLayout.LayoutParams(dp(76), ViewGroup.LayoutParams.WRAP_CONTENT));
        Barra b = new Barra(cor);
        l.addView(b, new LinearLayout.LayoutParams(0, dp(14), 1));
        col.addView(l);
        return b;
    }

    /* barrinha arredondada de 0 a 100 */
    private final class Barra extends View {
        private final Paint fundo = new Paint(Paint.ANTI_ALIAS_FLAG), cheio = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF r = new RectF();
        private float v;

        Barra(int cor) {
            super(MainActivity.this);
            fundo.setColor(BORDA);
            cheio.setColor(cor);
        }

        void valor(float x) { v = x; invalidate(); }

        @Override
        protected void onDraw(Canvas c) {
            float raio = getHeight() / 2f;
            r.set(0, 0, getWidth(), getHeight());
            c.drawRoundRect(r, raio, raio, fundo);
            if (v > 0.5f) {
                r.set(0, 0, Math.max(getHeight(), getWidth() * v / 100f), getHeight());
                cheio.setAlpha(v < 25 ? 255 : 230);
                c.drawRoundRect(r, raio, raio, cheio);
            }
        }
    }
}
