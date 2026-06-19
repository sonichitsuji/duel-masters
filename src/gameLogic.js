import { CIV } from "./constants";

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
export function getCardCivs(card){ return Array.isArray(card.civ)?card.civ:[card.civ]; }

export function makeCardBg(civs) {
  const n = civs.length;
  if (n === 1) return `linear-gradient(180deg, ${CIV[civs[0]]?.bg || '#08080f'}, #08080f)`;
  const stops = [];
  civs.forEach((civ, i) => {
    const bg = CIV[civ]?.bg || '#08080f';
    const pct1 = Math.round(100 * i / n);
    const pct2 = Math.round(100 * (i + 1) / n);
    stops.push(`${bg} ${pct1}%`, `${bg} ${pct2}%`);
  });
  return `linear-gradient(180deg, ${stops.join(', ')})`;
}

export function canPayCost(mana,card,selfBattle){
  const effectiveCost=selfBattle?getEffectiveCost(card,selfBattle):card.cost;
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

export function getEffectiveCost(card, selfBattle) {
  if (!selfBattle || selfBattle.length === 0) return card.cost;
  let cost = card.cost;
  for (const c of selfBattle) {
    if (!c.costReduce) continue;
    const { amount, filter, min } = c.costReduce;
    if (filter?.raceContains && !card.race?.includes(filter.raceContains)) continue;
    if (filter?.nameContains && !card.name?.includes(filter.nameContains)) continue;
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

export function getEffectivePower(card, ownerState, allOwnBattle) {
  let power = (card.hyperMode && card.hyperPower != null) ? card.hyperPower : (card.power || 0);
  power += card.tempBuff?.power || 0;
  if (card.selfPowerBoostGrave) {
    const { civFilter, perCard } = card.selfPowerBoostGrave;
    const count = (ownerState.grave || []).filter(c => getCardCivs(c).includes(civFilter)).length;
    power += count * perCard;
  }
  for (const ally of (allOwnBattle || [])) {
    if (!ally.grantPowerBoost || ally.uid === card.uid) continue;
    const { amount, filter } = ally.grantPowerBoost;
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

export function computeGrantedKeywords(card, battleZone) {
  const granted = [...(card.tempBuff?.keywords || [])];
  if (!battleZone) return granted;
  for (const granter of battleZone) {
    if (!granter.grantKeywords) continue;
    for (const rule of granter.grantKeywords) {
      if (rule.filter?.raceContains && !card.race?.includes(rule.filter.raceContains)) continue;
      if (rule.filter?.multiColor && !(Array.isArray(card.civ) && card.civ.length >= 2)) continue;
      if (rule.filter?.notSelf && granter.uid === card.uid) continue;
      if (rule.filter?.nameContains && !card.name?.includes(rule.filter.nameContains)) continue;
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
