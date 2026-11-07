// ===========================
// カードのデータ記法（DSL）の語彙
// ===========================
// カードビルダー（src/screens/CardBuilder.jsx）がフォームを描くために読み、
// scripts/step-key-order.mjs 経由で add-card.mjs / validate-cards.mjs もキーの並びを読む。
//
// 語彙そのものの正解は scripts/validate-cards.mjs の各 Set（型・キー・ゾーン等）と
// src/engine/effects.js の実装にあり、ここはそれを「UIが読める形」に言い直したもの。
// ズレたら落ちるテストで同期を保つこと（docs/card-authoring.md §2 を参照）。
//
// 入力の種類（kind）:
//   text     文字列
//   num      数値
//   numVar   数値、または変数名の文字列（amount など）
//   bool     真偽
//   filter   対象の条件（FILTER_SCHEMA）
//   keywords キーワード能力の複数選択
//   steps    入れ子のステップ列（chooseMode / chooseTimes の templates）
//   onlyIf   「〜なら」の条件（{ count, min, max }）
//   enum:X   ENUMS.X から選ぶ

// ---------------------------------------------------------------------------
// 選択肢
// ---------------------------------------------------------------------------
export const ENUMS = {
  target: { self: "自分", opponent: "相手", both: "おたがい", eventPlayer: "その出来事を起こした側" },
  civ: { light: "光", water: "水", darkness: "闇", fire: "火", nature: "自然", colorless: "無色" },
  cardType: {
    creature: "クリーチャー", evo_creature: "進化クリーチャー", spell: "呪文",
    twinpact: "ツインパクト", tamaseed: "タマシード", castle: "城（表向きシールド）", field: "フィールド",
  },
  // filter.type に書ける値。素の種別に加えて、meta な4つを選べる
  filterType: {
    creature: "クリーチャー（進化を含む）", nonCreature: "クリーチャー以外",
    nonEvoCreature: "進化でないクリーチャー", spell: "呪文",
    evo_creature: "進化クリーチャー", twinpact: "ツインパクト",
    tamaseed: "タマシード", castle: "城", field: "フィールド",
  },
  countZone: { bz: "バトルゾーン", shield: "シールド", mana: "マナゾーン", grave: "墓地", hand: "手札", deck: "山札" },
  bzZone: { bz: "エレメント単位（既定）", bzCards: "カード単位（進化元も1枚ずつ）" },
  graveZone: { grave: "墓地（既定）", wasUnder: "下にあったカード" },
  // 「こうして墓地に置いたカードの中から」。候補をその効果で動かしたカードに絞る
  graveToBzZone: { grave: "墓地すべて（既定）", lastMoved: "直前に動かしたカードの中から" },
  pickZone: { bz: "バトルゾーン", hand: "手札", mana: "マナゾーン", grave: "墓地", shield: "シールド" },
  playZone: { hand: "手札", grave: "墓地", eventCards: "その出来事のカード" },
  searchDestination: { hand: "手札", deckTop: "山札の上", bz: "バトルゾーン", mana: "マナゾーン", under: "選んだカードの下" },
  zonesToBzFrom: { grave: "墓地", mana: "マナゾーン", hand: "手札", hyper: "超次元ゾーン" },
  meteorBurnTo: { grave: "墓地", mana: "マナゾーン", hand: "手札", shield: "シールド", deck: "山札の下" },
  handToDeckTo: { top: "山札の上（既定）", bottom: "山札の下" },
  summonFromZone: { grave: "墓地", mana: "マナゾーン" },
  side: { creature: "クリーチャー面", spell: "呪文面" },
  order: { choose: "好きな順序で選ぶ" },
  expires: { endOfTurn: "ターンの終わりまで" },
  denySpellUntil: { endOfNextTurn: "次のターンの終わりまで" },
  denyMode: { both: "攻撃もブロックも", attack: "攻撃だけ", block: "ブロックだけ" },
  owner: { destroyed: "破壊されたクリーチャーの持ち主" },
  selfFrom: { lastPut: "直前に出したクリーチャー" },
};

// ---------------------------------------------------------------------------
// filter（対象の条件）
// ---------------------------------------------------------------------------
// 実データで多い順に並べてある。UI はこの順でドロップダウンに出す。
export const FILTER_SCHEMA = {
  maxCost: { kind: "numVar", label: "コストが〜以下" },
  type: { kind: "enum:filterType", label: "種別" },
  creatureOnly: { kind: "bool", label: "クリーチャーだけ" },
  civ: { kind: "enum:civ", label: "文明", multi: true },
  raceContains: { kind: "text", label: "種族に〜を含む", multi: true },
  self: { kind: "bool", label: "このカード自身（付与・コスト軽減用）" },
  element: { kind: "bool", label: "エレメント（タマシード・フィールドを含む）" },
  maxPower: { kind: "numVar", label: "パワーが〜以下" },
  minPower: { kind: "numVar", label: "パワーが〜以上" },
  notSelf: { kind: "bool", label: "このカード以外" },
  nameContains: { kind: "text", label: "名前に〜を含む", multi: true },
  cost: { kind: "numVar", label: "コストがちょうど〜" },
  minCost: { kind: "numVar", label: "コストが〜以上" },
  keyword: { kind: "keywords", label: "キーワード能力を持つ" },
  psychic: { kind: "bool", label: "サイキック・クリーチャー" },
  civNot: { kind: "enum:civ", label: "〜の文明ではない", multi: true },
  multiColor: { kind: "bool", label: "多色" },
  tapped: { kind: "bool", label: "タップされている" },
  evolution: { kind: "bool", label: "いま進化クリーチャー" },
  notNameSelf: { kind: "bool", label: "このカードと同じ名前ではない" },
  side: { kind: "enum:side", label: "ツインパクトのどちらの面か" },
  hasCip: { kind: "bool", label: "「出た時」能力を持つ" },
  elementOnly: { kind: "bool", label: "エレメントだけ（付与の条件用）" },
  not: { kind: "filter", label: "〜ではない（入れ子）" },
  // uid は選択結果を engine が焼き込む用。データには書けない（validator が弾く）
};

// ---------------------------------------------------------------------------
// 効果ステップ
// ---------------------------------------------------------------------------
// すべてのステップに書けるキー。型ごとの keys には書かない。
export const COMMON_STEP_KEYS = {
  label: { kind: "text", label: "ラベル（モーダルに出る説明）" },
  optional: { kind: "bool", label: "〜してもよい" },
  ifPrevious: { kind: "bool", label: "そうしたら（直前を行った時だけ）" },
  onlyIf: { kind: "onlyIf", label: "〜なら（変数の値で判定）" },
};

export const GROUPS = {
  vars: "変数ステップ",
  turn: "ターン進行",
  deck: "ドロー / 山札",
  revealed: "公開したカードの行き先",
  hand: "手札から",
  mana: "マナから",
  bz: "バトルゾーンから",
  grave: "墓地・シールド",
  deny: "封じる",
  misc: "その他",
};

// 型ごとに書けるキー。出どころは scripts/validate-cards.mjs の型別検査と
// docs/card-authoring.md §5 のカタログ、それに public/cards.json の実使用。
export const EFFECT_SCHEMA = {
  // ---- 変数ステップ ----
  count: { group: "vars", label: "数えて変数に入れる",
    keys: { zone: "enum:countZone", target: "enum:target", filter: "filter", as: "text" } },
  pick: { group: "vars", label: "選んで覚えておく",
    keys: { zone: "enum:pickZone", target: "enum:target", amount: "numVar", filter: "filter", as: "text" } },
  chooseNumber: { group: "vars", label: "数字を1つ選ぶ",
    keys: { min: "num", max: "num", as: "text" } },
  chooseMode: { group: "vars", label: "いずれか1つを選ぶ",
    keys: { templates: "steps" } },

  // ---- ターン進行 ----
  skipRestOfTurn: { group: "turn", label: "このターンの残りをとばす", keys: {} },

  // ---- ドロー / 山札 ----
  drawCards: { group: "deck", label: "カードを引く",
    keys: { target: "enum:target", amount: "numVar" } },
  reveal: { group: "deck", label: "山札の上を公開する",
    keys: { amount: "numVar" } },
  search: { group: "deck", label: "山札から探す",
    keys: { destination: "enum:searchDestination", under: "text", amount: "numVar",
            takeAll: "bool", filter: "filter", tapped: "bool" } },
  topToGrave: { group: "deck", label: "山札の上を墓地に置く", keys: { amount: "numVar" } },
  topToMana: { group: "deck", label: "山札の上をマナゾーンに置く", keys: { amount: "numVar", tapped: "bool" } },
  topToShield: { group: "deck", label: "山札の上をシールド化する", keys: { amount: "numVar" } },
  topToUnder: { group: "deck", label: "山札の上を表向きにして下に置く", keys: { under: "text", amount: "numVar" } },
  shuffleDeck: { group: "deck", label: "山札をシャッフルする", keys: { target: "enum:target" } },

  // ---- 公開したカードの行き先 ----
  revealedToHand: { group: "revealed", label: "公開したカードを手札に加える",
    keys: { amount: "numVar", any: "bool", takeAll: "bool", filter: "filter" } },
  revealedToBz: { group: "revealed", label: "公開したカードをバトルゾーンに出す",
    keys: { amount: "numVar", takeAll: "bool", filter: "filter", tempKeywords: "keywords", summoningSickness: "bool" } },
  revealedToMana: { group: "revealed", label: "公開したカードをマナゾーンに置く",
    keys: { amount: "numVar", takeAll: "bool", filter: "filter", tapped: "bool" } },
  revealedToGrave: { group: "revealed", label: "公開したカードを墓地に置く",
    keys: { amount: "numVar", takeAll: "bool", filter: "filter" } },
  revealedToDeckTop: { group: "revealed", label: "公開したカードを山札の上に置く",
    keys: { amount: "numVar", takeAll: "bool", filter: "filter" } },
  revealedToDeckBottom: { group: "revealed", label: "残りを山札の下に置く",
    keys: { order: "enum:order" } },

  // ---- 手札から ----
  handToBz: { group: "hand", label: "手札から出す",
    keys: { target: "enum:target", amount: "numVar", filter: "filter",
            tempKeyword: "text", tempKeywords: "keywords", summoningSickness: "bool" } },
  handToShield: { group: "hand", label: "手札をシールド化する", keys: { amount: "numVar" } },
  handToGrave: { group: "hand", label: "手札を捨てる",
    keys: { target: "enum:target", amount: "numVar", any: "bool", all: "bool", random: "bool",
            as: "text", asCost: "text" } },
  handToDeck: { group: "hand", label: "手札を山札に戻す",
    keys: { target: "enum:target", to: "enum:handToDeckTo", amount: "numVar", order: "enum:order" } },
  handToHyper: { group: "hand", label: "手札を超次元ゾーンに置く",
    keys: { target: "enum:target", amount: "numVar", all: "bool", filter: "filter" } },
  playFromHand: { group: "hand", label: "手札から実行する（唱える / 召喚する）",
    keys: { zone: "enum:playZone", side: "enum:side", target: "enum:target", amount: "numVar",
            subject: "bool", filter: "filter", free: "bool", afterCast: "json" } },

  // ---- マナから ----
  manaToBz: { group: "mana", label: "マナゾーンから出す",
    keys: { target: "enum:target", amount: "numVar", filter: "filter" } },
  manaToHand: { group: "mana", label: "マナゾーンから手札に戻す",
    keys: { target: "enum:target", amount: "numVar", all: "bool", filter: "filter" } },
  manaToGrave: { group: "mana", label: "マナゾーンから墓地に置く",
    keys: { target: "enum:target", amount: "numVar", any: "bool", all: "bool", filter: "filter", as: "text" } },

  // ---- バトルゾーンから ----
  destroy: { group: "bz", label: "破壊する",
    keys: { zone: "enum:bzZone", target: "enum:target", self: "bool", amount: "numVar",
            all: "bool", filter: "filter", asCost: "text" } },
  bzToHand: { group: "bz", label: "持ち主の手札に戻す",
    keys: { zone: "enum:bzZone", target: "enum:target", amount: "numVar", all: "bool",
            subject: "bool", filter: "filter" } },
  bzToMana: { group: "bz", label: "マナゾーンに置く",
    keys: { zone: "enum:bzZone", target: "enum:target", amount: "numVar", all: "bool",
            subject: "bool", filter: "filter", tapped: "bool" } },
  bzToShield: { group: "bz", label: "シールド化する",
    keys: { zone: "enum:bzZone", target: "enum:target", amount: "numVar", all: "bool", filter: "filter" } },
  tap: { group: "bz", label: "タップする",
    keys: { target: "enum:target", amount: "numVar", all: "bool", filter: "filter", noUntapNextTurn: "bool" } },
  untap: { group: "bz", label: "アンタップする",
    keys: { zone: "enum:pickZone", target: "enum:target", amount: "numVar", all: "bool", filter: "filter" } },
  tapToggle: { group: "bz", label: "タップ／アンタップを切り替える",
    keys: { target: "enum:target", amount: "numVar", filter: "filter" } },
  untapAllMana: { group: "bz", label: "マナゾーンをすべてアンタップする",
    keys: { target: "enum:target" } },
  powerBuff: { group: "bz", label: "パワーを増減する",
    keys: { target: "enum:target", count: "num", amount: "num", perUnit: "num",
            subject: "bool", filter: "filter", expires: "enum:expires" } },
  grant: { group: "bz", label: "キーワード能力を与える",
    keys: { target: "enum:target", count: "num", all: "bool", filter: "filter",
            keywords: "keywords", untap: "bool", untapAfterAttack: "bool",
            destroyAtEndOfTurn: "bool", expires: "enum:expires" } },
  battle: { group: "bz", label: "バトルする",
    keys: { selfFrom: "enum:selfFrom", target: "enum:target", amount: "numVar", filter: "filter" } },
  ignoreAbilities: { group: "bz", label: "能力を無視する",
    keys: { target: "enum:target", amount: "numVar", all: "bool", filter: "filter" } },

  // ---- 墓地・シールド ----
  graveToBz: { group: "grave", label: "墓地から出す",
    keys: { zone: "enum:graveToBzZone", owner: "enum:owner", target: "enum:target", self: "bool",
            amount: "numVar", filter: "filter",
            tempKeywords: "keywords", summoningSickness: "bool", destroyAtEndOfTurn: "bool" } },
  zonesToBz: { group: "grave", label: "複数のゾーンから出す",
    keys: { zones: "zones", amount: "numVar", filter: "filter",
            tempKeywords: "keywords", summoningSickness: "bool", destroyAtEndOfTurn: "bool" } },
  graveToHand: { group: "grave", label: "墓地から手札に戻す",
    keys: { zone: "enum:graveZone", target: "enum:target", amount: "numVar", all: "bool", filter: "filter" } },
  graveToDeck: { group: "grave", label: "墓地を山札に加えてシャッフルする",
    keys: { target: "enum:target", onePlayer: "bool", any: "bool", amount: "numVar", filter: "filter" } },
  graveToDeckBottom: { group: "grave", label: "墓地を山札の下に置く",
    keys: { target: "enum:target", choosePlayer: "bool", onePlayer: "bool", amount: "numVar",
            all: "bool", order: "enum:order", filter: "filter" } },
  shieldToHand: { group: "grave", label: "シールドを手札に加える",
    keys: { target: "enum:target", amount: "numVar", all: "bool", filter: "filter", canUseTrigger: "bool" } },
  shieldToGrave: { group: "grave", label: "シールドを墓地に置く",
    keys: { target: "enum:target", amount: "numVar", all: "bool", filter: "filter" } },
  breakShield: { group: "grave", label: "シールドをブレイクする",
    keys: { target: "enum:target", amount: "numVar" } },

  // ---- 封じる ----
  denySpell: { group: "deny", label: "呪文を唱えられなくする",
    keys: { target: "enum:target", filter: "filter", until: "enum:denySpellUntil" } },
  denyAttackBlock: { group: "deny", label: "攻撃／ブロックできなくする",
    keys: { target: "enum:target", mode: "enum:denyMode", amount: "numVar", all: "bool", filter: "filter" } },
  limitAttackBlock: { group: "deny", label: "攻撃／ブロックの回数を制限する",
    keys: { target: "enum:target", maxPerTurn: "num", filter: "filter" } },

  // ---- その他 ----
  meteorBurn: { group: "misc", label: "メテオバーン（下のカードを動かす）",
    keys: { to: "enum:meteorBurnTo", count: "num", tapped: "bool" } },
  winGame: { group: "misc", label: "ゲームに勝つ", keys: { target: "enum:target" } },
  grantSummonFrom: { group: "misc", label: "召喚できるゾーンを増やす",
    keys: { zone: "enum:summonFromZone", timing: "text", maxPerTurn: "num", filter: "filter" } },
  awaken: { group: "misc", label: "覚醒させる（裏返す）", keys: {} },
  unawaken: { group: "misc", label: "解除する（裏返して戻す）", keys: {} },
  scheduleReviveSubjectEndOfTurn: { group: "misc", label: "ターンの終わりに戻すことを予約する", keys: {} },
};

// ---------------------------------------------------------------------------
// トリガー（能力の契機）
// ---------------------------------------------------------------------------
export const TRIGGER_SCHEMA = {
  creaturePutBz: { label: "出た時（cip）", scope: "this", keys: ["method", "paid", "manaTapped"] },
  cast: { label: "唱えた時（呪文の本体）", scope: null, keys: [] },
  castSpell: { label: "呪文を唱えた時", scope: "self", keys: ["method", "paid", "manaTapped", "fromZone"] },
  attack: { label: "攻撃する時", scope: "this", keys: ["firstEachTurn"] },
  attackEnd: { label: "攻撃の後で", scope: "this", keys: [] },
  block: { label: "ブロックした時", scope: "this", keys: [] },
  battle: { label: "バトルする時", scope: "this", keys: [] },
  battleWin: { label: "バトルに勝った時", scope: "this", keys: [] },
  battleDestroy: { label: "バトルで破壊された時", scope: "this", keys: [] },
  destroyed: { label: "破壊された時", scope: "this", keys: [] },
  leave: { label: "離れた時", scope: "this", keys: [] },
  break: { label: "シールドをブレイクする時", scope: "this", keys: [] },
  draw: { label: "カードを引いた時", scope: "self", keys: ["lastCard"] },
  discard: { label: "手札を捨てた時", scope: "self", keys: [] },
  shieldAdded: { label: "シールドが置かれた時", scope: "self", keys: [] },
  shieldLeave: { label: "シールドが離れた時", scope: "self", keys: [] },
  startOfTurn: { label: "ターンのはじめに", scope: "self", keys: [] },
  endOfTurn: { label: "ターンの終わりに", scope: "self", keys: [] },
};

export const TRIGGER_SCOPE_LABELS = {
  this: "このカード自身", self: "自分", opponent: "相手", both: "おたがい",
};

// トリガーに書けるキー。validator に未知キー検査が無かったので、ここを出どころにする。
export const TRIGGER_KEYS = new Set([
  "on", "target", "effects", "label", "optional", "oncePerTurn", "oncePerGame",
  "condition", "filter", "method", "paid", "manaTapped", "fromZone", "lastCard",
  "turnOf", "firstEachTurn", "hyperOnly",
  // 「○回選んで実行」の特殊形
  "type", "count", "templates",
]);

// ---------------------------------------------------------------------------
// キーの並び
// ---------------------------------------------------------------------------
// カードテキストを読む順:
//   「何をするか」→「どこから／どこへ」→「だれの」→「いくつ」→「どう選ぶか」→「どれ」
//   → 効果ごとの細かい指定 → 変数に控える → 実行するかどうか
export const KEY_GROUPS = [
  ["何をするか", ["label", "type"]],
  ["どこから / どこへ", ["zone", "zones", "destination", "to", "under", "owner", "selfFrom", "side"]],
  ["だれの", ["target", "self", "choosePlayer", "onePlayer"]],
  ["いくつ", ["count", "amount", "perUnit", "min", "max", "maxSelect", "maxPerTurn"]],
  ["どう選ぶか", ["all", "any", "random", "takeAll", "subject", "order", "mode", "templates"]],
  ["どれ", ["filter"]],
  ["効果ごとの細かい指定", ["tapped", "free", "untap", "untapAfterAttack", "noUntapNextTurn",
    "summoningSickness", "destroyAtEndOfTurn", "keywords", "tempKeyword", "tempKeywords",
    "expires", "canUseTrigger", "afterCast", "until", "reason", "timing"]],
  ["変数に控える", ["as", "asCost"]],
  ["実行するかどうか", ["optional", "ifPrevious", "onlyIf"]],
];

// ここに無いキーは末尾に、元の並びのまま残す（validator が未知のキーとして別に弾く）。
export const STEP_KEY_ORDER = KEY_GROUPS.flatMap(([, keys]) => keys);

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

// ---------------------------------------------------------------------------
// UI が使う小道具
// ---------------------------------------------------------------------------
// 効果の種類を、グループごとにまとめて返す（<optgroup> 用）。
export function effectTypesByGroup() {
  return Object.entries(GROUPS).map(([g, label]) => [
    label,
    Object.entries(EFFECT_SCHEMA).filter(([, d]) => d.group === g).map(([t, d]) => [t, d.label]),
  ]).filter(([, types]) => types.length);
}

// そのステップに書けるキーの一覧（共通キー＋型ごとのキー）を、正規の並びで返す。
export function stepKeysFor(type) {
  const own = EFFECT_SCHEMA[type]?.keys || {};
  const all = { ...own };
  for (const [k, d] of Object.entries(COMMON_STEP_KEYS)) all[k] = d.kind;
  return Object.keys(all).sort((a, b) => rank(a) - rank(b))
    .map(k => [k, typeof all[k] === "string" ? all[k] : all[k].kind]);
}

// そのステップが、スキーマで表せる形になっているか（生JSONに落とすかの判定に使う）
export function stepFitsSchema(step) {
  const def = EFFECT_SCHEMA[step?.type];
  if (!def) return false;
  const allowed = new Set([...Object.keys(def.keys), ...Object.keys(COMMON_STEP_KEYS), "type"]);
  return Object.keys(step).every(k => allowed.has(k));
}

export const effectLabel = type => EFFECT_SCHEMA[type]?.label || type;
