// 人物：仮のモデルに「歩く・立つ・正座・お辞儀・手を伸ばす・見る・うなずく」を重ねる。
// 骨は世界座標の向きで合わせる（骨ごとの軸を決め打ちしない）。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = {};
export async function loadModels() {
  const names = ['Xbot'];
  await Promise.all(names.map(async n => { cache[n] = await loader.loadAsync(`assets/models/${n}.glb`); }));
  return cache;
}

const V = () => new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion();
const wpos = (o, out = V()) => o.getWorldPosition(out);
function applyWorldRot(bone, q) {
  bone.parent.getWorldQuaternion(tmpQ2);
  const inv = tmpQ2.clone().invert();
  const local = inv.multiply(q).multiply(tmpQ2);
  bone.quaternion.premultiply(local);
  bone.updateMatrixWorld(true);
}
export function rotWorld(bone, axis, angle) { applyWorldRot(bone, tmpQ.setFromAxisAngle(axis, angle).clone()); }
function aim(bone, child, dir) {
  const a = wpos(bone), b = wpos(child);
  const cur = b.sub(a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(cur, dir.clone().normalize());
  applyWorldRot(bone, q);
}
const ease = t => t * t * (3 - 2 * t);

export class Actor {
  constructor(scene, { model = 'Xbot', height = 1.7, name = '', look = {}, slim = 1 } = {}) {
    this.name = name;
    const src = cache[model];
    this.root = new THREE.Group(); scene.add(this.root);
    this.model = SkeletonUtils.clone(src.scene);
    this.root.add(this.model);
    this.model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        o.material = o.material.clone();
        const k = o.material.name || '';
        if (look.body && /Beta_HighLimbs|Ch03|Body/i.test(k)) o.material.color.set(look.body);
        if (look.joints && /Joints/i.test(k)) o.material.color.set(look.joints);
        if (look.rough != null) o.material.roughness = look.rough;
        if (o.material.metalness > 0.3) o.material.metalness = 0.1;
      }
    });
    // 身長をそろえる
    this.root.updateMatrixWorld(true);
    // 骨の位置で身長を測る（頭のてっぺん − 足先）
    let top = null, low = Infinity;
    this.model.traverse(o => { if (o.isBone) { const y = o.getWorldPosition(V()).y; if (/HeadTop_End/.test(o.name)) top = y; if (/Toe|Foot/.test(o.name)) low = Math.min(low, y); } });
    const h = (top - low) * 1.03;
    this.model.scale.multiplyScalar(height / h);
    this.model.scale.x *= slim; this.model.scale.z *= slim;
    this.height = height;
    this.root.updateMatrixWorld(true);
    // 骨
    const B = this.bones = {};
    this.model.traverse(o => { if (o.isBone) B[o.name.replace(/^mixamorig:?/, '')] = o; });
    // 動き（Xbot の待機・歩きをどちらのモデルにも使う）
    this.mixer = new THREE.AnimationMixer(this.model);
    const pick = n => {
      const c = THREE.AnimationClip.findByName(cache.Xbot.animations, n).clone();
      // 腰の位置の動きは使わない（その場で動かす）
      c.tracks = c.tracks.filter(t => !/Hips\.position/.test(t.name));
      return this.mixer.clipAction(c);
    };
    this.act = { idle: pick('idle'), walk: pick('walk') };
    this.act.idle.play(); this.act.walk.play();
    this.act.walk.setEffectiveWeight(0);
    this.mixer.update(Math.random() * 3);
    // 状態
    this.s = {
      speed: 0, seated: 0, seatedTarget: 0, bow: 0, bowSeated: 0,
      reach: { L: null, R: null }, reachW: { L: 0, R: 0 },
      look: null, lookW: 0, gesture: null, gt: 0, lean: 0, wobble: 0, headDown: 0,
      handsFront: 0,
    };
    this.t = Math.random() * 10;
    this.hipsRest = this.bones.Hips.position.clone();
  }
  get pos() { return this.root.position; }
  get yaw() { return this.root.rotation.y; }
  set yaw(v) { this.root.rotation.y = v; }
  forward(out = V()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  side(out = V()) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); } // 左手側
  pitchAxis() { return UP.clone().cross(this.forward()).normalize(); }
  headPos() { return wpos(this.bones.Head); }
  handPos(side = 'R') { return wpos(this.bones[side === 'R' ? 'RightHand' : 'LeftHand']); }
  gesture(kind, dur = 1.2) { this.s.gesture = kind; this.s.gt = 0; this.s.gdur = dur; }
  lookAt(target, w = 1) { this.s.look = target; this.s.lookW = w; }
  reach(side, target, w = 1) { this.s.reach[side] = target; this.s.reachWTarget = this.s.reachWTarget || {}; this.s.reachWTarget[side] = target ? w : 0; }
  turnTo(x, z) { this.yaw = Math.atan2(x - this.pos.x, z - this.pos.z); }

  update(dt) {
    this.t += dt;
    const s = this.s, B = this.bones;
    // 歩きと待機のまぜ方
    const w = THREE.MathUtils.clamp(s.speed / 1.1, 0, 1);
    this.act.walk.setEffectiveWeight(w); this.act.idle.setEffectiveWeight(1 - w);
    this.act.walk.timeScale = Math.max(0.6, s.speed / 1.15);
    this.mixer.update(dt);
    // 腰の位置は元に戻す
    B.Hips.position.copy(this.hipsRest);
    s.seated += (s.seatedTarget - s.seated) * Math.min(1, dt * 2.2);
    for (const k of ['L', 'R']) {
      const tw = (s.reachWTarget && s.reachWTarget[k]) || 0;
      s.reachW[k] += (tw - s.reachW[k]) * Math.min(1, dt * 6);
      if (s.reachW[k] < 0.01 && !tw) s.reach[k] = null;
    }
    this.root.updateMatrixWorld(true);
    this.applySeiza(ease(THREE.MathUtils.clamp(s.seated, 0, 1)));
    this.applyBow();
    this.applyArms();
    this.applyHead(dt);
  }

  // 正座（seated=1）。立った姿との間はまぜる。
  applySeiza(k) {
    if (k <= 0.001) return;
    const B = this.bones, f = this.forward(), side = this.side();
    const H = this.height / 1.7;
    const names = ['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
    const before = names.map(n => B[n].quaternion.clone());
    const p = this.pos;
    // 腰を下げる
    const hipW = wpos(B.Hips);
    const target = new THREE.Vector3(p.x, p.y + 0.36 * H, p.z).addScaledVector(f, -0.06 * H);
    const want = hipW.clone().lerp(target, k);
    B.Hips.parent.updateMatrixWorld(true);
    B.Hips.position.copy(B.Hips.parent.worldToLocal(want.clone()));
    this.root.updateMatrixWorld(true);
    for (const [L, sg] of [['Left', 1], ['Right', -1]]) {
      const up = B[L + 'UpLeg'], leg = B[L + 'Leg'], foot = B[L + 'Foot'], toe = B[L + 'ToeBase'];
      const thighLen = wpos(leg).distanceTo(wpos(up));
      const hy = wpos(up).y - p.y;
      const sinA = THREE.MathUtils.clamp((hy - 0.075 * H) / thighLen, -0.9, 0.9);
      const dThigh = f.clone().multiplyScalar(Math.sqrt(1 - sinA * sinA)).addScaledVector(UP, -sinA).addScaledVector(side, sg * 0.06).normalize();
      aim(up, leg, dThigh);
      const dShin = f.clone().multiplyScalar(-1).addScaledVector(UP, -0.03).addScaledVector(side, sg * 0.02).normalize();
      aim(leg, foot, dShin);
      if (toe) aim(foot, toe, f.clone().multiplyScalar(-0.35).addScaledVector(UP, -0.94).normalize());
    }
    if (k < 0.999) names.forEach((n, i) => { const full = B[n].quaternion.clone(); B[n].quaternion.copy(before[i]).slerp(full, k); });
    this.root.updateMatrixWorld(true);
  }

  // お辞儀（s.bow は度）。座っていれば座礼、立っていれば立礼。
  applyBow() {
    const s = this.s, B = this.bones;
    const deg = s.bow + s.headDown * 0.0;
    const lean = s.lean;
    if (Math.abs(deg) < 0.05 && Math.abs(lean) < 0.01 && s.wobble < 0.001) return;
    const ax = this.pitchAxis();
    const rad = THREE.MathUtils.degToRad(deg);
    const seat = ease(THREE.MathUtils.clamp(s.seated, 0, 1));
    const hipShare = 0.55 + 0.2 * seat;
    const wob = s.wobble ? Math.sin(this.t * 7.3) * s.wobble * 0.06 : 0;
    // 腰から折る（脚は元の向きのまま）
    const legs = ['Left', 'Right'].map(L => ({ L, knee: wpos(B[L + 'Leg']).clone(), foot: wpos(B[L + 'Foot']).clone(), toe: B[L + 'ToeBase'] ? wpos(B[L + 'ToeBase']).clone() : null }));
    rotWorld(B.Hips, ax, rad * hipShare + lean + wob);
    for (const g of legs) {
      aim(B[g.L + 'UpLeg'], B[g.L + 'Leg'], g.knee.clone().sub(wpos(B[g.L + 'UpLeg'])));
      aim(B[g.L + 'Leg'], B[g.L + 'Foot'], g.foot.clone().sub(wpos(B[g.L + 'Leg'])));
      if (g.toe) aim(B[g.L + 'Foot'], B[g.L + 'ToeBase'], g.toe.clone().sub(wpos(B[g.L + 'Foot'])));
    }
    const rest = rad * (1 - hipShare);
    rotWorld(B.Spine, ax, rest * 0.4); rotWorld(B.Spine1, ax, rest * 0.35); rotWorld(B.Spine2, ax, rest * 0.25);
    // 立って深く下げると腰を少し引く
    if (seat < 0.5 && deg > 5) {
      const back = this.forward().multiplyScalar(-Math.sin(rad * hipShare) * 0.12 * this.height / 1.7);
      const hw = wpos(B.Hips).add(back);
      B.Hips.position.copy(B.Hips.parent.worldToLocal(hw));
      this.root.updateMatrixWorld(true);
    }
  }

  // 腕：手を目標へ（2本の骨の計算）。目標がなければ姿勢に合わせた置き場所。
  applyArms() {
    const s = this.s, B = this.bones, f = this.forward(), side = this.side(), p = this.pos;
    const seat = ease(THREE.MathUtils.clamp(s.seated, 0, 1));
    const deg = s.bow;
    for (const [k, L, sg] of [['L', 'Left', 1], ['R', 'Right', -1]]) {
      let target = null, wgt = 0;
      if (s.reach[k] && s.reachW[k] > 0.01) { target = s.reach[k]; wgt = s.reachW[k]; }
      const def = this.defaultHand(k, sg, seat, deg);
      if (!def && !target) continue;
      const tgt = target ? (def ? def.clone().lerp(target, wgt) : target) : def;
      this.ik(L, sg, tgt);
    }
  }
  defaultHand(k, sg, seat, deg) {
    const f = this.forward(), side = this.side(), p = this.pos, H = this.height / 1.7;
    if (seat > 0.05) {
      // ももの上 → お辞儀が深いと床へ
      const thigh = p.clone().addScaledVector(f, 0.22 * H).addScaledVector(side, sg * 0.1 * H); thigh.y = p.y + 0.42 * H;
      const floor = p.clone().addScaledVector(f, (0.5 + 0.004 * deg) * H).addScaledVector(side, sg * 0.07 * H); floor.y = p.y + 0.02;
      const b = THREE.MathUtils.clamp((deg - 8) / 22, 0, 1);
      const seatHand = thigh.lerp(floor, ease(b));
      const stand = this.standHand(sg, deg);
      return stand.lerp(seatHand, seat);
    }
    if (deg > 1 || this.s.handsFront > 0.01) return this.standHand(sg, deg);
    return null;
  }
  standHand(sg, deg) {
    const f = this.forward(), side = this.side(), p = this.pos, H = this.height / 1.7;
    const hf = Math.max(this.s.handsFront, THREE.MathUtils.clamp(deg / 20, 0, 1));
    const rad = THREE.MathUtils.degToRad(deg) * 0.75;
    // 体の前、ももの前
    const h = p.clone().addScaledVector(side, sg * (0.16 - 0.08 * hf) * H).addScaledVector(f, (0.05 + 0.1 * hf + Math.sin(rad) * 0.25) * H);
    h.y = p.y + (0.82 - 0.1 * hf - (1 - Math.cos(rad)) * 0.35) * H;
    return h;
  }
  ik(L, sg, T) {
    const B = this.bones;
    const sh = B[L + 'Arm'], el = B[L + 'ForeArm'], ha = B[L + 'Hand'];
    const S = wpos(sh), E0 = wpos(el), H0 = wpos(ha);
    const l1 = S.distanceTo(E0), l2 = E0.distanceTo(H0);
    const toT = T.clone().sub(S); let d = toT.length();
    d = THREE.MathUtils.clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
    const dir = toT.normalize();
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const pole = new THREE.Vector3(0, -1, 0).addScaledVector(this.side(), sg * 0.7).addScaledVector(this.forward(), -0.4);
    const perp = pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    const E = S.clone().addScaledVector(dir, a).addScaledVector(perp, h);
    aim(sh, el, E.clone().sub(S));
    aim(el, ha, S.clone().addScaledVector(dir, d).sub(E));
    // 手のひらを下・指を前へ
    const mid = B[L + 'HandMiddle1'];
    if (mid) aim(ha, mid, dir.clone().multiplyScalar(0.6).addScaledVector(this.forward(), 0.4).addScaledVector(UP, -0.3));
  }

  applyHead(dt) {
    const s = this.s, B = this.bones;
    // 視線
    if (s.look && s.lookW > 0.01) {
      const hp = wpos(B.Head);
      const t = (s.look.isVector3 ? s.look : s.look.headPos ? s.look.headPos() : wpos(s.look));
      const d = t.clone().sub(hp);
      const f = this.forward();
      const yaw = THREE.MathUtils.clamp(Math.atan2(d.x, d.z) - this.yaw, -1.2, 1.2);
      const wrapYaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      const horiz = Math.hypot(d.x, d.z);
      const pitch = THREE.MathUtils.clamp(Math.atan2(d.y, horiz), -0.7, 0.5);
      rotWorld(B.Neck, UP, wrapYaw * 0.4 * s.lookW);
      rotWorld(B.Head, UP, wrapYaw * 0.6 * s.lookW);
      const ax = UP.clone().cross(f.applyAxisAngle(UP, wrapYaw * s.lookW)).normalize();
      rotWorld(B.Head, ax, -pitch * 0.8 * s.lookW);
    }
    // しぐさ
    if (s.gesture) {
      s.gt += dt; const u = s.gt / s.gdur;
      if (u >= 1) s.gesture = null;
      else {
        const env = Math.sin(Math.PI * u);
        const ax = this.pitchAxis();
        if (s.gesture === 'nod') rotWorld(B.Head, ax, Math.max(0, Math.sin(u * Math.PI * 4)) * 0.28 * env);
        if (s.gesture === 'shake') rotWorld(B.Head, UP, Math.sin(u * Math.PI * 6) * 0.3 * env);
        if (s.gesture === 'tilt') rotWorld(B.Head, this.forward(), 0.25 * env);
        if (s.gesture === 'flinch') { rotWorld(B.Spine2, ax, -0.18 * env); rotWorld(B.Head, ax, -0.2 * env); }
        if (s.gesture === 'sigh') { rotWorld(B.Spine2, ax, 0.12 * env); rotWorld(B.Head, ax, 0.25 * env); }
        if (s.gesture === 'lookdown') rotWorld(B.Head, ax, 0.45 * env);
      }
    }
  }
}
