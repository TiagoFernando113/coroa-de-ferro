package com.tiagofernando.cyronpet;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.content.res.Configuration;
import android.graphics.Insets;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.WindowMetrics;

import java.util.Calendar;

/*
 * A CYRON passeando por cima dos outros apps.
 *
 * Duas janelinhas: a dela (do tamanho dela, e só ela pega toque) e a do balão
 * de fala (que deixa o toque passar). Ela anda pelo "chão" logo acima da barra
 * de navegação, para, senta, acena, dorme quando cansa e reclama de fome.
 *
 * Bateria: o laço roda a 20 quadros por segundo só quando ela se mexe, cai
 * para 10 parada e 5 dormindo, e para de vez com a tela apagada.
 */
public class PetService extends Service {
    static PetService ativo;
    static final String GUARDAR = "guardar";
    private static final String CANAL = "pet";

    private WindowManager wm;
    private VistaPet vista;
    private WindowManager.LayoutParams lp;
    private Balao balao;
    private WindowManager.LayoutParams lpBalao;
    private final Handler h = new Handler(Looper.getMainLooper());
    private Pet pet;
    private float U;
    private int W, H;

    // onde ela está e o que está fazendo
    private float x, y, vy;
    private int dir = -1;
    private int telaL, telaA, chao, topo;
    private float tempoAcao = 2, tempoFala;
    private boolean telaAcesa = true, arrastando;
    private float pegaDx, pegaDy;
    private long ultimoQuadro, proximoMinuto;
    private final long[] toques = new long[6];
    private int iToque;
    private boolean fora;          // saiu para "dar uma volta" (segurou o dedo nela)
    private long voltaEm;

    @Override
    public IBinder onBind(Intent i) { return null; }

    private int dp(float v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    @Override
    public void onCreate() {
        super.onCreate();
        pet = Pet.de(this);
        wm = getSystemService(WindowManager.class);
        U = getResources().getDisplayMetrics().density * new float[] { 0.64f, 0.86f, 1.1f }[Math.max(0, Math.min(2, pet.tamanho))];
        W = Math.round(76 * U);
        H = Math.round(112 * U);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && GUARDAR.equals(intent.getAction())) {
            pet.naTela = false;
            pet.salvar();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }
        // Sempre primeiro: quem foi iniciado com startForegroundService tem 5 segundos para isso.
        try { primeiroPlano(); } catch (Exception semPermissao) { /* reinício em segundo plano barrado pelo Android */ }
        if (!Settings.canDrawOverlays(this) || !pet.naTela) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (vista == null) mostrar();
        return START_STICKY;
    }

    private void primeiroPlano() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel canal = new NotificationChannel(CANAL, "CYRON na tela", NotificationManager.IMPORTANCE_MIN);
        canal.setDescription("Aviso fixo enquanto a CYRON passeia por cima dos apps.");
        canal.setShowBadge(false);
        nm.createNotificationChannel(canal);
        int fl = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent abrir = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), fl);
        PendingIntent guardar = PendingIntent.getService(this, 1, new Intent(this, PetService.class).setAction(GUARDAR), fl);
        Notification n = new Notification.Builder(this, CANAL)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle("A CYRON está na sua tela")
            .setContentText("Toque duas vezes nela para cuidar dela.")
            .setContentIntent(abrir)
            .addAction(new Notification.Action.Builder(Icon.createWithResource(this, R.drawable.ic_notif), "Guardar", guardar).build())
            .setOngoing(true)
            .setShowWhen(false)
            .build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(1, n);
    }

    private void mostrar() {
        ativo = this;
        medirTela();
        vista = new VistaPet(this, U);
        vista.acessorio = pet.acessorio;
        lp = new WindowManager.LayoutParams(W, H,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.START;
        x = telaL - W - dp(12);
        y = chao;
        lp.x = (int) x;
        lp.y = (int) y;
        vista.setOnTouchListener(new Toque());
        wm.addView(vista, lp);

        balao = new Balao(this);
        lpBalao = new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT);
        lpBalao.gravity = Gravity.TOP | Gravity.START;
        // Android 12+: uma janela que deixa o toque passar precisa ser um pouco transparente.
        lpBalao.alpha = 0.8f;
        balao.setVisibility(View.GONE);
        wm.addView(balao, lpBalao);

        IntentFilter f = new IntentFilter();
        f.addAction(Intent.ACTION_SCREEN_OFF);
        f.addAction(Intent.ACTION_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(tela, f, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(tela, f);

        PowerManager pm = getSystemService(PowerManager.class);
        telaAcesa = pm == null || pm.isInteractive();
        pet.atualizar(System.currentTimeMillis());
        escolherAcao();
        falar(saudacao(), 2.5f);
        ultimoQuadro = SystemClock.uptimeMillis();
        proximoMinuto = System.currentTimeMillis() + 60_000;
        if (telaAcesa) h.post(laco);
    }

    @Override
    public void onDestroy() {
        h.removeCallbacks(laco);
        try { unregisterReceiver(tela); } catch (Exception ignorado) { }
        try { if (vista != null && !fora) wm.removeView(vista); } catch (Exception ignorado) { }
        try { if (balao != null) wm.removeView(balao); } catch (Exception ignorado) { }
        vista = null;
        balao = null;
        if (ativo == this) ativo = null;
        pet.salvar();
        super.onDestroy();
    }

    @Override
    public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        if (vista == null) return;
        medirTela();
        x = Math.max(0, Math.min(x, telaL - W));
        y = Math.min(y, chao);
        if (!arrastando && vy == 0) y = chao;
        mover();
    }

    private void medirTela() {
        int baixo, cima;
        if (Build.VERSION.SDK_INT >= 30) {
            WindowMetrics m = wm.getCurrentWindowMetrics();
            Rect b = m.getBounds();
            telaL = b.width();
            telaA = b.height();
            Insets in = m.getWindowInsets().getInsetsIgnoringVisibility(WindowInsets.Type.navigationBars() | WindowInsets.Type.displayCutout());
            Insets st = m.getWindowInsets().getInsetsIgnoringVisibility(WindowInsets.Type.statusBars());
            baixo = in.bottom;
            cima = st.top;
        } else {
            DisplayMetrics dm = new DisplayMetrics();
            wm.getDefaultDisplay().getRealMetrics(dm);
            telaL = dm.widthPixels;
            telaA = dm.heightPixels;
            baixo = dp(48);
            cima = dp(24);
        }
        chao = telaA - baixo - H + Math.round(2 * U);
        topo = cima;
    }

    private final BroadcastReceiver tela = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent i) {
            if (Intent.ACTION_SCREEN_OFF.equals(i.getAction())) {
                telaAcesa = false;
                h.removeCallbacks(laco);
                pet.salvar();
            } else if (Intent.ACTION_SCREEN_ON.equals(i.getAction()) && !telaAcesa) {
                telaAcesa = true;
                ultimoQuadro = SystemClock.uptimeMillis();
                proximoMinuto = System.currentTimeMillis() + 60_000;
                pet.atualizar(System.currentTimeMillis());
                escolherAcao();
                h.removeCallbacks(laco);
                h.post(laco);
            }
        }
    };

    /* ---------- o laço ---------- */
    private final Runnable laco = new Runnable() {
        @Override
        public void run() {
            if (vista == null) return;
            long agora = SystemClock.uptimeMillis();
            float dt = Math.min(0.25f, (agora - ultimoQuadro) / 1000f);
            ultimoQuadro = agora;
            passo(dt);
            vista.invalidate();
            h.postDelayed(this, intervalo());
        }
    };

    private long intervalo() {
        if (fora) return 1000;
        Desenho.Pose p = vista.pose;
        if (p == Desenho.Pose.DORMINDO && tempoFala <= 0) return 200;
        if (p == Desenho.Pose.PARADA || p == Desenho.Pose.SENTADA) return tempoFala > 0 ? 66 : 100;
        return 50;
    }

    private void passo(float dt) {
        long agoraMs = System.currentTimeMillis();
        if (fora) {
            if (agoraMs >= voltaEm) voltar();
            return;
        }
        if (agoraMs >= proximoMinuto) {
            proximoMinuto = agoraMs + 60_000;
            pet.atualizar(agoraMs);
            pet.minutoNaTela();
            pet.salvar();
            reclamar();
        }
        if (tempoFala > 0) {
            tempoFala -= dt;
            if (tempoFala <= 0) balao.setVisibility(View.GONE);
        }
        switch (vista.pose) {
            case ANDANDO:
                x += dir * dp(30) * dt;
                if (x <= 0) { x = 0; dir = 1; }
                if (x >= telaL - W) { x = telaL - W; dir = -1; }
                vista.virada = dir < 0;
                mover();
                break;
            case PULANDO:
            case CAINDO:
                vy += dp(1700) * dt;
                y += vy * dt;
                if (y >= chao) { y = chao; vy = 0; aterrissar(); }
                mover();
                break;
            default:
        }
        if (!arrastando && vista.pose != Desenho.Pose.PULANDO && vista.pose != Desenho.Pose.CAINDO) {
            tempoAcao -= dt;
            if (tempoAcao <= 0) escolherAcao();
        }
    }

    private void mover() {
        if (fora) return;
        lp.x = Math.round(x);
        lp.y = Math.round(y);
        try { wm.updateViewLayout(vista, lp); } catch (Exception ignorado) { }
        if (tempoFala > 0) posicionarBalao();
    }

    /* ---------- o que ela decide fazer ---------- */
    private void escolherAcao() {
        pet.atualizar(System.currentTimeMillis());
        vista.acessorio = pet.acessorio;
        vista.comida = -1;
        vista.mundinhoDormindo = false;
        vista.olhos = "triste".equals(pet.queixa()) ? Desenho.Olhos.TRISTE : Desenho.Olhos.NORMAL;
        if (pet.dormindo) { dormir(); return; }
        if (pet.energia < 12) {
            pet.dormindo = true;
            pet.salvar();
            falar("Tô com soninho... Zzz", 3);
            dormir();
            return;
        }
        int hora = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        boolean noite = hora < 6;
        double r = Math.random();
        if (r < (noite ? 0.25 : 0.42)) {
            vista.pose = Desenho.Pose.ANDANDO;
            // prefere ir para o lado onde há mais espaço
            float meio = (telaL - W) / 2f;
            dir = Math.random() < (x > meio ? 0.7 : 0.3) ? -1 : 1;
            tempoAcao = 3 + (float) Math.random() * 6;
        } else if (r < 0.66) {
            vista.pose = Desenho.Pose.PARADA;
            tempoAcao = 2 + (float) Math.random() * 4;
        } else if (r < 0.86) {
            vista.pose = Desenho.Pose.SENTADA;
            if (noite) vista.olhos = Desenho.Olhos.FECHADOS;
            tempoAcao = 5 + (float) Math.random() * 10;
        } else if (r < 0.94) {
            vista.pose = Desenho.Pose.ACENANDO;
            vista.olhos = Math.random() < 0.5 ? Desenho.Olhos.FELIZ : Desenho.Olhos.PISCADA;
            tempoAcao = 1.8f;
            if (Math.random() < 0.6) falar(saudacao(), 2);
        } else {
            vista.pose = Desenho.Pose.PARADA;
            tempoAcao = 3;
            falar(FRASES[(int) (Math.random() * FRASES.length)], 2.5f);
        }
    }

    private void dormir() {
        vista.pose = Desenho.Pose.DORMINDO;
        vista.olhos = Desenho.Olhos.FECHADOS;
        vista.mundinhoDormindo = true;
        tempoAcao = 30;
    }

    private void reclamar() {
        String q = pet.queixa();
        if (q.isEmpty() || Math.random() > 0.45 || vista.pose == Desenho.Pose.DORMINDO) return;
        if (q.equals("fome")) { vista.olhos = Desenho.Olhos.TRISTE; falar("Tô com fome... me dá um biscoito?", 3); }
        else if (q.equals("sono")) falar("Uaaah... tô com sono", 2.5f);
        else falar("Brinca comigo?", 2.5f);
    }

    private static final String[] SAUDACOES = { "Oi! Tô aqui!", "Hello!", "¡Hola!", "Bonjour!", "Ciao!", "Hallo!", "こんにちは!", "Olá, olá!" };
    private static final String[] FRASES = {
        "O Mundinho tá de olho!", "Traduzo qualquer língua!", "Que dia bonito!", "Hehe", "Tô passeando ♪",
        "Bora conversar com o mundo?", "Gostei desse app!", "Já tomou água hoje?",
    };
    private static final String[] REACOES = { "Eba!", "Hehe ♥", "Oi oi!", "Isso é carinho?", "Yay!", "♪♪" };

    private String saudacao() { return SAUDACOES[(int) (Math.random() * SAUDACOES.length)]; }

    void falar(String texto, float segundos) {
        if (balao == null) return;
        balao.setTexto(texto);
        balao.setVisibility(View.VISIBLE);
        tempoFala = segundos;
        posicionarBalao();
    }

    private void posicionarBalao() {
        int bw = balao.largura(), bh = balao.altura();
        lpBalao.width = bw;
        lpBalao.height = bh;
        lpBalao.x = Math.max(dp(4), Math.min(telaL - bw - dp(4), lp.x + W / 2 - bw / 2));
        lpBalao.y = Math.max(topo, lp.y + Math.round(H - 100 * U) - bh);
        try { wm.updateViewLayout(balao, lpBalao); } catch (Exception ignorado) { }
    }

    /* ---------- toque: carinho, arrastar e abrir o app ---------- */
    private void tocou() {
        long agora = SystemClock.uptimeMillis();
        toques[iToque++ % toques.length] = agora;
        int recentes = 0;
        for (long tq : toques) if (agora - tq < 8000) recentes++;
        if (vista.pose == Desenho.Pose.DORMINDO) {
            pet.atualizar(System.currentTimeMillis());
            if (pet.energia < 40) { falar("Hmm... só mais cinco minutinhos", 2.5f); return; }
            pet.dormindo = false;
            pet.salvar();
            vista.pose = Desenho.Pose.PARADA;
            vista.olhos = Desenho.Olhos.SURPRESA;
            vista.mundinhoDormindo = false;
            tempoAcao = 2;
            falar("Ah! Bom dia!", 2);
            return;
        }
        if (recentes >= toques.length) {
            vista.olhos = Desenho.Olhos.FELIZ;
            falar("Cócegas não! Hehe", 1.6f);
            return;
        }
        pet.carinho();
        vista.coracao();
        vista.pose = Desenho.Pose.PULANDO;
        vista.olhos = Desenho.Olhos.FELIZ;
        vy = -dp(330);
        if (Math.random() < 0.45) falar(REACOES[(int) (Math.random() * REACOES.length)], 1.4f);
    }

    /* Segurou o dedo nela: sai de cena por 10 minutos (útil quando ela fica em cima do teclado). */
    private void darUmaVolta() {
        if (fora) return;
        vista.pose = Desenho.Pose.ACENANDO;
        vista.olhos = Desenho.Olhos.PISCADA;
        tempoAcao = 5;
        falar("Vou dar uma volta! Volto em 10 min", 2);
        h.postDelayed(() -> {
            if (vista == null || fora) return;
            fora = true;
            voltaEm = System.currentTimeMillis() + 10 * 60_000;
            balao.setVisibility(View.GONE);
            tempoFala = 0;
            try { wm.removeView(vista); } catch (Exception ignorado) { }
        }, 1600);
    }

    private void voltar() {
        if (!fora) return;
        fora = false;
        medirTela();
        dir = Math.random() < 0.5 ? 1 : -1;
        x = dir > 0 ? 0 : telaL - W;
        y = chao;
        lp.x = Math.round(x);
        lp.y = Math.round(y);
        try { wm.addView(vista, lp); } catch (Exception ignorado) { }
        vista.pose = Desenho.Pose.ANDANDO;
        vista.virada = dir < 0;
        vista.olhos = Desenho.Olhos.FELIZ;
        tempoAcao = 2.5f;
        proximoMinuto = System.currentTimeMillis() + 60_000;
        falar("Voltei!", 1.8f);
    }

    private void aterrissar() {
        if (vista.pose == Desenho.Pose.CAINDO && Math.random() < 0.6) falar("Uii!", 1);
        vista.pose = Desenho.Pose.PARADA;
        vista.olhos = Desenho.Olhos.NORMAL;
        tempoAcao = 1.2f;
    }

    private void abrirApp() {
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        try { startActivity(i); } catch (Exception ignorado) { }
    }

    private final class Toque implements View.OnTouchListener {
        private float x0, y0;
        private long baixou, ultimoToque;
        private final int folga = ViewConfiguration.get(PetService.this).getScaledTouchSlop();
        private final Runnable toqueSimples = PetService.this::tocou;
        private boolean segurou;
        private final Runnable toqueLongo = () -> { segurou = true; darUmaVolta(); };

        @Override
        public boolean onTouch(View v, MotionEvent e) {
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    x0 = e.getRawX();
                    y0 = e.getRawY();
                    baixou = SystemClock.uptimeMillis();
                    segurou = false;
                    h.postDelayed(toqueLongo, 700);
                    return true;
                case MotionEvent.ACTION_MOVE:
                    if (!arrastando && Math.hypot(e.getRawX() - x0, e.getRawY() - y0) > folga) {
                        arrastando = true;
                        h.removeCallbacks(toqueSimples);
                        h.removeCallbacks(toqueLongo);
                        pegaDx = x0 - x;
                        pegaDy = y0 - y;
                        vy = 0;
                        vista.pose = Desenho.Pose.ARRASTADA;
                        vista.olhos = Desenho.Olhos.SURPRESA;
                        if (Math.random() < 0.5) falar("Ei! Me põe no chão!", 1.6f);
                    }
                    if (arrastando) {
                        x = Math.max(0, Math.min(telaL - W, e.getRawX() - pegaDx));
                        y = Math.max(topo, Math.min(chao, e.getRawY() - pegaDy));
                        mover();
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    h.removeCallbacks(toqueLongo);
                    if (segurou) return true;
                    if (arrastando) {
                        arrastando = false;
                        if (y < chao - dp(4)) { vista.pose = Desenho.Pose.CAINDO; vy = 0; }
                        else aterrissar();
                        return true;
                    }
                    if (e.getActionMasked() == MotionEvent.ACTION_CANCEL) return true;
                    long agora = SystemClock.uptimeMillis();
                    if (agora - ultimoToque < ViewConfiguration.getDoubleTapTimeout()) {
                        h.removeCallbacks(toqueSimples);
                        ultimoToque = 0;
                        abrirApp();
                    } else {
                        ultimoToque = agora;
                        h.postDelayed(toqueSimples, ViewConfiguration.getDoubleTapTimeout());
                    }
                    return true;
                default:
                    return true;
            }
        }
    }

    /* ---------- recados vindos da tela de cuidar ---------- */
    void comeu(int comida) {
        if (vista == null) return;
        vista.pose = Desenho.Pose.COMENDO;
        vista.comida = comida;
        vista.olhos = Desenho.Olhos.FELIZ;
        vista.mundinhoDormindo = false;
        vista.coracao();
        tempoAcao = 2.6f;
        falar("Que delícia!", 2);
    }

    void brincou() {
        if (vista == null) return;
        vista.pose = Desenho.Pose.BRINCANDO;
        vista.olhos = Desenho.Olhos.FELIZ;
        vista.coracao();
        tempoAcao = 3;
        falar("Eba, brincadeira!", 2);
    }

    void mudou() {
        if (vista == null) return;
        vista.acessorio = pet.acessorio;
        if (pet.dormindo) dormir();
        else if (vista.pose == Desenho.Pose.DORMINDO) { tempoAcao = 0; }
        vista.invalidate();
    }
}
