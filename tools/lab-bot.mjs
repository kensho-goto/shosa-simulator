// 人物の確認室を、パネルのボタンとキーだけで動かして確かめる台本。
// node tools/lab-bot.mjs [出力フォルダー] [url]
// 確かめること：手と箱が離れない／めり込まない、置いた箱が台の上、受け渡しが1回だけ、重なった命令を断る、最初に戻す、画面の速さ。
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
const require = createRequire(process.env.HOME + '/.dev-browser/node_modules/');
const { chromium } = require('playwright');
const out = process.argv[2] || 'docs/lab'; fs.mkdirSync(out, { recursive: true });
const url = process.argv[3] || 'http://127.0.0.1:8150/lab.html';
const VIDEO = process.env.LAB_VIDEO === '1';
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, ...(VIDEO ? { recordVideo: { dir: out + '/video', size: { width: 1280, height: 720 } } } : {}) });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const W = ms => p.waitForTimeout(ms);
const ev = (f, a) => p.evaluate(f, a);
const until = async (f, a, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(f, a)) return true; await W(80); } const lg = await ev(() => __lab.log.slice(-6).map(l => l.text)); const stt = await ev(() => ({ m: __lab.ctl.main.taskName, p: __lab.ctl.partner.taskName, pos: __lab.people.main.pos.toArray().map(v => +v.toFixed(2)) })); throw new Error('timeout: ' + f.toString().slice(0, 100) + '\n' + lg.join('\n') + '\n' + JSON.stringify(stt)); };
const shot = n => p.screenshot({ path: `${out}/${n}.jpg`, quality: 88 });
const click = sel => p.click(sel);
const lastMsg = () => ev(() => __lab.log.at(-1));
const results = []; const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log((ok ? 'OK ' : 'NG ') + name + (detail ? '  ' + detail : '')); };
const idle = k => until(k => !__lab.ctl[k].busy, k, 30000);

// 持っている間、手と箱の「握る面」のずれを測り続ける
await p.goto(url);
await until(() => window.__lab && (__lab.ready || __lab.error), null, 60000);
if (await ev(() => __lab.error)) { console.log(await ev(() => __lab.error)); process.exit(1); }
await ev(() => {
  window.__probe = { max: 0, n: 0, sum: 0, holders: [], lastHolder: null, tilt: 0 };
  const tick = () => {
    const bx = __lab.box, h = bx.holder;
    const name = h ? h.name : null;
    if (name !== __probe.lastHolder) { __probe.holders.push(name); __probe.lastHolder = name; }
    if (h && h.boxGoal) {
      const a = h.actor;
      const T = bx.wristTargets(a, bx.center, bx.yaw, bx.tilt);
      const e = Math.max(a.handPos('L').distanceTo(T.L), a.handPos('R').distanceTo(T.R));
      __probe.max = Math.max(__probe.max, e); __probe.sum += e; __probe.n++;
      __probe.tilt = Math.max(__probe.tilt, Math.abs(bx.tilt));
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await W(1500);

// 1) 立ち姿・顔（確かめ用の安定した照明）
for (const [i, c] of ['full', 'face', 'profile', 'talk'].entries()) { await click(`[data-cam=${c}]`); await W(1600); await shot(`0${i + 1}-studio-${c}`); }
await click('[data-look=camera]'); await click('[data-cam=face]'); await W(1800); await shot('05-studio-face-look-camera');
await click('[data-look=none]');
await click('[data-cam=full]'); await W(800);

// 2) 歩いて止まる（途中で「止まる」）
await click('[data-walk=B]'); await W(900);
await shot('06-walk');
await click('[data-cmd=stop]'); await idle('main');
const st = await ev(() => ({ speed: __lab.people.main.s.speed, x: __lab.people.main.pos.x }));
check('歩く途中で止まる', st.speed === 0 && st.x < 1.0, `止まった位置 x=${st.x.toFixed(2)}`);

// 3) 歩く途中のお辞儀 → 止まってからお辞儀
await click('[data-walk=A]'); await W(600);
await click('[data-cmd=bow]');
const m1 = await lastMsg(); check('歩く途中のお辞儀は、止まってから行う', m1.ok && m1.text.includes('止まってから'), m1.text);
await until(() => __lab.people.main.s.bow > 25, null, 8000); await shot('07-bow');
await idle('main');

// 4) お辞儀の途中に箱を持つ → 断る
await click('[data-cmd=bow]'); await W(300); await click('[data-cmd=pick]');
const m2 = await lastMsg(); check('動作の途中の別の動作は断る', !m2.ok, m2.text);
await idle('main');

// 5) 持っていないのに置く → 断る
await click('[data-cmd=placeB]');
const m3 = await lastMsg(); check('持っていないのに置くは断る', !m3.ok, m3.text);

// 6) 箱を持つ（遠いので歩いて近づく）→ 台Bに置く
await click('[data-cam=hands]');
await click('[data-cmd=pick]');
await until(() => __lab.people.main.s.grip.L > 0.95, null, 15000); await W(150); await shot('08-pick-grip');
await click('[data-cam=profile]'); await W(400); await shot('09-pick-grip-profile');
await click('[data-cam=full]');
await until(() => __lab.ctl.main.holding && !__lab.ctl.main.busy, null, 15000); await W(400); await shot('10-holding');
await click('[data-cam=hands]'); await W(1400); await shot('10b-hands-hold'); await click('[data-cam=full]');
await click('[data-cmd=pick]'); const m4 = await lastMsg(); check('持っているのに持つは断る', !m4.ok, m4.text);
await click('[data-cmd=placeB]');
await until(() => !__lab.box.holder, null, 20000); await shot('11-place');
await idle('main');
const pl = await ev(() => { const q = __lab.box.obj.position; return { x: q.x, y: q.y, z: q.z }; });
check('置いた箱が台Bの上にある', Math.abs(pl.x - 1.2) < 0.12 && Math.abs(pl.y - 0.7) < 0.005 && Math.abs(pl.z - 0.85) < 0.12, `箱の底 (${pl.x.toFixed(2)}, ${pl.y.toFixed(3)}, ${pl.z.toFixed(2)})`);
let pr = await ev(() => ({ ...__probe }));
check('持っている間、手と箱が離れない・めり込まない（3.5cm 以内）', pr.max < 0.035, `最大 ${(pr.max * 100).toFixed(1)}cm・平均 ${(pr.sum / pr.n * 100).toFixed(1)}cm（${pr.n} コマ）`);

// 7) 相手に渡す（持ち主の切り替えは1回だけ）
await ev(() => { __probe.holders = []; __probe.lastHolder = null; __probe.max = 0; __probe.sum = 0; __probe.n = 0; });
await click('[data-cmd=pick]'); await until(() => __lab.ctl.main.holding && !__lab.ctl.main.busy, null, 15000);
await click('[data-cmd=give]');
await click('[data-cam=room]');
await until(() => __lab.box.offeredBy, null, 15000); await W(500); await shot('12-give-offer');
await until(() => __lab.box.holder && __lab.box.holder.name === 'partner', null, 15000); await W(200); await shot('13-give-handover');
await idle('main'); await idle('partner');
pr = await ev(() => ({ ...__probe, holders: __probe.holders.slice() }));
const seq = pr.holders.filter((h, i) => i === 0 || h !== pr.holders[i - 1]).join('→');
check('受け渡しで持ち主が1回だけ移る（本人→相手役）', seq === 'null→main→partner' || seq === 'main→partner', seq);
check('受け渡しの間も手と箱が離れない（3.5cm 以内）', pr.max < 0.035, `最大 ${(pr.max * 100).toFixed(1)}cm`);
await click('[data-cmd=pick]'); const m5 = await lastMsg(); check('相手が持っている箱は持てない', !m5.ok, m5.text);
await W(400); await shot('14-after-give');

// 8) 最初に戻す
await click('[data-cmd=reset]'); await W(600);
const rs = await ev(() => ({ holder: __lab.box.holder, y: __lab.box.obj.position.y, x: __lab.box.obj.position.x, busy: __lab.ctl.main.busy || __lab.ctl.partner.busy, mx: __lab.people.main.pos.x }));
check('最初に戻す', !rs.holder && Math.abs(rs.x + 1.2) < 0.01 && Math.abs(rs.y - 0.7) < 0.001 && !rs.busy && Math.abs(rs.mx + 0.35) < 0.01);

// 9) 失敗1つ：不器用＋大げさで持って歩く → 傾く → 気づいて持ち直す → 相手役が気づく
await click('[data-clumsy="2"]');
await click('[data-cmd=pick]'); await until(() => __lab.ctl.main.holding && !__lab.ctl.main.busy, null, 15000);
await ev(() => { __probe.max = 0; __probe.sum = 0; __probe.n = 0; __probe.tilt = 0; });
await click('[data-walk=B]');
let tilted = true; try { await until(() => __lab.ctl.main.taskName === 'regrip', null, 15000); } catch { tilted = false; }
if (tilted) { await W(250); await click('[data-cam=talk]'); await W(500); await shot('15-fail-regrip'); await click('[data-cam=room]'); await W(600); await shot('16-fail-partner-notices'); }
await idle('main');
pr = await ev(() => ({ ...__probe }));
const pw = await ev(() => __lab.log.some(l => l.text.includes('着きました')));
check('不器用：箱が傾き、止まって持ち直してから着く', tilted && pw, `最大の傾き ${(pr.tilt * 57.3).toFixed(0)}°`);
check('持ち直しの間も手と箱が離れない（3.5cm 以内）', pr.max < 0.035, `最大 ${(pr.max * 100).toFixed(1)}cm`);
await click('[data-cmd=placeB]'); await until(() => !__lab.box.holder, null, 20000); await idle('main');
await click('[data-clumsy="0"]');

// 10) 和室の照明
await click('[data-cmd=reset]'); await click('[data-light=washitsu]');
for (const [i, c] of ['full', 'face', 'profile', 'room'].entries()) { await click(`[data-cam=${c}]`); await W(1600); await shot(`2${i}-washitsu-${c}`); }

// 11) 画面の速さ（全身の視点で各8秒・止まっている／歩いている）
const measure = async (label, light, q) => {
  await click(`[data-light=${light}]`); await click(`[data-q=${q}]`); await click('[data-cam=full]'); await W(1500);
  await ev(() => { __lab.fps.samples.length = 0; });
  await click('[data-walk=A]'); await W(2500); await click('[data-walk=B]'); await W(5500);
  const s = await ev(() => __lab.fps.samples.slice());
  const res = await ev(() => __lab.resolution());
  const avg = s.reduce((a, b) => a + b, 0) / s.length, min = Math.min(...s);
  return { label, light, quality: q, resolution: res, avg: +avg.toFixed(1), min: +min.toFixed(1), samples: s.length };
};
const perf = [];
perf.push(await measure('確かめ用照明・きれい', 'studio', 'high'));
perf.push(await measure('和室照明・きれい', 'washitsu', 'high'));
perf.push(await measure('和室照明・かるい', 'washitsu', 'low'));
for (const r of perf) console.log(`速さ ${r.label}: 平均 ${r.avg} / 最低 ${r.min} コマ/秒（${r.resolution}）`);

check('ページのエラーなし', errs.length === 0, errs.slice(0, 3).join(' / '));
const env = { machine: `${os.cpus()[0].model} ・ メモリ ${(os.totalmem() / 2 ** 30).toFixed(0)}GB ・ macOS ${os.release()}`, browser: `Chrome（Playwright・ANGLE Metal）`, viewport: '1280×720（画面の倍率 1）' };
fs.writeFileSync(out + '/lab-result.json', JSON.stringify({ date: new Date().toISOString(), env, results, perf, errors: errs }, null, 2));
await ctx.close(); await b.close();
console.log(results.every(r => r.ok) ? 'すべて通過' : '通らない項目あり');
