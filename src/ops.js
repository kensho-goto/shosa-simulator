// 共通の操作。どの場面でも同じ入力で動く。
//   bow   … 姿勢：お辞儀（立礼・座礼）
//   hand  … 物の扱い：持つ・動かす・向きを変える・傾ける・離す
//   choose… 発言と視線：話す・待つ
//   walk  … 移動（足の置き場所を見張る）
//   posture … 姿勢：座る・立つ（押し続ける）
import * as THREE from 'three';

const ray = new THREE.Raycaster();
const tmp = new THREE.Vector3();
export function mousePlane(ctx, y) {
  ray.setFromCamera(new THREE.Vector2(ctx.input.mouse.nx, ctx.input.mouse.ny), ctx.R.camera);
  const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
  return ray.ray.intersectPlane(pl, new THREE.Vector3());
}
function pick(ctx, props) {
  ray.setFromCamera(new THREE.Vector2(ctx.input.mouse.nx, ctx.input.mouse.ny), ctx.R.camera);
  const hits = ray.intersectObjects(props.map(p => p.obj), true);
  if (!hits.length) {
    // 近くなら拾えるようにする（小さい物を狙いやすく）
    let best = null, bd = 0.09;
    for (const p of props) {
      const sp = p.pos.clone().project(ctx.R.camera);
      const d = Math.hypot(sp.x - ctx.input.mouse.nx, (sp.y - ctx.input.mouse.ny) * ctx.R.camera.aspect ** -1);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  let o = hits[0].object; while (o && !o.userData.prop) o = o.parent;
  return o ? o.userData.prop : null;
}

// ---------------- お辞儀 ----------------
export async function bow(ctx, o) {
  const p = ctx.actors.player, max = 70, zone = o.zone;
  const res = { maxDepth: 0, startAt: null, inZone: 0, stuck: false, bonk: false, late: false, pingpong: false, skipped: false, score: 0 };
  const npcs = (o.npcs || []).map(n => ({ depth: 30, hold: 0.9, ...n, st: 'wait', t: 0, again: false }));
  let t = 0, upT = null, allDoneAt = null;
  ctx.hud.keys([[ctx.easy ? 'act' : 'space', '押している間 頭をさげる（はなすと上がる）']]);
  const showMeter = () => ctx.easy
    ? ctx.hud.gauge(true, { value: p.s.bow / max, good: [zone[0] / max, zone[1] / max], best: [(zone[0] + 4) / max, (zone[1] - 4) / max], danger: [(zone[1] + 9) / max, 1], cap: o.cap || 'お辞儀の深さ' })
    : ctx.hud.meter(true, { value: p.s.bow / max, zone: [zone[0] / max, zone[1] / max], cap: o.cap || 'お辞儀の深さ' });
  ctx.sfx.play('rustle', 0.4);
  await ctx.until(dt => {
    t += dt;
    const rate = o.seated ? 46 : 58;
    if (ctx.input.bow) {
      const slow = p.s.bow > zone[0] ? 0.5 : 1;
      p.s.bow = Math.min(max, p.s.bow + rate * dt * slow);
      if (res.startAt == null && p.s.bow > 4) { res.startAt = t; ctx.sfx.play('rustle', 0.6); }
    } else p.s.bow = Math.max(0, p.s.bow - rate * 1.25 * dt);
    res.maxDepth = Math.max(res.maxDepth, p.s.bow);
    if (p.s.bow >= zone[0] && p.s.bow <= zone[1]) res.inZone += dt;
    if (res.startAt != null && p.s.bow < 2.5 && res.maxDepth > 6 && upT == null) upT = t;
    showMeter();
    // 相手のお辞儀
    for (const n of npcs) {
      const a = n.actor;
      if (n.st === 'wait' && ((n.at != null && t >= n.at) || (n.mirror && res.startAt != null && t >= res.startAt + 0.35))) { n.st = 'down'; n.t0 = t; }
      if (n.st === 'down') { a.s.bow = Math.min(n.depth, a.s.bow + 45 * dt); if (a.s.bow >= n.depth) { n.st = 'hold'; n.t = 0; } }
      if (n.st === 'hold') { n.t += dt; if (n.t > n.hold) n.st = 'up'; }
      if (n.st === 'up') { a.s.bow = Math.max(0, a.s.bow - 40 * dt); if (a.s.bow <= 0.5) { n.st = 'done'; a.s.bow = 0; } }
      // 遅れて下げたら、つられてもう一度（お辞儀の応酬）
      if (n.st === 'done' && !n.again && res.startAt != null && n.t0 != null && res.startAt > n.t0 + 1.8 && p.s.bow > zone[0]) {
        n.again = true; n.st = 'down'; n.depth *= 0.8; res.pingpong = true; res.late = true;
        o.onPingPong && o.onPingPong(n.actor);
      }
      // 近すぎると頭がぶつかる（かんたん操作では、深く下げすぎるとぶつかる）
      const tooDeep = ctx.easy && p.s.bow > zone[1] + 9;
      if (o.bonkWith === a && !res.bonk && a.s.bow > 15 && p.s.bow > 15 && (tooDeep || (!ctx.easy && Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) < 0.62))) {
        res.bonk = true; ctx.sfx.play('bonk'); ctx.rig.shake = 0.03; a.gesture('flinch', 0.8); p.gesture('flinch', 0.8);
        o.onBonk && o.onBonk();
      }
    }
    const npcDone = npcs.every(n => n.st === 'done');
    if (npcDone && allDoneAt == null) allDoneAt = t;
    // 頭が上がらない
    if (npcDone && !res.stuck && p.s.bow > zone[0] && allDoneAt != null && t - allDoneAt > 3.2) { res.stuck = true; o.onStuck && o.onStuck(); }
    if (upT != null && npcDone) return true;
    if (res.startAt == null && t > (o.timeout || 9)) { res.skipped = true; return true; }
    return false;
  });
  ctx.hud.meter(false); ctx.hud.gauge(false);
  // 点
  const d = res.maxDepth;
  const depthS = d >= zone[0] && d <= zone[1] ? 1 : Math.max(0, 1 - Math.min(Math.abs(d - zone[0]), Math.abs(d - zone[1])) / 18);
  const holdS = Math.min(1, res.inZone / (o.hold || 0.6));
  let timeS = 1;
  const ref = npcs.find(n => n.t0 != null);
  if (ref && res.startAt != null) timeS = Math.max(0, 1 - Math.max(0, Math.abs(res.startAt - ref.t0) - 0.8) / 2.5);
  res.score = res.skipped ? 0 : Math.max(0, 0.45 * depthS + 0.25 * holdS + 0.3 * timeS - (res.stuck ? 0.2 : 0) - (res.bonk ? 0.15 : 0));
  res.depthOk = depthS > 0.9; res.timeOk = timeS > 0.8;
  if (ctx.easy) judge(ctx, res.bonk ? 'funny' : res.skipped ? 'bad' : res.score > 0.85 ? 'best' : res.score > 0.6 ? 'good' : 'bad', res.bonk ? 'ごつん' : null);
  return res;
}

// ---------------- 持つ・動かす・向き・傾き・離す ----------------
export async function hand(ctx, o) {
  const st = { held: null, vel: new THREE.Vector3(), t: 0, tilt: 0, lastGoal: null, result: null, grabs: 0 };
  const A = ctx.actors.player, side = o.side || 'R';
  const assist = ctx.assist;
  const keys = o.keys || [['mouse', '押している間 持つ（はなすと置く）'], ...(o.rotate ? [['qe', '向きを変える']] : []), ...(o.tilt ? [['wheel', '傾ける（Z / X でも）']] : [])];
  ctx.hud.keys(keys);
  const k = o.stiff || 110, c = 2 * Math.sqrt(k) * (o.damp || 0.75);
  let res;
  await ctx.until(dt => {
    st.t += dt;
    const inp = ctx.input;
    // つかむ
    if (!st.held) {
      const cand = o.props.filter(p => !p.free && !p.done);
      const h = pick(ctx, cand);
      for (const p of o.props) p.setHighlight(p === h ? 1 : 0);
      if (h && inp.mouse.leftPressed) {
        st.held = h; h.held = true; st.vel.set(0, 0, 0); st.grabs++;
        h.setHighlight(0);
        ctx.sfx.play('rustle', 0.3);
        o.onGrab && o.onGrab(h, st);
      }
    }
    if (st.held) {
      const p = st.held;
      const y = typeof o.planeY === 'function' ? o.planeY(p, st) : o.planeY;
      const goal = mousePlane(ctx, y) || p.pos.clone();
      if (o.bounds) { goal.x = THREE.MathUtils.clamp(goal.x, o.bounds.x0, o.bounds.x1); goal.z = THREE.MathUtils.clamp(goal.z, o.bounds.z0, o.bounds.z1); }
      if (o.goal) o.goal(goal, p, st);
      // 緊張で手がふるえる（同じ動きのくり返し。練習で読める）
      const tr = (o.tremor ?? 0.006) * (assist ? 0.5 : 1);
      goal.x += Math.sin(st.t * 9.1) * tr; goal.y += Math.sin(st.t * 13.3) * tr * 0.6; goal.z += Math.sin(st.t * 7.7 + 1) * tr;
      const acc = goal.clone().sub(p.pos).multiplyScalar(k).addScaledVector(st.vel, -c);
      st.vel.addScaledVector(acc, dt);
      p.pos.addScaledVector(st.vel, dt);
      // 向き
      if (o.rotate) {
        let turn = inp.turn * 2.4 * dt * (inp.sens || 1);
        if (!o.tilt) turn += -inp.mouse.wheel * 0.18;
        p.obj.rotation.y += turn;
        if (assist && o.snapYaw != null && inp.turn === 0) {
          const dy = Math.atan2(Math.sin(o.snapYaw - p.obj.rotation.y), Math.cos(o.snapYaw - p.obj.rotation.y));
          if (Math.abs(dy) < 0.35) p.obj.rotation.y += dy * Math.min(1, dt * 6);
        }
      }
      if (o.tilt) {
        st.tilt = THREE.MathUtils.clamp(st.tilt + inp.mouse.wheel * 0.09 + inp.tilt * 1.3 * dt, 0, 1.7);
      }
      A.reach(side, p.pos.clone().add(o.handOffset || new THREE.Vector3(0, 0.03, 0)), 1);
      if (o.twoHands) A.reach(side === 'R' ? 'L' : 'R', p.pos.clone().add(new THREE.Vector3(0, 0.03, 0)).addScaledVector(A.side(), 0.12), 1);
      if (inp.mouse.leftReleased) {
        const r = o.onRelease ? o.onRelease(p, st) : 'done';
        A.reach(side, null); if (o.twoHands) A.reach(side === 'R' ? 'L' : 'R', null);
        p.held = false; const v = st.vel.clone(); st.held = null;
        if (r === 'drop') { p.drop(v); ctx.dropping = p; }
        if (r === 'done') { res = { prop: p, st }; return true; }
      }
    }
    // 落ちている物
    for (const p of o.props) if (p.free && p.step(dt)) { ctx.sfx.play('thud', 0.8); o.onLand && o.onLand(p, st); }
    if (o.onFrame) { const r = o.onFrame(dt, st); if (r) { res = r; return true; } }
    return false;
  });
  for (const p of o.props) p.setHighlight(0);
  A.reach('R', null); A.reach('L', null);
  return res;
}

// ---------------- 話す・待つ ----------------
// list: [{text}] / 戻り値 {index(1〜), t}。時間切れは index 0。
export async function choose(ctx, o) {
  let t = 0, idx = 0;
  ctx.hud.choices(o.list, { timer: o.timer || 0 });
  if (o.keys !== false) ctx.hud.keys([ctx.easy ? ['クリック', '言葉をえらぶ（1〜3 でも）'] : ['num', '話す'], ...(o.extraKeys || [])]);
  await ctx.until(dt => {
    t += dt;
    if (o.timer) ctx.hud.choiceTimer(1 - t / o.timer);
    const c = ctx.input.choice();
    if (c && c <= o.list.length) { idx = c; return true; }
    if (o.onFrame && o.onFrame(dt, t)) return true;
    if (o.timer && t >= o.timer) return true;
    return false;
  });
  ctx.hud.choices(null);
  return { index: idx, t };
}

// ---------------- 移動 ----------------
export async function walk(ctx, o) {
  const A = o.actor || ctx.actors.player;
  let dist = 0, foot = 1, t = 0;
  ctx.hud.keys([['wasd', '歩く'], ...(o.extraKeys || [])]);
  const res = { t: 0 };
  await ctx.until(dt => {
    t += dt;
    const m = ctx.input.move;
    // 画面の奥が「前」
    const cf = new THREE.Vector3(); ctx.R.camera.getWorldDirection(cf); cf.y = 0; cf.normalize();
    const cr = new THREE.Vector3(-cf.z, 0, cf.x);
    const dir = cf.multiplyScalar(m.y).add(cr.multiplyScalar(m.x));
    const spd = o.speed || 0.85;
    let moving = dir.lengthSq() > 0.01;
    if (moving) {
      dir.normalize();
      const want = Math.atan2(dir.x, dir.z);
      const dy = Math.atan2(Math.sin(want - A.yaw), Math.cos(want - A.yaw));
      A.yaw += dy * Math.min(1, dt * 8);
      const step = dir.multiplyScalar(spd * dt);
      const nx = A.pos.x + step.x, nz = A.pos.z + step.z;
      const ok = (x, z) => o.walkable(x, z);
      if (ok(nx, nz)) { A.pos.x = nx; A.pos.z = nz; }
      else if (ok(nx, A.pos.z)) A.pos.x = nx;
      else if (ok(A.pos.x, nz)) A.pos.z = nz;
      else moving = false;
      if (moving) {
        dist += spd * dt;
        if (dist > 0.36) {
          dist = 0; foot = -foot;
          const fp = A.pos.clone().addScaledVector(A.side(), foot * 0.09);
          ctx.sfx.play('step', 0.5);
          o.onStep && o.onStep(fp, foot);
        }
      }
    }
    A.s.speed += ((moving ? spd : 0) - A.s.speed) * Math.min(1, dt * 8);
    if (o.done && o.done(A, t)) return true;
    return false;
  });
  A.s.speed = 0;
  return res;
}

// ---------------- 座る・立つ（F を押し続ける） ----------------
// to: 1=正座へ / 0=立つ。numb（しびれ 0〜1）があると立つのが遅く、ふらつく。
export async function posture(ctx, o) {
  const A = ctx.actors.player;
  if (ctx.easy) return o.to === 1 ? autoSit(ctx) : mashStand(ctx, o);
  const need = o.to === 1 ? 0.9 : 0.9 + (o.numb || 0) * 1.6;
  let prog = 0, tries = 0, sankBack = false;
  ctx.hud.keys([['f', o.to === 1 ? '押し続けて 正座する' : '押し続けて 立ち上がる'], ...(o.extraKeys || [])]);
  ctx.hud.meter(true, { value: 0, zone: [0.98, 1], cap: o.to === 1 ? '座る' : '立つ' });
  await ctx.until(dt => {
    if (ctx.input.sit) prog = Math.min(need, prog + dt);
    else if (prog > 0) {
      // 途中ではなすと戻る（しびれていると、すとんと戻る）
      if (o.to === 0 && prog > 0.3 && (o.numb || 0) > 0.4 && !sankBack) { sankBack = true; o.onSink && o.onSink(); }
      prog = Math.max(0, prog - dt * 2.5);
    }
    const f = prog / need;
    A.s.seatedTarget = o.to === 1 ? f : 1 - f;
    A.s.seated = A.s.seatedTarget;
    A.s.wobble = o.to === 0 ? (o.numb || 0) * f * (1 - f) * 4 : 0;
    ctx.hud.meter(true, { value: f, zone: [0.98, 1], cap: o.to === 1 ? '座る' : '立つ' });
    if (o.onFrame) o.onFrame(dt, f);
    return prog >= need;
  });
  A.s.wobble = 0;
  A.s.seated = A.s.seatedTarget = o.to;
  ctx.hud.meter(false);
  ctx.sfx.play('rustle', 0.5);
  return { sankBack };
}

// ================= かんたん操作（押す・押しっぱなし・はなす の1つだけ） =================
// 判定の字と音
const WORD = { best: '見事', good: 'よし', bad: 'あっ', over: 'やりすぎ', funny: '珍事' };
export function judge(ctx, kind, text) {
  ctx.hud.stamp(text || WORD[kind] || kind, kind === 'over' ? 'bad' : kind);
  if (kind === 'best') ctx.sfx.play('best', 0.9);
  else if (kind === 'good') ctx.sfx.play('good', 0.7);
  else if (kind === 'funny') ctx.sfx.play('boing', 0.8);
  else ctx.sfx.play('awk', 0.5);
}
const tri = x => 1 - Math.abs(((x % 2) + 2) % 2 - 1);   // 0→1→0 をくり返す
const inZ = (v, z) => z && v >= z[0] && v <= z[1];

// 目押し：針が左右に動く。良いところで押す。
//  o: { cap, key, speed（1秒に何往復の半分）, good, best, phase, onValue(v), timeout, onTimeout }
//  戻り値 { v, grade: 'best'|'good'|'bad'|'none', t }
export async function tap(ctx, o) {
  let t = 0, v = 0, res = null;
  ctx.hud.keys([['act', o.key || '押す']]);
  await ctx.until(dt => {
    t += dt;
    v = tri((o.phase || 0) + t * (o.speed || 0.5) * 2);
    if (o.values) v = o.values(t);
    o.onValue && o.onValue(v, t);
    ctx.hud.gauge(true, { value: v, good: o.good, best: o.best, danger: o.danger, cap: o.cap });
    if (ctx.input.actHit && t > 0.15) { res = { v, t, grade: inZ(v, o.best) ? 'best' : inZ(v, o.good) ? 'good' : 'bad' }; return true; }
    if (o.timeout && t >= o.timeout) { res = { v, t, grade: 'none' }; return true; }
    return false;
  });
  ctx.hud.gauge(false);
  if (o.stamp !== false && res.grade !== 'none') judge(ctx, res.grade);
  return res;
}

// ためる：押している間ふえる。良いところで、はなす。1をこえると「やりすぎ」。
//  o: { cap, key, rate, good, best, danger, onValue(v, held), wait（押しはじめるまでの待ち）, timeout, onFrame(dt, v, held) }
//  戻り値 { v, grade: 'best'|'good'|'bad'|'over'|'none' }
export async function charge(ctx, o) {
  let t = 0, v = o.start || 0, started = false, res = null;
  ctx.hud.keys([['act', o.key || '押している間 ためる（はなすと決まる）']]);
  await ctx.until(dt => {
    t += dt;
    const held = ctx.input.act;
    if (held) { started = true; v += (o.rate || 0.5) * dt * (o.accel ? 0.6 + v : 1); }
    else if (!o.keep) v = Math.max(o.start || 0, v - (o.back || 0) * dt);
    o.onValue && o.onValue(Math.min(1.05, v), held);
    ctx.hud.gauge(true, { value: v, good: o.good, best: o.best, danger: o.danger, cap: o.cap });
    const f = o.onFrame && o.onFrame(dt, v, held, started);
    if (f) { res = { v, grade: f }; return true; }
    if (v >= 1) { res = { v: 1, grade: 'over' }; return true; }
    if (started && !held && (o.releaseEnds !== false)) { res = { v, grade: inZ(v, o.best) ? 'best' : inZ(v, o.good) ? 'good' : 'bad' }; return true; }
    if (!started && o.timeout && t >= o.timeout) { res = { v, grade: 'none' }; return true; }
    return false;
  });
  ctx.hud.gauge(false);
  if (o.stamp !== false && res.grade !== 'none' && !res.silent) judge(ctx, res.grade);
  return res;
}

// 連打：押すたびにふえ、待つと減る。1になれば成功。
export async function mash(ctx, o) {
  let t = 0, v = 0, n = 0, res = null;
  ctx.hud.keys([['act', o.key || 'くり返し押す']]);
  await ctx.until(dt => {
    t += dt;
    if (ctx.input.actHit) { v += o.per || 0.12; n++; o.onPress && o.onPress(v, n); }
    v = Math.max(0, v - (o.decay || 0.25) * dt);
    o.onValue && o.onValue(Math.min(1, v), t);
    ctx.hud.gauge(true, { value: v, good: [0.92, 1], cap: o.cap });
    if (v >= 1) { res = { ok: true, t, n }; return true; }
    if (o.timeout && t >= o.timeout) { res = { ok: false, t, n }; return true; }
    return false;
  });
  ctx.hud.gauge(false);
  return res;
}

// 座る：かんたん操作では、ひとりでに正座する
async function autoSit(ctx) {
  const A = ctx.actors.player;
  ctx.hud.keys([]);
  await ctx.tween(0.9, u => { A.s.seated = A.s.seatedTarget = u * u * (3 - 2 * u); });
  A.s.seated = A.s.seatedTarget = 1;
  ctx.sfx.play('rustle', 0.5);
  return { sankBack: false };
}
// 立つ：連打で立ち上がる。しびれていると、手を止めるとすとんと戻る
async function mashStand(ctx, o) {
  const A = ctx.actors.player, numb = o.numb || 0;
  let sankBack = false, peak = 0;
  const r = await mash(ctx, {
    cap: '立ち上がる', key: 'くり返し押して 立ち上がる', per: 0.1, decay: 0.06 + numb * 0.2,
    onValue: (v) => {
      A.s.seatedTarget = A.s.seated = 1 - v;
      A.s.wobble = numb * v * (1 - v) * 4;
      peak = Math.max(peak, v);
      if (numb > 0.4 && peak > 0.45 && v < peak - 0.3 && !sankBack) { sankBack = true; o.onSink && o.onSink(); }
    },
  });
  A.s.wobble = 0; A.s.seated = A.s.seatedTarget = 0;
  ctx.sfx.play('rustle', 0.5);
  return { sankBack, n: r.n };
}
