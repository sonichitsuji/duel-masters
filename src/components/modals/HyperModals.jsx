import { useState } from "react";
import { CardFace } from "../CardFace";

// ===========================
// HYPER MODE MODALS
// ===========================
export function HyperUntapModal({ modal, onSelect, onSkip }) {
  const [selected, setSelected] = useState(null);
  const { allies } = modal;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:415, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"linear-gradient(160deg,#1a0800,#08080f)", border:"2px solid #ffcc00", borderRadius:14, padding:20, maxWidth:420, width:"100%", boxShadow:"0 0 30px #ffcc0066" }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:"#ffcc00", fontSize:13, fontWeight:900, marginBottom:4, letterSpacing:2 }}>HYPER MODE</div>
        <div style={{ fontSize:11, color:"#aaa", marginBottom:12 }}>攻撃時：自分の他のクリーチャーを1体アンタップする</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
          {allies.map(c => (
            <CardFace key={c.uid} card={c} small selected={selected===c.uid} onClick={() => setSelected(s => s===c.uid ? null : c.uid)} />
          ))}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => selected && onSelect(selected)} disabled={!selected} style={{ flex:1, padding:"10px", borderRadius:6, fontWeight:700, fontSize:12, background:selected?"linear-gradient(135deg,#ffcc0055,#ffcc0022)":"#111", border:`1px solid ${selected?"#ffcc00":"#333"}`, color:selected?"#ffcc00":"#444", cursor:selected?"pointer":"not-allowed", fontFamily:"'Cinzel',serif" }}>
            UNTAP
          </button>
          <button onClick={onSkip} style={{ padding:"10px 14px", borderRadius:6, background:"#111", border:"1px solid #555", color:"#aaa", cursor:"pointer", fontSize:12 }}>
            スキップ
          </button>
        </div>
      </div>
    </div>
  );
}

export function HyperTargetedModal({ modal, attackerShields, onUse, onSkip }) {
  const { amount } = modal;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:415, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"linear-gradient(160deg,#1a0800,#08080f)", border:"2px solid #ffcc00", borderRadius:14, padding:20, maxWidth:380, width:"100%", boxShadow:"0 0 30px #ffcc0066" }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:"#ffcc00", fontSize:13, fontWeight:900, marginBottom:4, letterSpacing:2 }}>HYPER MODE</div>
        <div style={{ fontSize:11, color:"#ccc", marginBottom:6 }}>相手がこのクリーチャーを選んだ時：</div>
        <div style={{ fontSize:12, fontWeight:700, color:"#ffcc00", marginBottom:4 }}>相手のシールドを{amount}つブレイクしてもよい</div>
        <div style={{ fontSize:10, color:"#666", marginBottom:14 }}>相手シールド残り: {attackerShields}枚</div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onUse} style={{ flex:1, padding:"10px", borderRadius:6, fontWeight:700, fontSize:12, background:"linear-gradient(135deg,#ffcc0055,#ffcc0022)", border:"1px solid #ffcc00", color:"#ffcc00", cursor:"pointer", fontFamily:"'Cinzel',serif" }}>
            {Math.min(amount, attackerShields)}枚 BREAK
          </button>
          <button onClick={onSkip} style={{ padding:"10px 14px", borderRadius:6, background:"#111", border:"1px solid #555", color:"#aaa", cursor:"pointer", fontSize:12 }}>
            使わない
          </button>
        </div>
      </div>
    </div>
  );
}
