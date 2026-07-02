import { TEAMS } from './constants.js';

const $ = id => document.getElementById(id);

export function initUI() {
  const els = {
    menu: $('menu'), hud: $('hud'), banner: $('banner'),
    meter: $('meter'), meterFill: $('meter-fill'),
    gameover: $('gameover'), goText: $('go-text'),
    homeAbbr: $('hud-home-abbr'), homeScore: $('hud-home-score'),
    awayAbbr: $('hud-away-abbr'), awayScore: $('hud-away-score'),
    clock: $('hud-clock'), quarter: $('hud-quarter'), shotClock: $('hud-shot'),
    selHome: $('sel-home'), selAway: $('sel-away'),
    selDiff: $('sel-diff'), selQlen: $('sel-qlen'),
  };

  // populate team pickers
  for (const key of Object.keys(TEAMS)) {
    for (const sel of [els.selHome, els.selAway]) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${TEAMS[key].name} ${TEAMS[key].nick}`;
      sel.appendChild(opt);
    }
  }
  els.selHome.value = 'LAL';
  els.selAway.value = 'BOS';

  let bannerTimer = null;
  let game = null;

  const ui = {
    bindGame(g) {
      game = g;
      $('btn-play').addEventListener('click', () => ui.startGame());
      $('btn-again').addEventListener('click', () => {
        els.gameover.classList.add('hidden');
        els.menu.classList.remove('hidden');
        els.hud.classList.add('hidden');
      });
    },

    startGame() {
      let home = els.selHome.value, away = els.selAway.value;
      if (home === away) away = home === 'BOS' ? 'LAL' : 'BOS';
      els.menu.classList.add('hidden');
      els.hud.classList.remove('hidden');
      els.gameover.classList.add('hidden');
      game.start({
        home, away,
        difficulty: els.selDiff.value,
        quarterLen: parseInt(els.selQlen.value, 10),
      });
      // set scoreboard team colors
      els.homeAbbr.style.background = '#' + TEAMS[home].color.toString(16).padStart(6, '0');
      els.awayAbbr.style.background = '#' + TEAMS[away].color.toString(16).padStart(6, '0');
    },

    updateHUD(g) {
      const [h, a] = g.teams;
      setText(els.homeAbbr, h.def.abbr);
      setText(els.awayAbbr, a.def.abbr);
      setText(els.homeScore, String(h.score));
      setText(els.awayScore, String(a.score));
      const t = Math.max(0, g.gameClock);
      const mm = Math.floor(t / 60), ss = Math.floor(t % 60);
      setText(els.clock, `${mm}:${String(ss).padStart(2, '0')}`);
      setText(els.quarter, g.quarterLabel());
      const sc = Math.ceil(Math.max(0, g.shotClock));
      setText(els.shotClock, String(sc));
      els.shotClock.classList.toggle('urgent', sc <= 5);
    },

    showBanner(text, ms = 1500) {
      els.banner.textContent = text;
      els.banner.classList.remove('hidden');
      els.banner.classList.remove('pop');
      void els.banner.offsetWidth;      // restart animation
      els.banner.classList.add('pop');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => els.banner.classList.add('hidden'), ms);
    },

    showMeter() { els.meter.classList.remove('hidden'); ui.updateMeter(0); },
    hideMeter() { els.meter.classList.add('hidden'); },
    updateMeter(v) {
      els.meterFill.style.height = `${Math.round(v * 100)}%`;
      const inSweet = v > 0.68 && v < 0.86;
      els.meterFill.style.background = inSweet ? '#3ddc74' : (v > 0.86 ? '#e5484d' : '#ffd54a');
    },

    showGameOver(g) {
      const [h, a] = g.teams;
      const userWon = h.score > a.score;   // user is always home (team 0)
      els.goText.innerHTML =
        `<div class="go-result">${userWon ? 'YOU WIN!' : 'YOU LOSE'}</div>` +
        `<div class="go-score">${h.def.abbr} ${h.score} — ${a.score} ${a.def.abbr}</div>` +
        `<div class="go-sub">${(userWon ? h : a).def.name} ${(userWon ? h : a).def.nick} take it ${Math.max(h.score, a.score)}–${Math.min(h.score, a.score)}</div>`;
      els.gameover.classList.remove('hidden');
      els.hud.classList.add('hidden');
    },
  };
  return ui;
}

function setText(el, s) {
  if (el.textContent !== s) el.textContent = s;
}
