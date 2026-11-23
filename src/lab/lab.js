// 人物の確認室：一人（＋相手役）を、和室と箱で、実際に動かして確かめる場所。
// 操作（ボタン・キー・床を押す）→ CharacterController の命令 → 人物の計算 → 箱の位置、の順に毎フレーム進む。
import * as THREE from 'three';
import { createRenderer, loadEnvironment, CameraRig } from '../render.js';
import { loadModels, Actor } from '../actor.js';
import { makeGift } from '../props.js';
import { buildLab, labFloor, LAB, STANDS } from './room.js';
import { Holdable } from './item.js';
import { CharacterController } from './controller.js';
import { PROFILES, PARTNER } from './people.js';

const params = new URLSearchParams(location.search);
const quality = params.get('q') === 'low' ? 'low' : 'high';
const R = createRenderer(document.getElementById('view'), quality);
const rig = new CameraRig(R.camera);
const $ = s => document.querySelector(s);
const statusEl = $('#status'), msgEl = $('#msg');

const START = { main: { pos: new THREE.Vector3(-0.35, 0, -0.25), yaw: 0.35 }, partner: { pos: new THREE.Vector3(0.75, 0, 0.2), yaw: -2.0 } };
const APPROACH = new THREE.Vector3(0, 0, -1); // 台の奥（北）側から近づく → 顔が手前のカメラに向く
const SPOTS = { A: { pos: STANDS.A.clone(), approachDir: APPROACH }, B: { pos: STANDS.B.clone(), approachDir: APPROACH } };

let lab, box, people = {}, ctl = {}, who = 'main', camMode = 'full', light = 'studio';
let profileId = params.get('person') || PROFILES[0].id;
const listeners = {};
const world = {
  emit(ev, ...a) { (listeners[ev] || []).forEach(f => f(...a)); },
  on(ev, f) { (listeners[ev] ||= []).push(f); },
  obstacles(me) { return Object.values(ctl).filter(c => c !== me).map(c => c.actor.pos); },
};
const log = []; // ボット用の記録
function say(text, ok = true) { msgEl.textContent = text; msgEl.className = ok ? '' : 'no'; log.push({ t: performance.now(), text, ok }); }

const RESULT = { held: '箱を持ちました', placed: '箱を台に置きました', given: '箱を渡しました', received: '箱を受け取りました', arrived: '着きました', stopped: '止まりました', done: 'お辞儀を終えました', unreachable: '手が届かないので、手を戻しました', notTaken: '相手が受け取らなかったので、持ったまま戻りました', taken: '別の人が先に持ちました', cancel: '受け取りをやめました' };

function makePerson(key, prof) {
  const a = new Actor(R.scene, { person: prof.person, height: prof.height, name: key });
  const c = new CharacterController(a, { name: key, world });
  people[key] = a; ctl[key] = c; footShadow(a);
  return a;
}
function removePerson(key) { const a = people[key]; if (!a) return; a.root.removeFromParent(); }
// 足もとの接地の影（床に立っている感じを出す。足の間が一番濃い）
let blobTex = null;
function footShadow(a) {
  if (!blobTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.8 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.003; m.renderOrder = 1; a.root.add(m);
}

function resetAll() {
  for (const k of ['main', 'partner']) {
    const c = ctl[k], a = people[k];
    c.hardReset(); a.pos.copy(START[k].pos); a.yaw = START[k].yaw; a.s.worry = 0; a.s.smile = 0; a.s.gesture = null;
  }
  box.rest(STANDS.A.clone(), 0); box.offeredBy = null; box.gripDepth = 0;
  applyClumsy();
  say('最初の状態に戻しました');
}

let clumsy = 0;
function applyClumsy() { for (const c of Object.values(ctl)) { c.clumsy = clumsy > 0 ? 1 : 0; c.exaggerate = clumsy === 2; } }

// ---- 命令（ボタン・キー・ボットは全部ここを通る）----
function other(k) { return k === 'main' ? 'partner' : 'main'; }
function run(name, arg) {
  const c = ctl[who], o = ctl[other(who)];
  let res;
  switch (name) {
    case 'idle': { const was = c.busy; c.command('stop'); c.command('look', null); res = { ok: true, msg: was ? '止まってから待機します' : '待機します' }; break; }
    case 'stop': res = c.command('stop'); break;
    case 'bow': res = c.command('bow', {}); break;
    case 'pick':
      box.approachDir = labFloor(box.obj.position.x, box.obj.position.z) > 0 ? APPROACH : null;
      res = c.command('pick', box); break;
    case 'placeA': res = c.command('place', SPOTS.A); break;
    case 'placeB': res = c.command('place', SPOTS.B); break;
    case 'give': res = c.command('give', o); break;
    case 'reset': resetAll(); return { ok: true, msg: '最初に戻しました' };
    case 'look': {
      const t = arg === 'camera' ? R.camera : arg === 'other' ? people[other(who)] : arg === 'box' ? box.anchor : null;
      res = c.command('look', t); break;
    }
    case 'walk': {
      let g;
      if (arg === 'center') g = new THREE.Vector3(0, 0, 0.1);
      else if (arg === 'A' || arg === 'B') g = SPOTS[arg].pos.clone().addScaledVector(APPROACH, 0.45).setY(0);
      else if (arg === 'other') { const oa = people[other(who)], me = people[who]; const d = me.pos.clone().sub(oa.pos).setY(0); if (d.lengthSq() < 1e-4) d.set(0, 0, 1); g = oa.pos.clone().addScaledVector(d.normalize(), 0.95); }
      else g = arg; // 床を押した場所
      g.x = THREE.MathUtils.clamp(g.x, LAB.x0 + 0.3, LAB.x1 - 0.3); g.z = THREE.MathUtils.clamp(g.z, LAB.z0 + 0.3, LAB.z1 - 0.2); g.y = 0;
      res = c.command('walk', g); break;
    }
    default: res = { ok: false, msg: 'その命令はありません' };
  }
  say(`${who === 'main' ? '本人' : '相手役'}：${res.msg}`, res.ok);
  return res;
}

// 箱が傾いた → 相手役が気づく（箱を見る・少し心配する・黙って待つ・顔を戻す）
let reactT = 0;
function setupWorld() {
  world.on('tilt', (c) => {
    const o = ctl[other(c.name)]; if (!o || o.busy) return;
    const oa = o.actor; oa.lookAt(box.anchor, 1); oa.s.worry = c.exaggerate ? 0.9 : 0.45; if (c.exaggerate) oa.gesture('flinch', 0.5);
    reactT = 2.2; reactBy = o;
  });
  world.on('done', (c, was, value) => { if (value && RESULT[value]) say(`${c.name === 'main' ? '本人' : '相手役'}：${RESULT[value]}`, !['unreachable', 'notTaken', 'taken'].includes(value)); });
  world.on('msg', (c, m) => say(`${c.name === 'main' ? '本人' : '相手役'}：${m}`));
}
let reactBy = null;

// ---- カメラ ----
const tmp = new THREE.Vector3();
function camGoal() {
  const a = people.main, H = a.headPos(), f = a.forward(), s = a.side();
  let pos, look, fov;
  if (camMode === 'face') { pos = H.clone().addScaledVector(f, 0.95).add(tmp.set(0, 0.02, 0)); look = H.clone().add(tmp.set(0, 0.02, 0)); fov = 26; }
  else if (camMode === 'profile') { pos = H.clone().addScaledVector(s, 0.95); look = H.clone().add(tmp.set(0, 0.02, 0)); fov = 26; }
  else if (camMode === 'talk') { pos = H.clone().addScaledVector(f, 1.25).addScaledVector(s, -0.3).add(tmp.set(0, -0.06, 0)); look = H.clone().add(tmp.set(0, -0.12, 0)); fov = 36; }
  else if (camMode === 'full') { const c = a.pos.clone(); pos = new THREE.Vector3(c.x * 0.6 + 0.35, 1.25, LAB.z1 + 1.9); look = new THREE.Vector3(c.x * 0.8, 0.85, c.z); fov = 38; }
  else { const m = a.pos.clone().lerp(people.partner.pos, 0.5); pos = new THREE.Vector3(m.x * 0.5, 1.6, LAB.z1 + 2.4); look = new THREE.Vector3(m.x * 0.85, 0.85, m.z); fov = 44; }
  // 壁の外へ出ない（手前＝南は開いている）
  pos.x = THREE.MathUtils.clamp(pos.x, LAB.x0 + 0.12, LAB.x1 - 0.12); pos.z = Math.max(pos.z, LAB.z0 + 0.12); pos.y = Math.min(pos.y, LAB.h - 0.1);
  return { pos, look, fov };
}
function setCam(m, cut = false) {
  camMode = m; document.querySelectorAll('#cams button').forEach(b => b.classList.toggle('on', b.dataset.cam === m));
  const g = camGoal(); rig.shot(g.pos.toArray(), g.look.toArray(), { fov: g.fov, speed: 4, cut });
}
// パネルで隠れない左側の真ん中に、写すものが来るようにする
function fitView() {
  const panel = $('#panel'), P = panel.classList.contains('hide') ? 0 : panel.offsetWidth + 24;
  const W = innerWidth, H = innerHeight;
  if (P > 0 && W > 700) R.camera.setViewOffset(W + P, H, P, 0, W, H); else R.camera.clearViewOffset();
}
addEventListener('resize', () => setTimeout(fitView, 0));
function setLight(m) { light = m; lab.setLighting(m); document.querySelectorAll('#light button').forEach(b => b.classList.toggle('on', b.dataset.light === m)); }

// ---- 画面の速さ ----
const fps = { frames: 0, t0: performance.now(), value: 0, samples: [] };
function tickFps(now) {
  fps.frames++;
  if (now - fps.t0 >= 1000) { fps.value = fps.frames * 1000 / (now - fps.t0); fps.samples.push(fps.value); if (fps.samples.length > 120) fps.samples.shift(); fps.frames = 0; fps.t0 = now; }
}
function resolution() { const c = R.renderer.domElement; return `${c.width}×${c.height}`; }

function updateStatus() {
  const holder = box.holder ? (box.holder.name === 'main' ? '本人' : '相手役') : (box.obj.position.y > 0.3 ? (box.obj.position.x < 0 ? '台A' : '台B') : '床');
  const prof = PROFILES.find(p => p.id === profileId);
  statusEl.innerHTML = `<b>本人</b> ${ctl.main.state}　<b>相手役</b> ${ctl.partner.state}<br><b>箱</b> ${holder}<br>`
    + `<b>速さ</b> ${fps.value.toFixed(0)} コマ/秒 ・ ${resolution()} ・ 画質 ${R.quality === 'high' ? 'きれい' : 'かるい'} ・ 照明 ${light === 'studio' ? '確かめ用' : '和室'}<br>`
    + `<span style="opacity:.7">${prof ? prof.label : ''}</span>`;
}

// ---- 入力 ----
function setupUI() {
  const sel = $('#profile');
  for (const p of PROFILES) { const o = document.createElement('option'); o.value = p.id; o.textContent = p.label; sel.appendChild(o); }
  sel.value = profileId;
  sel.addEventListener('change', () => switchProfile(sel.value));
  document.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => run(b.dataset.cmd)));
  document.querySelectorAll('[data-look]').forEach(b => b.addEventListener('click', () => run('look', b.dataset.look)));
  document.querySelectorAll('[data-walk]').forEach(b => b.addEventListener('click', () => run('walk', b.dataset.walk)));
  document.querySelectorAll('[data-who]').forEach(b => b.addEventListener('click', () => { who = b.dataset.who; document.querySelectorAll('#who button').forEach(x => x.classList.toggle('on', x === b)); }));
  document.querySelectorAll('[data-clumsy]').forEach(b => b.addEventListener('click', () => { clumsy = +b.dataset.clumsy; applyClumsy(); document.querySelectorAll('#clumsy button').forEach(x => x.classList.toggle('on', x === b)); say(['自然に動きます', '持って歩くと箱が傾きます（気づいて持ち直します）', '傾きと気づきの動きを大きくします'][clumsy]); }));
  document.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => setCam(b.dataset.cam)));
  document.querySelectorAll('[data-light]').forEach(b => b.addEventListener('click', () => setLight(b.dataset.light)));
  document.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { R.setQuality(b.dataset.q); markQuality(); }));
  $('#toggle').addEventListener('click', () => { $('#panel').classList.toggle('hide'); fitView(); });
  const keys = { i: ['idle'], s: ['stop'], o: ['bow'], g: ['pick'], h: ['placeB'], t: ['give'], r: ['reset'], q: ['look', 'camera'], e: ['look', 'other'], b: ['look', 'box'], x: ['look', 'none'], w: ['walk', 'center'] };
  const cams = ['face', 'profile', 'talk', 'full', 'room'];
  addEventListener('keydown', e => {
    if (e.target.tagName === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (keys[k]) run(...keys[k]);
    else if (k >= '1' && k <= '5') setCam(cams[+k - 1]);
    else if (k === 'p') { $('#panel').classList.toggle('hide'); fitView(); }
  });
  // 床を押す → そこへ歩く
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  let down = null;
  R.renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  R.renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), R.camera);
    if (ray.ray.intersectPlane(plane, hit) && hit.x > LAB.x0 && hit.x < LAB.x1 && hit.z > LAB.z0 && hit.z < LAB.z1 + 0.5) run('walk', hit.clone());
  });
  markQuality();
}
function markQuality() { document.querySelectorAll('#quality button').forEach(b => b.classList.toggle('on', b.dataset.q === R.quality)); }

function switchProfile(id) {
  const prof = PROFILES.find(p => p.id === id); if (!prof) return;
  profileId = id;
  if (box.holder === ctl.main) box.release(ctl.main);
  removePerson('main'); makePerson('main', prof);
  resetAll(); say(`本人を「${prof.label}」に替えました`);
}

// ---- はじまり ----
async function boot() {
  statusEl.textContent = '人物と部屋を読み込み中…';
  await Promise.all([loadModels(null, { hi: quality === 'high' }), loadEnvironment(R)]);
  lab = buildLab(R.scene);
  const g = makeGift(); R.scene.add(g);
  box = new Holdable(g, { name: 'gift', w: 0.3, h: 0.075, d: 0.21, floorAt: labFloor });
  const prof = PROFILES.find(p => p.id === profileId) || PROFILES[0]; profileId = prof.id;
  makePerson('main', prof); makePerson('partner', PARTNER);
  setupWorld(); setupUI(); fitView(); resetAll(); setCam(params.get('cam') || 'full', true);
  if (params.get('light')) setLight(params.get('light'));
  say('準備ができました。右のボタンかキーで動かします');
  let last = performance.now();
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    tickFps(now);
    ctl.main.update(dt); ctl.partner.update(dt);
    if (reactT > 0) { reactT -= dt; if (reactT <= 0 && reactBy && !reactBy.busy) { reactBy.actor.s.worry = 0; reactBy.actor.lookAt(people[other(reactBy.name)], 1); } }
    people.main.update(dt); people.partner.update(dt);
    box.update(dt);
    const cg = camGoal(); rig.goalPos.copy(cg.pos); rig.goalLook.copy(cg.look); rig.goalFov = cg.fov;
    rig.update(dt);
    R.render();
    if (!updateStatus.t || now - updateStatus.t > 250) { updateStatus(); updateStatus.t = now; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.__lab.ready = true;
}

window.__lab = {
  ready: false, run, setCam, setLight, log, fps, R,
  setWho(k) { who = k; }, setClumsy(v) { clumsy = v; applyClumsy(); }, switchProfile,
  get box() { return box; }, get people() { return people; }, get ctl() { return ctl; },
  resolution, project(v) { const p = v.clone().project(R.camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; },
};
boot().catch(e => { statusEl.textContent = '読み込みに失敗しました：' + e.message; console.error(e); window.__lab.error = String(e.stack || e); });
