// Ponto de entrada: carrega os modelos, tela inicial, escolha de classe e laço do jogo.
import * as C from './cena.js';
import { G, iniciar, passo, temSave, salvar } from './jogo.js';
import { montarHUD, atualizar, ui } from './ui.js';
import { CLASSES, VERSAO } from './dados.js';

const $ = s => document.querySelector(s);
window.VERSAO = VERSAO;
try { ui.qualidade = localStorage.getItem('coroa_rpg_q') || (Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5 ? 'media' : 'media'); } catch (e) {}

async function comecar() {
  C.iniciar($('#cena'), ui.qualidade);
  const t = $('#titulo');
  try {
    await C.carregar('modelos.bin', p => { $('#carga i').style.width = Math.round(p * 100) + '%'; });
  } catch (e) { t.querySelector('.tMenu').innerHTML = `<p>Não foi possível carregar o jogo 😢<br><small>${e.message}</small></p>`; return; }
  $('#carga').hidden = true;
  const m = t.querySelector('.tMenu');
  m.innerHTML = '';
  if (temSave()) m.append(btn('▶️ Continuar', () => entrar()));
  m.append(btn(temSave() ? '✨ Novo jogo' : '▶️ Jogar', () => escolherClasse()));
}
const btn = (txt, fn, cls = 'btn grande') => { const b = document.createElement('button'); b.className = cls; b.textContent = txt; b.onclick = fn; return b; };

function escolherClasse() {
  const t = $('#titulo');
  t.innerHTML = `<h2>Escolha seu herói</h2><div class="classes">${Object.entries(CLASSES).map(([k, c]) => `
    <button class="classe" data-c="${k}" style="--c:${c.cor}"><i>${c.icone}</i><b>${c.nome}</b><span>${c.desc}</span>
      <div class="cStats"><em>❤️ ${c.vida}</em><em>⚔️ ${c.atk}</em><em>🛡️ ${c.def}</em><em>💧 ${c.mana}</em></div></button>`).join('')}</div>`;
  t.onclick = e => { const b = e.target.closest('.classe'); if (b) entrar(b.dataset.c); };
}

function entrar(cls) {
  if (cls && temSave() && !confirm('Começar um novo jogo apaga o progresso salvo. Continuar?')) return;
  $('#titulo').hidden = true;
  iniciar(cls);
  montarHUD();
  let ultimo = performance.now();
  const laco = agora => {
    const dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora;
    if (!ui.pausado) passo(dt);
    else if (G.jog) { G.jog.vis.mixer.update(dt); for (const n of G.npcs) n.vis.mixer.update(dt); }
    atualizar(dt);
    C.quadro(dt, G.jog);
    requestAnimationFrame(laco);
  };
  requestAnimationFrame(laco);
  addEventListener('visibilitychange', () => { if (document.hidden) salvar(); });
  window.__jogo = G; window.__info = C.info; // para testes
}

comecar();
