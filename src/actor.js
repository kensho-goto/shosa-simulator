// 人物：写実の人物モデル（Microsoft Rocketbox、MIT）に
// 「立つ・歩く・息・正座・お辞儀・手を伸ばす・見る・うなずく・まばたき・口の動き・表情」を、計算で重ねる。
// 骨は世界座標の向きで合わせる（骨ごとの軸を決め打ちしない）。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// 人物の一覧（assets/people/<名前>/）
export const PEOPLE = {
  Business_Male_02: { code: 'm008' },   // 主人公
  Female_Adult_11: { code: 'f011' },    // 相手（美咲）
  Male_Adult_03: { code: 'm004' },      // 父
  Business_Female_03: { code: 'f016' }, // 母
};
const BONE = {
  Root: 'Bip01', Hips: 'Bip01_Pelvis', Spine: 'Bip01_Spine', Spine1: 'Bip01_Spine1', Spine2: 'Bip01_Spine2', Neck: 'Bip01_Neck', Head: 'Bip01_Head',
  LEye: 'Bip01_LEye', REye: 'Bip01_REye',
};
for (const [L, c] of [['Left', 'L'], ['Right', 'R']]) {
  Object.assign(BONE, {
    [L + 'UpLeg']: `Bip01_${c}_Thigh`, [L + 'Leg']: `Bip01_${c}_Calf`, [L + 'Foot']: `Bip01_${c}_Foot`, [L + 'ToeBase']: `Bip01_${c}_Toe0`,
    [L + 'Shoulder']: `Bip01_${c}_Clavicle`, [L + 'Arm']: `Bip01_${c}_UpperArm`, [L + 'ForeArm']: `Bip01_${c}_Forearm`, [L + 'Hand']: `Bip01_${c}_Hand`,
    [L + 'HandMiddle1']: `Bip01_${c}_Finger2`,
  });
}
const FINGERS = ['Finger1', 'Finger2', 'Finger3', 'Finger4'];

const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
const cache = {};
function tex(url, srgb) {
  const t = texLoader.load(url);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}
// 肌：光が少し中まで入って、影の境目が赤くにじむ（人の肌らしさ）
const SKIN_RECT_SPEC = 'reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );';
const SKIN_DIFFUSE = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
function skin(mat, amount) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uSkin = { value: amount };
    sh.fragmentShader = 'uniform float uSkin;\n' + sh.fragmentShader.replace('#include <lights_physical_pars_fragment>',
      THREE.ShaderChunk.lights_physical_pars_fragment
        .replace(SKIN_RECT_SPEC, 'reflectedLight.directSpecular += ( 1.0 - 0.75 * uSkin ) * lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );')
        .replace(SKIN_DIFFUSE, `{
        float nl = dot( geometryNormal, directLight.direction );
        float wrapNL = saturate( ( nl + 0.45 ) / 1.45 );
        vec3 scatter = mix( vec3( 1.0, 0.38, 0.28 ), vec3( 1.0 ), smoothstep( 0.0, 0.6, nl ) );
        vec3 wrapped = directLight.color * wrapNL * scatter;
        reflectedLight.directDiffuse += mix( irradiance, wrapped, uSkin ) * BRDF_Lambert( material.diffuseColor );
      }`));
  };
  mat.customProgramCacheKey = () => 'skin' + amount;
  return mat;
}
export async function loadModels(onProgress, { hi = true } = {}) {
  let done = 0; const names = Object.keys(PEOPLE);
  await Promise.all(names.map(async n => {
    const { code } = PEOPLE[n]; const dir = `assets/people/${n}/`;
    const gltf = await loader.loadAsync(dir + n + '.glb');
    const op = tex(dir + code + (hi ? '_opacity_2k.png' : '_opacity_color.png'), true);
    const mats = {
      body: skin(new THREE.MeshStandardMaterial({ name: 'body', map: tex(dir + code + '_body.jpg', true), normalMap: tex(dir + code + '_body_normal.jpg'), roughnessMap: tex(dir + code + '_body_rough.jpg'), roughness: 1 }), 0.6),
      head: skin(new THREE.MeshPhysicalMaterial({
        name: 'head', map: tex(dir + code + (hi ? '_head_color_2k.jpg' : '_head_color.jpg'), true), normalMap: tex(dir + code + (hi ? '_head_normal_2k.jpg' : '_head_normal.jpg')),
        roughnessMap: tex(dir + code + '_head_rough.jpg'), roughness: 1, specularIntensity: 0.55,
        sheen: 0.35, sheenRoughness: 0.75, sheenColor: new THREE.Color('#ffd9c9'),
      }), 1),
      // 髪：1回目は芯だけ（くっきり・奥行きあり）、2回目はふちだけ半透明で重ねる
      hair: new THREE.MeshStandardMaterial({ name: 'opacity', map: op, roughness: 0.55, alphaTest: 0.5, side: THREE.DoubleSide }),
      hairEdge: new THREE.MeshStandardMaterial({ name: 'hairEdge', map: op, roughness: 0.55, transparent: true, depthWrite: false, alphaTest: 0.12, side: THREE.DoubleSide }),
    };
    mats.head.normalScale.set(0.8, 0.8);
    mats.opacity = mats.hair;
    cache[n + ':mats'] = mats;
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      const pickMat = m => /head/.test(m.name) ? mats.head : /opacity/.test(m.name) ? mats.opacity : mats.body;
      o.material = Array.isArray(o.material) ? o.material.map(pickMat) : pickMat(o.material);
    });
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    cache[n] = { gltf, tall: box.max.y - box.min.y };
    done++; onProgress && onProgress(done / names.length);
  }));
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
export function rotWorld(bone, axis, angle) { if (angle) applyWorldRot(bone, tmpQ.setFromAxisAngle(axis, angle).clone()); }
function aim(bone, child, dir) {
  const a = wpos(bone), b = wpos(child);
  const cur = b.sub(a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(cur, dir.clone().normalize());
  applyWorldRot(bone, q);
}
const ease = t => t * t * (3 - 2 * t);
const clamp01 = v => THREE.MathUtils.clamp(v, 0, 1);

export class Actor {
  constructor(scene, { person = 'Business_Male_02', height = 1.7, name = '' } = {}) {
    this.name = name;
    const src = cache[person];
    this.root = new THREE.Group(); scene.add(this.root);
    this.model = SkeletonUtils.clone(src.gltf.scene);
    this.root.add(this.model);
    this.model.scale.setScalar(height / src.tall);
    this.height = height;
    this.faces = [];
    this.model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        if (o.morphTargetDictionary && Object.keys(o.morphTargetDictionary).length) this.faces.push(o);
      }
    });
    // 髪のふち（半透明）を、同じ骨で動く2枚目として重ねる
    const mats = cache[person + ':mats'];
    const hairMeshes = []; this.model.traverse(o => { if (o.isSkinnedMesh && [].concat(o.material).includes(mats.hair)) hairMeshes.push(o); });
    const hide = new THREE.MeshBasicMaterial({ visible: false });
    for (const o of hairMeshes) {
      const ms = Array.isArray(o.material) ? o.material.map(m => m === mats.hair ? mats.hairEdge : hide) : mats.hairEdge;
      const e = new THREE.SkinnedMesh(o.geometry, ms);
      e.bind(o.skeleton, o.bindMatrix); e.renderOrder = 2; e.frustumCulled = false; e.castShadow = false;
      if (o.morphTargetInfluences) { e.morphTargetInfluences = o.morphTargetInfluences; e.morphTargetDictionary = o.morphTargetDictionary; }
      e.position.copy(o.position); e.quaternion.copy(o.quaternion); e.scale.copy(o.scale);
      o.parent.add(e);
    }
    this.root.updateMatrixWorld(true);
    // 骨
    const all = {}; this.model.traverse(o => { if (o.isBone || /^Bip01/.test(o.name)) all[o.name] = o; });
    const B = this.bones = {};
    for (const [k, n] of Object.entries(BONE)) B[k] = all[n];
    this.fingers = { L: [], R: [] };
    // 指の骨の名前（Finger1, Finger11, Finger12）
    for (const c of ['L', 'R']) this.fingers[c] = FINGERS.map(f => [all[`Bip01_${c}_${f}`], all[`Bip01_${c}_${f}1`], all[`Bip01_${c}_${f}2`]].filter(Boolean));
    this.thumbs = { L: [all.Bip01_L_Finger0, all.Bip01_L_Finger01], R: [all.Bip01_R_Finger0, all.Bip01_R_Finger01] };
    // 元の姿勢（毎フレームここから組み直す）
    this.rest = [];
    this.model.traverse(o => { if (o.isBone || o.name === 'Bip01') this.rest.push([o, o.quaternion.clone(), o.position.clone()]); });
    // 頭の前の向き（目の向きに使う）
    const hw = wpos(B.Head);
    this.headFrontLocal = B.Head.worldToLocal(hw.clone().add(new THREE.Vector3(0, 0, 0.2)));
    // 状態
    this.s = {
      speed: 0, seated: 0, seatedTarget: 0, bow: 0, bowSeated: 0, grip: { L: 0, R: 0 }, keepLook: false,
      reach: { L: null, R: null }, reachW: { L: 0, R: 0 },
      look: null, lookW: 0, gesture: null, gt: 0, lean: 0, wobble: 0, headDown: 0,
      handsFront: 0, talking: false, smile: 0, worry: 0,
    };
    this.t = Math.random() * 10;
    this.phase = 0; this.walkW = 0;
    this.blinkT = 1 + Math.random() * 3; this.blink = 0;
    this.face = { smile: 0, worry: 0, jaw: 0 };
  }
  get pos() { return this.root.position; }
  get yaw() { return this.root.rotation.y; }
  set yaw(v) { this.root.rotation.y = v; }
  forward(out = V()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  side(out = V()) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); } // 左手側
  pitchAxis() { return UP.clone().cross(this.forward()).normalize(); }
  headPos() { return wpos(this.bones.Head); }
  handPos(side = 'R') { return wpos(this.bones[side === 'R' ? 'RightHand' : 'LeftHand']); }
  // 手首を T に届かせるのに、腕があとどれだけ足りないか（m。正＝届かない）。いまの姿勢（前のコマ）で測る
  armSlack(side, T) {
    const L = side === 'R' ? 'Right' : 'Left', B = this.bones;
    const S = wpos(B[L + 'Arm']), E = wpos(B[L + 'ForeArm']), Hd = wpos(B[L + 'Hand']);
    return S.distanceTo(T) - (S.distanceTo(E) + E.distanceTo(Hd)) * 0.96;
  }
  gesture(kind, dur = 1.2) { this.s.gesture = kind; this.s.gt = 0; this.s.gdur = dur; }
  lookAt(target, w = 1) { this.s.look = target; this.s.lookW = w; }
  reach(side, target, w = 1) { this.s.reach[side] = target; this.s.reachWTarget = this.s.reachWTarget || {}; this.s.reachWTarget[side] = target ? w : 0; }
  turnTo(x, z) { this.yaw = Math.atan2(x - this.pos.x, z - this.pos.z); }

  update(dt) {
    this.t += dt;
    const s = this.s;
    for (const [b, q, p] of this.rest) { b.quaternion.copy(q); b.position.copy(p); }
    this.model.position.set(0, 0, 0);
    this.root.updateMatrixWorld(true);
    s.seated += (s.seatedTarget - s.seated) * Math.min(1, dt * 2.2);
    for (const k of ['L', 'R']) {
      const tw = (s.reachWTarget && s.reachWTarget[k]) || 0;
      s.reachW[k] += (tw - s.reachW[k]) * Math.min(1, dt * 6);
      if (s.reachW[k] < 0.01 && !tw) s.reach[k] = null;
    }
    const seat = ease(clamp01(s.seated));
    const ww = clamp01(s.speed / 1.0) * (1 - seat);
    this.walkW += (ww - this.walkW) * Math.min(1, dt * 8);
    // 足の運び：速さに合う歩数と歩幅（足が床をすべらないように）
    const sp = Math.max(0.15, Math.min(1.6, s.speed));
    const cad = 0.55 + 0.3 * sp;                       // 1秒に何周（1周＝2歩）
    const legLen = 0.5 * this.height;
    this.stride = THREE.MathUtils.clamp(Math.asin(Math.min(0.9, (sp / (2 * cad)) / (2 * legLen))) * 1.15, 0.12, 0.5);
    if (this.walkW > 0.01) this.phase += dt * Math.PI * 2 * cad;
    this.applyWalk(this.walkW);
    this.applySeiza(seat);
    // 脚の位置を覚えておく（上半身を動かしても脚は動かさない）
    const B = this.bones;
    const legs = ['Left', 'Right'].map(L => ({ L, knee: wpos(B[L + 'Leg']).clone(), foot: wpos(B[L + 'Foot']).clone(), toe: wpos(B[L + 'ToeBase']).clone() }));
    this.applyTorso(seat);
    for (const g of legs) {
      aim(B[g.L + 'UpLeg'], B[g.L + 'Leg'], g.knee.clone().sub(wpos(B[g.L + 'UpLeg'])));
      aim(B[g.L + 'Leg'], B[g.L + 'Foot'], g.foot.clone().sub(wpos(B[g.L + 'Leg'])));
      aim(B[g.L + 'Foot'], B[g.L + 'ToeBase'], g.toe.clone().sub(wpos(B[g.L + 'Foot'])));
    }
    // 首と背の向き（見る先）を先に決めてから腕を合わせる（あとで背を回すと、手が箱からずれる）
    this.applyHead(dt);
    this.applyArms(seat);
    this.applyFace(dt);
  }

  // 歩く：ももを振り、ひざを曲げ、腰を少し上下させる
  applyWalk(w) {
    if (w < 0.01) return;
    const B = this.bones, ax = this.pitchAxis(), ph = this.phase;
    for (const [L, sg] of [['Left', 1], ['Right', -1]]) {
      const sw = Math.sin(ph) * sg;
      const thigh = -sw * (this.stride || 0.42) * w;
      const flex = Math.pow(clamp01(0.5 + 0.5 * Math.sin(ph * 1 + (sg > 0 ? 0 : Math.PI) + 2.0)), 2) * 0.95 * w;
      rotWorld(B[L + 'UpLeg'], ax, thigh);
      rotWorld(B[L + 'Leg'], ax, flex);
      rotWorld(B[L + 'Foot'], ax, -(thigh + flex) * 0.6);
    }
    this.model.position.y = -(1 - Math.cos(ph * 2)) * 0.012 * w; // model は root の子なので、root の単位（m）のまま
    rotWorld(B.Hips, UP, Math.sin(ph) * 0.06 * w);
  }

  // 正座（seated=1）。立った姿との間はまぜる。
  applySeiza(k) {
    if (k <= 0.001) return;
    const B = this.bones, f = this.forward(), side = this.side();
    const H = this.height / 1.7;
    const names = ['Root', 'Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
    const before = names.map(n => B[n].quaternion.clone());
    const p = this.pos;
    // 腰を下げる
    const hipW = wpos(B.Hips);
    const target = new THREE.Vector3(p.x, p.y + 0.25 * H, p.z).addScaledVector(f, -0.07 * H);
    const want = hipW.clone().lerp(target, k);
    const delta = want.sub(hipW);
    const rootW = wpos(B.Root).add(delta);
    B.Root.parent.updateMatrixWorld(true);
    B.Root.position.copy(B.Root.parent.worldToLocal(rootW));
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
      aim(foot, toe, f.clone().multiplyScalar(-0.35).addScaledVector(UP, -0.94).normalize());
    }
    if (k < 0.999) names.slice(1).forEach((n, i) => { const full = B[n].quaternion.clone(); B[n].quaternion.copy(before[i + 1]).slerp(full, k); });
    this.root.updateMatrixWorld(true);
  }

  // 上半身：息・お辞儀（s.bow は度）・前のめり・ふらつき
  applyTorso(seat) {
    const s = this.s, B = this.bones, ax = this.pitchAxis();
    // 息と、ごく小さな重心のゆれ
    rotWorld(B.Spine1, ax, Math.sin(this.t * 1.7) * 0.012);
    rotWorld(B.Hips, this.forward(), Math.sin(this.t * 0.45) * 0.012 * (1 - seat));
    const deg = s.bow;
    if (Math.abs(deg) < 0.05 && Math.abs(s.lean) < 0.01 && s.wobble < 0.001) return;
    const rad = THREE.MathUtils.degToRad(deg);
    const hipShare = 0.55 + 0.2 * seat;
    const wob = s.wobble ? Math.sin(this.t * 7.3) * s.wobble * 0.06 : 0;
    rotWorld(B.Hips, ax, rad * hipShare + s.lean + wob);
    const rest = rad * (1 - hipShare);
    rotWorld(B.Spine, ax, rest * 0.4); rotWorld(B.Spine1, ax, rest * 0.35); rotWorld(B.Spine2, ax, rest * 0.25);
    // 立って深く下げると腰を少し引く
    if (seat < 0.5 && deg > 5) {
      const back = this.forward().multiplyScalar(-Math.sin(rad * hipShare) * 0.12 * this.height / 1.7);
      const rw = wpos(B.Root).add(back);
      B.Root.position.copy(B.Root.parent.worldToLocal(rw));
      this.root.updateMatrixWorld(true);
    }
  }

  // 腕：手を目標へ（2本の骨の計算）。目標がなければ姿勢に合わせた置き場所。
  applyArms(seat) {
    const s = this.s;
    const deg = s.bow;
    for (const [k, L, sg] of [['L', 'Left', 1], ['R', 'Right', -1]]) {
      let target = null, wgt = 0;
      if (s.reach[k] && s.reachW[k] > 0.01) { target = s.reach[k]; wgt = s.reachW[k]; }
      const { pos: def, hang } = this.defaultHand(L, sg, seat, deg);
      const tgt = target ? def.clone().lerp(target, wgt) : def;
      this.ik(L, sg, tgt, target ? hang * (1 - wgt) : hang);
      this.curl(k, (target ? 0.22 : 0.35) + (s.grip ? s.grip[k] : 0) * 0.55 * wgt);
    }
  }
  hangHand(L, sg) {
    const B = this.bones, f = this.forward(), side = this.side();
    const S = wpos(B[L + 'Arm']);
    const len = S.distanceTo(wpos(B[L + 'ForeArm'])) + wpos(B[L + 'ForeArm']).distanceTo(wpos(B[L + 'Hand']));
    const sw = -Math.sin(this.phase) * sg * 0.14 * this.walkW;
    return S.clone().addScaledVector(UP, -len * 0.95).addScaledVector(side, sg * 0.035).addScaledVector(f, 0.05 + sw);
  }
  defaultHand(L, sg, seat, deg) {
    const f = this.forward(), side = this.side(), p = this.pos, H = this.height / 1.7;
    const hf = Math.max(this.s.handsFront, clamp01(deg / 20));
    let stand = this.hangHand(L, sg), hang = 1;
    if (hf > 0.001) {
      // 体の前、ももの前
      const rad = THREE.MathUtils.degToRad(deg) * 0.75;
      const fr = p.clone().addScaledVector(side, sg * 0.07 * H).addScaledVector(f, (0.15 + Math.sin(rad) * 0.25) * H);
      fr.y = p.y + (0.72 - (1 - Math.cos(rad)) * 0.35) * H;
      stand = stand.lerp(fr, hf); hang = 1 - hf;
    }
    if (seat > 0.05) {
      // ももの上 → お辞儀が深いと床へ
      const thigh = p.clone().addScaledVector(f, 0.2 * H).addScaledVector(side, sg * 0.09 * H); thigh.y = p.y + 0.34 * H;
      const floor = p.clone().addScaledVector(f, (0.5 + 0.004 * deg) * H).addScaledVector(side, sg * 0.07 * H); floor.y = p.y + 0.02;
      const b = clamp01((deg - 8) / 22);
      const seatHand = thigh.lerp(floor, ease(b));
      stand = stand.lerp(seatHand, seat); hang *= 1 - seat;
    }
    return { pos: stand, hang };
  }
  ik(L, sg, T, hang = 0) {
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
    const fore = S.clone().addScaledVector(dir, d).sub(E);
    aim(el, ha, fore);
    // 手のひら：たらした手は腕の向きのまま、物を持つときは指を前へ
    const mid = B[L + 'HandMiddle1'];
    if (mid) {
      const reachDir = dir.clone().multiplyScalar(0.6).addScaledVector(this.forward(), 0.4).addScaledVector(UP, -0.3).normalize();
      aim(ha, mid, fore.clone().normalize().lerp(reachDir, 1 - hang));
    }
  }
  // 指を軽く曲げる
  curl(k, amt) {
    const fs = this.fingers[k]; if (!fs.length || !fs[0][0] || !fs[3] || !fs[3][0]) return;
    const across = wpos(fs[0][0]).sub(wpos(fs[3][0])).normalize();
    const axis = k === 'L' ? across : across.negate();
    for (const f of fs) for (let i = 0; i < f.length; i++) rotWorld(f[i], axis, amt * (i === 0 ? 0.8 : 1.1));
  }

  applyHead(dt) {
    const s = this.s, B = this.bones;
    const hp = wpos(B.Head);
    const G = this.gaze || (this.gaze = { yaw: 0, pitch: 0, w: 0, sac: new THREE.Vector2(), sacT: 0, last: null });
    // 見る先：はっきり決めた先 → なければ、いま話している人（ゆるく）
    let look = s.look, lw = s.lookW;
    if (!(look && lw > 0.01) && s.idleLook && s.idleLook !== this) { look = s.idleLook; lw = 0.7; }
    // お辞儀の間は目を伏せる（下げながら相手を見上げない）
    if (!s.keepLook) lw *= THREE.MathUtils.clamp(1 - (s.bow - 8) / 18, 0, 1);
    let tgt = null, wantYaw = 0, wantPitch = 0;
    if (look && lw > 0.01) {
      tgt = (look.isVector3 ? look : look.headPos ? look.headPos() : wpos(look));
      const d = tgt.clone().sub(hp);
      let yaw = Math.atan2(d.x, d.z) - this.yaw;
      yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));          // 先に -180〜180 にそろえてから
      wantYaw = THREE.MathUtils.clamp(yaw, -1.35, 1.35);         // 首の回る範囲におさめる
      wantPitch = THREE.MathUtils.clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.6, 0.45);
      // 見る先が大きく変わったら、まばたきしながら向き直す（人のくせ）
      const key = look.isVector3 ? null : look;
      if (key !== G.last && Math.abs(wantYaw - G.yaw) > 0.5 && this.blink <= 0) this.blink = 1;
      G.last = key;
    }
    // 何も見ていないとき：ときどき視線と頭をわずかに動かす（一点を見つめ続けない）
    if (!tgt && s.idleGaze !== false && s.bow < 8 && s.seated < 0.5) {
      G.idleT = (G.idleT ?? 0) - dt;
      if (G.idleT <= 0) { G.idleYaw = (Math.random() - 0.5) * 0.35; G.idlePitch = -0.05 - Math.random() * 0.12; G.idleT = 2 + Math.random() * 3.5; if (Math.random() < 0.5 && this.blink <= 0) this.blink = 1; }
      wantYaw = G.idleYaw || 0; wantPitch = G.idlePitch || 0; lw = Math.max(lw, 0.6);
    }
    // 頭は目より少し遅れて、なめらかについてくる
    const k = 1 - Math.exp(-dt * 5.5);
    G.yaw += (wantYaw - G.yaw) * k; G.pitch += (wantPitch - G.pitch) * k;
    G.w += (lw - G.w) * (1 - Math.exp(-dt * 4));
    const yawW = G.yaw * G.w, pitchW = G.pitch * G.w;
    if (Math.abs(yawW) > 1e-4 || Math.abs(pitchW) > 1e-4) {
      const f = this.forward();
      rotWorld(B.Spine1, UP, yawW * 0.08);
      rotWorld(B.Spine2, UP, yawW * 0.17);
      rotWorld(B.Head, UP, yawW * 0.68);
      const ax = UP.clone().cross(f.applyAxisAngle(UP, yawW)).normalize();
      rotWorld(B.Spine2, ax, -pitchW * 0.12);
      rotWorld(B.Head, ax, -pitchW * 0.78);
      // 横を向くとき、首がわずかに傾く
      rotWorld(B.Head, f.clone().applyAxisAngle(UP, yawW), -yawW * 0.08);
    }
    // 目の小さなゆれ（見つめていても、目はわずかに動く）
    G.sacT -= dt;
    if (G.sacT <= 0) { G.sac.set((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.03); G.sacT = 0.35 + Math.random() * 1.6; }
    this._eyeTgt = tgt && G.w > 0.05 ? tgt : null;
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
    // 目：見ている先へ向ける（目が先に届く）
    if (B.LEye && B.REye) {
      const front = B.Head.localToWorld(this.headFrontLocal.clone()).sub(wpos(B.Head)).normalize();
      const G2 = this.gaze;
      const side = new THREE.Vector3().crossVectors(UP, front).normalize();
      for (const e of [B.LEye, B.REye]) {
        let to;
        if (this._eyeTgt) to = this._eyeTgt.clone().sub(wpos(e)).normalize();
        else to = front.clone().addScaledVector(UP, -0.06).normalize();   // 何も見ていないときは少し下
        to.addScaledVector(side, G2.sac.x).addScaledVector(UP, G2.sac.y).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(front, to);
        const ang = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
        if (ang > 0.45) q.slerp(new THREE.Quaternion(), 1 - 0.45 / ang);
        applyWorldRot(e, q);
      }
    }
  }

  // 顔：まばたき・話す口・表情
  applyFace(dt) {
    if (!this.faces.length) return;
    const s = this.s, F = this.face;
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 1; this.blinkT = 2 + Math.random() * 3.5; }
    const bl = this.blink > 0 ? Math.sin(Math.PI * (1 - this.blink)) : 0;
    this.blink = Math.max(0, this.blink - dt / 0.16);
    const g = s.gesture;
    const smileT = Math.max(s.smile, g === 'nod' ? 0.45 : 0);
    const worryT = Math.max(s.worry, g === 'tilt' || g === 'sigh' ? 0.6 : g === 'flinch' ? 0.8 : 0);
    F.smile += (smileT - F.smile) * Math.min(1, dt * 4);
    F.worry += (worryT - F.worry) * Math.min(1, dt * 4);
    const jawT = s.talking ? (0.18 + 0.5 * Math.abs(Math.sin(this.t * 11.0) * Math.sin(this.t * 4.3 + 1))) : 0;
    F.jaw += (jawT - F.jaw) * Math.min(1, dt * 18);
    const lookDown = Math.min(0.5, Math.max(0, s.bow - 10) / 40);
    // まぶたは少しだけ下ろしておく（全開だと見開いて見える）。下を見るほど下がる
    const lid = 0.16 + Math.max(0, -(this.gaze ? this.gaze.pitch * this.gaze.w : 0)) * 0.45 + F.smile * 0.12;
    for (const m of this.faces) {
      const d = m.morphTargetDictionary, inf = m.morphTargetInfluences;
      const set = (k, v) => { if (d[k] != null) inf[d[k]] = v; };
      set('AK_09_EyeBlinkLeft', Math.max(bl, lookDown, lid)); set('AK_10_EyeBlinkRight', Math.max(bl, lookDown, lid));
      set('AK_25_JawOpen', F.jaw * 0.55);
      set('AK_44_MouthSmileLeft', F.smile * 0.6); set('AK_45_MouthSmileRight', F.smile * 0.6);
      set('AK_03_BrowInnerUp', F.worry * 0.7);
      set('AK_30_MouthFrownLeft', F.worry * 0.35); set('AK_31_MouthFrownRight', F.worry * 0.35);
    }
  }
}
