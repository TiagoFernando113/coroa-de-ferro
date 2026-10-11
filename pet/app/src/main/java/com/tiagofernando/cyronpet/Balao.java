package com.tiagofernando.cyronpet;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.view.View;

/*
 * O balão de fala. Fica numa janela à parte que não recebe toque: o que você
 * toca embaixo dele chega ao app de baixo normalmente.
 */
final class Balao extends View {
    private final Paint fundo = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint borda = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint letra = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF r = new RectF();
    private final Path rabinho = new Path();
    private final float d;
    private String texto = "";

    Balao(Context c) {
        super(c);
        d = c.getResources().getDisplayMetrics().density;
        fundo.setColor(0xFFFFFFFF);
        borda.setColor(0xFF1F2D5C);
        borda.setStyle(Paint.Style.STROKE);
        borda.setStrokeWidth(1.5f * d);
        letra.setColor(0xFF1A1F3A);
        letra.setTextSize(13 * d);
        letra.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
    }

    void setTexto(String t) { texto = t; requestLayout(); invalidate(); }

    int largura() { return (int) (letra.measureText(texto) + 22 * d); }
    int altura() { return (int) (34 * d); }

    @Override
    protected void onMeasure(int w, int h) { setMeasuredDimension(largura(), altura()); }

    @Override
    protected void onDraw(Canvas c) {
        float w = getWidth(), h = getHeight() - 7 * d, m = borda.getStrokeWidth();
        r.set(m, m, w - m, h);
        c.drawRoundRect(r, 12 * d, 12 * d, fundo);
        c.drawRoundRect(r, 12 * d, 12 * d, borda);
        rabinho.reset();
        rabinho.moveTo(w / 2 - 6 * d, h - m);
        rabinho.lineTo(w / 2, h + 6 * d);
        rabinho.lineTo(w / 2 + 6 * d, h - m);
        c.drawPath(rabinho, fundo);
        c.drawLine(w / 2 - 6 * d, h, w / 2, h + 6 * d, borda);
        c.drawLine(w / 2, h + 6 * d, w / 2 + 6 * d, h, borda);
        c.drawText(texto, 11 * d, h / 2 + letra.getTextSize() * 0.36f, letra);
    }
}
