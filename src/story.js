// 進行の管理：段取り（ステップ）を順に動かす・やり直す・結果をまとめる。
export class Abort extends Error { constructor() { super('abort'); } }

// 毎フレーム見張って、条件がそろったら次へ進む待ち合わせ
export class Runner {
  constructor() { this.t = 0; this.waiters = []; }
  tick(dt) {
    this.t += dt;
    const ws = this.waiters; this.waiters = [];
    for (const w of ws) {
      if (!w.token.alive) { w.rej(new Abort()); continue; }
      let done = false;
      try { done = w.cond(dt); } catch (e) { w.rej(e); continue; }
      if (done) w.res(done); else this.waiters.push(w);
    }
  }
  until(token, cond) {
    if (!token.alive) return Promise.reject(new Abort());
    return new Promise((res, rej) => this.waiters.push({ cond, res, rej, token }));
  }
}

// その回の記録：空気・人の気持ち・所作の点・配慮の点・見つけた珍事
export class Story {
  constructor(finds) {
    this.catalog = finds;
    this.reset();
  }
  reset() {
    this.mood = 62;
    this.npc = {};
    this.tech = {};      // ステップごとの所作の点 0〜1
    this.care = {};      // ステップごとの配慮・立て直しの点（足し引き）
    this.found = [];     // この回で見つけた珍事
    this.log = [];
    this.done = {};      // 終えたステップ
    this.rush = null;    // お茶の間ラッシュの記録
  }
  feel(who, kind, amt = 1) {
    const n = this.npc[who] || (this.npc[who] = { 期待: 1, 戸惑い: 0, 気まずさ: 0, 助け舟: 0, 納得: 0 });
    n[kind] = (n[kind] || 0) + amt;
  }
  moodAdd(d) { this.mood = Math.max(0, Math.min(100, this.mood + d)); }
  setTech(step, v) { this.tech[step] = Math.max(0, Math.min(1, v)); }
  addCare(step, d, why) { this.care[step] = (this.care[step] || 0) + d; this.log.push({ step, d, why }); }
  find(id) {
    if (this.found.includes(id)) return null;
    this.found.push(id);
    return this.catalog[id];
  }
  summary(stepIds) {
    const t = stepIds.filter(s => this.tech[s] != null).map(s => this.tech[s]);
    const tech = t.length ? Math.round(100 * t.reduce((a, b) => a + b, 0) / t.length) : 0;
    const careSum = Object.values(this.care).reduce((a, b) => a + b, 0);
    const care = Math.round(Math.max(0, Math.min(100, 55 + careSum * 6 + (this.mood - 60) * 0.5)));
    const complete = stepIds.every(s => this.done[s]);
    return { complete, tech, care, finds: this.found.slice() };
  }
}

export const grade = v => v >= 90 ? '秀' : v >= 75 ? '優' : v >= 60 ? '良' : v >= 40 ? '可' : '要練習';
