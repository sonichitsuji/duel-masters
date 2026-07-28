import { CIV } from "../../constants";
import { getCardCivs } from "../../gameLogic";

// ===========================
// ACTIVATED ABILITY MODAL（起動型能力）
// 「各ターンに一度〜してもよい」等、プレイヤーが任意のタイミングで使う能力を一覧から選んで発動する。
// entries: [{ key, card, ability }]
// ===========================
export function ActivatedAbilityModal({ entries, onUse, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:410, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"linear-gradient(160deg,#12081e,#08080f)", border:"2px solid #c9f", borderRadius:14, padding:20, maxWidth:460, width:"100%", boxShadow:"0 0 30px #a0f55", maxHeight:"85vh", display:"flex", flexDirection:"column", gap:10 }}>
        <div>
          <div style={{ fontFamily:"'Cinzel',serif", color:"#d9b3ff", fontSize:13, fontWeight:900, letterSpacing:2 }}>ACTIVATED ABILITY</div>
          <div style={{ fontSize:11, color:"#aaa", marginTop:4 }}>使う能力を選んでください。</div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:8, overflowY:"auto" }}>
          {entries.length === 0 && (
            <div style={{ fontSize:11, color:"#666", textAlign:"center", padding:10 }}>今使える能力はありません</div>
          )}
          {entries.map(e => {
            const civs = getCardCivs(e.card);
            const c = CIV[civs[0]] || CIV.fire;
            const once = e.ability.oncePerGame ? "ゲーム中に一度" : e.ability.oncePerTurn ? "各ターンに一度" : null;
            return (
              <button key={e.key} onClick={() => onUse(e)} style={{ textAlign:"left", padding:"10px 12px", borderRadius:8, border:`1px solid ${c.color}88`, background:`${c.color}14`, color:"#fff", cursor:"pointer" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                  <span style={{ fontSize:10, fontWeight:900, color:c.textColor, background:`${c.color}33`, border:`1px solid ${c.color}66`, borderRadius:3, padding:"0 5px" }}>
                    {civs.map(cv => CIV[cv]?.label).join("")}
                  </span>
                  <span style={{ fontWeight:700, fontSize:13 }}>{e.card.name}</span>
                  {e.fromSsx && <span style={{ fontSize:9, fontWeight:900, color:"#c9f" }}>SSX</span>}
                  {once && <span style={{ fontSize:9, color:"#ffcc66", marginLeft:"auto" }}>{once}</span>}
                </div>
                <div style={{ fontSize:11, color:"#bbb", lineHeight:1.4 }}>{e.ability.label || "効果を発動"}</div>
              </button>
            );
          })}
        </div>

        <button onClick={onClose} style={{ padding:"9px", borderRadius:6, background:"#1a1a2a", border:"1px solid #666", color:"#ddd", cursor:"pointer", fontSize:12 }}>
          閉じる
        </button>
      </div>
    </div>
  );
}
