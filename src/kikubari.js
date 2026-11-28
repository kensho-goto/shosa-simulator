// お茶の間ラッシュ（かんたん操作の A6）
//  お父さんの昔話が終わるまでの約60秒、気配りがいくつも同時に来る。押すだけでこなす。
//  手が回らないと、物が倒れる・転がる・飛ぶ。被害がつながって「大事件」になる。
//  台詞・家の決まり・被害の金額は、すべてゲームのための架空のもの。
import * as THREE from 'three';
import { makeHole, makeManju, makeTeapot, makeSweets } from './props.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TY = 0.33;                                   // 座卓の高さ
const TB = { x0: -0.75, x1: 0.75, z0: 3.31, z1: 4.21 };
const onTable = (x, z) => x > TB.x0 && x < TB.x1 && z > TB.z0 && z < TB.z1;
const yen = n => '¥' + Math.round(n).toLocaleString('ja-JP');
const rnd = (a, b) => a + Math.random() * (b - a);
const CUPS = ['player', 'partner', 'father', 'mother'];
const TEAPOT_HOME = V3(0.06, TY, 3.66);
const PLATE_MOM = V3(0.26, 0.5, 4.16);
const PLATE_ME = V3(0.02, TY + 0.001, 3.47);
// 全体を見わたすカメラ（主人公の左うしろの上から。右の障子と奥の掛軸も入る）
const BASE = { pos: [-0.95, 1.85, 2.25], look: [0.3, 0.6, 4.0], fov: 52 };

// 被害（ゲーム内の見積もり。架空の金額）
export const PRICE = {
  tableTea: ['座卓のお茶ふき', 2000],
  stain: ['畳のしみ抜き', 12000],
  shoji: ['障子の張り替え', 6000],
  scroll: ['掛軸（お父さんの自慢）', 180000],
  manju: ['おまんじゅう', 400],
  wig: ['お父さんの秘密', 0],
};

// 新しい珍事（sceneA の FINDS に足す）
export const RUSH_FINDS = {
  tableBang: { name: '聞いとるかね', desc: 'あいづちを忘れたら、お父さんが机をたたいた。' },
  partnerKick: { name: '机の下の一撃', desc: '美咲さんに、机の下で蹴られた。湯のみが跳ねた。' },
  manjuRoll: { name: '転がるおまんじゅう', desc: 'お母さんの腕が限界をむかえ、おまんじゅうが旅に出た。' },
  selfPour: { name: 'お父さん、自分で注ぐ', desc: '空の湯のみを放っておいたら、お父さんが自分で注ぎ、ついでに倒した。' },
  overflow: { name: 'なみなみ', desc: '注ぎすぎて、お父さんのひざにお茶が。' },
  coldTea: { name: '淹れなおしましょうか', desc: 'お茶を冷ましたら、お母さんの肘が急須に当たった。' },
  numbDive: { name: '座卓へダイブ', desc: 'しびれが限界をこえ、顔から座卓へ。' },
  shojiHole: { name: '障子に穴', desc: '転がった物が、障子をつきやぶった。' },
  scrollFall: { name: '掛軸、落ちる', desc: '揺れが重なって、床の間の掛軸が落ちた。' },
  wigFly: { name: '秘密が宙を舞う', desc: 'お父さんの頭の上の黒いものが、飛んだ。' },
  wigInCup: { name: '湯のみにカツラ', desc: '飛んだものが、湯のみの上に着地した。' },
  chain: { name: '大事件', desc: '5秒のうちに、事件が3つ重なった。' },
  kikubariOni: { name: '気配りの鬼', desc: 'お茶の間で、ひとつも取りこぼさなかった。' },
};

// お父さんの昔話（架空）。2つめ：あいづち aizuchi ／ 質問 poke（美咲につつかれる）。3つめ：答え
const TALK = [
  ['わしが若いころはな、', 0],
  ['毎朝、会社まで歩いて通ったもんだ。', 'aizuchi'],
  ['片道、二時間だぞ。', 'aizuchi'],
  ['高橋くんは、朝は強いほうかね？', 'poke', 'は、はい！ 朝は得意です！'],
  ['雨の日も、雪の日もな。', 'aizuchi'],
  ['それで、部長に言ってやったんだ。', 0],
  ['「わたしは、歩くのが仕事です」とな。', 'aizuchi'],
  ['……どういう意味か、わかるかね？', 'poke', '……深い、お言葉です！'],
  ['まあ、わしにもわからんのだが。', 'aizuchi'],
  ['美咲が生まれた日もな、', 0],
  ['病院まで歩いた。三時間だ。', 'aizuchi'],
  ['高橋くんは、歩くのは好きかね？', 'poke', 'はい！ 一駅なら歩きます！'],
  ['駅前の坂を知っとるかね。', 'aizuchi'],
  ['あの坂を、毎日だ。', 'aizuchi'],
  ['今の若い者は、すぐ車に乗る。', 'aizuchi'],
  ['高橋くんは、車かね？', 'poke', 'い、いえ、自転車です！'],
  ['……まあ、いいだろう。', 'aizuchi'],
  ['人生は、一歩ずつだ。', 'aizuchi'],
  ['……で、何の話だったかな。', 'poke', '歩く、お話です！'],
  ['そうそう、歩く話だ。', 'aizuchi'],
  ['とにかく、足腰は大事だぞ。', 'aizuchi'],
  ['というわけでな。', 0],
];
const AIZUCHI = ['なるほど！', 'さすがです！', 'へえ〜！', 'すごいですね！', 'はい、はい！', '勉強になります！'];

// 気配りの種類。key はパソコンのキー
const KINDS = {
  aizuchi: { word: 'うなずく', who: 'お父さんの話', life: 2.3, key: '1' },
  poke: { word: 'こたえる', who: '美咲がつつく', life: 2.9, key: '2' },
  sweets: { word: 'うけとる', who: 'お菓子', life: 4.2, key: '3' },
  pour: { word: '注ぐ', who: '湯のみが空', life: 6.0, key: '4', hold: true },
  sip: { word: '飲む', who: 'お茶が冷める', life: 8, key: '5', need: 3 },
  numb: { word: '足', who: 'しびれ', life: 0, key: ' ', mash: true },
};
const POUR = { good: [0.55, 1.0], best: [0.72, 0.92], over: 1.06, speed: 0.8 };

// ---------------- 転がる・飛ぶ物 ----------------
class Rolly {
  constructor(obj, r, opt = {}) { this.obj = obj; this.r = r; this.vel = V3(); this.rest = false; this.opt = opt; this.spin = opt.spin || null; this.bumps = 0; }
  step(dt, W) {
    if (this.rest) return;
    const p = this.obj.position, v = this.vel;
    v.y -= 9.8 * dt; p.addScaledVector(v, dt);
    const top = onTable(p.x, p.z) && p.y >= TY + this.r - 0.04;
    const fy = (top ? TY : 0) + this.r;
    let ground = false;
    if (p.y <= fy) {
      if (v.y < -0.9) { this.bumps++; W.land(this, top); }
      p.y = fy; v.y = -v.y * 0.3; if (v.y < 0.35) v.y = 0; ground = true;
      const f = Math.max(0, 1 - (top ? 0.5 : 1.0) * dt); v.x *= f; v.z *= f;
      if (this.spin) this.spin.multiplyScalar(0.8);
    }
    if (p.x > 1.72 - this.r) { p.x = 1.72 - this.r; if (v.x > 0.35) W.shoji(this); v.x = -Math.abs(v.x) * 0.25; }
    if (p.x < -1.72 + this.r) { p.x = -1.72 + this.r; v.x = Math.abs(v.x) * 0.4; }
    if (p.z < 2.05 + this.r) { p.z = 2.05 + this.r; v.z = Math.abs(v.z) * 0.4; }
    if (p.z > 5.45 - this.r) { p.z = 5.45 - this.r; v.z = -Math.abs(v.z) * 0.4; }
    const sp = Math.hypot(v.x, v.z);
    if (this.spin) { this.obj.rotation.x += this.spin.x * dt; this.obj.rotation.y += this.spin.y * dt; this.obj.rotation.z += this.spin.z * dt; }
    else if (sp > 0.01) this.obj.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(V3(v.z, 0, -v.x).normalize(), sp * dt / this.r));
    if (ground && sp < 0.04 && v.y === 0) { this.rest = true; W.rest && W.rest(this); }
  }
}

// ---------------- 部屋をもとに戻す（場面の始め・やり直し） ----------------
export function resetChaos(ctx) {
  const K = ctx.props._k; if (!K) return;
  const scene = ctx.R.scene;
  for (const k of CUPS) { const c = ctx.props['cup_' + k]; if (c.obj.parent !== scene) scene.attach(c.obj); }
  for (const o of K.trash) o.parent && o.parent.remove(o);
  K.trash = [];
  K.teapot.visible = false; K.teapot.position.copy(TEAPOT_HOME); K.teapot.rotation.set(0, 0, 0); K.teapot.userData.tipped = false;
  K.sweets.visible = false;
  const fc = ctx.actors.father.cartoon;
  if (fc && fc.wig && fc.wig.parent !== fc.G) { fc.G.add(fc.wig); fc.wig.position.copy(fc.wigHome.pos); fc.wig.quaternion.copy(fc.wigHome.quat); fc.wig.scale.copy(fc.wigHome.scale); }
  if (K.scroll && K.scroll.obj.parent !== K.scroll.parent) { K.scroll.parent.add(K.scroll.obj); }
  if (K.scroll) { K.scroll.obj.position.copy(K.scroll.pos); K.scroll.obj.quaternion.copy(K.scroll.quat); }
}
function ensureProps(ctx) {
  if (ctx.props._k) return ctx.props._k;
  const scene = ctx.R.scene;
  const teapot = makeTeapot(); scene.add(teapot); ctx.toon(teapot);
  const sweets = makeSweets(); scene.add(sweets); ctx.toon(sweets);
  const so = ctx.house && (ctx.house.getObjectByName ? ctx.house.getObjectByName('kakejiku') : null) || scene.getObjectByName('kakejiku');
  const K = ctx.props._k = { teapot, sweets, trash: [], scroll: so ? { obj: so, parent: so.parent, pos: so.position.clone(), quat: so.quaternion.clone() } : null };
  resetChaos(ctx);
  return K;
}
function fillSweets(ctx, K) {
  for (const m of K.sweets.userData.manju) m.parent && m.parent.remove(m);
  K.sweets.userData.manju = [];
  for (let i = 0; i < 3; i++) { const m = makeManju(); const a = i * Math.PI * 2 / 3; m.position.set(Math.cos(a) * 0.04, 0.014, Math.sin(a) * 0.04); K.sweets.add(m); ctx.toon(m); K.sweets.userData.manju.push(m); }
}

// ================= 本体 =================
export async function rushTea(ctx) {
  const { player, partner, father, mother } = ctx.actors;
  const K = ensureProps(ctx);
  const scene = ctx.R.scene;
  K.teapot.visible = true;
  K.sweets.visible = true; K.sweets.position.set(0.92, 0, 4.5); K.sweets.rotation.set(0, 0, 0); fillSweets(ctx, K);
  const cupOf = k => ctx.props['cup_' + k];
  const setTea = c => { const tea = c.obj.userData.tea; tea.visible = c.level > 0.02; tea.position.y = 0.014 + 0.07 * c.level; tea.scale.setScalar(0.88 + 0.12 * c.level); };
  cupOf('father').level = 0.55; setTea(cupOf('father'));

  const S = {
    t: 0, end: 0, li: 0, nextLine: 3.2, tasks: [], numb: 0.05, handled: 0, missed: 0, damage: 0, bill: {}, priceless: false,
    shake: 0, startle: 0, evT: [], timers: [], rollies: [], busy: null, tipped: {}, scrollDown: false, wigOff: false,
    nextDrink: 6, nextSip: 9, sweetsAt: [15, 36, 50], over: false, chained: 0, plateWith: 'mom',
  };
  ctx.story.rush = S;
  const later = (sec, fn) => S.timers.push({ t: S.t + sec, fn });

  // ---------- 画面（気配りの輪・残り時間・被害額） ----------
  const hudEl = document.getElementById('hud');
  const root = document.createElement('div'); root.id = 'rush';
  root.innerHTML = `<div class="top"><span class="cap">お父さんの昔話</span><div class="bar"><i></i></div></div>
    <div class="total"><small>被害</small><b>¥0</b></div><div class="layer"></div>`;
  hudEl.appendChild(root); document.body.classList.add('rushing');
  const layer = root.querySelector('.layer'), barI = root.querySelector('.bar i'), totalB = root.querySelector('.total b');
  const touch = document.body.classList.contains('touch');
  const C40 = 2 * Math.PI * 40, C30 = 2 * Math.PI * 30;
  ctx.onAbort(() => { root.remove(); document.body.classList.remove('rushing'); });
  const proj = v => { const p = v.clone().project(ctx.R.camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, back: p.z > 1 }; };
  const pop = (text, at, kind = 'dmg') => {
    const e = document.createElement('div'); e.className = 'pop ' + kind; e.textContent = text;
    const s = proj(at); e.style.left = s.x + 'px'; e.style.top = s.y + 'px'; layer.appendChild(e);
    setTimeout(() => e.remove(), 1600);
  };
  const addDamage = (id, at, n = 1) => {
    const [name, price] = PRICE[id];
    S.bill[id] = (S.bill[id] || 0) + n;
    if (id === 'wig') { S.priceless = true; pop('プライスレス', at, 'dmg big'); }
    else { S.damage += price * n; pop(`${name.replace(/（.*）/, '')} ${yen(price * n)}`, at, price >= 100000 ? 'dmg big' : 'dmg'); }
    totalB.textContent = yen(S.damage) + (S.priceless ? '＋？' : '');
    root.querySelector('.total').classList.remove('hit'); void root.offsetWidth; root.querySelector('.total').classList.add('hit');
  };

  // ---------- 気配りの輪 ----------
  const anchors = {
    aizuchi: () => father.headPos().add(V3(0.3, 0.12, 0)),
    poke: () => partner.headPos().add(V3(0.12, 0.22, 0)),
    sweets: () => K.sweets.position.clone().add(V3(0, 0.22, 0)),
    pour: () => cupOf('father').obj.getWorldPosition(V3()).add(V3(-0.16, 0.2, 0)),
    sip: () => cupOf('player').obj.getWorldPosition(V3()).add(V3(-0.2, 0.2, 0)),
    numb: () => player.pos.clone().add(V3(-0.32, 0.18, 0.05)),
  };
  function spawn(kind, extra = {}) {
    if (S.over || S.tasks.some(t => t.kind === kind)) return null;
    const K0 = KINDS[kind];
    const el = document.createElement('div'); el.className = 'task k-' + kind;
    el.innerHTML = `<svg viewBox="0 0 100 100"><circle class="edge" cx="50" cy="50" r="40"/><circle class="track" cx="50" cy="50" r="40"/><circle class="life" cx="50" cy="50" r="40"/>${K0.hold ? `<circle class="fillt" cx="50" cy="50" r="30"/><circle class="gold" cx="50" cy="50" r="30"/><circle class="fill" cx="50" cy="50" r="30"/>` : ''}</svg>
      <b>${K0.word}</b><small>${K0.who}</small>${touch ? '' : `<kbd>${K0.key === ' ' ? 'Space' : K0.key}</kbd>`}${K0.need ? `<i class="dots">${'●'.repeat(K0.need)}</i>` : ''}`;
    layer.appendChild(el);
    const T = { kind, el, life: K0.life, left: K0.life, fill: 0, count: 0, ...extra };
    if (K0.hold) { const g = el.querySelector('.gold'); g.style.strokeDasharray = `${(POUR.best[1] - POUR.best[0]) * C30} ${C30}`; g.style.strokeDashoffset = `${-POUR.best[0] * C30}`; }
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); press(T, e.pointerId); });
    S.tasks.push(T); ctx.sfx.play('tick', 1.4); el.classList.add('in');
    return T;
  }
  function remove(T, how) {
    S.tasks = S.tasks.filter(x => x !== T);
    T.el.classList.add(how === 'ok' ? 'done' : 'miss');
    setTimeout(() => T.el.remove(), 380);
    if (S.busy === T) S.busy = null;
  }
  const upHandler = e => { if (S.busy && S.busy.pid === e.pointerId) release(S.busy); };
  addEventListener('pointerup', upHandler); addEventListener('pointercancel', upHandler);
  ctx.onAbort(() => { removeEventListener('pointerup', upHandler); removeEventListener('pointercancel', upHandler); });

  function press(T, pid = 'key') {
    if (S.over || !S.tasks.includes(T)) return;
    if (S.busy && S.busy !== T && T.kind !== 'numb') return;   // 注いでいる間は、手がふさがっている
    const k = T.kind;
    if (k === 'numb') { mashNumb(); return; }
    if (k === 'pour') { S.busy = T; T.pid = pid; T.el.classList.add('hold'); startPour(); return; }
    if (k === 'sip') { sip(T); return; }
    remove(T, 'ok'); S.handled++; ctx.story.moodAdd(0.6); ctx.sfx.play('good', 0.7);
    if (k === 'aizuchi') { player.gesture('nod', 0.8); ctx.say('player', AIZUCHI[(Math.random() * AIZUCHI.length) | 0], 1.2); father.s.smile = 0.3; }
    if (k === 'poke') { player.gesture('nod', 0.8); ctx.say('player', T.answer || 'はい！', 1.8); partner.s.smile = 0.7; partner.s.worry = 0; father.gesture('nod'); }
    if (k === 'sweets') acceptSweets();
  }
  function release(T) {
    if (T.kind !== 'pour' || S.busy !== T) return;
    S.busy = null; T.el.classList.remove('hold'); stopPour();
    const f = T.fill;
    if (f >= POUR.good[0] && f <= POUR.good[1]) { remove(T, 'ok'); S.handled++; ctx.sfx.play(f >= POUR.best[0] && f <= POUR.best[1] ? 'best' : 'good', 0.8); if (f >= POUR.best[0] && f <= POUR.best[1]) pop('ちょうど', anchors.pour(), 'ok'); father.gesture('nod'); ctx.say('father', 'お、すまんね。', 1.0); ctx.story.moodAdd(1); }
    else if (f < POUR.good[0]) { pop('少なすぎ', anchors.pour(), 'ok'); }   // まだ足りない。もう一度押せる
  }

  // ---------- それぞれの所作 ----------
  let pourT = 0;
  function startPour() { player.reach('R', K.teapot.position, 1); ctx.sfx.play('rustle', 0.4); pourT = 0; }
  function stopPour() { player.reach('R', null); }
  function sip(T) {
    if (T.cool) return;
    T.count++; T.cool = 0.32; ctx.sfx.play('clink', 0.5);
    const c = cupOf('player'); c.level = Math.max(0.1, c.level - 0.12); setTea(c);
    player.reach('R', c.obj.position, 1); later(0.3, () => player.reach('R', null));
    const d = T.el.querySelector('.dots'); if (d) d.textContent = '○'.repeat(T.count) + '●'.repeat(KINDS.sip.need - T.count);
    if (T.count >= KINDS.sip.need) { remove(T, 'ok'); S.handled++; ctx.sfx.play('good', 0.7); mother.s.smile = 0.6; ctx.say('mother', 'お口に合ってよかったわ。', 1.4); }
  }
  function mashNumb() {
    S.numb = Math.max(0, S.numb - 0.075); player.s.wobble = 0.6; ctx.sfx.play('rustle', 0.35);
    later(0.15, () => { player.s.wobble = 0; });
  }
  function acceptSweets() {
    player.reach('L', K.sweets.position, 1); player.reach('R', K.sweets.position, 1);
    const a = K.sweets.position.clone();
    S.plateWith = 'me';
    ctx.say('player', 'ありがとうございます、いただきます。', 1.6); mother.s.smile = 0.8;
    tweenObj(K.sweets, a, PLATE_ME, 0.5, () => { player.reach('L', null); player.reach('R', null); mother.reach('L', null); mother.reach('R', null); });
  }
  const tweens = [];
  function tweenObj(o, a, b, sec, done) { tweens.push({ o, a: a.clone(), b: b.clone(), t: 0, sec, done }); }

  // ---------- 揺れ・事件 ----------
  function event(id, at) {
    S.evT.push(S.t); S.evT = S.evT.filter(t => S.t - t < 5);
    if (id) ctx.find(id);
    ctx.story.moodAdd(-3); partner.s.worry = 0.8; later(2.5, () => { partner.s.worry = 0; });
    if (S.evT.length >= 3 && S.t - (S.chainAt || -9) > 6) {
      S.chainAt = S.t; S.chained++;
      later(0.5, () => { ctx.hud.stamp('大事件', 'bad'); ctx.find('chain'); ctx.slowmo(0.35, 0.9); ctx.sfx.play('bonk', 1); });
    }
  }
  function jolt(s, from) {
    S.shake += s; S.startle += s * 0.55;
    ctx.rig.shake = Math.max(ctx.rig.shake || 0, 0.02 + s * 0.035); ctx.sfx.play('thud', Math.min(1, 0.4 + s * 0.4));
    for (const k of CUPS) {
      if (S.tipped[k]) continue;
      const c = cupOf(k), p = c.obj.position;
      const d = from ? Math.hypot(p.x - from.x, p.z - from.z) : 0.5;
      const power = s * (1.2 - Math.min(0.8, d)) * rnd(0.7, 1.3);
      if (power > 0.72) tipCup(k, from);
      else c.hop = Math.min(0.05, 0.02 + power * 0.03);
    }
    if (!K.teapot.userData.tipped && s * rnd(0.6, 1.2) > 1.15) tipTeapot();
    if (S.shake > 3.6 && !S.scrollDown) later(0.5, scrollFall);
    if (S.startle >= 2.0 && !S.wigOff) later(0.25, wigFly);
  }
  function tipCup(k, from) {
    S.tipped[k] = true;
    const c = cupOf(k);
    const wp = c.obj.getWorldPosition(V3());
    if (c.level > 0.05) { const st = ctx.addStain(wp.x, TY + 0.002, wp.z); st.scale.setScalar(0.07 + c.level * 0.06); addDamage('tableTea', wp); c.level = 0; setTea(c); ctx.sfx.play('spill', 0.8); }
    const pivot = new THREE.Group(); pivot.position.set(wp.x, TY + 0.037, wp.z); scene.add(pivot); K.trash.push(pivot);
    pivot.attach(c.obj); c.obj.position.set(0, -0.044, 0); c.obj.rotation.set(Math.PI / 2, 0, 0);
    const dir = from ? V3(wp.x - from.x, 0, wp.z - from.z) : V3(1, 0, 0);
    if (dir.lengthSq() < 1e-4) dir.set(1, 0, 0);
    dir.normalize(); dir.x += 0.9; dir.normalize();        // どうしても障子のほうへ転がる
    const R = new Rolly(pivot, 0.037, { kind: 'cup', who: k });
    R.vel.copy(dir.multiplyScalar(rnd(1.6, 2.4))); R.vel.y = rnd(0.6, 1.2);
    S.rollies.push(R); ctx.sfx.play('clink', 1);
  }
  function tipTeapot() {
    const tp = K.teapot; tp.userData.tipped = true;
    tweenRot(tp, 'z', 0, -Math.PI / 2 * 0.95, 0.25);
    const at = tp.position.clone(); later(0.25, () => { const st = ctx.addStain(at.x + 0.08, TY + 0.002, at.z); st.scale.setScalar(0.13); addDamage('tableTea', at); ctx.sfx.play('spill', 1); });
  }
  const rots = [];
  function tweenRot(o, ax, a, b, sec, done) { rots.push({ o, ax, a, b, t: 0, sec, done }); }

  const W = {
    land(R, top) {
      const p = R.obj.position;
      if (R.opt.kind === 'cup' && !top && !R.stained) { R.stained = true; ctx.sfx.play('thud', 0.6); }
      if (R.opt.kind === 'manju' && !top && !R.counted) { R.counted = true; }
      if (R.opt.kind === 'wig') ctx.sfx.play('thud', 0.4);
    },
    shoji(R) {
      const p = R.obj.position;
      if (R.holes >= 1 || S.holes >= 7) return; R.holes = (R.holes || 0) + 1; S.holes = (S.holes || 0) + 1;
      const h = makeHole(); h.position.set(1.748, Math.max(0.1, Math.min(1.6, p.y + 0.04)), p.z); h.rotation.y = -Math.PI / 2; h.scale.setScalar(rnd(0.7, 1.1));
      scene.add(h); K.trash.push(h);
      ctx.sfx.play('whoosh', 1); ctx.sfx.play('spill', 0.5);
      addDamage('shoji', h.position); event('shojiHole', h.position);
      if (S.t - (S.lastShojiCam ?? -9) > 4) { S.lastShojiCam = S.t; focus([-0.3, 1.15, Math.max(2.3, p.z - 1.3)], [1.7, 0.35, p.z + 0.2], 1.0); }
    },
    rest(R) {
      if (R.opt.kind === 'wig') {
        // 湯のみの上に着地？
        for (const k of CUPS) {
          if (S.tipped[k]) continue;
          const c = cupOf(k).obj.position;
          if (Math.hypot(R.obj.position.x - c.x, R.obj.position.z - c.z) < 0.12 && R.obj.position.y > 0.2) { R.obj.position.set(c.x, TY + 0.1, c.z); ctx.find('wigInCup'); break; }
        }
      }
    },
  };
  function scrollFall() {
    if (S.scrollDown || !K.scroll) return; S.scrollDown = true;
    const o = K.scroll.obj, base = K.scroll.pos;
    const pivot = new THREE.Group(); pivot.position.set(base.x, 0.11, base.z - 0.02); o.parent.add(pivot); K.trash.push(pivot);
    ctx.sfx.play('whoosh', 0.8);
    let t = 0;
    const startY = base.y;
    // すべり落ちる → 手前へ倒れる
    S.custom.push(dt => {
      t += dt;
      if (t < 0.35) { o.position.y = startY - (startY - 0.735) * (t / 0.35) ** 2; return false; }
      if (!pivot.children.length) { pivot.attach(o); ctx.sfx.play('thud', 0.9); }
      const u = Math.min(1, (t - 0.35) / 0.55);
      pivot.rotation.x = -u * u * 1.35;
      if (u >= 1) { ctx.sfx.play('thud', 1); ctx.rig.shake = 0.04; return true; }
      return false;
    });
    addDamage('scroll', V3(base.x, 1.0, base.z - 0.3)); event('scrollFall');
    father.gesture('flinch', 1.2); mother.gesture('flinch', 1.2);
    later(0.9, () => ctx.say('father', 'わしの、掛軸が……！', 1.8));
    focus([0.75, 1.25, 4.35], [-0.88, 0.75, 5.95], 1.6);
    S.startle += 0.6; if (S.startle >= 2.0 && !S.wigOff) later(0.9, wigFly);
  }
  function wigFly() {
    const fc = father.cartoon; if (S.wigOff || !fc || !fc.wig) return; S.wigOff = true;
    const w = fc.wig; scene.attach(w);
    const R = new Rolly(w, 0.03, { kind: 'wig', spin: V3(rnd(-8, 8), rnd(-10, 10), rnd(-8, 8)) });
    R.vel.set(rnd(-0.4, 0.5), 2.7, rnd(-1.3, -0.8));
    S.rollies.push(R);
    ctx.sfx.play('boing', 1); ctx.slowmo(0.3, 1.1);
    addDamage('wig', father.headPos()); event('wigFly');
    focus([0.3, 1.25, 3.25], [-0.36, 1.0, 4.55], 2.2);
    father.reach('L', father.headPos().add(V3(0.05, 0.05, 0)), 1); father.reach('R', father.headPos().add(V3(-0.05, 0.05, 0)), 1); father.s.worry = 1;
    mother.s.worry = 0.6; mother.lookAt(father);
    later(1.4, () => ctx.say('father', '…………。', 1.2));
    later(2.8, () => { ctx.say('father', '……今日は、風が強いな。', 2.0); father.reach('L', null); father.reach('R', null); });
    later(5, () => { father.s.worry = 0.3; mother.lookAt(player); });
  }
  // 遊んでいる間はカメラを動かさない（輪の位置が変わると押せなくなるため）。揺れだけで見せる
  let focusGen = 0;
  function focus() { ctx.rig.shake = Math.max(ctx.rig.shake || 0, 0.03); }

  // ---------- 取りこぼしたとき ----------
  function miss(T) {
    remove(T, 'miss'); S.missed++; ctx.sfx.play('awk', 0.6); ctx.story.moodAdd(-2);
    const k = T.kind;
    if (k === 'aizuchi') {
      father.s.smile = 0; father.s.worry = 0.5;
      ctx.say('father', '……聞いとるかね？', 1.4);
      father.reach('R', V3(-0.3, TY + 0.02, 3.98), 1);
      later(0.35, () => { jolt(0.6, V3(-0.3, 0, 3.98)); event('tableBang', V3(-0.3, TY, 3.98)); father.reach('R', null); father.s.worry = 0; });
    }
    if (k === 'poke') {
      partner.s.worry = 1; ctx.say('partner', '（ちょっと……！）', 1.0);
      later(0.5, () => { jolt(0.85, V3(0.42, 0, 3.35)); event('partnerKick', V3(0.42, TY, 3.35)); ctx.sfx.play('bonk', 0.7); ctx.say('partner', 'あ、えっと、悠真さんは……そうなんです！', 1.6); });
    }
    if (k === 'sweets') {
      mother.s.worry = 0.7; ctx.say('mother', 'あら、あらら……', 1.2);
      // 腕がぷるぷる → 皿が傾く → おまんじゅうが旅に出る
      let t = 0;
      S.custom.push(dt => {
        t += dt; K.sweets.position.y = PLATE_MOM.y + Math.sin(t * 40) * 0.006; K.sweets.rotation.z = -t * 0.9;
        if (t < 0.7) return false;
        for (const m of K.sweets.userData.manju) {
          scene.attach(m);
          const R = new Rolly(m, 0.016, { kind: 'manju' }); R.vel.set(rnd(0.6, 2.2), rnd(0.3, 1.0), rnd(-1.4, 0.6)); S.rollies.push(R); K.trash.push(m);
          addDamage('manju', m.position);
        }
        K.sweets.userData.manju = [];
        event('manjuRoll', K.sweets.position);
        later(0.6, () => { K.sweets.rotation.z = 0; mother.reach('L', null); mother.reach('R', null); tweenObj(K.sweets, K.sweets.position, V3(0.92, 0, 4.5), 0.6); S.plateWith = 'side'; mother.s.worry = 0; });
        return true;
      });
    }
    if (k === 'pour') {
      ctx.say('father', '……自分でやるか。', 1.4);
      father.reach('R', K.teapot.position, 1);
      const home = K.teapot.position.clone();
      later(0.6, () => tweenObj(K.teapot, home, cupOf('father').obj.position.clone().add(V3(0.1, 0.16, -0.02)), 0.5));
      later(1.4, () => { const c = cupOf('father'); c.level = 0.8; setTea(c); });
      later(1.9, () => {
        // もどす途中で、袖があなたの湯のみに当たる
        tweenObj(K.teapot, K.teapot.position, home, 0.4, () => { father.reach('R', null); });
        later(0.3, () => { if (!S.tipped.player) { tipCup('player', V3(-0.2, 0, 3.9)); event('selfPour', cupOf('player').obj.getWorldPosition(V3())); ctx.sfx.play('bonk', 0.5); } });
      });
    }
    if (k === 'sip') {
      ctx.say('mother', 'あら、冷めちゃったわね。淹れなおすわ。', 1.8);
      mother.reach('R', K.teapot.position, 1);
      later(0.7, () => { mother.reach('R', null); if (!K.teapot.userData.tipped) { tipTeapot(); event('coldTea', K.teapot.position); jolt(0.3, K.teapot.position); } });
    }
  }
  function numbMax() {
    S.numb = 0.35; S.missed++;
    const T = S.tasks.find(t => t.kind === 'numb'); if (T) remove(T, 'miss');
    ctx.say('player', 'あっ、足が……！', 1.2);
    let t = 0;
    S.custom.push(dt => {
      t += dt;
      player.s.bow = Math.min(80, t * 260);
      if (t > 0.3 && !S._dove) { S._dove = true; ctx.sfx.play('bonk', 1); jolt(1.35, V3(-0.36, 0, 3.4)); event('numbDive', V3(-0.36, TY, 3.4)); ctx.slowmo(0.35, 0.8); focus([-1.2, 1.0, 3.1], [-0.2, 0.4, 3.6], 1.4); }
      if (t > 1.6) { player.s.bow = Math.max(0, 80 - (t - 1.6) * 120); }
      if (t > 2.3) { player.s.bow = 0; S._dove = false; return true; }
      return false;
    });
  }
  S.custom = [];

  // ---------- 進行 ----------
  ctx.shot(BASE.pos, BASE.look, { fov: BASE.fov, cut: true });
  father.lookAt(player); mother.lookAt(player); partner.lookAt(father);
  ctx.hud.keys([]);
  ctx.objective('お父さんの昔話が終わるまで、<em>気配り</em>しつづける<br><small>' + (touch ? '出てきた輪を押す。「注ぐ」は押しっぱなしで、金色ではなす' : '出てきた輪をクリック（数字キーでも）。「注ぐ」は押しっぱなしで金色ではなす。足は Space 連打') + '</small>');
  await ctx.talk('mother', 'さあさあ、楽になさって。', 1.6);
  ctx.say('father', 'まあ、ゆっくりしていきなさい。', 1.6);
  await ctx.wait(1.2);
  ctx.objective('');

  const keyFor = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [v.key, k]));
  const DUR = 62;
  await ctx.until(dt => {
    S.t += dt;
    // 予定の処理
    const due = S.timers.filter(x => x.t <= S.t); S.timers = S.timers.filter(x => x.t > S.t); for (const x of due) x.fn();
    S.custom = S.custom.filter(f => !f(dt));
    for (const tw of tweens.slice()) { tw.t += dt; const u = Math.min(1, tw.t / tw.sec); const e = u * u * (3 - 2 * u); tw.o.position.lerpVectors(tw.a, tw.b, e); if (u >= 1) { tweens.splice(tweens.indexOf(tw), 1); tw.done && tw.done(); } }
    for (const r of rots.slice()) { r.t += dt; const u = Math.min(1, r.t / r.sec); r.o.rotation[r.ax] = r.a + (r.b - r.a) * u; if (u >= 1) { rots.splice(rots.indexOf(r), 1); r.done && r.done(); } }
    for (const R of S.rollies) R.step(dt, W);
    for (const k of CUPS) { const c = cupOf(k); if (c.hop) { c.obj.position.y = TY + 0.012 + c.hop * Math.abs(Math.sin(S.t * 30)); c.hop *= Math.pow(0.02, dt); if (c.hop < 0.002) { c.hop = 0; if (!S.tipped[k]) c.obj.position.y = TY + 0.012; } } }
    if (S.over) return true;

    // 昔話
    if (S.t >= S.nextLine && S.li < TALK.length) {
      const [text, kind, ans] = TALK[S.li++];
      const last = S.li === TALK.length;
      ctx.say('father', text, 2.4);
      if (kind === 'aizuchi') later(0.9, () => spawn('aizuchi'));
      if (kind === 'poke') later(0.7, () => { const T = spawn('poke', { answer: ans }); if (T) { partner.lookAt(player); partner.gesture('tilt', 0.8); ctx.sfx.play('whoosh', 0.4); } });
      S.nextLine = S.t + Math.max(2.0, 3.1 - S.t * 0.022);
      if (last) S.end = S.t + 2.6;
    }
    // お父さんが飲む → 空になる
    if (S.t >= S.nextDrink && !S.tasks.some(t => t.kind === 'pour')) {
      S.nextDrink = S.t + rnd(7, 10);
      const c = cupOf('father');
      if (!S.tipped.father) {
        father.reach('R', c.obj.position, 0.8); later(0.8, () => { father.reach('R', null); c.level = Math.max(0, c.level - 0.45); setTea(c); if (c.level < 0.12) spawn('pour'); });
      }
    }
    // お茶が冷める
    if (S.t >= S.nextSip) { S.nextSip = S.t + rnd(15, 19); if (!S.tipped.player) spawn('sip'); }
    // お菓子
    if (S.sweetsAt.length && S.t >= S.sweetsAt[0]) {
      S.sweetsAt.shift();
      if (!S.tasks.some(t => t.kind === 'sweets')) {
        if (!K.sweets.userData.manju.length) fillSweets(ctx, K);
        K.sweets.rotation.set(0, 0, 0);
        tweenObj(K.sweets, K.sweets.position, PLATE_MOM, 0.6, () => { mother.reach('L', K.sweets.position, 1); mother.reach('R', K.sweets.position, 1); });
        S.plateWith = 'mom';
        ctx.say('mother', 'お菓子もどうぞ。', 1.4);
        later(0.4, () => spawn('sweets'));
      }
    }
    // しびれ（だんだん早く）
    S.numb += dt * (0.015 + S.t * 0.00035);
    let nT = S.tasks.find(t => t.kind === 'numb');
    if (!nT && S.numb > 0.42) nT = spawn('numb');
    if (nT && S.numb < 0.2) { remove(nT, 'ok'); S.handled++; }
    if (S.numb >= 1) numbMax();

    // 輪の時間と位置
    const holdK = ctx.input;
    for (const [key, kind] of Object.entries(keyFor)) {
      const T = S.tasks.find(t => t.kind === kind); if (!T) continue;
      if (holdK.hit(key)) press(T);
      if (kind === 'pour' && holdK.up(key) && S.busy === T && T.pid === 'key') release(T);
    }
    for (const T of S.tasks.slice()) {
      const a = anchors[T.kind](); const s = proj(a);
      const cx = Math.min(innerWidth - 64, Math.max(64, s.x)), cy = Math.min(innerHeight - 70, Math.max(84, s.y));   // 画面の外に出さない
      T.el.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
      if (T.cool) T.cool = Math.max(0, T.cool - dt);
      let frac;
      if (T.kind === 'numb') frac = Math.min(1, S.numb);
      else {
        if (S.busy !== T) T.left -= dt;
        frac = Math.max(0, T.left / T.life);
      }
      const life = T.el.querySelector('.life');
      life.style.strokeDasharray = `${frac * C40} ${C40}`;
      const danger = T.kind === 'numb' ? frac > 0.75 : frac < 0.3;
      T.el.classList.toggle('danger', danger);
      if (T.kind === 'pour' && S.busy === T) {
        T.fill += dt * POUR.speed; pourT += dt;
        const c = cupOf('father'); c.level = Math.min(0.95, 0.1 + T.fill * 0.75); setTea(c);
        const tp = K.teapot, cp = c.obj.position;
        tp.position.lerp(V3(cp.x + 0.12, TY + 0.16, cp.z - 0.03), Math.min(1, dt * 10)); tp.rotation.z = Math.min(1.0, pourT * 3) * 0.75;
        if (pourT > 0.15 && ((pourT * 10) | 0) % 3 === 0) ctx.sfx.play('spill', 0.12);
        T.el.querySelector('.fill').style.strokeDasharray = `${Math.min(1, T.fill) * C30} ${C30}`;
        if (T.fill >= POUR.over) {
          // 注ぎすぎ → お父さんのひざへ
          S.busy = null; stopPour(); remove(T, 'miss'); S.missed++;
          const at = cp.clone(); const st = ctx.addStain(at.x, 0.003, 4.4); st.scale.setScalar(0.14);
          addDamage('stain', V3(at.x, 0.3, 4.4)); event('overflow', at);
          father.s.worry = 1; father.gesture('flinch', 1.4); ctx.say('father', 'あちちちっ！', 1.4); ctx.sfx.play('spill', 1);
          let jt = 0; S.custom.push(d2 => { jt += d2; father.pos.y = 0.07 + Math.max(0, Math.sin(Math.min(1, jt / 0.6) * Math.PI)) * 0.22; return jt > 0.6; });
          S.startle += 1.1; jolt(0.5, at);
        }
      } else if (T.kind !== 'pour' || S.busy !== T) {
        if (T.kind === 'pour' && T.fill > 0) T.el.querySelector('.fill').style.strokeDasharray = `${Math.min(1, T.fill) * C30} ${C30}`;
      }
      if (T.kind !== 'numb' && T.left <= 0 && S.busy !== T) miss(T);
    }
    // 急須が家に帰る
    if (!S.busy && !K.teapot.userData.tipped && !tweens.some(tw => tw.o === K.teapot)) { K.teapot.position.lerp(TEAPOT_HOME, Math.min(1, dt * 6)); K.teapot.rotation.z *= Math.pow(0.001, dt); }
    // 残り時間
    const total = S.end || DUR;
    barI.style.width = `${Math.max(0, 1 - S.t / total) * 100}%`;
    if (S.end && S.t >= S.end) { S.over = true; }
    if (S.t > DUR + 8) S.over = true;
    return false;
  });

  // ---------- 終わり：被害の明細 ----------
  for (const T of S.tasks.slice()) remove(T, 'ok');
  S.busy = null; stopPour(); focusGen++;
  ctx.shot(BASE.pos, BASE.look, { fov: BASE.fov, speed: 2.5 });
  for (let i = 0; i < 90 && S.rollies.some(R => !R.rest); i++) { await ctx.wait(1 / 30); for (const R of S.rollies) R.step(1 / 30, W); }
  ctx.say('father', '……いやあ、話しすぎたな。', 1.8);
  if (S.missed === 0) ctx.find('kikubariOni');
  const rank = S.damage === 0 && !S.priceless ? (S.missed <= 1 ? '気配りの鬼' : 'なごやかなお茶') : S.damage < 20000 && !S.priceless ? 'ちょっとした粗相' : S.damage < 150000 ? 'ちょっとした事件' : '伝説の大事件';
  const lines = Object.entries(S.bill).filter(([id]) => id !== 'wig').map(([id, n]) => `<li><span>${PRICE[id][0]}${n > 1 ? ` ×${n}` : ''}</span><b>${yen(PRICE[id][1] * n)}</b></li>`).join('');
  const sum = document.createElement('div'); sum.className = 'sum';
  sum.innerHTML = `<h3>${rank}</h3><p class="kk">気配り <b>${S.handled}</b> ／ ${S.handled + S.missed}</p>
    <ul>${lines || '<li class="none"><span>被害なし</span></li>'}${S.priceless ? '<li class="pl"><span>お父さんの秘密</span><b>プライスレス</b></li>' : ''}</ul>
    <p class="tt">被害総額 <b>${yen(S.damage)}${S.priceless ? '＋？' : ''}</b></p><p class="next">押すと、つづきへ</p>`;
  root.appendChild(sum); root.classList.add('ending');
  ctx.sfx.play(S.damage > 100000 || S.priceless ? 'bonk' : 'chime', 0.9);
  ctx.hud.stamp(rank, S.damage > 20000 || S.priceless ? 'funny' : 'best');
  let wt = 0, clicked = false;
  const onClick = () => { clicked = true; };
  sum.addEventListener('pointerdown', onClick); root.addEventListener('pointerdown', onClick);
  await ctx.until(dt => { wt += dt; return (wt > 1.2 && (ctx.input.actHit || clicked || ctx.input.hit('enter'))) || wt > 9; });
  root.remove(); document.body.classList.remove('rushing');
  ctx.shot([-1.05, 1.35, 2.15], [-0.15, 0.62, 3.9], { fov: 44 });
  // 点
  const kk = (S.handled + S.missed) ? S.handled / (S.handled + S.missed) : 1;
  const dmgK = S.priceless ? 0.4 : Math.max(0, 1 - S.damage / 200000);
  ctx.story.setTech('A6', 0.75 * kk + 0.25 * dmgK);
  ctx.story.addCare('A6', S.handled * 0.12 - S.missed * 0.2, 'rush');
  if (kk > 0.85) ctx.sfx.play('good');
  return S;
}
