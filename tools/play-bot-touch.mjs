// スマホの画面（横向き 844×390・指で操作）で、第一章を最後まで遊ぶ確認用の台本。
// キーボードもマウスも使わず、画面のボタン・スティック・指（2本まで同時）だけで操作する。
// node tools/play-bot-touch.mjs [出力フォルダー] [url]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.HOME + '/.dev-browser/node_modules/');
const { chromium } = require('playwright');
const out = process.argv[2] || 'playtest-shots-touch'; fs.mkdirSync(out, { recursive: true });
const url = process.argv[3] || 'http://127.0.0.1:8150/';
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctxB = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctxB.newPage();
const cdp = await ctxB.newCDPSession(p);
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const W = ms => p.waitForTimeout(ms);
const ev = (f, a) => p.evaluate(f, a);
const until = async (f, a, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(f, a)) return true; await W(100); } await shot('zz-timeout'); console.log('state:', await ev(() => ({ step: __shosa.step, obj: document.getElementById('objective').textContent, hint: document.getElementById('thint').textContent, btns: [...document.querySelectorAll('#touch .tb')].map(b => b.textContent), choices: document.getElementById('choices').textContent, sub: document.getElementById('subtitle').textContent }))); throw new Error('timeout: ' + f.toString().slice(0, 80)); };
const shot = n => p.screenshot({ path: `${out}/${n}.jpg`, quality: 85 });
const meterOn = () => until(() => !document.getElementById('meter').hidden);
const choicesOn = () => until(() => document.getElementById('choices').children.length > 0);
const proj = (x, y, z) => ev(([x, y, z]) => __shosa.project(x, y, z), [x, y, z]);
const propPos = k => ev(k => { const q = __shosa.props[k].pos; return [q.x, q.y, q.z]; }, k);

// ---- 指（同時に何本でも） ----
const fingers = new Map();
const pts = () => [...fingers.entries()].map(([id, q]) => ({ x: q.x, y: q.y, id, radiusX: 6, radiusY: 6, force: 1 }));
async function fDown(id, x, y) { fingers.set(id, { x, y }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts() }); }
async function fMove(id, x, y) { fingers.set(id, { x, y }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts() }); }
async function fUp(id) {
  const q = fingers.get(id); if (!q) return;
  // 離す指だけを touchEnd で送る（ほかの指は押したまま）
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: q.x, y: q.y, id }] });
  fingers.delete(id);
}
async function center(sel) {
  const r = await ev(s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; }, sel);
  if (!r) throw new Error('見つからない: ' + sel); return r;
}
const btn = k => `#touch .tb[data-key="${k}"]`;
async function hold(k, ms, id = 9) { const c = await center(btn(k)); await fDown(id, c.x, c.y); await W(ms); await fUp(id); }
async function tap(k) { await hold(k, 60); }
async function choose(i) { const c = await center(`#choices [data-i="${i}"]`); await fDown(8, c.x, c.y); await W(60); await fUp(8); }
async function stick(dx, dy, ms) { const c = await center('#stick'); await fDown(7, c.x, c.y); await fMove(7, c.x + dx * 50, c.y - dy * 50); await W(ms); await fUp(7); }
async function drag(fromW, toW, { rotKey = null, rotMs = 0, beforeUp } = {}) {
  const a = await proj(...fromW); await fDown(1, a.x, a.y); await W(250);
  const c = await proj(...toW);
  for (let i = 1; i <= 15; i++) { await fMove(1, a.x + (c.x - a.x) * i / 15, a.y + (c.y - a.y) * i / 15); await W(40); }
  if (rotKey) await hold(rotKey, rotMs, 2); // 2本目の指で回す
  await W(500); if (beforeUp) await beforeUp();
  await fUp(1); await W(300);
}

const log = [];
await p.goto(url);
await until(() => document.getElementById('loading').classList.contains('hide'));
await W(1500); await shot('00-title');
log.push(await ev(() => ({ touchUI: document.body.classList.contains('touch'), quality: __shosa.R.quality })));
{ const c = await center('[data-act=story]'); await fDown(5, c.x, c.y); await W(60); await fUp(5); }
// A1 玄関
await until(() => __shosa.step === 'A1'); await meterOn(); await W(1200);
{ const c = await center(btn(' ')); await fDown(9, c.x, c.y); await W(700); await shot('01-genkan-bow'); await W(700); await fUp(9); }
// A2 靴（指で持ち、2本目の指で向きを変える）
await until(() => __shosa.step === 'A2', null, 40000); await until(() => document.getElementById('objective').textContent.includes('靴'));
await W(500); await shot('02-shoes-before');
const G = -0.22;
for (const [k, tx] of [['shoeL', -0.46], ['shoeR', -0.32]]) {
  const pos = await propPos(k);
  const yaw = await ev(k => __shosa.props[k].obj.rotation.y, k);
  let d = Math.PI - yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
  await drag([pos[0], pos[1] + 0.04, pos[2]], [tx, G + 0.075, -0.24], { rotKey: d > 0 ? 'e' : 'q', rotMs: Math.abs(d) / 2.4 * 1000 });
}
await W(1500); await shot('02-shoes-after');
// A3 入室（スティック）
await until(() => __shosa.step === 'A3', null, 30000); await until(() => !document.getElementById('stick').hidden, null, 20000);
await shot('03-enter-start');
for (let i = 0; i < 200; i++) {
  if (await ev(() => __shosa.step) !== 'A3') break;
  const pp = await ev(() => { const a = __shosa.actors.player.pos; return [a.x, a.z]; });
  const dx = -0.36 - pp[0], dz = 2.42 - pp[1];
  let sx = 0, sy = 0;
  if (dz > 0.05) sy = 1; else if (dz < -0.05) sy = -1;
  if (pp[1] > 1.5 && dx < -0.05) sx = 1; else if (pp[1] > 1.5 && dx > 0.05) sx = -1;
  if (!sx && !sy) { await W(120); continue; }
  await stick(sx, sy, 120);
  if (i === 25) await shot('03-enter-walking');
}
// A4 座って名乗る
await until(() => __shosa.step === 'A4', null, 20000); await meterOn();
await hold('f', 1300);
await choicesOn(); await W(6500); await shot('04-intro-choices'); await choose(1);
await meterOn(); await W(300);
{ const c = await center(btn(' ')); await fDown(9, c.x, c.y); await W(900); await shot('04-zarei'); await W(500); await fUp(9); }
// A5 座布団と手土産
await until(() => __shosa.step === 'A5', null, 30000); await until(() => !!document.querySelector('#touch .tb[data-key="w"]'));
for (let i = 0; i < 6; i++) { await tap('w'); await W(420); }
await until(() => document.getElementById('objective').textContent.includes('手土産'), null, 20000);
await W(400); await shot('05-gift-before');
{
  const gp = await propPos('gift');
  const a = await proj(gp[0], gp[1] + 0.05, gp[2]); await fDown(1, a.x, a.y); await W(700);
  await hold('e', Math.PI / 2.4 * 1000, 2);
  await choose(1);
  const c = await proj(-0.36, 0.43, 3.86); const cur = await proj(...(await propPos('gift')));
  for (let i = 1; i <= 20; i++) { await fMove(1, cur.x + (c.x - cur.x) * i / 20, cur.y + (c.y - cur.y) * i / 20); await W(50); }
  await W(1200); await shot('05-gift-handing'); await fUp(1);
}
// A6 お茶（指で口元へ、2本目の指で「傾ける」）
await until(() => __shosa.step === 'A6', null, 30000); await until(() => document.getElementById('objective').textContent.includes('お茶'), null, 20000);
await W(300); await shot('06-tea-before');
{
  const cp = await propPos('cup_player');
  const a = await proj(cp[0], cp[1] + 0.05, cp[2]); await fDown(1, a.x, a.y); await W(400);
  for (let i = 1; i <= 15; i++) { await fMove(1, a.x, a.y - (a.y - 40) * i / 15); await W(40); }
  await W(800);
  const tc = await center(btn('x')); await fDown(2, tc.x, tc.y); await W(650); await shot('06-tea-drinking'); await W(500); await fUp(2);
  await W(300);
  // 飲んでいる途中の質問が出たら、湯のみを持ったまま答える
  if (await ev(() => document.getElementById('choices').children.length > 0)) { await shot('06-tea-question'); await choose(1); log.push('answered while holding'); await W(2500); }
  if (await ev(() => !!document.querySelector('#touch .tb[data-key="z"]'))) { const zc = await center(btn('z')); await fDown(2, zc.x, zc.y); await W(1300); await fUp(2); }
  for (let i = 1; i <= 15; i++) { await fMove(1, a.x, 40 + (a.y - 40) * i / 15); await W(40); }
  const sp = await propPos('saucer_player'); const s2 = await proj(sp[0], sp[1] + 0.05, sp[2]); await fMove(1, s2.x, s2.y); await W(800);
  await fUp(1); await W(300);
  // こぼれたときだけ選択肢が出る
  if (await ev(() => document.getElementById('choices').children.length > 0)) { await W(400); await choose(2); log.push('spill'); }
}
// こぼして「ハンカチで拭く」を選んだとき：指で布を持ってしみの上でこする。途中の質問には2本目の指で答える。
await W(800);
if (await ev(() => document.getElementById('objective').textContent.includes('ハンカチ'))) {
  log.push('wipe');
  const cl = await propPos('cloth'); const st = await ev(() => { const s = __shosa.stains[__shosa.stains.length - 1].position; return [s.x, s.y, s.z]; });
  const a = await proj(cl[0], cl[1], cl[2]); await fDown(1, a.x, a.y); await W(300);
  let answered = false;
  for (let k = 0; k < 60; k++) {
    if (await ev(() => __shosa.step) !== 'A6' || !(await ev(() => document.getElementById('objective').textContent.includes('ハンカチ')))) break;
    const o = await proj(st[0] + Math.sin(k * 1.3) * 0.06, st[1], st[2] + Math.cos(k * 1.7) * 0.05); await fMove(1, o.x, o.y); await W(90);
    if (k === 14) await shot('06-wipe');
    if (!answered && await ev(() => document.getElementById('choices').children.length > 0)) { await shot('06-wipe-question'); await choose(1); answered = true; }
  }
  await fUp(1);
}
// A7 結婚の意思
await until(() => __shosa.step === 'A7', null, 60000); await choicesOn(); await W(14600); await shot('07-silence'); await choose(1);
await meterOn(); await W(300);
{ const c = await center(btn(' ')); await fDown(9, c.x, c.y); await W(1300); await shot('07-bow'); await W(700); await fUp(9); }
// A8 見送り
await until(() => __shosa.step === 'A8', null, 40000); await meterOn();
await hold('f', 2700);
await W(3500);
await until(() => document.getElementById('objective').textContent.includes('お別れ'), null, 20000); await meterOn(); await W(900);
{ const c = await center(btn(' ')); await fDown(9, c.x, c.y); await W(1300); await shot('08-farewell-bow'); await fUp(9); }
await until(() => !document.getElementById('stick').hidden, null, 15000); await W(2000);
await stick(0, 1, 1600);
await W(600); await hold(' ', 500);
await until(() => __shosa.mode === 'result', null, 30000); await W(1500); await shot('09-result');
const res = await ev(() => ({ result: __shosa.result, tech: __shosa.story.tech, care: __shosa.story.care, mood: __shosa.story.mood, fps: Math.round(__shosa.fps) }));
console.log(JSON.stringify({ log, ...res }, null, 1));
console.log('errors:', errs.filter(e => !/PropertyBinding/.test(e)).slice(0, 10));
await b.close();
