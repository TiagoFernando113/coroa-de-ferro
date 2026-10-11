package com.tiagofernando.cyronpet;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.HashSet;

/*
 * Um jogo só, compartilhado pela janelinha e pela tela do app (mesmo processo),
 * guardado como texto nas preferências. Quem jogou a primeira versão (o pet de
 * cuidar) não perde nada: as moedas viram moedas da aventura e os acessórios
 * comprados continuam dela.
 */
final class Salvo {
    private static Jogo jogo;

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences("aventura", Context.MODE_PRIVATE);
    }

    static synchronized Jogo jogo(Context c) {
        if (jogo == null) {
            jogo = new Jogo();
            String s = prefs(c).getString("jogo", null);
            if (s != null) jogo.importar(s);
            else migrar(c, jogo);
        }
        return jogo;
    }

    static synchronized void salvar(Context c) {
        if (jogo != null) prefs(c).edit().putString("jogo", jogo.exportar()).apply();
    }

    private static void migrar(Context c, Jogo j) {
        SharedPreferences velho = c.getApplicationContext().getSharedPreferences("pet", Context.MODE_PRIVATE);
        if (!velho.contains("moedas")) return;
        j.ouro = velho.getLong("moedas", 0);
        j.comprados.addAll(velho.getStringSet("comprados", new HashSet<>()));
        j.acessorio = velho.getString("acessorio", "");
        j.tamanho = velho.getInt("tamanho", 1);
        j.naTela = velho.getBoolean("naTela", false);
    }
}
