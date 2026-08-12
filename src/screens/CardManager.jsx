import { useState } from "react";
import { CIV, CIVS, KEYWORD_LABELS, CARD_TYPE_LABELS } from "../constants";
import { CardEditor } from "./CardEditor";
import { cardDisplayName, displayPower } from "../gameLogic";

// ===========================
// CARD MANAGER
// ===========================
export function CardManager({cardDb,setCardDb,onClose}){
  const [search,setSearch]=useState("");
  const [civFilter,setCivFilter]=useState("all");
  const [editing,setEditing]=useState(null); // card or "new"
  const [confirmDelete,setConfirmDelete]=useState(null);

  const filtered=cardDb.filter(c=>{
    if(search&&!cardDisplayName(c).includes(search))return false;
    if(civFilter!=="all"&&c.civ!==civFilter)return false;
    return true;
  });

  const handleSave=card=>{
    setCardDb(db=>db.find(c=>c.id===card.id)?db.map(c=>c.id===card.id?card:c):[...db,card]);
    setEditing(null);
  };

  return(
    <div className="fullscreen-panel" style={{background:"#050510",zIndex:600,display:"flex",flexDirection:"column"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&family=Cinzel:wght@700;900&display=swap');*{box-sizing:border-box;}`}</style>
      {editing&&<CardEditor card={editing==="new"?null:editing} onSave={handleSave} onCancel={()=>setEditing(null)}/>}
      {confirmDelete&&(
        <div className="fullscreen-panel" style={{background:"rgba(0,0,0,0.88)",zIndex:800,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"#0a0a18",border:"1px solid #f8444455",borderRadius:12,padding:20,maxWidth:320,width:"100%"}}>
            <div style={{color:"#f84",fontWeight:700,fontSize:14,marginBottom:8}}>🗑 削除確認</div>
            <div style={{color:"#aaa",fontSize:12,marginBottom:16}}>「{confirmDelete.name}」を削除しますか？</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setCardDb(db=>db.filter(c=>c.id!==confirmDelete.id));setConfirmDelete(null);}} style={{flex:1,padding:"8px",borderRadius:6,background:"#3a0a0a",border:"1px solid #f84",color:"#f84",cursor:"pointer",fontSize:13,fontWeight:700}}>削除する</button>
              <button onClick={()=>setConfirmDelete(null)} style={{flex:1,padding:"8px",borderRadius:6,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:13}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
      <div style={{background:"linear-gradient(90deg,#08001a,#100520)",borderBottom:"1px solid #2a1a4a",padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:15,color:"#ffe066",flex:1}}>🗂 カード管理 ({cardDb.length}種)</div>
        <button onClick={()=>setEditing("new")} style={{padding:"6px 14px",borderRadius:6,background:"rgba(68,255,136,0.15)",border:"1px solid #4f844",color:"#4f8",cursor:"pointer",fontSize:12,fontWeight:700}}>➕ 追加</button>
        <button onClick={onClose} style={{padding:"6px 12px",borderRadius:6,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:12}}>← 戻る</button>
      </div>
      <div style={{padding:"8px 12px",display:"flex",gap:6,flexWrap:"wrap",borderBottom:"1px solid #141428",background:"#060614"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="カード名検索" style={{flex:1,minWidth:120,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"4px 8px",fontSize:12}}/>
        <select value={civFilter} onChange={e=>setCivFilter(e.target.value)} style={{background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"4px 6px",fontSize:11}}>
          <option value="all">全文明</option>
          {CIVS.map(c=><option key={c} value={c}>{CIV[c].label}</option>)}
        </select>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"8px 12px",display:"flex",flexDirection:"column",gap:5}}>
        {filtered.map(card=>{const c=CIV[Array.isArray(card.civ)?card.civ[0]:card.civ]||CIV.fire;return(
          <div key={card.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"rgba(255,255,255,0.02)",borderRadius:8,border:"1px solid #1a1a2a"}}>
            <span style={{fontSize:11,fontWeight:900,color:c.textColor,background:`${c.color}33`,borderRadius:3,padding:"1px 4px",fontFamily:"'Noto Sans JP',sans-serif"}}>{c.label}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:700,color:"#fff"}}>{cardDisplayName(card)}</div>
              <div style={{fontSize:10,color:"#555"}}>コスト:{card.cost} {card.power!=null?`/ P:${displayPower(card)}`:`/ ${CARD_TYPE_LABELS[card.type]||"呪文"}`} {card.keywords?.map(k=><span key={k} style={{color:c.textColor,marginRight:3}}>{KEYWORD_LABELS[k]||k}</span>)}</div>
            </div>
            <button onClick={()=>setEditing(card)} style={{padding:"4px 10px",borderRadius:4,background:"rgba(255,224,102,0.1)",border:"1px solid #ffe06644",color:"#ffe066",cursor:"pointer",fontSize:11}}>編集</button>
            <button onClick={()=>setConfirmDelete(card)} style={{padding:"4px 10px",borderRadius:4,background:"rgba(255,80,80,0.1)",border:"1px solid #f8444444",color:"#f84",cursor:"pointer",fontSize:11}}>削除</button>
          </div>
        );})}
        {filtered.length===0&&<div style={{color:"#333",fontSize:12,textAlign:"center",padding:20}}>該当なし</div>}
      </div>
    </div>
  );
}
