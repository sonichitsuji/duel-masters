import { useState, useEffect } from "react";
import { CIV } from "../../constants";
import { getCardCivs } from "../../gameLogic";
import { getEffectCandidates } from "../../engine/effects";
import { CardFace } from "../CardFace";

// ===========================
// EFFECT STEP MODAL
// ===========================
export function EffectStepModal({ activeSteps, p1, setP1, p2, setP2, addLog, onAdvance, onException }) {
  const [selected, setSelected] = useState([]);
  useEffect(() => { setSelected([]); }, [activeSteps?.stepIdx]);
  if (!activeSteps) return null;

  const { steps, stepIdx, ownerPid, srcCard, context } = activeSteps;
  const step = steps[stepIdx];
  const selfState  = ownerPid === "p1" ? p1 : p2;
  const otherState = ownerPid === "p1" ? p2 : p1;
  const { candidates, isAuto, maxSelect: dynMaxSelect, ordered } = getEffectCandidates(step, selfState, otherState, context, p1, p2, srcCard);

  const civs = getCardCivs(srcCard || {});
  const c = CIV[civs[0]] || CIV.fire;

  const maxSel = step.maxSelect ?? dynMaxSelect ?? 1;
  const toggleSelect = uid => {
    setSelected(s => s.includes(uid) ? s.filter(u => u !== uid) : s.length < maxSel ? [...s, uid] : maxSel === 1 ? [uid] : s);
  };

  // ordered（好きな順序で置く）は、選んだ順がそのまま並び順になるので全部選び終えるまで確定できない
  const canConfirm = isAuto || (ordered ? selected.length === maxSel : (step.optional || selected.length > 0));

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:380, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:`linear-gradient(160deg,${c.bg},#08080f)`, border:`2px solid ${c.color}`, borderRadius:14, padding:20, maxWidth:500, width:"100%", boxShadow:`0 0 30px ${c.glow}55`, maxHeight:"calc(90vh / var(--ui-scale))", display:"flex", flexDirection:"column", gap:10 }}>
        <div>
          <div style={{ fontFamily:"'Cinzel',serif", color:c.textColor, fontSize:13, fontWeight:900 }}>
            効果 {stepIdx+1}/{steps.length}：{srcCard?.name || ""}
          </div>
          <div style={{ fontSize:11, color:"#aaa", marginTop:4, padding:"6px 8px", background:"rgba(0,0,0,0.4)", borderRadius:6, border:`1px solid ${c.color}33` }}>
            {step.label}
          </div>
        </div>

        {/* Card grid */}
        {candidates.length > 0 && (
          <div style={{ overflowY:"auto", maxHeight:220 }}>
            <div style={{ fontSize:10, color:"#555", marginBottom:4 }}>
              {isAuto ? "公開カード：" : `選択（${selected.length}/${maxSel}）：`}
              {ordered && <span style={{ color: "#ffcc66", marginLeft: 6 }}>選んだ順に上から置かれます</span>}
            </div>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
              {candidates.map((card, i) => (
                step.type === "breakShield" ? (
                  <div key={card.uid}
                    onClick={() => toggleSelect(card.uid)}
                    style={{width:52,height:72,borderRadius:7,flexShrink:0,border:`2px solid ${selected.includes(card.uid)?"#ffe066":"#888"}`,background:"linear-gradient(135deg,#1a3050,#0a1828)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,transform:selected.includes(card.uid)?"translateY(-8px) scale(1.07)":"none",transition:"all 0.15s",boxShadow:selected.includes(card.uid)?"0 0 18px #ffe066":"0 0 6px #44aaff44",userSelect:"none"}}>
                    <div style={{width:14,height:18,background:"linear-gradient(180deg,#3a6090,#1a3a5c)",borderRadius:"3px 3px 2px 2px",border:"1px solid #5a80aa",boxShadow:"0 0 6px #3a6090aa"}}/>
                    <span style={{fontSize:8,color:"#88aacc"}}>{i+1}</span>
                  </div>
                ) : (
                  <div key={card.uid} style={{ position:"relative", display:"flex" }}>
                    <CardFace card={card}
                      selected={selected.includes(card.uid)}
                      onClick={isAuto ? undefined : () => toggleSelect(card.uid)}
                      small />
                    {ordered && selected.includes(card.uid) && (
                      <span style={{ position:"absolute", top:-4, left:-4, width:17, height:17, borderRadius:"50%", background:"#ffe066", color:"#000", fontSize:10, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 8px #ffe066" }}>
                        {selected.indexOf(card.uid) + 1}
                      </span>
                    )}
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {candidates.length === 0 && !isAuto && (
          <div style={{ fontSize:11, color:"#555", textAlign:"center", padding:8 }}>対象カードがありません</div>
        )}

        {/* Buttons */}
        <div style={{ display:"flex", gap:8 }}>
          <button
            onClick={() => canConfirm && onAdvance(selected)}
            disabled={!canConfirm}
            style={{ flex:1, padding:"10px", borderRadius:6, fontWeight:700, fontSize:12, background:canConfirm?`linear-gradient(135deg,${c.color}55,${c.color}22)`:"#111", border:`1px solid ${canConfirm?c.color:"#333"}`, color:canConfirm?c.textColor:"#444", cursor:canConfirm?"pointer":"not-allowed" }}>
            {isAuto ? "確認" : "実行"}
          </button>
          {step.optional && (
            <button onClick={() => onAdvance([])} style={{ padding:"10px 14px", borderRadius:6, background:"#111", border:"1px solid #555", color:"#aaa", cursor:"pointer", fontSize:12 }}>
              スキップ
            </button>
          )}
          <button onClick={onException} style={{ padding:"10px 14px", borderRadius:6, background:"#111", border:"1px solid #333", color:"#666", cursor:"pointer", fontSize:12 }}>
            例外処理
          </button>
        </div>
      </div>
    </div>
  );
}
