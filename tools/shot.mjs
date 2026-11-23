// 画面を撮る：node tools/shot.mjs <url> <out.png> [js-to-run-before] [waitMs]
import { createRequire } from 'node:module';
const require = createRequire(process.env.HOME + '/.dev-browser/node_modules/');
const { chromium } = require('playwright');
const [url, out, js = '', wait = '4000'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
p.on('console', m => logs.push(m.type() + ': ' + m.text()));
p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
await p.goto(url);
await p.waitForTimeout(+wait);
if (js) { const r = await p.evaluate(js); if (r !== undefined) console.log('eval:', JSON.stringify(r)); await p.waitForTimeout(1500); }
await p.screenshot({ path: out });
console.log(logs.filter(l => !/GPU stall|Automatic fallback/.test(l)).slice(-15).join('\n'));
await b.close();
