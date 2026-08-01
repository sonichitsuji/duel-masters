import { useState } from "react";
import { ALL_KEYWORDS, KEYWORD_LABELS, CIV, CIVS } from "../constants";
import { mkCardId, inferAutoEffect } from "../gameLogic";

// ===========================
// CARD EDITOR (add/edit single card)
// ===========================
export function CardEditor({card, onSave, onCancel}){
  const isNew=!card;
  const [form,setForm]=useState(card?{...card}:{
    name:"",cost:1,power:1000,type:"creature",civ:"fire",keywords:[],effect:"",autoEffect:null
  });
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const toggleKw=kw=>set("keywords",form.keywords.includes(kw)?form.keywords.filter(x=>x!==kw):[...form.keywords,kw]);
  const handleSave=()=>{
    if(!form.name.trim()){alert("カード名を入力してください");return;}
    const inferred=inferAutoEffect(form.keywords,form.effect);
    onSave({...form,id:card?.id||mkCardId(),autoEffect:form.autoEffect??inferred,cost:Number(form.cost),power:Number(form.power)});
  };
  return(
    <div className="fullscreen-panel" style={{background:"rgba(0,0,0,0.92)",zIndex:700,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0a0a18",border:"1px solid #ffe06644",borderRadius:14,padding:20,maxWidth:440,width:"100%",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{fontFamily:"'Cinzel',serif",color:"#ffe066",fontSize:16,fontWeight:700,marginBottom:16}}>{isNew?"➕ カード追加":"✏️ カード編集"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <label style={{fontSize:11,color:"#888"}}>カード名 *
            <input value={form.name} onChange={e=>set("name",e.target.value)} style={{display:"block",width:"100%",marginTop:4,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"7px 10px",fontSize:13}}/>
          </label>
          <div style={{display:"flex",gap:8}}>
            <label style={{fontSize:11,color:"#888",flex:1}}>コスト
              <input type="number" min={0} max={20} value={form.cost} onChange={e=>set("cost",e.target.value)} style={{display:"block",width:"100%",marginTop:4,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"7px 10px",fontSize:13}}/>
            </label>
            <label style={{fontSize:11,color:"#888",flex:1}}>種類
              <select value={form.type} onChange={e=>set("type",e.target.value)} style={{display:"block",width:"100%",marginTop:4,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"7px 10px",fontSize:13}}>
                <option value="creature">クリーチャー</option>
                <option value="spell">呪文</option>
              </select>
            </label>
          </div>
          {form.type==="creature"&&(
            <label style={{fontSize:11,color:"#888"}}>パワー
              <input type="number" min={0} step={1000} value={form.power} onChange={e=>set("power",e.target.value)} style={{display:"block",width:"100%",marginTop:4,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"7px 10px",fontSize:13}}/>
            </label>
          )}
          <label style={{fontSize:11,color:"#888"}}>文明
            <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
              {CIVS.map(civ=>{const c=CIV[civ];return(
                <button key={civ} onClick={()=>set("civ",civ)} style={{padding:"5px 10px",borderRadius:5,border:`2px solid ${form.civ===civ?c.color:"#333"}`,background:form.civ===civ?`${c.color}22`:"#0a0a14",color:form.civ===civ?c.textColor:"#555",cursor:"pointer",fontSize:11,fontWeight:700}}>{c.label}</button>
              );})}
            </div>
          </label>
          <label style={{fontSize:11,color:"#888"}}>キーワード能力
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6}}>
              {ALL_KEYWORDS.map(kw=><button key={kw} onClick={()=>toggleKw(kw)} style={{padding:"4px 8px",borderRadius:4,border:`1px solid ${form.keywords.includes(kw)?"#ffe066":"#333"}`,background:form.keywords.includes(kw)?"rgba(255,224,102,0.15)":"#111",color:form.keywords.includes(kw)?"#ffe066":"#555",cursor:"pointer",fontSize:10}}>{KEYWORD_LABELS[kw]||kw}</button>)}
            </div>
          </label>
          <label style={{fontSize:11,color:"#888"}}>効果テキスト
            <textarea value={form.effect} onChange={e=>set("effect",e.target.value)} rows={3} style={{display:"block",width:"100%",marginTop:4,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"7px 10px",fontSize:12,resize:"vertical"}}/>
          </label>
          <div style={{fontSize:10,color:"#555",padding:"6px 8px",background:"#080818",borderRadius:5,border:"1px solid #1a1a2a"}}>
            💡 効果テキストからautoEffectを自動推論します。複雑な効果は例外処理で対応してください。
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button onClick={handleSave} style={{flex:1,padding:"10px",borderRadius:7,fontWeight:700,fontSize:13,background:"linear-gradient(135deg,#ffe066,#ff9900)",border:"none",color:"#000",cursor:"pointer"}}>保存</button>
          <button onClick={onCancel} style={{padding:"10px 16px",borderRadius:7,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:12}}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}
