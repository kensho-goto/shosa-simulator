// 描画の土台：レンダラー・光の環境・後処理（陰影）・カメラ
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createRenderer(canvas, quality = 'high') {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d0b09');
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.05, 60);
  camera.position.set(1.4, 1.4, 1.8);
  const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
  ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.5, scale: 1.2, samples: 12 });
  ao.blendIntensity = 0.85;
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  const R = { renderer, scene, camera, composer, ao, quality };
  R.setQuality = q => {
    R.quality = q; ao.enabled = q === 'high';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === 'high' ? 2 : 1.5));
    // かるい画質：影を作る明かりを減らす（スマホ向け）
    scene.traverse(o => { if (o.isPointLight && o.userData.shadowHigh != null) o.castShadow = q === 'high' ? o.userData.shadowHigh : o.userData.shadowLow; });
    R.resize();
  };
  R.resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', R.resize);
  R.render = () => { if (ao.enabled) composer.render(); else renderer.render(scene, camera); };
  R.setQuality(quality);
  return R;
}

export async function loadEnvironment(R, file = 'assets/hdri/kiara_interior_1k.hdr', intensity = 0.35) {
  const hdr = await new RGBELoader().loadAsync(file);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(R.renderer);
  const env = pm.fromEquirectangular(hdr).texture;
  R.scene.environment = env;
  R.scene.environmentIntensity = intensity;
  hdr.dispose(); pm.dispose();
}

// カメラ：決めた構図へなめらかに移る。操作中は勝手に切り替えない。
export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.pos = camera.position.clone();
    this.look = new THREE.Vector3(0, 1, 3);
    this.goalPos = this.pos.clone(); this.goalLook = this.look.clone();
    this.speed = 2.0; this.fov = 40; this.goalFov = 40;
    this.follow = null; // {actor, offset, lookOffset}
    this.shake = 0; this.t = 0;
  }
  shot(pos, look, { fov = 40, speed = 2.0, cut = false } = {}) {
    this.goalPos.set(...pos); this.goalLook.set(...look); this.goalFov = fov; this.speed = speed; this.follow = null;
    if (cut) { this.pos.copy(this.goalPos); this.look.copy(this.goalLook); this.fov = fov; }
  }
  followActor(actor, offset, lookOffset, { fov = 42, speed = 2.5 } = {}) {
    this.follow = { actor, offset: new THREE.Vector3(...offset), lookOffset: new THREE.Vector3(...lookOffset) }; this.goalFov = fov; this.speed = speed;
  }
  update(dt) {
    this.t += dt;
    if (this.follow) {
      const a = this.follow.actor;
      this.goalPos.copy(a.pos).add(this.follow.offset);
      this.goalLook.copy(a.pos).add(this.follow.lookOffset);
    }
    const k = 1 - Math.exp(-dt * this.speed);
    this.pos.lerp(this.goalPos, k); this.look.lerp(this.goalLook, k);
    this.fov += (this.goalFov - this.fov) * k;
    this.cam.position.copy(this.pos);
    // 手持ちのような、ごく小さなゆれ
    this.cam.position.x += Math.sin(this.t * 0.7) * 0.004; this.cam.position.y += Math.sin(this.t * 0.9 + 1) * 0.003;
    if (this.shake > 0) { this.cam.position.x += (Math.random() - 0.5) * this.shake; this.cam.position.y += (Math.random() - 0.5) * this.shake; this.shake *= 0.9; }
    this.cam.lookAt(this.look);
    if (Math.abs(this.cam.fov - this.fov) > 0.01) { this.cam.fov = this.fov; this.cam.updateProjectionMatrix(); }
  }
}
