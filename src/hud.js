// 画面の表示：字幕・目的・キーの案内・メーター・空気・選択肢・発見の知らせ
const $ = id => document.getElementById(id);
const KEYNAME = { act: 'Space / クリック', space: 'Space', mouse: 'マウス左', wasd: 'W A S D', qe: 'Q / E', wheel: 'ホイール', zx: 'Z / X', f: 'F', enter: 'Enter', num: '1〜3', r: 'R', esc: 'Esc' };
export class Hud {
  constructor() {
    this.el = $('hud'); this.sub = $('subtitle'); this.obj = $('objective'); this.keysEl = $('keys');
    this.meterEl = $('meter'); this.moodEl = $('mood'); this.choicesEl = $('choices'); this.toastEl = $('toast'); this.chap = $('chapter');
    this.subTimer = 0; this.toastTimer = 0;
  }
  show(on) { this.el.classList.toggle('off', !on); if (this.touch) this.touch.show(on); }
  chapter(a, b) { this.chap.innerHTML = `${a}<b>${b}</b>`; }
  say(who, text, sec = 3) { this.sub.innerHTML = (who ? `<span class="who">${who}</span>` : '') + text; this.subTimer = sec; }
  aside(text, sec = 2.5) { this.sub.innerHTML = `<span class="aside">${text}</span>`; this.subTimer = sec; }
  clearSay() { this.sub.innerHTML = ''; this.subTimer = 0; }
  objective(html) { this.obj.innerHTML = html || ''; }
  keys(list) { if (this.touch) this.touch.setKeys(list); this.keysEl.innerHTML = (list || []).map(([k, t]) => `<span><kbd>${KEYNAME[k] || k}</kbd> ${t}</span>`).join(''); }
  meter(on, { value = 0, zone = null, cap = '' } = {}) {
    this.meterEl.hidden = !on; if (!on) return;
    const T = this.meterEl.querySelector('.track').clientHeight || 240;
    this.meterEl.querySelector('.needle').style.top = `${(1 - value) * T}px`;
    const z = this.meterEl.querySelector('.zone');
    if (zone) { z.style.display = ''; z.style.top = `${(1 - zone[1]) * T}px`; z.style.height = `${(zone[1] - zone[0]) * T}px`; } else z.style.display = 'none';
    this.meterEl.querySelector('.cap').textContent = cap;
  }
  // 横長のゲージ（かんたん操作）。good・best は 0〜1 の範囲。danger は赤くなるところ
  gauge(on, { value = 0, good = null, best = null, danger = null, cap = '' } = {}) {
    const g = this.gaugeEl || (this.gaugeEl = $('gauge'));
    g.hidden = !on; if (!on) return;
    const put = (el, z) => { if (!z) { el.style.display = 'none'; return; } el.style.display = ''; el.style.left = `${z[0] * 100}%`; el.style.width = `${(z[1] - z[0]) * 100}%`; };
    put(g.querySelector('.good'), good); put(g.querySelector('.best'), best); put(g.querySelector('.danger'), danger);
    g.querySelector('.needle').style.left = `${Math.max(0, Math.min(1, value)) * 100}%`;
    if (cap !== g._cap) { g.querySelector('.cap').textContent = cap; g._cap = cap; }
  }
  // 判定の大きな字（見事・よし・あっ）
  stamp(text, kind = 'good') {
    const s = this.stampEl || (this.stampEl = $('stamp'));
    s.className = ''; void s.offsetWidth;
    const t = String(text).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
    s.innerHTML = `<span class="o">${t}</span><span class="f">${t}</span>`; s.className = 'show ' + kind;
    s.style.fontSize = text.length > 4 ? `clamp(30px, ${Math.min(9, 64 / text.length).toFixed(1)}vw, ${Math.round(Math.min(110, 760 / text.length))}px)` : '';
    clearTimeout(this._st); this._st = setTimeout(() => { s.className = ''; }, 1100);
  }
  mood(v) { this.moodEl.querySelector('i').style.width = `${Math.max(3, v)}%`; this.moodEl.classList.toggle('bad', v < 35); }
  choices(list, { timer = 0 } = {}) {
    if (!list) { this.choicesEl.innerHTML = ''; return; }
    this.choicesEl.innerHTML = list.map((c, i) => `<div class="${c.dim ? 'dim' : ''}" data-i="${i + 1}"><kbd>${i + 1}</kbd>${c.text}</div>`).join('') + (timer ? '<i class="timer"></i>' : '');
    for (const d of this.choicesEl.querySelectorAll('[data-i]')) d.addEventListener('pointerdown', e => { e.preventDefault(); d.classList.add('on'); this.input && this.input.vtap(d.dataset.i); });
  }
  choiceTimer(frac) { const t = this.choicesEl.querySelector('.timer'); if (t) t.style.transform = `scaleX(${Math.max(0, frac)})`; }
  toast(title, text) { this.toastEl.innerHTML = `<small>${title}</small>${text}`; this.toastEl.style.opacity = 1; this.toastTimer = 3.5; }
  update(dt) {
    if (this.subTimer > 0) { this.subTimer -= dt; if (this.subTimer <= 0) this.sub.innerHTML = ''; }
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) this.toastEl.style.opacity = 0; }
  }
}
