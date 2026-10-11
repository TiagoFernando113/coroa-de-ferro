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

/*
 * A aventura no cantinho da tela, por cima dos outros apps.
 *
 * Uma janelinha só: aberta, é o cartão com o mundinho e a luta; minimizada, é
 * uma bolinha com o rosto dela. Arrasta para qualquer lugar e, ao soltar, ela
 * encosta na borda mais perto. Só a área dela pega toque.
 *
 * Bateria: 20 quadros por segundo com o cartão aberto, 2 com a bolinha, nada
 * com a tela apagada (o jogo calcula o tempo parado quando a tela volta).
 */
public class PetService extends Service {
    static PetService ativo;
    static final String GUARDAR = "guardar";
    private static final String CANAL = "aventura";

    private WindowManager wm;
    private CenaView cena;
    private WindowManager.LayoutParams lp;
    private final Handler h = new Handler(Looper.getMainLooper());
    private Jogo jogo;
    private int telaL, telaA, topo, baixo;
    private boolean telaAcesa = true;
    private long ultimoSave;

    @Override
    public IBinder onBind(Intent i) { return null; }

    private int dp(float v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    @Override
    public void onCreate() {
        super.onCreate();
        jogo = Salvo.jogo(this);
        wm = getSystemService(WindowManager.class);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && GUARDAR.equals(intent.getAction())) {
            jogo.naTela = false;
            Salvo.salvar(this);
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }
        // Sempre primeiro: quem foi iniciado com startForegroundService tem 5 segundos para isso.
        try { primeiroPlano(); } catch (Exception barrado) { /* reinício em segundo plano barrado pelo Android */ }
        if (!Settings.canDrawOverlays(this) || !jogo.naTela) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (cena == null) mostrar();
        return START_STICKY;
    }

    private void primeiroPlano() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel canal = new NotificationChannel(CANAL, "Aventura na tela", NotificationManager.IMPORTANCE_MIN);
        canal.setDescription("Aviso fixo enquanto a aventura da CYRON roda no canto da tela.");
        canal.setShowBadge(false);
        nm.createNotificationChannel(canal);
        int fl = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent abrir = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), fl);
        PendingIntent guardar = PendingIntent.getService(this, 1, new Intent(this, PetService.class).setAction(GUARDAR), fl);
        Notification n = new Notification.Builder(this, CANAL)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle("A aventura da CYRON está rodando")
            .setContentText("Toque aqui para melhorar a arma e o moletom dela.")
            .setContentIntent(abrir)
            .addAction(new Notification.Action.Builder(Icon.createWithResource(this, R.drawable.ic_notif), "Guardar", guardar).build())
            .setOngoing(true)
            .setShowWhen(false)
            .build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(1, n);
    }

    /* tamanho da janelinha: o cartão em três tamanhos, ou a bolinha */
    private int largura() { return jogo.minimizada ? dp(62) : dp(new int[] { 184, 220, 262 }[jogo.tamanho]); }
    private int altura() { return jogo.minimizada ? dp(62) : Math.round(largura() * 0.68f); }

    private void mostrar() {
        ativo = this;
        medirTela();
        cena = new CenaView(this, jogo, jogo.minimizada ? CenaView.BOLHA : CenaView.CARTAO);
        lp = new WindowManager.LayoutParams(largura(), altura(),
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.START;
        if (jogo.posX < 0) { jogo.posX = telaL - lp.width - dp(6); jogo.posY = Math.round(telaA * 0.28f); }
        lp.x = jogo.posX;
        lp.y = jogo.posY;
        prender();
        cena.setOnTouchListener(new Toque());
        wm.addView(cena, lp);

        IntentFilter f = new IntentFilter();
        f.addAction(Intent.ACTION_SCREEN_OFF);
        f.addAction(Intent.ACTION_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(tela, f, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(tela, f);

        PowerManager pm = getSystemService(PowerManager.class);
        telaAcesa = pm == null || pm.isInteractive();
        if (telaAcesa) h.post(laco);
    }

    @Override
    public void onDestroy() {
        h.removeCallbacks(laco);
        try { unregisterReceiver(tela); } catch (Exception ignorado) { }
        try { if (cena != null) wm.removeView(cena); } catch (Exception ignorado) { }
        cena = null;
        if (ativo == this) ativo = null;
        Salvo.salvar(this);
        super.onDestroy();
    }

    @Override
    public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        if (cena == null) return;
        medirTela();
        encostar();
    }

    private void medirTela() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowMetrics m = wm.getCurrentWindowMetrics();
            Rect b = m.getBounds();
            telaL = b.width();
            telaA = b.height();
            Insets in = m.getWindowInsets().getInsetsIgnoringVisibility(WindowInsets.Type.navigationBars() | WindowInsets.Type.displayCutout());
            Insets st = m.getWindowInsets().getInsetsIgnoringVisibility(WindowInsets.Type.statusBars());
            baixo = in.bottom;
            topo = st.top;
        } else {
            DisplayMetrics dm = new DisplayMetrics();
            wm.getDefaultDisplay().getRealMetrics(dm);
            telaL = dm.widthPixels;
            telaA = dm.heightPixels;
            baixo = dp(48);
            topo = dp(24);
        }
    }

    /* mantém a janelinha dentro da tela */
    private void prender() {
        lp.x = Math.max(0, Math.min(telaL - lp.width, lp.x));
        lp.y = Math.max(topo, Math.min(telaA - baixo - lp.height, lp.y));
    }

    /* ao soltar, encosta na borda (esquerda ou direita) mais perto */
    private void encostar() {
        lp.x = lp.x + lp.width / 2 < telaL / 2 ? dp(6) : telaL - lp.width - dp(6);
        prender();
        jogo.posX = lp.x;
        jogo.posY = lp.y;
        try { wm.updateViewLayout(cena, lp); } catch (Exception ignorado) { }
        Salvo.salvar(this);
    }

    private void trocarModo(boolean minimizar) {
        if (jogo.minimizada == minimizar) return;
        boolean direita = lp.x + lp.width / 2 >= telaL / 2;
        jogo.minimizada = minimizar;
        cena.modo = minimizar ? CenaView.BOLHA : CenaView.CARTAO;
        lp.width = largura();
        lp.height = altura();
        lp.x = direita ? telaL - lp.width - dp(6) : dp(6);
        encostar();
        cena.invalidate();
        h.removeCallbacks(laco);
        if (telaAcesa) h.post(laco);
    }

    private final BroadcastReceiver tela = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent i) {
            if (Intent.ACTION_SCREEN_OFF.equals(i.getAction())) {
                telaAcesa = false;
                h.removeCallbacks(laco);
                Salvo.salvar(PetService.this);
            } else if (Intent.ACTION_SCREEN_ON.equals(i.getAction()) && !telaAcesa) {
                telaAcesa = true;
                h.removeCallbacks(laco);
                h.post(laco);
            }
        }
    };

    private final Runnable laco = new Runnable() {
        @Override
        public void run() {
            if (cena == null) return;
            jogo.avancar(System.currentTimeMillis());
            cena.invalidate();
            long agora = SystemClock.uptimeMillis();
            if (agora - ultimoSave > 15_000) { ultimoSave = agora; Salvo.salvar(PetService.this); }
            h.postDelayed(this, jogo.minimizada ? 500 : 50);
        }
    };

    void tamanhoMudou() {
        if (cena == null) return;
        lp.width = largura();
        lp.height = altura();
        encostar();
    }

    private void abrirApp() {
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        try { startActivity(i); } catch (Exception ignorado) { }
    }

    /* toque: arrastar move a janelinha; toque curto vai para o jogo (golpe, baú, moeda, botões) */
    private final class Toque implements View.OnTouchListener {
        private float x0, y0;
        private int lx0, ly0;
        private boolean arrastando;
        private final int folga = ViewConfiguration.get(PetService.this).getScaledTouchSlop();

        @Override
        public boolean onTouch(View v, MotionEvent e) {
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    x0 = e.getRawX();
                    y0 = e.getRawY();
                    lx0 = lp.x;
                    ly0 = lp.y;
                    arrastando = false;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    if (!arrastando && Math.hypot(e.getRawX() - x0, e.getRawY() - y0) > folga * 1.5) arrastando = true;
                    if (arrastando) {
                        lp.x = lx0 + Math.round(e.getRawX() - x0);
                        lp.y = ly0 + Math.round(e.getRawY() - y0);
                        prender();
                        try { wm.updateViewLayout(cena, lp); } catch (Exception ignorado) { }
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                    if (arrastando) { encostar(); return true; }
                    switch (cena.toque(e.getX(), e.getY())) {
                        case CenaView.MINIMIZAR: trocarModo(true); break;
                        case CenaView.EXPANDIR: trocarModo(false); break;
                        case CenaView.ABRIR_APP: abrirApp(); break;
                        default: cena.invalidate();
                    }
                    return true;
                default:
                    return true;
            }
        }
    }
}
