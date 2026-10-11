package com.tiagofernando.cyronpet;

import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;

/*
 * A CYRON em versão chibi, desenhada à mão em código: cabelo prateado com a
 * trança que desbota para o azul e o lilás, um olho azul e outro lilás, o
 * moletom azul-marinho de listras ciano, o fone ciano e o planetinha sorridente
 * (o Mundinho) flutuando do lado.
 *
 * Nada de imagem: cada pose sai das mesmas peças, então andar, dormir, acenar
 * e comer custam só alguns ângulos. Unidade "u": a CYRON inteira tem ~96u de
 * altura, com os pés em (0,0) e o corpo para cima (y negativo), olhando para a
 * direita. virada=true espelha para a esquerda.
 */
final class Desenho {
    enum Pose { PARADA, ANDANDO, SENTADA, DORMINDO, PULANDO, ACENANDO, ARRASTADA, CAINDO, COMENDO, BRINCANDO, LUTANDO }
    enum Olhos { NORMAL, FELIZ, FECHADOS, TRISTE, SURPRESA, PISCADA, TONTA }

    static final int PELE = 0xFFFBE3D3, PELE_SOMBRA = 0xFFEFC5B2;
    static final int CABELO = 0xFFEEF0F7, CABELO_SOMBRA = 0xFFCDD3E6, CABELO_LINHA = 0xFF8E97B8;
    static final int MOLETOM = 0xFF1F2D5C, MOLETOM_ESCURO = 0xFF162147, CIANO = 0xFF36C6F0;
    static final int SHORT = 0xFF1B1D26, TENIS = 0xFF1D2A52, SOLA = 0xFFE8F4FF;
    static final int LILAS = 0xFF9A78E8, AZUL_OLHO = 0xFF3A7BE8, VIOLETA_OLHO = 0xFF8A6AE8;
    static final int CONTORNO = 0xFF1A1F3A, BOCA = 0xFFC2455A, LINGUA = 0xFFFF8FA0, BOCHECHA = 0x66FF8A9A;
    static final int[] TRANCA = { 0xFFE6EAF5, 0xFFC9D4F2, 0xFFAAB8F0, 0xFF9C98EE, 0xFF9A78E8 };

    private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint traco = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    private final RectF r = new RectF();
    private float u = 1;
    /* arma na mão (-1 = nenhuma; 0..4 = varinha, espada, martelo, cajado, lâmina) e o golpe (1 = começou, 0 = acabou) */
    int arma = -1;
    float golpe;

    Desenho() {
        traco.setStyle(Paint.Style.STROKE);
        traco.setStrokeCap(Paint.Cap.ROUND);
        traco.setStrokeJoin(Paint.Join.ROUND);
        traco.setColor(CONTORNO);
    }

    /* ---------- peças básicas (em unidades) ---------- */
    private void oval(Canvas c, float cx, float cy, float rx, float ry, int cor, float contorno) {
        r.set((cx - rx) * u, (cy - ry) * u, (cx + rx) * u, (cy + ry) * u);
        p.setColor(cor); p.setStyle(Paint.Style.FILL); c.drawOval(r, p);
        if (contorno > 0) { traco.setStrokeWidth(contorno * u); traco.setColor(CONTORNO); c.drawOval(r, traco); }
    }
    private void caixa(Canvas c, float x, float y, float w, float h, float raio, int cor, float contorno) {
        r.set(x * u, y * u, (x + w) * u, (y + h) * u);
        p.setColor(cor); p.setStyle(Paint.Style.FILL); c.drawRoundRect(r, raio * u, raio * u, p);
        if (contorno > 0) { traco.setStrokeWidth(contorno * u); traco.setColor(CONTORNO); c.drawRoundRect(r, raio * u, raio * u, traco); }
    }
    private void linha(Canvas c, float x1, float y1, float x2, float y2, float largura, int cor) {
        traco.setStrokeWidth(largura * u); traco.setColor(cor);
        c.drawLine(x1 * u, y1 * u, x2 * u, y2 * u, traco);
    }
    /* Membro grosso com contorno: um traço escuro largo e o mesmo traço colorido por cima. */
    private void membro(Canvas c, float x1, float y1, float x2, float y2, float largura, int cor) {
        linha(c, x1, y1, x2, y2, largura + 1.6f, CONTORNO);
        linha(c, x1, y1, x2, y2, largura, cor);
    }
    private void arco(Canvas c, float cx, float cy, float rx, float ry, float inicio, float varredura, float largura, int cor) {
        r.set((cx - rx) * u, (cy - ry) * u, (cx + rx) * u, (cy + ry) * u);
        traco.setStrokeWidth(largura * u); traco.setColor(cor);
        c.drawArc(r, inicio, varredura, false, traco);
    }
    private void preencher(Canvas c, int cor, float contorno) {
        p.setColor(cor); p.setStyle(Paint.Style.FILL); c.drawPath(path, p);
        if (contorno > 0) { traco.setStrokeWidth(contorno * u); traco.setColor(CONTORNO); c.drawPath(path, traco); }
    }
    private void m(float x, float y) { path.moveTo(x * u, y * u); }
    private void l(float x, float y) { path.lineTo(x * u, y * u); }
    private void q(float cx, float cy, float x, float y) { path.quadTo(cx * u, cy * u, x * u, y * u); }

    /* ---------- a CYRON ---------- */
    void cyron(Canvas c, float escala, float t, Pose pose, Olhos olhos, boolean virada, String acessorio, int comida) {
        u = escala;
        c.save();
        if (virada) c.scale(-1, 1);

        // sombra no chão
        p.setColor(0x33000000); p.setStyle(Paint.Style.FILL);
        float sombra = pose == Pose.PULANDO || pose == Pose.CAINDO || pose == Pose.ARRASTADA ? 9 : 15;
        r.set(-sombra * u, -2.5f * u, sombra * u, 2.5f * u); c.drawOval(r, p);

        boolean sentada = pose == Pose.SENTADA || pose == Pose.DORMINDO;
        float corpoY = 0;
        if (sentada) corpoY = 9;
        else if (pose == Pose.ANDANDO) corpoY = -Math.abs((float) Math.sin(t * 9)) * 1.6f;
        else if (pose == Pose.PARADA || pose == Pose.ACENANDO || pose == Pose.COMENDO) corpoY = (float) Math.sin(t * 2.5) * 0.5f;
        else if (pose == Pose.BRINCANDO) corpoY = -Math.abs((float) Math.sin(t * 7)) * 5f;
        else if (pose == Pose.LUTANDO) corpoY = 1 + (float) Math.sin(t * 6) * 0.6f;

        c.translate(0, corpoY * u);

        // pernas (a de trás primeiro)
        float passo = pose == Pose.ANDANDO ? (float) Math.sin(t * 9) * 0.55f : 0;
        if (pose == Pose.ARRASTADA) passo = (float) Math.sin(t * 5) * 0.35f;
        if (sentada) {
            perna(c, -2, -11, 9, -4, true);
            perna(c, 3, -11, 13, -3, false);
        } else if (pose == Pose.LUTANDO) {
            perna(c, -3, -18, -9, -5, true);
            perna(c, 3, -18, 9, -5, false);
        } else if (pose == Pose.PULANDO || pose == Pose.CAINDO) {
            perna(c, -3, -18, -6, -7, true);
            perna(c, 3, -18, 7, -8, false);
        } else {
            perna(c, -3, -18, -3 + (float) Math.sin(-passo) * 14, -18 + (float) Math.cos(passo) * 14, true);
            perna(c, 3, -18, 3 + (float) Math.sin(passo) * 14, -18 + (float) Math.cos(passo) * 14, false);
        }

        // trança, atrás de tudo do tronco para cima
        tranca(c, t, pose);

        // braço de trás
        float balanco = pose == Pose.ANDANDO ? (float) Math.sin(t * 9) * 0.6f : (float) Math.sin(t * 2) * 0.06f;
        float[] tras = maoDeTras(pose, t, balanco);
        membro(c, -7, -37, tras[0], tras[1], 5.6f, MOLETOM);
        oval(c, tras[0], tras[1], 2.6f, 2.6f, PELE, 1.1f);

        // short e moletom
        caixa(c, -8.5f, -22, 17, 8, 3, SHORT, 1.3f);
        linha(c, -8, -14.8f, 8, -14.8f, 1.2f, CIANO);
        caixa(c, -10.5f, -43, 21, 25, 7, MOLETOM, 1.4f);
        oval(c, -4, -42, 8, 3.6f, MOLETOM_ESCURO, 1.1f);            // capuz caído nas costas
        linha(c, -10, -30, -10, -21, 1.3f, CIANO);                  // listra lateral
        arco(c, 2, -24.5f, 7, 3.5f, 200, 140, 1.1f, MOLETOM_ESCURO); // bolso canguru
        linha(c, 1, -39, 0.4f, -32, 1f, CIANO);                     // cordões
        linha(c, 5, -39, 5.6f, -33, 1f, CIANO);
        oval(c, 0.4f, -31.5f, 0.9f, 0.9f, CIANO, 0);
        oval(c, 5.6f, -32.5f, 0.9f, 0.9f, CIANO, 0);

        // cabeça
        cabeca(c, t, pose, olhos, acessorio);

        // braço da frente (por cima do corpo)
        float[] frente = maoDaFrente(pose, t, balanco);
        float giroArma = 15;
        if (pose == Pose.LUTANDO) {
            float teta = anguloDoGolpe();
            frente = new float[] { 7 + 13 * (float) Math.sin(teta), -37 + 13 * (float) Math.cos(teta) };
            giroArma = 120 - (float) Math.toDegrees(teta) * 1.15f;
        }
        if (arma >= 0 && pose != Pose.COMENDO && pose != Pose.ACENANDO && pose != Pose.DORMINDO && pose != Pose.SENTADA) {
            c.save();
            c.translate(frente[0] * u, frente[1] * u);
            c.rotate(giroArma);
            desenharArma(c, arma, t);
            c.restore();
        }
        membro(c, 7, -37, frente[0], frente[1], 5.6f, MOLETOM);
        linha(c, 7 + (frente[0] - 7) * 0.55f, -37 + (frente[1] + 37) * 0.55f, 7 + (frente[0] - 7) * 0.8f, -37 + (frente[1] + 37) * 0.8f, 1.2f, CIANO);
        oval(c, frente[0], frente[1], 2.7f, 2.7f, PELE, 1.1f);
        if (pose == Pose.COMENDO && comida >= 0) comidaNaMao(c, frente[0] + 1, frente[1] - 2, comida);
        if (pose == Pose.ACENANDO) { // dedinhos do tchau: o "V" de vitória do desenho original
            linha(c, frente[0] - 0.8f, frente[1] - 2, frente[0] - 1.6f, frente[1] - 5.5f, 1.6f, PELE);
            linha(c, frente[0] + 0.8f, frente[1] - 2, frente[0] + 1.8f, frente[1] - 5.5f, 1.6f, PELE);
        }
        c.restore();
    }

    /* O golpe: puxa a arma para trás da cabeça e desce com tudo para a frente. */
    private float anguloDoGolpe() {
        if (golpe <= 0) return 1.0f;
        float p = 1 - golpe;
        if (p < 0.35f) return 1.0f + (2.7f - 1.0f) * (p / 0.35f);
        return 2.7f + (0.5f - 2.7f) * ((p - 0.35f) / 0.65f);
    }

    private void desenharArma(Canvas c, int tipo, float t) {
        switch (tipo) {
            case 0: // varinha estelar
                linha(c, 0, 3, 0, -15, 1.8f, 0xFF6B4428);
                oval(c, 0, -18, 5.5f, 5.5f, 0x33FFE27A, 0);
                path.reset();
                for (int i = 0; i < 10; i++) {
                    double a = -Math.PI / 2 + i * Math.PI / 5;
                    float rr = i % 2 == 0 ? 4.2f : 1.8f;
                    float px = (float) Math.cos(a) * rr, py = -18 + (float) Math.sin(a) * rr;
                    if (i == 0) m(px, py); else l(px, py);
                }
                path.close();
                preencher(c, 0xFFFFE27A, 0.8f);
                break;
            case 1: // espada curta
                caixa(c, -1.6f, -22, 3.2f, 19, 1.2f, 0xFFDFE6EE, 0.9f);
                linha(c, -0.4f, -20, -0.4f, -5, 0.8f, 0xFFFFFFFF);
                caixa(c, -5, -4, 10, 2.6f, 1, 0xFFF3C13F, 0.8f);
                caixa(c, -1.2f, -1.5f, 2.4f, 5, 1, 0xFF6B4428, 0);
                break;
            case 2: // martelo de cristal
                linha(c, 0, 4, 0, -16, 2.2f, 0xFF7A5634);
                path.reset(); m(-6, -17); l(-3, -22); l(3, -22); l(6, -17); l(3, -12); l(-3, -12); path.close();
                preencher(c, 0xFF5FD6E6, 1f);
                linha(c, -2, -20, 1, -14, 0.8f, 0xFFB6F1F8);
                break;
            case 3: // cajado do Mundo
                linha(c, 0, 6, 0, -22, 2f, 0xFF5A3A20);
                oval(c, 0, -26, 6.5f, 6.5f, 0x335CC7FF, 0);
                oval(c, 0, -26, 4.2f, 4.2f, 0xFF3A8FE0, 0.9f);
                oval(c, -1.3f, -27.3f, 1.6f, 1.1f, 0xFF5CC76A, 0);
                oval(c, 1.5f, -24.8f, 1.2f, 1.4f, 0xFF5CC76A, 0);
                break;
            default: // lâmina arco-íris
                int[] cores = { 0xFFFF6B6B, 0xFFFFC94A, 0xFF5CC76A, 0xFF36C6F0, 0xFF9A78E8 };
                for (int i = 0; i < 5; i++) caixa(c, -2.4f + i * 0.96f, -25, 0.96f, 21, 0.4f, cores[i], 0);
                caixa(c, -2.4f, -25, 4.8f, 21, 1.4f, 0x00000000, 0.9f);
                oval(c, 0, -26, 3.5f + (float) Math.sin(t * 5) * 0.6f, 3.5f, 0x55FFFFFF, 0);
                caixa(c, -5, -4, 10, 2.6f, 1, 0xFFE6EAF5, 0.8f);
                caixa(c, -1.2f, -1.5f, 2.4f, 5, 1, 0xFF9A78E8, 0);
        }
    }

    private void perna(Canvas c, float x1, float y1, float x2, float y2, boolean deTras) {
        membro(c, x1, y1, x2, y2, 4.6f, deTras ? PELE_SOMBRA : PELE);
        // tênis azul-marinho com detalhe ciano e sola clara
        float ang = (float) Math.atan2(y2 - y1, x2 - x1);
        c.save();
        c.translate(x2 * u, y2 * u);
        c.rotate((float) Math.toDegrees(ang) - 90);
        caixa(c, -3.2f, -2.5f, 8.2f, 5.4f, 2.6f, deTras ? MOLETOM_ESCURO : TENIS, 1.2f);
        linha(c, -2.6f, 2.4f, 4.4f, 2.4f, 1.2f, SOLA);
        linha(c, -0.5f, -1.4f, 2, -1.4f, 1f, CIANO);
        c.restore();
    }

    private float[] maoDeTras(Pose pose, float t, float balanco) {
        switch (pose) {
            case ARRASTADA: return new float[] { -13, -52 };
            case BRINCANDO: return new float[] { -12, -54 + (float) Math.sin(t * 7) * 2 };
            case SENTADA: case DORMINDO: return new float[] { -9, -24 };
            case PULANDO: case CAINDO: return new float[] { -14, -46 };
            default: return new float[] { -7 + (float) Math.sin(-balanco) * 13, -37 + (float) Math.cos(balanco) * 13 };
        }
    }

    private float[] maoDaFrente(Pose pose, float t, float balanco) {
        switch (pose) {
            case ACENANDO: { float a = (float) Math.sin(t * 11) * 0.35f; return new float[] { 13 + (float) Math.sin(a) * 4, -54 + (float) Math.cos(a) }; }
            case COMENDO: return new float[] { 8 + (float) Math.sin(t * 6) * 0.6f, -46 + (float) Math.abs(Math.sin(t * 6)) * 1.5f };
            case ARRASTADA: return new float[] { 12, -53 };
            case BRINCANDO: return new float[] { 13, -55 - (float) Math.sin(t * 7) * 2 };
            case SENTADA: case DORMINDO: return new float[] { 9, -23 };
            case PULANDO: case CAINDO: return new float[] { 15, -47 };
            default: return new float[] { 7 + (float) Math.sin(balanco) * 13, -37 + (float) Math.cos(balanco) * 13 };
        }
    }

    private void tranca(Canvas c, float t, Pose pose) {
        float vento = pose == Pose.ANDANDO ? (float) Math.sin(t * 9) * 1.2f : (float) Math.sin(t * 1.8) * 0.5f;
        if (pose == Pose.PULANDO || pose == Pose.ARRASTADA) vento = -3;
        float x = -13, y = -50;
        for (int i = 0; i < 5; i++) {
            float k = i / 4f;
            float rr = 4.4f - i * 0.35f;
            oval(c, x - k * 2.5f + vento * k, y + i * 5.6f, rr, rr * 1.15f, TRANCA[i], 1.1f);
        }
        // pontinha lilás e o elástico ciano
        float px = x - 2.5f + vento, py = y + 4 * 5.6f + 4;
        path.reset(); m(px - 3, py - 1); q(px - 4, py + 6, px - 1, py + 8); q(px + 3, py + 4, px + 3, py - 1); path.close();
        preencher(c, LILAS, 1.1f);
        caixa(c, px - 3, py - 2.5f, 6, 2, 1, CIANO, 0.8f);
    }

    private void cabeca(Canvas c, float t, Pose pose, Olhos olhos, String acessorio) {
        float inclina = pose == Pose.DORMINDO ? 10 : pose == Pose.ARRASTADA ? -6 : 0;
        c.save();
        c.rotate(inclina, 0, -44 * u);

        // massa de cabelo de trás
        oval(c, -1, -62, 21, 20, CABELO, 1.4f);
        oval(c, -12, -55, 7, 9, CABELO_SOMBRA, 0);
        // rosto
        oval(c, 3, -57.5f, 14.5f, 13.5f, PELE, 1.3f);
        // fone ciano na orelha
        oval(c, -8.5f, -56, 2.6f, 2.6f, CIANO, 1f);
        oval(c, -8.5f, -56, 1f, 1f, 0xFFBFF1FF, 0);
        // topo e franja em mechas
        path.reset();
        m(-15, -60); q(-16, -82, 3, -82); q(20, -81, 18, -60);
        l(15.5f, -64); l(12.5f, -58.5f); l(9.5f, -65.5f); l(5.5f, -59); l(2, -66); l(-1.5f, -60); l(-4.5f, -66); l(-8, -61);
        path.close();
        preencher(c, CABELO, 1.3f);
        // brilho do cabelo
        arco(c, 2, -73, 9, 4, 200, 90, 1.6f, 0xFFFFFFFF);
        // mecha lateral da frente
        path.reset(); m(15, -64); q(19.5f, -56, 16, -46); q(14.5f, -52, 14, -58); path.close();
        preencher(c, CABELO, 1.1f);
        linha(c, -6, -74, -2, -67, 0.9f, CABELO_LINHA);
        linha(c, 9, -75, 11, -68, 0.9f, CABELO_LINHA);
        // anteninha (ahoge) balançando
        path.reset();
        float bal = (float) Math.sin(t * 3) * 1.5f;
        m(1, -81); q(0 + bal, -90, 7 + bal, -88); q(4 + bal, -87, 3, -81);
        preencher(c, CABELO, 1f);

        olhos(c, t, pose, olhos);

        // bochechas
        oval(c, -2.5f, -51.5f, 2.6f, 1.5f, BOCHECHA, 0);
        oval(c, 12.5f, -51.5f, 2.6f, 1.5f, BOCHECHA, 0);

        boca(c, t, pose, olhos);
        acessorio(c, acessorio, t);
        c.restore();
    }

    private void olhos(Canvas c, float t, Pose pose, Olhos olhos) {
        float lx = 0.5f, rx = 9.5f, y = -57;
        boolean piscando = olhos == Olhos.NORMAL && (t % 4.3f) < 0.13f;
        if (olhos == Olhos.FECHADOS || piscando) {
            arco(c, lx, y - 1, 3, 2.2f, 20, 140, 1.3f, CONTORNO);
            arco(c, rx, y - 1, 3, 2.2f, 20, 140, 1.3f, CONTORNO);
            return;
        }
        if (olhos == Olhos.TONTA) {
            for (float ox : new float[] { lx, rx }) {
                linha(c, ox - 2.4f, y - 2.4f, ox + 2.4f, y + 2.4f, 1.4f, CONTORNO);
                linha(c, ox - 2.4f, y + 2.4f, ox + 2.4f, y - 2.4f, 1.4f, CONTORNO);
            }
            return;
        }
        if (olhos == Olhos.FELIZ) {
            arco(c, lx, y + 1, 3.2f, 3, 200, 140, 1.5f, CONTORNO);
            arco(c, rx, y + 1, 3.2f, 3, 200, 140, 1.5f, CONTORNO);
            return;
        }
        boolean grande = olhos == Olhos.SURPRESA;
        olho(c, lx, y, AZUL_OLHO, grande);
        if (olhos == Olhos.PISCADA) arco(c, rx, y + 1, 3.2f, 3, 200, 140, 1.5f, CONTORNO);
        else olho(c, rx, y, VIOLETA_OLHO, grande);
        if (olhos == Olhos.TRISTE) {
            linha(c, lx - 3, y - 6.5f, lx + 2, y - 5, 1f, CABELO_LINHA);
            linha(c, rx + 3, y - 6.5f, rx - 2, y - 5, 1f, CABELO_LINHA);
        }
    }

    private void olho(Canvas c, float x, float y, int cor, boolean grande) {
        float k = grande ? 1.15f : 1;
        oval(c, x, y, 3.1f * k, 4.1f * k, 0xFFFFFFFF, 0);
        oval(c, x + 0.3f, y + 0.3f, 2.7f * k, 3.7f * k, cor, 0);
        oval(c, x + 0.4f, y + 1, 1.4f * k, 2f * k, 0xFF15204A, 0);
        oval(c, x - 0.8f, y - 1.5f, 1.1f, 1.1f, 0xFFFFFFFF, 0);
        oval(c, x + 1.3f, y + 2.2f, 0.5f, 0.5f, 0xCCFFFFFF, 0);
        arco(c, x, y - 0.3f, 3.4f * k, 4.2f * k, 195, 150, 1.4f, CONTORNO); // cílios
    }

    private void boca(Canvas c, float t, Pose pose, Olhos olhos) {
        float x = 5, y = -49.5f;
        if (pose == Pose.DORMINDO) { oval(c, x, y, 1.1f, 1.3f, BOCA, 0.7f); return; }
        if (pose == Pose.COMENDO) {
            float a = (float) Math.abs(Math.sin(t * 6));
            oval(c, x, y, 2.2f, 0.8f + a * 1.6f, BOCA, 0.8f);
            return;
        }
        if (olhos == Olhos.TRISTE) { arco(c, x, y + 1.5f, 2.4f, 1.6f, 200, 140, 1.1f, CONTORNO); return; }
        if (olhos == Olhos.SURPRESA) { oval(c, x, y, 1.5f, 1.9f, BOCA, 0.8f); return; }
        if (olhos == Olhos.TONTA) { oval(c, x, y, 1.6f, 1.2f, BOCA, 0.7f); return; }
        if (pose == Pose.LUTANDO && olhos == Olhos.NORMAL) { linha(c, x - 2, y - 0.5f, x + 2, y - 0.5f, 1.1f, CONTORNO); return; }
        if (olhos == Olhos.FELIZ || pose == Pose.BRINCANDO || pose == Pose.ACENANDO || pose == Pose.PULANDO) {
            path.reset(); m(x - 3, y - 1); q(x, y + 4.5f, x + 3, y - 1); path.close();
            preencher(c, BOCA, 0.9f);
            oval(c, x, y + 1.6f, 1.4f, 0.8f, LINGUA, 0);
            return;
        }
        arco(c, x, y - 1, 2.2f, 1.8f, 20, 140, 1.1f, CONTORNO);
    }

    private void acessorio(Canvas c, String a, float t) {
        if (a == null) return;
        switch (a) {
            case "laco":
                path.reset(); m(-9, -76); l(-17, -81); l(-16, -70); path.close(); preencher(c, 0xFFFF6FA8, 1f);
                path.reset(); m(-9, -76); l(-1, -82); l(-2, -71); path.close(); preencher(c, 0xFFFF6FA8, 1f);
                oval(c, -9, -76, 2.2f, 2.2f, 0xFFFF9CC4, 1f);
                break;
            case "gorro":
                path.reset(); m(-18, -67); q(-17, -90, 2, -90); q(22, -90, 21, -67); path.close();
                preencher(c, CIANO, 1.3f);
                caixa(c, -19, -71, 41, 6, 3, 0xFF2A9CC8, 1.2f);
                oval(c, 2, -91.5f, 3.6f, 3.6f, 0xFFFFFFFF, 1.1f);
                break;
            case "oculos":
                caixa(c, -3.5f, -60.5f, 7.5f, 5.5f, 2, 0xFF141826, 1f);
                caixa(c, 6, -60.5f, 7.5f, 5.5f, 2, 0xFF141826, 1f);
                linha(c, 4, -58.5f, 6, -58.5f, 1f, 0xFF141826);
                linha(c, -1.5f, -59.5f, 0.5f, -59.5f, 0.8f, 0x88FFFFFF);
                break;
            case "fone":
                arco(c, 0, -63, 18, 20, 190, 160, 3.2f, 0xFF16214A);
                oval(c, -14, -58, 4.5f, 6, 0xFF16214A, 1.1f);
                oval(c, -14, -58, 2.4f, 3.6f, CIANO, 0);
                break;
            case "coroa":
                path.reset(); m(-6, -82); l(-7, -91); l(-2.5f, -86.5f); l(1, -93); l(4.5f, -86.5f); l(9, -91); l(8, -82); path.close();
                preencher(c, 0xFFF3C13F, 1.1f);
                oval(c, 1, -85, 1.3f, 1.3f, 0xFFE2574C, 0);
                break;
            default:
        }
    }

    private void comidaNaMao(Canvas c, float x, float y, int comida) {
        switch (comida) {
            case 0: // biscoito
                oval(c, x, y, 3.6f, 3.6f, 0xFFD9A65A, 1f);
                oval(c, x - 1, y - 1, 0.6f, 0.6f, 0xFF6B4428, 0);
                oval(c, x + 1.3f, y + 0.8f, 0.6f, 0.6f, 0xFF6B4428, 0);
                break;
            case 1: // onigiri
                path.reset(); m(x, y - 4.5f); l(x + 4.5f, y + 3); l(x - 4.5f, y + 3); path.close(); preencher(c, 0xFFFFFFFF, 1f);
                caixa(c, x - 2.4f, y + 0.5f, 4.8f, 2.6f, 0.6f, 0xFF1F3A2E, 0);
                break;
            default: // pudim
                path.reset(); m(x - 4, y + 3); l(x - 2.6f, y - 3); l(x + 2.6f, y - 3); l(x + 4, y + 3); path.close(); preencher(c, 0xFFF6D27A, 1f);
                caixa(c, x - 2.8f, y - 4.2f, 5.6f, 2, 1, 0xFF8A4A1E, 0);
        }
    }

    /* ---------- o Mundinho: o planetinha que anda junto ---------- */
    void mundinho(Canvas c, float escala, float t, boolean dormindo, boolean feliz) {
        u = escala;
        oval(c, 0, 0, 7, 7, 0xFF3A8FE0, 1.2f);
        oval(c, -2.5f, -2.5f, 3, 2, 0xFF5CC76A, 0);
        oval(c, 3, 1.5f, 2.4f, 2.8f, 0xFF5CC76A, 0);
        oval(c, -3, 3.5f, 1.8f, 1.1f, 0xFF5CC76A, 0);
        if (dormindo) {
            linha(c, -3, -0.5f, -1.2f, -0.5f, 0.8f, CONTORNO);
            linha(c, 1.2f, -0.5f, 3, -0.5f, 0.8f, CONTORNO);
        } else {
            oval(c, -2, -0.6f, 0.8f, 1.1f, CONTORNO, 0);
            oval(c, 2, -0.6f, 0.8f, 1.1f, CONTORNO, 0);
        }
        if (feliz) { path.reset(); m(-1.8f, 1.6f); q(0, 4.2f, 1.8f, 1.6f); path.close(); preencher(c, BOCA, 0.6f); }
        else arco(c, 0, 1.4f, 1.5f, 1.2f, 20, 140, 0.8f, CONTORNO);
        oval(c, -3.6f, 1.3f, 1.2f, 0.7f, BOCHECHA, 0);
        oval(c, 3.6f, 1.3f, 1.2f, 0.7f, BOCHECHA, 0);
        // brilhinhos de vez em quando
        float b = (t * 0.8f) % 3f;
        if (b < 1 && !dormindo) {
            float a = 1 - Math.abs(b - 0.5f) * 2;
            p.setAlpha((int) (255 * a));
            brilho(c, 9, -7, 2.2f * a + 0.5f, 0xFFFFE27A);
            p.setAlpha(255);
        }
    }

    private void brilho(Canvas c, float x, float y, float s, int cor) {
        path.reset(); m(x, y - s); q(x, y, x + s, y); q(x, y, x, y + s); q(x, y, x - s, y); q(x, y, x, y - s); path.close();
        int a = p.getAlpha(); p.setColor(cor); p.setAlpha(a); p.setStyle(Paint.Style.FILL); c.drawPath(path, p);
    }

    /* coraçãozinho que sobe quando ela ganha carinho */
    void coracao(Canvas c, float escala, float x, float y, float tam, int alfa) {
        u = escala;
        path.reset();
        m(x, y + tam * 0.9f);
        path.cubicTo((x - tam * 1.4f) * u, (y - tam * 0.1f) * u, (x - tam * 0.6f) * u, (y - tam * 1.2f) * u, x * u, (y - tam * 0.35f) * u);
        path.cubicTo((x + tam * 0.6f) * u, (y - tam * 1.2f) * u, (x + tam * 1.4f) * u, (y - tam * 0.1f) * u, x * u, (y + tam * 0.9f) * u);
        path.close();
        p.setStyle(Paint.Style.FILL); p.setColor(0xFFFF5C8A); p.setAlpha(alfa);
        c.drawPath(path, p);
        p.setAlpha(255);
    }
}
