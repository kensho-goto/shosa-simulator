// 道具：靴・手土産・紙袋・湯のみと茶托・お盆・ハンカチ。落ちる・転がるは簡単な物理で。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GENKAN } from './env.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const shadowed = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

export class Prop {
  constructor(obj, { name, radius = 0.1, height = 0.05, floor = () => 0 } = {}) {
    this.obj = obj; this.name = name; this.radius = radius; this.height = height;
    this.vel = new THREE.Vector3(); this.spin = new THREE.Vector3(); this.free = false; this.floorAt = floor;
    this.held = false; this.highlight = 0;
    obj.userData.prop = this;
    this.mats = []; obj.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); this.mats.push(m.material); } });
  }
  get pos() { return this.obj.position; }
  setHighlight(v) {
    if (Math.abs(v - this.highlight) < 0.01) return; this.highlight = v;
    for (const m of this.mats) if (m.emissive) { m.emissive.set('#ffd28a'); m.emissiveIntensity = v * 0.35; }
  }
  drop(v = new THREE.Vector3()) { this.free = true; this.vel.copy(v); this.spin.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6); this.held = false; }
  // 戻り値：着地した瞬間なら true
  step(dt) {
    if (!this.free) return false;
    this.vel.y -= 9.8 * dt;
    this.pos.addScaledVector(this.vel, dt);
    this.obj.rotation.x += this.spin.x * dt; this.obj.rotation.y += this.spin.y * dt; this.obj.rotation.z += this.spin.z * dt;
    const fy = this.floorAt(this.pos.x, this.pos.z);
    if (this.pos.y <= fy) {
      this.pos.y = fy;
      const hard = Math.abs(this.vel.y) > 0.6;
      this.vel.y *= -0.25; this.vel.x *= 0.5; this.vel.z *= 0.5; this.spin.multiplyScalar(0.4);
      if (Math.abs(this.vel.y) < 0.3) {
        // 寝かせて止める（平らな面を下に）
        this.free = false; this.vel.set(0, 0, 0);
        this.obj.rotation.x = Math.round(this.obj.rotation.x / (Math.PI / 2)) * (Math.PI / 2);
        this.obj.rotation.z = Math.round(this.obj.rotation.z / (Math.PI / 2)) * (Math.PI / 2);
      }
      return hard;
    }
    return false;
  }
}

export function floorHeight(x, z) {
  if (z < 0) return GENKAN.y;           // 土間
  return 0;
}

// ---- 靴（革靴）----
export function makeShoe(color = '#3a2418', side = 1) {
  const g = new THREE.Group();
  const leather = new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.3 });
  const geo = new RoundedBoxGeometry(0.1, 0.075, 0.28, 4, 0.035);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), y = p.getY(i), x = p.getX(i);
    const toe = THREE.MathUtils.clamp((z - 0.02) / 0.12, 0, 1);
    p.setX(i, x * (1 - 0.25 * toe) + side * 0.008 * toe);
    p.setY(i, y < 0 ? y : y * (1 - 0.45 * toe));
  }
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, leather); body.position.y = 0.045; g.add(body);
  const sole = new THREE.Mesh(new RoundedBoxGeometry(0.104, 0.018, 0.285, 2, 0.008), new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: 0.8 }));
  sole.position.y = 0.009; g.add(sole);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshStandardMaterial({ color: '#120c08', roughness: 1 }));
  hole.scale.set(0.036, 0.06, 1); hole.rotation.x = -Math.PI / 2; hole.position.set(0, 0.0835, -0.06); g.add(hole);
  return shadowed(g);
}

// ---- 手土産（のし紙つきの箱）----  +z の側に立つ人が文字を正しく読める
export function makeGift() {
  const g = new THREE.Group();
  const W = 0.3, H = 0.075, D = 0.21;
  const paper = new THREE.MeshStandardMaterial({ color: '#efe6d3', roughness: 0.8,
    map: canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#efe6d3'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(150,120,80,.15)'; for (let i = 0; i < 30; i++) { c.beginPath(); c.moveTo(Math.random() * w, 0); c.lineTo(Math.random() * w, h); c.stroke(); } }) });
  const box = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 2, 0.006), paper); box.position.y = H / 2; g.add(box);
  const noshi = canvasTex(512, 360, (c, w, h) => {
    c.fillStyle = '#fbf8f0'; c.fillRect(0, 0, w, h);
    // 水引（紅白）
    c.fillStyle = '#c21f2f'; c.fillRect(0, h * 0.47, w / 2, 10); c.fillStyle = '#d9d4cc'; c.fillRect(w / 2, h * 0.47, w / 2, 10);
    c.fillStyle = '#c21f2f'; c.beginPath(); c.ellipse(w / 2 - 18, h * 0.49, 26, 14, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d9d4cc'; c.beginPath(); c.ellipse(w / 2 + 18, h * 0.49, 26, 14, 0, 0, Math.PI * 2); c.fill();
    // のし（右上）
    c.fillStyle = '#d8b46a'; c.beginPath(); c.moveTo(w - 60, 20); c.lineTo(w - 30, 20); c.lineTo(w - 40, 90); c.closePath(); c.fill();
    c.fillStyle = '#1c1612'; c.textAlign = 'center';
    c.font = '600 64px "Hiragino Mincho ProN","Yu Mincho",serif';
    c.fillText('御挨拶', w / 2, h * 0.36);
    c.font = '500 46px "Hiragino Mincho ProN","Yu Mincho",serif';
    c.fillText('高 橋', w / 2, h * 0.82);
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.96, D * 0.96), new THREE.MeshStandardMaterial({ map: noshi, roughness: 0.85 }));
  label.rotation.x = -Math.PI / 2; label.position.y = H + 0.0015; g.add(label);
  return shadowed(g);
}
export function makeBag() {
  const g = new THREE.Group();
  const kraft = new THREE.MeshStandardMaterial({ color: '#a8835a', roughness: 0.9, side: THREE.DoubleSide });
  const w = 0.34, h = 0.28, d = 0.12;
  for (const [sx, sz, rw, ry] of [[0, d / 2, w, 0], [0, -d / 2, w, 0], [w / 2, 0, d, Math.PI / 2], [-w / 2, 0, d, Math.PI / 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(rw, h), kraft); m.position.set(sx, h / 2, sz); m.rotation.y = ry; g.add(m);
  }
  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(w, d), kraft); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.002; g.add(bottom);
  for (const s of [-1, 1]) { const hd = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: '#6b4b2a' })); hd.position.set(0, h, s * d / 2); g.add(hd); }
  return shadowed(g);
}

// ---- 湯のみ・茶托・お盆 ----
export function makeCup(glaze = '#4f6b5a') {
  const g = new THREE.Group();
  const pts = [[0.0, 0], [0.03, 0], [0.032, 0.006], [0.031, 0.01], [0.036, 0.085], [0.037, 0.088], [0.033, 0.088], [0.032, 0.012], [0.0, 0.012]].map(p => new THREE.Vector2(...p));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), new THREE.MeshPhysicalMaterial({ color: glaze, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.2, side: THREE.DoubleSide }));
  g.add(cup);
  const tea = new THREE.Mesh(new THREE.CircleGeometry(0.0335, 32), new THREE.MeshPhysicalMaterial({ color: '#9c9b3a', roughness: 0.05, transmission: 0.2, clearcoat: 1 }));
  tea.rotation.x = -Math.PI / 2; tea.position.y = 0.07; g.add(tea);
  g.userData.tea = tea;
  return shadowed(g);
}
export function makeSaucer() {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.012, 32), new THREE.MeshPhysicalMaterial({ color: '#5a3520', roughness: 0.3, clearcoat: 0.8 }));
  m.position.y = 0.006; const g = new THREE.Group(); g.add(m); return shadowed(g);
}
export function makeTray() {
  const g = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ color: '#3b1f14', roughness: 0.25, clearcoat: 1 });
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.015, 0.28, 2, 0.006), m); base.position.y = 0.0075; g.add(base);
  return shadowed(g);
}
export function makeCloth() {
  const t = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#e8e4dc'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7c8aa8'; c.lineWidth = 3; for (let i = 8; i < w; i += 20) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); } });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2, 6, 6), new THREE.MeshStandardMaterial({ map: t, roughness: 1, side: THREE.DoubleSide }));
  const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 30) * 0.004 + Math.cos(p.getY(i) * 25) * 0.003);
  m.geometry.computeVertexNormals(); m.rotation.x = -Math.PI / 2;
  const g = new THREE.Group(); g.add(m); return shadowed(g);
}
// こぼれたお茶のしみ
export function makeStain() {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshPhysicalMaterial({ color: '#6d6a22', roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1 }));
  m.rotation.x = -Math.PI / 2; m.scale.setScalar(0.001); m.renderOrder = 2; return m;
}

// ---- 急須（お茶を注ぐ）----  注ぎ口は +x
export function makeTeapot() {
  const g = new THREE.Group();
  const glaze = new THREE.MeshPhysicalMaterial({ color: '#7a4a2c', roughness: 0.35, clearcoat: 0.8 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 28, 18), glaze); body.scale.set(1, 0.78, 1); body.position.y = 0.045; g.add(body);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.012, 24), glaze); lid.position.y = 0.088; g.add(lid);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), glaze); knob.position.y = 0.098; g.add(knob);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 0.06, 12), glaze); spout.position.set(0.068, 0.06, 0); spout.rotation.z = -0.9; g.add(spout);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.09, 12), glaze); handle.position.set(0, 0.05, 0.085); handle.rotation.x = Math.PI / 2; g.add(handle);
  return shadowed(g);
}
// ---- お菓子（皿とおまんじゅう3つ）----
export function makeSweets() {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.014, 32), new THREE.MeshPhysicalMaterial({ color: '#f1ece2', roughness: 0.3, clearcoat: 1 }));
  plate.position.y = 0.007; g.add(plate);
  const manju = [];
  for (let i = 0; i < 3; i++) {
    const m = makeManju(); const a = i * Math.PI * 2 / 3;
    m.position.set(Math.cos(a) * 0.04, 0.014, Math.sin(a) * 0.04); g.add(m); manju.push(m);
  }
  g.userData.manju = manju;
  return shadowed(g);
}
export function makeManju() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.024, 20, 14), new THREE.MeshStandardMaterial({ color: '#c98a4a', roughness: 0.7 }));
  m.scale.y = 0.62; m.position.y = 0.014; m.castShadow = true;
  const g = new THREE.Group(); g.add(m);
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.008, 12), new THREE.MeshStandardMaterial({ color: '#7a4a24' })); top.rotation.x = -Math.PI / 2; top.position.y = 0.0295; g.add(top);
  return g;
}
// ---- 障子の破れ（穴）----
export function makeHole() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#3a2c20'; x.beginPath();
  for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI * 2, r = 40 + (i % 2 ? 18 : 0) + Math.random() * 10; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
  x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.userData.outlineParameters = { visible: false }; m.userData.noToon = true;
  return m;
}
