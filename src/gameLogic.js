import { CIV, CIVS } from "./constants";

// ===========================
// HELPERS
// ===========================
let _uid = 1;
export const mkUid = () => `c${_uid++}`;
let _cardId = 200;
export const mkCardId = () => ++_cardId;

export function shuffle(arr) {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}

export function makeDeckFromList(cardIds, cardDb) {
  return shuffle(cardIds.map(id=>{
    const base=cardDb.find(c=>c.id===id)||cardDb[0];
    return {...base,uid:mkUid(),tapped:false,summonedThisTurn:false};
  }));
}

export function defaultDeckIds(cardDb) {
  const pool=cardDb.slice(0,15).map(c=>c.id);
  const ids=[];
  for(let i=0;ids.length<40;i++) ids.push(pool[i%pool.length]);
  return ids;
}

export function initPlayerState(deckIds, cardDb) {
  const deck=makeDeckFromList(deckIds, cardDb);
  return {deck:deck.slice(10),hand:deck.slice(5,10),shields:deck.slice(0,5),battle:[],mana:[],grave:[]};
}

// civs: 単色="fire" or 多色=["fire","nature"]
// 文明は常に正規順（光→水→闇→火→自然 = CIVS の順）に並べ替えて返す
export function getCardCivs(card){
  const arr = Array.isArray(card.civ) ? [...card.civ] : [card.civ];
  return arr.sort((a,b)=>CIVS.indexOf(a)-CIVS.indexOf(b));
}

export function makeCardBg(civs) {
  const n = civs.length;
  if (n === 1) return `linear-gradient(180deg, ${CIV[civs[0]]?.bg || '#08080f'}, #08080f)`;
  // 多色: \ 方向(左上→右下)の斜め線で色数ぶん等分。
  // 各文明はベタ塗りの平坦域を持ち、境界付近だけ細くグラデーションで混ぜる(色はくっきり分かれる)。
  // bg(ほぼ黒)では色差が出ず視認できないため鮮やかな color を使用し、文字が読めるよう少し暗く落とす。
  const margin = 5; // 境界の混色域の半幅(%)。小さいほど色の境目がくっきりする。
  const stops = [];
  civs.forEach((civ, i) => {
    const col = `color-mix(in srgb, ${CIV[civ]?.color || '#08080f'} 70%, #000)`;
    const start = 100 * i / n;
    const end = 100 * (i + 1) / n;
    const p1 = i === 0 ? start : start + margin;
    const p2 = i === n - 1 ? end : end - margin;
    stops.push(`${col} ${Math.round(p1)}%`, `${col} ${Math.round(p2)}%`);
  });
  // 225deg = "to bottom left": 分割線が \ 方向、先頭色が上側・末尾色が下側
  return `linear-gradient(225deg, ${stops.join(', ')})`;
}

export function canPayCost(mana,card,costSource,opts={}){
  const effectiveCost=costSource?getEffectiveCost(card,costSource,opts):card.cost;
  const untapped=mana.filter(c=>!c.tapped);
  if(untapped.length<effectiveCost) return {ok:false,reason:`マナ不足 (必要:${effectiveCost} / 利用可能:${untapped.length})`};
  if(effectiveCost===0) return {ok:true};
  const civs=getCardCivs(card);
  for(const civ of civs){
    if(!untapped.some(c=>getCardCivs(c).includes(civ))){
      return {ok:false,reason:`${CIV[civ]?.label}文明のマナが必要です`};
    }
  }
  return {ok:true};
}

export function tapManaByUids(mana,uids){
  return mana.map(c=>uids.includes(c.uid)?{...c,tapped:true}:c);
}

// costReduce の軽減元がどのゾーンにいれば有効か（未指定時の既定）
// バトルゾーン＋シールドゾーンの表向きカード（=継続能力が有効な場所）
export const COST_REDUCE_DEFAULT_ZONES = ["bz", "shield"];

// 軽減元になりうるカードを {card, zone} の形で集める。
// source は プレイヤー状態オブジェクト（推奨）か、後方互換のバトルゾーン配列。
export function collectCostReduceSources(source) {
  if (!source) return [];
  if (Array.isArray(source)) return source.map(c => ({ card: c, zone: "bz" }));
  const out = [];
  for (const c of source.battle || []) out.push({ card: effectiveCard(c), zone: "bz" });
  for (const c of source.shields || []) if (c.faceUp) out.push({ card: effectiveCard(c), zone: "shield" });
  for (const c of source.mana   || []) out.push({ card: c, zone: "mana" });
  for (const c of source.grave  || []) out.push({ card: c, zone: "grave" });
  for (const c of source.hand   || []) out.push({ card: c, zone: "hand" });
  return out;
}

// カードのフィルタ判定（gameLogic 内で完結。engine/effects の matchFilter と同じ語彙のうち、
// ctx(変数参照)を必要としないものだけを扱う）
// civ / raceContains / nameContains / keyword / type は配列で書くと「いずれか」(OR) になる
const anyOf = (v, test) => (Array.isArray(v) ? v.some(test) : test(v));

function matchesType(card, t) {
  if (t === "creature") return card.type === "creature" || card.type === "evo_creature";
  if (t === "nonCreature") return !(card.type === "creature" || card.type === "evo_creature");
  if (t === "nonEvoCreature") return card.type === "creature";
  if (t === "element") return isElement(card);
  return card.type === t;
}

export function matchCardFilter(card, filter) {
  if (!filter) return true;
  if (filter.raceContains && !anyOf(filter.raceContains, x => !!card.race?.includes(x))) return false;
  if (filter.nameContains && !anyOf(filter.nameContains, x => !!card.name?.includes(x))) return false;
  if (filter.civ && !anyOf(filter.civ, x => getCardCivs(card).includes(x))) return false;
  if (filter.keyword && !anyOf(filter.keyword, x => hasKeyword(card, x))) return false;
  if (filter.multiColor && !(Array.isArray(card.civ) && card.civ.length >= 2)) return false;
  if (filter.creatureOnly && !(card.type === "creature" || card.type === "evo_creature")) return false;
  if (filter.type && !anyOf(filter.type, t => matchesType(card, t))) return false;
  if (filter.maxCost != null && !(card.cost <= filter.maxCost)) return false;
  if (filter.minCost != null && !(card.cost >= filter.minCost)) return false;
  return true;
}
const costReduceMatches = matchCardFilter;

// ゾーン内の該当カード枚数（costReduce.amountPer 等、「〜1枚につき」の分母）
export function countCardsInZone(state, spec) {
  if (!state || !spec) return 0;
  const list = { grave: state.grave, mana: state.mana, hand: state.hand,
                 bz: state.battle, shield: state.shields, deck: state.deck }[spec.zone] || [];
  return list.filter(c => matchCardFilter(c, spec.filter)).length;
}

// amountPer の分母。zone:"evolutionBase" は「今回の召喚で実際に重ねる進化元の数」を参照するので、
// ゾーンではなく opts から取る（プレイ時にしか決まらない値）。
function amountPerCount(ownerState, spec, opts) {
  if (spec?.zone === "evolutionBase") return opts?.evolutionBaseCount || 0;
  return countCardsInZone(ownerState, spec);
}

// card をプレイする際の実効コスト。
// source: プレイヤー状態（複数ゾーンの軽減元を見る）／配列（旧: バトルゾーンのみ）
// opts.evolutionBaseCount: 今回の召喚で重ねる進化元の枚数（進化元を選ぶ前は最大値を渡す）
export function getEffectiveCost(card, source, opts = {}) {
  const sources = collectCostReduceSources(source);
  if (sources.length === 0) return card.cost;
  const ownerState = Array.isArray(source) ? null : source;
  let cost = card.cost;
  for (const { card: c, zone } of sources) {
    if (!c.costReduce) continue;
    const { amount, amountPer, filter, min, zones } = c.costReduce;
    if (!(zones || COST_REDUCE_DEFAULT_ZONES).includes(zone)) continue;
    // filter.self: 「このクリーチャーの召喚コストを〜」= 軽減元自身にだけ効く
    if (filter?.self && c.uid !== card.uid) continue;
    if (!costReduceMatches(card, filter)) continue;
    // amountPer: 「〜1枚につき1少なくする」のような可変軽減
    const n = amountPer ? amountPerCount(ownerState, amountPer, opts) : (amount || 0);
    cost = Math.max(min ?? 0, cost - n);
  }
  // 下限は文明数（2色カードは各文明のマナを最低1つずつ支払う必要があるため）
  return Math.max(cost, getCardCivs(card).length);
}

export function extractManyFromBattle(battle, uids) {
  const uidSet = new Set(uids);
  const extracted = [];
  battle.forEach(card => {
    if (!uidSet.has(card.uid)) return;
    extracted.push(...[card, ...(card.evolutionBase || [])].map(({evolutionBase, ...c}) => c));
  });
  return { newBattle: battle.filter(c => !uidSet.has(c.uid)), extracted };
}

export function extractFromBattle(battle, uid) {
  return extractManyFromBattle(battle, [uid]);
}

// S・トリガーとして唱えられる面を返す（無ければ null）。
// ツインパクトは呪文面だけが「S・トリガー」を持つことがあるので、その場合は呪文面を返す。
export function sTriggerSide(card) {
  if (!card) return null;
  if (hasKeyword(card, "sTrigger")) return card;
  if (card.spellSide?.keywords?.includes("sTrigger")) return { ...card, ...card.spellSide, uid: card.uid };
  return null;
}

// 「エレメント」= クリーチャー(進化含む)またはタマシード
export function isElement(card){ return card.type === "creature" || card.type === "evo_creature" || card.type === "tamaseed"; }

// ===========================
// 超魂X (SSX / Super Soul Cross)
// ssx に書いた能力は、そのカードが持つ「通常の能力」（keywords/triggers 等と同じ扱い）。
// SSX 固有のルールは1つだけ:
//   このカードがクリーチャーの「下」に置かれている間、その上のクリーチャーもこの能力を持つ。
// ssx には任意の"能力フィールド"を書ける（keywords/triggers/activated/costReduce/
// condPower/grantKeywords/powerAttacker/poweredBreaker ...）。
// ===========================

// ssx でマージしない「カードの同一性」に関わるフィールド
const IDENTITY_KEYS = new Set(["id","uid","name","cost","power","civ","type","race","effect","ssx","evolutionBase"]);

// 自身の通常フィールド + 自身のssx + 下に敷かれたカードのssx をマージした「実効カード」
export function effectiveCard(card){
  if(!card) return card;
  const layers=[card.ssx, ...((card.evolutionBase||[]).map(u=>u.ssx))].filter(Boolean);
  if(layers.length===0) return card;
  const out={...card};
  for(const layer of layers){
    for(const [k,v] of Object.entries(layer)){
      if(IDENTITY_KEYS.has(k)) continue;
      if(Array.isArray(v))            out[k]=[...(Array.isArray(out[k])?out[k]:[]), ...v];
      else if(typeof v==="number")    out[k]=(typeof out[k]==="number"?out[k]:0)+v;
      else if(typeof v==="boolean")   out[k]=out[k]||v;
      else                            out[k]=out[k] ?? v;
    }
  }
  return out;
}

// 表示用: 超魂X由来のキーワード（自身のssx + 下のカードのssx）
export function ssxKeywords(card){
  if(!card) return [];
  const out=[...(card.ssx?.keywords || [])];
  for(const under of card.evolutionBase || []) out.push(...(under.ssx?.keywords || []));
  return out;
}
// カードが持つ誘発能力（通常 + 超魂X）
export function getCardTriggers(card){ return effectiveCard(card)?.triggers || []; }
// カードが持つ起動型能力（通常 + 超魂X）
export function getCardActivated(card){ return effectiveCard(card)?.activated || []; }
// カードが持つキーワード判定（通常 + 超魂X + 一時付与）。
// 他カードからの継続付与は computeGrantedKeywords を併用すること。
export function hasKeyword(card, kw){
  const ec=effectiveCard(card);
  return !!ec?.keywords?.includes(kw) || !!card?.tempBuff?.keywords?.includes(kw);
}
// このクリーチャーに含まれるカードの枚数（自身 + 下に敷かれたカード）
export function stackCount(card){ return 1 + (card?.evolutionBase?.length || 0); }

// ブレイク枚数: T/W・ブレイカー、パワード・ブレイカー（パワー6000ごとに1つ）を考慮
export function getBreakCount(card, effPower, extraKeywords = []) {
  const ec = effectiveCard(card);
  const kw = [...(ec.keywords || []), ...(card.tempBuff?.keywords || []), ...extraKeywords,
              ...((card.hyperMode && ec.hyperKeywords) || [])];
  let n = 1;
  if (kw.includes("tBreaker")) n = Math.max(n, 3);
  else if (kw.includes("wBreaker")) n = Math.max(n, 2);
  if (ec.poweredBreaker) n = Math.max(n, Math.max(1, Math.floor((effPower || 0) / 6000)));
  return n;
}

// ===========================
// 敗北の置換（「〜でゲームに負ける時、かわりに勝つ」）
// 能力フィールドなので ssx にも書ける。バトルゾーン＋表向きシールドで有効。
//   replaceLose: [{ from: "deckOut", to: "win", label }]
// 置換は必ず例外処理で中止できる形で提示すること（BattleScreen の ReplacementModal）。
// ===========================
export const LOSE_CAUSES = ["deckOut"];

export function findLoseReplacement(ownerState, cause) {
  if (!ownerState) return null;
  const sources = [...(ownerState.battle || []), ...((ownerState.shields || []).filter(s => s.faceUp))];
  for (const c of sources) {
    for (const rule of effectiveCard(c).replaceLose || []) {
      if ((rule.from || "deckOut") === cause) return { card: c, rule };
    }
  }
  return null;
}

// ===========================
// 進化（進化元のゾーンと枚数）
// 通常の進化はバトルゾーンのクリーチャー1体を進化元にするが、墓地進化 / マナ進化 /
// 墓地進化GV(3体) / 超無限墓地進化(1体以上) のように、ゾーンと枚数が変わるものがある。
//   evolution: { zone:"bz"|"grave"|"mana", count:N | min:N, filter:{…} }
// 進化元は「バトルゾーンに出た」ことにならない（battle を経由せず evolutionBase に直接積む）。
// ===========================
export const EVOLUTION_ZONES = ["bz", "grave", "mana"];

// evolution を正規化。zone 既定 "bz" / count 既定 1 / min を書くと「min枚以上、上限なし」
export function evolutionSpec(card) {
  const e = card?.evolution;
  if (!e) return null;
  const zone = EVOLUTION_ZONES.includes(e.zone) ? e.zone : "bz";
  const min = typeof e.min === "number" ? e.min : null;
  return { zone, min, count: min != null ? null : (e.count ?? 1), filter: e.filter || null };
}

// 進化の呼び名（UI表示用）
export function evolutionLabel(spec) {
  if (!spec) return "進化";
  const base = spec.zone === "grave" ? "墓地進化" : spec.zone === "mana" ? "マナ進化" : "進化";
  if (spec.min != null) return `超無限${base}`;
  if (spec.count >= 3) return `${base}GV`;
  return base;
}

// 進化元の候補。マナゾーンはタップ状態を問わない。進化元は常にクリーチャー限定。
export function evolutionCandidates(card, ownerState) {
  const spec = evolutionSpec(card);
  if (!spec || !ownerState) return [];
  const list = spec.zone === "grave" ? ownerState.grave : spec.zone === "mana" ? ownerState.mana : ownerState.battle;
  return (list || []).filter(c =>
    (c.type === "creature" || c.type === "evo_creature") && matchCardFilter(c, spec.filter)
  );
}

// 進化元に必要な枚数（min 指定なら最低枚数）
export function evolutionNeeded(spec) { return spec ? (spec.min != null ? spec.min : spec.count) : 0; }

// 進化元が足りているか
export function canEvolve(card, ownerState) {
  const spec = evolutionSpec(card);
  if (!spec) return true;
  return evolutionCandidates(card, ownerState).length >= evolutionNeeded(spec);
}

// 今このカードを進化させるとき、重ねられる進化元の最大枚数。
// count 指定はちょうどその枚数（足りなければ進化自体できないので0）、min 指定は候補すべて。
// 「進化元1体につきコスト-1」の軽減を、進化元を選ぶ前に見積もるのに使う。
export function maxEvolutionBases(card, ownerState) {
  const spec = evolutionSpec(card);
  if (!spec) return 0;
  const n = evolutionCandidates(card, ownerState).length;
  if (spec.min != null) return n >= spec.min ? n : 0;
  return n >= spec.count ? spec.count : 0;
}

// ===========================
// 召喚元ゾーンの拡張（墓地・マナゾーンからの召喚）
// 通常、クリーチャーは手札からしか召喚できない。summonFrom / turnSummonFrom はその許可を追加する。
// 「召喚」なので コストは通常どおり支払い、召喚酔いも付き、creaturePutBz(method:"summon") が誘発する。
//   - summonFrom     : 継続能力。バトルゾーン＋表向きシールドで有効（ssx にも書ける＝下のカードから伝播）
//   - turnSummonFrom : そのターン限りの許可（効果 grantSummonFrom が積み、ターン終了時に消える）
// ===========================
export const SUMMON_ZONES = ["grave", "mana"];

// 今この瞬間に有効な召喚許可を集める。isOwnTurn=false なら timing:"any" のものだけ。
export function collectSummonPermissions(ownerState, isOwnTurn) {
  if (!ownerState) return [];
  const out = [];
  const add = (perm, key) => {
    if (!perm?.zone || !SUMMON_ZONES.includes(perm.zone)) return;
    if ((perm.timing || "ownTurn") === "ownTurn" && !isOwnTurn) return;
    out.push({ ...perm, key });
  };
  const fromCard = c => effectiveCard(c).summonFrom?.forEach((p, i) => add(p, `${c.uid}#sf${i}`));
  for (const c of ownerState.battle || []) fromCard(c);
  for (const c of ownerState.shields || []) if (c.faceUp) fromCard(c);
  (ownerState.turnSummonFrom || []).forEach((p, i) => add(p, `turn#sf${i}`));
  return out;
}

// card（zone にあるカード）を召喚できる許可を1つ返す。無ければ null。
// usedCounts: { [perm.key]: そのターンに使った回数 }
export function summonPermissionFor(card, zone, perms, usedCounts = {}) {
  if (!card || !(card.type === "creature" || card.type === "evo_creature")) return null;
  return perms.find(p =>
    p.zone === zone &&
    (p.maxPerTurn == null || (usedCounts[p.key] || 0) < p.maxPerTurn) &&
    matchCardFilter(card, p.filter)
  ) || null;
}

// シビルカウント: 自分の指定文明の「クリーチャーまたはタマシード」の数
// （バトルゾーン＋シールドゾーンの表向きカードを数える。種別非依存で faceUp を見る）
export function civicCount(state, civ){
  if(!state) return 0;
  const match = c => isElement(c) && getCardCivs(c).includes(civ);
  const inBattle = (state.battle || []).filter(match).length;
  const inShield = (state.shields || []).filter(c => c.faceUp && match(c)).length;
  return inBattle + inShield;
}

// grant規則やパワー強化に付く condition の評価
export function checkGrantCondition(cond, ownerState, card){
  if(!cond) return true;
  if(cond.type === "civicCount") return civicCount(ownerState, cond.civ) >= cond.count;
  if(cond.type === "stackCount") return stackCount(card) >= cond.count;
  if(cond.flag) return !!ownerState?.[cond.flag];
  return true;
}

export function getEffectivePower(card, ownerState, allOwnBattle, opts = {}) {
  const ec = effectiveCard(card);
  let power = (card.hyperMode && ec.hyperPower != null) ? ec.hyperPower : (card.power || 0);
  power += card.tempBuff?.power || 0;
  // パワーアタッカー+N（攻撃中のみ）
  if (opts.attacking && ec.powerAttacker) power += ec.powerAttacker;
  if (ec.selfPowerBoostGrave) {
    const { civFilter, perCard } = ec.selfPowerBoostGrave;
    const count = (ownerState.grave || []).filter(c => getCardCivs(c).includes(civFilter)).length;
    power += count * perCard;
  }
  // 自身の条件付きパワー強化（例: シビルカウント5で +10000 / スタック3枚以上で +N）
  for (const cp of (ec.condPower || [])) {
    if (checkGrantCondition(cp.condition, ownerState, card)) power += cp.amount || 0;
  }
  for (const ally of (allOwnBattle || [])) {
    if (!ally.grantPowerBoost || ally.uid === card.uid) continue;
    const { amount, filter, condition } = ally.grantPowerBoost;
    if (condition && !checkGrantCondition(condition, ownerState, ally)) continue;
    if (filter?.raceContains && !card.race?.includes(filter.raceContains)) continue;
    power += amount;
  }
  for (const ally of (allOwnBattle || [])) {
    if (!ally.grantPowerBoostGrave || ally.uid === card.uid) continue;
    const { civFilter, perCard, filter } = ally.grantPowerBoostGrave;
    if (filter?.raceContains && !card.race?.includes(filter.raceContains)) continue;
    const count = (ownerState.grave || []).filter(c => getCardCivs(c).includes(civFilter)).length;
    power += count * perCard;
  }
  return power;
}

// ownerState を渡すと condition(civicCount等) と表向きシールドの付与源も評価できる。
// 後方互換: battleZone のみでも動作（その場合 condition は battle だけで評価、表向きシールド源は無し）。
export function computeGrantedKeywords(card, battleZone, ownerState) {
  const granted = [...(card.tempBuff?.keywords || []), ...ssxKeywords(card)];
  const evalCard = effectiveCard(card);
  const zone = battleZone || ownerState?.battle;
  if (!zone) return granted;
  const evalState = ownerState || { battle: zone, shields: [] };
  // 付与源: バトルゾーンの全カード＋シールドゾーンの表向きカード（種別非依存で faceUp を見る）
  const granters = [...zone, ...((ownerState?.shields || []).filter(s => s.faceUp))].map(effectiveCard);
  for (const granter of granters) {
    if (!granter.grantKeywords) continue;
    for (const rule of granter.grantKeywords) {
      if (rule.condition && !checkGrantCondition(rule.condition, evalState, granter)) continue;
      if (rule.filter?.raceContains && !evalCard.race?.includes(rule.filter.raceContains)) continue;
      if (rule.filter?.multiColor && !(Array.isArray(card.civ) && card.civ.length >= 2)) continue;
      if (rule.filter?.notSelf && granter.uid === card.uid) continue;
      if (rule.filter?.nameContains && !card.name?.includes(rule.filter.nameContains)) continue;
      if (rule.filter?.elementOnly && !isElement(card)) continue;
      if (!granted.includes(rule.keyword)) granted.push(rule.keyword);
    }
  }
  return granted;
}

// autoEffect inference from keywords/effect text
export function inferAutoEffect(keywords, effectText) {
  if(keywords.includes("sTrigger") && effectText.includes("引く")) return { trigger:"cast", type:"draw", amount:3 };
  if(keywords.includes("sTrigger") && effectText.includes("タップ")) return { trigger:"cast", type:"tapAll", target:"opponent" };
  if(keywords.includes("sTrigger") && effectText.includes("破壊")) return { trigger:"cast", type:"destroy", target:"opponent", amount:1 };
  if(keywords.includes("sTrigger") && effectText.includes("マナゾーンに置く") && effectText.includes("相手")) return { trigger:"cast", type:"sendToMana", target:"opponent", amount:1 };
  if(keywords.includes("sTrigger") && effectText.includes("手札に戻")) return { trigger:"cast", type:"bounce", target:"opponent", amount:1 };
  if(keywords.includes("sTrigger") && effectText.includes("マナゾーンに置く") && !effectText.includes("相手")) return { trigger:"cast", type:"deckToMana", amount:1 };
  if(effectText.includes("出たとき") && effectText.includes("引く")) return { trigger:"play", type:"draw", amount:1 };
  if(effectText.includes("出たとき") && effectText.includes("マナゾーンのカード") && effectText.includes("手札")) return { trigger:"play", type:"manaReturn", target:"self", amount:1, optional:true };
  if(effectText.includes("手札を全て見て") && effectText.includes("捨て")) return { trigger:"cast", type:"handDestroy", amount:2, target:"opponent" };
  if(effectText.includes("手札に加える") && effectText.includes("マナ")) return { trigger:"cast", type:"manaReturn", target:"self", amount:1 };
  return null;
}
