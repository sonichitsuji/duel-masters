// ===========================
// HANDOFF SCREEN
// ===========================
export function HandoffScreen({from,to,onReady}){
  return(
    <div style={{position:"fixed",inset:0,background:"#000",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:400}}>
      <div style={{fontFamily:"'Cinzel',serif",fontSize:28,color:"#ffe066",letterSpacing:6,marginBottom:12,textShadow:"0 0 20px #ffe066aa"}}>◆◆◆</div>
      <div style={{fontFamily:"'Cinzel',serif",fontSize:24,color:"#ffe066",textShadow:"0 0 20px #ffe066",marginBottom:8}}>画面を渡してください</div>
      <div style={{color:"#555",fontSize:14,marginBottom:32}}>{from} → {to} のターン</div>
      <button onClick={onReady} style={{padding:"14px 48px",borderRadius:10,fontSize:18,fontWeight:900,background:"linear-gradient(135deg,#ffe066,#ff9900)",border:"none",color:"#000",cursor:"pointer",fontFamily:"'Cinzel',serif",letterSpacing:3}}>READY</button>
    </div>
  );
}
