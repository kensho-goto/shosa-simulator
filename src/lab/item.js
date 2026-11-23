// 持てる物（手土産の箱など）。持ち主は必ず1人だけ（holder）。持ち主がいる間は、持ち主の「実際の手首の位置」から箱の位置を決める。
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
export const WRIST = { out: 0.022, back: 0.075, up: 0.0 }; // 手のひらの中心 → 手首（骨の位置）のずれ
export const GRIP = { up: 0.012, angle: 0.5 }; // 手のひらは側面の中ほどより少し上。指は前へ、少し下向き（底の下へ指先を回す）

export class Holdable {
  constructor(obj, { name, w, h, d, floorAt }) {
    this.obj = obj; this.name = name; this.size = { w, h, d }; this.floorAt = floorAt;
    this.holder = null;      // いま持っている人（CharacterController）
    this.yawOffset = 0;      // 持ち主の向きに対する箱の向き
    this.gripDepth = 0;      // 持ち主が箱のどこを持つか（手前がマイナス）
    this.tilt = 0;           // 左右の傾き（実際の手から決まる）
    this.vel = new THREE.Vector3(); this.falling = false;
    this._yaw = obj.rotation.y;   // 向き（オイラー角の y は ±90° を越えると折り返すので、自分で持つ）
    this.anchor = new THREE.Object3D(); obj.add(this.anchor); this.anchor.position.y = h / 2; // 箱の中心（見る先に使う）
  }
  // 箱の中心（描画前でもずれないよう、位置と回転から直接求める）
  get center() { return new THREE.Vector3(0, this.size.h / 2, 0).applyQuaternion(this.obj.quaternion).add(this.obj.position); }
  get yaw() { return this._yaw; }
  // 置く：持ち主をなくし、面の上に寝かせる
  rest(pos, yaw) {
    this.holder = null; this.falling = false; this.vel.set(0, 0, 0); this.tilt = 0;
    this.obj.position.copy(pos); this.obj.rotation.set(0, yaw, 0); this._yaw = yaw;
  }
  grab(ctl) { if (this.holder && this.holder !== ctl) return false; this.holder = ctl; this.falling = false; this.yawOffset = this.yaw - ctl.actor.yaw; return true; }
  // 受け渡し：持ち主が from のときだけ、to に移す（この一瞬で切り替わる）
  transfer(from, to, gripDepth = 0) {
    if (this.holder !== from) return false;
    const yaw = this.yaw; this.holder = to; this.yawOffset = yaw - to.actor.yaw; this.gripDepth = gripDepth;
    return true;
  }
  release(ctl) { if (this.holder === ctl) this.holder = null; }
  // 箱の向き（横・上）と、持つ人から見た指の向き
  frame(actor, yaw, tilt) {
    const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt));
    const bx = new THREE.Vector3(1, 0, 0).applyQuaternion(q), U = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const sign = bx.dot(actor.side()) >= 0 ? 1 : -1;                        // 持ち主の左に来る面
    const f = actor.forward(); f.addScaledVector(bx, -f.dot(bx)).normalize();
    const dir = f.clone().multiplyScalar(Math.cos(GRIP.angle)).addScaledVector(U, -Math.sin(GRIP.angle)).normalize();
    return { q, bx, U, sign, f, dir };
  }
  // ある人が、この箱をある姿勢（center, yaw, tilt）で持つときの、左右の手首の目標と、手のひらを当てる面
  wristTargets(actor, center, yaw, tilt, gripDepth = this.gripDepth, withHands = false) {
    const { bx, U, sign, f, dir } = this.frame(actor, yaw, tilt);
    const half = this.size.w / 2 + 0.006;
    const out = {}, hands = {};
    for (const [k, sg] of [['L', 1], ['R', -1]]) {
      const N = bx.clone().multiplyScalar(sg * sign);                       // 面の外向き（手のある側）
      const grip = center.clone().addScaledVector(N, half).addScaledVector(f, gripDepth).addScaledVector(U, GRIP.up);
      out[k] = grip.clone().addScaledVector(N, WRIST.out).addScaledVector(dir, -WRIST.back).addScaledVector(U, WRIST.up);
      hands[k] = { mode: 'contact', dir, palm: N.clone().negate(), contact: { point: grip, normal: N, up: U, bottom: center.clone().addScaledVector(U, -this.size.h / 2) } };
    }
    return withHands ? { T: out, hands } : out;
  }
  // 持ち主の実際の手首から、箱の位置と傾きを決める（毎フレーム、人物の計算のあと）
  update(dt) {
    if (this.holder) {
      const a = this.holder.actor, s = a.side();
      const wl = a.handPos('L'), wr = a.handPos('R');
      const mid = wl.clone().add(wr).multiplyScalar(0.5);
      const across = wl.clone().sub(wr); const horiz = Math.hypot(across.x, across.z);
      const tiltLR = Math.atan2(across.y, horiz);                            // 左手が高いと正
      const yaw = a.yaw + this.yawOffset; this._yaw = yaw;
      const bx0 = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      this.tilt = tiltLR * (bx0.dot(s) >= 0 ? 1 : -1);
      // wristTargets の逆：手首の真ん中から箱の中心を出す
      const { q, U, f, dir } = this.frame(a, yaw, this.tilt);
      const center = mid.addScaledVector(dir, WRIST.back).addScaledVector(U, -WRIST.up - GRIP.up).addScaledVector(f, -this.gripDepth);
      this.obj.quaternion.copy(q);
      this.obj.position.copy(center).addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(q), -this.size.h / 2);
      return;
    }
    if (this.falling) {
      this.vel.y -= 9.8 * dt; this.obj.position.addScaledVector(this.vel, dt);
      const fy = this.floorAt(this.obj.position.x, this.obj.position.z);
      if (this.obj.position.y <= fy) { this.obj.position.y = fy; this.vel.set(0, 0, 0); this.falling = false; this.obj.rotation.set(0, this.obj.rotation.y, 0); }
    }
  }
}
