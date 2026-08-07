import { useState } from "react";
import { CIV, CIVS, CARD_TYPE_LABELS } from "../constants";
import { getCardCivs, cardDisplayName } from "../gameLogic";

// ===========================
// DECK EDITOR
// ===========================
export function DeckEditor({cardDb,initialIds,initialName,onSave,onCancel}){
  const [name,setName]=useState(initialName||"新しいデッキ");
  const [counts,setCounts]=useState(()=>{
    const c={};(initialIds||[]).forEach(id=>{c[id]=(c[id]||0)+1;});return c;
  });
  const [search,setSearch]=useState("");
  const [civFilter,setCivFilter]=useState("all");
  const [typeFilter,setTypeFilter]=useState("all");
  const total=Object.values(counts).reduce((a,b)=>a+b,0);
  const add=id=>{if((counts[id]||0)>=4||total>=40)return;setCounts(c=>({...c,[id]:(c[id]||0)+1}));};
  const remove=id=>{if((counts[id]||0)===0)return;setCounts(c=>({...c,[id]:c[id]-1}));};
  const deckIds=[];Object.entries(counts).forEach(([id,cnt])=>{for(let i=0;i<cnt;i++)deckIds.push(Number(id));});
  const filtered=cardDb.filter(c=>{
    if(search&&!cardDisplayName(c).includes(search))return false;
    if(civFilter!=="all"){
      const civs=getCardCivs(c);
      if(!civs.includes(civFilter))return false;
    }
    if(typeFilter!=="all"&&c.type!==typeFilter)return false;
    return true;
  });
  return(
    <div className="fullscreen-panel" style={{background:"#050510",zIndex:600,display:"flex",flexDirection:"column"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&family=Cinzel:wght@700;900&display=swap');*{box-sizing:border-box;}`}</style>
      {/* Header */}
      <div style={{background:"linear-gradient(90deg,#08001a,#100520)",borderBottom:"1px solid #2a1a4a",padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:15,color:"#ffe066"}}>📋 デッキ編集</div>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="デッキ名" style={{flex:1,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"5px 10px",fontSize:13}}/>
        <div style={{fontSize:13,color:total===40?"#4f8":"#f84",fontWeight:700,whiteSpace:"nowrap"}}>{total}/40</div>
      </div>
      {/* Filters */}
      <div style={{padding:"8px 12px",display:"flex",gap:6,flexWrap:"wrap",borderBottom:"1px solid #141428",background:"#060614"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="カード名検索" style={{flex:1,minWidth:120,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"4px 8px",fontSize:12}}/>
        <select value={civFilter} onChange={e=>setCivFilter(e.target.value)} style={{background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"4px 6px",fontSize:11}}>
          <option value="all">全文明</option>
          {CIVS.map(c=><option key={c} value={c}>{CIV[c].label}</option>)}
        </select>
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"4px 6px",fontSize:11}}>
          <option value="all">全種類</option>
          <option value="creature">クリーチャー</option>
          <option value="spell">呪文</option>
        </select>
      </div>
      {/* Card list */}
      <div style={{flex:1,overflowY:"auto",padding:"8px 12px",display:"flex",flexDirection:"column",gap:5}}>
        {filtered.map(card=>{
          const cnt=counts[card.id]||0;const c=CIV[Array.isArray(card.civ)?card.civ[0]:card.civ]||CIV.fire;
          return(
            <div key={card.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"rgba(255,255,255,0.03)",borderRadius:8,border:`1px solid ${cnt>0?c.color+"44":"#1a1a2a"}`}}>
              <span style={{fontSize:11,fontWeight:900,color:c.textColor,background:`${c.color}33`,borderRadius:3,padding:"1px 4px",fontFamily:"'Noto Sans JP',sans-serif"}}>{c.label}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cardDisplayName(card)}</div>
                <div style={{fontSize:10,color:"#555"}}>コスト:{card.cost} {card.power!=null?`/ P:${card.power}`:`/ ${CARD_TYPE_LABELS[card.type]||"呪文"}`}{card.keywords?.includes("sTrigger")&&<span style={{color:"#ff8",marginLeft:4}}>ST</span>}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <button onClick={()=>remove(card.id)} style={{width:26,height:26,borderRadius:4,background:"#1a0a0a",border:"1px solid #f8444444",color:"#f84",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                <span style={{fontSize:14,fontWeight:700,color:cnt>0?"#fff":"#333",width:16,textAlign:"center"}}>{cnt}</span>
                <button onClick={()=>add(card.id)} disabled={cnt>=4||total>=40} style={{width:26,height:26,borderRadius:4,background:cnt<4&&total<40?"#0a1a0a":"#0a0a0a",border:`1px solid ${cnt<4&&total<40?"#4f8":"#222"}`,color:cnt<4&&total<40?"#4f8":"#333",cursor:cnt<4&&total<40?"pointer":"not-allowed",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>＋</button>
              </div>
            </div>
          );
        })}
        {filtered.length===0&&<div style={{color:"#333",fontSize:12,textAlign:"center",padding:20}}>該当カードなし</div>}
      </div>
      {/* Footer */}
      <div style={{padding:"10px 12px",borderTop:"1px solid #141428",background:"#060614",display:"flex",gap:8}}>
        <button onClick={()=>onSave({name,ids:deckIds})} disabled={total!==40} style={{flex:1,padding:"11px",borderRadius:8,fontWeight:700,fontSize:14,background:total===40?"linear-gradient(135deg,#ffe066,#ff9900)":"#1a1a1a",border:"none",color:total===40?"#000":"#444",cursor:total===40?"pointer":"not-allowed"}}>保存 ({total}/40)</button>
        <button onClick={onCancel} style={{padding:"11px 18px",borderRadius:8,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:13}}>キャンセル</button>
      </div>
    </div>
  );
}
