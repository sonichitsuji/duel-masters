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

export function canPayCost(mana,card,costSource){
  const effectiveCost=costSource?getEffectiveCost(card,costSource):card.cost;
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
  for (const c of source.battle || []) out.push({ card: c, zone: "bz" });
  for (const c of source.shields || []) if (c.faceUp) out.push({ card: c, zone: "shield" });
  for (const c of source.mana   || []) out.push({ card: c, zone: "mana" });
  for (const c of source.grave  || []) out.push({ card: c, zone: "grave" });
  for (const c of source.hand   || []) out.push({ card: c, zone: "hand" });
  return out;
}

// costReduce.filter の判定（gameLogic 内で完結。engine/effects へは依存しない）
function costReduceMatches(card, filter) {
  if (!filter) return true;
  if (filter.raceContains && !card.race?.includes(filter.raceContains)) return false;
  if (filter.nameContains && !card.name?.includes(filter.nameContains)) return false;
  if (filter.civ && !getCardCivs(card).includes(filter.civ)) return false;
  if (filter.keyword && !hasKeyword(card, filter.keyword)) return false;
  if (filter.multiColor && !(Array.isArray(card.civ) && card.civ.length >= 2)) return false;
  if (filter.type) {
    if (filter.type === "creature") { if (!(card.type === "creature" || card.type === "evo_creature")) return false; }
    else if (filter.type === "nonCreature") { if (card.type === "creature" || card.type === "evo_creature") return false; }
    else if (filter.type === "element") { if (!isElement(card)) return false; }
    else if (card.type !== filter.type) return false;
  }
  if (filter.maxCost != null && !(card.cost <= filter.maxCost)) return false;
  return true;
}

// card をプレイする際の実効コスト。
// source: プレイヤー状態（複数ゾーンの軽減元を見る）／配列（旧: バトルゾーンのみ）
export function getEffectiveCost(card, source) {
  const sources = collectCostReduceSources(source);
  if (sources.length === 0) return card.cost;
  let cost = card.cost;
  for (const { card: c, zone } of sources) {
    if (!c.costReduce) continue;
    const { amount, filter, min, zones } = c.costReduce;
    if (!(zones || COST_REDUCE_DEFAULT_ZONES).includes(zone)) continue;
    if (!costReduceMatches(card, filter)) continue;
    cost = Math.max(min ?? 0, cost - amount);
  }
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

// 「エレメント」= クリーチャー(進化含む)またはタマシード
export function isElement(card){ return card.type === "creature" || card.type === "evo_creature" || card.type === "tamaseed"; }

// ===========================
// 超魂X (SSX / Super Soul Cross)
// ssx に書いた能力は、そのカードが持つ「通常の能力」（keywords/triggers と同じ扱い）。
// SSX 固有のルールは1つだけ:
//   このカードがクリーチャーの「下」に置かれている間、その上のクリーチャーもこの能力を持つ。
// データ形: "ssx": { "keywords":[...], "triggers":[...] }
// ===========================
export function ssxKeywords(card){
  if(!card) return [];
  const out=[...(card.ssx?.keywords || [])];
  for(const under of card.evolutionBase || []) out.push(...(under.ssx?.keywords || []));
  return out;
}
export function ssxTriggers(card){
  if(!card) return [];
  const out=[...(card.ssx?.triggers || [])];
  for(const under of card.evolutionBase || []) out.push(...(under.ssx?.triggers || []));
  return out;
}
// カードが持つ誘発能力（通常 + 超魂X + 下にあるカードの超魂X）
export function getCardTriggers(card){
  return [...(card?.triggers || []), ...ssxTriggers(card)];
}
// カードが持つキーワード判定（通常 + 超魂X(自身/下のカード) + 一時付与）。
// 他カードからの継続付与は computeGrantedKeywords を併用すること。
export function hasKeyword(card, kw){
  return !!card?.keywords?.includes(kw) || ssxKeywords(card).includes(kw) || !!card?.tempBuff?.keywords?.includes(kw);
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
export function checkGrantCondition(cond, ownerState){
  if(!cond) return true;
  if(cond.type === "civicCount") return civicCount(ownerState, cond.civ) >= cond.count;
  if(cond.flag) return !!ownerState?.[cond.flag];
  return true;
}

export function getEffectivePower(card, ownerState, allOwnBattle) {
  let power = (card.hyperMode && card.hyperPower != null) ? card.hyperPower : (card.power || 0);
  power += card.tempBuff?.power || 0;
  if (card.selfPowerBoostGrave) {
    const { civFilter, perCard } = card.selfPowerBoostGrave;
    const count = (ownerState.grave || []).filter(c => getCardCivs(c).includes(civFilter)).length;
    power += count * perCard;
  }
  // 自身の条件付きパワー強化（例: シビルカウント5で +10000）
  for (const cp of (card.condPower || [])) {
    if (checkGrantCondition(cp.condition, ownerState)) power += cp.amount || 0;
  }
  for (const ally of (allOwnBattle || [])) {
    if (!ally.grantPowerBoost || ally.uid === card.uid) continue;
    const { amount, filter, condition } = ally.grantPowerBoost;
    if (condition && !checkGrantCondition(condition, ownerState)) continue;
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
  const zone = battleZone || ownerState?.battle;
  if (!zone) return granted;
  const evalState = ownerState || { battle: zone, shields: [] };
  // 付与源: バトルゾーンの全カード＋シールドゾーンの表向きカード（種別非依存で faceUp を見る）
  const granters = [...zone, ...((ownerState?.shields || []).filter(s => s.faceUp))];
  for (const granter of granters) {
    if (!granter.grantKeywords) continue;
    for (const rule of granter.grantKeywords) {
      if (rule.condition && !checkGrantCondition(rule.condition, evalState)) continue;
      if (rule.filter?.raceContains && !card.race?.includes(rule.filter.raceContains)) continue;
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
