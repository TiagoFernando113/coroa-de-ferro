package com.tiagofernando.cyronpet;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.SystemClock;
import android.view.View;

/*
 * Desenha a aventura: a janelinha no canto (CARTAO), a versão grande na tela do
 * app (APP) e a bolinha quando ela está minimizada (BOLHA). Lê o estado do Jogo
 * e não decide nada; os toques voltam para quem é dono da vista.
 */
final class CenaView extends View {
    static final int CARTAO = 0, APP = 1, BOLHA = 2;
    static final int NADA = 0, ABRIR_APP = 1, MINIMIZAR = 2, EXPANDIR = 3;

    /* céu de cima, céu de baixo, morro longe, morro perto, chão, borda do chão */
    static final int[][] PALETAS = {
        { 0xFFF7C58F, 0xFF86B9D8, 0xFF93B5A6, 0xFF6E9D5B, 0xFF557F3F, 0xFF86B45E },
        { 0xFF22344A, 0xFF5D816F, 0xFF2F4D47, 0xFF25403A, 0xFF2F4A2F, 0xFF4C6E44 },
        { 0xFF4E615C, 0xFF9CB39B, 0xFF6F8577, 0xFF55695A, 0xFF3F5140, 0xFF5C7457 },
        { 0xFF1B1412, 0xFF3E2C21, 0xFF33251C, 0xFF4A3527, 0xFF5A4131, 0xFF7A5A40 },
        { 0xFFF29A59, 0xFFFFE0A8, 0xFFE6A46A, 0xFFD98A4F, 0xFFC97240, 0xFFE8A060 },
        { 0xFF8FB8E0, 0xFFE6F2FB, 0xFFA9C3DF, 0xFFCDDFF0, 0xFFDFE9F3, 0xFFFFFFFF },
        { 0xFF17122A, 0xFF3D2D58, 0xFF2B2142, 0xFF241B38, 0xFF2A2140, 0xFF4A3B6A },
        { 0xFF220B0B, 0xFF7A2618, 0xFF3A1612, 0xFF2B120F, 0xFF2A1714, 0xFFFF6A2A },
    };

    final Jogo jogo;
    int modo;
    private final float d;
    private final Desenho desenho = new Desenho();
    private final Monstros monstros = new Monstros();
    private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint texto = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    private final RectF r = new RectF();
    private final long inicio = SystemClock.uptimeMillis();
    private int ceuCache = -1, ceuAltura = -1;
    private LinearGradient ceu;
    // onde ficaram as coisas na última pintura, para saber o que foi tocado
    private float esc = 1, chaoY, topoCena;

    CenaView(Context c, Jogo jogo, int modo) {
        super(c);
        this.jogo = jogo;
        this.modo = modo;
        d = c.getResources().getDisplayMetrics().density;
        texto.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
    }

    float tempo() { return (SystemClock.uptimeMillis() - inicio) / 1000f; }

    private float cabecalho() { return modo == APP ? 26 * d : 22 * d; }

    @Override
    protected void onDraw(Canvas c) {
        if (modo == BOLHA) { bolha(c); return; }
        float w = getWidth(), h = getHeight(), t = tempo();
        float raio = modo == CARTAO ? 14 * d : 0;
        c.save();
        path.reset();
        r.set(0, 0, w, h);
        path.addRoundRect(r, raio, raio, Path.Direction.CW);
        c.clipPath(path);

        topoCena = cabecalho();
        float baseXp = 4 * d;
        float altCena = h - topoCena - baseXp;
        esc = w / (float) Jogo.LARGURA;
        chaoY = topoCena + altCena * 0.8f;
        int reg = Jogo.indiceRegiao(jogo.zona);
        int[] pal = PALETAS[reg];

        // céu, morros e chão (com parallax pela caminhada)
        if (ceuCache != reg || ceuAltura != (int) h) {
            ceu = new LinearGradient(0, topoCena, 0, chaoY, pal[0], pal[1], Shader.TileMode.CLAMP);
            ceuCache = reg;
            ceuAltura = (int) h;
        }
        p.setShader(ceu);
        c.drawRect(0, 0, w, chaoY, p);
        p.setShader(null);
        morros(c, w, chaoY - altCena * 0.08f, altCena * 0.32f, (float) (jogo.rolagem * 0.15 * esc), pal[2], 0.021f, 11 + reg);
        morros(c, w, chaoY, altCena * 0.2f, (float) (jogo.rolagem * 0.45 * esc), pal[3], 0.034f, 29 + reg);
        p.setColor(pal[4]);
        c.drawRect(0, chaoY, w, h, p);
        p.setColor(pal[5]);
        c.drawRect(0, chaoY, w, chaoY + 1.5f * d, p);
        // pedrinhas do chão passando
        p.setColor(Monstros.escurecer(pal[4], 0.18f));
        float passo = 23 * esc, off = (float) ((jogo.rolagem * esc) % passo);
        for (float x = -off; x < w + passo; x += passo) c.drawCircle(x, chaoY + (h - chaoY) * 0.45f + ((int) (x / passo) % 2) * 2 * d, 1.4f * d, p);

        // baú
        if (jogo.bau != null) {
            float bx = (float) (jogo.bau.x * esc), pulo = (float) Math.abs(Math.sin(jogo.bau.t * 4)) * 3 * d;
            bau(c, bx, chaoY - pulo, esc, jogo.bau.vida < 5 && ((int) (jogo.bau.vida * 4)) % 2 == 0);
        }

        // a CYRON
        float uC = esc * 0.7f * (modo == APP ? 1.05f : 1f);
        float tremor = jogo.levouDano > 0 ? (float) Math.sin(t * 60) * 1.5f * d : 0;
        c.save();
        c.translate((float) (Jogo.POS_CYRON * esc) + tremor, chaoY);
        desenho.arma = jogo.tierArma();
        desenho.golpe = (float) jogo.golpe;
        Desenho.Pose pose;
        Desenho.Olhos olhos = Desenho.Olhos.NORMAL;
        if (jogo.desmaio > 0) { pose = Desenho.Pose.SENTADA; olhos = Desenho.Olhos.TONTA; }
        else if (jogo.m != null && !jogo.m.morrendo && jogo.m.x <= Jogo.CONTATO + 1) pose = Desenho.Pose.LUTANDO;
        else if (jogo.m != null && jogo.m.morrendo) { pose = Desenho.Pose.PARADA; olhos = Desenho.Olhos.FELIZ; }
        else pose = Desenho.Pose.ANDANDO;
        if (jogo.tempoAviso > 1.6 && jogo.aviso.startsWith("Nível")) { pose = Desenho.Pose.BRINCANDO; olhos = Desenho.Olhos.FELIZ; }
        if (jogo.levouDano > 0.5) olhos = Desenho.Olhos.FECHADOS;
        // o Mundinho flutua atrás dela e brilha quando ataca
        c.save();
        c.translate(-20 * uC, (-80 + (float) Math.sin(t * 2.2) * 3) * uC);
        desenho.mundinho(c, uC * (jogo.golpeMundo > 0 ? 1.15f : 1f), t, jogo.desmaio > 0, jogo.golpeMundo > 0);
        c.restore();
        desenho.cyron(c, uC, t, pose, olhos, false, jogo.acessorio, -1);
        c.restore();
        // vida dela
        if (jogo.hp >= 0 && (jogo.hp < jogo.vidaMax() - 0.5 || pose == Desenho.Pose.LUTANDO)) {
            barra(c, (float) (Jogo.POS_CYRON * esc) - 3 * esc, chaoY - 104 * uC, 22 * esc, (float) (jogo.hp / jogo.vidaMax()), 0xFFFF6FA8);
        }

        // o monstro
        Jogo.Monstro m = jogo.m;
        if (m != null) {
            float uM = esc * 0.8f * (m.chefe ? 1.3f : 1f);
            float mx = (float) (m.x * esc);
            c.save();
            c.translate(mx, chaoY);
            if (m.morrendo) {
                float k = (float) Math.min(1, m.t / 0.45);
                c.scale(1 + k * 0.5f, 1 - k * 0.6f);
                p.setAlpha(255);
            }
            if (m.chefe && !m.morrendo) {
                p.setColor(0x33E2574C);
                c.drawCircle(0, -Monstros.altura(m.tipo) * uM * 0.5f, (30 + (float) Math.sin(t * 4) * 3) * uM, p);
            }
            p.setColor(0x33000000);
            r.set(-16 * uM, -2.5f * uM, 16 * uM, 2.5f * uM);
            c.drawOval(r, p);
            monstros.desenhar(c, m.tipo, uM, t + m.regiao * 1.7f, Monstros.cor(m.tipo, m.regiao), m.chefe);
            c.restore();
            if (!m.morrendo && (m.chefe || m.x <= Jogo.CONTATO + 30)) {
                float topo = chaoY - (Monstros.altura(m.tipo) + 12) * uM;
                barra(c, mx + 3 * esc, topo, (m.chefe ? 40 : 28) * esc, (float) (m.hp / m.max), m.chefe ? 0xFFE2574C : 0xFF5CC79B);
                if (m.chefe || modo == APP) rotulo(c, m.nome, mx, topo - 3 * d, (modo == APP ? 9.5f : 8f) * d, m.chefe ? 0xFFFFB3A8 : 0xFFF1E7D6, true);
            }
        }

        // moeda dourada voando
        if (jogo.moeda != null) {
            float mx = (float) (jogo.moeda.x * esc), my = chaoY - (float) jogo.moeda.y * esc;
            float giro = (float) Math.abs(Math.cos(jogo.moeda.t * 5));
            p.setColor(0x44FFE27A);
            c.drawCircle(mx, my, 9 * esc, p);
            p.setColor(0xFFA8761A);
            r.set(mx - 6.5f * esc * giro - 0.5f * d, my - 6.5f * esc, mx + 6.5f * esc * giro + 0.5f * d, my + 6.5f * esc);
            c.drawOval(r, p);
            p.setColor(0xFFF3C13F);
            r.inset(1.2f * d, 1.2f * d);
            c.drawOval(r, p);
        }

        // efeitos: números, moedinhas, brilhos, o raio do Mundinho
        for (Jogo.Efeito e : jogo.efeitos) efeito(c, e);

        // contadores de cima da cena: os 10 monstros da zona, ou o relógio do chefe
        if (m != null && m.chefe && !m.morrendo) {
            float bw = 70 * d, bx = w - bw - 6 * d, by = topoCena + 5 * d;
            float k = (float) Math.max(0, jogo.tempoChefe / Jogo.TEMPO_DE_CHEFE);
            p.setColor(0xCC121833);
            r.set(bx - 1.5f * d, by - 1.5f * d, bx + bw + 1.5f * d, by + 7.5f * d);
            c.drawRoundRect(r, 4 * d, 4 * d, p);
            p.setColor(k < 0.3f ? 0xFFFF7A5A : 0xFFE2574C);
            r.set(bx, by, bx + bw * k, by + 6 * d);
            c.drawRoundRect(r, 3 * d, 3 * d, p);
            rotulo(c, (int) Math.ceil(jogo.tempoChefe) + "s", bx + bw / 2, by + 5.5f * d, 7 * d, 0xFFFFFFFF, false);
        } else {
            float rp = 2.4f * d, gap = 6.5f * d, x0 = w - 6 * d - rp - (Jogo.ABATES_POR_ZONA - 1) * gap, y0 = topoCena + 7 * d;
            for (int i = 0; i < Jogo.ABATES_POR_ZONA; i++) {
                p.setColor(0xAA121833);
                c.drawCircle(x0 + i * gap, y0, rp + 1 * d, p);
                p.setColor(i < jogo.abates ? 0xFFF3C13F : 0x55FFFFFF);
                c.drawCircle(x0 + i * gap, y0, rp, p);
            }
        }

        // aviso grande no meio (nível, zona nova, chefe)
        if (jogo.tempoAviso > 0) {
            float a = (float) Math.min(1, jogo.tempoAviso / 0.4);
            int alfa = (int) (255 * a);
            float y = topoCena + altCena * 0.36f;
            p.setColor(0x99121833);
            p.setAlpha((int) (0x99 * a));
            c.drawRect(0, y - 13 * d, w, y + (jogo.avisoSub.isEmpty() ? 6 : 15) * d, p);
            rotulo(c, jogo.aviso, w / 2, y + 2 * d, (modo == APP ? 15 : 12.5f) * d, (0xF3C13F) | (alfa << 24), false);
            if (!jogo.avisoSub.isEmpty()) rotulo(c, jogo.avisoSub, w / 2, y + 12 * d, (modo == APP ? 10 : 8.5f) * d, 0xF1E7D6 | (alfa << 24), false);
        }

        // desmaiada: escurece e conta
        if (jogo.desmaio > 0) {
            p.setColor(0x66000000);
            c.drawRect(0, topoCena, w, h, p);
            rotulo(c, "Zzz... volta em " + (int) Math.ceil(jogo.desmaio) + "s", w / 2, topoCena + altCena * 0.25f, 10 * d, 0xFFFFFFFF, true);
        }

        cabecalho(c, w);
        // barrinha de experiência embaixo
        float k = (float) Math.min(1, jogo.xp / Jogo.xpDoNivel(jogo.nivel));
        p.setColor(0xFF1B2347);
        c.drawRect(0, h - baseXp, w, h, p);
        p.setColor(0xFF36C6F0);
        c.drawRect(0, h - baseXp, w * k, h, p);
        c.restore();

        if (modo == CARTAO) {
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(1.5f * d);
            p.setColor(0xFF2C3768);
            r.set(0.75f * d, 0.75f * d, w - 0.75f * d, h - 0.75f * d);
            c.drawRoundRect(r, raio, raio, p);
            p.setStyle(Paint.Style.FILL);
        }
    }

    private void cabecalho(Canvas c, float w) {
        float hh = cabecalho();
        p.setColor(0xE6121833);
        c.drawRect(0, 0, w, hh, p);
        float tam = (modo == APP ? 12 : 10.5f) * d, y = hh / 2 + tam * 0.36f;
        texto.setTextAlign(Paint.Align.LEFT);
        texto.setTextSize(tam);
        texto.setColor(0xFFEEF0F7);
        String z = "Zona " + jogo.zona;
        c.drawText(z, 7 * d, y, texto);
        float x = 7 * d + texto.measureText(z) + 6 * d;
        texto.setColor(0xFF36C6F0);
        String nv = "Nv " + jogo.nivel;
        c.drawText(nv, x, y, texto);
        // moedas (e os botões, na janelinha)
        float direita = w - 6 * d;
        if (modo == CARTAO) {
            float b = hh;
            // minimizar
            p.setColor(0xFFEEF0F7);
            r.set(w - b * 0.72f, hh / 2 - 1 * d, w - b * 0.28f, hh / 2 + 1 * d);
            c.drawRoundRect(r, 1 * d, 1 * d, p);
            // bolsa (abre o app)
            float bx = w - b * 1.5f;
            p.setColor(0xFF9A78E8);
            r.set(bx - 6 * d, hh / 2 - 3.5f * d, bx + 6 * d, hh / 2 + 6 * d);
            c.drawRoundRect(r, 2.5f * d, 2.5f * d, p);
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(1.4f * d);
            r.set(bx - 3.5f * d, hh / 2 - 7 * d, bx + 3.5f * d, hh / 2 - 1 * d);
            c.drawArc(r, 180, 180, false, p);
            p.setStyle(Paint.Style.FILL);
            direita = bx - 11 * d;
        }
        String ouro = Jogo.curto(jogo.ouro);
        texto.setTextAlign(Paint.Align.RIGHT);
        texto.setColor(0xFFF3C13F);
        c.drawText(ouro, direita, y, texto);
        float mx = direita - texto.measureText(ouro) - 6 * d;
        p.setColor(0xFFA8761A);
        c.drawCircle(mx, hh / 2, 4.6f * d, p);
        p.setColor(0xFFF3C13F);
        c.drawCircle(mx, hh / 2, 3.4f * d, p);
        texto.setTextAlign(Paint.Align.LEFT);
    }

    private void efeito(Canvas c, Jogo.Efeito e) {
        float k = (float) (e.t / e.vida);
        float x = (float) (e.x * esc), y = chaoY - (float) e.y * esc;
        switch (e.tipo) {
            case 0: case 1: case 3: {
                float sobe = k * 16 * d;
                int alfa = (int) (255 * Math.min(1, (1 - k) * 2.5));
                float tam = (e.tipo == 3 ? 9 : 10) * d * (modo == APP ? 1.15f : 1f);
                rotulo(c, e.texto, x, y - sobe, tam, (e.cor & 0xFFFFFF) | (alfa << 24), true);
                break;
            }
            case 2: { // moedinha que sobe até o contador
                float alvoX = getWidth() * 0.62f, alvoY = cabecalho() / 2;
                float px, py;
                if (k < 0.35f) { px = x; py = y - (float) Math.sin(k / 0.35f * Math.PI) * 10 * d; }
                else { float q = (k - 0.35f) / 0.65f; px = x + (alvoX - x) * q; py = y + (alvoY - y) * q; }
                p.setColor(0xFFA8761A);
                c.drawCircle(px, py, 3.2f * d, p);
                p.setColor(0xFFF3C13F);
                c.drawCircle(px, py, 2.3f * d, p);
                break;
            }
            case 4: { // raio do Mundinho
                float uC = esc * 0.7f;
                float ox = (float) (Jogo.POS_CYRON * esc) - 20 * uC, oy = chaoY - 80 * uC;
                p.setColor(0xFF9FE6FF);
                p.setAlpha((int) (255 * (1 - k)));
                p.setStrokeWidth(2.2f * d);
                p.setStyle(Paint.Style.STROKE);
                c.drawLine(ox, oy, x, y, p);
                p.setStyle(Paint.Style.FILL);
                p.setAlpha(255);
                break;
            }
            default: { // brilho
                p.setColor(e.cor);
                p.setAlpha((int) (255 * (1 - k)));
                float s = (2 + k * 4) * d;
                c.drawCircle(x, y - k * 10 * d, s * 0.5f, p);
                p.setAlpha(255);
            }
        }
    }

    private void bau(Canvas c, float x, float y, float s, boolean piscando) {
        float u = s;
        p.setColor(0x55FFE27A);
        c.drawCircle(x, y - 8 * u, 15 * u, p);
        if (piscando) return;
        p.setColor(0xFF7A4F2B);
        r.set(x - 11 * u, y - 13 * u, x + 11 * u, y);
        c.drawRoundRect(r, 2 * u, 2 * u, p);
        p.setColor(0xFF9A6A3F);
        r.set(x - 11 * u, y - 19 * u, x + 11 * u, y - 10 * u);
        c.drawRoundRect(r, 5 * u, 5 * u, p);
        p.setColor(0xFFF3C13F);
        c.drawRect(x - 11 * u, y - 11.5f * u, x + 11 * u, y - 9.5f * u, p);
        r.set(x - 2.5f * u, y - 13 * u, x + 2.5f * u, y - 7 * u);
        c.drawRoundRect(r, 1 * u, 1 * u, p);
    }

    private void barra(Canvas c, float cx, float y, float largura, float k, int cor) {
        float h = 3.4f * d;
        p.setColor(0xCC121833);
        r.set(cx - largura / 2 - 1 * d, y - 1 * d, cx + largura / 2 + 1 * d, y + h + 1 * d);
        c.drawRoundRect(r, h, h, p);
        p.setColor(cor);
        r.set(cx - largura / 2, y, cx - largura / 2 + largura * Math.max(0, Math.min(1, k)), y + h);
        c.drawRoundRect(r, h, h, p);
    }

    private void rotulo(Canvas c, String s, float x, float y, float tam, int cor, boolean contorno) {
        texto.setTextAlign(Paint.Align.CENTER);
        texto.setTextSize(tam);
        if (contorno) {
            texto.setStyle(Paint.Style.STROKE);
            texto.setStrokeWidth(2.6f * d);
            texto.setColor(0xCC121833 & (cor | 0x00FFFFFF));
            c.drawText(s, x, y, texto);
            texto.setStyle(Paint.Style.FILL);
        }
        texto.setColor(cor);
        c.drawText(s, x, y, texto);
        texto.setTextAlign(Paint.Align.LEFT);
    }

    private void morros(Canvas c, float w, float base, float alt, float desloc, int cor, float freq, int semente) {
        path.reset();
        path.moveTo(0, getHeight());
        float passo = 6 * d;
        for (float x = 0; x <= w + passo; x += passo) {
            float wx = (x + desloc) / d;
            float y = base - alt * (0.55f + 0.3f * (float) Math.sin(wx * freq + semente) + 0.15f * (float) Math.sin(wx * freq * 2.7f + semente * 1.3f));
            path.lineTo(x, y);
        }
        path.lineTo(w, getHeight());
        path.close();
        p.setColor(cor);
        c.drawPath(path, p);
    }

    /* minimizada: o rostinho dela numa bolinha, com o anel dos monstros da zona */
    private void bolha(Canvas c) {
        float w = getWidth(), cx = w / 2, cy = getHeight() / 2, rr = Math.min(w, getHeight()) / 2 - 3 * d;
        p.setColor(0xFF1F2D5C);
        c.drawCircle(cx, cy, rr, p);
        c.save();
        path.reset();
        path.addCircle(cx, cy, rr - 2 * d, Path.Direction.CW);
        c.clipPath(path);
        float u = rr / 30f;
        c.translate(cx - 3 * u, cy + 58 * u);
        desenho.arma = -1;
        desenho.cyron(c, u, tempo(), Desenho.Pose.PARADA, jogo.desmaio > 0 ? Desenho.Olhos.TONTA : Desenho.Olhos.NORMAL, false, jogo.acessorio, -1);
        c.restore();
        // anel: quantos monstros faltam para o chefe
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(3 * d);
        p.setColor(0xFF2C3768);
        c.drawCircle(cx, cy, rr, p);
        p.setColor(jogo.m != null && jogo.m.chefe ? 0xFFE2574C : 0xFF36C6F0);
        r.set(cx - rr, cy - rr, cx + rr, cy + rr);
        c.drawArc(r, -90, 360f * jogo.abates / Jogo.ABATES_POR_ZONA, false, p);
        p.setStyle(Paint.Style.FILL);
        // baú esperando ou moeda passando: um aviso para tocar
        if (jogo.bau != null || jogo.moeda != null) {
            p.setColor(0xFFF3C13F);
            c.drawCircle(cx + rr * 0.72f, cy - rr * 0.72f, 7 * d, p);
            rotulo(c, "!", cx + rr * 0.72f, cy - rr * 0.72f + 3.5f * d, 10 * d, 0xFF2A1A04, false);
        }
    }

    /* O que um toque (já sem arrastar) faz, em coordenadas da vista. */
    int toque(float x, float y) {
        if (modo == BOLHA) return EXPANDIR;
        float w = getWidth(), hh = cabecalho();
        if (y < hh) {
            if (modo == CARTAO && x > w - hh) return MINIMIZAR;
            if (modo == CARTAO && x > w - hh * 2.1f) return ABRIR_APP;
            return NADA;
        }
        double ux = x / esc, uy = (chaoY - y) / esc;
        if (jogo.moeda != null && Math.hypot(ux - jogo.moeda.x, uy - jogo.moeda.y) < 22) { jogo.pegarMoeda(); return NADA; }
        if (jogo.bau != null && Math.abs(ux - jogo.bau.x) < 20 && uy < 34) { jogo.abrirBau(); return NADA; }
        jogo.tocarMonstro();
        return NADA;
    }
}
