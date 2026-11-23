// 自動で第一章を最後まで遊ぶ確認用の台本（キーボードとマウスの入力だけで操作する）
// node tools/play-bot.mjs [出力フォルダー] [url]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.HOME + '/.dev-browser/node_modules/');
const { chromium } = require('playwright');
const out = process.argv[2] || 'playtest-shots'; fs.mkdirSync(out, { recursive: true });
const url = process.argv[3] || 'http://127.0.0.1:8150/';
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const W = ms => p.waitForTimeout(ms);
const ev = (f, a) => p.evaluate(f, a);
const step = () => ev(() => __shosa.step);
const until = async (f, a, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(f, a)) return true; await W(100); } throw new Error('timeout: ' + f.toString().slice(0, 80)); };
const shot = n => p.screenshot({ path: `${out}/${n}.jpg`, quality: 85 });
const meterOn = () => until(() => !document.getElementById('meter').hidden);
const choicesOn = () => until(() => document.getElementById('choices').children.length > 0);
const proj = (x, y, z) => ev(([x, y, z]) => __shosa.project(x, y, z), [x, y, z]);
const propPos = k => ev(k => { const q = __shosa.props[k].pos; return [q.x, q.y, q.z]; }, k);
async function drag(fromW, toW, { rot = 0, beforeUp } = {}) {
  const a = await proj(...fromW); await p.mouse.move(a.x, a.y); await W(150); await p.mouse.down(); await W(250);
  const c = await proj(...toW);
  for (let i = 1; i <= 15; i++) { await p.mouse.move(a.x + (c.x - a.x) * i / 15, a.y + (c.y - a.y) * i / 15); await W(40); }
  if (rot) { const k = rot > 0 ? 'e' : 'q'; await p.keyboard.down(k); await W(Math.abs(rot) / 2.4 * 1000); await p.keyboard.up(k); }
  await W(500); if (beforeUp) await beforeUp();
  await p.mouse.up(); await W(300);
}
const log = [];
await p.goto(url);
await until(() => document.getElementById('loading').classList.contains('hide'));
await W(1500); await shot('00-title');
await p.click('[data-act=story]');
// A1 玄関
await until(() => __shosa.step === 'A1'); await meterOn(); await W(1200);
await p.keyboard.down(' '); await W(700); await shot('01-genkan-bow'); await W(700); await p.keyboard.up(' ');
log.push('A1 ok');
// A2 靴
await until(() => __shosa.step === 'A2', null, 40000); await until(() => document.getElementById('objective').textContent.includes('靴'));
await W(500); await shot('02-shoes-before');
const G = -0.22;
for (const [k, tx] of [['shoeL', -0.46], ['shoeR', -0.32]]) {
  const pos = await propPos(k);
  const yaw = await ev(k => __shosa.props[k].obj.rotation.y, k);
  let d = Math.PI - yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
  await drag([pos[0], pos[1] + 0.04, pos[2]], [tx, G + 0.075, -0.24], { rot: d });
}
await W(1500); await shot('02-shoes-after');
// A3 入室
await until(() => __shosa.step === 'A3', null, 30000); await until(() => document.getElementById('keys').textContent.includes('歩く'), null, 20000);
await shot('03-enter-start');
for (let i = 0; i < 200; i++) {
  if (await step() !== 'A3') break;
  const pp = await ev(() => { const a = __shosa.actors.player.pos; return [a.x, a.z]; });
  const dx = -0.36 - pp[0], dz = 2.42 - pp[1];
  const keys = [];
  if (dz > 0.05) keys.push('w'); else if (dz < -0.05) keys.push('s');
  if (pp[1] > 1.5 && dx < -0.05) keys.push('d'); else if (pp[1] > 1.5 && dx > 0.05) keys.push('a');
  for (const k of keys) await p.keyboard.down(k); await W(120); for (const k of keys) await p.keyboard.up(k);
  if (i === 25) await shot('03-enter-walking');
}
// A4 座って名乗る
await until(() => __shosa.step === 'A4', null, 20000); await meterOn();
await p.keyboard.down('f'); await W(1300); await p.keyboard.up('f');
await choicesOn(); await W(6500); await shot('04-intro-choices'); await p.keyboard.press('1');
await meterOn(); await W(300); await p.keyboard.down(' '); await W(900); await shot('04-zarei'); await W(500); await p.keyboard.up(' ');
// A5 座布団と手土産
await until(() => __shosa.step === 'A5', null, 30000); await until(() => document.getElementById('keys').textContent.includes('膝'));
for (let i = 0; i < 6; i++) { await p.keyboard.press('w'); await W(420); }
await until(() => document.getElementById('objective').textContent.includes('手土産'), null, 20000);
await W(400); await shot('05-gift-before');
{
  const gp = await propPos('gift');
  const a = await proj(gp[0], gp[1] + 0.05, gp[2]); await p.mouse.move(a.x, a.y); await W(150); await p.mouse.down(); await W(700);
  await p.keyboard.down('e'); await W(Math.PI / 2.4 * 1000); await p.keyboard.up('e');
  await p.keyboard.press('1');
  const c = await proj(-0.36, 0.43, 3.86); const cur = await proj(...(await propPos('gift')));
  for (let i = 1; i <= 20; i++) { await p.mouse.move(cur.x + (c.x - cur.x) * i / 20, cur.y + (c.y - cur.y) * i / 20); await W(50); }
  await W(1200); await shot('05-gift-handing'); await p.mouse.up();
}
// A6 お茶
await until(() => __shosa.step === 'A6', null, 30000); await until(() => document.getElementById('objective').textContent.includes('お茶'), null, 20000);
await W(300); await shot('06-tea-before');
{
  const cp = await propPos('cup_player');
  const a = await proj(cp[0], cp[1] + 0.05, cp[2]); await p.mouse.move(a.x, a.y); await W(150); await p.mouse.down(); await W(400);
  for (let i = 1; i <= 15; i++) { await p.mouse.move(a.x, a.y - (a.y - 60) * i / 15); await W(40); }
  await W(800);
  for (let i = 0; i < 9; i++) { await p.mouse.wheel(0, 120); await W(80); }
  await W(1500); await shot('06-tea-drinking');
  for (let i = 0; i < 9; i++) { await p.mouse.wheel(0, -120); await W(60); }
  await W(400);
  for (let i = 1; i <= 15; i++) { await p.mouse.move(a.x, 60 + (a.y - 60) * i / 15); await W(40); }
  const sp = await propPos('saucer_player'); const s2 = await proj(sp[0], sp[1] + 0.05, sp[2]); await p.mouse.move(s2.x, s2.y); await W(800);
  await p.mouse.up(); await W(300);
  await choicesOn(); await W(500); await p.keyboard.press('2');
}
// A7 結婚の意思
await until(() => __shosa.step === 'A7', null, 40000); await choicesOn(); await W(14600); await shot('07-silence'); await p.keyboard.press('1');
await meterOn(); await W(300); await p.keyboard.down(' '); await W(1300); await shot('07-bow'); await W(700); await p.keyboard.up(' ');
// A8 見送り
await until(() => __shosa.step === 'A8', null, 40000); await meterOn();
await p.keyboard.down('f'); await W(2700); await p.keyboard.up('f');
await W(3500);
await until(() => document.getElementById('objective').textContent.includes('お別れ'), null, 20000); await meterOn(); await W(900);
await p.keyboard.down(' '); await W(1300); await shot('08-farewell-bow'); await p.keyboard.up(' ');
await until(() => document.getElementById('keys').textContent.includes('歩く'), null, 15000); await W(2000);
await p.keyboard.down('w'); await W(1600); await p.keyboard.up('w');
await W(600); await p.keyboard.down(' '); await W(500); await p.keyboard.up(' ');
await until(() => __shosa.mode === 'result', null, 30000); await W(800); await shot('09-result');
const res = await ev(() => ({ result: __shosa.result, tech: __shosa.story.tech, care: __shosa.story.care, mood: __shosa.story.mood, fps: Math.round(__shosa.fps) }));
console.log(JSON.stringify(res, null, 1));
console.log('errors:', errs.filter(e => !/PropertyBinding/.test(e)).slice(0, 10));
await b.close();
