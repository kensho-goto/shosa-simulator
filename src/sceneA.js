// 第一章：親への結婚挨拶（場面 SC-A）
// 舞台・人物・台詞はすべて架空。ここで示す作法は「この家で、この場面で採用した決まり」であり、
// 日本全国で同じ唯一の正解ではない。誇張はゲーム用の演出。
import * as THREE from 'three';
import { GENKAN, ROOM } from './env.js';
import { bow, hand, choose, walk, posture, tap, charge, mash, judge } from './ops.js';
import { makeStain } from './props.js';
import { rushTea, resetChaos, RUSH_FINDS } from './kikubari.js';

const G = GENKAN.y;
const PI = Math.PI;
const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) < r;
const inRect = (p, r, pad = 0) => Math.abs(p.x - r.x) <= r.W / 2 + pad && Math.abs(p.z - r.z) <= r.D / 2 + pad;
const yawErr = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const clamp01 = v => Math.max(0, Math.min(1, v));

export const FINDS = {
  bonk: { name: 'ごつん', desc: '玄関で、相手と頭がぶつかった。近すぎるお辞儀。' },
  pingpong: { name: 'お辞儀の応酬', desc: '遅れて下げたら、相手もつられてもう一度。終わらない。' },
  stuck: { name: '頭が上がらない', desc: '相手はとっくに顔を上げている。' },
  shoeFly: { name: '靴、宙を舞う', desc: '勢いよく離した靴が、土間を転がっていった。' },
  motherShoes: { name: '母の無言の靴直し', desc: '気づけば、お母さんがそっと靴をそろえていた。' },
  shoeBackward: { name: 'つま先は家の奥へ', desc: 'そろえたつもりが、逆向きだった。' },
  threshold: { name: '敷居のきしみ', desc: 'ぎしっ。部屋じゅうが、あなたの足元を見た。' },
  heri: { name: '縁ふみ名人', desc: '畳の縁を、4回以上ふんだ。' },
  cushionStep: { name: '座布団ふみ', desc: '立ったまま、座布団の上を歩いた。' },
  interruptHello: { name: 'かぶせる自己紹介', desc: 'お父さんの話の途中で、名乗ってしまった。' },
  giftUpside: { name: '逆さのご挨拶', desc: 'のしの文字が、お父さんから見て逆さだった。お父さんが自分で回した。' },
  giftDrop: { name: '手土産、畳に落つ', desc: '手を離すのが早すぎた。' },
  handsHover: { name: '行き場のない手', desc: '受け取ろうとしたお父さんの手が、宙で待ちつづけた。' },
  silentGift: { name: '無言の献上', desc: '何も言わずに、すっと差し出した。' },
  hot: { name: 'あつっ', desc: '一気に傾けて、熱いお茶を流しこんだ。' },
  choke: { name: 'お茶でむせる', desc: '飲みながら答えようとした。' },
  cupDrop: { name: '湯のみ、転がる', desc: '空中で手を離した。' },
  ignoreSpill: { name: '見なかったことに', desc: 'こぼれたお茶を、そのままにした。全員が見ていた。' },
  partnerAnswer: { name: '代わりに答える恋人', desc: '黙っていたら、美咲さんが答えてくれた。' },
  interrupt: { name: '食い気味の決意', desc: 'お父さんがまだ話しているのに、言ってしまった。' },
  eternal: { name: '永遠の沈黙', desc: '言うべき瞬間を、見送りつづけた。時計の音だけが聞こえる。' },
  showa: { name: '昭和のドラマ', desc: '「娘さんをください」。お父さんは、少し笑った。' },
  numbSink: { name: 'しびれて戻る', desc: '立ちかけて、すとんと座り直した。' },
  numbStagger: { name: 'しびれ千鳥足', desc: 'しびれたまま歩きだして、よろけた。' },
  backTurn: { name: '閉まる前に背を向ける', desc: 'まだお辞儀をしている二人に、背中を向けた。' },
  kneeSlide: { name: 'ひざすべり', desc: 'ひざで進みすぎて、机にごつん。' },
  quickDraw: { name: '早押しの名人', desc: '質問が来た瞬間、湯のみを置いた。' },
  perfect: { name: '非の打ちどころがない', desc: 'すべての所作を、ほぼ完ぺきにこなした。' },
};
Object.assign(FINDS, RUSH_FINDS);

export const SCENE = {
  id: 'SC-A', chapter: '第一章', title: '親への結婚挨拶',
  steps: [
    { id: 'A1', title: '玄関で挨拶', items: ['S027'] },
    { id: 'A2', title: '靴をそろえる', items: ['S016', 'S017', 'S018'] },
    { id: 'A3', title: '和室へ入る', items: ['S019', 'S020'] },
    { id: 'A4', title: '座って名乗る', items: ['S023', 'S026'] },
    { id: 'A5', title: '座布団と手土産', items: ['S022', 'S025', 'S028'] },
    { id: 'A6', title: 'お茶と会話', items: ['S029'] },
    { id: 'A7', title: '結婚の意思を伝える', items: ['S001', 'S026'] },
    { id: 'A8', title: '立ち上がって見送り', items: ['S024', 'S030', 'S027'] },
  ],
};

// ---------------- 場所の決まり ----------------
const SEAT = {
  player: { x: -0.36, z: 2.86 }, partner: { x: 0.42, z: 2.86 }, father: { x: -0.36, z: 4.62 }, mother: { x: 0.42, z: 4.62 },
  playerFront: { x: -0.36, z: 2.42 }, partnerFront: { x: 0.42, z: 2.42 },
};
const CUP = { player: { x: -0.36, z: 3.42 }, partner: { x: 0.42, z: 3.42 }, father: { x: -0.36, z: 4.08 }, mother: { x: 0.42, z: 4.08 } };
const CUSHION_Y = 0.07;
const TABLE_Y = 0.33;
const HANDOFF = new THREE.Vector3(-0.36, 0.43, 3.86);

function baseRoom(ctx, { onCushion = true } = {}) {
  const { father, mother, partner } = ctx.actors;
  ctx.place(father, SEAT.father.x, CUSHION_Y, SEAT.father.z, PI, 1);
  ctx.place(mother, SEAT.mother.x, CUSHION_Y, SEAT.mother.z, PI, 1);
  if (onCushion) ctx.place(partner, SEAT.partner.x, CUSHION_Y, SEAT.partner.z, 0, 1);
  ctx.hideCups(true);
}
function neatShoes(ctx) {
  const { shoeL, shoeR } = ctx.props;
  for (const [s, x] of [[shoeL, -0.42], [shoeR, -0.3]]) { s.obj.visible = true; s.free = false; s.pos.set(x, G + 0.0, -0.22); s.obj.rotation.set(0, PI, 0); }
}
function cupsReset(ctx) {
  for (const k of ['player', 'partner', 'father', 'mother']) {
    const c = ctx.props['cup_' + k], s = ctx.props['saucer_' + k];
    s.obj.visible = c.obj.visible = true;
    s.pos.set(CUP[k].x, TABLE_Y, CUP[k].z); c.pos.set(CUP[k].x, TABLE_Y + 0.012, CUP[k].z);
    c.obj.quaternion.identity(); c.free = false; c.level = 0.8; setTea(c);
  }
}
function setTea(c) { const tea = c.obj.userData.tea; tea.visible = c.level > 0.02; tea.position.y = 0.014 + 0.07 * c.level; tea.scale.setScalar(0.88 + 0.12 * c.level); }

// ================= 各ステップ =================
export const STEPS = {
  // ---------- A1 玄関で挨拶 ----------
  A1: {
    setup(ctx) {
      const { player, partner, mother, father } = ctx.actors;
      ctx.place(player, -0.15, G, ctx.easy ? -0.5 : -0.85, 0, 0);
      ctx.place(partner, 0.32, G, -0.95, 0, 0);
      ctx.place(mother, 0.08, 0, 0.5, PI, 0);
      ctx.place(father, SEAT.father.x, CUSHION_Y, SEAT.father.z, PI, 1);
      for (const k of ['shoeL', 'shoeR', 'gift', 'bag', 'cloth']) ctx.props[k].obj.visible = false;
      cupsReset(ctx); ctx.hideCups(true);
      ctx.shot([0.72, 1.62, -1.45], [-0.02, 0.92, 0.15], { fov: 50, cut: true });
    },
    async run(ctx) {
      const { player, partner, mother } = ctx.actors;
      mother.lookAt(player); partner.lookAt(mother);
      ctx.sfx.play('door');
      await ctx.wait(0.8);
      await ctx.talk('mother', 'いらっしゃい。遠いところ、よく来てくれたわね。', 2.6);
      ctx.objective('お母さんに<em>お辞儀</em>であいさつする<br><small>相手が頭を下げはじめたら合わせる</small>');
      // 少しだけ前に出られる（近づきすぎると…）
      if (ctx.easy) ctx.objective('お母さんに<em>お辞儀</em>であいさつする<br><small>押している間さがる。金色ではなす。深すぎると……</small>');
      const stopMove = ctx.every(dt => {
        const m = ctx.input.move; if (!m.y || ctx.easy) return;
        player.pos.z = THREE.MathUtils.clamp(player.pos.z + m.y * 0.5 * dt, -1.1, -0.12);
        player.s.speed = 0.4;
      });
      const r = await bow(ctx, {
        zone: [25, 42], cap: 'お辞儀の深さ', hold: 0.7,
        npcs: [{ actor: mother, at: 1.4, depth: 30, hold: 1.1 }, { actor: partner, mirror: true, depth: 28, hold: 1.0 }],
        bonkWith: mother,
        onBonk: () => { ctx.find('bonk'); ctx.say('mother', 'あいたっ……。', 1.5); },
        onStuck: () => { ctx.find('stuck'); ctx.say('mother', 'あらあら、どうぞ、お顔を上げて。', 2.4); ctx.story.moodAdd(-3); },
        onPingPong: () => { ctx.find('pingpong'); ctx.aside('（お辞儀が、終わらない……）'); },
      });
      stopMove(); player.s.speed = 0;
      let care = 0;
      if (r.bonk) {
        // 失敗のあとの立て直し
        ctx.objective('ぶつかってしまった。どうする？');
        const c = await choose(ctx, { list: [{ text: '「す、すみません！ 大丈夫ですか」' }, { text: '（笑ってごまかす）' }, { text: '（何事もなかったように立つ）' }], timer: 6 });
        if (c.index === 1) { await ctx.talk('player', 'す、すみません！ 大丈夫ですか。', 1.8); mother.gesture('nod'); await ctx.talk('mother', 'ふふ、平気よ。緊張してるのね。', 2.2); care = 1; ctx.story.moodAdd(3); }
        else if (c.index === 2) { await ctx.talk('player', 'は、はは……。', 1.2); await ctx.talk('mother', '……ふふ。', 1.2); care = 0; }
        else { mother.gesture('tilt'); await ctx.wait(1.6); ctx.aside('（おでこが、じんじんする）'); care = -1; ctx.story.moodAdd(-4); }
      } else if (r.skipped) {
        mother.gesture('tilt'); await ctx.talk('mother', '……さ、どうぞ。', 1.6); ctx.story.moodAdd(-5); care = -1;
      } else if (r.score > 0.75) { ctx.sfx.play('good'); ctx.story.moodAdd(4); mother.gesture('nod'); }
      ctx.story.setTech('A1', r.score);
      ctx.story.addCare('A1', care, 'bonk');
      await ctx.talk('mother', 'さあ、どうぞ上がって。', 1.8);
    },
  },

  // ---------- A2 靴を脱いでそろえる ----------
  A2: {
    setup(ctx) {
      const { player, partner, mother, father } = ctx.actors;
      ctx.place(player, -0.22, 0, 0.36, PI - 0.5, 1); player.s.bow = 20;
      ctx.place(partner, 0.42, 0, 0.75, PI + 0.4, 0);
      ctx.place(mother, 0.12, 0, 1.2, PI, 0);
      ctx.place(father, SEAT.father.x, CUSHION_Y, SEAT.father.z, PI, 1);
      const { shoeL, shoeR, pshoeL, pshoeR } = ctx.props;
      shoeL.obj.visible = shoeR.obj.visible = true; shoeL.free = shoeR.free = false;
      shoeL.pos.set(-0.24, G, -0.36); shoeL.obj.rotation.set(0, 0.35, 0);
      shoeR.pos.set(-0.02, G + 0.04, -0.5); shoeR.obj.rotation.set(0, -0.5, 1.25);
      shoeL.done = shoeR.done = false;
      for (const [s, x] of [[pshoeL, 0.36], [pshoeR, 0.48]]) { s.obj.visible = true; s.pos.set(x, G, -0.2); s.obj.rotation.set(0, PI, 0); }
      ctx.shot([0.6, 1.3, 0.3], [-0.2, G, -0.38], { fov: 48, cut: true });
    },
    async run(ctx) {
      const { player, partner, mother } = ctx.actors;
      const { shoeL, shoeR, pshoeL, pshoeR } = ctx.props;
      partner.lookAt(player);
      await ctx.talk('partner', '（靴、そろえてね。つま先は戸のほうに。私のと同じように）', 3.2);
      if (ctx.easy) return easyShoes(ctx);
      ctx.objective('脱いだ靴を<em>そろえる</em><br><small>つま先を戸のほうへ・左右をならべて・真ん中をあけて端に</small>');
      player.lookAt(new THREE.Vector3(-0.15, G, -0.35));
      let t = 0, okT = 0, said25 = false, flew = false, gaveUp = false;
      const check = () => {
        const both = [shoeL, shoeR].every(s => !s.held && !s.free);
        if (!both) return null;
        const yaw = Math.max(yawErr(shoeL.obj.rotation.y, PI), yawErr(shoeR.obj.rotation.y, PI));
        const dx = Math.abs(shoeL.pos.x - shoeR.pos.x), dz = Math.abs(shoeL.pos.z - shoeR.pos.z);
        const mx = (shoeL.pos.x + shoeR.pos.x) / 2, mz = (shoeL.pos.z + shoeR.pos.z) / 2;
        const clearOfPartner = [shoeL, shoeR].every(s => Math.hypot(s.pos.x - 0.42, s.pos.z + 0.2) > 0.16);
        const upright = [shoeL, shoeR].every(s => Math.abs(s.obj.rotation.z) < 0.1 && Math.abs(s.obj.rotation.x) < 0.1);
        const backward = yawErr(shoeL.obj.rotation.y, 0) < 0.6 && yawErr(shoeR.obj.rotation.y, 0) < 0.6;
        const s = {
          yaw: clamp01(1 - Math.max(0, yaw - 0.2) / 0.8), pair: (dx > 0.07 && dx < 0.22 && dz < 0.07) ? 1 : 0.4,
          side: Math.abs(mx) > 0.15 && clearOfPartner ? 1 : 0.5, edge: mz > -0.5 && mz < -0.06 ? 1 : 0.6, upright: upright ? 1 : 0.3, backward,
        };
        s.score = s.yaw * 0.4 + s.pair * 0.2 + s.side * 0.15 + s.edge * 0.1 + s.upright * 0.15;
        s.good = s.score > 0.92;
        return s;
      };
      let last = null;
      const r = await hand(ctx, {
        props: [shoeL, shoeR], planeY: G + 0.075, bounds: { x0: -0.82, x1: 0.82, z0: -1.4, z1: -0.08 },
        rotate: true, snapYaw: PI, tremor: 0.004, handOffset: new THREE.Vector3(0, 0.06, 0),
        keys: [['mouse', '押している間 持つ（はなすと置く）'], ['qe', '向きを変える'], ['enter', 'これでよし']],
        onGrab: (p) => { p.obj.rotation.x = 0; p.obj.rotation.z = 0; },
        onRelease: (p, st) => {
          const sp = st.vel.length();
          if (sp > 1.4) { flew = true; ctx.find('shoeFly'); mother.gesture('flinch'); ctx.story.moodAdd(-3); return 'drop'; }
          p.pos.y = G; ctx.sfx.play('set', 0.6); return 'keep';
        },
        onLand: () => { ctx.say('mother', 'あら……。', 1.2); },
        onFrame: (dt) => {
          t += dt;
          last = check();
          if (last && last.good) { okT += dt; if (okT > 0.6) return { ok: true }; } else okT = 0;
          if (ctx.input.hit('enter')) return { ok: !!(last && last.good), manual: true };
          if (t > 25 && !said25) { said25 = true; ctx.say('mother', 'あら、いいのよ、そのままで。', 2.2); }
          if (t > 38) { gaveUp = true; return { ok: false }; }
          return null;
        },
      });
      shoeL.done = shoeR.done = true;
      const s = check() || { score: 0.2, backward: false };
      let score = s.score, care = 0;
      if (!r.ok) {
        if (s.backward) ctx.find('shoeBackward');
        // お母さんが、そっと直す
        ctx.objective('');
        mother.lookAt(shoeL.obj);
        await ctx.wait(0.6);
        ctx.aside('（お母さんが、そっと靴を直してくれた……）', 2.4);
        ctx.find('motherShoes');
        neatShoes(ctx); ctx.sfx.play('set', 0.5);
        await ctx.wait(1.2);
        const c = await choose(ctx, { list: [{ text: '「あっ、すみません。ありがとうございます」' }, { text: '（気づかなかったふりをする）' }], timer: 6 });
        if (c.index === 1) { await ctx.talk('player', 'あっ、すみません。ありがとうございます。', 2.0); mother.gesture('nod'); await ctx.talk('mother', 'いいのよ。', 1.2); care = 1; }
        else { care = -1; ctx.story.moodAdd(-3); }
        score = Math.min(score, gaveUp ? 0.25 : 0.5);
      } else { ctx.sfx.play('good'); partner.gesture('nod'); ctx.story.moodAdd(2); }
      if (flew) score -= 0.2;
      ctx.story.setTech('A2', score);
      ctx.story.addCare('A2', care, 'shoes');
      player.lookAt(null, 0); player.s.bow = 0;
    },
  },

  // ---------- A3 和室へ入る ----------
  A3: {
    setup(ctx) {
      const { player, partner, mother } = ctx.actors;
      baseRoom(ctx, { onCushion: false });
      ctx.place(player, -0.1, 0, 0.75, 0, 0);
      ctx.place(partner, 0.38, 0, 0.55, 0, 0);
      neatShoes(ctx);
      ctx.props.pshoeL.obj.visible = ctx.props.pshoeR.obj.visible = true;
      ctx.rig.followActor(player, [0.3, 1.65, -1.75], [0, 0.7, 1.8], { fov: 52 });
      ctx.rig.pos.set(player.pos.x + 0.3, 1.65, player.pos.z - 1.75);
      ctx.rig.look.set(player.pos.x, 0.7, player.pos.z + 1.8);
    },
    async run(ctx) {
      const { player, partner, father, mother } = ctx.actors;
      const H = ctx.house;
      father.lookAt(player); mother.lookAt(player);
      await ctx.talk('father', 'おお、いらっしゃい。どうぞ、入って。', 2.2);
      await ctx.talk('partner', '（敷居と、畳のふちは、踏まないでね）', 2.6);
      if (ctx.easy) return easyEnter(ctx);
      ctx.objective('部屋に入り、<em>自分の座布団の手前</em>まで進む<br><small>敷居と畳の縁はふまない・座布団もふまない</small>');
      const marker = ctx.marker(SEAT.playerFront.x, SEAT.playerFront.z);
      let heri = 0, thr = 0, cush = 0, firstHeri = true;
      // 美咲さんはあとから入る
      const pwalk = ctx.walkTo(partner, 0.42, SEAT.partnerFront.z, 0.7, 1.2);
      await walk(ctx, {
        speed: 0.8,
        walkable: (x, z) => {
          const hall = Math.abs(x) < 0.72 && z > 0.12 && z < 2.05;
          const room = x > ROOM.x0 + 0.18 && x < ROOM.x1 - 0.18 && z > 1.98 && z < ROOM.z1 - 0.2;
          const door = Math.abs(x) < 0.78 && z >= 1.9 && z <= 2.1;
          const table = Math.abs(x) < 0.92 && z > 3.15 && z < 4.37;
          const ppl = [father, mother, partner].some(a => Math.hypot(a.pos.x - x, a.pos.z - z) < 0.36);
          return (hall || room || door) && !table && !ppl;
        },
        onStep: (fp) => {
          if (Math.abs(fp.z - ROOM.z0) < 0.06 && Math.abs(fp.x) < 0.88) {
            thr++; ctx.sfx.play('creak'); father.gesture('tilt'); ctx.story.moodAdd(-3);
            if (thr === 1) { ctx.find('threshold'); ctx.aside('（ぎしっ）', 1.2); }
          } else if (H.heriRects.some(r => inRect(fp, r, 0.02))) {
            heri++; ctx.story.moodAdd(-0.8);
            if (firstHeri) { firstHeri = false; partner.gesture('lookdown', 0.8); ctx.aside('（あっ、ふちを……）', 1.4); }
            if (heri === 4) ctx.find('heri');
          }
          for (const k of ['player', 'partner', 'father', 'mother']) {
            const c = H.cushions[k];
            if (Math.abs(fp.x - c.x) < 0.3 && Math.abs(fp.z - c.z) < 0.32) { cush++; if (cush === 1) { ctx.find('cushionStep'); father.gesture('flinch'); ctx.say('mother', 'あ……。', 1); ctx.story.moodAdd(-5); } }
          }
        },
        done: (A) => near(A.pos, SEAT.playerFront, 0.2),
      });
      marker.remove();
      player.turnTo(SEAT.father.x, SEAT.father.z);
      await pwalk;
      const score = clamp01(1 - 0.1 * heri - 0.3 * thr - 0.35 * Math.min(1, cush));
      ctx.story.setTech('A3', score);
      if (score > 0.95) { ctx.sfx.play('good'); ctx.story.moodAdd(2); }
    },
  },

  // ---------- A4 座って名乗る ----------
  A4: {
    setup(ctx) {
      const { player, partner } = ctx.actors;
      baseRoom(ctx, { onCushion: false });
      ctx.place(player, SEAT.playerFront.x, 0, SEAT.playerFront.z, 0, 0);
      ctx.place(partner, SEAT.partnerFront.x, 0, SEAT.partnerFront.z, 0, 1);
      ctx.shot([0.04, 1.62, 5.4], [-0.05, 0.42, 2.5], { fov: 46, cut: true });
    },
    async run(ctx) {
      const { player, partner, father, mother } = ctx.actors;
      father.lookAt(player); mother.lookAt(player); partner.lookAt(father);
      ctx.objective('その場で<em>正座</em>する');
      await posture(ctx, { to: 1 });
      await ctx.talk('partner', '（お父さん、ちょっと堅い人だから、ていねいめにね）', 2.8);
      // お父さんが話している間に名乗ると、かぶる
      ctx.objective('お父さんの話を聞いて、<em>名乗る</em>');
      let fatherDone = false, stopped = false;
      const talking = (async () => {
        await ctx.talk('father', 'まあまあ、そんなに、かしこまらないで。', 2.4);
        if (stopped) return;
        await ctx.wait(0.5);
        if (stopped) return;
        await ctx.talk('father', '美咲の父です。よく来てくれたね。', 2.4);
        fatherDone = true;
      })();
      const c = await choose(ctx, {
        list: [{ text: '「はじめまして。高橋悠真と申します。本日はお時間をいただき、ありがとうございます」' }, { text: '「はじめまして、悠真です！ 今日はよろしくお願いします！」' }, { text: '（緊張で、言葉が出ない）' }],
        timer: 14,
      });
      const interrupted = !fatherDone && c.index > 0;
      if (interrupted) { stopped = true; ctx.cutTalk(); ctx.find('interruptHello'); ctx.story.moodAdd(-3); father.gesture('flinch'); }
      else await talking.catch(() => {});
      let speech = 0.2, care = 0;
      if (c.index === 1) { await ctx.talk('player', 'はじめまして。高橋悠真と申します。本日はお時間をいただき、ありがとうございます。', 3.4); father.gesture('nod'); speech = 1; ctx.story.moodAdd(3); }
      else if (c.index === 2) { await ctx.talk('player', 'はじめまして、悠真です！ 今日はよろしくお願いします！', 2.6); father.gesture('tilt'); await ctx.talk('father', '……ああ。元気だね。', 1.8); speech = 0.6; ctx.story.moodAdd(-1); }
      else { await ctx.wait(1.6); ctx.aside('（……）', 1.2); await ctx.talk('partner', 'お父さん、こちら、高橋悠真さん。', 2.2); speech = 0.2; care = -1; ctx.story.feel('partner', '助け舟'); }
      if (interrupted) { await ctx.talk('father', '……ああ、うん。どうも。', 1.6); speech -= 0.3; }
      ctx.objective('<em>座礼</em>（すわってお辞儀）をする');
      const r = await bow(ctx, { seated: true, zone: [25, 45], cap: '座礼の深さ', hold: 0.8, npcs: [{ actor: partner, mirror: true, depth: 30, hold: 1.0 }, { actor: father, mirror: true, depth: 14, hold: 0.8 }, { actor: mother, mirror: true, depth: 22, hold: 0.9 }],
        onStuck: () => { ctx.find('stuck'); ctx.say('mother', 'どうぞ、楽にしてね。', 2); } });
      if (r.score > 0.75) ctx.sfx.play('good');
      ctx.story.setTech('A4', 0.5 * r.score + 0.5 * clamp01(speech));
      ctx.story.addCare('A4', care, 'intro');
    },
  },

  // ---------- A5 座布団と手土産 ----------
  A5: {
    setup(ctx) {
      const { player, partner } = ctx.actors;
      baseRoom(ctx, { onCushion: true });
      ctx.place(player, SEAT.playerFront.x, 0, SEAT.playerFront.z, 0, 1);
      const { gift, bag } = ctx.props;
      bag.obj.visible = true; bag.pos.set(-0.9, 0, 3.02); bag.obj.rotation.set(0, 0.2, 0);
      gift.obj.visible = true; gift.free = false; gift.done = false; gift.pos.set(-0.9, 0.2, 3.02); gift.obj.rotation.set(PI / 2.6, PI, 0);
      ctx.shot([-1.5, 1.45, 2.2], [-0.2, 0.36, 3.6], { fov: 52, cut: true });
    },
    async run(ctx) {
      const { player, partner, father, mother } = ctx.actors;
      const { gift, bag } = ctx.props;
      father.lookAt(player); mother.lookAt(player);
      await ctx.talk('father', 'さあ、座布団をあててください。', 2.0);
      ctx.objective(ctx.easy ? '<em>ひざで進んで</em>座布団に座る<br><small>押している間 進む。座布団の上ではなす</small>' : '<em>膝で進んで</em>座布団に座る<br><small>立って座布団をふまない</small>');
      // 膝で進む（W）／立って歩く（F）
      let cushStep = false, stood = false, hops = 0, easyCush = null;
      if (ctx.easy) easyCush = await easyCushion(ctx);
      else await new Promise((resolve, reject) => {
        let hop = 0, from = 0;
        ctx.hud.keys([['W', '膝で前へ進む'], ['f', '立ち上がる']]);
        const stop = ctx.every(dt => {
          if (hop > 0) {
            hop -= dt; const u = 1 - Math.max(0, hop) / 0.32;
            player.pos.z = from + 0.11 * u; player.s.bow = Math.sin(u * PI) * 12;
            if (player.pos.z > 2.62) player.pos.y = CUSHION_Y * clamp01((player.pos.z - 2.62) / 0.2);
            if (hop <= 0 && player.pos.z >= SEAT.player.z - 0.03) { player.pos.z = SEAT.player.z; player.pos.y = CUSHION_Y; stop(); resolve(); }
            return;
          }
          if (ctx.input.hit('w') || ctx.input.hit('arrowup')) { hop = 0.32; from = player.pos.z; hops++; ctx.sfx.play('rustle', 0.4); }
          if (ctx.input.key('f') && !stood) { stood = true; stop(); resolve('stand'); }
        });
        ctx.onAbort(reject);
      }).then(async (how) => {
        if (how !== 'stand') return;
        await posture(ctx, { to: 0 });
        ctx.objective('座布団の上で<em>正座</em>する');
        await walk(ctx, {
          speed: 0.6, extraKeys: [['f', '座布団の上で座る']],
          walkable: (x, z) => x > -1.5 && x < 0.1 && z > 2.1 && z < 3.15,
          onStep: (fp) => { if (Math.abs(fp.x - SEAT.player.x) < 0.3 && Math.abs(fp.z - SEAT.player.z) < 0.32 && !cushStep) { cushStep = true; ctx.find('cushionStep'); father.gesture('flinch'); ctx.say('mother', 'あ……。', 1); ctx.story.moodAdd(-5); } },
          done: (A) => ctx.input.key('f') && near(A.pos, SEAT.player, 0.25),
        });
        ctx.actors.player.pos.set(SEAT.player.x, CUSHION_Y, SEAT.player.z); player.yaw = 0;
        await posture(ctx, { to: 1 });
      });
      player.s.bow = 0;
      const cushionScore = easyCush != null ? easyCush : stood ? (cushStep ? 0.2 : 0.6) : 1;
      // ---- 手土産 ----
      await ctx.talk('partner', '（手土産、のしの文字がお父さんから読める向きでね）', 2.8);
      ctx.objective('手土産を紙袋から出し、<em>文字が相手に読める向き</em>で両手で渡す<br><small>お父さんの手のところで離す</small>');
      let reach = 0, hoverT = 0, hovered = false, line = 0, dropped = 0, placed = false, handed = false, giveUp = false, dropPending = false;
      const lines = [{ text: '「心ばかりですが、よろしければ皆さんで」' }, { text: '「お口に合うとうれしいです」' }, { text: '（黙って差し出す）' }];
      let lineShown = false;
      const fatherReach = ctx.every(dt => {
        const want = gift.held && gift.pos.z > 3.35 ? 1 : (handed ? 0 : 0);
        reach += (want - reach) * Math.min(1, dt * 4);
        father.s.lean = 0.4 * reach;
        if (reach > 0.05) {
          const L = HANDOFF.clone().add(new THREE.Vector3(0.11, -0.02, 0.06)), R = HANDOFF.clone().add(new THREE.Vector3(-0.11, -0.02, 0.06));
          father.reach('L', L, reach); father.reach('R', R, reach);
        } else { father.reach('L', null); father.reach('R', null); }
        player.s.lean = gift.held ? clamp01((gift.pos.z - 3.1) * 0.8) * 0.5 : player.s.lean * 0.9;
      });
      if (ctx.easy) ({ handed, placed, dropped, line, hovered } = await easyGift(ctx, lines));
      while (!handed && !giveUp) {
        const r = await hand(ctx, {
          props: [gift], planeY: (p, st) => (st.t < 0.5 ? 0.3 + st.t * 0.26 : 0.43), bounds: { x0: -1.0, x1: 0.3, z0: 2.5, z1: 4.05 },
          rotate: true, snapYaw: 0, twoHands: true, tremor: 0.007, stiff: 70, damp: 0.8,
          keys: [['mouse', '押している間 持つ（はなすと置く）'], ['qe', '向きを変える'], ['num', 'ひとこと添える']],
          onGrab: (p) => { p.obj.rotation.x = 0; p.obj.rotation.z = 0; if (!lineShown) { lineShown = true; ctx.hud.choices(lines); ctx.say('mother', 'まあ、そんなに気をつかわなくていいのに。', 2.2); } },
          onRelease: (p, st) => {
            const hx = Math.hypot(p.pos.x - HANDOFF.x, p.pos.z - HANDOFF.z);
            if (reach > 0.6 && hx < 0.17 && Math.abs(p.pos.y - HANDOFF.y) < 0.12) { handed = true; return 'done'; }
            const onTable = Math.abs(p.pos.x) < 0.73 && p.pos.z > 3.33 && p.pos.z < 4.19;
            if (onTable && p.pos.y - TABLE_Y < 0.16) { p.pos.y = TABLE_Y; placed = true; ctx.sfx.play('set'); return 'done'; }
            return 'drop';
          },
          onLand: (p) => { dropped++; dropPending = true; ctx.find('giftDrop'); father.gesture('flinch'); mother.gesture('flinch'); ctx.story.moodAdd(-4); },
          onFrame: (dt, st) => {
            const ch = ctx.input.choice();
            if (lineShown && !line && ch && ch <= 3) {
              line = ch; ctx.hud.choices(null);
              ctx.say('player', ch === 3 ? '（……すっ）' : lines[ch - 1].text.replace(/[「」]/g, ''), 2.4);
            }
            if (reach > 0.8 && gift.held) { hoverT += dt; if (hoverT > 4.5 && !hovered) { hovered = true; ctx.find('handsHover'); ctx.say('father', '……あの、いただいても？', 2); ctx.story.moodAdd(-3); } }
            if (dropPending && !gift.free) { dropPending = false; return { dropped: true }; }
            return null;
          },
        });
        if (r && r.dropped) {
          ctx.objective('手土産を落としてしまった。どうする？');
          const c = await choose(ctx, { list: [{ text: '「失礼しました」と、すぐに拾う' }, { text: '（お父さんが拾ってくれるのを待つ）' }, { text: 'まず、頭を下げて謝る' }], timer: 7 });
          if (c.index === 2 || c.index === 0) {
            father.reach('R', gift.pos.clone().add(new THREE.Vector3(0, 0.05, 0)), 1);
            await ctx.talk('father', 'ああ、いいよいいよ。', 1.6);
            father.reach('R', null);
            ctx.story.addCare('A5', -1, 'waited'); handed = true; placed = true; gift.pos.set(-0.85, 0, 4.45); gift.obj.rotation.set(0, PI / 2, 0);
          } else {
            if (c.index === 3) {
              await ctx.talk('player', '大変、失礼しました。', 1.6);
              const b = await bow(ctx, { seated: true, zone: [20, 50], cap: 'おわびの深さ', hold: 0.6, npcs: [] });
              ctx.story.addCare('A5', b.score > 0.6 ? 1.5 : 0.5, 'apology');
            } else { await ctx.talk('player', '失礼しました。', 1.2); ctx.story.addCare('A5', 1, 'pickup'); }
            gift.free = false; gift.pos.set(-0.5, 0.06, 3.0); gift.obj.rotation.set(0, PI, 0);
            ctx.objective('もう一度、<em>文字が相手に読める向き</em>で渡す');
          }
        }
      }
      fatherReach();
      ctx.hud.choices(null);
      father.reach('L', null); father.reach('R', null); father.s.lean = 0; player.s.lean = 0;
      // お父さんが受け取る
      const front = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), gift.obj.rotation.y);
      const orientOK = front.z > Math.cos(THREE.MathUtils.degToRad(38));
      if (handed && !placed) { ctx.sfx.play('rustle', 0.5); }
      await ctx.wait(0.4);
      if (!orientOK) {
        ctx.find('giftUpside'); father.gesture('lookdown', 1.2);
        await ctx.tween(0.9, u => { gift.obj.rotation.y = THREE.MathUtils.lerp(gift.obj.rotation.y, 0, u); });
        ctx.aside('（お父さんが、箱をくるりと回した）', 2.2); ctx.story.moodAdd(-2);
      }
      if (!line) { ctx.find('silentGift'); }
      await ctx.talk('father', 'これは、ご丁寧に。ありがとう。', 2.2);
      father.gesture('nod');
      await ctx.tween(0.6, u => { gift.pos.lerp(new THREE.Vector3(-0.88, 0, 4.42), u); gift.obj.rotation.y *= (1 - u); });
      gift.pos.set(-0.88, 0, 4.42); gift.done = true;
      bag.obj.visible = false;
      let gs = (handed && !placed ? 1 : 0.7) * (orientOK ? 1 : 0.6) - 0.25 * dropped - (hovered ? 0.1 : 0) - (line ? 0 : 0.1) - (line === 3 ? 0.05 : 0);
      if (gs > 0.9) { ctx.sfx.play('good'); ctx.story.moodAdd(3); }
      ctx.story.setTech('A5', 0.3 * cushionScore + 0.7 * clamp01(gs));
    },
  },

  // ---------- A6 お茶と会話 ----------
  A6: {
    setup(ctx) {
      const { player } = ctx.actors;
      resetChaos(ctx);
      baseRoom(ctx, { onCushion: true });
      ctx.place(player, SEAT.player.x, CUSHION_Y, SEAT.player.z, 0, 1);
      const { gift } = ctx.props; gift.obj.visible = true; gift.free = false; gift.pos.set(-0.88, 0, 4.42); gift.obj.rotation.set(0, 0, 0);
      ctx.props.bag.obj.visible = false;
      cupsReset(ctx); ctx.hideCups(false);
      ctx.clearStains();
      ctx.shot([-1.05, 1.35, 2.15], [-0.15, 0.62, 3.9], { fov: 44, cut: true });
    },
    async run(ctx) {
      // かんたん操作：気配りがいくつも同時に来る「お茶の間ラッシュ」
      if (ctx.easy) { await rushTea(ctx); return; }
      const { player, partner, father, mother } = ctx.actors;
      const cup = ctx.props.cup_player, saucer = ctx.props.saucer_player;
      father.lookAt(player); mother.lookAt(player);
      await ctx.talk('mother', 'どうぞ、お茶をめしあがって。', 2.0);
      await ctx.talk('father', '冷めないうちに、どうぞ。', 1.8);
      ctx.objective('お茶を<em>ひと口</em>いただき、茶托に戻す<br><small>' + (document.body.classList.contains('touch') ? '湯のみを指で押さえて上へ動かすと口元へ・「傾ける」で飲む' : 'マウスを上へ動かすと口元へ・ホイールで傾ける') + '</small>');
      const S = { drank: 0, spilled: 0, placed: true, hot: false, choke: false, q: 0, qT: 0, qAns: 0, qState: 'none', mouthT: 0, t: 0, stain: null, dropped: false, ansWhile: '' };
      const mouth = () => player.headPos().addScaledVector(player.forward(), 0.085).add(new THREE.Vector3(0, -0.075, 0));
      const qList = [{ text: '「〇〇という会社で、営業をしています」' }, { text: '（いったん湯のみを置いてから答える）' }];
      let lastTilt = 0;
      const spillAt = (amt) => {
        S.spilled += amt; ctx.sfx.play('spill', Math.min(1, amt * 6));
        const onTable = Math.abs(cup.pos.x) < 0.75 && cup.pos.z > 3.31 && cup.pos.z < 4.21;
        if (!S.stain) S.stain = ctx.addStain(cup.pos.x, onTable ? TABLE_Y + 0.002 : 0.003, Math.max(cup.pos.z, onTable ? 3.32 : 3.2));
        S.stain.scale.setScalar(Math.min(0.16, 0.02 + S.spilled * 0.5));
      };
      const r = ctx.easy ? await easyTea(ctx, S, { cup, saucer, mouth, spillAt, qList }) : await hand(ctx, {
        props: [cup], planeY: TABLE_Y + 0.05, tilt: true, rotate: false, tremor: 0.0035, stiff: 90, damp: 0.85, handOffset: new THREE.Vector3(0, 0.04, -0.03),
        keys: [['mouse', '押している間 持つ（はなすと置く）'], ['マウス上下', '口元へ'], ['wheel', '傾ける（Z / X でも）']],
        goal: (g, p, st) => {
          const m = mouth();
          const ny = THREE.MathUtils.clamp((ctx.input.mouse.ny + 0.55) / 1.1, 0, 1);
          const y0 = TABLE_Y + 0.045;
          const y = y0 + (m.y - 0.045 - y0) * ny;
          const f = clamp01((y - y0) / (m.y - 0.045 - y0));
          g.set(THREE.MathUtils.lerp(saucer.pos.x, m.x, f), y, THREE.MathUtils.lerp(saucer.pos.z - 0.02, m.z, f));
        },
        onGrab: () => { S.placed = false; ctx.sfx.play('clink', 0.4); },
        onRelease: (p, st) => {
          const dxz = Math.hypot(p.pos.x - saucer.pos.x, p.pos.z - saucer.pos.z);
          st.tilt = 0; p.obj.quaternion.identity();
          if (dxz < 0.09 && p.pos.y < TABLE_Y + 0.12) { p.pos.set(saucer.pos.x, TABLE_Y + 0.012, saucer.pos.z); S.placed = true; ctx.sfx.play('clink'); return 'keep'; }
          const onTable = Math.abs(p.pos.x) < 0.73 && p.pos.z > 3.33 && p.pos.z < 4.19;
          if (onTable && p.pos.y < TABLE_Y + 0.14) { p.pos.y = TABLE_Y; S.placed = true; ctx.sfx.play('set'); return 'keep'; }
          S.dropped = true; return 'drop';
        },
        onLand: () => { ctx.find('cupDrop'); spillAt(cup.level); cup.level = 0; setTea(cup); father.gesture('flinch'); mother.gesture('flinch'); ctx.story.moodAdd(-8); },
        onFrame: (dt, st) => {
          S.t += dt;
          // 傾き → お茶の動き
          if (cup.held) {
            const ax = player.side();
            cup.obj.quaternion.setFromAxisAngle(ax, -st.tilt);
            const m = mouth();
            const atMouth = cup.pos.distanceTo(m) < 0.075;
            const rim = 0.32 + (1 - cup.level) * 1.05;
            const dTilt = Math.abs(st.tilt - lastTilt) / Math.max(dt, 1e-3); lastTilt = st.tilt;
            if (st.tilt > rim && cup.level > 0) {
              const flow = Math.min(cup.level, (st.tilt - rim) * 0.55 * dt * (ctx.assist ? 0.6 : 1));
              cup.level -= flow;
              if (atMouth && st.tilt < 1.45) {
                S.drank += flow;
                if (flow / dt > 0.3 && !S.hot) { S.hot = true; ctx.find('hot'); player.gesture('flinch', 0.7); ctx.say('player', 'あつっ……！', 1.2); spillAt(0.03); }
              } else spillAt(flow);
              setTea(cup);
            }
            if (dTilt > 3.2 && cup.level > 0.5) { cup.level -= 0.02; spillAt(0.02); setTea(cup); }
            if (atMouth) S.mouthT += dt;
          }
          // 飲んでいる途中で、質問が飛んでくる
          if (S.qState === 'none' && (S.mouthT > 0.7 || S.t > 14)) {
            S.qState = 'ask'; S.qT = 0;
            ctx.say('father', 'で、高橋くんは、お仕事は何を？', 2.6);
            ctx.hud.choices(qList, { timer: 8 });
          }
          if (S.qState === 'ask') {
            S.qT += dt; ctx.hud.choiceTimer(1 - S.qT / 8);
            const ch = ctx.input.choice();
            if (ch === 2 && !S.placed) { ctx.objective('<em>湯のみを茶托に戻して</em>から答える'); }
            if ((ch === 1) || (ch === 2 && S.placed) || (S.placed && S.wantPlace)) {
              ctx.hud.choices(null); S.qState = 'answered';
              const m = mouth();
              if (cup.held && cup.pos.distanceTo(m) < 0.09 && st.tilt > 0.25) {
                S.choke = true; ctx.find('choke'); ctx.sfx.play('spill'); spillAt(0.12); cup.level = Math.max(0, cup.level - 0.12); setTea(cup);
                player.gesture('flinch', 1); ctx.say('player', 'ぶほっ……！ げほっ……し、失礼しました……営業を、しています。', 3.2); ctx.story.moodAdd(-6);
              } else {
                ctx.say('player', '〇〇という会社で、営業をしています。', 2.6);
                S.qAns = S.placed ? 1 : 0.7; father.gesture('nod'); ctx.story.moodAdd(2);
                if (cup.held) st.tilt += 0.2;
              }
            } else if (ch === 2 && !S.placed) S.wantPlace = true;
            if (S.qT > 8 && S.qState === 'ask') {
              ctx.hud.choices(null); S.qState = 'answered'; S.qAns = 0.2; ctx.find('partnerAnswer');
              ctx.say('partner', '……あ、悠真さんは、営業のお仕事をしてて。', 2.6); ctx.story.feel('partner', '助け舟'); ctx.story.addCare('A6', -1, 'silent');
            }
          }
          if (S.spilled > 0.06 && !S.recovering) return { spill: true };
          if (S.dropped && !cup.free) return { spill: true };
          if (S.placed && S.drank >= 0.1 && S.qState === 'answered') return { ok: true };
          return null;
        },
      });
      ctx.hud.choices(null);
      // こぼした → 立て直し
      if (r && r.spill) {
        if (!cup.free) { cup.obj.quaternion.identity(); if (!S.placed && !S.dropped) { cup.pos.set(saucer.pos.x, TABLE_Y + 0.012, saucer.pos.z); S.placed = true; } }
        if (S.dropped) { cup.free = false; cup.obj.rotation.set(PI / 2, 0, 0); }
        father.lookAt(S.stain ? S.stain : player);
        ctx.objective('お茶をこぼしてしまった。どうする？');
        const c = await choose(ctx, { list: [{ text: '「すみません！」と、ハンカチで拭く' }, { text: '「すみません」と謝る' }, { text: '（見なかったことにする）' }], timer: 8 });
        father.lookAt(player);
        if (c.index === 1) {
          await ctx.talk('player', 'す、すみません！', 1.2);
          await (ctx.easy ? easyWipe(ctx, S) : wipe(ctx, S));
          ctx.story.addCare('A6', 1.5, 'wiped');
        } else if (c.index === 2) {
          await ctx.talk('player', 'すみません……。', 1.4);
          await ctx.talk('mother', 'いいのよ、いいのよ。', 1.4);
          mother.reach('R', S.stain ? S.stain.position.clone().add(new THREE.Vector3(0, 0.03, 0)) : HANDOFF, 1);
          await ctx.tween(1.6, u => { if (S.stain) S.stain.scale.setScalar(S.stain.scale.x * (1 - u * 0.2)); });
          mother.reach('R', null); ctx.removeStain(S.stain); S.stain = null;
          ctx.story.addCare('A6', 0.5, 'apologized'); ctx.story.moodAdd(-1);
        } else {
          ctx.find('ignoreSpill'); father.gesture('lookdown'); await ctx.wait(1.4); mother.gesture('sigh');
          ctx.aside('（全員が、しみを見ている）', 2.2); await ctx.wait(1.8);
          ctx.story.addCare('A6', -2, 'ignored'); ctx.story.moodAdd(-6);
          ctx.removeStain(S.stain); S.stain = null;
        }
        if (S.qState !== 'answered') {
          await ctx.talk('father', '……それで、お仕事は？', 1.8);
          const c2 = await choose(ctx, { list: [qList[0]], timer: 8 });
          if (c2.index === 1) { await ctx.talk('player', '〇〇という会社で、営業をしています。', 2.4); S.qAns = 0.8; father.gesture('nod'); }
          else { ctx.find('partnerAnswer'); await ctx.talk('partner', '悠真さんは、営業のお仕事をしてて。', 2.4); S.qAns = 0.2; }
        }
      }
      let score = 1 - (S.spilled > 0.06 ? 0.35 : 0) - (S.choke ? 0.3 : 0) - (S.hot ? 0.15 : 0) - (S.dropped ? 0.4 : 0) - (S.drank < 0.1 ? 0.15 : 0);
      score = 0.75 * clamp01(score) + 0.25 * S.qAns;
      if (score > 0.85) ctx.sfx.play('good');
      ctx.story.setTech('A6', score);
    },
  },

  // ---------- A7 結婚の意思を伝える ----------
  A7: {
    setup(ctx) { STEPS.A6.setup(ctx); ctx.shot([-1.15, 1.25, 2.35], [-0.2, 0.78, 4.5], { fov: 38, cut: true }); },
    async run(ctx) {
      const { player, partner, father, mother } = ctx.actors;
      father.lookAt(ctx.props.cup_father.obj, 0.6); mother.lookAt(father); partner.lookAt(father);
      ctx.objective('お父さんの話が<em>終わってから</em>、結婚の意思を伝える');
      const list = [{ text: '「美咲さんと、結婚させていただきたいと思っています」' }, { text: '「美咲さんと結婚します。どうか、認めてください」' }, { text: '「娘さんを、ください！」' }];
      // お父さんの話（間がある）
      const script = [[0.6, '……', 1.6], [2.6, '今日は、わざわざ遠いところを、ありがとう。', 2.6], [7.0, '……まあ、なんだ。', 1.6], [10.4, '美咲から、話があるとは聞いてるんだけどね。', 2.8]];
      const OPEN = 13.6;
      let tickT = 0, helped = false, si = 0, speaking = false, speakEnd = 0;
      if (ctx.easy) ctx.objective('お父さんの話が<em>終わってから</em>、言葉を押す<br><small>ゲージの金色が「話の切れ目」。早いと食い気味、遅いと沈黙</small>');
      const c = await choose(ctx, {
        list, extraKeys: [['', '待つ＝何も押さない']],
        onFrame: (dt, t) => {
          if (ctx.easy) ctx.hud.gauge(true, { value: t / 24, good: [OPEN / 24, (OPEN + 4.5) / 24], best: [(OPEN + 0.4) / 24, (OPEN + 2.6) / 24], danger: [(OPEN + 8.5) / 24, 1], cap: '話の切れ目' });
          while (si < script.length && t >= script[si][0]) { const [, txt, d] = script[si]; ctx.say('father', txt, d); speaking = true; speakEnd = script[si][0] + d; si++; }
          if (speaking && t >= speakEnd) speaking = false;
          if (t > 12.6 && !father._looked) { father._looked = true; father.lookAt(player); }
          if (t > OPEN) {
            const w = t - OPEN;
            tickT -= dt; if (tickT <= 0) { ctx.sfx.play('tick', 0.4 + Math.min(1.6, w * 0.25)); tickT = 1; }
            if (w > 4.5) ctx.rig.goalFov = Math.max(24, 34 - (w - 4.5) * 1.4);
            if (w > 8.5 && !helped) { helped = true; ctx.say('mother', '……ほら、聞いてるわよ。ねえ、お父さん。', 2.6); ctx.find('eternal'); ctx.story.addCare('A7', -1, 'silence'); ctx.story.moodAdd(-5); }
          }
          return false;
        },
      });
      father._looked = false; ctx.hud.gauge(false);
      const t = c.t;
      let timing = 1, interrupted = false;
      if (t < OPEN) {
        interrupted = true;
        const inSentence = script.some(([s, , d]) => t >= s && t <= s + d);
        ctx.cutTalk();
        if (inSentence) { ctx.find('interrupt'); timing = 0.3; father.gesture('flinch'); ctx.story.moodAdd(-5); }
        else { timing = 0.6; ctx.story.moodAdd(-2); }
      } else {
        const w = t - OPEN;
        timing = w < 4.5 ? 1 : Math.max(0.3, 1 - (w - 4.5) / 8);
      }
      if (ctx.easy && !(interrupted && timing < 0.5)) judge(ctx, timing > 0.95 && t - OPEN < 2.6 ? 'best' : timing > 0.8 ? 'good' : 'bad');
      ctx.rig.goalFov = 34;
      if (interrupted) { await ctx.talk('father', '……ん？ ああ、いや……聞こう。', 2.0); }
      const said = list[c.index - 1].text.replace(/[「」]/g, '');
      father.lookAt(player);
      await ctx.talk('player', said, 2.8);
      ctx.objective('二人で、<em>深く頭を下げる</em>');
      const b = await bow(ctx, { seated: true, zone: [35, 58], cap: 'お辞儀の深さ', hold: 1.0, timeout: 7,
        npcs: [{ actor: partner, at: 0.4, depth: 45, hold: 1.8 }],
        onStuck: () => { ctx.find('stuck'); ctx.say('mother', 'もう、顔をあげてちょうだい。', 2.0); } });
      ctx.sfx.play('tick', 0.6); await ctx.wait(1.0); ctx.sfx.play('tick', 0.7); await ctx.wait(1.0);
      if (c.index === 3) { ctx.find('showa'); await ctx.talk('father', '……ははは。娘は、ものじゃないんだけどなあ。', 2.6); await ctx.wait(0.4); }
      else await ctx.talk('father', '……そうか。', 1.4);
      await ctx.talk('father', '……こちらこそ、美咲を、よろしくお願いします。', 2.8);
      // お父さん・お母さんのお辞儀
      await ctx.tween(1.6, u => { const v = Math.sin(u * PI); father.s.bow = 28 * v; mother.s.bow = 32 * v; });
      father.s.bow = mother.s.bow = 0;
      ctx.story.feel('father', '納得');
      ctx.story.moodAdd(10);
      ctx.sfx.play('chime', 0.5);
      ctx.story.setTech('A7', 0.6 * timing + 0.4 * b.score);
    },
  },

  // ---------- A8 立ち上がって見送り ----------
  A8: {
    setup(ctx) { STEPS.A6.setup(ctx); ctx.shot([1.42, 1.0, 2.2], [-0.12, 0.55, 3.5], { fov: 44, cut: true }); },
    async run(ctx) {
      const { player, partner, father, mother } = ctx.actors;
      father.lookAt(player); mother.lookAt(player);
      ctx.aside('――それから、一時間。足が、しびれている。', 2.6); await ctx.wait(2.8);
      await ctx.talk('father', '今日は、ありがとう。気をつけて帰りなさい。', 2.4);
      ctx.objective(ctx.easy ? '<em>くり返し押して</em>立ち上がる<br><small>しびれているので、手を止めると戻ってしまう</small>' : '<em>ゆっくり</em>立ち上がる<br><small>しびれているので、途中ではなすと戻ってしまう</small>');
      const numb = 0.85;
      let sank = false;
      await posture(ctx, { to: 0, numb, onSink: () => { sank = true; ctx.find('numbSink'); ctx.aside('（すとん）', 1); ctx.sfx.play('thud', 0.3); } });
      // しびれが引くまで待つ
      ctx.objective('しびれが引くまで、少し<em>待つ</em><br><small>' + (ctx.easy ? '押すと、よろける' : 'すぐ歩くと、よろける') + '</small>');
      ctx.hud.keys([['', 'その場で待つ']]);
      let n = 1, stag = false;
      await ctx.until(dt => {
        n -= dt / 2.6; player.s.wobble = n * 0.9;
        ctx.hud.meter(true, { value: n, zone: null, cap: 'しびれ' });
        const m = ctx.input.move;
        if ((m.x || m.y || (ctx.easy && ctx.input.actHit)) && n > 0.15 && !stag) { stag = true; ctx.find('numbStagger'); player.s.lean = -0.3; ctx.sfx.play('thud', 0.5); ctx.rig.shake = 0.02; ctx.story.moodAdd(-2); partner.gesture('flinch'); }
        if (stag) player.s.lean *= 0.95;
        return n <= 0;
      });
      ctx.hud.meter(false); player.s.wobble = 0; player.s.lean = 0;
      const standScore = (sank ? 0.6 : 1) * (stag ? 0.6 : 1);
      // 玄関へ
      await ctx.fade(0.6);
      for (const k of ['cup_player', 'cup_partner', 'cup_father', 'cup_mother']) ctx.props[k].obj.visible = true;
      ctx.place(player, -0.12, G, -0.62, 0, 0); ctx.place(partner, 0.3, G, -0.72, 0, 0);
      ctx.place(father, -0.22, 0, 0.5, PI, 0); ctx.place(mother, 0.3, 0, 0.62, PI, 0);
      for (const k of ['shoeL', 'shoeR', 'pshoeL', 'pshoeR']) ctx.props[k].obj.visible = false;
      ctx.shot([0.72, 1.62, -1.45], [-0.02, 0.92, 0.15], { fov: 50, cut: true });
      father.lookAt(player); mother.lookAt(player); partner.lookAt(mother);
      await ctx.fade(-0.6);
      await ctx.talk('mother', 'また、いつでもいらっしゃいね。', 2.2);
      ctx.objective('<em>お辞儀</em>をして、お別れのあいさつ');
      const b = await bow(ctx, { zone: [25, 45], cap: 'お辞儀の深さ', hold: 0.8, npcs: [{ actor: father, at: 0.8, depth: 25, hold: 1.0 }, { actor: mother, at: 0.9, depth: 32, hold: 1.2 }, { actor: partner, mirror: true, depth: 30, hold: 1.0 }] });
      // 出口へ（相手がまだ頭を下げているうちに背を向けない）
      ctx.objective('戸の外へ出る<br><small>ふり返って会釈すると、なおよい</small>');
      let turned = false, nod = false;
      // 家の中（見送る両親の肩ごし）から戸口を見る。W で外へ向かう。
      ctx.shot([0.62, 1.75, 0.95], [-0.1, 0.8, -1.2], { fov: 50, speed: 3 });
      if (ctx.easy) {
        ({ turned, nod } = await easyLeave(ctx));
      } else {
      const pw = ctx.walkTo(partner, 0.3, -1.4, 0.7, 0.5);
      await walk(ctx, {
        speed: 0.75, extraKeys: [['space', 'ふり返って会釈']],
        walkable: (x, z) => Math.abs(x) < 0.75 && z > -1.42 && z < -0.15,
        onStep: () => { if (!turned && (father.s.bow > 6 || mother.s.bow > 6)) { turned = true; ctx.find('backTurn'); ctx.story.moodAdd(-2); } },
        done: (A) => A.pos.z < -1.3,
      });
      await pw;
      player.turnTo(0, 0.5);
      ctx.hud.keys([['space', '会釈する']]);
      let tt = 0;
      await ctx.until(dt => {
        tt += dt;
        if (ctx.input.bow) { player.s.bow = Math.min(20, player.s.bow + 50 * dt); if (player.s.bow > 10 && !nod) { nod = true; mother.gesture('nod'); father.gesture('nod'); } }
        else player.s.bow = Math.max(0, player.s.bow - 60 * dt);
        return tt > 3.2 && player.s.bow < 1;
      });
      }
      if (nod) ctx.story.addCare('A8', 1, 'lastNod');
      ctx.sfx.play('door');
      ctx.story.setTech('A8', 0.4 * standScore + 0.6 * b.score - (turned ? 0.1 : 0));
      await ctx.fade(1.2);
    },
  },
};

// ハンカチで拭く（物の扱いの使い回し）。拭いている間に次の質問が来る。
async function wipe(ctx, S) {
  const { father, partner } = ctx.actors;
  const cloth = ctx.props.cloth;
  if (!S.stain) return;
  const st0 = S.stain.position.clone();
  cloth.obj.visible = true; cloth.free = false; cloth.done = false;
  cloth.pos.set(st0.x - 0.12, st0.y + 0.01, st0.z - 0.1);
  // しみが体に隠れないよう、横から見る
  ctx.shot([st0.x - 0.6, st0.y + 0.62, st0.z - 0.22], [st0.x + 0.05, st0.y, st0.z + 0.04], { fov: 46, speed: 3 });
  ctx.objective('ハンカチで、こぼれたお茶を<em>拭く</em><br><small>持ったまま、しみの上で動かす</small>');
  let q = 'none', qT = 0, ans = 0, last = null, tt = 0;
  const qList = [{ text: '「来年の秋ごろを考えています」' }, { text: '「これから、二人で相談して決めます」' }];
  await hand(ctx, {
    props: [cloth], planeY: st0.y + 0.012, bounds: { x0: st0.x - 0.4, x1: st0.x + 0.4, z0: st0.z - 0.35, z1: st0.z + 0.35 }, tremor: 0.002, stiff: 160,
    keys: [['mouse', '押している間 持って動かす']],
    onRelease: () => 'keep',
    onFrame: (dt) => {
      tt += dt;
      if (cloth.held) {
        if (last) {
          const mv = cloth.pos.distanceTo(last);
          if (cloth.pos.distanceTo(st0) < S.stain.scale.x + 0.08 && mv > 0.002) { S.stain.scale.multiplyScalar(1 - mv * 2.2); if (Math.random() < 0.2) ctx.sfx.play('wipe', 0.5); }
        }
        last = cloth.pos.clone();
      }
      if (q === 'none' && tt > 1.6) { q = 'ask'; ctx.say('father', '……それで、式は、いつごろを考えてるの？', 2.8); ctx.hud.choices(qList, { timer: 8 }); }
      if (q === 'ask') {
        qT += dt; ctx.hud.choiceTimer(1 - qT / 8);
        const ch = ctx.input.choice();
        if (ch === 1 || ch === 2) { q = 'done'; ans = 1; ctx.hud.choices(null); ctx.say('player', qList[ch - 1].text.replace(/[「」]/g, ''), 2.4); father.gesture('nod'); }
        if (qT > 8 && q === 'ask') { q = 'done'; ctx.hud.choices(null); ctx.find('partnerAnswer'); ctx.say('partner', '来年の秋ごろかな、って話してて。', 2.4); ctx.story.addCare('A6', -0.5, 'silent2'); }
      }
      if (S.stain.scale.x < 0.02 && q === 'done') return { ok: true };
      return null;
    },
  });
  ctx.hud.choices(null);
  ctx.removeStain(S.stain); S.stain = null;
  cloth.obj.visible = false;
  ctx.shot([-1.05, 1.35, 2.15], [-0.15, 0.62, 3.9], { fov: 44, speed: 2.5 });
}

// ================= かんたん操作（押すだけ）の各所 =================
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
async function fall(ctx, p, sec = 3) {
  let t = 0;
  await ctx.until(dt => { t += dt; if (p.step(dt)) ctx.sfx.play('thud', 0.7); return !p.free || t > sec; });
  p.free = false;
}

// A2 靴：手の中で回る靴を、つま先が戸のほうを向いた瞬間に置く（2足）
async function easyShoes(ctx) {
  const { player, partner, mother } = ctx.actors;
  const { shoeL, shoeR } = ctx.props;
  ctx.objective('靴の<em>つま先が戸のほう</em>を向いた瞬間に押す<br><small>2足とも。金色が真正面</small>');
  player.lookAt(V3(-0.2, G, -0.3));
  let score = 0, flew = false, backward = 0, bad = 0;
  const spots = [[shoeL, -0.42], [shoeR, -0.3]];
  for (let i = 0; i < 2; i++) {
    const [sh, x] = spots[i];
    const hold = V3(-0.22 + i * 0.04, G + 0.36, -0.28);
    const from = sh.pos.clone(), r0 = sh.obj.rotation.clone();
    ctx.sfx.play('rustle', 0.4);
    await ctx.tween(0.35, u => { sh.pos.lerpVectors(from, hold, u); sh.obj.rotation.set(r0.x * (1 - u), r0.y, r0.z * (1 - u)); });
    player.reach('R', hold.clone().add(V3(0.05, 0.05, 0)), 1); player.reach('L', hold.clone().add(V3(-0.05, 0.05, 0)), 1);
    let yaw = PI;
    const r = await tap(ctx, {
      cap: `${i + 1}足目　つま先を戸のほうへ`, key: '押す＝この向きで置く', speed: 0.36 + i * 0.12, phase: 0.2 + i * 0.5,
      good: [0.4, 0.6], best: [0.46, 0.54], timeout: 7, stamp: false,
      onValue: (v, t) => { yaw = PI + (v - 0.5) * 2 * PI; sh.obj.rotation.set(0, yaw, 0); sh.pos.copy(hold); sh.pos.y += Math.sin(t * 9) * 0.004; },
    });
    player.reach('R', null); player.reach('L', null);
    if (r.grade === 'none') {
      // 迷っているうちに、手から靴がすべる
      flew = true; bad++;
      ctx.find('shoeFly'); mother.gesture('flinch'); ctx.story.moodAdd(-3);
      sh.drop(V3(0.5, 1.6, -0.9)); await fall(ctx, sh);
      continue;
    }
    const err = Math.abs(Math.atan2(Math.sin(yaw - PI), Math.cos(yaw - PI)));
    if (err > 2.4) backward++;
    if (r.grade === 'bad') bad++;
    score += r.grade === 'best' ? 0.5 : r.grade === 'good' ? 0.42 : Math.max(0.05, 0.3 - err * 0.1);
    if (err > 2.4) judge(ctx, 'funny', '逆向き'); else judge(ctx, r.grade);
    const to = V3(x, G, -0.22), p0 = sh.pos.clone();
    await ctx.tween(0.3, u => { sh.pos.lerpVectors(p0, to, u); sh.pos.y += Math.sin(u * PI) * 0.05; });
    ctx.sfx.play('set', 0.6);
  }
  let care = 0;
  if (bad) {
    if (backward) ctx.find('shoeBackward');
    mother.lookAt(shoeL.obj);
    await ctx.wait(0.5);
    ctx.aside('（お母さんが、そっと靴を直してくれた……）', 2.4);
    ctx.find('motherShoes');
    neatShoes(ctx); ctx.sfx.play('set', 0.5);
    await ctx.wait(1.0);
    const c = await choose(ctx, { list: [{ text: '「あっ、すみません。ありがとうございます」' }, { text: '（気づかなかったふりをする）' }], timer: 6 });
    if (c.index === 1) { await ctx.talk('player', 'あっ、すみません。ありがとうございます。', 2.0); mother.gesture('nod'); await ctx.talk('mother', 'いいのよ。', 1.2); care = 1; }
    else { care = -1; ctx.story.moodAdd(-3); }
  } else { partner.gesture('nod'); ctx.story.moodAdd(2); }
  if (flew) score -= 0.2;
  ctx.story.setTech('A2', clamp01(score));
  ctx.story.addCare('A2', care, 'shoes');
  player.lookAt(null, 0); player.s.bow = 0;
}

// A3 和室へ：歩くのは自動。敷居と畳のふちの手前で押すと、またぐ
async function easyEnter(ctx) {
  const { player, partner, father, mother } = ctx.actors;
  const H = ctx.house;
  ctx.objective('<em>敷居</em>と<em>畳のふち</em>の手前で押して、またぐ<br><small>歩くのは自動。金色で押す</small>');
  const pts = [player.pos.clone().setY(0), V3(-0.1, 0, 2.3), V3(SEAT.playerFront.x, 0, SEAT.playerFront.z)];
  const seg = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const L = pts[i].distanceTo(pts[i - 1]); seg.push([pts[i - 1], pts[i], total, L]); total += L; }
  const at = s => { for (const [a, b, s0, L] of seg) if (s <= s0 + L) return a.clone().lerp(b, (s - s0) / L); return pts[pts.length - 1].clone(); };
  // 足元の危ないところ（敷居・畳のふち）を道の上で探す
  const haz = []; let inside = null;
  for (let s = 0.2; s < total; s += 0.01) {
    const p = at(s);
    const thr = Math.abs(p.z - ROOM.z0) < 0.03 && Math.abs(p.x) < 0.88;
    const heri = !thr && H.heriRects.some(r => inRect(p, r, 0.01));
    const kind = thr ? 'thr' : heri ? 'heri' : null;
    if (kind && !inside) inside = { kind, s0: s };
    if (!kind && inside) {
      const h = { kind: inside.kind, s: (inside.s0 + s) / 2 }, prev = haz[haz.length - 1];
      if (prev && h.s - prev.s < 0.28) { if (h.kind === 'thr') prev.kind = 'thr'; } else haz.push(h);
      inside = null;
    }
  }
  const pwalk = ctx.walkTo(partner, 0.42, SEAT.partnerFront.z, 0.7, 1.2);
  let s = 0, hop = 0, hopFrom = 0, hopTo = 0, stepAcc = 0, hi = 0, heri = 0, thr = 0, good = 0, tried = false;
  const speed = 0.62, WIN = 0.9;
  ctx.hud.keys([['act', '押す＝またぐ']]);
  await ctx.until(dt => {
    const h = haz[hi];
    if (hop > 0) {
      hop = Math.max(0, hop - dt / 0.42); const u = 1 - hop;
      s = hopFrom + (hopTo - hopFrom) * u; player.pos.y = Math.sin(u * PI) * 0.07;
      if (hop === 0) { player.pos.y = 0; ctx.sfx.play('step', 0.7); }
    } else {
      s = Math.min(total, s + speed * dt);
      stepAcc += speed * dt; if (stepAcc > 0.36) { stepAcc = 0; ctx.sfx.play('step', 0.5); }
    }
    const p = at(s), q = at(Math.min(total, s + 0.05));
    player.pos.x = p.x; player.pos.z = p.z;
    if (q.distanceTo(p) > 1e-4) player.yaw = Math.atan2(q.x - p.x, q.z - p.z);
    player.s.speed = s < total ? speed : 0;
    if (h) {
      const d = h.s - s, v = clamp01(1 - d / WIN);
      ctx.hud.gauge(d < WIN + 0.3, { value: v, good: [0.7, 0.94], best: [0.79, 0.9], cap: h.kind === 'thr' ? '敷居をまたぐ' : '畳のふちをまたぐ' });
      if (hop === 0 && !tried && d < WIN && ctx.input.actHit) {
        tried = true;
        const g = v >= 0.79 && v <= 0.9 ? 'best' : v >= 0.7 && v <= 0.94 ? 'good' : 'bad';
        if (g !== 'bad') { hop = 1; hopFrom = s; hopTo = h.s + 0.2; good++; judge(ctx, g); while (haz[hi] && haz[hi].s <= hopTo + 0.05) hi++; tried = false; ctx.sfx.play('whoosh', 0.5); }
        else judge(ctx, 'bad', '早い');
      }
      if (hop === 0 && s >= h.s) {
        // ふんでしまった
        if (h.kind === 'thr') { thr++; ctx.sfx.play('creak'); father.gesture('tilt'); ctx.story.moodAdd(-3); ctx.find('threshold'); }
        else { heri++; ctx.story.moodAdd(-0.8); if (heri === 1) { partner.gesture('lookdown', 0.8); ctx.aside('（あっ、ふちを……）', 1.4); } if (heri === 4) ctx.find('heri'); }
        hi++; tried = false;
      }
    } else ctx.hud.gauge(false);
    return s >= total && hop === 0;
  });
  ctx.hud.gauge(false); player.s.speed = 0;
  player.turnTo(SEAT.father.x, SEAT.father.z);
  await pwalk;
  const score = clamp01(1 - 0.15 * heri - 0.35 * thr);
  ctx.story.setTech('A3', score);
  if (score > 0.95) ctx.story.moodAdd(2);
}

// A5 座布団：押している間ひざで進む。座布団の上ではなす
async function easyCushion(ctx) {
  const { player, father, mother } = ctx.actors;
  const z0 = SEAT.playerFront.z, span = 0.63;
  const vSeat = (SEAT.player.z - z0) / span;
  let t = 0;
  const r = await charge(ctx, {
    cap: 'ひざで進む', key: '押している間 ひざで進む（座布団の上ではなす）', rate: 0.36,
    good: [vSeat - 0.08, vSeat + 0.08], best: [vSeat - 0.03, vSeat + 0.03], danger: [0.86, 1], keep: true, stamp: false,
    onValue: (v, held) => {
      t += held ? 0.016 : 0;
      player.pos.z = z0 + v * span;
      player.s.bow = held ? Math.abs(Math.sin(t * 9)) * 10 : player.s.bow * 0.9;
      player.pos.y = CUSHION_Y * clamp01(1 - Math.abs(player.pos.z - SEAT.player.z) / 0.3) * clamp01((player.pos.z - 2.6) / 0.08);
      if (held && Math.random() < 0.03) ctx.sfx.play('rustle', 0.3);
    },
  });
  player.s.bow = 0;
  let sc = 1;
  if (r.grade === 'over') {
    ctx.find('kneeSlide'); ctx.sfx.play('bonk'); ctx.rig.shake = 0.03; father.gesture('flinch'); mother.gesture('flinch'); player.gesture('flinch', 0.8); ctx.story.moodAdd(-3);
    await ctx.wait(0.6); sc = 0.4;
  } else {
    judge(ctx, r.grade);
    sc = r.grade === 'best' ? 1 : r.grade === 'good' ? 0.85 : 0.5;
  }
  // 座布団の真ん中へ寄せる
  const zA = player.pos.z;
  await ctx.tween(0.4, u => { player.pos.z = THREE.MathUtils.lerp(zA, SEAT.player.z, u); player.pos.y = CUSHION_Y * u + player.pos.y * (1 - u); });
  player.pos.set(SEAT.player.x, CUSHION_Y, SEAT.player.z); player.yaw = 0;
  return sc;
}

// A5 手土産：回る箱を、のしが相手に読める向きで止める → ひとこと → 押している間 差し出す
async function easyGift(ctx, lines) {
  const { player, father, mother } = ctx.actors;
  const { gift, bag } = ctx.props;
  const out = { handed: false, placed: false, dropped: 0, line: 0, hovered: false };
  ctx.objective('箱が回る。<em>のしの文字がお父さんに読める向き</em>で押す');
  const hold = V3(SEAT.player.x, 0.42, 3.1);
  const from = gift.pos.clone();
  ctx.sfx.play('rustle', 0.5);
  await ctx.tween(0.5, u => { gift.pos.lerpVectors(from, hold, u); gift.obj.rotation.set((PI / 2.6) * (1 - u), PI, 0); });
  const hands = () => { player.reach('R', gift.pos.clone().add(V3(-0.13, 0.02, 0)), 1); player.reach('L', gift.pos.clone().add(V3(0.13, 0.02, 0)), 1); };
  const stopHands = ctx.every(hands);
  const r = await tap(ctx, {
    cap: 'のしを、お父さんへ向ける', key: '押す＝この向きで止める', speed: 0.34, phase: 0.1,
    good: [0.42, 0.58], best: [0.47, 0.53], timeout: 9, stamp: false,
    onValue: (v, t) => { gift.obj.rotation.set(0, (v - 0.5) * 2 * PI, 0); gift.pos.copy(hold); gift.pos.y += Math.sin(t * 7) * 0.003; },
  });
  if (r.grade === 'none') gift.obj.rotation.y = PI;
  const err = Math.abs(Math.atan2(Math.sin(gift.obj.rotation.y), Math.cos(gift.obj.rotation.y)));
  if (err > 2.4) judge(ctx, 'funny', '逆さ'); else if (r.grade !== 'none') judge(ctx, r.grade);
  // ひとこと
  ctx.objective('<em>ひとこと</em>添える');
  ctx.say('mother', 'まあ、そんなに気をつかわなくていいのに。', 2.2);
  const c = await choose(ctx, { list: lines, timer: 7 });
  out.line = c.index;
  if (c.index) ctx.say('player', c.index === 3 ? '（……すっ）' : lines[c.index - 1].text.replace(/[「」]/g, ''), 2.4);
  // 差し出す
  ctx.objective('押している間 <em>差し出す</em>。お父さんの手のところで、はなす');
  const zA = hold.z, zHand = HANDOFF.z, zMax = 4.12;
  const vHand = (zHand - zA) / (zMax - zA);
  gift.held = true;
  const g = await charge(ctx, {
    cap: '差し出す', key: '押している間 差し出す（お父さんの手ではなす）', rate: 0.42, keep: true, stamp: false,
    good: [vHand - 0.09, vHand + 0.07], best: [vHand - 0.04, vHand + 0.03], danger: [0.92, 1],
    onValue: (v) => { gift.pos.set(hold.x, THREE.MathUtils.lerp(hold.y, HANDOFF.y, Math.min(1, v * 1.5)), zA + v * (zMax - zA)); player.s.lean = v * 0.5; },
  });
  gift.held = false;
  stopHands(); player.reach('R', null); player.reach('L', null); player.s.lean = 0;
  if (g.grade === 'over') {
    // 押しすぎて、お父さんの手の先へ。机に落ちる
    out.dropped = 1; ctx.find('giftDrop'); father.gesture('flinch'); mother.gesture('flinch'); ctx.story.moodAdd(-4);
    gift.drop(V3(0, 0.3, 0.5)); await fall(ctx, gift);
    gift.free = false; gift.pos.set(HANDOFF.x, TABLE_Y, Math.min(4.1, gift.pos.z)); gift.obj.rotation.x = 0; gift.obj.rotation.z = 0;
    await ctx.talk('player', '失礼しました……！', 1.4);
    out.placed = true; out.handed = true;
  } else {
    judge(ctx, g.grade, g.grade === 'bad' ? '届かない' : null);
    if (g.grade === 'bad') {
      // 手前すぎて、お父さんが身を乗り出して受け取る
      father.s.lean = 0.7; await ctx.wait(0.6); out.hovered = true; ctx.story.moodAdd(-2); father.s.lean = 0;
    }
    out.handed = true;
  }
  bag.obj.visible = false;
  return out;
}

// A6 お茶：押している間 口元へ運んで傾ける。熱くなる前にはなす。質問が来たら、すぐはなす
async function easyTea(ctx, S, { cup, saucer, mouth, spillAt, qList }) {
  const { player, partner, father } = ctx.actors;
  ctx.objective('押している間 <em>お茶を飲む</em>。金色でひと口、赤は熱い<br><small>話しかけられたら、すぐはなす</small>');
  const base = V3(saucer.pos.x, TABLE_Y + 0.012, saucer.pos.z);
  let v = 0, qShown = false, chokeT = 0, done = false, res = null, qChoices = false;
  ctx.hud.keys([['act', '押している間 飲む（はなすと置く）']]);
  const GOOD = [0.55, 0.84], BEST = [0.6, 0.76], DANGER = [0.88, 1];
  await ctx.until(dt => {
    S.t += dt;
    const held = ctx.input.act && !S.lock;
    v = held ? Math.min(1, v + (v >= GOOD[0] && v < GOOD[1] ? 0.13 : 0.32) * dt) : Math.max(0, v - 0.9 * dt);   // 金色の中はゆっくり（ひと口ぶん、いられる）
    if (S.lock && v === 0) S.lock = false;
    // 位置と傾き
    const m = mouth();
    const lift = clamp01(v / 0.38), tilt = clamp01((v - 0.38) / 0.62) * 1.55;
    cup.pos.lerpVectors(base, m.clone().add(V3(0, -0.04, 0)), lift * lift * (3 - 2 * lift));
    cup.obj.quaternion.setFromAxisAngle(player.side(), -tilt);
    S.placed = v < 0.02;
    if (v > 0.05) player.reach('R', cup.pos.clone().add(V3(0, 0.04, -0.03)), 1); else player.reach('R', null);
    // 飲む
    if (v >= GOOD[0] && v < DANGER[0]) { S.drank += dt * 0.09; cup.level = Math.max(0.2, cup.level - dt * 0.05); setTea(cup); }
    if (v >= DANGER[0] && !S.hot) { S.hot = true; ctx.find('hot'); player.gesture('flinch', 0.7); ctx.say('player', 'あつっ……！', 1.2); spillAt(0.03); S.lock = true; }
    if (v >= 1) { spillAt(0.08); S.lock = true; }
    ctx.hud.gauge(true, { value: v, good: GOOD, best: BEST, danger: DANGER, cap: S.drank >= 0.1 ? 'ひと口いただいた' : 'お茶をいただく' });
    // 質問
    if (!qShown && (v > 0.5 || S.t > 14)) { qShown = true; S.qState = 'ask'; S.qT = 0; ctx.say('father', 'で、高橋くんは、お仕事は何を？', 2.6); ctx.hud.stamp('！', 'funny'); ctx.sfx.play('whoosh', 0.6); }
    if (S.qState === 'ask') {
      S.qT += dt;
      if (v > 0.4) {
        chokeT += dt;
        if (chokeT > 1.2 && !S.choke) {
          S.choke = true; ctx.find('choke'); ctx.sfx.play('spill'); spillAt(0.12); cup.level = Math.max(0, cup.level - 0.12); setTea(cup);
          player.gesture('flinch', 1); ctx.say('player', 'ぶほっ……！ げほっ……し、失礼しました……営業を、しています。', 3.2); ctx.story.moodAdd(-6);
          S.qState = 'answered'; S.qAns = 0.3; S.lock = true;
        }
      } else if (!qChoices && v < 0.1) {
        qChoices = true;
        if (S.qT < 1.2) { ctx.find('quickDraw'); }
        ctx.hud.choices(qList.slice(0, 1).map(q => ({ text: q.text })), { timer: 7 });
        S.qAnsT = 0;
      }
      if (qChoices && S.qState === 'ask') {
        S.qAnsT += dt; ctx.hud.choiceTimer(1 - S.qAnsT / 7);
        if (ctx.input.choice() === 1) { ctx.hud.choices(null); S.qState = 'answered'; S.qAns = 1; ctx.say('player', '〇〇という会社で、営業をしています。', 2.6); father.gesture('nod'); ctx.story.moodAdd(2); judge(ctx, S.qT < 2.5 ? 'best' : 'good'); }
        else if (S.qAnsT > 7) { ctx.hud.choices(null); S.qState = 'answered'; S.qAns = 0.2; ctx.find('partnerAnswer'); ctx.say('partner', '……あ、悠真さんは、営業のお仕事をしてて。', 2.6); ctx.story.feel('partner', '助け舟'); ctx.story.addCare('A6', -1, 'silent'); }
      }
    }
    if (S.spilled > 0.06) { res = { spill: true }; return true; }
    if (S.placed && S.drank >= 0.1 && S.qState === 'answered') { res = { ok: true }; return true; }
    return false;
  });
  ctx.hud.gauge(false); ctx.hud.choices(null);
  cup.pos.copy(base); cup.obj.quaternion.identity(); player.reach('R', null); S.placed = true;
  if (res.ok && !S.hot && !S.choke) judge(ctx, 'best', 'ごちそうさま');
  return res;
}

// こぼしたお茶：くり返し押して拭く
async function easyWipe(ctx, S) {
  const { father, partner } = ctx.actors;
  const cloth = ctx.props.cloth;
  if (!S.stain) return;
  const st0 = S.stain.position.clone(), sc0 = S.stain.scale.x;
  cloth.obj.visible = true; cloth.free = false; cloth.pos.set(st0.x, st0.y + 0.012, st0.z);
  ctx.shot([st0.x - 0.6, st0.y + 0.62, st0.z - 0.22], [st0.x + 0.05, st0.y, st0.z + 0.04], { fov: 46, speed: 3 });
  ctx.objective('<em>くり返し押して</em>、こぼれたお茶を拭く');
  await mash(ctx, {
    cap: '拭く', key: 'くり返し押して 拭く', per: 0.1, decay: 0.05,
    onPress: () => { if (Math.random() < 0.5) ctx.sfx.play('wipe', 0.5); },
    onValue: (v, t) => { S.stain.scale.setScalar(Math.max(0.005, sc0 * (1 - v))); cloth.pos.set(st0.x + Math.sin(t * 14) * 0.05 * (v < 1 ? 1 : 0), st0.y + 0.012, st0.z + Math.cos(t * 11) * 0.03); ctx.actors.player.reach('R', cloth.pos.clone().add(V3(0, 0.03, 0)), 1); },
  });
  ctx.actors.player.reach('R', null);
  ctx.removeStain(S.stain); S.stain = null; cloth.obj.visible = false;
  judge(ctx, 'good', 'きれいに');
  ctx.shot([-1.05, 1.35, 2.15], [-0.15, 0.62, 3.9], { fov: 44, speed: 2.5 });
  await ctx.talk('father', '……それで、式は、いつごろを考えてるの？', 2.6);
  const c = await choose(ctx, { list: [{ text: '「来年の秋ごろを考えています」' }, { text: '「これから、二人で相談して決めます」' }], timer: 8 });
  if (c.index) { await ctx.talk('player', ['来年の秋ごろを考えています。', 'これから、二人で相談して決めます。'][c.index - 1], 2.2); father.gesture('nod'); }
  else { ctx.find('partnerAnswer'); await ctx.talk('partner', '来年の秋ごろかな、って話してて。', 2.4); ctx.story.addCare('A6', -0.5, 'silent2'); }
}

// A8 帰り：押すと戸の外へ歩く（相手がまだ頭を下げている間に押すと、背を向けてしまう）→ ふり返って押すと会釈
async function easyLeave(ctx) {
  const { player, partner, father, mother } = ctx.actors;
  let turned = false, nod = false;
  ctx.objective('二人が顔を上げてから、<em>押して</em>戸の外へ');
  ctx.hud.keys([['act', '押す＝戸の外へ歩く']]);
  await ctx.until(() => ctx.input.actHit);
  if (father.s.bow > 6 || mother.s.bow > 6) { turned = true; ctx.find('backTurn'); ctx.story.moodAdd(-2); }
  ctx.hud.keys([]);
  ctx.shot([0.62, 1.75, 0.95], [-0.1, 0.8, -1.2], { fov: 50, speed: 3 });
  const pw = ctx.walkTo(partner, 0.3, -1.4, 0.7, 0.5);
  await ctx.walkTo(player, -0.12, -1.32, 0.75);
  await pw;
  player.turnTo(0, 0.5);
  ctx.objective('ふり返って、<em>押す</em>と会釈');
  const r = await tap(ctx, {
    cap: '会釈', key: '押す＝会釈', timeout: 3.2, stamp: false,
    values: t => clamp01(t / 3.2), good: [0.05, 0.75], best: [0.1, 0.45],
  });
  if (r.grade !== 'none') {
    nod = true; judge(ctx, r.grade === 'bad' ? 'good' : r.grade);
    await ctx.tween(0.8, u => { player.s.bow = Math.sin(u * PI) * 18; });
    mother.gesture('nod'); father.gesture('nod');
  }
  return { turned, nod };
}
