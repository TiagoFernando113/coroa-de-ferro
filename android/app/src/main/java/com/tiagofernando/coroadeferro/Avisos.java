package com.tiagofernando.coroadeferro;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.webkit.JavascriptInterface;

/*
 * Avisos locais (sem servidor): o jogo agenda pelo JavaScript quando vai para
 * segundo plano ("lucro ocioso cheio", "presente diário") e cancela ao voltar.
 * O AlarmManager acorda este receptor na hora e ele mostra a notificação.
 */
public class Avisos extends BroadcastReceiver {
    static final String CANAL = "avisos";

    static void criarCanal(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CANAL) == null)
            nm.createNotificationChannel(new NotificationChannel(CANAL, "Avisos do jogo", NotificationManager.IMPORTANCE_DEFAULT));
    }

    static PendingIntent alarme(Context c, int id, String titulo, String texto) {
        Intent i = new Intent(c, Avisos.class).putExtra("id", id).putExtra("titulo", titulo).putExtra("texto", texto);
        return PendingIntent.getBroadcast(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // os avisos marcados ficam guardados para sobreviver a um reinício do celular
    static SharedPreferences guardados(Context c) { return c.getSharedPreferences("avisos", Context.MODE_PRIVATE); }

    static void marcar(Context c, int id, long quando, String titulo, String texto) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        am.set(AlarmManager.RTC_WAKEUP, quando, alarme(c, id, titulo, texto));
        guardados(c).edit().putString("a" + id, quando + "\n" + titulo + "\n" + texto).apply();
    }

    public static class Religar extends BroadcastReceiver {
        @Override
        public void onReceive(Context c, Intent in) {
            long agora = System.currentTimeMillis();
            for (java.util.Map.Entry<String, ?> e : guardados(c).getAll().entrySet()) {
                try {
                    String[] p = String.valueOf(e.getValue()).split("\n", 3); int id = Integer.parseInt(e.getKey().substring(1));
                    long quando = Math.max(Long.parseLong(p[0]), agora + 60000); // se a hora passou com o celular desligado, avisa em 1 min
                    marcar(c, id, quando, p[1], p[2]);
                } catch (Exception er) { /* registro estragado: ignora */ }
            }
        }
    }

    @Override
    public void onReceive(Context c, Intent in) {
        guardados(c).edit().remove("a" + in.getIntExtra("id", 1)).apply();
        criarCanal(c);
        PendingIntent abrir = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CANAL) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_aviso).setContentTitle(in.getStringExtra("titulo")).setContentText(in.getStringExtra("texto"))
            .setContentIntent(abrir).setAutoCancel(true).setColor(0xffe8a02a);
        try { c.getSystemService(NotificationManager.class).notify(in.getIntExtra("id", 1), b.build()); } catch (SecurityException e) { /* sem permissão */ }
    }

    // ---- ponte com o JavaScript: window.Avisos.agendar(id, segundos, titulo, texto) ----
    static class Js {
        final Context c;
        Js(Context c) { this.c = c.getApplicationContext(); }

        @JavascriptInterface
        public void agendar(int id, int segundos, String titulo, String texto) {
            if (segundos < 1) return;
            marcar(c, id, System.currentTimeMillis() + segundos * 1000L, titulo, texto);
        }

        @JavascriptInterface
        public void cancelar(int id) {
            c.getSystemService(AlarmManager.class).cancel(alarme(c, id, "", ""));
            guardados(c).edit().remove("a" + id).apply();
            c.getSystemService(NotificationManager.class).cancel(id);
        }
    }
}
