import { useState } from "react";
import { ZONES, ZONE_LABELS } from "../constants";
import { shuffle } from "../gameLogic";
import { CardFace, CardBack } from "./CardFace";

// ===========================
// EXCEPTION PANEL
// ===========================
// ZONES の名前とプレイヤー状態のキーはシールドだけ食い違う（shield / shields）。
// 変換しないとシールドゾーンが見えず、「移動先: シールド」を選ぶとカードが消えてしまう。
const stateKey=z=>(z==="shield"?"shields":z);

export function ExceptionPanel({pid,state,setState,otherState,setOtherState,addLog}){
  const [open,setOpen]=useState(false);
  const [selCards,setSelCards]=useState([]);
  const [targetPid,setTargetPid]=useState("self");
  const [targetZone,setTargetZone]=useState("grave");
  const [powerDelta,setPowerDelta]=useState(1000);
  const [drawN,setDrawN]=useState(1);
  const label=pid==="p1"?"P1":"P2";const color=pid==="p1"?"#4af":"#f84";
  const toggleSel=(zone,uid)=>{const key=`${zone}::${uid}`;setSelCards(p=>p.find(x=>x.key===key)?p.filter(x=>x.key!==key):[...p,{zone,uid,key}]);};
  const isSel=(zone,uid)=>!!selCards.find(x=>x.key===`${zone}::${uid}`);
  const clearSel=()=>setSelCards([]);
  const doMove=()=>{
    if(selCards.length===0)return;
    let ns=JSON.parse(JSON.stringify(state));let no=JSON.parse(JSON.stringify(otherState));
    const byZone={};selCards.forEach(({zone,uid})=>{(byZone[zone]=byZone[zone]||[]).push(uid);});
    const moved=[];Object.entries(byZone).forEach(([zone,uids])=>{const k=stateKey(zone);moved.push(...(ns[k]||[]).filter(c=>uids.includes(c.uid)));ns[k]=(ns[k]||[]).filter(c=>!uids.includes(c.uid));});
    const tk=stateKey(targetZone);
    if(targetPid==="self"){if(targetZone==="deck")ns.deck=shuffle([...ns.deck,...moved]);else ns[tk]=[...(ns[tk]||[]),...moved];}
    else{if(targetZone==="deck")no.deck=shuffle([...no.deck,...moved]);else no[tk]=[...(no[tk]||[]),...moved];}
    addLog(`[${label}例外] ${moved.map(c=>c.name).join(",")} → ${targetPid==="self"?"自":"相手"}の${ZONE_LABELS[targetZone]}`);
    setState(ns);setOtherState(no);clearSel();
  };
  const moveZone=fromZone=>{const fk=stateKey(fromZone),tk=stateKey(targetZone);const cards=state[fk]||[];if(cards.length===0)return;setState(s=>{const ns={...s,[fk]:[]};if(targetPid==="self")return targetZone==="deck"?{...ns,deck:shuffle([...ns.deck,...cards])}:{...ns,[tk]:[...(ns[tk]||[]),...cards]};return ns;});if(targetPid==="other")setOtherState(s=>targetZone==="deck"?{...s,deck:shuffle([...s.deck,...cards])}:{...s,[tk]:[...(s[tk]||[]),...cards]});addLog(`[${label}例外] ${ZONE_LABELS[fromZone]}全→${targetPid==="self"?"自":"相手"}の${ZONE_LABELS[targetZone]}`);};
  const doTap=tap=>{let ns=JSON.parse(JSON.stringify(state));selCards.forEach(({zone,uid})=>{const k=stateKey(zone);const idx=ns[k]?.findIndex(c=>c.uid===uid);if(idx>=0)ns[k][idx].tapped=tap;});setState(ns);addLog(`[${label}例外] ${tap?"タップ":"アンタップ"}`);clearSel();};
  const tapAllBattle=tap=>{setState(s=>({...s,battle:s.battle.map(c=>({...c,tapped:tap}))}));addLog(`[${label}例外] BZ全${tap?"タップ":"アンタップ"}`);};
  const doPower=()=>{let ns=JSON.parse(JSON.stringify(state));let ch=0;selCards.filter(x=>x.zone==="battle").forEach(({uid})=>{const idx=ns.battle.findIndex(c=>c.uid===uid);if(idx>=0){ns.battle[idx].power=Math.max(0,(ns.battle[idx].power||0)+powerDelta);ch++;}});setState(ns);if(ch)addLog(`[${label}例外] パワー${powerDelta>0?"+":""}${powerDelta} (${ch}体)`);};
  const doDrawN=()=>{const n=Math.min(drawN,state.deck.length);if(n===0)return;setState(s=>({...s,hand:[...s.hand,...s.deck.slice(0,n)],deck:s.deck.slice(n)}));addLog(`[${label}例外] ${n}枚ドロー`);};
  const doShuffle=()=>{setState(s=>({...s,deck:shuffle([...s.deck])}));addLog(`[${label}例外] 山札シャッフル`);};
  const addShield=()=>{if(state.shields.length>=5||state.deck.length===0)return;setState(s=>({...s,shields:[...s.shields,s.deck[0]],deck:s.deck.slice(1)}));addLog(`[${label}例外] シールド追加`);};
  const Btn=({children,onClick,col="#aaa"})=>(<button onClick={onClick} style={{padding:"6px 10px",borderRadius:5,border:`1px solid ${col}33`,background:"rgba(255,255,255,0.03)",color:col,cursor:"pointer",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{children}</button>);
  if(!open) return(<button onClick={()=>setOpen(true)} style={{padding:"6px 14px",borderRadius:6,border:`1px solid ${color}44`,background:"rgb(6,6,15)",color,cursor:"pointer",fontSize:11,fontWeight:700}}>{label} 例外処理</button>);
  return(
    <div style={{background:"#07071a",border:`1px solid ${color}44`,borderRadius:12,padding:14,fontSize:11}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{color,fontWeight:700,fontSize:13}}>{label} 例外処理パネル</span>
        <button onClick={()=>{setOpen(false);clearSel();}} style={{padding:"3px 10px",borderRadius:4,background:"#222",border:"1px solid #666",color:"#eee",cursor:"pointer",fontSize:11}}>✕</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
        {ZONES.map(z=>(
          <div key={z} style={{background:"rgba(255,255,255,0.02)",borderRadius:8,padding:"8px 10px",border:"1px solid #141428"}}>
            <div style={{color:"#555",fontSize:10,marginBottom:5,fontWeight:700}}>{ZONE_LABELS[z]} ({(state[stateKey(z)]||[]).length}枚)</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {(state[stateKey(z)]||[]).map(c=>z==="deck"?<CardBack key={c.uid} small onClick={()=>toggleSel(z,c.uid)} label={isSel(z,c.uid)?"✓":""}/>:<CardFace key={c.uid} card={c} small selected={isSel(z,c.uid)} onClick={()=>toggleSel(z,c.uid)}/>)}
              {(state[stateKey(z)]||[]).length===0&&<span style={{color:"#1e1e2e",fontSize:10}}>空</span>}
            </div>
          </div>
        ))}
      </div>
      <div style={{background:"rgba(255,224,102,0.06)",border:"1px solid #ffe06622",borderRadius:6,padding:"6px 10px",marginBottom:10,minHeight:28}}>
        <span style={{color:"#ffe066",fontSize:10,fontWeight:600}}>選択中 {selCards.length}枚: {selCards.map(x=>(state[stateKey(x.zone)]||[]).find(c=>c.uid===x.uid)?.name).filter(Boolean).join(", ")||"なし"}</span>
        {selCards.length>0&&<button onClick={clearSel} style={{marginLeft:8,fontSize:9,color:"#555",background:"none",border:"none",cursor:"pointer"}}>クリア</button>}
      </div>
      <div style={{marginBottom:10}}>
        <div style={{color:"#444",fontSize:10,marginBottom:4}}>移動先:</div>
        <div style={{display:"flex",gap:4,marginBottom:6}}>
          {["self","other"].map(p=><button key={p} onClick={()=>setTargetPid(p)} style={{padding:"4px 12px",borderRadius:4,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${targetPid===p?color:"#333"}`,background:targetPid===p?`${color}22`:"#0a0a14",color:targetPid===p?color:"#555"}}>{p==="self"?"自分":"相手"}</button>)}
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {ZONES.map(z=><button key={z} onClick={()=>setTargetZone(z)} style={{padding:"4px 10px",borderRadius:4,fontSize:10,fontWeight:600,cursor:"pointer",border:`1px solid ${targetZone===z?"#ffe066":"#222"}`,background:targetZone===z?"rgba(255,224,102,0.1)":"#0a0a14",color:targetZone===z?"#ffe066":"#555"}}>{ZONE_LABELS[z]}</button>)}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:10}}>
        <Btn onClick={doMove} col="#4af">選択→移動先</Btn><Btn onClick={doShuffle} col="#8f8">山札シャッフル</Btn>
        <Btn onClick={()=>moveZone("grave")} col="#a8f">墓地全→移動先</Btn><Btn onClick={()=>moveZone("hand")} col="#8af">手札全→移動先</Btn>
        <Btn onClick={()=>moveZone("battle")} col="#fa8">BZ全→移動先</Btn><Btn onClick={addShield} col="#4af">山札上→シールド</Btn>
        <Btn onClick={()=>doTap(true)} col="#ff8">選択タップ</Btn><Btn onClick={()=>doTap(false)} col="#ff8">選択アンタップ</Btn>
        <Btn onClick={()=>tapAllBattle(false)} col="#ff8">BZ全アンタップ</Btn><Btn onClick={()=>tapAllBattle(true)} col="#ff8">BZ全タップ</Btn>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{color:"#555",fontSize:10,width:76}}>パワー変更:</span>
          <input type="number" value={powerDelta} step={1000} onChange={e=>setPowerDelta(Number(e.target.value))} style={{width:70,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:4,padding:"3px 6px",fontSize:11}}/>
          <Btn onClick={doPower} col="#f88">選択BZに適用</Btn>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{color:"#555",fontSize:10,width:76}}>ドロー枚数:</span>
          <input type="number" value={drawN} min={1} max={20} onChange={e=>setDrawN(Number(e.target.value))} style={{width:50,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:4,padding:"3px 6px",fontSize:11}}/>
          <Btn onClick={doDrawN} col="#4f8">ドロー実行</Btn>
        </div>
      </div>
    </div>
  );
}
