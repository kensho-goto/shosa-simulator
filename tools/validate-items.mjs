#!/usr/bin/env node
// 台帳の検査。
//   node tools/validate-items.mjs   → 問題がなければ終了コード 0、あれば 1
//
// data/items.json と data/scenarios.json を、tools/canonical-items.mjs の正本と突き合わせる。
// 生成スクリプトを通さずに JSON を手で直した場合も、この検査を通すこと。

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseCanonical, CATEGORIES, KINDS, CONTROLS, STATUSES, SOURCE_STATUSES,
  SCENARIO_STATUSES, SPEC_SCENARIOS,
} from "./canonical-items.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function load(rel) {
  try {
    return JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
  } catch (e) {
    err(`${rel} を読めません: ${e.message}`);
    return null;
  }
}

const itemsDoc = load("data/items.json");
const scenariosDoc = load("data/scenarios.json");
const items = Array.isArray(itemsDoc) ? itemsDoc : itemsDoc?.items;
const scenarios = Array.isArray(scenariosDoc) ? scenariosDoc : scenariosDoc?.scenarios;
if (!Array.isArray(items)) err("data/items.json に項目の配列（items）がありません");
if (!Array.isArray(scenarios)) err("data/scenarios.json に場面の配列（scenarios）がありません");

const nonEmptyStr = (v) => typeof v === "string" && v.trim().length > 0;
const isStrArray = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

if (Array.isArray(items) && Array.isArray(scenarios)) {
  const canonical = parseCanonical();
  const canonById = new Map(canonical.map((c) => [c.id, c]));

  // ── 件数・ID ──
  if (canonical.length !== 200) err(`正本の件数が200ではありません: ${canonical.length}`);
  if (items.length !== 200) err(`項目の件数が200ではありません: ${items.length}`);
  const seen = new Set();
  for (const it of items) {
    if (seen.has(it.id)) err(`IDが重複しています: ${it.id}`);
    seen.add(it.id);
  }
  for (let i = 1; i <= 200; i++) {
    const id = `S${String(i).padStart(3, "0")}`;
    if (!seen.has(id)) err(`欠番があります: ${id}`);
  }
  for (const id of seen) if (!canonById.has(id)) err(`正本にないIDがあります: ${id}`);
  items.forEach((it, i) => {
    const want = `S${String(i + 1).padStart(3, "0")}`;
    if (it.id !== want) warn(`並び順が ID 順ではありません（${i + 1}番目が ${it.id}）`);
  });

  const itemIds = new Set(items.map((it) => it.id));
  const scenarioIds = new Set();
  for (const sc of scenarios) {
    if (scenarioIds.has(sc.id)) err(`場面IDが重複しています: ${sc.id}`);
    scenarioIds.add(sc.id);
  }

  // ── 項目ごと ──
  const REQUIRED = [
    "id", "name", "category", "kind", "parents", "scenarios", "playerRole", "controls",
    "goal", "prerequisites", "successCriteria", "failures", "needs", "sources",
    "variations", "gameExaggeration", "status",
  ];
  const goals = new Map();
  for (const it of items) {
    const tag = `${it.id ?? "?"} ${it.name ?? ""}`;
    for (const k of REQUIRED) if (!(k in it)) err(`${tag}: 必須フィールド ${k} がありません`);

    const c = canonById.get(it.id);
    if (c) {
      if (it.name !== c.name) err(`${tag}: 名前が正本と違います（正本: ${c.name}）`);
      if (it.category !== c.category) err(`${tag}: 分類が正本と違います（正本: ${c.category}）`);
    }
    if (!CATEGORIES.includes(it.category)) err(`${tag}: 分類名が13分類にありません: ${it.category}`);
    if (!KINDS.includes(it.kind)) err(`${tag}: kind の値が不正です: ${it.kind}`);

    for (const k of ["playerRole", "goal", "prerequisites", "successCriteria", "variations", "gameExaggeration"]) {
      if (k in it && !nonEmptyStr(it[k])) err(`${tag}: ${k} が空です`);
    }
    if (nonEmptyStr(it.goal)) {
      if (goals.has(it.goal)) err(`${tag}: goal が ${goals.get(it.goal)} と同じ文です（使い回し禁止）`);
      goals.set(it.goal, it.id);
    }

    if (!isStrArray(it.parents)) err(`${tag}: parents が文字列の配列ではありません`);
    else for (const p of it.parents) {
      if (p === it.id) err(`${tag}: parents に自分自身が入っています`);
      else if (!itemIds.has(p)) err(`${tag}: parents に実在しないIDがあります: ${p}`);
    }

    if (!Array.isArray(it.controls) || it.controls.length === 0) err(`${tag}: controls が空です`);
    else {
      for (const ctl of it.controls) if (!CONTROLS.includes(ctl)) err(`${tag}: controls の値が決めた語ではありません: ${ctl}`);
      if (new Set(it.controls).size !== it.controls.length) err(`${tag}: controls に重複があります`);
    }

    if (!STATUSES.includes(it.status)) err(`${tag}: status の値が決めた語ではありません: ${it.status}`);

    if (!Array.isArray(it.failures) || it.failures.length === 0) err(`${tag}: failures が空です`);
    else it.failures.forEach((f, i) => {
      for (const k of ["example", "reaction", "recovery"]) {
        if (!nonEmptyStr(f?.[k])) err(`${tag}: failures[${i}].${k} が空です`);
      }
    });

    const n = it.needs;
    if (!n || typeof n !== "object") err(`${tag}: needs がありません`);
    else for (const k of ["people", "props", "motions", "sounds"]) {
      if (!isStrArray(n[k])) err(`${tag}: needs.${k} が文字列の配列ではありません`);
    }

    if (!Array.isArray(it.sources)) err(`${tag}: sources が配列ではありません`);
    else it.sources.forEach((s, i) => {
      const st = `${tag}: sources[${i}]`;
      if (!nonEmptyStr(s?.url) || !/^https?:\/\//.test(s.url)) err(`${st}.url が不正です`);
      if (!nonEmptyStr(s?.title)) err(`${st}.title が空です`);
      if (!SOURCE_STATUSES.includes(s?.status)) err(`${st}.status の値が不正です: ${s?.status}`);
      if (s?.status === "確認済み" && !(typeof s.checkedOn === "string" && DATE_RE.test(s.checkedOn))) {
        err(`${st}: 確認済みなのに checkedOn（YYYY-MM-DD）がありません`);
      }
      if (s?.status === "未確認" && s.checkedOn !== null) err(`${st}: 未確認なのに checkedOn が null ではありません`);
    });

    if (!isStrArray(it.scenarios)) err(`${tag}: scenarios が文字列の配列ではありません`);
    else {
      if (it.scenarios.length === 0) err(`${tag}: どの場面にも入っていません`);
      for (const s of it.scenarios) if (!scenarioIds.has(s)) err(`${tag}: scenarios に実在しない場面IDがあります: ${s}`);
    }

    // 実装状態の決まり
    if (it.status === "仕様済み") {
      if (!it.scenarios?.some((s) => SPEC_SCENARIOS.includes(s))) err(`${tag}: 仕様済みは場面A/B/C（${SPEC_SCENARIOS.join("・")}）の項目だけに付けます`);
      if (!nonEmptyStr(it.goal) || !nonEmptyStr(it.successCriteria) || !it.failures?.length) err(`${tag}: 仕様済みなのに goal・成功条件・失敗例がそろっていません`);
    }
  }

  // ── 場面ごと ──
  const fromScenarios = new Map(); // 項目ID → Set(場面ID)
  for (const sc of scenarios) {
    const tag = `場面 ${sc.id ?? "?"} ${sc.title ?? ""}`;
    for (const k of ["id", "title", "status", "role", "flow", "items"]) if (!(k in sc)) err(`${tag}: 必須フィールド ${k} がありません`);
    if (!SCENARIO_STATUSES.includes(sc.status)) err(`${tag}: status の値が不正です: ${sc.status}`);
    if (!isStrArray(sc.flow) || sc.flow.length === 0) err(`${tag}: flow が空です`);
    if (!Array.isArray(sc.items) || sc.items.length === 0) { err(`${tag}: items が空です`); continue; }
    const inThis = new Set();
    for (const e of sc.items) {
      if (!itemIds.has(e.id)) err(`${tag}: 実在しない項目IDがあります: ${e.id}`);
      if (inThis.has(e.id)) err(`${tag}: 同じ項目が2回入っています: ${e.id}`);
      inThis.add(e.id);
      if (!nonEmptyStr(e.step)) err(`${tag}: ${e.id} の step が空です`);
      else if (isStrArray(sc.flow) && !sc.flow.includes(e.step)) err(`${tag}: ${e.id} の step「${e.step}」が flow にありません`);
      if (typeof e.note !== "string") err(`${tag}: ${e.id} の note が文字列ではありません`);
      if (!fromScenarios.has(e.id)) fromScenarios.set(e.id, new Set());
      fromScenarios.get(e.id).add(sc.id);
    }
  }
  for (const id of SPEC_SCENARIOS) {
    const sc = scenarios.find((s) => s.id === id);
    if (!sc) err(`場面 ${id} がありません`);
    else if (sc.status !== "詳細") err(`場面 ${id} の status は「詳細」にします`);
  }

  // ── items.json と scenarios.json の食い違い ──
  for (const it of items) {
    const a = new Set(it.scenarios || []);
    const b = fromScenarios.get(it.id) || new Set();
    for (const s of a) if (!b.has(s)) err(`${it.id}: items.json では ${s} に入っているが、scenarios.json の ${s} に ${it.id} がありません`);
    for (const s of b) if (!a.has(s)) err(`${it.id}: scenarios.json の ${s} に入っているが、items.json の scenarios に ${s} がありません`);
  }

  // ── 集計 ──
  const byStatus = {};
  for (const it of items) byStatus[it.status] = (byStatus[it.status] || 0) + 1;
  const confirmed = new Set();
  for (const it of items) for (const s of it.sources || []) if (s.status === "確認済み") confirmed.add(s.url);
  console.log(`項目 ${items.length} 件 / 場面 ${scenarios.length} 件`);
  console.log(`実装状態: ${Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join("、")}`);
  console.log(`確認済みの出典URL: ${confirmed.size} 件`);
  const raised = items.filter((it) => ["操作可能", "演出済み", "検証済み"].includes(it.status)).length;
  if (raised) warn(`「操作可能」以上の項目が ${raised} 件あります。ゲーム側で動くことを確かめて上げたものか確認してください`);
}

for (const w of warnings) console.warn(`注意: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`エラー: ${e}`);
  console.error(`\nエラー ${errors.length} 件。台帳を直してください。`);
  process.exit(1);
}
console.log("OK: 台帳の検査をすべて通りました。");
