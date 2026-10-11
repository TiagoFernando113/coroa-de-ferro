package com.tiagofernando.cyronpet;

import android.content.Context;
import android.graphics.Canvas;
import android.os.SystemClock;
import android.view.View;

import java.util.ArrayList;

/*
 * Onde a CYRON aparece: na janelinha por cima dos apps e na tela de cuidar.
 * Quem decide a pose é o dono da vista (o serviço ou a tela do app); aqui só se
 * desenha, com os coraçõezinhos de carinho subindo.
 */
final class VistaPet extends View {
    final Desenho desenho = new Desenho();
    Desenho.Pose pose = Desenho.Pose.PARADA;
    Desenho.Olhos olhos = Desenho.Olhos.NORMAL;
    boolean virada;
    int comida = -1;
    String acessorio = "";
    boolean mundinhoDormindo;
    boolean animarSozinha;      // na tela do app ela se anima sozinha; na janela, o serviço manda
    float u;                    // tamanho de uma unidade do desenho, em px
    private final ArrayList<float[]> coracoes = new ArrayList<>();
    private final long inicio = SystemClock.uptimeMillis();
    private long ultimoDesenho = inicio;

    VistaPet(Context c, float u) {
        super(c);
        this.u = u;
        setLayerType(LAYER_TYPE_HARDWARE, null);
    }

    float tempo() { return (SystemClock.uptimeMillis() - inicio) / 1000f; }

    void coracao() {
        if (coracoes.size() > 6) coracoes.remove(0);
        coracoes.add(new float[] { (float) (Math.random() * 16 - 8), -88, 0 });
    }

    @Override
    protected void onDraw(Canvas c) {
        long agora = SystemClock.uptimeMillis();
        float dt = Math.min(0.1f, (agora - ultimoDesenho) / 1000f);
        ultimoDesenho = agora;
        float t = tempo();

        c.save();
        c.translate(getWidth() / 2f, getHeight() - 3 * u);
        // o Mundinho flutua atrás do ombro, do lado para onde ela olha
        c.save();
        float lado = virada ? -1 : 1;
        c.translate(lado * 25 * u, (-74 + (float) Math.sin(t * 2.2) * 3) * u);
        desenho.mundinho(c, u, t, mundinhoDormindo, olhos == Desenho.Olhos.FELIZ);
        c.restore();
        desenho.cyron(c, u, t, pose, olhos, virada, acessorio, comida);
        for (int i = coracoes.size() - 1; i >= 0; i--) {
            float[] k = coracoes.get(i);
            k[2] += dt;
            if (k[2] > 1.2f) { coracoes.remove(i); continue; }
            desenho.coracao(c, u, k[0] + (float) Math.sin(k[2] * 6) * 2, k[1] - k[2] * 14, 3.2f, (int) (255 * Math.min(1, (1.2f - k[2]) * 2)));
        }
        c.restore();
        if (animarSozinha || !coracoes.isEmpty()) postInvalidateOnAnimation();
    }
}
