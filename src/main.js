// 本体：読み込み → タイトル → 場面を進める → 結果。やり直し・保存・設定。
import * as THREE from 'three';
import { createRenderer, loadEnvironment, CameraRig } from './render.js';
import { buildHouse, GENKAN } from './env.js';
import { loadModels, Actor } from './actor.js';
import { Prop, floorHeight, makeShoe, makeGift, makeBag, makeCup, makeSaucer, makeCloth, makeStain } from './props.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { Sound } from './audio.js';
import { Runner, Story, Abort, grade } from './story.js';
import * as SAVE from './save.js';
import { SCENE, STEPS, FINDS } from './sceneA.js';

const $ = id => document.getElementById(id);
const data = SAVE.load();
const R = createRenderer($('view'), data.settings.quality);
const rig = new CameraRig(R.camera);
const input = new Input($('view'));
const hud = new Hud();
const sfx = new Sound();
const runner = new Runner();
const story = new Story(FINDS);
const NAMES = { father: '父', mother: '母', partner: '美咲', player: 'あなた' };

let house, actors, props = {}, stains = [];
let mode = 'loading', paused = false, curIndex = 0, curToken = null, pending = null;
let hooks = [];

// ---------------- 読み込み ----------------
async function boot() {
  await Promise.all([loadModels(), loadEnvironment(R)]);
  house = buildHouse(R.scene, R.renderer);
  actors = {
    player: new Actor(R.scene, { model: 'Xbot', height: 1.72, name: 'player', look: { body: '#2c3652', joints: '#17181c', rough: 0.55 } }),
    partner: new Actor(R.scene, { model: 'Xbot', height: 1.6, name: 'partner', slim: 0.88, look: { body: '#b9a089', joints: '#6b3a3a', rough: 0.6 } }),
    father: new Actor(R.scene, { model: 'Xbot', height: 1.7, name: 'father', look: { body: '#5b5148', joints: '#26221e', rough: 0.7 } }),
    mother: new Actor(R.scene, { model: 'Xbot', height: 1.56, name: 'mother', slim: 0.9, look: { body: '#7d8a7a', joints: '#3c3a36', rough: 0.7 } }),
  };
  const mk = (k, obj, opt = {}) => { R.scene.add(obj); props[k] = new Prop(obj, { name: k, floor: floorAt, ...opt }); return props[k]; };
  mk('shoeL', makeShoe('#3a2418', 1), { height: 0.09 }); mk('shoeR', makeShoe('#3a2418', -1), { height: 0.09 });
  mk('pshoeL', makeShoe('#7a2f2a', 1)); mk('pshoeR', makeShoe('#7a2f2a', -1));
  props.pshoeL.obj.scale.setScalar(0.86); props.pshoeR.obj.scale.setScalar(0.86);
  mk('gift', makeGift()); mk('bag', makeBag()); mk('cloth', makeCloth());
  for (const k of ['player', 'partner', 'father', 'mother']) { mk('saucer_' + k, makeSaucer()); mk('cup_' + k, makeCup(k === 'father' ? '#5a4a3a' : '#4f6b5a')); props['cup_' + k].level = 0.8; }
  applySettings();
  $('loading').classList.add('hide');
  setupMenus();
  showTitle();
  requestAnimationFrame(loop);
}
function floorAt(x, z) {
  if (Math.abs(x) < 0.75 && z > 3.31 && z < 4.21) return 0.33;
  return floorHeight(x, z);
}

// ---------------- 毎フレーム ----------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!paused) {
    runner.tick(dt);
    for (const h of hooks.slice()) h.fn(dt);
    if (actors) for (const a of Object.values(actors)) a.update(dt);
    if (mode === 'title') titleCam(dt);
  }
  rig.update(paused ? 0 : dt);
  hud.update(dt);
  if (input.hit('escape') && mode === 'play') togglePause();
  if (input.hit('r') && mode === 'play' && !paused) retryStep();
  input.endFrame();
  R.render();
  window.__shosa.fps = 0.95 * (window.__shosa.fps || 60) + 0.05 / Math.max(dt, 1e-3);
  requestAnimationFrame(loop);
}
let tt = 0;
function titleCam(dt) {
  tt += dt;
  rig.goalPos.set(1.42 + Math.sin(tt * 0.08) * 0.12, 1.12, 2.12); rig.goalLook.set(-0.35, 0.62, 4.1); rig.speed = 0.6;
}

// ---------------- ステップの道具箱（ctx） ----------------
function makeCtx(token, step) {
  const local = [];
  const ctx = {
    token, step, R, rig, hud, input, sfx, story, actors, props, house,
    get assist() { return data.settings.assist === '1'; },
    until: cond => runner.until(token, cond),
    wait: sec => { let t = 0; return runner.until(token, dt => (t += dt) >= sec); },
    every(fn) { const h = { fn }; hooks.push(h); local.push(h); return () => { hooks = hooks.filter(x => x !== h); }; },
    onAbort(fn) { ctx._abortFns = (ctx._abortFns || []); ctx._abortFns.push(fn); },
    place(a, x, y, z, yaw, seated) { a.pos.set(x, y, z); a.yaw = yaw; a.s.seated = a.s.seatedTarget = seated; a.s.bow = 0; a.s.lean = 0; a.s.speed = 0; a.s.wobble = 0; a.reach('L', null); a.reach('R', null); a.s.reachW.L = a.s.reachW.R = 0; a.lookAt(null, 0); },
    shot: (pos, look, opt) => rig.shot(pos, look, opt),
    say(who, text, sec = 2.4) { hud.say(NAMES[who] || who, text, sec + 0.3); talkLook(who); },
    aside(text, sec = 2.2) { hud.aside(text, sec); },
    _talkGen: 0,
    async talk(who, text, sec = 2.4) {
      const g = ++ctx._talkGen; ctx.talking = who;
      ctx.say(who, text, sec);
      let t = 0;
      await runner.until(token, dt => (t += dt) >= sec || ctx._talkGen !== g);
      if (ctx._talkGen === g) ctx.talking = null;
    },
    cutTalk() { ctx._talkGen++; ctx.talking = null; hud.clearSay(); },
    objective: html => hud.objective(html),
    tween(sec, fn) { let t = 0; return runner.until(token, dt => { t += dt; fn(Math.min(1, t / sec)); return t >= sec; }); },
    fade(sec) { const el = fadeEl(); el.style.transition = `opacity ${Math.abs(sec)}s`; el.style.opacity = sec > 0 ? 1 : 0; return ctx.wait(Math.abs(sec)); },
    marker(x, z) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.19, 40), new THREE.MeshBasicMaterial({ color: '#ffe0a0', transparent: true, opacity: 0.35, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.004, z); R.scene.add(m);
      const stop = ctx.every(dt => { m.material.opacity = 0.22 + 0.12 * Math.sin(performance.now() / 300); });
      return { remove() { stop(); R.scene.remove(m); } };
    },
    walkTo(a, x, z, speed = 0.7, delay = 0) {
      let t = 0;
      return runner.until(token, dt => {
        t += dt; if (t < delay) return false;
        const d = new THREE.Vector3(x - a.pos.x, 0, z - a.pos.z); const L = d.length();
        if (L < 0.03) { a.s.speed = 0; a.yaw = 0; return true; }
        d.normalize(); a.yaw = Math.atan2(d.x, d.z);
        const s = Math.min(L, speed * dt); a.pos.addScaledVector(d, s); a.s.speed = speed; return false;
      });
    },
    find(id) {
      const f = story.find(id);
      if (f) { hud.toast(data.finds[id] ? '珍事' : '珍事を発見', f.name); data.finds[id] = (data.finds[id] || 0) + 1; SAVE.save(data); sfx.play('awk', 0.5); }
    },
    addStain(x, y, z) { const m = makeStain(); m.position.set(x, y, z); R.scene.add(m); stains.push(m); return m; },
    removeStain(m) { if (!m) return; R.scene.remove(m); stains = stains.filter(s => s !== m); },
    clearStains() { for (const s of stains) R.scene.remove(s); stains = []; },
    hideCups(h) { for (const k of ['player', 'partner', 'father', 'mother']) { props['cup_' + k].obj.visible = !h; props['saucer_' + k].obj.visible = !h; } },
  };
  ctx.cleanup = () => { for (const h of local) hooks = hooks.filter(x => x !== h); (ctx._abortFns || []).forEach(f => { try { f(new Abort()); } catch (e) { /* */ } }); };
  return ctx;
}
function talkLook(who) {
  const a = actors[who]; if (!a) return;
  for (const [k, b] of Object.entries(actors)) if (k !== who && k !== 'player' && b.s.lookW > 0) b.lookAt(a);
}
function fadeEl() {
  let el = $('fade');
  if (!el) { el = document.createElement('div'); el.id = 'fade'; Object.assign(el.style, { position: 'fixed', inset: 0, background: '#000', opacity: 0, pointerEvents: 'none', zIndex: 5 }); document.body.appendChild(el); }
  return el;
}

// ---------------- 進行 ----------------
async function playFrom(index) {
  mode = 'play'; paused = false; showScreen(null); hud.show(true);
  fadeEl().style.opacity = 0;
  if (index === 0) story.reset();
  sfx.ensure();
  let i = index;
  while (i < SCENE.steps.length) {
    const st = SCENE.steps[i]; curIndex = i;
    data.progress[SCENE.id] = Math.max(data.progress[SCENE.id] || 0, i); SAVE.save(data);
    resetStep(st.id);
    const token = { alive: true }; curToken = token;
    const ctx = makeCtx(token, st.id); window.__shosa.ctx = ctx;
    hud.chapter(`${SCENE.chapter}　${SCENE.title}`, st.title);
    hud.objective(''); hud.keys([]); hud.choices(null); hud.meter(false); hud.clearSay();
    try {
      STEPS[st.id].setup(ctx);
      await STEPS[st.id].run(ctx);
      story.done[st.id] = true;
      i++;
    } catch (e) {
      if (!(e instanceof Abort)) { console.error(e); hud.aside('（うまく動かなかったので、このところをやり直します）', 3); i = curIndex; await new Promise(r => setTimeout(r, 1200)); }
      else if (pending === 'quit') { pending = null; ctx.cleanup(); return; }
      else if (pending === 'retry') { pending = null; }
    } finally { token.alive = false; ctx.cleanup(); }
    hud.mood(story.mood);
  }
  data.progress[SCENE.id] = SCENE.steps.length; SAVE.save(data);
  showResult();
}
function resetStep(id) { delete story.tech[id]; delete story.care[id]; delete story.done[id]; }
function retryStep() { if (!curToken) return; pending = 'retry'; paused = false; showScreen(null); curToken.alive = false; runner.tick(0); }
function quitToTitle() { if (curToken) { pending = 'quit'; curToken.alive = false; runner.tick(0); } showTitle(); }
function togglePause() { paused = !paused; showScreen(paused ? 'pause' : null); }

// ---------------- 結果 ----------------
function showResult() {
  mode = 'result'; hud.show(false);
  { const f = fadeEl(); f.style.transition = 'opacity 1.2s'; f.style.opacity = 0; }
  const ids = SCENE.steps.map(s => s.id);
  const s = story.summary(ids);
  if (s.tech >= 90 && s.care >= 75 && s.complete) { const f = story.find('perfect'); if (f) { data.finds.perfect = (data.finds.perfect || 0) + 1; } }
  const total = Object.keys(FINDS).length;
  const have = Object.keys(data.finds).length;
  const weak = ids.filter(i => story.tech[i] != null && story.tech[i] < 0.6).map(i => SCENE.steps.find(x => x.id === i).title);
  $('resTitle').textContent = s.complete ? 'ご挨拶、成立。' : 'ご挨拶は、まだ途中。';
  $('resGrid').innerHTML = [
    ['用事の成立', s.complete ? '成立' : '未成立', s.complete ? '最後まで、場を成り立たせた。' : ''],
    ['所作', `${grade(s.tech)}<small style="font-size:18px;display:inline;margin-left:8px">${s.tech}</small>`, weak.length ? `練習したいところ：${weak.join('・')}` : 'どの所作も、よくできた。'],
    ['配慮と立て直し', `${grade(s.care)}<small style="font-size:18px;display:inline;margin-left:8px">${s.care}</small>`, story.log.filter(l => l.d > 0).length ? '失敗のあとも、きちんと対応した。' : '失敗に、どう向き合うかも見られている。'],
    ['珍事', `${s.finds.length}`, `ずかん ${have} / ${total}`],
  ].map(([a, b, c]) => `<div><small>${a}</small><b>${b}</b><p>${c}</p></div>`).join('');
  $('resFinds').innerHTML = s.finds.length ? '今回の珍事：' + s.finds.map(id => `<b>${FINDS[id].name}</b>`).join('　') : '今回は、珍事なし。';
  data.best[SCENE.id] = { tech: Math.max(s.tech, data.best[SCENE.id]?.tech || 0), care: Math.max(s.care, data.best[SCENE.id]?.care || 0) };
  SAVE.save(data);
  window.__shosa.result = s;
  showScreen('result');
}

// ---------------- 画面 ----------------
function showScreen(id) { for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== id; }
let backTo = 'title';
function showTitle() {
  mode = 'title'; paused = false; hud.show(false); showScreen('title'); fadeEl().style.opacity = 0;
  if (actors) {
    STEPS.A6.setup(makeCtx({ alive: false }, 'title'));
    for (const k of ['cup_player']) props[k].obj.visible = true;
    rig.shot([1.42, 1.12, 2.12], [-0.35, 0.62, 4.1], { cut: true });
  }
}
function setupMenus() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    sfx.ensure();
    const a = b.dataset.act;
    if (a === 'story') playFrom(0);
    if (a === 'select') { backTo = mode === 'result' ? 'result' : 'title'; renderSelect(); showScreen('select'); }
    if (a === 'zukan') { backTo = 'title'; renderZukan(); showScreen('zukan'); }
    if (a === 'settings') { backTo = paused ? 'pause' : 'title'; showScreen('settings'); }
    if (a === 'back') showScreen(backTo);
    if (a === 'resume') togglePause();
    if (a === 'retryStep') retryStep();
    if (a === 'quit') quitToTitle();
    if (a === 'again') playFrom(0);
  });
  for (const el of document.querySelectorAll('[data-set]')) {
    const k = el.dataset.set; el.value = data.settings[k];
    el.addEventListener('input', () => { data.settings[k] = el.type === 'range' ? +el.value : el.value; SAVE.save(data); applySettings(); });
  }
}
function applySettings() {
  const s = data.settings;
  document.body.classList.remove('sub-s', 'sub-m', 'sub-l'); document.body.classList.add('sub-' + s.subSize);
  input.sens = s.sens; sfx.setVol(s.vol);
  if (R.quality !== s.quality) R.setQuality(s.quality);
}
function renderSelect() {
  const reached = data.progress[SCENE.id] || 0;
  let h = `<h3>${SCENE.chapter}　${SCENE.title}</h3>`;
  SCENE.steps.forEach((s, i) => { h += `<button data-step="${i}" ${i > reached ? 'disabled' : ''}>${i + 1}. ${s.title}${i > reached ? '　（まだ）' : ''}</button>`; });
  h += `<h3>第二章　名刺交換から着席まで</h3><button disabled>準備中</button><h3>第三章　神社参拝</h3><button disabled>準備中</button>`;
  $('selectList').innerHTML = h;
  for (const b of $('selectList').querySelectorAll('[data-step]')) b.onclick = () => { if (curToken) { pending = 'quit'; curToken.alive = false; runner.tick(0); } setTimeout(() => playFrom(+b.dataset.step), 30); };
}
function renderZukan() {
  $('zukanList').innerHTML = Object.entries(FINDS).map(([id, f]) => data.finds[id] ? `<div>${f.name}<small>${f.desc}</small></div>` : `<div class="lock">？？？<small>まだ見つけていない</small></div>`).join('');
}

window.__shosa = { project(x, y, z) { const v = new THREE.Vector3(x, y, z).project(R.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }, story, get actors() { return actors; }, get props() { return props; }, rig, R, data, playFrom, retryStep, get mode() { return mode; }, get step() { return SCENE.steps[curIndex]?.id; }, STEPS, SCENE };
boot().catch(e => { console.error(e); $('loading').textContent = '読み込みに失敗しました。ページを読み込み直してください。'; });
