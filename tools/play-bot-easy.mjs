// かんたん操作（押すだけ）で第一章を最後まで遊ぶ確認用の台本。
// 使う入力は Space キー（押す・押しっぱなし・はなす）と、言葉をクリックすることだけ。
// node tools/play-bot-easy.mjs [出力フォルダー] [上手さ good|clumsy] [url]
//   good   … ゲージの金色で押す人（成功の道）
//   clumsy … 早すぎ・押しすぎ・迷う人（失敗と珍事の道）
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.HOME + '/.dev-browser/node_modules/');
const { chromium } = require('playwright');
const out = process.argv[2] || 'playtest-shots/easy'; fs.mkdirSync(out, { recursive: true });
const skill = process.argv[3] || 'good';
const url = process.argv[4] || 'http://127.0.0.1:8150/';
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const W = ms => p.waitForTimeout(ms);
const ev = (f, a) => p.evaluate(f, a);
const until = async (f, a, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(f, a)) return true; await W(80); } throw new Error('timeout: ' + f.toString().slice(0, 90)); };
const shot = n => p.screenshot({ path: `${out}/${n}.jpg`, quality: 85 });
const step = () => ev(() => __shosa.step);
// ゲージを読む（針・金色・薄い金色・赤 の位置。0〜1）
const G = () => ev(() => {
  const g = document.getElementById('gauge'); if (!g || g.hidden) return null;
  const pct = el => el.style.display === 'none' ? null : [parseFloat(el.style.left) / 100, (parseFloat(el.style.left) + parseFloat(el.style.width)) / 100];
  return { v: parseFloat(g.querySelector('.needle').style.left) / 100, good: pct(g.querySelector('.good')), best: pct(g.querySelector('.best')), cap: g.querySelector('.cap').textContent };
});
const gaugeOn = (ms) => until(() => !document.getElementById('gauge').hidden, null, ms);
// 針が「ねらい」の位置にきたら押す（ブラウザの中で毎コマ見張る）
async function waitNeedle(test, ms = 15000) {
  await p.waitForFunction(test, null, { polling: 'raf', timeout: ms });
}
const inBest = `(() => { const g = document.getElementById('gauge'); if (g.hidden) return false; const v = parseFloat(g.querySelector('.needle').style.left); const b = g.querySelector('.best'); const l = parseFloat(b.style.left), w = parseFloat(b.style.width); return v >= l + w * 0.2 && v <= l + w * 0.8; })()`;
const pastBestMid = `(() => { const g = document.getElementById('gauge'); if (g.hidden) return true; const v = parseFloat(g.querySelector('.needle').style.left); const b = g.querySelector('.best'); const l = parseFloat(b.style.left), w = parseFloat(b.style.width); return v >= l + w * 0.45; })()`;
const needleAt = x => `(() => { const g = document.getElementById('gauge'); if (g.hidden) return true; return parseFloat(g.querySelector('.needle').style.left) >= ${x * 100}; })()`;
const press = async () => { await p.keyboard.down(' '); await W(60); await p.keyboard.up(' '); };
// 目押し
async function tapGood(name) { await gaugeOn(); await W(300); await waitNeedle(inBest); await press(); if (name) { await W(250); await shot(name); } }
// ためる（押しっぱなし → はなす）
async function holdTo(test, name, shotAt) {
  await gaugeOn(); await W(200);
  await p.keyboard.down(' ');
  await waitNeedle(test, 20000);
  await p.keyboard.up(' ');
  if (name) { await W(150); await shot(name); }   // 押している間に撮ると、はなすのが遅れる
}
async function clickChoice(i = 1) { await until(() => document.querySelectorAll('#choices [data-i]').length > 0); await W(400); await p.click(`#choices [data-i="${i}"]`); }
const sloppy = skill === 'clumsy';
const log = [];

await p.addInitScript(() => { const k = 'shosa.v1'; const d = JSON.parse(localStorage.getItem(k) || '{}'); d.settings = { ...(d.settings || {}), controls: 'easy' }; localStorage.setItem(k, JSON.stringify(d)); });
await p.goto(url);
await until(() => document.getElementById('loading').classList.contains('hide'));
await W(1200);
await p.click('[data-act=story]');

// A1 玄関でお辞儀（ためる）
await until(() => __shosa.step === 'A1'); await gaugeOn(); await W(1300);
if (sloppy) await holdTo(needleAt(0.98), '01-genkan-bow', 0.6);           // 深すぎ → ごつん
else await holdTo(pastBestMid, '01-genkan-bow', 0.4);
log.push(['A1', await step()]);
if (sloppy) { await clickChoice(1); }

// A2 靴（目押し 2回）
await until(() => __shosa.step === 'A2', null, 30000);
await gaugeOn(); await W(500); await shot('02-shoes-spin');
if (sloppy) { await W(400); await press(); await W(900); await gaugeOn(); await W(7600); }   // 1足目は外す・2足目は迷って落とす
else { await tapGood(); await W(800); await tapGood('02-shoes-set'); }
if (sloppy) { await clickChoice(1); }
log.push(['A2']);

// A3 敷居・ふち（またぐ）
await until(() => __shosa.step === 'A3', null, 40000);
for (let i = 0; i < 6; i++) {
  try { await gaugeOn(9000); } catch { break; }
  if (i === 0) await shot('03-enter-gauge');
  if (sloppy && i === 0) { await W(200); await press(); await W(1500); continue; }       // 早すぎ → きしむ
  await waitNeedle(inBest, 8000).catch(() => {}); await press(); await W(700);
  if (await step() !== 'A3') break;
}

// A4 正座（自動）→ 名乗る（言葉を押す）→ 座礼（ためる）
await until(() => __shosa.step === 'A4', null, 40000);
await until(() => document.querySelectorAll('#choices [data-i]').length > 0);
await W(sloppy ? 300 : 5600); await shot('04-intro-choices'); await clickChoice(1);
await gaugeOn(20000); await W(300); await holdTo(pastBestMid, '04-zarei', 0.35);

// A5 座布団（ためる）→ 手土産（目押し → 言葉 → ためる）
await until(() => __shosa.step === 'A5', null, 40000);
await gaugeOn(20000); await W(300);
if (sloppy) await holdTo(needleAt(0.99), '05-cushion', 0.5); else await holdTo(pastBestMid, '05-cushion', 0.4);
await gaugeOn(20000); await W(400); await shot('05-gift-spin');
if (sloppy) { await W(900); await press(); } else await tapGood();
await clickChoice(1);
await gaugeOn(10000); await W(300);
if (sloppy) await holdTo(needleAt(0.99), '05-gift-handing', 0.5); else await holdTo(pastBestMid, '05-gift-handing', 0.5);

// A6 お茶（ためる。質問が来たらすぐはなす → 答える → もう一度飲む）
await until(() => __shosa.step === 'A6', null, 40000);
await gaugeOn(20000); await W(300);
await p.keyboard.down(' ');
await waitNeedle(needleAt(0.5)); await W(sloppy ? 1600 : 150);
await p.keyboard.up(' '); await W(120); await shot('06-tea-drinking');
if (sloppy) {
  // むせたあと、もう一度。今度は赤まで → あつっ → こぼす → 拭く
  await W(1500); await p.keyboard.down(' '); await waitNeedle(needleAt(0.99), 8000).catch(() => {}); await p.keyboard.up(' ');
  await clickChoice(1);
  await gaugeOn(15000); await W(300);
  for (let i = 0; i < 40 && await ev(() => !document.getElementById('gauge').hidden); i++) { await press(); await W(70); }
  await clickChoice(1);
} else {
  await clickChoice(1); await W(1500);
  await gaugeOn(10000); await p.keyboard.down(' '); await waitNeedle(inBest); await W(1300); await p.keyboard.up(' ');
}

// A7 結婚の意思（話の切れ目で言葉を押す）→ 二人でお辞儀
await until(() => __shosa.step === 'A7', null, 40000);
await gaugeOn(20000);
if (sloppy) { await W(4000); await shot('07-silence'); await clickChoice(3); }
else { await waitNeedle(inBest, 30000); await shot('07-silence'); await clickChoice(1); }
await gaugeOn(20000); await W(300); await holdTo(pastBestMid, '07-bow', 0.45);

// A8 立つ（連打）→ 待つ → お辞儀 → 戸の外 → 会釈
await until(() => __shosa.step === 'A8', null, 40000);
await gaugeOn(20000); await W(200);
if (sloppy) { for (let i = 0; i < 4; i++) { await press(); await W(80); } await W(1500); }
for (let i = 0; i < 250 && await ev(() => !document.getElementById('gauge').hidden && document.getElementById('gauge').querySelector('.cap').textContent === '立ち上がる'); i++) { await press(); await W(60); if (i === 6) await shot('08-stand'); }
await W(sloppy ? 300 : 3200);
if (sloppy) await press();
await until(() => document.getElementById('gauge').querySelector('.cap').textContent.includes('お辞儀') && !document.getElementById('gauge').hidden, null, 20000);
await W(300); await holdTo(pastBestMid, '08-farewell-bow', 0.4);
await until(() => document.getElementById('objective').textContent.includes('戸の外'), null, 20000);
await W(sloppy ? 100 : 2600); await press();   // clumsy は、相手がまだ頭を下げているうちに出る
await gaugeOn(20000); await W(500); await press();
try { await until(() => __shosa.mode === 'result', null, 30000); } catch (e) { await shot('09-stuck'); console.log('stuck', await ev(() => [__shosa.step, __shosa.mode, document.getElementById('objective').textContent, document.getElementById('gauge').hidden, document.getElementById('choices').textContent])); throw e; } await W(1000); await shot('09-result');

const res = await ev(() => ({ result: __shosa.result, tech: __shosa.story.tech, care: __shosa.story.care, mood: __shosa.story.mood, fps: Math.round(__shosa.fps) }));
console.log(JSON.stringify(res, null, 1));
console.log('errors:', errs.filter(e => !/PropertyBinding/.test(e)).slice(0, 10));
await b.close();
