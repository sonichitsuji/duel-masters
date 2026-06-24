import { CardFace } from "../CardFace";

// ===========================
// REPLACEMENT MODAL（置換効果の確認）
// 「○○する代わりに△△する」系の置換が発動する時に必ず挟む。
// ユーザーは「置換を適用」または「例外処理で中止（置換せず元の挙動）」を選べる。
// modal: { title, message, card?, applyLabel?, cancelLabel? }
// ===========================
export function ReplacementModal({ modal, onApply, onCancel }) {
  if (!modal) return null;
  const { title, message, card, applyLabel, cancelLabel } = modal;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:430, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"linear-gradient(160deg,#0a1020,#08080f)", border:"2px solid #66ddff", borderRadius:14, padding:20, maxWidth:400, width:"100%", boxShadow:"0 0 30px #66ddff55" }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:"#66ddff", fontSize:13, fontWeight:900, marginBottom:6, letterSpacing:2 }}>{title || "置換効果"}</div>
        {card && (
          <div style={{ display:"flex", justifyContent:"center", marginBottom:10 }}>
            <CardFace card={card} small />
          </div>
        )}
        <div style={{ fontSize:12, color:"#cde", marginBottom:14, lineHeight:1.5, whiteSpace:"pre-wrap" }}>{message}</div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onApply} style={{ flex:1, padding:"10px", borderRadius:6, fontWeight:700, fontSize:12, background:"linear-gradient(135deg,#66ddff55,#66ddff22)", border:"1px solid #66ddff", color:"#66ddff", cursor:"pointer", fontFamily:"'Cinzel',serif" }}>
            {applyLabel || "置換を適用"}
          </button>
          <button onClick={onCancel} style={{ padding:"10px 14px", borderRadius:6, background:"#1a0a0a", border:"1px solid #aa5555", color:"#e88", cursor:"pointer", fontSize:12, fontWeight:700 }}>
            {cancelLabel || "例外処理で中止"}
          </button>
        </div>
        <div style={{ fontSize:9, color:"#555", marginTop:8, textAlign:"center" }}>「例外処理で中止」を選ぶと置換は行われず、元の処理のまま進みます</div>
      </div>
    </div>
  );
}
