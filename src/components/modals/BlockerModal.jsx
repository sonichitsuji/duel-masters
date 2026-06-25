import { useState } from "react";
import { CardFace } from "../CardFace";

// 攻撃宣言時、防御側にブロック可能なクリーチャー一覧を提示する。
// blockers: ブロック可能なクリーチャー配列 / attackerName: 攻撃クリーチャー名
export function BlockerModal({ blockers, attackerName, onBlock, onDecline }) {
  const [selected, setSelected] = useState(null);
  if (!blockers || blockers.length === 0) return null;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:425, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"linear-gradient(160deg,#0a0a22,#08080f)", border:"2px solid #6688ff", borderRadius:14, padding:20, maxWidth:460, width:"100%", boxShadow:"0 0 30px #6688ff55" }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:"#88aaff", fontSize:13, fontWeight:900, marginBottom:4, letterSpacing:2 }}>BLOCK?</div>
        <div style={{ fontSize:11, color:"#aaa", marginBottom:12 }}>
          「{attackerName}」の攻撃。ブロックするクリーチャーを選んでください（タップしてブロックします）。
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
          {blockers.map(c => (
            <CardFace key={c.uid} card={c} small selected={selected===c.uid} onClick={() => setSelected(s => s===c.uid ? null : c.uid)} />
          ))}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => selected && onBlock(selected)} disabled={!selected} style={{ flex:1, padding:"10px", borderRadius:6, fontWeight:700, fontSize:13, background:selected?"linear-gradient(135deg,#6688ff55,#6688ff22)":"#111", border:`1px solid ${selected?"#6688ff":"#333"}`, color:selected?"#aaccff":"#444", cursor:selected?"pointer":"not-allowed", fontFamily:"'Cinzel',serif", letterSpacing:1 }}>
            BLOCK
          </button>
          <button onClick={onDecline} style={{ padding:"10px 16px", borderRadius:6, background:"#111", border:"1px solid #555", color:"#aaa", cursor:"pointer", fontSize:12 }}>
            ブロックしない
          </button>
        </div>
      </div>
    </div>
  );
}
