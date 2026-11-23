# 素材の台帳

段階の決まり：

- **仮素材**：形と動きを確かめるためだけのもの。完成見本には使わない。
- **見本候補**：質は完成見本に近い。使ってよい条件も確かめてある。
- **本番**：完成見本で使うと決めたもの。

いまの段階は **仮素材の段階** です。完成見本の段階には、まだ入っていません。

## 使っている素材

| 素材 | 置き場所 | 出どころ | 使ってよい条件 | 段階 |
|---|---|---|---|---|
| 人物 4 人（本人・恋人・父・母） | `assets/people/<名前>/` | Microsoft Rocketbox（https://github.com/microsoft/Microsoft-Rocketbox ）の Business_Male_02・Female_Adult_11・Male_Adult_03・Business_Female_03 | MIT（公開・配布してよい。著作権表示を残す） | 見本候補 |
| 人物の表情・指・目 | 同上（表情の形 8 つ・指の骨・目の骨） | 同上 | 同上 | 見本候補 |
| お辞儀・正座・歩く・手の動き・うなずき・まばたき・話す口 | `src/actor.js` | このリポジトリで書いた計算（骨と表情を直接動かす） | 自作 | 仮素材 |
| 畳 | `assets/tex/tatami_mat_*` | Poly Haven「Tatami Mat」 | CC0 | 見本候補 |
| 天井・柱の木（杉） | `assets/tex/japanese_cedar_planks_*` | Poly Haven「Japanese Cedar Planks」 | CC0 | 見本候補 |
| 漆喰の壁 | `assets/tex/white_plaster_rough_01_*` | Poly Haven「White Plaster Rough 01」 | CC0 | 見本候補 |
| 玄関の土間（石） | `assets/tex/slate_floor_*` | Poly Haven「Slate Floor」 | CC0 | 見本候補 |
| 座卓（木） | `assets/tex/oak_veneer_01_*` | Poly Haven「Oak Veneer 01」 | CC0 | 見本候補 |
| 廊下の床 | `assets/tex/wood_floor_worn_*` | Poly Haven「Wood Floor Worn」 | CC0 | 見本候補 |
| 座布団・布 | `assets/tex/rough_linen_*` | Poly Haven「Rough Linen」 | CC0 | 見本候補 |
| 室内の環境光 | `assets/hdri/kiara_interior_1k.hdr` | Poly Haven「Kiara Interior」 | CC0 | 見本候補（1k は軽さ優先。完成見本では 2k 以上） |
| 家の形・家具・小物（靴・手土産・湯のみ・盆・布巾） | `src/env.js`・`src/props.js` | このリポジトリで書いた形（箱や円柱の組み合わせ） | 自作 | 仮素材 |
| 効果音・部屋の空気の音 | `src/audio.js` | ブラウザーの中で計算して作る音 | 自作 | 仮素材 |
| 描画の部品 three.js r170 | `vendor/three-build`・`vendor/three-addons`（使う分だけ） | three.js | MIT（`vendor/LICENSE-three.txt`） | 本番 |

Poly Haven の素材は `https://polyhaven.com/` から 2026-11-23 に取得しました（1k の jpg）。

### 人物モデルの手の入れ方（2026-11-23）

- Rocketbox の `Avatars/<名前>/Export/<名前>_facial.fbx` と絵（2048 の TGA）を取得した。
- `dev/convert.html`（リポジトリには入れない作業用ページ）で `.glb` に変換した。表情の形は 175 個から 8 個（まばたき左右・口を開く・笑う左右・眉を上げる・口をへの字左右）に減らした。
- 絵は 1024 に縮めた（色と凹凸は jpg、髪の透けは png）。足の部分に靴下の色を塗った（家に上がる場面のため）。
- 元の FBX と元の絵は `dev/src/` に置き、リポジトリには入れていない。作り直すときは Rocketbox から取り直して `dev/convert.html` を開く。
- 前に使っていた Xbot（Mixamo、利用条件が要確認）は消した。いま使っている素材は、すべて MIT・CC0・自作。

### 人物の気になるところ（見本候補にとどめる理由）

- Rocketbox には東アジア系の人が少ない。父と母は、日本の家の親に見えにくい。
- 恋人のまとめ髪のふちが少しほつれて見える。
- 母は靴の形が足に残っている（靴下をはいた足に見えるようにはした）。
- お辞儀・正座の動きは計算で作った近似。本物の所作の動きではない。

## 足りないもの（完成見本までに要る）

| 要るもの | いまの状態 | 用意のしかた（案） |
|---|---|---|
| 日本人に見える写実の人物 | Rocketbox の 4 人（MIT）。父と母が日本の親に見えにくい | 日本人の顔の人物モデル（利用条件を確かめたもの）を買う・作る |
| 服（着物・場面に合う普段着） | スーツと普段着（モデルに付いている） | 場面B・C に合わせて足す |
| 表情・口の動き | まばたき・話す口・笑う・困る（8 つの形） | 声に合わせた口の形 |
| 指の動き（名刺・湯のみを持つ） | 指を軽く曲げるだけ | 物ごとの持ち方を作る |
| お辞儀・正座の本物の動き | 計算で作った近似 | 所作に詳しい人の動きを撮る（モーションキャプチャ） |
| 声 | 字幕だけ | 声優の収録、または利用条件の確かな合成音声 |
| 家具・小物の作り込み | 単純な形 | 写真から作る、または CC0 の 3D モデル |
| 場面B（オフィス）・場面C（神社）の場 | なし | 同上 |
| 実際の音（畳の擦れ・襖・湯のみ） | 計算で作った音 | 録音、または CC0 の音 |

## 決まり

- 生成した絵は、ゲーム画面として見せない。`docs/screenshots/` には、実際にゲームを動かして撮った画面だけを置く。
- 利用条件がわからない素材は「要確認」と書き、公開・配布しない。
- 実在の神社・寺・人物・会社の名前や紋を、許可なく使わない。
