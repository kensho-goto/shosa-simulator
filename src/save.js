// 保存：設定・進み具合・見つけた珍事（このブラウザの中だけ）
const KEY = 'shosa.v1';
const DEF = { settings: { subSize: 'm', sens: 1, assist: '0', quality: 'high', vol: 0.8 }, progress: {}, finds: {}, best: {} };
export function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d) return { ...DEF, ...d, settings: { ...DEF.settings, ...d.settings } }; } catch (e) { /* 使えない環境 */ }
  return structuredClone(DEF);
}
export function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* 保存できなくても遊べる */ } }
