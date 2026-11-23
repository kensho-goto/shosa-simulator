// 人物の動作の受け持ち。操作（ボタン・キー）とは分けてあり、本編の会話や儀式の進行からも同じ命令で呼べる。
//
// 命令：look / walk / stop / bow / pick / place / give / receive
// 重なったときの決まり（command() の中）：
//   - 止まる … いつでも受ける。いまの動作を「壊れない形」で終える（下の各動作の stop の扱い）
//   - 見る   … いつでも受ける（動作とは別の通り道）
//   - 歩く中に歩く … 行き先を変える
//   - 歩く中にお辞儀 … いったん止まってから、お辞儀する（待機して続ける）
//   - そのほかの動作の途中 … 断る（理由を返す）
//   - 持っているのに持つ / 持っていないのに置く・渡す / 相手が持っている箱を持つ … 断る
//   - 箱が遠い … 近くまで歩いてから持つ（手へ吸い付けない）。手が届かなければ、手を戻して「届かない」と返す
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const V = () => new THREE.Vector3();
const clamp01 = v => Math.max(0, Math.min(1, v));
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const LABEL = { walk: '歩く', bow: 'お辞儀', pick: '箱を持つ', place: '箱を置く', give: '渡す', receive: '受け取る', regrip: '持ち直す', face: '向き直る' };

export class CharacterController {
  constructor(actor, { name, world }) {
    this.actor = actor; this.name = name; this.world = world;
    this.task = null; this.taskName = null; this.stopReq = false; this.queue = null;
    this.holding = null;                         // 持っている箱
    this.boxGoal = null;                          // 持っているときの、箱を置きたい姿勢 { center, tilt }
    this.walkGoal = null;
    this.clumsy = 0; this.exaggerate = false;     // 不器用さ（0＝自然）
    this.tiltSign = 1;
    this.handT = { L: null, R: null };            // 手首の目標（持っていないときの、伸ばす・戻す）
  }
  get busy() { return !!this.task; }
  get state() {
    if (this.taskName) return LABEL[this.taskName] || this.taskName;
    return this.holding ? '持って待機' : '待機';
  }
  // ---- 命令 ----
  command(name, arg) {
    const t = this.taskName;
    if (name === 'stop') { if (!t) return this.ok('止まっています'); this.stopReq = true; this.queue = null; return this.ok('止めます'); }
    if (name === 'look') { this.actor.lookAt(arg || null, arg ? 1 : 0); return this.ok(arg ? '見ます' : '視線を自由に'); }
    if (name === 'walk' && t === 'walk') { this.walkGoal = arg.clone(); return this.ok('行き先を変えます'); }
    if (name === 'bow' && t === 'walk') { this.stopReq = true; this.queue = ['bow', arg]; return this.ok('止まってからお辞儀します'); }
    if (t) return this.no(`いまは「${LABEL[t] || t}」の途中なので受け付けません（止めるには「止まる」）`);
    if (name === 'pick') {
      if (this.holding) return this.no('もう箱を持っています');
      if (arg.holder && arg.holder !== this) return this.no('相手が持っている箱は持てません');
      if (arg.falling) return this.no('箱が落ちている途中です');
    }
    if ((name === 'place' || name === 'give') && !this.holding) return this.no('箱を持っていません');
    if (name === 'give' && arg.busy) return this.no('相手が別の動作の途中です');
    const gen = this['_' + name] && this['_' + name](arg);
    if (!gen) return this.no('その命令はありません');
    this.start(name, gen);
    return this.ok(`「${LABEL[name]}」をはじめます`);
  }
  ok(msg) { return { ok: true, msg }; }
  no(msg) { return { ok: false, msg }; }
  start(name, gen) { this.task = gen; this.taskName = name; this.stopReq = false; gen.next(); }
  // いまの動作を、途中の形のまま強制で外す（最初に戻す用）
  hardReset() {
    this.task = null; this.taskName = null; this.stopReq = false; this.queue = null; this.walkGoal = null;
    this.holding = null; this.boxGoal = null; this.handT = { L: null, R: null }; this.handBox = null;
    const s = this.actor.s; s.hand.L = s.hand.R = null; s.speed = 0; s.bow = 0; s.handsFront = 0; s.keepLook = false; s.grip.L = s.grip.R = 0; s.smile = 0; s.worry = 0;
    this.actor.reach('L', null); this.actor.reach('R', null); s.reachW.L = s.reachW.R = 0; this.actor.lookAt(null, 0);
  }

  // ---- 毎フレーム（人物の計算の前）----
  update(dt) {
    if (this.task) {
      const r = this.task.next(dt);
      if (r.done) {
        this.task = null; const was = this.taskName; this.taskName = null; this.stopReq = false; this.handBox = null;
        this.world.emit && this.world.emit('done', this, was, r.value);
        if (this.queue) { const [n, a] = this.queue; this.queue = null; const res = this.command(n, a); this.world.emit && this.world.emit('msg', this, res.msg); }
      }
    }
    // 手：持っている箱の姿勢 → 手首の目標。持っていないときは handT
    const a = this.actor;
    if (this.holding && this.boxGoal && (!this.task || this.taskName === 'face')) this.followCarry(dt, 6);
    if (this.holding && this.boxGoal) {
      const it = this.holding, H = it.wristTargets(a, this.goalCenter(), a.yaw + it.yawOffset, this.boxGoal.tilt, it.gripDepth, true);
      a.reach('L', H.T.L, 1); a.reach('R', H.T.R, 1);
      a.s.hand.L = H.hands.L; a.s.hand.R = H.hands.R;
    } else {
      for (const k of ['L', 'R']) a.reach(k, this.handT[k], this.handT[k] ? 1 : 0);
      // 箱へ手を伸ばしている間：手のひらを箱の面へ向け、指をそろえて開く
      if (this.handBox) {
        const it = this.handBox, H = it.wristTargets(a, it.center, it.yaw, it.tilt, this.handBoxDepth ?? 0, true);
        for (const k of ['L', 'R']) { const h = H.hands[k]; a.s.hand[k] = a.s.grip[k] > 0.3 ? h : { mode: 'open', dir: h.dir, palm: h.palm }; }
      } else if (a.s.bow > 6 || a.s.handsFront > 0.3) { a.s.hand.L = a.s.hand.R = { mode: 'together' }; }
      else a.s.hand.L = a.s.hand.R = null;
    }
  }

  // ---- 動作の部品 ----
  *wait(sec) { let t = 0; while (t < sec) t += yield; }
  *tween(sec, fn) { let t = 0; while (t < sec) { const dt = yield; t += dt; fn(ease(clamp01(t / sec)), dt); } }
  // 持って運ぶ位置へ寄せる。体の向きに対して寄せるので、向きを変えても箱が横へ取り残されない
  followCarry(dt, rate) {
    const a = this.actor, c = this.boxGoal.center, f = a.forward(), sd = a.side();
    const rel = c.clone().sub(a.pos), goal = this.carryCenter().sub(a.pos);
    const lf = rel.dot(f), ls = rel.dot(sd), gf = goal.dot(f), gs = goal.dot(sd);
    const k = 1 - Math.exp(-dt * rate);
    const nf = lf + (gf - lf) * k, ns = ls + (gs - ls) * k, ny = rel.y + (goal.y - rel.y) * k;
    c.copy(a.pos).addScaledVector(f, nf).addScaledVector(sd, ns); c.y = a.pos.y + ny;
  }
  carryCenter() { const a = this.actor; return a.pos.clone().addScaledVector(a.forward(), 0.3).add(new THREE.Vector3(0, 0.6 * a.height, 0)); }
  restHand(k) { // 何も持たないときの手の位置（だいたい）
    const a = this.actor, sg = k === 'L' ? 1 : -1;
    return a.pos.clone().addScaledVector(a.side(), sg * 0.2 * a.height / 1.7).addScaledVector(a.forward(), 0.05).add(new THREE.Vector3(0, 0.47 * a.height, 0));
  }
  // 手が届くだけ前にかがむ（届かなければ深く、余れば浅く。毎コマ、実際の肩から測る）
  bendToward(dt, T, max = 60) {
    const a = this.actor, s = a.s;
    const err = Math.max(a.armSlack('L', T.L), a.armSlack('R', T.R)) + 0.012;
    s.bow = THREE.MathUtils.clamp(s.bow + THREE.MathUtils.clamp(err * 700, -40, 70) * dt, 0, max);
    return err;
  }
  // 傾くときは、上の手はそのままで下の手が下がる（箱の中心で回すと、上の手が肩より上へ行き届かない）
  goalCenter() { const g = this.boxGoal; return g.center.clone().addScaledVector(UP, -Math.abs(Math.sin(g.tilt)) * this.holding.size.w / 2); }
  holdTargets() { const it = this.holding, a = this.actor; return it.wristTargets(a, this.goalCenter(), a.yaw + it.yawOffset, this.boxGoal.tilt); }
  // 向き直る（その場で小さく足を運ぶ）
  *faceYaw(yaw, rate = 2.4) {
    const a = this.actor;
    while (Math.abs(angDiff(yaw, a.yaw)) > 0.02) {
      const dt = yield;
      const d = angDiff(yaw, a.yaw);
      a.yaw += Math.sign(d) * Math.min(Math.abs(d), rate * dt);
      a.s.speed = Math.min(0.25, Math.abs(d) * 0.6);
      this.carryTilt(dt, 0);
      if (this.stopReq) break;
    }
    a.s.speed = 0;
  }
  // 歩く：向きを変えながら進み、近づくと速さを落として止まる
  *walkTo(goal, { vmax = 0.85, stopDist = 0.03, ignore = null } = {}) {
    const a = this.actor; this.walkGoal = goal.clone();
    let v = a.s.speed || 0;
    for (;;) {
      const dt = yield;
      const g = this.walkGoal;
      const dx = g.x - a.pos.x, dz = g.z - a.pos.z, dist = Math.hypot(dx, dz);
      // ほかの人をよける（行き先のそばにいる人＝渡す相手などは、よけない）
      const gx = dx / (dist || 1), gz = dz / (dist || 1);
      let wx = gx, wz = gz;
      for (const q of (this.world.obstacles ? this.world.obstacles(this) : [])) {
        if (q === ignore) continue;
        const ox = a.pos.x - q.x, oz = a.pos.z - q.z, od = Math.hypot(ox, oz) || 1e-3;
        if (od > 1.1) continue;
        const ahead = -(ox * gx + oz * gz) / od;                       // 相手が前にいるほど 1 に近い
        if (ahead < -0.2) continue;
        const k = (1.1 - od) / 1.1 * (0.6 + ahead) * 2.0 * clamp01(dist / 0.5); // 着く直前は弱める
        let px = gz, pz = -gx; if (px * ox + pz * oz < 0) { px = -px; pz = -pz; } // 相手のいない側へ回る
        wx += (ox / od) * k * 0.5 + px * k; wz += (oz / od) * k * 0.5 + pz * k;
      }
      const want = Math.atan2(wx, wz), d = angDiff(want, a.yaw);
      // 大きく向きが違うときは、まず向き直る
      const turnRate = v < 0.2 ? 2.6 : 1.8;
      a.yaw += Math.sign(d) * Math.min(Math.abs(d), turnRate * dt);
      let target = Math.min(vmax, dist * 1.4) * clamp01(1 - (Math.abs(d) - 0.5) / 0.8);
      if (this.stopReq) target = 0;
      // 持っている箱が傾きすぎたら、止まって持ち直す
      if (this.holding && this.boxGoal && Math.abs(this.boxGoal.tilt) > (this.exaggerate ? 0.5 : 0.36)) target = 0;
      const acc = target > v ? 1.4 : 2.2;
      v += Math.sign(target - v) * Math.min(Math.abs(target - v), acc * dt);
      a.s.speed = Math.max(v, Math.abs(d) > 0.3 && dist > stopDist ? 0.2 : 0);
      a.pos.addScaledVector(a.forward(), v * dt);
      this.carryTilt(dt, v);
      if (this.holding && this.boxGoal && Math.abs(this.boxGoal.tilt) > (this.exaggerate ? 0.5 : 0.36) && v < 0.05) yield* this.regrip();
      if (this.stopReq && v < 0.02) { a.s.speed = 0; return 'stopped'; }
      if (dist < stopDist + v * 0.05 && v < 0.12) { a.s.speed = 0; return 'arrived'; }
    }
  }
  // 持って歩くときの箱：持ち上げた位置へなめらかに。不器用なら少しずつ傾いていく
  carryTilt(dt, v) {
    if (!this.holding || !this.boxGoal) return;
    this.followCarry(dt, 8);
    if (this.clumsy > 0 && v > 0.1) this.boxGoal.tilt += this.tiltSign * dt * this.clumsy * (0.12 + 0.45 * v) * (this.exaggerate ? 1.8 : 1);
  }
  // 持ち直す（失敗からの立て直し）
  *regrip() {
    const a = this.actor, it = this.holding;
    this.taskNameBefore = this.taskName; this.taskName = 'regrip';
    this.world.emit && this.world.emit('tilt', this, it);
    a.s.keepLook = true; const prevLook = a.s.look; a.lookAt(it.anchor, 1);
    a.s.worry = this.exaggerate ? 1 : 0.6;
    if (this.exaggerate) a.gesture('flinch', 0.6);
    yield* this.wait(0.35);
    const t0 = this.boxGoal.tilt;
    yield* this.tween(0.9, u => { this.boxGoal.tilt = t0 * (1 - u); });
    a.gesture('sigh', 1.0);
    yield* this.wait(0.5);
    a.s.worry = 0; a.s.keepLook = false; a.lookAt(prevLook, prevLook ? 1 : 0);
    this.tiltSign = Math.random() < 0.5 ? -1 : 1;
    this.taskName = this.taskNameBefore;
  }
  // 手首を、いまの位置から目標へ動かす（持っていないとき）
  *moveHands(targets, sec) {
    const a = this.actor;
    const from = { L: this.handT.L || a.handPos('L'), R: this.handT.R || a.handPos('R') };
    yield* this.tween(sec, u => { for (const k of ['L', 'R']) this.handT[k] = from[k].clone().lerp(targets[k], u); });
  }
  *retractHands(sec = 0.5) {
    if (!this.handT.L && !this.handT.R) return;
    yield* this.moveHands({ L: this.restHand('L'), R: this.restHand('R') }, sec);
    this.handT = { L: null, R: null };
  }

  // ---- 動作 ----
  *_walk(goal) {
    const r = yield* this.walkTo(goal);
    this.walkGoal = null;
    return r;
  }
  *_bow(o = {}) {
    const a = this.actor, s = a.s;
    const depth = o.depth ?? (this.holding ? 15 : 30);
    const holdSec = o.hold ?? 0.9;
    yield* this.tween(0.3, u => { s.handsFront = u; });
    const b0 = s.bow;
    let stopped = false;
    yield* this.tween(1.0, u => { s.bow = b0 + (depth - b0) * u; if (this.stopReq) stopped = true; });
    if (!stopped) { let t = 0; while (t < holdSec && !this.stopReq) t += yield; }
    const b1 = s.bow;
    yield* this.tween(this.stopReq ? 0.6 : 1.15, u => { s.bow = b1 * (1 - u); });
    yield* this.tween(0.3, u => { s.handsFront = 1 - u; });
    return this.stopReq ? 'stopped' : 'done';
  }
  *_pick(item) {
    const a = this.actor, s = a.s;
    // 近づく（遠ければ歩く）
    const c = item.center;
    const toMe = new THREE.Vector3(a.pos.x - c.x, 0, a.pos.z - c.z);
    const n = item.approachDir ? item.approachDir.clone() : (toMe.lengthSq() > 1e-4 ? toMe.normalize() : a.forward().negate());
    const ap = new THREE.Vector3(c.x, a.pos.y, c.z).addScaledVector(n, 0.34);
    if (Math.hypot(ap.x - a.pos.x, ap.z - a.pos.z) > 0.06) { const r = yield* this.walkTo(ap); if (r === 'stopped') return 'stopped'; }
    yield* this.faceYaw(Math.atan2(c.x - a.pos.x, c.z - a.pos.z));
    if (this.stopReq) return 'stopped';
    s.keepLook = true; a.lookAt(item.anchor, 1);
    this.handBox = item; this.handBoxDepth = 0;
    // 手を伸ばす（箱の少し手前・上へ → 触れる）
    const yaw = item.yaw;
    item.gripDepth = 0;
    const T = item.wristTargets(a, c, yaw, 0, 0);
    const pre = { L: T.L.clone().addScaledVector(a.side(), 0.07).addScaledVector(UP, 0.05), R: T.R.clone().addScaledVector(a.side(), -0.07).addScaledVector(UP, 0.05) };
    this.handT = { L: a.handPos('L'), R: a.handPos('R') };
    const fromH = { L: this.handT.L.clone(), R: this.handT.R.clone() };
    yield* this.tween(0.9, (u, dt) => { for (const k of ['L', 'R']) this.handT[k] = fromH[k].clone().lerp(pre[k], u); this.bendToward(dt, this.handT); });
    if (!this.stopReq) yield* this.tween(0.4, (u, dt) => { for (const k of ['L', 'R']) this.handT[k] = pre[k].clone().lerp(T[k], u); this.bendToward(dt, this.handT); });
    // 触れたか確かめる（届かないときは戻す）
    let reached = false;
    for (let w = 0; w < 1.2 && !this.stopReq;) {
      const dt = yield; w += dt; this.bendToward(dt, T);
      if (a.handPos('L').distanceTo(T.L) < 0.035 && a.handPos('R').distanceTo(T.R) < 0.035) { reached = true; break; }
    }
    if (!reached || this.stopReq) {
      this.handBox = null;
      yield* this.retractHands(0.5);
      const b = s.bow; yield* this.tween(0.6, u => { s.bow = b * (1 - u); });
      s.keepLook = false; a.lookAt(null, 0);
      return this.stopReq ? 'stopped' : 'unreachable';
    }
    // 握る → 持ち主になる → 持ち上げる
    yield* this.tween(0.25, u => { s.grip.L = s.grip.R = u; });
    if (!item.grab(this)) { yield* this.retractHands(0.4); s.grip.L = s.grip.R = 0; return 'taken'; }
    this.holding = item; this.handT = { L: null, R: null }; this.handBox = null;
    this.boxGoal = { center: item.center, tilt: 0 };
    const c0 = this.boxGoal.center.clone();
    yield* this.tween(0.35, (u, dt) => { this.boxGoal.center.copy(c0).addScaledVector(UP, 0.05 * u); this.bendToward(dt, this.holdTargets()); });
    const c1 = this.boxGoal.center.clone(), b1 = s.bow;
    yield* this.tween(0.8, u => { this.boxGoal.center.copy(c1).lerp(this.carryCenter(), u); s.bow = b1 * (1 - u); });
    s.keepLook = false; a.lookAt(null, 0);
    this.tiltSign = Math.random() < 0.5 ? -1 : 1;
    return 'held';
  }
  *_place(spot) {
    const a = this.actor, s = a.s, it = this.holding;
    const ap = spot.pos.clone().addScaledVector(spot.approachDir, 0.36); ap.y = a.pos.y;
    if (Math.hypot(ap.x - a.pos.x, ap.z - a.pos.z) > 0.06) { const r = yield* this.walkTo(ap); if (r === 'stopped') return 'stopped'; }
    yield* this.faceYaw(Math.atan2(spot.pos.x - a.pos.x, spot.pos.z - a.pos.z));
    if (this.stopReq) return 'stopped';
    s.keepLook = true; a.lookAt(it.anchor, 1);
    const above = spot.pos.clone().add(new THREE.Vector3(0, it.size.h / 2 + 0.05, 0));
    const onIt = spot.pos.clone().add(new THREE.Vector3(0, it.size.h / 2, 0));
    const c0 = this.boxGoal.center.clone();
    yield* this.tween(0.9, (u, dt) => { this.boxGoal.center.copy(c0).lerp(above, u); this.bendToward(dt, this.holdTargets()); this.boxGoal.tilt *= 0.9; });
    if (this.stopReq) return yield* this.backToCarry();
    yield* this.tween(0.45, (u, dt) => { this.boxGoal.center.copy(above).lerp(onIt, u); this.bendToward(dt, this.holdTargets()); });
    // 着いたか（箱の底と面の差）
    for (let w = 0; w < 0.8;) { const dt = yield; w += dt; this.bendToward(dt, this.holdTargets()); if (Math.abs(it.obj.position.y - spot.pos.y) < 0.012 && Math.abs(it.tilt) < 0.08) break; }
    if (Math.abs(it.obj.position.y - spot.pos.y) > 0.03) return yield* this.backToCarry('unreachable');
    // 面に着けてから手を離す
    const restPos = it.obj.position.clone(); restPos.y = spot.pos.y;
    const handsNow = { L: a.handPos('L'), R: a.handPos('R') };
    it.rest(restPos, it.yaw); this.holding = null; this.boxGoal = null; this.handT = handsNow; this.handBox = it; this.handBoxDepth = it.gripDepth;
    yield* this.tween(0.22, u => { s.grip.L = s.grip.R = 1 - u; });
    yield* this.moveHands({ L: handsNow.L.clone().addScaledVector(a.side(), 0.06).addScaledVector(UP, 0.03), R: handsNow.R.clone().addScaledVector(a.side(), -0.06).addScaledVector(UP, 0.03) }, 0.3);
    const b1 = s.bow;
    this.handBox = null;
    yield* this.retractHands(0.55);
    yield* this.tween(0.6, u => { s.bow = b1 * (1 - u); });
    s.keepLook = false; a.lookAt(null, 0);
    return 'placed';
  }
  *backToCarry(result = 'stopped') {
    const s = this.actor.s, c0 = this.boxGoal.center.clone(), b0 = s.bow;
    yield* this.tween(0.6, u => { this.boxGoal.center.copy(c0).lerp(this.carryCenter(), u); s.bow = b0 * (1 - u); });
    s.keepLook = false; this.actor.lookAt(null, 0);
    return result;
  }
  // 渡す：相手の前へ行き、差し出し、相手が両手で持った瞬間に持ち主が移る
  *_give(other) {
    const a = this.actor, s = a.s, it = this.holding, o = other.actor;
    const dir = new THREE.Vector3(a.pos.x - o.pos.x, 0, a.pos.z - o.pos.z).normalize();
    const ap = o.pos.clone().addScaledVector(dir, 0.78); ap.y = a.pos.y;
    a.lookAt(o, 1);
    if (Math.hypot(ap.x - a.pos.x, ap.z - a.pos.z) > 0.06) { const r = yield* this.walkTo(ap, { ignore: o.pos }); if (r === 'stopped') return 'stopped'; }
    yield* this.faceYaw(Math.atan2(o.pos.x - a.pos.x, o.pos.z - a.pos.z));
    if (this.stopReq) return 'stopped';
    other.command('receive', { item: it, giver: this });
    // 差し出す（二人の間、胸の下あたり）
    const mid = a.pos.clone().lerp(o.pos, 0.5); mid.y = a.pos.y + 0.55 * a.height;
    const c0 = this.boxGoal.center.clone();
    const gd0 = it.gripDepth;
    yield* this.tween(0.8, u => { this.boxGoal.center.copy(c0).lerp(mid, u); this.boxGoal.tilt *= 0.9; s.bow = 8 * u; it.gripDepth = gd0 + (-0.05 - gd0) * u; });
    it.offeredBy = this;
    s.keepLook = true; a.lookAt(it.anchor, 0.6);
    let t = 0;
    while (it.holder === this && t < 6 && !this.stopReq) t += yield;
    it.offeredBy = null;
    if (it.holder === this) { other.command('stop'); return yield* this.backToCarry(this.stopReq ? 'stopped' : 'notTaken'); }
    // 持ち主が移った → 手を離して下がる
    const handsNow = { L: a.handPos('L'), R: a.handPos('R') };
    this.holding = null; this.boxGoal = null; this.handT = handsNow; this.handBox = it; this.handBoxDepth = 0.05;
    yield* this.tween(0.2, u => { s.grip.L = s.grip.R = 1 - u; });
    yield* this.moveHands({ L: handsNow.L.clone().addScaledVector(a.forward(), -0.08), R: handsNow.R.clone().addScaledVector(a.forward(), -0.08) }, 0.3);
    this.handBox = null;
    yield* this.retractHands(0.5);
    s.keepLook = false; a.lookAt(o, 1);
    yield* this.tween(0.6, u => { s.bow = 8 + 10 * u; });
    yield* this.wait(0.4);
    yield* this.tween(0.8, u => { s.bow = 18 * (1 - u); });
    s.smile = 0.3;
    return 'given';
  }
  // 受け取る（相手の give から呼ばれる）
  *_receive({ item, giver }) {
    const a = this.actor, s = a.s, g = giver.actor;
    a.lookAt(g, 1);
    yield* this.faceYaw(Math.atan2(g.pos.x - a.pos.x, g.pos.z - a.pos.z));
    while (item.offeredBy !== giver && !this.stopReq) { yield; if (item.holder !== giver) return 'cancel'; }
    if (this.stopReq) return 'stopped';
    s.keepLook = true; a.lookAt(item.anchor, 1); s.smile = 0.25;
    this.handBox = item; this.handBoxDepth = -0.05;
    // 相手が持っている側と反対の半分を持つ
    const depth = -0.05;
    const targetNow = () => item.wristTargets(a, item.center, item.yaw, item.tilt, depth);
    this.handT = { L: a.handPos('L'), R: a.handPos('R') };
    const from = { L: this.handT.L.clone(), R: this.handT.R.clone() };
    let t = 0;
    while (t < 0.9) { const dt = yield; t += dt; const u = ease(clamp01(t / 0.9)); const T = targetNow(); for (const k of ['L', 'R']) this.handT[k] = from[k].clone().lerp(T[k], u); this.bendToward(dt, this.handT, 25); if (this.stopReq) return yield* this.retractHands(0.4); }
    let ok = false;
    for (let w = 0; w < 1.0;) {
      const dt = yield; w += dt; const T = targetNow(); this.handT = T; this.bendToward(dt, T, 25);
      if (a.handPos('L').distanceTo(T.L) < 0.035 && a.handPos('R').distanceTo(T.R) < 0.035) { ok = true; break; }
    }
    if (!ok) { this.handBox = null; yield* this.retractHands(0.4); return 'unreachable'; }
    yield* this.tween(0.25, u => { s.grip.L = s.grip.R = u; });
    if (!item.transfer(giver, this, depth)) { yield* this.retractHands(0.4); s.grip.L = s.grip.R = 0; return 'cancel'; }
    this.holding = item; this.handT = { L: null, R: null }; this.handBox = null;
    this.boxGoal = { center: item.center, tilt: 0 };
    yield* this.wait(0.35);
    const c0 = this.boxGoal.center.clone();
    const rb = s.bow; yield* this.tween(0.8, u => { this.boxGoal.center.copy(c0).lerp(this.carryCenter(), u); s.bow = rb * (1 - u); });
    item.gripDepth = depth;
    s.keepLook = false; a.lookAt(g, 1); a.gesture('nod', 1.0); s.smile = 0.45;
    return 'received';
  }
}
