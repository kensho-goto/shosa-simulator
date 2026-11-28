// 家の組み立て（玄関・廊下・八畳の和室）。単位はメートル。
// 座標：+z が家の奥。z<0 が玄関の土間、0〜2 が廊下、2〜5.52 が和室。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const TL = new THREE.TextureLoader();
export const TATAMI = { long: 1.76, short: 0.88 }; // 江戸間
export const ROOM = { x0: -1.76, x1: 1.76, z0: 2.0, z1: 5.52, h: 2.4 };
export const GENKAN = { z0: -1.6, y: -0.22 };

function tex(path, rep, srgb, rot = 0) {
  const t = TL.load(path);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep[0], rep[1]);
  t.center.set(0.5, 0.5);
  t.rotation = rot;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// 写真の質感（Poly Haven CC0）
export function pbr(name, { rep = [1, 1], tint, rot = 0, rough = 1, normal = 1, metal = 0 } = {}) {
  const b = `assets/tex/${name}`;
  const m = new THREE.MeshStandardMaterial({
    map: tex(`${b}_diff.jpg`, rep, true, rot),
    normalMap: tex(`${b}_nor.jpg`, rep, false, rot),
    roughnessMap: tex(`${b}_rough.jpg`, rep, false, rot),
    roughness: rough, metalness: metal,
  });
  m.normalScale.set(normal, normal);
  if (tint) m.color.set(tint);
  m.userData.pbr = name;
  return m;
}
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function noise(g, w, h, a, base) {
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * a;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

function box(w, h, d, mat, x, y, z, { shadow = true, rx = 0, ry = 0 } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, 0);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}
function plane(w, h, mat, x, y, z, ry = 0, rx = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, 0, 'YXZ');
  m.receiveShadow = true;
  return m;
}

export function buildHouse(scene, renderer) {
  RectAreaLightUniformsLib.init();
  const g = new THREE.Group(); scene.add(g);
  const M = {};
  // ---- 材料 ----
  const plaster = (w, h) => pbr('white_plaster_rough_01', { rep: [w / 1.6, h / 1.6], tint: '#e9dcc4', normal: 0.6 });
  const cedar = (w, h, rot = 0) => pbr('japanese_cedar_planks', { rep: [w / 1.2, h / 1.2], rot, tint: '#e8d2b0', rough: 1 });
  const pillarMat = pbr('oak_veneer_01', { rep: [0.2, 2], tint: '#c9a57a', rough: 0.9 });
  const darkWood = pbr('oak_veneer_01', { rep: [1, 1], tint: '#5a3b24', rough: 0.55 });
  const lacquer = new THREE.MeshPhysicalMaterial({ color: '#141010', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 });
  M.heri = new THREE.MeshStandardMaterial({ color: '#1d2230', roughness: 0.8,
    map: canvasTex(64, 256, (c, w, h) => { c.fillStyle = '#2a2f40'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(200,180,120,.25)'; for (let y = 0; y < h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y + 8); c.stroke(); } noise(c, w, h, 18); }) });

  // ---- 玄関の土間 ----
  const doma = box(1.8, 0.1, 1.6, pbr('slate_floor', { rep: [1.4, 1.2], tint: '#8a8680', rough: 0.9 }), 0, GENKAN.y - 0.05, -0.8, { shadow: false });
  g.add(doma);
  // 上がり框（磨いた木）
  g.add(box(1.8, 0.24, 0.12, darkWood, 0, -0.11, 0.06));
  // 廊下の床
  g.add(box(1.8, 0.04, 1.9, pbr('wood_floor_worn', { rep: [1.2, 1.6], tint: '#c4a07a', rough: 0.6 }), 0, -0.02, 1.07, { shadow: false }));
  // 廊下の壁と天井
  for (const sx of [-1, 1]) {
    g.add(plane(3.6, 2.6, plaster(3.6, 2.6), sx * 0.9, 1.08, 0.2, -sx * Math.PI / 2));
    g.add(box(0.03, 0.08, 3.6, darkWood, sx * 0.885, -0.18, 0.2)); // 幅木
  }
  g.add(plane(1.8, 3.6, cedar(1.8, 3.6, Math.PI / 2), 0, 2.3, 0.2, 0, Math.PI / 2));
  // 玄関の戸（格子戸＋すりガラス）
  const glass = new THREE.MeshStandardMaterial({ color: '#f3efe6', emissive: '#d9e4ec', emissiveIntensity: 1.1, roughness: 0.9 });
  g.add(plane(1.8, 2.5, glass, 0, 1.03, GENKAN.z0, 0));
  const lat = darkWood;
  for (let i = 0; i <= 12; i++) g.add(box(0.025, 2.5, 0.03, lat, -0.9 + i * 0.15, 1.03, GENKAN.z0 + 0.02, { shadow: false }));
  for (const y of [-0.2, 0.6, 1.4, 2.2]) g.add(box(1.8, 0.03, 0.035, lat, 0, y, GENKAN.z0 + 0.025, { shadow: false }));
  // 下駄箱
  g.add(box(0.36, 0.9, 1.0, pbr('oak_veneer_01', { rep: [1, 1], tint: '#8b6a4a' }), 0.7, GENKAN.y + 0.45, -0.75));
  g.add(box(0.4, 0.03, 1.04, darkWood, 0.7, GENKAN.y + 0.915, -0.75));
  // 花瓶（下駄箱の上）
  const vase = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.05, 0], [0.065, 0.06], [0.045, 0.16], [0.03, 0.2], [0.035, 0.22]].map(p => new THREE.Vector2(...p)), 24),
    new THREE.MeshPhysicalMaterial({ color: '#3b4a52', roughness: 0.35, clearcoat: 0.6 }));
  vase.position.set(0.7, GENKAN.y + 0.93, -0.5); vase.castShadow = true; g.add(vase);
  // 玄関の外の光
  const doorLight = new THREE.RectAreaLight('#dfe8f2', 6, 1.6, 2.2);
  doorLight.position.set(0, 1.0, GENKAN.z0 + 0.05); doorLight.lookAt(0, 1.0, 2); g.add(doorLight);

  // ---- 和室 ----
  const R = ROOM;
  // 畳（八畳。四つ角が集まらない敷き方）
  const U = TATAMI.short;
  const mats = [[0, 0, 2, 1], [2, 0, 2, 1], [0, 1, 1, 2], [1, 1, 2, 1], [1, 2, 2, 1], [3, 1, 1, 2], [0, 3, 2, 1], [2, 3, 2, 1]];
  M.tatamiRects = [];
  M.heriRects = [];
  const tatamiTop = 0.0;
  for (const [cx, cz, w, d] of mats) {
    const W = w * U, D = d * U;
    const x = R.x0 + cx * U + W / 2, z = R.z0 + cz * U + D / 2;
    const horiz = w > d;
    const mat = pbr('tatami_mat', { rep: horiz ? [W / 0.9, D / 0.9] : [W / 0.9, D / 0.9], rot: horiz ? 0 : Math.PI / 2, tint: '#d9cf9e', rough: 1, normal: 0.8 });
    const m = box(W - 0.004, 0.055, D - 0.004, mat, x, tatamiTop - 0.0275, z, { shadow: false });
    g.add(m);
    M.tatamiRects.push({ x, z, W, D });
    // 縁（長い辺の両側）
    const hw = 0.032;
    if (horiz) {
      for (const s of [-1, 1]) { g.add(box(W - 0.004, 0.057, hw, M.heri, x, tatamiTop - 0.0265, z + s * (D / 2 - hw / 2), { shadow: false })); M.heriRects.push({ x, z: z + s * (D / 2 - hw / 2), W, D: hw }); }
    } else {
      for (const s of [-1, 1]) { g.add(box(hw, 0.057, D - 0.004, M.heri, x + s * (W / 2 - hw / 2), tatamiTop - 0.0265, z, { shadow: false })); M.heriRects.push({ x: x + s * (W / 2 - hw / 2), z, W: hw, D }); }
    }
  }
  // 敷居（入口）
  M.threshold = { x: 0, z: R.z0, W: 1.76, D: 0.1 };
  g.add(box(1.76, 0.012, 0.1, pbr('oak_veneer_01', { rep: [2, 0.2], tint: '#b88d62', rough: 0.5 }), 0, 0.004, R.z0));
  // 壁
  const wallH = 1.8, upperH = R.h - 1.85;
  // 入口側の壁（廊下とのあいだ）：入口のまわりだけ
  for (const s of [-1, 1]) {
    const w = (R.x1 - R.x0 - 1.76) / 2;
    g.add(plane(w, wallH, plaster(w, wallH), s * (0.88 + w / 2), wallH / 2, R.z0 - 0.001, 0));
  }
  g.add(plane(R.x1 - R.x0, upperH, plaster(3.5, upperH), 0, 1.85 + upperH / 2, R.z0 + 0.002, 0));
  // 廊下から見える側（裏）：入口のまわりだけ
  for (const s of [-1, 1]) { const w = (R.x1 - R.x0 - 1.76) / 2; g.add(plane(w, R.h, plaster(w, R.h), s * (0.88 + w / 2), R.h / 2, R.z0 - 0.06, Math.PI)); }
  g.add(plane(1.76, R.h - 1.8, plaster(1.76, 0.6), 0, 1.8 + (R.h - 1.8) / 2, R.z0 - 0.06, Math.PI));
  // 左の壁
  g.add(plane(R.z1 - R.z0, R.h, plaster(3.5, R.h), R.x0, R.h / 2, (R.z0 + R.z1) / 2, Math.PI / 2));
  // 奥の壁（床の間の右）
  g.add(plane(1.76, R.h, plaster(1.76, R.h), 0.88, R.h / 2, R.z1, Math.PI));
  g.add(plane(1.76, R.h - 2.0, plaster(1.76, 0.4), -0.88, 2.0 + (R.h - 2.0) / 2, R.z1, Math.PI));
  // 床の間
  const tz = R.z1 + 0.6;
  g.add(box(1.7, 0.1, 0.6, pbr('oak_veneer_01', { rep: [1.5, 0.6], tint: '#a57f58', rough: 0.45 }), -0.88, 0.05, R.z1 + 0.3, { shadow: false }));
  g.add(box(1.72, 0.1, 0.06, lacquer, -0.88, 0.05, R.z1 + 0.03)); // 床框
  g.add(plane(1.76, R.h, plaster(1.76, R.h), -0.88, R.h / 2, tz, Math.PI));
  g.add(plane(0.6, R.h, plaster(0.6, R.h), R.x0 + 0.001, R.h / 2, R.z1 + 0.3, Math.PI / 2));
  g.add(plane(0.6, R.h, plaster(0.6, R.h), -0.001, R.h / 2, R.z1 + 0.3, -Math.PI / 2));
  g.add(box(1.76, 0.08, 0.66, pillarMat, -0.88, 2.0, R.z1 + 0.3)); // 落とし掛け
  // 掛軸
  const scroll = canvasTex(256, 768, (c, w, h) => {
    c.fillStyle = '#5b4a36'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#efe6d2'; c.fillRect(22, 90, w - 44, h - 200);
    noise(c, w, h, 10);
    // 山と月（水墨風）
    const grd = c.createLinearGradient(0, 300, 0, 560); grd.addColorStop(0, 'rgba(40,40,40,0)'); grd.addColorStop(1, 'rgba(40,40,40,.55)');
    c.fillStyle = grd; c.beginPath(); c.moveTo(22, 560); c.lineTo(70, 420); c.lineTo(110, 470); c.lineTo(160, 360); c.lineTo(234, 480); c.lineTo(234, 560); c.fill();
    c.fillStyle = 'rgba(30,30,30,.35)'; c.beginPath(); c.moveTo(22, 600); c.lineTo(90, 520); c.lineTo(150, 580); c.lineTo(234, 540); c.lineTo(234, 640); c.lineTo(22, 640); c.fill();
    c.strokeStyle = 'rgba(30,30,30,.6)'; c.lineWidth = 2; c.beginPath(); c.arc(180, 220, 26, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#b5302a'; c.fillRect(48, 640, 14, 14);
    c.fillStyle = '#3a2c1e'; c.fillRect(0, h - 26, w, 26); c.fillRect(0, 0, w, 14);
  });
  { const k = plane(0.42, 1.25, new THREE.MeshStandardMaterial({ map: scroll, roughness: 0.95, side: THREE.DoubleSide }), -0.88, 1.15, tz - 0.01, Math.PI); k.name = 'kakejiku'; g.add(k); }
  // 花（床の間）
  const vase2 = vase.clone(); vase2.position.set(-0.5, 0.1, R.z1 + 0.3); vase2.scale.setScalar(1.2); g.add(vase2);
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.5, 6), new THREE.MeshStandardMaterial({ color: '#3a2a1c' }));
  branch.position.set(-0.47, 0.55, R.z1 + 0.3); branch.rotation.z = -0.35; g.add(branch);
  for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshStandardMaterial({ color: i % 3 ? '#e9e2e6' : '#d8a3b0', roughness: 0.8 })); f.position.set(-0.47 + 0.09 * Math.sin(i) + i * 0.012, 0.42 + i * 0.04, R.z1 + 0.3 + 0.04 * Math.cos(i * 2)); g.add(f); }

  // 右の壁：障子（外の光）
  const shojiPaper = new THREE.MeshStandardMaterial({ color: '#f6f1e6', emissive: '#fff4e0', emissiveIntensity: 0.9, roughness: 1,
    map: canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#f4efe3'; c.fillRect(0, 0, w, h); noise(c, w, h, 14); }) });
  g.add(plane(R.z1 - R.z0, 1.8, shojiPaper, R.x1, 0.9, (R.z0 + R.z1) / 2, -Math.PI / 2));
  for (let i = 0; i <= 16; i++) g.add(box(0.02, 1.8, 0.018, pillarMat, R.x1 - 0.01, 0.9, R.z0 + i * (R.z1 - R.z0) / 16, { shadow: false, ry: Math.PI / 2 }));
  for (let j = 0; j <= 6; j++) g.add(box(0.018, 0.018, R.z1 - R.z0, pillarMat, R.x1 - 0.01, j * 0.3, (R.z0 + R.z1) / 2, { shadow: false }));
  g.add(plane(R.z1 - R.z0, upperH, plaster(3.5, upperH), R.x1, 1.85 + upperH / 2, (R.z0 + R.z1) / 2, -Math.PI / 2));
  const win = new THREE.RectAreaLight('#ffeedd', 7, R.z1 - R.z0 - 0.2, 1.6);
  win.position.set(R.x1 - 0.05, 0.95, (R.z0 + R.z1) / 2); win.lookAt(0, 0.95, (R.z0 + R.z1) / 2); g.add(win);

  // 入口側の襖（開けて右に寄せてある）
  const fusumaTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#e7dfcc'; c.fillRect(0, 0, w, h); noise(c, w, h, 12);
    c.strokeStyle = 'rgba(160,140,100,.25)'; c.lineWidth = 1;
    for (let i = 0; i < 40; i++) { const x = Math.random() * w, y = Math.random() * h; c.beginPath(); c.arc(x, y, 6 + Math.random() * 10, 0, Math.PI * 2); c.stroke(); }
  });
  const fusumaMat = new THREE.MeshStandardMaterial({ map: fusumaTex, roughness: 0.95 });
  for (const s of [-1, 1]) {
    const fx = s * 1.32;
    g.add(box(0.86, 1.78, 0.02, fusumaMat, fx, 0.9, R.z0 + 0.015 + (s > 0 ? 0.03 : 0)));
    g.add(box(0.88, 0.025, 0.03, lacquer, fx, 1.785, R.z0 + 0.015 + (s > 0 ? 0.03 : 0)));
    g.add(box(0.88, 0.025, 0.03, lacquer, fx, 0.015, R.z0 + 0.015 + (s > 0 ? 0.03 : 0)));
    const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 20), new THREE.MeshStandardMaterial({ color: '#2a2018', metalness: 0.6, roughness: 0.4 }));
    pull.rotation.x = Math.PI / 2; pull.position.set(fx - s * 0.33, 0.85, R.z0 + 0.04 + (s > 0 ? 0.03 : 0)); g.add(pull);
  }
  // 柱・鴨居・長押
  const P = 0.105;
  for (const [x, z] of [[R.x0, R.z0], [R.x1, R.z0], [R.x0, R.z1], [R.x1, R.z1], [0, R.z1], [-0.88, R.z0], [0.88, R.z0]]) g.add(box(P, R.h, P, pillarMat, x, R.h / 2, z));
  g.add(box(R.x1 - R.x0, 0.05, 0.09, pillarMat, 0, 1.825, R.z0));
  g.add(box(R.x1 - R.x0, 0.09, 0.03, pillarMat, 0, 1.9, R.z0 + 0.06));
  g.add(box(0.03, 0.09, R.z1 - R.z0, pillarMat, R.x0 + 0.06, 1.9, (R.z0 + R.z1) / 2));
  g.add(box(R.x1 - R.x0, 0.09, 0.03, pillarMat, 0, 1.9, R.z1 - 0.06));
  g.add(box(0.05, 0.05, R.z1 - R.z0, pillarMat, R.x1 - 0.03, 1.825, (R.z0 + R.z1) / 2));
  // 天井（竿縁）
  g.add(plane(R.x1 - R.x0, R.z1 - R.z0 + 0.6, cedar(3.5, 4, Math.PI / 2), 0, R.h, (R.z0 + R.z1 + 0.6) / 2, 0, Math.PI / 2));
  for (let i = 1; i < 8; i++) g.add(box(0.03, 0.03, R.z1 - R.z0 + 0.6, pillarMat, R.x0 + i * 0.44, R.h - 0.015, (R.z0 + R.z1 + 0.6) / 2, { shadow: false }));

  // 座卓
  const tableTop = 0.33;
  M.table = { x: 0, z: 3.76, w: 1.5, d: 0.9, y: tableTop };
  const tw = pbr('oak_veneer_01', { rep: [1.5, 0.9], tint: '#8a5d36', rough: 0.35 });
  g.add(box(1.5, 0.035, 0.9, tw, 0, tableTop - 0.0175, 3.76));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.06, tableTop - 0.035, 0.06, tw, sx * 0.66, (tableTop - 0.035) / 2, 3.76 + sz * 0.37));
  g.add(box(1.4, 0.06, 0.03, tw, 0, tableTop - 0.065, 3.76 - 0.42)); g.add(box(1.4, 0.06, 0.03, tw, 0, tableTop - 0.065, 3.76 + 0.42));

  // 座布団
  M.cushions = {};
  const cushionMat = (c) => pbr('rough_linen', { rep: [1.5, 1.5], tint: c, normal: 1.2 });
  const cushion = (key, x, z, color) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.075, 0.65, 4, 0.035), cushionMat(color));
    m.position.set(x, 0.0375, z); m.castShadow = true; m.receiveShadow = true; g.add(m);
    M.cushions[key] = { x, z, mesh: m };
  };
  cushion('father', -0.36, 4.62, '#4a2a2a'); cushion('mother', 0.42, 4.62, '#4a2a2a');
  cushion('player', -0.36, 2.86, '#4a2a2a'); cushion('partner', 0.42, 2.86, '#4a2a2a');

  // ペンダント照明（和紙）
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.24, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#fff7e8', emissive: '#ffe2b8', emissiveIntensity: 1.4, side: THREE.DoubleSide, roughness: 1 }));
  lamp.position.set(0, 1.95, 3.76); g.add(lamp);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.35), new THREE.MeshStandardMaterial({ color: '#222' }));
  cord.position.set(0, 2.24, 3.76); g.add(cord);
  const pl = new THREE.PointLight('#ffd9a8', 5.5, 7, 1.6);
  pl.position.set(0, 1.85, 3.76); pl.castShadow = true; pl.shadow.mapSize.set(1024, 1024); pl.shadow.bias = -0.0015; pl.shadow.radius = 6; pl.userData.shadowHigh = true; pl.userData.shadowLow = true; g.add(pl);
  // 廊下の明かり
  const hl = new THREE.PointLight('#ffe0b8', 2.2, 5, 1.8); hl.position.set(0, 2.1, 0.8); hl.castShadow = true; hl.shadow.mapSize.set(512, 512); hl.shadow.radius = 5; hl.userData.shadowHigh = true; hl.userData.shadowLow = false; g.add(hl);
  // 外の柔らかい光（影は小さく）
  const sun = new THREE.DirectionalLight('#fff1dc', 0.5); sun.position.set(4, 5, 3); sun.target.position.set(0, 0, 3.5);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 5, bottom: -5, near: 0.5, far: 15 });
  sun.shadow.radius = 8; sun.shadow.bias = -0.001; g.add(sun, sun.target);
  return M;
}
