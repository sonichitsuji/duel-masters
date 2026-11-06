// 効果ステップ（effects[] の要素）に書くキーの並び。
//
// カードテキストを読む順に並べてある:
//   「何をするか」→「どこから／どこへ」→「だれの」→「いくつ」→「どう選ぶか」→「どれ」
//   → 効果ごとの細かい指定 → 変数に控える → 実行するかどうか
//
// ここに無いキーは末尾に、元の並びのまま残す（validator が未知のキーとして別に弾く）。
export const STEP_KEY_ORDER = [
  // 何をするか
  "label", "type",
  // どこから / どこへ
  "zone", "zones", "destination", "to", "under", "owner", "selfFrom", "side",
  // だれの
  "target", "self", "choosePlayer", "onePlayer",
  // いくつ
  "count", "amount", "perUnit", "min", "max", "maxSelect", "maxPerTurn",
  // どう選ぶか
  "all", "any", "random", "takeAll", "subject", "order", "mode", "templates",
  // どれ
  "filter",
  // 効果ごとの細かい指定
  "tapped", "free", "untap", "untapAfterAttack", "noUntapNextTurn", "summoningSickness",
  "destroyAtEndOfTurn", "keywords", "tempKeyword", "tempKeywords", "expires",
  "canUseTrigger", "afterCast", "until", "reason", "timing",
  // 変数に控える
  "as", "asCost",
  // 実行するかどうか
  "optional", "ifPrevious", "onlyIf",
];

const RANK = new Map(STEP_KEY_ORDER.map((k, i) => [k, i]));
const rank = k => (RANK.has(k) ? RANK.get(k) : STEP_KEY_ORDER.length);

// このステップのキーが正規の並びになっているか
export function stepKeysOrdered(step) {
  const ks = Object.keys(step);
  for (let i = 1; i < ks.length; i++) if (rank(ks[i - 1]) > rank(ks[i])) return false;
  return true;
}

// キーを正規の並びに直した写しを返す（値は触らない）。
// 知らないキーは末尾に、元の並びのまま残す。
export function orderStepKeys(step) {
  const ks = Object.keys(step);
  const sorted = ks.map((k, i) => [k, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]);
  const out = {};
  for (const [k] of sorted) out[k] = step[k];
  return out;
}

// カード1枚の中の effects[] をすべて正規の並びに直す。
// effects の要素だけが対象で、filter や condition のような入れ子の値は触らない。
export function orderCardSteps(value) {
  if (Array.isArray(value)) return value.map(orderCardSteps);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = k === "effects" && Array.isArray(v)
      ? v.map(step => (step && typeof step === "object" && !Array.isArray(step)
          ? orderCardSteps(orderStepKeys(step)) : orderCardSteps(step)))
      : orderCardSteps(v);
  }
  return out;
}
