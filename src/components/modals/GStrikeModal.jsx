import { useState } from "react";
import { CardFace } from "../CardFace";

// ===========================
// G-STRIKE MODAL
// ===========================
export function GStrikeModal({ cards, attackerBattle, onConfirm, onSkip }) {
  const [selected, setSelected] = useState(null);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"linear-gradient(160deg,#1a0030,#08080f)", border:"2px solid #ff44ff", borderRadius:14, padding:20, maxWidth:460, width:"100%", boxShadow:"0 0 30px #ff44ff66" }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:"#ff88ff", fontSize:14, fontWeight:900, marginBottom:4, letterSpacing:2 }}>G·STRIKE</div>
        <div style={{ fontSize:11, color:"#888", marginBottom:12 }}>
          相手の攻撃クリーチャーを1体選んでください。<br/>
          選んだクリーチャーはこのターン攻撃できません。
        </div>
        <div style={{ fontSize:10, color:"#555", marginBottom:6 }}>攻撃側のクリーチャー:</div>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:14 }}>
          {(attackerBattle || []).map(c => (
            <div key={c.uid} onClick={() => setSelected(selected === c.uid ? null : c.uid)} style={{ cursor:"pointer" }}>
              <CardFace card={c} small selected={selected === c.uid} />
            </div>
          ))}
          {(attackerBattle || []).length === 0 && <div style={{ color:"#444", fontSize:11 }}>対象なし</div>}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => onConfirm(selected)} disabled={!selected} style={{ flex:1, padding:"10px", borderRadius:6, fontWeight:700, fontSize:12, background:selected?"linear-gradient(135deg,#ff44ff33,#ff44ff11)":"#111", border:`1px solid ${selected?"#ff44ff":"#333"}`, color:selected?"#ff88ff":"#444", cursor:selected?"pointer":"not-allowed" }}>
            決定
          </button>
          <button onClick={onSkip} style={{ padding:"10px 16px", borderRadius:6, background:"#111", border:"1px solid #333", color:"#666", cursor:"pointer", fontSize:12 }}>
            スキップ
          </button>
        </div>
      </div>
    </div>
  );
}
