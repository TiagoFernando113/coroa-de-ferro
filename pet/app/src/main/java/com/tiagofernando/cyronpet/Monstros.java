package com.tiagofernando.cyronpet;

import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;

/*
 * Os monstros da aventura, desenhados em código e olhando para a esquerda
 * (para a CYRON). Pés em (0,0), corpo para cima. A cor muda com a região:
 * a gosma da campina é verde, a do vulcão é de lava.
 */
final class Monstros {
    static final int CONTORNO = 0xFF1A1F3A;
    private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint traco = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    private final RectF r = new RectF();
    private float u = 1;

    Monstros() {
        traco.setStyle(Paint.Style.STROKE);
        traco.setStrokeCap(Paint.Cap.ROUND);
        traco.setStrokeJoin(Paint.Join.ROUND);
    }

    /* altura do topo da cabeça, em unidades: onde ficam a coroa e a barra de vida */
    static float altura(String tipo) {
        switch (tipo) {
            case "gosma": return 32;
            case "cogumelo": return 40;
            case "morcego": return 60;
            case "fantasma": return 56;
            case "golem": return 56;
            default: return 58;
        }
    }

    static int cor(String tipo, int regiao) {
        switch (tipo) {
            case "gosma": return pick(regiao, 0xFF6FCF5A, 1, 0xFF5AA35A, 2, 0xFF7A9A4A, 3, 0xFFB08A5A, 5, 0xFF9FD8F0, 7, 0xFFFF7A2A);
            case "cogumelo": return pick(regiao, 0xFFD9483A, 1, 0xFF9A4AC8, 2, 0xFFB5763A);
            case "morcego": return pick(regiao, 0xFF6A5A7A, 3, 0xFF5A4A6A, 4, 0xFF7A4A3A, 6, 0xFF3A2A4A);
            case "fantasma": return pick(regiao, 0xFFDFE6F2, 2, 0xFFCFE6D8, 5, 0xFFE8F6FF, 6, 0xFFC9B8FF);
            case "golem": return pick(regiao, 0xFF8A7060, 4, 0xFFB0805A, 5, 0xFFA6C8E8, 7, 0xFF4A3A36);
            default: return pick(regiao, 0xFFD9442E, 6, 0xFF8A3AC8, 7, 0xFFB8261A);
        }
    }

    private static int pick(int regiao, int padrao, int... pares) {
        for (int i = 0; i + 1 < pares.length; i += 2) if (pares[i] == regiao) return pares[i + 1];
        return padrao;
    }

    static int escurecer(int cor, float k) {
        int a = cor >>> 24, rr = (cor >> 16) & 255, g = (cor >> 8) & 255, b = cor & 255;
        return (a << 24) | ((int) (rr * (1 - k)) << 16) | ((int) (g * (1 - k)) << 8) | (int) (b * (1 - k));
    }

    static int clarear(int cor, float k) {
        int a = cor >>> 24, rr = (cor >> 16) & 255, g = (cor >> 8) & 255, b = cor & 255;
        return (a << 24) | ((int) (rr + (255 - rr) * k) << 16) | ((int) (g + (255 - g) * k) << 8) | (int) (b + (255 - b) * k);
    }

    /* ---------- peças ---------- */
    private void oval(Canvas c, float cx, float cy, float rx, float ry, int cor, float contorno) {
        r.set((cx - rx) * u, (cy - ry) * u, (cx + rx) * u, (cy + ry) * u);
        p.setColor(cor); c.drawOval(r, p);
        if (contorno > 0) { traco.setColor(CONTORNO); traco.setStrokeWidth(contorno * u); c.drawOval(r, traco); }
    }
    private void caixa(Canvas c, float x, float y, float w, float h, float raio, int cor, float contorno) {
        r.set(x * u, y * u, (x + w) * u, (y + h) * u);
        p.setColor(cor); c.drawRoundRect(r, raio * u, raio * u, p);
        if (contorno > 0) { traco.setColor(CONTORNO); traco.setStrokeWidth(contorno * u); c.drawRoundRect(r, raio * u, raio * u, traco); }
    }
    private void linha(Canvas c, float x1, float y1, float x2, float y2, float l, int cor) {
        traco.setColor(cor); traco.setStrokeWidth(l * u); c.drawLine(x1 * u, y1 * u, x2 * u, y2 * u, traco);
    }
    private void poli(Canvas c, int cor, float contorno, float... pts) {
        path.reset(); path.moveTo(pts[0] * u, pts[1] * u);
        for (int i = 2; i < pts.length; i += 2) path.lineTo(pts[i] * u, pts[i + 1] * u);
        path.close();
        p.setColor(cor); c.drawPath(path, p);
        if (contorno > 0) { traco.setColor(CONTORNO); traco.setStrokeWidth(contorno * u); c.drawPath(path, traco); }
    }
    private void olhos(Canvas c, float x, float y, float k, int branco) {
        oval(c, x, y, 3.4f * k, 3.4f * k, branco, 0);
        oval(c, x + 7 * k, y, 3 * k, 3 * k, branco, 0);
        oval(c, x - 1 * k, y + 0.5f * k, 1.6f * k, 1.6f * k, 0xFF1A1020, 0);
        oval(c, x + 6 * k, y + 0.5f * k, 1.4f * k, 1.4f * k, 0xFF1A1020, 0);
        linha(c, x - 4 * k, y - 5 * k, x + 2 * k, y - 3 * k, 1.3f * k, 0xFF1A1020);
        linha(c, x + 5 * k, y - 3 * k, x + 10 * k, y - 5 * k, 1.3f * k, 0xFF1A1020);
    }

    /* ---------- os bichos ---------- */
    void desenhar(Canvas c, String tipo, float escala, float t, int cor, boolean chefe) {
        u = escala;
        p.setStyle(Paint.Style.FILL);
        switch (tipo) {
            case "gosma": gosma(c, t, cor); break;
            case "cogumelo": cogumelo(c, t, cor); break;
            case "morcego": morcego(c, t, cor); break;
            case "fantasma": fantasma(c, t, cor); break;
            case "golem": golem(c, t, cor); break;
            default: diabrete(c, t, cor);
        }
        if (chefe) {
            float y = tipo.equals("morcego") ? -52 : -altura(tipo) - 1;
            poli(c, 0xFFF3C13F, 0.9f, -9, y, -10, y - 10, -4, y - 5, 0, y - 12, 4, y - 5, 10, y - 10, 9, y);
            oval(c, 0, y - 3.5f, 1.8f, 1.8f, 0xFFE2574C, 0);
        }
    }

    private void gosma(Canvas c, float t, int cor) {
        float sq = 1 + (float) Math.sin(t * 5) * 0.07f;
        c.save();
        c.scale(2 - sq, sq);
        path.reset();
        path.moveTo(-22 * u, 0);
        path.cubicTo(-24 * u, -18 * u, -12 * u, -32 * u, 0, -32 * u);
        path.cubicTo(12 * u, -32 * u, 24 * u, -18 * u, 22 * u, 0);
        path.close();
        p.setColor(cor); c.drawPath(path, p);
        traco.setColor(CONTORNO); traco.setStrokeWidth(1.3f * u); c.drawPath(path, traco);
        oval(c, -8, -22, 5, 3.5f, 0x59FFFFFF, 0);
        olhos(c, -10, -15, 1, 0xFFFFFFFF);
        linha(c, -8, -7, -2, -8, 1.6f, escurecer(cor, 0.6f));
        c.restore();
    }

    private void cogumelo(Canvas c, float t, int cor) {
        oval(c, -6, -1, 5, 2.5f, 0xFFE9DCC0, 1);
        oval(c, 6, -1, 5, 2.5f, 0xFFE9DCC0, 1);
        caixa(c, -9, -24, 18, 23, 7, 0xFFEFE3C8, 1.2f);
        float b = (float) Math.sin(t * 3) * 1.2f;
        path.reset();
        r.set(-21 * u, (-39 + b) * u, 21 * u, (-9 + b) * u);
        path.arcTo(r, 180, 180);
        path.close();
        p.setColor(cor); c.drawPath(path, p);
        traco.setColor(CONTORNO); traco.setStrokeWidth(1.2f * u); c.drawPath(path, traco);
        oval(c, -8, -31 + b, 3, 3, 0xFFFFF4E6, 0);
        oval(c, 5, -34 + b, 2.4f, 2.4f, 0xFFFFF4E6, 0);
        oval(c, 12, -27 + b, 2, 2, 0xFFFFF4E6, 0);
        olhos(c, -6, -15, 0.8f, 0xFFFFFFFF);
    }

    private void morcego(Canvas c, float t, int cor) {
        float fl = (float) Math.sin(t * 3) * 5, asa = (float) Math.sin(t * 16) * 0.8f;
        c.save();
        c.translate(0, (-42 + fl) * u);
        for (int lado = -1; lado <= 1; lado += 2) {
            c.save();
            c.scale(lado, 1);
            c.rotate((float) Math.toDegrees(asa * 0.5));
            poli(c, escurecer(cor, 0.15f), 0.9f, 4, -2, 26, -12, 22, 0, 18, 4, 12, 1, 6, 6);
            c.restore();
        }
        oval(c, 0, 0, 9, 9, cor, 1.1f);
        poli(c, cor, 0, -7, -5, -5, -14, -2, -7);
        poli(c, cor, 0, 2, -7, 5, -14, 7, -5);
        oval(c, -4, -1, 2, 2, 0xFFFF4A4A, 0);
        oval(c, 2, -1, 1.8f, 1.8f, 0xFFFF4A4A, 0);
        poli(c, 0xFFFFFFFF, 0, -3, 4, -2, 7, -1, 4);
        poli(c, 0xFFFFFFFF, 0, 1, 4, 2, 7, 3, 4);
        c.restore();
    }

    private void fantasma(Canvas c, float t, int cor) {
        float fl = (float) Math.sin(t * 2.5) * 4;
        c.save();
        c.translate(0, (-8 + fl) * u);
        path.reset();
        path.moveTo(-18 * u, -2 * u);
        path.lineTo(-18 * u, -30 * u);
        r.set(-18 * u, -48 * u, 18 * u, -12 * u);
        path.arcTo(r, 180, 180);
        path.lineTo(18 * u, -2 * u);
        for (int i = 0; i < 4; i++) {
            float x1 = 18 - (i + 0.5f) * 9, x2 = 18 - (i + 1) * 9;
            path.quadTo(x1 * u, ((i % 2 == 1 ? -8 : 5) + (float) Math.sin(t * 6 + i) * 2) * u, x2 * u, -2 * u);
        }
        path.close();
        p.setColor(cor); p.setAlpha(230); c.drawPath(path, p); p.setAlpha(255);
        traco.setColor(CONTORNO); traco.setStrokeWidth(1.1f * u); c.drawPath(path, traco);
        oval(c, -8, -32, 3.4f, 5, 0xFF241A33, 0);
        oval(c, 2, -32, 3, 4.6f, 0xFF241A33, 0);
        oval(c, -3, -20, 3, 4, 0xFF241A33, 0);
        c.restore();
    }

    private void golem(Canvas c, float t, int cor) {
        caixa(c, -12, -12, 9, 12, 3, escurecer(cor, 0.2f), 1);
        caixa(c, 3, -12, 9, 12, 3, escurecer(cor, 0.2f), 1);
        caixa(c, -17, -40, 34, 30, 7, cor, 1.2f);
        caixa(c, -11, -54, 22, 16, 5, clarear(cor, 0.1f), 1.1f);
        float br = (float) Math.sin(t * 2) * 2;
        caixa(c, -27, -38 + br, 10, 22, 4, escurecer(cor, 0.1f), 1);
        caixa(c, 17, -38 - br, 10, 22, 4, escurecer(cor, 0.1f), 1);
        linha(c, -6, -33, 2, -24, 1.4f, escurecer(cor, 0.4f));
        linha(c, 2, -24, -1, -16, 1.4f, escurecer(cor, 0.4f));
        int brilho = cor == 0xFF4A3A36 ? 0xFFFF8A3A : 0xFF7FF0FF;
        oval(c, -6, -47, 2.4f, 2.4f, brilho, 0);
        oval(c, 3, -47, 2.2f, 2.2f, brilho, 0);
    }

    private void diabrete(Canvas c, float t, int cor) {
        float fl = (float) Math.sin(t * 3) * 3, asa = (float) Math.sin(t * 12) * 0.3f;
        c.save();
        c.translate(0, (-10 + fl) * u);
        c.save();
        c.translate(6 * u, -26 * u);
        c.rotate((float) Math.toDegrees(-0.4 + asa));
        poli(c, escurecer(cor, 0.35f), 0.8f, 0, 0, 18, -14, 14, -2, 18, 4);
        c.restore();
        traco.setColor(escurecer(cor, 0.1f)); traco.setStrokeWidth(2 * u);
        path.reset(); path.moveTo(8 * u, -10 * u); path.quadTo(22 * u, -6 * u, 20 * u, -18 * u); c.drawPath(path, traco);
        poli(c, escurecer(cor, 0.1f), 0, 20, -22, 23, -17, 17, -17);
        caixa(c, -8, -28, 16, 20, 7, cor, 1.1f);
        linha(c, -4, -10, -5, -2, 3, cor);
        linha(c, 4, -10, 5, -2, 3, cor);
        oval(c, 0, -36, 10, 10, cor, 1.1f);
        poli(c, 0xFF2A1A14, 0, -8, -41, -12, -54, -3, -45);
        poli(c, 0xFF2A1A14, 0, 4, -45, 10, -55, 8, -41);
        olhos(c, -7, -37, 0.8f, 0xFFFFE46A);
        poli(c, 0xFFFFFFFF, 0, -6, -29, 1, -29, -2.5f, -26);
        c.restore();
    }
}
