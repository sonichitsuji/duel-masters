import { CIV } from "../../constants";
import { getCardCivs, getEffectiveCost } from "../../gameLogic";
import { CardFace } from "../CardFace";

// ===========================
// ZONE VIEW MODAL（墓地／マナゾーンの中身を見る）
// 召喚許可（summonFrom / turnSummonFrom）があるカードには「召喚」ボタンが出る。
// entries: [{ card, idx, perm, payable }]  perm が null なら閲覧のみ
// ===========================
const ZONE_META = {
  grave: { label: "墓地",       color: "#b866ff" },
  mana:  { label: "マナゾーン", color: "#27ae60" },
};

export function ZoneViewModal({ zone, entries, ownerState, onSummon, onClose }) {
  const meta = ZONE_META[zone] || ZONE_META.grave;
  const summonable = entries.filter(e => e.perm);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"linear-gradient(160deg,#0b0b1a,#08080f)", border:`2px solid ${meta.color}`, borderRadius:14, padding:20, maxWidth:640, width:"100%", boxShadow:`0 0 30px ${meta.color}55`, maxHeight:"88vh", display:"flex", flexDirection:"column", gap:10 }}>
        <div>
          <div style={{ fontFamily:"'Cinzel',serif", color:meta.color, fontSize:14, fontWeight:900, letterSpacing:1 }}>{meta.label} ({entries.length})</div>
          {summonable.length > 0 && (
            <div style={{ fontSize:11, color:"#ffcc66", marginTop:4 }}>
              {summonable.length}体を{meta.label}から召喚できます（コストは通常どおり支払います）
            </div>
          )}
        </div>

        <div style={{ display:"flex", flexWrap:"wrap", gap:8, overflowY:"auto", alignContent:"flex-start", minHeight:60 }}>
          {entries.length === 0 && <div style={{ fontSize:11, color:"#444", alignSelf:"center" }}>カードがありません</div>}
          {entries.map(e => {
            const civs = getCardCivs(e.card);
            const c = CIV[civs[0]] || CIV.fire;
            const cost = getEffectiveCost(e.card, ownerState);
            return (
              <div key={e.card.uid} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, width:80 }}>
                <CardFace card={e.card} small dimmed={!e.perm} />
                {e.perm && (
                  <button onClick={() => e.payable && onSummon(e)} disabled={!e.payable}
                    title={e.payable ? e.perm.label || "召喚する" : "マナが足りません"}
                    style={{ width:"100%", padding:"3px 0", borderRadius:4, fontSize:10, fontWeight:700,
                             background:e.payable?`${c.color}22`:"#111", border:`1px solid ${e.payable?c.color:"#333"}`,
                             color:e.payable?c.textColor:"#444", cursor:e.payable?"pointer":"not-allowed" }}>
                    召喚 ({cost})
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={onClose} style={{ padding:"9px", borderRadius:6, background:"#1a1a2a", border:"1px solid #888", color:"#eee", cursor:"pointer", fontSize:12 }}>
          閉じる
        </button>
      </div>
    </div>
  );
}
