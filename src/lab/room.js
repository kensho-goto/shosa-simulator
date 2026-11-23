// 人物の確認用の小さな和室（約6畳）。畳・漆喰・杉の天井・障子の光・台が2つ。
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { pbr } from '../env.js';

export const LAB = { x0: -1.8, x1: 1.8, z0: -1.35, z1: 1.35, h: 2.4 };
export const STAND_TOP = 0.7;
// 台の場所（箱を置く面の中心）
export const STANDS = {
  A: new THREE.Vector3(-1.2, STAND_TOP, 0.85),
  B: new THREE.Vector3(1.2, STAND_TOP, 0.85),
};

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function buildLab(scene) {
  RectAreaLightUniformsLib.init();
  const g = new THREE.Group(); scene.add(g);
  const L = LAB, W = L.x1 - L.x0, D = L.z1 - L.z0;
  // 畳（6枚を2列×3）
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const mat = pbr('tatami_mat', { rep: [2, 1], rot: (i + j) % 2 ? Math.PI / 2 : 0, tint: '#d9cf9e', rough: 1, normal: 0.8 });
    const t = box(W / 2 - 0.004, 0.05, D / 2 - 0.004, mat, L.x0 + W / 4 + i * W / 2, -0.025, L.z0 + D / 4 + j * D / 2);
    t.castShadow = false; g.add(t);
  }
  // 壁・天井
  const plaster = (w, h) => pbr('white_plaster_rough_01', { rep: [w / 1.6, h / 1.6], tint: '#e9dcc4', normal: 0.6 });
  const wallN = new THREE.Mesh(new THREE.PlaneGeometry(W, L.h), plaster(W, L.h)); wallN.position.set(0, L.h / 2, L.z0); g.add(wallN);
  const wallW = new THREE.Mesh(new THREE.PlaneGeometry(D, L.h), plaster(D, L.h)); wallW.position.set(L.x0, L.h / 2, 0); wallW.rotation.y = Math.PI / 2; g.add(wallW);
  const wallE = new THREE.Mesh(new THREE.PlaneGeometry(D, L.h), plaster(D, L.h)); wallE.position.set(L.x1, L.h / 2, 0); wallE.rotation.y = -Math.PI / 2; g.add(wallE);
  for (const w of [wallN, wallW, wallE]) w.receiveShadow = true;
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), pbr('japanese_cedar_planks', { rep: [W / 1.2, D / 1.2], tint: '#e8d2b0' }));
  ceil.position.set(0, L.h, 0); ceil.rotation.x = Math.PI / 2; g.add(ceil);
  // 手前（カメラ側）の縁側：板の床と、左右の壁をのばす（部屋の外の黒い空間が写らないように）
  const EXT = 3.4;
  const boards = new THREE.Mesh(new THREE.PlaneGeometry(W, EXT), pbr('wood_floor_worn', { rep: [W / 1.4, EXT / 1.4], tint: '#b08a62', rough: 0.8 }));
  boards.rotation.x = -Math.PI / 2; boards.position.set(0, -0.045, L.z1 + EXT / 2); boards.receiveShadow = true; g.add(boards);
  for (const [x, ry] of [[L.x0, Math.PI / 2], [L.x1, -Math.PI / 2]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(EXT, L.h), plaster(EXT, L.h)); w.position.set(x, L.h / 2, L.z1 + EXT / 2); w.rotation.y = ry; w.receiveShadow = true; g.add(w);
  }
  const ceil2 = new THREE.Mesh(new THREE.PlaneGeometry(W, EXT), pbr('japanese_cedar_planks', { rep: [W / 1.2, EXT / 1.2], tint: '#d9c19c' }));
  ceil2.position.set(0, L.h, L.z1 + EXT / 2); ceil2.rotation.x = Math.PI / 2; g.add(ceil2);
  // 柱
  const pillar = pbr('oak_veneer_01', { rep: [0.2, 2], tint: '#c9a57a', rough: 0.9 });
  for (const [x, z] of [[L.x0 + 0.06, L.z0 + 0.06], [L.x1 - 0.06, L.z0 + 0.06], [L.x0 + 0.06, L.z1 - 0.06], [L.x1 - 0.06, L.z1 - 0.06]]) g.add(box(0.11, L.h, 0.11, pillar, x, L.h / 2, z));
  // 障子（北の壁の前・光る面）
  const shojiMat = new THREE.MeshStandardMaterial({ color: '#f4efe4', emissive: '#f6eedd', emissiveIntensity: 0.55, roughness: 0.9 });
  const shoji = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.75), shojiMat); shoji.position.set(0, 1.05, L.z0 + 0.02); g.add(shoji);
  const frame = pbr('oak_veneer_01', { rep: [1, 1], tint: '#b48c62', rough: 0.8 });
  for (let i = 0; i <= 8; i++) g.add(box(0.02, 1.75, 0.02, frame, -1.3 + i * 2.6 / 8, 1.05, L.z0 + 0.03));
  for (let j = 0; j <= 5; j++) g.add(box(2.6, 0.02, 0.02, frame, 0, 0.175 + j * 1.75 / 5, L.z0 + 0.03));
  // 台（箱を置く）
  const oak = pbr('oak_veneer_01', { rep: [1, 1], tint: '#6b4a30', rough: 0.55 });
  for (const p of Object.values(STANDS)) {
    g.add(box(0.5, 0.04, 0.4, oak, p.x, STAND_TOP - 0.02, p.z));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.04, STAND_TOP - 0.04, 0.04, oak, p.x + sx * 0.21, (STAND_TOP - 0.04) / 2, p.z + sz * 0.16));
  }
  // 明かり：和室（障子の光＋天井の明かり）と、確かめ用の安定した明かり
  const washitsu = [], studio = [];
  const win = new THREE.RectAreaLight('#fff1de', 9, 2.6, 1.75); win.position.set(0, 1.05, L.z0 + 0.05); win.lookAt(0, 1.05, 2); g.add(win); washitsu.push(win);
  const pend = new THREE.PointLight('#ffd9a8', 2.4, 6, 1.6); pend.position.set(0, 2.05, 0.1); pend.castShadow = false; // 点の光の影は硬く、鼻の影がくっきり出すぎる（和紙の笠を通した光は柔らかい）。影は外の光と照り返しにまかせる g.add(pend); washitsu.push(pend);
  // 畳と壁からの照り返し（和室は下からの柔らかい光が多い。顔の影が真っ黒にならない）
  const bounce = new THREE.HemisphereLight('#fff2df', '#c9a86f', 0.45); g.add(bounce); washitsu.push(bounce);
  const sun = new THREE.DirectionalLight('#fff4e6', 0.9); sun.position.set(0.6, 3.2, -2.4); sun.target.position.set(0, 0, 0.5);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 4; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 0.5, far: 8 });
  g.add(sun, sun.target); washitsu.push(sun);
  const key = new THREE.DirectionalLight('#ffffff', 1.6); key.position.set(-1.5, 2.6, 2.8); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 3; key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 0.5, far: 9 });
  const fill = new THREE.HemisphereLight('#ffffff', '#b8a890', 0.9);
  g.add(key, fill); studio.push(key, fill);
  const setLighting = mode => {
    for (const l of washitsu) l.visible = mode === 'washitsu';
    for (const l of studio) l.visible = mode === 'studio';
    scene.environmentIntensity = mode === 'studio' ? 0.55 : 0.35;
  };
  setLighting('studio');
  return { group: g, setLighting };
}

// 床・台の高さ（物が落ちたときに使う）
export function labFloor(x, z) {
  for (const p of Object.values(STANDS)) if (Math.abs(x - p.x) < 0.25 && Math.abs(z - p.z) < 0.2) return STAND_TOP;
  return 0;
}
