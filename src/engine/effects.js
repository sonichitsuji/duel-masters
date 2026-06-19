import { extractManyFromBattle } from "../gameLogic";

// ===========================
// EFFECT PROCESSOR
// ===========================
export function processEffect(effect,ownerPid,selfState,setSelf,otherState,setOther,addLog,openEffectModal){
  if(!effect) return;
  const pid=ownerPid==="p1"?"P1":"P2";
  switch(effect.type){
    case"draw":{
      const n=Math.min(effect.amount,selfState.deck.length);
      if(n===0){addLog(`${pid}: 山札が空`);return;}
      setSelf(s=>({...s,hand:[...s.hand,...s.deck.slice(0,n)],deck:s.deck.slice(n)}));
      addLog(`${pid}: ${n}枚ドロー`);
      if(effect.thenDiscard>0) openEffectModal({type:"discard",amount:effect.thenDiscard,pid,ownerPid});
      break;
    }
    case"handDestroy":   openEffectModal({type:"handDestroy",  amount:effect.amount,target:effect.target,pid,ownerPid});break;
    case"destroy":       openEffectModal({type:"destroy",      amount:effect.amount,target:effect.target,pid,ownerPid});break;
    case"sendToMana":    openEffectModal({type:"sendToMana",   amount:effect.amount,target:effect.target,pid,ownerPid});break;
    case"bounce":        openEffectModal({type:"bounce",       amount:effect.amount,target:effect.target,pid,ownerPid});break;
    case"manaReturn":    openEffectModal({type:"manaReturn",   amount:effect.amount,target:effect.target,optional:effect.optional,pid,ownerPid});break;
    case"deckSearch":    openEffectModal({type:"deckSearch",   amount:effect.amount,pid,ownerPid});break;
    case"destroyUnder":{
      const tgt=effect.target==="opponent"?otherState:selfState;
      const st=effect.target==="opponent"?setOther:setSelf;
      const deadUids=tgt.battle.filter(c=>c.power<=effect.threshold).map(c=>c.uid);
      st(s=>{const{newBattle,extracted}=extractManyFromBattle(s.battle,deadUids);return{...s,battle:newBattle,grave:[...s.grave,...extracted]};});
      addLog(`${pid}: パワー${effect.threshold}以下 ${deadUids.length}体破壊`);break;
    }
    case"tapAll":{
      const st2=effect.target==="opponent"?setOther:setSelf;
      st2(s=>({...s,battle:s.battle.map(c=>({...c,tapped:true}))}));
      addLog(`${pid}: 相手BZ全タップ`);break;
    }
    case"deckToMana":{
      setSelf(s=>{
        if(s.deck.length===0) return s;
        const[card,...rest]=s.deck;
        addLog(`${pid}: ${card.name}→マナ`);
        return{...s,deck:rest,mana:[...s.mana,{...card,tapped:false}]};
      });break;
    }
    default: addLog(`[未実装] ${effect.type}`);
  }
}
