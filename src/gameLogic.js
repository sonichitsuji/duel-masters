import { CIV, CIVS } from "./constants";

// ===========================
// HELPERS
// ===========================
let _uid = 1;
export const mkUid = () => `c${_uid++}`;
// 同梱カードは 1〜200、ユーザーが追加したカードは 201〜 を使う
let _cardId = 200;
export const mkCardId = () => ++_cardId;
// 保存済みDBを読み直した後に呼ぶ。既存の最大idより後ろから採番を再開する
export function syncCardIdSeed(cardDb) {
  for (const c of cardDb || []) if (Number.isFinite(c?.id) && c.id > _cardId) _cardId = c.id;
}

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
  return {deck:deck.slice(10),hand:deck.slice(5,10),shields:deck.slice(0,5),battle:[],mana:[],grave:[],hyper:[]};
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

// カードに印刷されている名前。ツインパクトは「クリーチャー名 / 呪文名」の1枚のカードなので、
// 表示では両面の名前を並べる。card.name（クリーチャー面の名前）は識別子として使い続けるので、
// ログや nameContains の判定はこれを通さないこと。
export function cardDisplayName(card){
  if(!card) return "";
  if(card.type==="twinpact"&&card.spellSide?.name) return `${card.name} / ${card.spellSide.name}`;
  return card.name || "";
}

// マナゾーンに置かれたカードが供給する文明。
// ツインパクトはバトルゾーン以外では両方の面の特性を持つので、
// マナゾーンではクリーチャー面と呪文面の**どちらの文明としても**使える。
export function getManaCivs(card){
  const civs=getCardCivs(card);
  if(card?.type!=="twinpact"||!card.spellSide?.civ) return civs;
  const spell=Array.isArray(card.spellSide.civ)?card.spellSide.civ:[card.spellSide.civ];
  return [...new Set([...civs,...spell])].sort((a,b)=>CIVS.indexOf(a)-CIVS.indexOf(b));
}

export function canPayCost(mana,card,costSource,opts={}){
  const effectiveCost=costSource?getEffectiveCost(card,costSource,opts):card.cost;
  const untapped=mana.filter(c=>!c.tapped);
  if(untapped.length<effectiveCost) return {ok:false,reason:`マナ不足 (必要:${effectiveCost} / 利用可能:${untapped.length})`};
  if(effectiveCost===0) return {ok:true};
  // 無色は文明ではないので、特定の文明のマナを要求しない（コストの数だけ払えばよい）
  const civs=getCardCivs(card).filter(civ=>civ!=="colorless");
  for(const civ of civs){
    if(!untapped.some(c=>getManaCivs(c).includes(civ))){
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

// ツインパクトは「クリーチャーであり呪文でもある」。どちらの特性も参照できるので、
// 「墓地からクリーチャーを手札に戻す」でも「墓地から呪文を唱える」でも対象になる。
// ただしプレイ中はどちらの面かが確定するので、その時は card.side("creature"/"spell") を見る。
// （バトルゾーンのツインパクトも side を持たないため type:"spell" に一致するが、
//   バトルゾーンの呪文を探す効果は存在しないため実害はない）
export function isCreatureSide(card) {
  if (card.side) return card.side === "creature";
  return card.type === "creature" || card.type === "evo_creature" || card.type === "twinpact";
}
function isSpellSide(card) {
  if (card.side) return card.side === "spell";
  return card.type === "spell" || card.type === "twinpact";
}
function matchesType(card, t) {
  if (t === "creature") return isCreatureSide(card);
  if (t === "nonCreature") return !isCreatureSide(card);
  if (t === "nonEvoCreature") return card.side ? card.side === "creature"
                                               : (card.type === "creature" || card.type === "twinpact");
  if (t === "element") return isElement(card);
  if (t === "spell") return isSpellSide(card);
  return card.type === t;
}

export function matchCardFilter(card, filter) {
  if (!filter) return true;
  // side: ツインパクトのどちらの面としてプレイしているか（"creature" / "spell"）
  if (filter.side && card.side !== filter.side) return false;
  if (filter.raceContains && !anyOf(filter.raceContains, x => !!card.race?.includes(x))) return false;
  if (filter.nameContains && !anyOf(filter.nameContains, x => !!card.name?.includes(x))) return false;
  if (filter.civ && !anyOf(filter.civ, x => getCardCivs(card).includes(x))) return false;
  if (filter.keyword && !anyOf(filter.keyword, x => hasKeyword(card, x))) return false;
  if (filter.multiColor && !(Array.isArray(card.civ) && card.civ.length >= 2)) return false;
  if (filter.creatureOnly && !isCreatureSide(card)) return false;
  if (filter.type && !anyOf(filter.type, t => matchesType(card, t))) return false;
  // cost はちょうどその値（「選んだ数字と同じコストの呪文」等）。matchFilter と同じ語彙
  if (filter.cost != null && card.cost !== filter.cost) return false;
  if (filter.maxCost != null && !(card.cost <= filter.maxCost)) return false;
  if (filter.minCost != null && !(card.cost >= filter.minCost)) return false;
  if (filter.maxPower != null && !((card.power || 0) <= filter.maxPower)) return false;
  if (filter.minPower != null && !((card.power || 0) >= filter.minPower)) return false;
  if (filter.hasCip != null && hasPlayTrigger(card) !== !!filter.hasCip) return false;
  // psychic: サイキック・クリーチャーかどうか。matchFilter と同じ語彙
  if (filter.psychic != null && !!card.psychic !== !!filter.psychic) return false;
  // not: 「〜ではない」。1つでも一致したら弾く（配列なら「そのどれにも当てはまらない」）
  if (filter.not && anyOf(filter.not, sub => matchCardFilter(card, sub))) return false;
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
    const { amount, amountPer, filter, min, zones, condition } = c.costReduce;
    if (!(zones || COST_REDUCE_DEFAULT_ZONES).includes(zone)) continue;
    // filter.self: 「このクリーチャーの召喚コストを〜」= 軽減元自身にだけ効く
    if (filter?.self && c.uid !== card.uid) continue;
    if (!costReduceMatches(card, filter)) continue;
    // condition:「〜であれば」。継続能力なので相手の盤面は見られない（who:"self" 相当）
    if (condition && !checkGrantCondition(condition, ownerState, c)) continue;
    // amountPer: 「〜1枚につき1少なくする」のような可変軽減
    const n = amountPer ? amountPerCount(ownerState, amountPer, opts) : (amount || 0);
    cost = Math.max(min ?? 0, cost - n);
  }
  // 下限は文明数（2色カードは各文明のマナを最低1つずつ支払う必要があるため）。
  // 無色は文明ではないので数えない
  return Math.max(cost, getCardCivs(card).filter(civ=>civ!=="colorless").length);
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

// S・トリガーとして実行できる面を返す（無ければ null）。
// ツインパクトは呪文面だけが「S・トリガー」を持つことがあるので、その場合は呪文面を返す。
// ownerState を渡すと「革命2：〜このカードに『S・トリガー』を与える」（grantSelfSTrigger）も見る。
// シールドの枚数を見る条件なので、判定は「手札に加わった後」の状態で行うこと。
export function sTriggerSide(card, ownerState) {
  if (!card) return null;
  if (hasKeyword(card, "sTrigger") || selfSTriggerGranted(card, ownerState)) return card;
  if (card.spellSide?.keywords?.includes("sTrigger")) return { ...card, ...card.spellSide, uid: card.uid, side: "spell" };
  return null;
}

// 革命n:「自分のシールドゾーンから手札に加えるこのカードに『S・トリガー』を与える」。
// 通常の grantKeywords はバトルゾーン＋表向きシールドしか見ないので、そこには乗せられない。
//   grantSelfSTrigger: { condition: { type:"shieldCount", who:"self", max:2 } }
export function selfSTriggerGranted(card, ownerState) {
  const rule = effectiveCard(card)?.grantSelfSTrigger;
  if (!rule || !ownerState) return false;
  return checkGrantCondition(rule.condition, ownerState, card);
}

// 革命チェンジ:「自分の指定のクリーチャーが攻撃する時、そのクリーチャーと
// 手札にあるこのクリーチャーを入れ替えてもよい」。入れ替えられる手札のカードを返す。
//   revolutionChangeCond: { civs?, race?/races?, minCost?, minPower?, multiColor?, nameContains? }
export function revolutionChangeCandidates(attacker, ownerState) {
  if (!attacker || !ownerState) return [];
  // 入れ替える効果は、そのクリーチャーを構成するカードがすべて手札に戻らない状況では実行されない。
  // G-NEO進化クリーチャーは離れる時に下のカードが身代わりになるので、革命チェンジできない
  // （進化元が0枚なら G-NEOクリーチャー扱いで、この制限はかからない）
  if (isGNeoEvolution(attacker)) return [];
  const attackerCivs = getCardCivs(attacker);
  const attackerPower = getEffectivePower(attacker, ownerState, ownerState.battle);
  return (ownerState.hand || []).filter(c => {
    if (!hasKeyword(c, "revolutionChange") || !c.revolutionChangeCond) return false;
    const cond = c.revolutionChangeCond;
    if (cond.civs?.length && !cond.civs.some(cv => attackerCivs.includes(cv))) return false;
    if (cond.races ? !cond.races.some(r => attacker.race?.includes(r))
                   : cond.race && !attacker.race?.includes(cond.race)) return false;
    if (cond.minCost && !(attacker.cost >= cond.minCost)) return false;
    if (cond.minPower && !(attackerPower >= cond.minPower)) return false;
    if (cond.nameContains && !attacker.name?.includes(cond.nameContains)) return false;
    if (cond.multiColor && !(Array.isArray(attacker.civ) && attacker.civ.length >= 2)) return false;
    return true;
  });
}

// 「エレメント」= クリーチャー(進化・ツインパクトのクリーチャー面を含む)またはタマシード
export function isElement(card){ return card.type === "creature" || card.type === "evo_creature" || card.type === "tamaseed" || card.type === "field" || (card.type === "twinpact" && card.side !== "spell"); }

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

// 「能力を無視する」で消えるフィールド。
// 名前・コスト・パワー・文明・種族・種別は能力ではないので残り、能力だけが消える。
// ssx（下のカードから伝播する能力）と tempBuff（他のカードから与えられた能力）も、
// 「そのエレメントが持つ能力」なので一緒に消える。
// evolutionBase は能力ではなくカードの構成なので残す（進化クリーチャーであることは変わらない）。
const ABILITY_FIELDS = ["keywords","triggers","activated","ssx","tempBuff",
  "summonFrom","freeCast","replaceLose","replaceLeave","spellAfterCast","staticDeny",
  "costReduce","condPower","grantKeywords","grantPowerBoost","grantPowerBoostGrave",
  "selfPowerBoostGrave","powerAttacker","poweredBreaker","hyperKeywords","hyperPower",
  "hyperOnAttack","hyperOnTargeted","hyperUnlock","grantSelfSTrigger","oniEnd","ddd","gZero",
  "revolutionChangeCond","finalRevolution","alternateCost","reactivePassive","endOfTurnEffect",
  "replaceEnter"];

// 自身の通常フィールド + 自身のssx + 下に敷かれたカードのssx をマージした「実効カード」。
// 能力の読み出しはほぼすべてこの関数を通るので、「能力を無視されている」間は
// 能力フィールドを落とした形を返すだけで、engine 全体に一度に効く。
export function effectiveCard(card){
  if(!card) return card;
  if(card.ignoreAbilities){
    const out={...card};
    for(const k of ABILITY_FIELDS) delete out[k];
    return out;
  }
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
  if(!card||card.ignoreAbilities) return [];
  const out=[...(card.ssx?.keywords || [])];
  for(const under of card.evolutionBase || []) out.push(...(under.ssx?.keywords || []));
  return out;
}
// カードが持つ誘発能力（通常 + 超魂X）
export function getCardTriggers(card){ return effectiveCard(card)?.triggers || []; }
// カードが持つ起動型能力（通常 + 超魂X）
export function getCardActivated(card){ return effectiveCard(card)?.activated || []; }
// 「このクリーチャーが出た時」で始まる能力（cip）を持つか。
// ツインパクトはクリーチャー面の能力を見る（呪文面の triggers は cip ではない）。
export function hasPlayTrigger(card){
  const ec = effectiveCard(card);
  if (!ec) return false;
  return (ec.triggers || []).some(tr =>
    tr.on === "creaturePutBz" && (!tr.target || tr.target === "this"));
}

// 呪文の本体（唱えた時に必ず起きる効果）。triggers の on:"cast" がそれ。
// 誘発型能力ではないので、リゾルバでは kind:"spell" として順序固定で解決する
// （他の誘発と並べて「どれから解決するか」を聞くものではない）。
// ツインパクトを呪文面で唱える時は、呼び出し側が呪文面を渡すこと。
export function spellMainEffect(card){
  return (effectiveCard(card)?.triggers || []).find(tr => tr.on === "cast") || null;
}
// 「このカードが場に出た／置かれた時」の本体。cip は誘発型能力なので
// 通常は fireTrigger("creaturePutBz") が拾うが、クリーチャー以外（城など）は
// その経路を通らないので、自分自身のぶんだけ直接取り出せるようにしてある。
export function selfPutTriggers(card){
  return (effectiveCard(card)?.triggers || [])
    .filter(tr => tr.on === "creaturePutBz" && (!tr.target || tr.target === "this"));
}
// カードが持つキーワード判定（通常 + 超魂X + 一時付与）。
// 他カードからの継続付与は computeGrantedKeywords を併用すること。
export function hasKeyword(card, kw){
  const ec=effectiveCard(card);
  // tempBuff も effectiveCard 越しに読む（能力を無視されている間は与えられた能力も消える）
  return !!ec?.keywords?.includes(kw) || !!ec?.tempBuff?.keywords?.includes(kw);
}
// このクリーチャーに含まれるカードの枚数（自身 + 下に敷かれたカード）
export function stackCount(card){ return 1 + (card?.evolutionBase?.length || 0); }

// ブレイク枚数: T/W・ブレイカー、パワード・ブレイカー（パワー6000ごとに1つ）を考慮
export function getBreakCount(card, effPower, extraKeywords = []) {
  const ec = effectiveCard(card);
  const kw = [...(ec.keywords || []), ...(ec.tempBuff?.keywords || []), ...extraKeywords,
              ...((card.hyperMode && ec.hyperKeywords) || [])];
  let n = 1;
  // ワールド・ブレイカー: シールドをすべてブレイクする（何枚でも足りるよう Infinity を返す）
  if (kw.includes("worldBreaker")) return Infinity;
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

// 「自分のクリーチャーが離れる時、かわりに〜する」の置換元を探す。
// 有効なゾーンはバトルゾーン＋表向きシールド（replaceLose と同じ）。
//   replaceLeave: { to:"mana"|"hand"|"shield"|"deck", filter?, optional? }
// 置換は §0 のとおり必ず例外処理で中止できる形で提示すること。
export function findLeaveReplacement(ownerState, card) {
  if (!ownerState || !card) return null;
  const sources = [...(ownerState.battle || []), ...((ownerState.shields || []).filter(s => s.faceUp))];
  for (const c of sources) {
    const rules = effectiveCard(c).replaceLeave;
    if (!rules) continue;
    for (const rule of (Array.isArray(rules) ? rules : [rules])) {
      // filter.self:「このクリーチャーが離れる時」= 置換元自身にだけ効く（エターナル・Ω）
      if (rule.filter?.self && c.uid !== card.uid) continue;
      if (rule.filter && !matchCardFilter(card, rule.filter)) continue;
      return { card: c, rule };
    }
  }
  return null;
}

// 「自分の墓地から呪文を唱えた後、墓地のかわりに山札の下に置く」の置換元を探す。
// replaceLeave と同じ流儀（バトルゾーン＋表向きシールドで有効／必ず例外処理で中止できる形で提示）。
//   spellAfterCast: [{ from:"grave"|"hand"|"any", to:"deckBottom"|…, filter? }]
//   from = その呪文を唱えたゾーン（既定 "any"）、to = 墓地のかわりの行き先
export const SPELL_AFTER_CAST_TO = ["deckBottom", "deckTop", "hand", "mana", "shield"];

// 出る時の置換（「〜が出る時、かわりに〜に置く」）。
// データ形: replaceEnter: { who?, turnOf?, to, release?, filter? }
//   who    … 出るクリーチャーの持ち主。"self"(既定 both と同じ扱いにしない) / "opponent" / "both"
//   turnOf … 誰のターンか。"self" / "opponent" / "both"（既定）
//   to     … かわりに置く先（いまは "hyper" = 超次元ゾーンのみ）
//   release… "startOfOwnerTurn" なら、次のその持ち主のターンのはじめにそこから出す
//   filter … 出るカードの条件（省略時はクリーチャーすべて）
// who / turnOf はどちらも「置換元のカードの持ち主」から見た関係。
// 置換は §0 のとおり必ず例外処理で中止できる形で提示すること。
export function findEnterReplacement(card, ownerPid, states, activePid) {
  if (!card) return null;
  for (const srcPid of ["p1", "p2"]) {
    const st = states?.[srcPid];
    if (!st) continue;
    const sources = [...(st.battle || []), ...((st.shields || []).filter(c => c.faceUp))];
    for (const c of sources) {
      const rule = effectiveCard(c).replaceEnter;
      if (!rule) continue;
      const isSelf = ownerPid === srcPid;
      const who = rule.who || "both";
      if (who === "self" && !isSelf) continue;
      if (who === "opponent" && isSelf) continue;
      const ownTurn = activePid === srcPid;
      const turnOf = rule.turnOf || "both";
      if (turnOf === "self" && !ownTurn) continue;
      if (turnOf === "opponent" && ownTurn) continue;
      if (rule.filter && !matchCardFilter(card, rule.filter)) continue;
      return { card: c, sourcePid: srcPid, rule };
    }
  }
  return null;
}

// ===========================
// 呪文を唱えられない（ラフルル・ラブ等）
// ===========================
// 2通りある。どちらも「唱えようとする側」から見て理由を1つ返す（唱えられるなら null）。
//   - 期限付き: プレイヤー状態の spellDeny（効果 denySpell が積み、ターン終了時に切れる）
//   - 常在型  : 相手のバトルゾーン／表向きシールドの staticDeny:{ type:"cantCastSpell", filter? }
// ツインパクトは面が確定して初めて呪文になるので、判定は side:"spell" か type:"spell" の時だけ。
export function spellDenyReason(card, ownerState, otherState) {
  if (!card) return null;
  if (!(card.side === "spell" || card.type === "spell")) return null;
  for (const d of ownerState?.spellDeny || []) {
    if (d.filter && !matchCardFilter(card, d.filter)) continue;
    return d.label || "相手の効果により呪文を唱えられない";
  }
  const sources = [...(otherState?.battle || []), ...((otherState?.shields || []).filter(s => s.faceUp))];
  for (const c of sources) {
    const d = effectiveCard(c).staticDeny;
    if (d?.type !== "cantCastSpell") continue;
    if (d.filter && !matchCardFilter(card, d.filter)) continue;
    return d.label || `「${c.name}」により呪文を唱えられない`;
  }
  return null;
}
export function findSpellAfterCast(ownerState, card, fromZone = "hand") {
  if (!ownerState || !card) return null;
  const sources = [...(ownerState.battle || []), ...((ownerState.shields || []).filter(s => s.faceUp))];
  for (const c of sources) {
    const rules = effectiveCard(c).spellAfterCast;
    if (!rules) continue;
    for (const rule of (Array.isArray(rules) ? rules : [rules])) {
      if (rule.from && rule.from !== "any" && rule.from !== fromZone) continue;
      if (rule.filter && !matchCardFilter(card, rule.filter)) continue;
      return { card: c, rule };
    }
  }
  return null;
}

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
//   evolution: { zone:"bz"|"grave"|"mana", count:N | min:N, neo:true|"g", filter:{…} }
// 進化元は「バトルゾーンに出た」ことにならない（battle を経由せず evolutionBase に直接積む）。
//
// NEO進化（neo:true）は「重ねてもよい」＝進化するかしないかが任意。重ねなければ通常の
// クリーチャー（NEOクリーチャー）、重ねれば進化クリーチャー（NEO進化クリーチャー）として扱う。
// そのため type は "creature" のままで、「進化ではないクリーチャー」を指す効果には当たる
// （ドラゴンズ・サインの「進化でないドラゴンを出す」で NEO を出し、出す時に重ねられる）。
// G-NEO進化（neo:"g"）は上記に加えて「離れる時、かわりに下のカードすべてが離れる」。
// ===========================
export const EVOLUTION_ZONES = ["bz", "grave", "mana"];

// evolution を正規化。zone 既定 "bz" / count 既定 1 / min を書くと「min枚以上、上限なし」
export function evolutionSpec(card) {
  const e = card?.evolution;
  if (!e) return null;
  const zone = EVOLUTION_ZONES.includes(e.zone) ? e.zone : "bz";
  const min = typeof e.min === "number" ? e.min : null;
  const neo = e.neo === "g" ? "g" : e.neo ? true : null;
  return { zone, min, neo, count: min != null ? null : (e.count ?? 1), filter: e.filter || null };
}

// 進化の呼び名（UI表示用）
export function evolutionLabel(spec) {
  if (!spec) return "進化";
  if (spec.neo === "g") return "G-NEO進化";
  if (spec.neo) return "NEO進化";
  const base = spec.zone === "grave" ? "墓地進化" : spec.zone === "mana" ? "マナ進化" : "進化";
  if (spec.min != null) return `超無限${base}`;
  if (spec.count >= 3) return `${base}GV`;
  return base;
}

// 「いまこのカードは進化クリーチャーか」。
// NEO は下にカードがある間だけ進化クリーチャーとして扱われるので、カードの型ではなく
// 盤面のカード（evolutionBase を持つ実体）を渡すこと。
export function isEvolutionNow(card) {
  if (!card) return false;
  if (card.type === "evo_creature") return true;
  return !!(evolutionSpec(card)?.neo && card.evolutionBase?.length);
}

// G-NEO進化クリーチャーか（＝除去耐性が働くか）。
// 進化元が0枚なら「G-NEOクリーチャー」であって G-NEO進化クリーチャーではないので耐性は出ない。
export function isGNeoEvolution(card) {
  return evolutionSpec(card)?.neo === "g" && (card?.evolutionBase?.length || 0) > 0;
}

// 召喚酔いしているか。
// summonedThisTurn は「このターンにバトルゾーンへ出た」という事実だけを記録し、
// 進化かどうかの判定はここ（読み出し時）で行う。こうすると NEO進化クリーチャーの進化元が
// 効果で剥がされて0枚になった時に、召喚酔いが復活するという裁定が自然に出る。
// マッハファイターは召喚酔いしていても攻撃できる（ただしクリーチャーしか攻撃できない → §7.15）
// ので、ここでは酔っていない扱いにする。
export function isSummoningSick(card, ownerState, battleZone) {
  if (!card?.summonedThisTurn) return false;
  if (isEvolutionNow(card)) return false;
  const kws = [...(effectiveCard(card).keywords || []), ...ssxKeywords(card),
    ...computeGrantedKeywords(card, battleZone || ownerState?.battle || [], ownerState)];
  return !kws.includes("speedAttacker") && !kws.includes("machFighter");
}

// 進化元の候補。マナゾーンはタップ状態を問わない。進化元は常にクリーチャー限定。
// ツインパクトはクリーチャー側を参照されるので進化元にできる（isCreatureSide）。
export function evolutionCandidates(card, ownerState) {
  const spec = evolutionSpec(card);
  if (!spec || !ownerState) return [];
  const list = spec.zone === "grave" ? ownerState.grave : spec.zone === "mana" ? ownerState.mana : ownerState.battle;
  return (list || []).filter(c => isCreatureSide(c) && matchCardFilter(c, spec.filter));
}

// 進化元に必要な枚数（min 指定なら最低枚数）
export function evolutionNeeded(spec) { return spec ? (spec.min != null ? spec.min : spec.count) : 0; }

// 選ばれた進化元を、そのゾーンから取り除いて「下に敷くカード列」にする。
// 進化元は「バトルゾーンに出た」ことにならないので、battle を経由せず evolutionBase に直接積む。
// 選択順がそのまま重ねる順。進化元がさらに進化元を持っていたら、それも一緒に下へ移る。
// 戻り値の state は取り除いた後のプレイヤー状態（元の state は変更しない）。
export function stackEvolutionBases(state, spec, baseUids) {
  const uids = Array.isArray(baseUids) ? baseUids : baseUids ? [baseUids] : [];
  if (!uids.length) return { state, bases: undefined };
  const key = spec?.zone === "grave" ? "grave" : spec?.zone === "mana" ? "mana" : "battle";
  const picked = uids.map(uid => (state[key] || []).find(c => c.uid === uid)).filter(Boolean);
  if (!picked.length) return { state, bases: undefined };
  const used = new Set(picked.map(c => c.uid));
  // 下に敷かれたカードはタップ状態や表裏を持たず、自分の下にカードも持たない
  // （マナ進化はタップ済みでも進化元にできる）
  const bases = picked.flatMap(b => [b, ...(b.evolutionBase || [])])
    .map(c => { const m = { ...c, tapped: false, faceUp: false }; delete m.evolutionBase; return m; });
  return { state: { ...state, [key]: state[key].filter(c => !used.has(c.uid)) }, bases };
}

// 進化元が足りているか（＝そのカードを出せるか）。
// NEO は重ねなくても出せるので、進化元の有無に関わらず true。
export function canEvolve(card, ownerState) {
  const spec = evolutionSpec(card);
  if (!spec) return true;
  if (spec.neo) return true;
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
  if (!card || !isCreatureSide(card)) return null;   // ツインパクトはクリーチャー側で召喚できる
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

// ===========================
// シールドの数を見る条件（革命n / 鬼エンド）
// ===========================
// 「自分のシールドが2つ以下なら」(革命2)、「シールドが1つもないプレイヤーがいて」(鬼エンド) など、
// シールドの枚数を条件にする能力は多いので、1つの条件型にまとめてある。
//   who: "self"(既定) / "opponent" / "any"（どちらかのプレイヤーが満たせば成立）
//   min / max: 枚数の下限・上限（両方書けば範囲）
// who:"self" なら相手の盤面が要らないので、パワー強化や grantKeywords のような
// 継続能力からも使える（革命0がこれを踏む）。
export function shieldCountMatches(spec, ownerState, otherState){
  const inRange = state => {
    const n = (state?.shields || []).length;
    if(spec.min != null && n < spec.min) return false;
    if(spec.max != null && n > spec.max) return false;
    return true;
  };
  const who = spec.who || "self";
  if(who === "self") return inRange(ownerState);
  // 相手を見る場合、盤面を渡されていなければ判定できないので成立させない（安全側）
  if(!otherState) return false;
  if(who === "opponent") return inRange(otherState);
  return inRange(ownerState) || inRange(otherState);   // "any"
}

// 鬼エンド = 「シールドが1つもないプレイヤーがいる」。上の条件の別名。
export function oniEndActive(stateA, stateB){
  return shieldCountMatches({ who: "any", max: 0 }, stateA, stateB);
}

// 自分のマナゾーンが、指定した filter を「それぞれ1枚以上」満たすか。
// 「マナゾーンに闇と火文明があれば」= [{civ:"darkness"},{civ:"fire"}]。
// ツインパクトはマナゾーンで両面の文明を持つので、civ の判定だけ getManaCivs を通す。
export function manaHasAll(state, filters){
  if(!filters?.length) return true;
  const mana = state?.mana || [];
  return filters.every(f => mana.some(c => {
    const wanted = f.civ == null ? null : (Array.isArray(f.civ) ? f.civ : [f.civ]);
    if(wanted && !wanted.some(x => getManaCivs(c).includes(x))) return false;
    // civ は上で判定済みなので matchCardFilter には渡さない（getManaCivs と結果が変わるため）
    const rest = Object.fromEntries(Object.entries(f).filter(([k]) => k !== "civ"));
    return matchCardFilter(c, rest);
  }));
}

// ===========================
// 手札からの宣言型プレイ（鬼エンド / D・D・D）
// ===========================
// どちらも「誘発のタイミングで、手札のカードをプレイしてもよい」能力。
// 違いは ①提示の条件 ②コストを払うかどうか の2つだけなので、1つの枠組みにまとめてある。
//   oniEnd … シールドが1つもないプレイヤーがいる＋マナ条件。コストは払わない
//   ddd    … 指定のコストを支払う（[自然(2)] のような部分コスト）
export const HAND_PLAY_KINDS = ["oniEnd", "ddd"];
// sTrigger は誘発で手札を探す能力ではないが、「手札のカードをコストを支払わずにプレイしてよいか
// 聞く」点が同じなので、同じ枠組み（HandPlayModal / playFromHandDeclared）に乗せている。
const HAND_PLAY_LABELS = { oniEnd: "鬼エンド", ddd: "D・D・D", sTrigger: "S・トリガー" };
export const handPlayLabel = kind => HAND_PLAY_LABELS[kind] || kind;

// 誘発の on / target がこのイベントに合うか（両方の能力で共通）
function handPlayMatchesEvent(spec, event, ev, ownerPid){
  if((spec.on || "attack") !== event) return false;
  const scope = spec.target || "both";
  if(scope === "self" && ev.sourcePid !== ownerPid) return false;
  if(scope === "opponent" && ev.sourcePid === ownerPid) return false;
  return true;
}

// 手札から今プレイを宣言できるカードを返す。
// event/ev は誘発の中身（fireTrigger と同じ形）。ownerPid はこの手札の持ち主。
// 戻り値は [{ card, kind, cost }]。cost があれば支払いが要る。
export function findHandPlays(state, otherState, event, ev = {}, ownerPid){
  const out = [];
  for(const card of state?.hand || []){
    for(const kind of HAND_PLAY_KINDS){
      const spec = card[kind];
      if(!spec || !handPlayMatchesEvent(spec, event, ev, ownerPid)) continue;
      // 呪文を唱えられない状態なら呪文は提示しない（ラフルル・ラブ等）
      if(spellDenyReason(card, state, otherState)) continue;
      if(kind === "oniEnd"){
        // 鬼エンド: シールドが1つもないプレイヤーがいて、マナ条件も満たすこと
        if(!oniEndActive(state, otherState)) continue;
        if(!manaHasAll(state, spec.manaHas)) continue;
        out.push({ card, kind, cost: null });
      }else{
        // D・D・D: 指定コストを払えること（払えないなら提示しない）
        const cost = spec.cost;
        if(!cost) continue;
        const asCard = { ...card, cost: cost.cost, civ: cost.civs || card.civ };
        if(!canPayCost(state?.mana || [], asCard, state).ok) continue;
        out.push({ card, kind, cost });
      }
    }
  }
  return out;
}

// 鬼エンドだけを返す旧API（テストと互換のため残す）
export function findOniEndPlays(state, otherState, event, ev = {}, ownerPid){
  return findHandPlays(state, otherState, event, ev, ownerPid)
    .filter(x => x.kind === "oniEnd").map(x => x.card);
}

// ゾーンの枚数を見る条件。「自分のマナゾーンにドラゴン・カードが4枚以上あれば」など。
// 数えるのは countCardsInZone（amountPer と同じ関数）なので、zone / filter の語彙もそこと同じ。
export function cardCountMatches(spec, ownerState, otherState){
  const inRange = state => {
    const n = countCardsInZone(state, spec);
    if(spec.min != null && n < spec.min) return false;
    if(spec.max != null && n > spec.max) return false;
    return true;
  };
  const who = spec.who || "self";
  if(who === "self") return inRange(ownerState);
  // 相手を見る場合、盤面を渡されていなければ判定できないので成立させない（安全側）
  if(!otherState) return false;
  if(who === "opponent") return inRange(otherState);
  return inRange(ownerState) || inRange(otherState);   // "any"
}

// このターンにブレイクされたシールドの枚数を見る条件。
// 「このターンに2つ以上自分のシールドがブレイクされていなければ」= {who:"self", max:1}
function shieldsBrokenMatches(spec, ownerState, otherState){
  const inRange = state => {
    const n = state?.shieldsBrokenThisTurn || 0;
    if(spec.min != null && n < spec.min) return false;
    if(spec.max != null && n > spec.max) return false;
    return true;
  };
  const who = spec.who || "self";
  if(who === "self") return inRange(ownerState);
  if(!otherState) return false;
  if(who === "opponent") return inRange(otherState);
  return inRange(ownerState) || inRange(otherState);
}

// grant規則やパワー強化に付く condition の評価。
// otherState は「相手の盤面も見る条件」専用。渡せる呼び出し元だけが渡す
// （triggers / activated だけが渡している。validator が書ける場所を制限する）。
export function checkGrantCondition(cond, ownerState, card, otherState){
  if(!cond) return true;
  if(cond.type === "civicCount") return civicCount(ownerState, cond.civ) >= cond.count;
  if(cond.type === "stackCount") return stackCount(card) >= cond.count;
  if(cond.type === "shieldCount") return shieldCountMatches(cond, ownerState, otherState);
  if(cond.type === "cardCount") return cardCountMatches(cond, ownerState, otherState);
  if(cond.type === "shieldsBroken") return shieldsBrokenMatches(cond, ownerState, otherState);
  // 鬼エンド: シールドが1つもないプレイヤーがいる。shieldCount の別名
  if(cond.type === "oniEnd") return shieldCountMatches({ who: "any", max: 0 }, ownerState, otherState);
  if(cond.flag) return !!ownerState?.[cond.flag];
  return true;
}

// 表示用のパワー。所有者の盤面が要る継続能力（condPower / grantPowerBoost）までは見ない、
// 「カード自身から分かるぶん」だけの値。カードUIはどこもこの形で出していたので1箇所にまとめた。
// powerPlus:true のカードは「5000+」のように末尾に + を付ける（数値そのものは変えない）。
export function displayPower(card) {
  if (!card) return "";
  const ec = effectiveCard(card);
  const base = (card.hyperMode && ec.hyperPower != null) ? ec.hyperPower : (card.power || 0);
  return `${base + (ec.tempBuff?.power || 0)}${ec.powerPlus ? "+" : ""}`;
}

export function getEffectivePower(card, ownerState, allOwnBattle, opts = {}) {
  const ec = effectiveCard(card);
  let power = (card.hyperMode && ec.hyperPower != null) ? ec.hyperPower : (card.power || 0);
  power += ec.tempBuff?.power || 0;
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
  const evalCard = effectiveCard(card);
  const granted = [...(evalCard.tempBuff?.keywords || []), ...ssxKeywords(card)];
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
      // self:「このクリーチャーに〜を与える」。同名の2体目に配らないよう uid で見る
      if (rule.filter?.self && granter.uid !== card.uid) continue;
      if (rule.filter?.nameContains && !card.name?.includes(rule.filter.nameContains)) continue;
      if (rule.filter?.elementOnly && !isElement(card)) continue;
      if (!granted.includes(rule.keyword)) granted.push(rule.keyword);
    }
  }
  return granted;
}

// ===========================
// コストを支払わずにプレイする許可（freeCast）
// 「自分は呪文をコストを支払わずに唱えてもよい」のような継続能力。
// バトルゾーン＋表向きシールドのカードから集める（summonFrom と同じ有効範囲）。
// 「〜してもよい」なので、通常どおりコストを払ってプレイすることも選べる。
//   freeCast: { filter?: {…}, timing?: "ownTurn"(既定)|"any" }
// ===========================
export function collectFreeCastPermissions(ownerState, isOwnTurn) {
  if (!ownerState) return [];
  const out = [];
  const add = (perm, key) => {
    if ((perm?.timing || "ownTurn") === "ownTurn" && !isOwnTurn) return;
    out.push({ ...perm, key });
  };
  const fromCard = c => {
    const fc = effectiveCard(c).freeCast;
    if (!fc) return;
    (Array.isArray(fc) ? fc : [fc]).forEach((p, i) => add(p, `${c.uid}#fc${i}`));
  };
  for (const c of ownerState.battle || []) fromCard(c);
  for (const c of ownerState.shields || []) if (c.faceUp) fromCard(c);
  return out;
}

// card をコストを支払わずにプレイできる許可を1つ返す。無ければ null。
export function freeCastPermissionFor(card, perms) {
  if (!card) return null;
  return (perms || []).find(p => matchCardFilter(card, p.filter)) || null;
}

// 「相手が自分のクリーチャーを選ぶ時、選ばれない」
// キーワード "unselectable" で表す（カード自身が持つか、grantKeywords で付与される）。
// 自分で自分のカードを選ぶのは妨げないので、呼ぶ側で「選ぶのが相手か」を判定すること。
// また「選ぶ」効果にだけ効く。全体除去のように選ばない効果は防げない。
export function isUnselectableByOpponent(card, ownerState) {
  return hasEffectiveKeyword(card, "unselectable", ownerState);
}

// 「攻撃されない」。ジャストダイバーが与える（相手からの攻撃先に選べなくなる）。
export function isUnattackable(card, ownerState) {
  return hasEffectiveKeyword(card, "unattackable", ownerState);
}

// カード自身のキーワード＋付与されたキーワードをまとめて見る
function hasEffectiveKeyword(card, kw, ownerState) {
  if (!card) return false;
  if (hasKeyword(card, kw)) return true;
  return computeGrantedKeywords(card, ownerState?.battle, ownerState).includes(kw);
}

// ジャストダイバー: 「このクリーチャーが出た時、次の自分のターンのはじめまで、
// このクリーチャーは相手に選ばれず、攻撃されない」。
// 期限つきの付与なので、既存の tempBuff（expires:"ownTurnStart"）に乗せる。
export const JUST_DIVER_BUFF = { keywords: ["unselectable", "unattackable"], expires: "ownTurnStart" };
export function withJustDiver(card) {
  if (!card || !hasKeyword(card, "justDiver")) return card;
  const prev = card.tempBuff || {};
  return { ...card, tempBuff: { ...prev, ...JUST_DIVER_BUFF,
    keywords: [...new Set([...(prev.keywords || []), ...JUST_DIVER_BUFF.keywords])] } };
}

