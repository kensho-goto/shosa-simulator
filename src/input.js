// 入力：どの場面でも同じ操作。
//  移動 WASD/矢印 ・ お辞儀 Space（押している間さがる）・ 座る/立つ F（押している間）
//  持つ マウス左（押し続ける）・ 向き Q/E またはホイール横 ・ 傾き ホイール または Z/X
//  話す 1〜3 ・ 決定 Enter ・ 一時停止 Esc
export class Input {
  constructor(canvas) {
    this.down = new Set(); this.pressed = new Set(); this.released = new Set();
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, nx: 0, ny: 0, left: false, leftPressed: false, leftReleased: false, wheel: 0 };
    this.sens = 1;
    addEventListener('keydown', e => {
      if (e.repeat) return;
      const k = norm(e); this.down.add(k); this.pressed.add(k);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', e => { const k = norm(e); this.down.delete(k); this.released.add(k); });
    addEventListener('blur', () => { this.down.clear(); this.mouse.left = false; });
    canvas.addEventListener('mousedown', e => { if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; } });
    addEventListener('mouseup', e => { if (e.button === 0 && this.mouse.left) { this.mouse.left = false; this.mouse.leftReleased = true; } });
    addEventListener('mousemove', e => {
      this.mouse.dx += e.movementX || 0; this.mouse.dy += e.movementY || 0;
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      this.mouse.nx = (e.clientX / innerWidth) * 2 - 1; this.mouse.ny = -(e.clientY / innerHeight) * 2 + 1;
    });
    canvas.addEventListener('wheel', e => { this.mouse.wheel += Math.sign(e.deltaY) * Math.min(3, Math.abs(e.deltaY) / 40); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  key(k) { return this.down.has(k); }
  hit(k) { return this.pressed.has(k); }
  up(k) { return this.released.has(k); }
  // よく使うまとめ
  get move() {
    const x = (this.key('d') || this.key('arrowright') ? 1 : 0) - (this.key('a') || this.key('arrowleft') ? 1 : 0);
    const y = (this.key('w') || this.key('arrowup') ? 1 : 0) - (this.key('s') || this.key('arrowdown') ? 1 : 0);
    return { x, y };
  }
  get bow() { return this.key(' '); }
  get sit() { return this.key('f'); }
  get turn() { return (this.key('e') ? 1 : 0) - (this.key('q') ? 1 : 0); }
  get tilt() { return (this.key('x') ? 1 : 0) - (this.key('z') ? 1 : 0); }
  choice() { for (const k of ['1', '2', '3', '4']) if (this.hit(k)) return +k; return 0; }
  endFrame() {
    this.pressed.clear(); this.released.clear();
    this.mouse.dx = this.mouse.dy = 0; this.mouse.wheel = 0;
    this.mouse.leftPressed = this.mouse.leftReleased = false;
  }
}
function norm(e) { return e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase(); }
