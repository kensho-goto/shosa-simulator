// 「お茶の間60秒」を自動で遊ぶ確認用の台本（人の試遊ではない）。
// 使う入力は、出てきた輪をマウスで押すことだけ（「注ぐ」は押しっぱなし → はなす）。
// node tools/play-bot-rush.mjs [出力フォルダー] [上手さ good|mid|idle] [url]
//   good … 0.4秒ほどで反応し、いちばん急ぐ輪から片づける人
//   mid  … 反応が1.4秒おそく、輪の1割ほどを見落とす人
//   idle … 何も押さない人（事件のつながり方を見る）
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.HOME + '/.dev-browser/node_modules/');
const { chromium } = require('playwright');
const out = process.argv[2] || 'playtest-shots/rush'; fs.mkdirSync(out, { recursive: true });
const skill = process.argv[3] || 'good';
const url = process.argv[4] || 'http://127.0.0.1:8150/';
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const W = ms => p.waitForTimeout(ms);
await p.addInitScript(() => { const k = 'shosa.v1'; const d = JSON.parse(localStorage.getItem(k) || '{}'); d.settings = { ...(d.settings || {}), controls: 'easy' }; localStorage.setItem(k, JSON.stringify(d)); });
await p.goto(url);
await p.waitForFunction(() => document.getElementById('loading').classList.contains('hide'), null, { timeout: 60000 });
await W(800);
await p.click('[data-act=rush]');
await p.waitForFunction(() => __shosa.story.rush, null, { timeout: 20000 });
const react = skill === 'good' ? 400 : 1400;
const seen = new Map();
const shotsAt = [6, 14, 22, 30, 40, 50];
let shotI = 0;
const state = () => p.evaluate(() => {
  const S = __shosa.story.rush; if (!S) return null;
  return { t: S.t, over: S.over, numb: S.numb, busy: !!S.busy, tasks: S.tasks.map(T => { const r = T.el.querySelector('svg').getBoundingClientRect(); return { kind: T.kind, left: T.left, fill: T.fill, count: T.count, x: r.x + r.width / 2, y: r.y + r.height / 2 }; }) };
});
const posOf = async kind => (await state())?.tasks.find(t => t.kind === kind);
while (true) {
  const s = await state();
  if (!s || s.over) break;
  if (shotI < shotsAt.length && s.t >= shotsAt[shotI]) { await p.screenshot({ path: `${out}/${String(shotI + 1).padStart(2, '0')}-t${shotsAt[shotI]}.jpg`, quality: 82 }); shotI++; }
  if (skill === 'idle') { await W(200); continue; }
  const now = Date.now();
  for (const t of s.tasks) if (!seen.has(t.kind)) seen.set(t.kind, { at: now, skip: skill === 'mid' && t.kind !== 'numb' && Math.random() < 0.12 });
  for (const k of [...seen.keys()]) if (!s.tasks.some(t => t.kind === k)) seen.delete(k);
  // いちばん急ぐもの（しびれは 0.6 をこえたら最優先）
  const cand = s.tasks.filter(t => now - seen.get(t.kind).at >= react && !seen.get(t.kind).skip).sort((a, b) => {
    const ua = a.kind === 'numb' ? (s.numb > 0.6 ? -1 : 99) : a.left, ub = b.kind === 'numb' ? (s.numb > 0.6 ? -1 : 99) : b.left; return ua - ub;
  });
  const t = cand[0];
  if (!t) { await W(80); continue; }
  if (t.kind === 'pour') {
    await p.mouse.move(t.x, t.y); await p.mouse.down();
    const goal = skill === 'good' ? 0.82 : 0.95;
    for (let i = 0; i < 60; i++) { const q = await posOf('pour'); if (!q || q.fill >= goal) break; await W(30); }
    await p.mouse.up();
  } else if (t.kind === 'sip') {
    for (let i = 0; i < 3; i++) { const q = await posOf('sip'); if (!q) break; await p.mouse.click(q.x, q.y); await W(380); }
  } else if (t.kind === 'numb') {
    for (let i = 0; i < 6; i++) { const q = await posOf('numb'); if (!q) break; await p.mouse.click(q.x, q.y); await W(70); }
  } else {
    await p.mouse.click(t.x, t.y);
  }
  if (t.kind !== 'numb') seen.delete(t.kind); else seen.get('numb').at = Date.now();
  await W(skill === 'good' ? 120 : 450);
}
await W(4200);
await p.screenshot({ path: `${out}/07-summary.jpg`, quality: 82 });
const res = await p.evaluate(() => { const S = __shosa.story.rush; return { handled: S.handled, missed: S.missed, damage: S.damage, priceless: S.priceless, chained: S.chained, bill: S.bill, finds: __shosa.story.found }; });
await p.mouse.click(640, 360); await W(500);
try { await p.waitForFunction(() => __shosa.mode === 'result', null, { timeout: 15000 }); await W(1200); await p.screenshot({ path: `${out}/08-result.jpg`, quality: 82 }); } catch { console.log('no result screen'); }
console.log(JSON.stringify(res));
console.log('errors:', errs.filter(e => !/PropertyBinding/.test(e)).slice(0, 10));
await b.close();
