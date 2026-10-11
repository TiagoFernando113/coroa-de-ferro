package com.tiagofernando.cyronpet;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.HashSet;
import java.util.Set;

/*
 * Como a CYRON está: barriga, energia, humor, moedas e amizade.
 *
 * Tudo anda com o relógio de verdade. Não existe "tick" guardado: cada vez que
 * alguém olha para ela, atualizar() desconta o tempo que passou desde a última
 * vez. Por isso o pet continua vivendo com o app fechado e o celular desligado,
 * sem serviço nenhum rodando.
 *
 * Uma instância só, compartilhada pela tela de cuidar e pelo serviço que a
 * desenha por cima dos outros apps (os dois rodam no mesmo processo).
 */
final class Pet {
    static final String[][] COMIDAS = {
        // id, nome, preço, barriga, humor, amizade
        { "biscoito", "Biscoito", "5", "15", "2", "2" },
        { "onigiri", "Onigiri", "12", "35", "4", "4" },
        { "pudim", "Pudim", "25", "60", "12", "8" },
    };
    static final String[][] ACESSORIOS = {
        // id, nome, preço, nível de amizade
        { "laco", "Laço", "60", "1" },
        { "gorro", "Gorro", "120", "3" },
        { "oculos", "Óculos escuros", "200", "5" },
        { "fone", "Fone grande", "300", "8" },
        { "coroa", "Coroa", "600", "12" },
    };

    float barriga = 80, energia = 90, humor = 70; // de 0 a 100
    long moedas = 30;
    long amizade = 0;          // pontos: carinho, comida, brincadeira e tempo juntos
    long minutosJuntos = 0;    // minutos na tela com o celular aceso
    boolean dormindo = false;
    boolean naTela = false;    // a pessoa quer a CYRON por cima dos apps
    int tamanho = 1;           // 0 pequena, 1 média, 2 grande
    String acessorio = "";
    final Set<String> comprados = new HashSet<>();
    long ultimo;               // última vez que o tempo foi descontado
    long nascimento;

    private static Pet unico;
    private SharedPreferences prefs;

    static synchronized Pet de(Context c) {
        if (unico == null) {
            unico = new Pet();
            unico.prefs = c.getApplicationContext().getSharedPreferences("pet", Context.MODE_PRIVATE);
            unico.carregar();
        }
        return unico;
    }

    private void carregar() {
        long agora = System.currentTimeMillis();
        barriga = prefs.getFloat("barriga", barriga);
        energia = prefs.getFloat("energia", energia);
        humor = prefs.getFloat("humor", humor);
        moedas = prefs.getLong("moedas", moedas);
        amizade = prefs.getLong("amizade", 0);
        minutosJuntos = prefs.getLong("minutos", 0);
        dormindo = prefs.getBoolean("dormindo", false);
        naTela = prefs.getBoolean("naTela", false);
        tamanho = prefs.getInt("tamanho", 1);
        acessorio = prefs.getString("acessorio", "");
        comprados.addAll(prefs.getStringSet("comprados", new HashSet<>()));
        ultimo = prefs.getLong("ultimo", agora);
        nascimento = prefs.getLong("nascimento", agora);
        atualizar(agora);
    }

    synchronized void salvar() {
        prefs.edit()
            .putFloat("barriga", barriga).putFloat("energia", energia).putFloat("humor", humor)
            .putLong("moedas", moedas).putLong("amizade", amizade).putLong("minutos", minutosJuntos)
            .putBoolean("dormindo", dormindo).putBoolean("naTela", naTela).putInt("tamanho", tamanho)
            .putString("acessorio", acessorio).putStringSet("comprados", new HashSet<>(comprados))
            .putLong("ultimo", ultimo).putLong("nascimento", nascimento)
            .apply();
    }

    private static float limitar(float v) { return Math.max(0, Math.min(100, v)); }

    /* Desconta o tempo que passou: a barriga esvazia em umas 11 horas, a
       energia cai acordada e volta dormindo, e o humor cai mais depressa com
       fome ou cansaço. Dormiu até encher a energia, acorda sozinha. */
    synchronized void atualizar(long agora) {
        float h = (agora - ultimo) / 3_600_000f;
        if (h <= 0) { ultimo = agora; return; }
        h = Math.min(h, 72);
        barriga = limitar(barriga - 9f * h);
        if (dormindo) energia = limitar(energia + 22f * h);
        else energia = limitar(energia - 6f * h);
        float queda = 3f * h;
        if (barriga < 25) queda += 6f * h;
        if (energia < 15) queda += 4f * h;
        humor = limitar(humor - queda);
        if (dormindo && energia >= 100) dormindo = false;
        ultimo = agora;
    }

    int nivel() { return 1 + (int) Math.floor(Math.sqrt(amizade / 15.0)); }
    long amizadeDoNivel(int n) { return (long) Math.ceil(15.0 * (n - 1) * (n - 1)); }

    /* Um minuto juntos, com a tela acesa: uma moeda, e mais uma se ela estiver feliz. */
    synchronized void minutoNaTela() {
        minutosJuntos++;
        moedas += humor > 70 ? 2 : 1;
        amizade += 1;
    }

    synchronized boolean comer(int i) {
        String[] c = COMIDAS[i];
        long preco = Long.parseLong(c[2]);
        if (moedas < preco || barriga >= 98) return false;
        moedas -= preco;
        barriga = limitar(barriga + Float.parseFloat(c[3]));
        humor = limitar(humor + Float.parseFloat(c[4]));
        amizade += Long.parseLong(c[5]);
        if (dormindo) dormindo = false;
        return true;
    }

    /* Brincar cansa e dá fome, mas é o que mais alegra. */
    synchronized boolean brincar() {
        if (dormindo || energia < 15 || barriga < 10) return false;
        energia = limitar(energia - 12);
        barriga = limitar(barriga - 5);
        humor = limitar(humor + 18);
        amizade += 6;
        return true;
    }

    /* Carinho: alegra, mas sem virar fábrica de pontos (quem limita é o serviço). */
    synchronized void carinho() {
        humor = limitar(humor + 2);
        amizade += 1;
    }

    synchronized boolean comprar(int i) {
        String[] a = ACESSORIOS[i];
        if (comprados.contains(a[0])) return false;
        long preco = Long.parseLong(a[2]);
        if (moedas < preco || nivel() < Integer.parseInt(a[3])) return false;
        moedas -= preco;
        comprados.add(a[0]);
        acessorio = a[0];
        return true;
    }

    synchronized void vestir(String id) {
        acessorio = id.equals(acessorio) ? "" : id;
    }

    /* Qual necessidade está mais urgente, para ela reclamar na hora certa. */
    String queixa() {
        if (barriga < 25) return "fome";
        if (energia < 20 && !dormindo) return "sono";
        if (humor < 25) return "triste";
        return "";
    }
}
