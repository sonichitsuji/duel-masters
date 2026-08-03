import { useState } from "react";
import { CardFace } from "../CardFace";

// 攻撃先が決まった後、防御側に「ブロック」と「ガードマン」の機会を提示する。
// blockers: ブロック可能なクリーチャー配列
// guards:   ガードマンで攻撃先を自分に変更できるクリーチャー配列
//           （攻撃先が「自分の他のクリーチャー」の時だけ渡される）
// attackerName: 攻撃クリーチャー名 / targetName: 現在の攻撃先の名前
export function BlockerModal({ blockers, guards, attackerName, targetName, onBlock, onGuard, onDecline }) {
  const [selected, setSelected] = useState(null);   // { mode:"block"|"guard", uid }
  const hasBlockers = blockers && blockers.length > 0;
  const hasGuards = guards && guards.length > 0;
  if (!hasBlockers && !hasGuards) return null;

  const pick = (mode, uid) => setSelected(s => (s && s.mode === mode && s.uid === uid) ? null : { mode, uid });
  const confirm = () => {
    if (!selected) return;
    if (selected.mode === "block") onBlock(selected.uid);
    else onGuard(selected.uid);
  };
  const btnLabel = selected?.mode === "guard" ? "GUARD" : "BLOCK";

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:425, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"linear-gradient(160deg,#0a0a22,#08080f)", border:"2px solid #6688ff", borderRadius:14, padding:20, maxWidth:460, width:"100%", boxShadow:"0 0 30px #6688ff55", maxHeight:"calc(90vh / var(--ui-scale))", overflowY:"auto" }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:"#88aaff", fontSize:13, fontWeight:900, marginBottom:4, letterSpacing:2 }}>BLOCK?</div>
        <div style={{ fontSize:11, color:"#aaa", marginBottom:12 }}>
          「{attackerName}」の攻撃{targetName ? `（攻撃先: ${targetName}）` : ""}。
        </div>

        {hasBlockers && (
          <>
            <div style={{ fontSize:10, color:"#7799dd", marginBottom:5 }}>ブロッカー（タップしてブロックします）</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
              {blockers.map(c => (
                <CardFace key={c.uid} card={c} small
                  selected={selected?.mode==="block" && selected.uid===c.uid}
                  onClick={() => pick("block", c.uid)} />
              ))}
            </div>
          </>
        )}

        {hasGuards && (
          <>
            <div style={{ fontSize:10, color:"#66dd99", marginBottom:5 }}>
              ガードマン（タップして、攻撃先をこのクリーチャーに変更します）
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
              {guards.map(c => (
                <CardFace key={c.uid} card={c} small
                  selected={selected?.mode==="guard" && selected.uid===c.uid}
                  onClick={() => pick("guard", c.uid)} />
              ))}
            </div>
          </>
        )}

        <div style={{ display:"flex", gap:8 }}>
          <button onClick={confirm} disabled={!selected} style={{ flex:1, padding:"10px", borderRadius:6, fontWeight:700, fontSize:13, background:selected?"linear-gradient(135deg,#6688ff55,#6688ff22)":"#111", border:`1px solid ${selected?"#6688ff":"#333"}`, color:selected?"#aaccff":"#444", cursor:selected?"pointer":"not-allowed", fontFamily:"'Cinzel',serif", letterSpacing:1 }}>
            {btnLabel}
          </button>
          <button onClick={onDecline} style={{ padding:"10px 16px", borderRadius:6, background:"#111", border:"1px solid #555", color:"#aaa", cursor:"pointer", fontSize:12 }}>
            何もしない
          </button>
        </div>
      </div>
    </div>
  );
}
