// スマホの操作：その場面で使う操作だけを、画面のボタンにして出す。
//  歩く → 左下のスティック ・ お辞儀/座る → 右下の丸いボタン（押している間）
//  回す・傾ける → 小さな丸いボタン ・ 選ぶ → 選択肢をそのまま押す ・ 物を持つ → 画面を指で押さえて動かす
const $ = id => document.getElementById(id);

export const isTouch = () => matchMedia('(pointer: coarse)').matches || /[?&]touch=1/.test(location.search);

// キーの名前 → ボタン
const BTN = {
  act: { key: ' ', hold: true, label: () => '押す', big: true },
  space: { key: ' ', hold: true, label: t => /会釈/.test(t) ? '会釈' : 'お辞儀', big: true },
  f: { key: 'f', hold: true, label: t => /正座/.test(t) ? '正座' : '立つ', big: true },
  W: { key: 'w', tap: true, label: () => '膝で進む', big: true },
  enter: { key: 'enter', tap: true, label: () => 'できた', big: true },
  qe: [{ key: 'q', hold: true, label: () => '⟲', arrow: true }, { key: 'e', hold: true, label: () => '⟳', arrow: true }],
  wheel: [{ key: 'z', hold: true, label: () => '戻す' }, { key: 'x', hold: true, label: () => '傾ける' }],
  zx: [{ key: 'z', hold: true, label: () => '戻す' }, { key: 'x', hold: true, label: () => '傾ける' }],
};
// ボタンにしないもの → 短い案内
const HINT = {
  mouse: '物は指で押さえて動かす',
  'マウス上下': '',
  num: '言葉を押してえらぶ',
  wasd: '',
};

export class Touch {
  constructor(input, { onPause } = {}) {
    this.input = input;
    this.on = isTouch();
    document.body.classList.toggle('touch', this.on);
    this.el = $('touch'); this.btns = $('tbtns'); this.small = $('tsmall'); this.stickEl = $('stick'); this.hint = $('thint');
    $('pauseBtn').addEventListener('click', () => onPause && onPause());
    this.setupStick();
  }
  setupStick() {
    const base = this.stickEl, knob = base.querySelector('i');
    let id = null, cx = 0, cy = 0;
    const R = () => base.clientWidth / 2;
    const move = e => {
      const dx = e.clientX - cx, dy = e.clientY - cy, r = R();
      const d = Math.min(1, Math.hypot(dx, dy) / r), a = Math.atan2(dy, dx);
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      this.input.stick.x = x; this.input.stick.y = -y;
      knob.style.transform = `translate(${x * r * 0.6}px, ${y * r * 0.6}px)`;
    };
    base.addEventListener('pointerdown', e => {
      id = e.pointerId; const b = base.getBoundingClientRect(); cx = b.left + b.width / 2; cy = b.top + b.height / 2;
      base.setPointerCapture(e.pointerId); base.classList.add('on'); move(e); e.preventDefault();
    });
    base.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
    const end = e => { if (e.pointerId !== id) return; id = null; this.input.stick.x = this.input.stick.y = 0; knob.style.transform = ''; base.classList.remove('on'); };
    base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
  }
  // hud.keys と同じ並び [[キー, 説明], ...] を受け取る
  setKeys(list) {
    if (!this.on) return;
    this.release();
    this.btns.innerHTML = ''; this.small.innerHTML = '';
    let stick = false; const hints = [];
    for (const [k, t] of list || []) {
      if (k === 'wasd') { stick = true; continue; }
      const def = BTN[k];
      if (!def) { const h = HINT[k] ?? t; if (h) hints.push(h); continue; }
      for (const d of [].concat(def)) this.addBtn(d, t, Array.isArray(def) ? this.small : this.btns);
    }
    this.stickEl.hidden = !stick;
    this.hint.innerHTML = hints.join('<br>');
  }
  addBtn(d, text, parent) {
    const b = document.createElement('button');
    b.className = 'tb' + (d.big ? ' big' : '') + (d.arrow ? ' arrow' : '');
    b.textContent = d.label(text || '');
    b.dataset.key = d.key;
    const inp = this.input;
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on');
      if (d.tap) inp.vtap(d.key); else inp.vdown(d.key);
    });
    const up = e => { b.classList.remove('on'); if (d.hold) inp.vup(d.key); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
    parent.appendChild(b);
  }
  // ボタンが消えるときに、押しっぱなしを残さない
  release() {
    for (const b of document.querySelectorAll('#touch .tb')) if (b.classList.contains('on')) { this.input.vup(b.dataset.key); }
  }
  show(on) { if (this.el) this.el.classList.toggle('off', !on); }
}
