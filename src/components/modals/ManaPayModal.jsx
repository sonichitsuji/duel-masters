import { useState } from "react";
import { CIV } from "../../constants";
import { getCardCivs, getEffectiveCost } from "../../gameLogic";
import { CardFace } from "../CardFace";

// ===========================
// MANA PAY MODAL
// ===========================
export function ManaPayModal({ card, mana, ownerState, selfBattle, onConfirm, onCancel }) {
  const [selected, setSelected] = useState([]); // [{uid, assignedCiv}]
  const [civPicker, setCivPicker] = useState(null); // null | {uid, civs:[]}

  const needed = getEffectiveCost(card, ownerState || selfBattle || []);
  const requiredCivs = getCardCivs(card);
  const selectedUids = selected.map(s => s.uid);
  const civsSatisfied = requiredCivs.every(civ => selected.some(s => s.assignedCiv === civ));
  const canConfirm = selected.length >= needed && civsSatisfied && !civPicker;

  const cardCivs = getCardCivs(card);
  const c = CIV[cardCivs[0]] || CIV.fire;

  const handleManaClick = (mc) => {
    if (mc.tapped) return;
    if (selectedUids.includes(mc.uid)) {
      setSelected(s => s.filter(x => x.uid !== mc.uid));
      return;
    }
    if (selected.length >= needed) return;
    const civs = getCardCivs(mc);
    if (civs.length === 1) {
      setSelected(s => [...s, { uid: mc.uid, assignedCiv: civs[0] }]);
    } else {
      setCivPicker({ uid: mc.uid, civs });
    }
  };

  const handleCivChoice = (civ) => {
    setSelected(s => [...s, { uid: civPicker.uid, assignedCiv: civ }]);
    setCivPicker(null);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:390, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:`linear-gradient(160deg,${c.bg},#08080f)`, border:`2px solid ${c.color}`, borderRadius:14, padding:20, maxWidth:500, width:"100%", boxShadow:`0 0 30px ${c.glow}55`, maxHeight:"90vh", display:"flex", flexDirection:"column", gap:10 }}>

        {/* Header */}
        <div>
          <div style={{ fontFamily:"'Cinzel',serif", color:c.textColor, fontSize:14, fontWeight:900 }}>マナを選択</div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:5 }}>
            <span style={{ fontSize:12, color:"#ccc" }}>{cardCivs.map(cv=>CIV[cv]?.label).join("")} {card.name}</span>
            <span style={{ fontSize:11, color:"#666" }}>コスト {needed}</span>
          </div>
        </div>

        {/* Civ requirement status */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          {requiredCivs.map(civ => {
            const ok = selected.some(s => s.assignedCiv === civ);
            return (
              <div key={civ} style={{ display:"flex", alignItems:"center", gap:3, padding:"2px 8px", borderRadius:6, fontSize:11, fontWeight:700, background:ok?`${CIV[civ]?.color}22`:"rgba(255,80,80,0.08)", border:`1px solid ${ok?CIV[civ]?.color:"#f84"}`, color:ok?CIV[civ]?.textColor:"#f84" }}>
                {ok?"✓":"✗"} {CIV[civ]?.label}
              </div>
            );
          })}
          <div style={{ marginLeft:"auto", fontSize:13, fontWeight:700, color:selected.length>=needed?"#4f8":"#aaa" }}>
            {selected.length} / {needed}
          </div>
        </div>

        {/* Multi-color civ picker */}
        {civPicker && (
          <div style={{ background:"rgba(0,0,0,0.85)", border:"1px solid #555", borderRadius:8, padding:10 }}>
            <div style={{ fontSize:11, color:"#aaa", marginBottom:7 }}>どの文明として使いますか？</div>
            <div style={{ display:"flex", gap:6 }}>
              {civPicker.civs.map(civ => (
                <button key={civ} onClick={() => handleCivChoice(civ)} style={{ padding:"6px 14px", borderRadius:6, fontWeight:700, fontSize:12, background:`${CIV[civ]?.color}33`, border:`1px solid ${CIV[civ]?.color}`, color:CIV[civ]?.textColor, cursor:"pointer" }}>
                  {CIV[civ]?.label}
                </button>
              ))}
              <button onClick={() => setCivPicker(null)} style={{ padding:"6px 10px", borderRadius:6, background:"#222", border:"1px solid #666", color:"#eee", cursor:"pointer", fontSize:12 }}>
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Mana cards */}
        <div>
          <div style={{ fontSize:10, color:"#555", marginBottom:4 }}>マナゾーン（タップで選択 / 再タップで解除）</div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap", minHeight:44 }}>
            {mana.map(mc => {
              const isSel = selectedUids.includes(mc.uid);
              const isDisabled = mc.tapped || (!isSel && selected.length >= needed);
              return (
                <CardFace key={mc.uid} card={mc} selected={isSel} dimmed={isDisabled}
                  onClick={isDisabled ? undefined : () => handleManaClick(mc)} small />
              );
            })}
            {mana.filter(c=>!c.tapped).length===0 && (
              <div style={{ fontSize:11, color:"#333", alignSelf:"center" }}>利用可能なマナがありません</div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => canConfirm && onConfirm(selectedUids)} disabled={!canConfirm}
            style={{ flex:1, padding:"10px", borderRadius:6, fontWeight:700, fontSize:12, background:canConfirm?`linear-gradient(135deg,${c.color}55,${c.color}22)`:"#111", border:`1px solid ${canConfirm?c.color:"#333"}`, color:canConfirm?c.textColor:"#444", cursor:canConfirm?"pointer":"not-allowed" }}>
            ✓ 決定
          </button>
          <button onClick={onCancel} style={{ padding:"10px 14px", borderRadius:6, background:"#111", border:"1px solid #444", color:"#888", cursor:"pointer", fontSize:12 }}>
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
