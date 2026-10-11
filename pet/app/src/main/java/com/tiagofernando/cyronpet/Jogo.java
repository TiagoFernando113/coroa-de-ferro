package com.tiagofernando.cyronpet;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Random;
import java.util.Set;

/*
 * A aventura da CYRON, sem tela nenhuma: a regra do jogo inteira mora aqui.
 *
 * Ela anda por um mundinho de 200 "passos" de largura, os monstros vêm da
 * direita, a luta é sozinha (ela, o Mundinho e o toque de quem joga), cada 10
 * monstros vem um chefe com 30 segundos para cair, e a cada 5 zonas muda a
 * região. Quem desenha (a janelinha no canto ou a tela do app) só lê este
 * estado e chama avancar() com o relógio.
 *
 * Java puro, sem nada de Android: dá para simular horas de jogo no computador
 * e ajustar os números antes de mandar para o celular.
 */
final class Jogo {
    /* ---------- o mundo ---------- */
    static final String[][] REGIOES = {
        { "Campina do Moinho", "gosma", "cogumelo", "morcego" },
        { "Bosque das Corujas", "cogumelo", "morcego", "gosma" },
        { "Brejo Sem Fundo", "gosma", "fantasma", "cogumelo" },
        { "Minas de Cobre", "golem", "morcego", "gosma" },
        { "Dunas Rubras", "diabrete", "golem", "morcego" },
        { "Picos Gelados", "fantasma", "golem", "gosma" },
        { "Cripta Antiga", "fantasma", "morcego", "diabrete" },
        { "Vulcão Rugidor", "diabrete", "golem", "gosma" },
    };
    static final String[] NOME_MONSTRO_TIPOS = { "gosma", "cogumelo", "morcego", "fantasma", "golem", "diabrete" };
    static final String[] NOME_MONSTRO = { "Gosma", "Cogumelo Bravo", "Morcego", "Assombração", "Golem", "Diabrete" };
    static final String[] TITULO_CHEFE = { "Gigante", "Ancestral", "Voraz", "Imortal", "Colossal" };
    static final String[] ROMANOS = { "", " II", " III", " IV", " V" };

    /* ---------- melhorias (compradas com moedas no app) ---------- */
    static final int ARMA = 0, MOLETOM = 1, TENIS = 2, MUNDINHO = 3, SORTE = 4, TOQUE = 5;
    static final String[] UP_NOME = { "Arma", "Moletom", "Tênis", "Mundinho", "Sorte", "Toque" };
    static final double[] UP_BASE = { 12, 12, 30, 60, 45, 15 };
    static final double[] UP_RAZAO = { 1.15, 1.15, 1.25, 1.18, 1.2, 1.16 };
    static final int[] UP_MAX = { 999, 999, 40, 999, 999, 999 };
    static final String[] ARMAS = { "Varinha Estelar", "Espada Curta", "Martelo de Cristal", "Cajado do Mundo", "Lâmina Arco-Íris" };

    /* ---------- acessórios (comprados com cristais dos baús) ---------- */
    static final String[][] ACESSORIOS = {
        { "laco", "Laço", "5" }, { "gorro", "Gorro", "10" }, { "oculos", "Óculos escuros", "15" },
        { "fone", "Fone grande", "25" }, { "coroa", "Coroa", "50" },
    };

    static final double LARGURA = 200, POS_CYRON = 52, CONTATO = 93, NASCE = 215;
    static final int ABATES_POR_ZONA = 10;
    static final double TEMPO_DE_CHEFE = 30, LIMITE_FORA = 8 * 3600, RENDIMENTO_FORA = 0.5;

    /* ---------- o que fica salvo ---------- */
    double ouro;
    long cristais;
    int zona = 1, recorde = 1, abates;
    int nivel = 1;
    double xp;
    final int[] up = new int[6];
    String acessorio = "";
    final Set<String> comprados = new HashSet<>();
    long ultimo;                 // relógio da última vez que o jogo andou (ms)
    int tamanho = 1;             // janelinha: 0 pequena, 1 média, 2 grande
    boolean naTela, minimizada;
    int posX = -1, posY = -1;    // onde a janelinha ficou
    long totalAbates, totalChefes, totalToques, totalBaus;

    /* ---------- o que só existe com o jogo rodando ---------- */
    double hp = -1;
    Monstro m;
    double espera = 0.5, tCyron, tMonstro, tMundo, desmaio, tempoChefe, rolagem;
    double golpe;                // animação do golpe dela (0..1)
    double golpeMundo, levouDano;
    Bau bau;
    Moeda moeda;
    double proxBau = 90, proxMoeda = 45;
    final ArrayList<Efeito> efeitos = new ArrayList<>();
    String aviso = "", avisoSub = "";
    double tempoAviso;
    String ausencia;             // resumo do que ela fez com o jogo fechado, para quem quiser mostrar
    final Random rnd = new Random();

    static final class Monstro {
        String tipo, nome;
        boolean chefe, morrendo;
        double x, hp, max, atq, ouro, xp, t;
        int regiao;
    }

    static final class Bau { double x, vida = 25, t; }

    static final class Moeda { double x = NASCE, y = 0, t; }

    /* tipo: 0 número de dano, 1 dano nela, 2 moedinha voando, 3 texto, 4 raio do Mundinho, 5 brilho */
    static final class Efeito {
        int tipo, cor;
        double x, y, t, vida;
        String texto;
    }

    /* ---------- números ---------- */
    static double hpMonstro(int z) { return 10 * Math.pow(1.36, z - 1); }
    static double atqMonstro(int z) { return 2.2 * Math.pow(1.31, z - 1); }
    static double ouroMonstro(int z) { return 3 * Math.pow(1.28, z - 1); }
    static double xpMonstro(int z) { return 2 + z; }
    static double xpDoNivel(int n) { return 12 * Math.pow(1.22, n - 1); }

    int tierArma() { return Math.min(4, up[ARMA] / 25); }
    double ataque() { return 3 * Math.pow(1.09, up[ARMA]) * Math.pow(1.6, tierArma()) * (1 + 0.05 * (nivel - 1)); }
    double vidaMax() { return 30 * Math.pow(1.09, up[MOLETOM]) * (1 + 0.05 * (nivel - 1)); }
    double intervalo() { return Math.max(0.35, Math.pow(0.97, up[TENIS])); }
    double danoMundinho() { return up[MUNDINHO] == 0 ? 0 : ataque() * 0.35 * Math.pow(1.06, up[MUNDINHO]); }
    double multOuro() { return 1 + 0.1 * up[SORTE]; }
    double danoToque() { return ataque() * (0.5 + 0.15 * up[TOQUE]); }
    double custo(int i) { return Math.ceil(UP_BASE[i] * Math.pow(UP_RAZAO[i], up[i])); }
    double dps() { return ataque() / intervalo() + danoMundinho() / 2.5; }

    static String regiaoDa(int z) {
        int i = (z - 1) / 5;
        String nome = REGIOES[i % REGIOES.length][0];
        int volta = i / REGIOES.length;
        return nome + (volta < ROMANOS.length ? ROMANOS[volta] : " " + (volta + 1));
    }
    static int indiceRegiao(int z) { return ((z - 1) / 5) % REGIOES.length; }

    /* ---------- o relógio ---------- */
    void avancar(long agoraMs) {
        if (ultimo == 0) ultimo = agoraMs;
        double dt = (agoraMs - ultimo) / 1000.0;
        ultimo = agoraMs;
        if (hp < 0) hp = vidaMax();
        if (dt <= 0) return;
        if (dt > 8) { foraDoJogo(dt); return; }
        while (dt > 0) { double s = Math.min(0.05, dt); passo(s); dt -= s; }
    }

    private void passo(double dt) {
        for (int i = efeitos.size() - 1; i >= 0; i--) {
            Efeito e = efeitos.get(i);
            e.t += dt;
            if (e.t >= e.vida) efeitos.remove(i);
        }
        if (tempoAviso > 0) tempoAviso -= dt;
        golpe = Math.max(0, golpe - dt / 0.28);
        golpeMundo = Math.max(0, golpeMundo - dt / 0.3);
        levouDano = Math.max(0, levouDano - dt / 0.25);
        eventos(dt);

        if (desmaio > 0) {
            desmaio -= dt;
            if (desmaio <= 0) { hp = vidaMax(); avisar("De pé de novo!", ""); }
            return;
        }
        if (m == null) {
            andar(dt);
            espera -= dt;
            if (espera <= 0) nascer();
            return;
        }
        if (m.morrendo) {
            m.t += dt;
            andar(dt * 0.3);
            if (m.t > 0.45) { m = null; espera = 0.5; }
            return;
        }
        if (m.x > CONTATO) {
            m.x = Math.max(CONTATO, m.x - 30 * dt);
            andar(dt);
            if (m.x > CONTATO) return;
        }
        // a luta
        if (m.chefe) {
            tempoChefe -= dt;
            if (tempoChefe <= 0) {
                avisar("O chefe fugiu!", "Fique mais forte e ele volta");
                abates = 0;
                m = null;
                espera = 1;
                return;
            }
        }
        tCyron -= dt;
        if (tCyron <= 0) {
            tCyron += intervalo();
            boolean crit = rnd.nextDouble() < 0.1;
            golpe = 1;
            bater(ataque() * (crit ? 2 : 1), crit ? 0xFFFFD84A : 0xFFFFFFFF);
            if (m == null || m.morrendo) return;
        }
        if (up[MUNDINHO] > 0) {
            tMundo -= dt;
            if (tMundo <= 0) {
                tMundo += 2.5;
                golpeMundo = 1;
                efeito(4, m.x, 30, "", 0xFF7FD8FF, 0.3);
                bater(danoMundinho(), 0xFF9FE6FF);
                if (m == null || m.morrendo) return;
            }
        }
        tMonstro -= dt;
        if (tMonstro <= 0) {
            tMonstro += m.chefe ? 1.3 : 1.5;
            hp -= m.atq;
            levouDano = 1;
            efeito(1, POS_CYRON, 46, "-" + curto(m.atq), 0xFFFF6B6B, 0.8);
            if (hp <= 0) desmaiar();
        }
    }

    private void andar(double dt) {
        rolagem += 32 * dt;
        if (hp < vidaMax()) hp = Math.min(vidaMax(), hp + vidaMax() * 0.12 * dt);
    }

    private void nascer() {
        int reg = indiceRegiao(zona);
        boolean chefe = abates >= ABATES_POR_ZONA;
        String[] r = REGIOES[reg];
        String tipo = chefe ? r[1 + zona % 3] : r[1 + rnd.nextInt(3)];
        Monstro n = new Monstro();
        n.tipo = tipo;
        n.chefe = chefe;
        n.regiao = reg;
        n.x = NASCE;
        double k = chefe ? 7 : 1;
        n.max = n.hp = hpMonstro(zona) * k;
        n.atq = atqMonstro(zona) * (chefe ? 1.6 : 1);
        n.ouro = ouroMonstro(zona) * (chefe ? 8 : 1);
        n.xp = xpMonstro(zona) * (chefe ? 6 : 1);
        String nome = nomeMonstro(tipo);
        n.nome = chefe ? nome + " " + TITULO_CHEFE[(zona / 5) % TITULO_CHEFE.length] : nome;
        m = n;
        tMonstro = 0.9;
        tCyron = 0.15;
        tMundo = 1.2;
        if (chefe) { tempoChefe = TEMPO_DE_CHEFE; avisar("Chefe!", n.nome); }
    }

    static String nomeMonstro(String tipo) {
        for (int i = 0; i < NOME_MONSTRO_TIPOS.length; i++) if (NOME_MONSTRO_TIPOS[i].equals(tipo)) return NOME_MONSTRO[i];
        return tipo;
    }

    private void bater(double dano, int cor) {
        if (m == null || m.morrendo) return;
        m.hp -= dano;
        efeito(0, m.x + (rnd.nextDouble() - 0.5) * 10, 34 + rnd.nextDouble() * 6, curto(dano), cor, 0.8);
        if (m.hp <= 0) matar();
    }

    private void matar() {
        Monstro n = m;
        n.morrendo = true;
        n.t = 0;
        n.hp = 0;
        double ganho = n.ouro * multOuro();
        ouro += ganho;
        for (int i = 0; i < (n.chefe ? 6 : 3); i++) efeito(2, n.x + (rnd.nextDouble() - 0.5) * 16, 10 + rnd.nextDouble() * 10, "", 0, 0.9);
        efeito(3, n.x, 52, "+" + curto(ganho), 0xFFF3C13F, 1);
        ganharXp(n.xp);
        totalAbates++;
        if (n.chefe) {
            totalChefes++;
            String antes = regiaoDa(zona);
            zona++;
            recorde = Math.max(recorde, zona);
            abates = 0;
            if ((zona - 1) % 5 == 0) cristais += 2;
            String depois = regiaoDa(zona);
            avisar("Zona " + zona, depois.equals(antes) ? "" : depois);
        } else {
            abates = Math.min(ABATES_POR_ZONA, abates + 1);
        }
    }

    private void ganharXp(double q) {
        xp += q;
        boolean subiu = false;
        while (xp >= xpDoNivel(nivel)) { xp -= xpDoNivel(nivel); nivel++; subiu = true; }
        if (subiu) { hp = vidaMax(); avisar("Nível " + nivel + "!", "Mais forte e com a vida cheia"); }
    }

    private void desmaiar() {
        hp = 0;
        desmaio = 6;
        boolean eraChefe = m != null && m.chefe;
        m = null;
        espera = 1;
        abates = eraChefe ? 0 : Math.max(0, abates - 3);
        avisar("A CYRON desmaiou...", "Melhore o moletom no app");
    }

    /* ---------- baú e moeda dourada: o que pede um toque ---------- */
    private void eventos(double dt) {
        if (bau != null) {
            bau.t += dt;
            bau.vida -= dt;
            if (bau.vida <= 0) bau = null;
        } else if ((proxBau -= dt) <= 0) {
            bau = new Bau();
            bau.x = 115 + rnd.nextDouble() * 60;
            proxBau = 120 + rnd.nextDouble() * 150;
        }
        if (moeda != null) {
            moeda.t += dt;
            moeda.x = NASCE - moeda.t * 32;
            moeda.y = 52 + Math.sin(moeda.t * 3) * 8;
            if (moeda.x < -12) moeda = null;
        } else if ((proxMoeda -= dt) <= 0) {
            moeda = new Moeda();
            proxMoeda = 70 + rnd.nextDouble() * 90;
        }
    }

    boolean tocarMonstro() {
        if (m == null || m.morrendo || desmaio > 0) return false;
        totalToques++;
        boolean crit = rnd.nextDouble() < 0.12;
        golpe = Math.max(golpe, 0.6);
        bater(danoToque() * (crit ? 3 : 1), crit ? 0xFFFFD84A : 0xFFE9E2FF);
        return true;
    }

    boolean abrirBau() {
        if (bau == null) return false;
        double ganho = ouroMonstro(zona) * multOuro() * (8 + rnd.nextDouble() * 8);
        long c = rnd.nextDouble() < 0.5 ? 1 : rnd.nextDouble() < 0.7 ? 2 : 3;
        ouro += ganho;
        cristais += c;
        totalBaus++;
        efeito(3, bau.x, 40, "+" + curto(ganho), 0xFFF3C13F, 1.2);
        efeito(3, bau.x, 54, "+" + c + " cristal", 0xFF7FE6F2, 1.4);
        for (int i = 0; i < 5; i++) efeito(5, bau.x + (rnd.nextDouble() - 0.5) * 20, 10 + rnd.nextDouble() * 20, "", 0xFFFFE27A, 0.6);
        bau = null;
        return true;
    }

    boolean pegarMoeda() {
        if (moeda == null) return false;
        double ganho = ouroMonstro(zona) * multOuro() * 15;
        ouro += ganho;
        efeito(3, moeda.x, moeda.y + 8, "+" + curto(ganho), 0xFFFFD84A, 1.2);
        for (int i = 0; i < 6; i++) efeito(5, moeda.x + (rnd.nextDouble() - 0.5) * 16, moeda.y + (rnd.nextDouble() - 0.5) * 16, "", 0xFFFFE27A, 0.6);
        moeda = null;
        return true;
    }

    boolean comprar(int i) {
        if (up[i] >= UP_MAX[i]) return false;
        double c = custo(i);
        if (ouro < c) return false;
        ouro -= c;
        double vidaAntes = vidaMax();
        up[i]++;
        if (i == MOLETOM && hp >= 0) hp += vidaMax() - vidaAntes;
        return true;
    }

    boolean comprarAcessorio(int i) {
        String[] a = ACESSORIOS[i];
        if (comprados.contains(a[0])) return false;
        long preco = Long.parseLong(a[2]);
        if (cristais < preco) return false;
        cristais -= preco;
        comprados.add(a[0]);
        acessorio = a[0];
        return true;
    }

    void vestir(String id) { acessorio = id.equals(acessorio) ? "" : id; }

    /* ---------- com o jogo fechado ---------- */
    /* Ela continua caçando na zona em que estava, com metade do rendimento,
       até 8 horas. Não passa de zona sozinha: chefe é com você por perto. */
    private void foraDoJogo(double seg) {
        seg = Math.min(seg, LIMITE_FORA);
        double luta = hpMonstro(zona) / dps();
        double tempoPorAbate = 0.5 + (NASCE - CONTATO) / 62 + luta;
        double tomado = atqMonstro(zona) * (luta / 1.5);
        if (tomado > vidaMax()) tempoPorAbate *= 4;
        double n = Math.floor(seg * RENDIMENTO_FORA / tempoPorAbate);
        if (n < 1) { hp = vidaMax(); return; }
        double ganho = n * ouroMonstro(zona) * multOuro();
        int nivelAntes = nivel;
        ouro += ganho;
        totalAbates += (long) n;
        ganharXp(n * xpMonstro(zona));
        hp = vidaMax();
        m = null;
        espera = 0.5;
        desmaio = 0;
        ausencia = "Enquanto você estava fora, ela derrotou " + curto(n) + " monstros: +" + curto(ganho) + " moedas"
            + (nivel > nivelAntes ? " e subiu para o nível " + nivel : "") + ".";
        avisar("Bem-vindo de volta!", "+" + curto(ganho) + " moedas");
    }

    private void avisar(String a, String sub) { aviso = a; avisoSub = sub; tempoAviso = 2.2; }

    private void efeito(int tipo, double x, double y, String texto, int cor, double vida) {
        if (efeitos.size() > 40) efeitos.remove(0);
        Efeito e = new Efeito();
        e.tipo = tipo; e.x = x; e.y = y; e.texto = texto; e.cor = cor; e.vida = vida;
        efeitos.add(e);
    }

    /* ---------- números curtos ---------- */
    static String curto(double n) {
        if (n < 1000) return n < 10 && n != Math.floor(n) ? String.format(java.util.Locale.ROOT, "%.1f", n).replace('.', ',') : String.valueOf((long) Math.floor(n));
        String[] s = { "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc" };
        int e = (int) Math.floor(Math.log10(n) / 3);
        if (e >= s.length) e = s.length - 1;
        double v = n / Math.pow(1000, e);
        String t = v >= 100 ? String.valueOf((long) v) : String.format(java.util.Locale.ROOT, v >= 10 ? "%.1f" : "%.2f", v);
        return t.replace('.', ',') + s[e];
    }

    /* ---------- save: uma linha de texto, sem depender do Android ---------- */
    String exportar() {
        StringBuilder b = new StringBuilder();
        b.append("v=1\n");
        b.append("ouro=").append(ouro).append('\n');
        b.append("cristais=").append(cristais).append('\n');
        b.append("zona=").append(zona).append('\n');
        b.append("recorde=").append(recorde).append('\n');
        b.append("abates=").append(abates).append('\n');
        b.append("nivel=").append(nivel).append('\n');
        b.append("xp=").append(xp).append('\n');
        for (int i = 0; i < up.length; i++) b.append("up").append(i).append('=').append(up[i]).append('\n');
        b.append("acessorio=").append(acessorio).append('\n');
        b.append("comprados=").append(String.join(",", comprados)).append('\n');
        b.append("ultimo=").append(ultimo).append('\n');
        b.append("tamanho=").append(tamanho).append('\n');
        b.append("naTela=").append(naTela).append('\n');
        b.append("minimizada=").append(minimizada).append('\n');
        b.append("posX=").append(posX).append('\n');
        b.append("posY=").append(posY).append('\n');
        b.append("totalAbates=").append(totalAbates).append('\n');
        b.append("totalChefes=").append(totalChefes).append('\n');
        b.append("totalToques=").append(totalToques).append('\n');
        b.append("totalBaus=").append(totalBaus).append('\n');
        b.append("proxBau=").append(proxBau).append('\n');
        return b.toString();
    }

    void importar(String texto) {
        if (texto == null) return;
        for (String linha : texto.split("\n")) {
            int i = linha.indexOf('=');
            if (i <= 0) continue;
            String k = linha.substring(0, i), v = linha.substring(i + 1);
            try {
                switch (k) {
                    case "ouro": ouro = Double.parseDouble(v); break;
                    case "cristais": cristais = Long.parseLong(v); break;
                    case "zona": zona = Math.max(1, Integer.parseInt(v)); break;
                    case "recorde": recorde = Math.max(1, Integer.parseInt(v)); break;
                    case "abates": abates = Math.max(0, Math.min(ABATES_POR_ZONA, Integer.parseInt(v))); break;
                    case "nivel": nivel = Math.max(1, Integer.parseInt(v)); break;
                    case "xp": xp = Math.max(0, Double.parseDouble(v)); break;
                    case "acessorio": acessorio = v; break;
                    case "comprados": for (String c : v.split(",")) if (!c.isEmpty()) comprados.add(c); break;
                    case "ultimo": ultimo = Long.parseLong(v); break;
                    case "tamanho": tamanho = Math.max(0, Math.min(2, Integer.parseInt(v))); break;
                    case "naTela": naTela = Boolean.parseBoolean(v); break;
                    case "minimizada": minimizada = Boolean.parseBoolean(v); break;
                    case "posX": posX = Integer.parseInt(v); break;
                    case "posY": posY = Integer.parseInt(v); break;
                    case "totalAbates": totalAbates = Long.parseLong(v); break;
                    case "totalChefes": totalChefes = Long.parseLong(v); break;
                    case "totalToques": totalToques = Long.parseLong(v); break;
                    case "totalBaus": totalBaus = Long.parseLong(v); break;
                    case "proxBau": proxBau = Math.max(10, Double.parseDouble(v)); break;
                    default:
                        if (k.startsWith("up")) {
                            int j = Integer.parseInt(k.substring(2));
                            if (j >= 0 && j < up.length) up[j] = Math.max(0, Integer.parseInt(v));
                        }
                }
            } catch (RuntimeException ignorado) { /* linha estragada: fica o valor padrão */ }
        }
        if (!acessorio.isEmpty() && !comprados.contains(acessorio)) acessorio = "";
    }
}
