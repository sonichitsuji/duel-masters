import { useState } from "react";
import { CardFace } from "../CardFace";

// ===========================
// FINAL REVOLUTION MODAL
// ===========================
export function FinalRevolutionModal({ selfState, onConfirm, onSkip }) {
  const [selected, setSelected] = useState([]);
  const totalCost = selected.reduce((sum, s) => {
    const card = s.from === "hand"
      ? selfState.hand.find(c => c.uid === s.uid)
      : selfState.mana.find(c => c.uid === s.uid);
    return sum + (card?.cost || 0);
  }, 0);
  const isMultiNonEvo = c => Array.isArray(c.civ) && c.civ.length >= 2 && c.type !== "evo_creature";
  const handCands = selfState.hand.filter(isMultiNonEvo);
  const manaCands = selfState.mana.filter(isMultiNonEvo);
  const toggle = (uid, from) => {
    const exists = selected.find(s => s.uid === uid);
    if (exists) { setSelected(p => p.filter(s => s.uid !== uid)); return; }
    const card = from === "hand" ? selfState.hand.find(c => c.uid === uid) : selfState.mana.find(c => c.uid === uid);
    if (totalCost + (card?.cost || 0) > 6) return;
    setSelected(p => [...p, { uid, from }]);
  };
  const isSel = uid => selected.some(s => s.uid === uid);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:365, display:"flex", alignItems:"center", justifyContent:"center", padding:16, overflowY:"auto" }}>
      <div style={{ background:"linear-gradient(160deg,#021a08,#08080f)", border:"2px solid #44ff88", borderRadius:14, padding:20, maxWidth:400, width:"100%", boxShadow:"0 0 30px #44ff8866" }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:"#44ff88", fontSize:14, fontWeight:900, marginBottom:4 }}>[FINAL] ファイナル革命</div>
        <div style={{ fontSize:11, color:"#888", marginBottom:8 }}>
          合計コスト6以下の多色クリーチャーを選んでバトルゾーンへ。<br/>
          <span style={{ color: totalCost > 6 ? "#f84" : "#44ff88", fontWeight:700 }}>合計コスト: {totalCost} / 6</span>
        </div>
        {handCands.length > 0 && (
          <>
            <div style={{ fontSize:10, color:"#555", marginBottom:4 }}>手札から:</div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:8 }}>
              {handCands.map(c => (
                <div key={c.uid} onClick={() => toggle(c.uid, "hand")} style={{ opacity: (!isSel(c.uid) && totalCost + c.cost > 6) ? 0.3 : 1, cursor:"pointer" }}>
                  <CardFace card={c} small selected={isSel(c.uid)} />
                  <div style={{ fontSize:8, textAlign:"center", color:"#aaa" }}>{c.cost}コスト</div>
                </div>
              ))}
            </div>
          </>
        )}
        {manaCands.length > 0 && (
          <>
            <div style={{ fontSize:10, color:"#555", marginBottom:4 }}>マナから:</div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:8 }}>
              {manaCands.map(c => (
                <div key={c.uid} onClick={() => toggle(c.uid, "mana")} style={{ opacity: (!isSel(c.uid) && totalCost + c.cost > 6) ? 0.3 : 1, cursor:"pointer" }}>
                  <CardFace card={c} small selected={isSel(c.uid)} />
                  <div style={{ fontSize:8, textAlign:"center", color:"#aaa" }}>{c.cost}コスト</div>
                </div>
              ))}
            </div>
          </>
        )}
        {handCands.length === 0 && manaCands.length === 0 && (
          <div style={{ fontSize:11, color:"#555", marginBottom:12 }}>対象カードなし</div>
        )}
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => onConfirm(selected)} style={{ flex:1, padding:"10px", borderRadius:6, fontWeight:700, fontSize:12, background:"linear-gradient(135deg,#44ff8833,#44ff8811)", border:"1px solid #44ff88", color:"#44ff88", cursor:"pointer" }}>
            バトルゾーンに出す ({selected.length}枚)
          </button>
          <button onClick={onSkip} style={{ padding:"10px 16px", borderRadius:6, background:"#111", border:"1px solid #333", color:"#666", cursor:"pointer", fontSize:12 }}>
            スキップ
          </button>
        </div>
      </div>
    </div>
  );
}
