// 人物の設定。年齢・性別・顔立ち・髪型・服装は、ここで人物素材を選び替えて変える（素材を足せば選べる人が増える）。
// person は src/actor.js の PEOPLE のキー（assets/people/<person>/ にある Rocketbox の人物）。
export const PROFILES = [
  { id: 'm30-suit', label: '30代の男性・紺の無地のスーツ（はじめの設定）', person: 'Business_Male_02', height: 1.72 },
  { id: 'f40-suit', label: '40代の女性・グレーのスーツ', person: 'Business_Female_03', height: 1.58 },
  { id: 'f20-knit', label: '20代の女性・ニット', person: 'Female_Adult_11', height: 1.6 },
  { id: 'm60-jacket', label: '60代の男性・ジャケット', person: 'Male_Adult_03', height: 1.7 },
];
export const PARTNER = { id: 'partner', label: '相手役（20代の女性）', person: 'Female_Adult_11', height: 1.6 };
