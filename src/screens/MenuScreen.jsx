import { useState } from "react";
import { CardManager } from "./CardManager";
import { DeckSheetReader } from "./DeckSheetReader";
import { DeckEditor } from "./DeckEditor";

// ===========================
// MENU SCREEN (redesigned)
// ===========================
export function MenuScreen({cardDb,setCardDb,decks,setDecks,p1DeckIdx,setP1DeckIdx,p2DeckIdx,setP2DeckIdx,onStartGame}){
  const [screen,setScreen]=useState("main");
  const [editingDeckIdx,setEditingDeckIdx]=useState(null);
  const [sheetIds,setSheetIds]=useState(null);
  const [confirmDeleteDeck,setConfirmDeleteDeck]=useState(null);
  const [hoveredBtn,setHoveredBtn]=useState(null);

  const openNewDeck=()=>{setEditingDeckIdx(null);setScreen("deckEdit");};
  const openEditDeck=idx=>{setEditingDeckIdx(idx);setScreen("deckEdit");};
  const saveDeck=({name,ids})=>{
    if(editingDeckIdx===null){setDecks(d=>[...d,{name,ids}]);}
    else{setDecks(d=>d.map((dk,i)=>i===editingDeckIdx?{name,ids}:dk));}
    setScreen("deckList");
  };

  if(screen==="cardManager") return <CardManager cardDb={cardDb} setCardDb={setCardDb} onClose={()=>setScreen("main")}/>;
  if(screen==="deckSheet") return <DeckSheetReader cardDb={cardDb} onResult={(ids)=>{setSheetIds(ids);setScreen("deckEdit");}} onCancel={()=>setScreen("deckList")}/>;
  if(screen==="deckEdit") return <DeckEditor cardDb={cardDb} initialIds={editingDeckIdx!==null?decks[editingDeckIdx]?.ids:sheetIds||[]} initialName={editingDeckIdx!==null?decks[editingDeckIdx]?.name:""} onSave={saveDeck} onCancel={()=>{setSheetIds(null);setScreen("deckList");}}/>;

  const canStart=decks.length>0&&p1DeckIdx!==null&&p2DeckIdx!==null;

  const MenuBtn=({id,children,onClick,color="#ffe066",icon})=>{
    const hovered=hoveredBtn===id;
    return(
      <button
        onClick={onClick}
        onMouseEnter={()=>setHoveredBtn(id)}
        onMouseLeave={()=>setHoveredBtn(null)}
        style={{
          width:"100%", padding:"14px 20px",
          background: hovered
            ? `linear-gradient(90deg, ${color}22, ${color}11, transparent)`
            : `linear-gradient(90deg, ${color}11, transparent)`,
          border:"none",
          borderLeft: `3px solid ${color}`,
          borderTop: hovered ? `1px solid ${color}44` : "1px solid transparent",
          borderBottom: hovered ? `1px solid ${color}44` : "1px solid transparent",
          borderRight: "none",
          color: hovered ? color : `${color}cc`,
          cursor:"pointer",
          fontSize:15,
          fontWeight:700,
          fontFamily:"'Rajdhani','Noto Sans JP',sans-serif",
          letterSpacing:2,
          textAlign:"left",
          display:"flex",
          alignItems:"center",
          gap:12,
          transition:"all 0.15s",
          boxShadow: hovered ? `inset 0 0 20px ${color}11, 0 0 12px ${color}22` : "none",
          transform: hovered ? "translateX(4px)" : "none",
        }}
      >
        <span style={{fontSize:13,width:24,textAlign:"center",fontFamily:"'Cinzel',serif",fontWeight:900,opacity:0.7}}>{icon}</span>
        {children}
        <span style={{marginLeft:"auto",opacity:hovered?1:0,transition:"opacity 0.15s",fontSize:12}}>▶</span>
      </button>
    );
  };

  const DeckSelectBtn=({deck,idx,selected,color,onClick})=>{
    const hovered=hoveredBtn===`deck-${color}-${idx}`;
    return(
      <button
        onClick={onClick}
        onMouseEnter={()=>setHoveredBtn(`deck-${color}-${idx}`)}
        onMouseLeave={()=>setHoveredBtn(null)}
        style={{
          padding:"10px 14px", borderRadius:4,
          textAlign:"left",
          background: selected ? `linear-gradient(90deg,${color}22,${color}08)` : hovered ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.3)",
          border: selected ? `1px solid ${color}88` : `1px solid ${hovered?"#333":"#1a1a2a"}`,
          color: selected ? color : "#666",
          cursor:"pointer", fontSize:12,
          fontWeight: selected ? 700 : 400,
          display:"flex", justifyContent:"space-between", alignItems:"center",
          transition:"all 0.12s",
          boxShadow: selected ? `0 0 10px ${color}22` : "none",
        }}
      >
        <span>{deck.name}</span>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:10,color:"#444"}}>{deck.ids.length}枚</span>
          {selected&&<span style={{fontSize:10,color,fontWeight:700}}>✓ 選択中</span>}
        </div>
      </button>
    );
  };

  return(
    <div style={{minHeight:"100vh",background:"#020208",fontFamily:"'Noto Sans JP','Segoe UI',sans-serif",color:"#fff",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&family=Cinzel+Decorative:wght@700;900&family=Rajdhani:wght@500;600;700&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:3px;background:#000;}
        ::-webkit-scrollbar-thumb{background:#222;border-radius:2px;}
        @keyframes scanline{0%{transform:translateY(-100%);}100%{transform:translateY(100vh);}}
        @keyframes flicker{0%,100%{opacity:1;}92%{opacity:1;}93%{opacity:0.8;}94%{opacity:1;}}
        @keyframes pulse{0%,100%{opacity:0.6;}50%{opacity:1;}}
        @keyframes rotateBg{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}
      `}</style>

      {/* Animated background */}
      <div style={{position:"fixed",inset:0,zIndex:0,overflow:"hidden",pointerEvents:"none"}}>
        {/* Deep space bg */}
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 30% 20%,#0a001a 0%,#020208 60%)"}}/>
        {/* Grid lines */}
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(80,40,180,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(80,40,180,0.07) 1px,transparent 1px)",backgroundSize:"40px 40px",transform:"perspective(400px) rotateX(30deg)",transformOrigin:"50% 0%"}}/>
        {/* Glow orbs */}
        <div style={{position:"absolute",top:"15%",left:"10%",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,#4400aa18,transparent 70%)",animation:"pulse 4s ease-in-out infinite"}}/>
        <div style={{position:"absolute",top:"40%",right:"5%",width:200,height:200,borderRadius:"50%",background:"radial-gradient(circle,#cc220018,transparent 70%)",animation:"pulse 3s ease-in-out infinite 1s"}}/>
        <div style={{position:"absolute",bottom:"20%",left:"30%",width:250,height:250,borderRadius:"50%",background:"radial-gradient(circle,#004488 18,transparent 70%)",animation:"pulse 5s ease-in-out infinite 2s"}}/>
        {/* Scanline */}
        <div style={{position:"absolute",left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,rgba(100,60,255,0.15),transparent)",animation:"scanline 8s linear infinite",pointerEvents:"none"}}/>
        {/* Diagonal accent lines */}
        <div style={{position:"absolute",top:0,left:"20%",width:1,height:"100%",background:"linear-gradient(180deg,transparent,rgba(80,40,180,0.15),transparent)",transform:"skewX(-20deg)"}}/>
        <div style={{position:"absolute",top:0,right:"25%",width:1,height:"100%",background:"linear-gradient(180deg,transparent,rgba(200,40,40,0.1),transparent)",transform:"skewX(-20deg)"}}/>
      </div>

      {/* Content */}
      <div style={{position:"relative",zIndex:1,flex:1,display:"flex",flexDirection:"column",maxWidth:520,margin:"0 auto",width:"100%",padding:"0 0 24px"}}>

        {/* Header / Logo area */}
        <div style={{padding:"36px 20px 24px",textAlign:"center",position:"relative"}}>
          {/* Top accent line */}
          <div style={{position:"absolute",top:0,left:"10%",right:"10%",height:1,background:"linear-gradient(90deg,transparent,#6633ff88,#ff333388,transparent)"}}/>

          {/* Sub label */}
          <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:11,letterSpacing:6,color:"#4433aa",marginBottom:10,fontWeight:600}}>
            — CARD GAME SIMULATOR —
          </div>

          {/* Main logo */}
          <div style={{position:"relative",display:"inline-block",marginBottom:6}}>
            {/* Glow behind logo */}
            <div style={{position:"absolute",inset:-20,background:"radial-gradient(ellipse,#6600ff18,transparent 70%)",filter:"blur(10px)"}}/>
            <div style={{
              fontFamily:"'Cinzel Decorative',serif",
              fontSize:32,
              fontWeight:900,
              color:"#fff",
              textShadow:"0 0 20px #8844ff, 0 0 40px #6622cc88, 0 2px 0 #000",
              letterSpacing:3,
              lineHeight:1,
              position:"relative",
            }}>DUEL</div>
            <div style={{
              fontFamily:"'Cinzel Decorative',serif",
              fontSize:20,
              fontWeight:700,
              background:"linear-gradient(90deg,#ff4444,#ff8800,#ff4444)",
              WebkitBackgroundClip:"text",
              WebkitTextFillColor:"transparent",
              letterSpacing:8,
              textShadow:"none",
              filter:"drop-shadow(0 0 8px #ff440066)",
              position:"relative",
            }}>MASTERS</div>
          </div>

          {/* Version tag */}
          <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:10,color:"#332255",letterSpacing:3,marginTop:8}}>SIMULATOR v6.0</div>

          {/* Bottom accent */}
          <div style={{marginTop:16,height:1,background:"linear-gradient(90deg,transparent,#6633ff44,#ff333344,transparent)"}}/>
        </div>

        {/* Main content */}
        <div style={{flex:1,overflowY:"auto",padding:"0 16px",display:"flex",flexDirection:"column",gap:20}}>

          {screen==="main"&&(
            <>
              {/* Deck select panel */}
              <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid #1a1a3a",borderRadius:2,overflow:"hidden"}}>
                {/* Panel header */}
                <div style={{padding:"8px 14px",background:"linear-gradient(90deg,#1a0a3a,#0a0818)",borderBottom:"1px solid #2a1a4a",display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:"#6633ff",boxShadow:"0 0 6px #6633ff"}}/>
                  <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:13,fontWeight:600,letterSpacing:3,color:"#8866cc"}}>DECK SELECT</span>
                </div>

                <div style={{padding:"14px"}}>
                  {[{pid:"p1",label:"PLAYER 1",icon:"P1",color:"#44aaff"},{pid:"p2",label:"PLAYER 2",icon:"P2",color:"#ff6644"}].map(({pid,label,icon,color})=>{
                    const idx=pid==="p1"?p1DeckIdx:p2DeckIdx;
                    const setIdx=pid==="p1"?setP1DeckIdx:setP2DeckIdx;
                    return(
                      <div key={pid} style={{marginBottom:14}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                          <div style={{width:2,height:14,background:color,boxShadow:`0 0 4px ${color}`}}/>
                          <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:12,fontWeight:700,letterSpacing:3,color}}>{icon} {label}</span>
                        </div>
                        {decks.length===0?(
                          <div style={{fontSize:11,color:"#333",padding:"10px 12px",background:"#050510",borderRadius:2,border:"1px solid #111",fontFamily:"'Rajdhani',sans-serif",letterSpacing:1}}>
                            デッキがありません
                          </div>
                        ):(
                          <div style={{display:"flex",flexDirection:"column",gap:3}}>
                            {decks.map((dk,i)=>(
                              <DeckSelectBtn key={i} deck={dk} idx={i} selected={idx===i} color={color} onClick={()=>setIdx(i)}/>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Start button */}
              <button
                onClick={()=>canStart&&onStartGame(decks[p1DeckIdx].ids,decks[p2DeckIdx].ids)}
                onMouseEnter={()=>setHoveredBtn("start")}
                onMouseLeave={()=>setHoveredBtn(null)}
                style={{
                  width:"100%", padding:"18px",
                  background: canStart
                    ? hoveredBtn==="start"
                      ? "linear-gradient(135deg,#ffcc00,#ff8800,#ff4400)"
                      : "linear-gradient(135deg,#ddaa00,#cc6600,#cc2200)"
                    : "#0a0a14",
                  border: canStart ? "none" : "1px solid #1a1a2a",
                  borderRadius:2,
                  color: canStart ? "#000" : "#222",
                  cursor: canStart ? "pointer" : "not-allowed",
                  fontFamily:"'Cinzel Decorative',serif",
                  fontSize:16,
                  fontWeight:900,
                  letterSpacing:4,
                  boxShadow: canStart
                    ? hoveredBtn==="start" ? "0 0 30px #ff880066, 0 4px 20px #00000088" : "0 0 16px #cc660044"
                    : "none",
                  transform: hoveredBtn==="start"&&canStart ? "scale(1.01)" : "none",
                  transition:"all 0.15s",
                  textShadow: canStart ? "0 1px 2px rgba(0,0,0,0.5)" : "none",
                }}
              >
                {canStart ? "▶  DUEL  START" : "— SELECT DECKS TO START —"}
              </button>

              {/* Nav buttons */}
              <div style={{display:"flex",flexDirection:"column",gap:2,border:"1px solid #1a1a2a",borderRadius:2,overflow:"hidden"}}>
                <MenuBtn id="deck" onClick={()=>setScreen("deckList")} color="#ffe066" icon="◈">デッキ管理</MenuBtn>
                <div style={{height:1,background:"#0f0f1a"}}/>
                <MenuBtn id="card" onClick={()=>setScreen("cardManager")} color="#44aaff" icon="◈">カード管理</MenuBtn>
              </div>
            </>
                      )}

          {/* Deck list */}
          {screen==="deckList"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:2,height:16,background:"#ffe066",boxShadow:"0 0 4px #ffe066"}}/>
                  <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:14,fontWeight:700,letterSpacing:3,color:"#ffe066"}}>DECK LIST</span>
                </div>
                <button onClick={()=>setScreen("main")} style={{padding:"5px 12px",borderRadius:2,background:"transparent",border:"1px solid #667",color:"#ddd",cursor:"pointer",fontSize:11,fontFamily:"'Rajdhani',sans-serif",letterSpacing:1}}>← BACK</button>
              </div>

              <div style={{display:"flex",gap:8,marginBottom:12}}>
                {[{label:"＋ 新規作成",color:"#44ff88",onClick:openNewDeck},{label:"シート読込",color:"#44aaff",onClick:()=>setScreen("deckSheet")}].map(({label,color,onClick})=>(
                  <button key={label} onClick={onClick} style={{flex:1,padding:"10px",borderRadius:2,background:`${color}0a`,border:`1px solid ${color}44`,color,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'Rajdhani',sans-serif",letterSpacing:1,transition:"all 0.12s"}}>{label}</button>
                ))}
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {decks.map((dk,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"rgba(255,255,255,0.02)",border:"1px solid #1a1a2a",borderRadius:2,borderLeft:"2px solid #ffe06633"}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#ddd",fontFamily:"'Rajdhani',sans-serif",letterSpacing:1}}>{dk.name}</div>
                      <div style={{fontSize:10,color:"#444",letterSpacing:1}}>{dk.ids.length} CARDS</div>
                    </div>
                    <button onClick={()=>openEditDeck(i)} style={{padding:"4px 10px",borderRadius:2,background:"rgba(255,224,102,0.08)",border:"1px solid #ffe06633",color:"#ffe066",cursor:"pointer",fontSize:11}}>編集</button>
                    <button onClick={()=>setConfirmDeleteDeck(i)} style={{padding:"4px 10px",borderRadius:2,background:"rgba(255,80,80,0.08)",border:"1px solid #f8444433",color:"#f84",cursor:"pointer",fontSize:11}}>削除</button>
                  </div>
                ))}
                {decks.length===0&&(
                  <div style={{color:"#222",fontSize:12,textAlign:"center",padding:32,fontFamily:"'Rajdhani',sans-serif",letterSpacing:2}}>NO DECKS FOUND</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"12px 16px 0",textAlign:"center"}}>
          <div style={{height:1,background:"linear-gradient(90deg,transparent,#1a1a3a,transparent)",marginBottom:10}}/>
          <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:10,color:"#1a1a2a",letterSpacing:3}}>DUEL MASTERS SIMULATOR — LOCAL 2P EDITION</div>
        </div>
      </div>

      {/* Delete confirm modal */}
      {confirmDeleteDeck!==null&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:800,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"#08080f",border:"1px solid #f8444444",borderRadius:4,padding:24,maxWidth:320,width:"100%"}}>
            <div style={{color:"#f84",fontWeight:700,fontSize:14,marginBottom:8,fontFamily:"'Rajdhani',sans-serif",letterSpacing:2}}>DELETE DECK</div>
            <div style={{color:"#888",fontSize:12,marginBottom:20}}>「{decks[confirmDeleteDeck]?.name}」を削除しますか？</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setDecks(d=>d.filter((_,i)=>i!==confirmDeleteDeck));if(p1DeckIdx===confirmDeleteDeck)setP1DeckIdx(null);if(p2DeckIdx===confirmDeleteDeck)setP2DeckIdx(null);setConfirmDeleteDeck(null);}} style={{flex:1,padding:"9px",borderRadius:2,background:"#1a0505",border:"1px solid #f84",color:"#f84",cursor:"pointer",fontWeight:700,fontSize:12}}>削除する</button>
              <button onClick={()=>setConfirmDeleteDeck(null)} style={{flex:1,padding:"9px",borderRadius:2,background:"#0a0a14",border:"1px solid #222",color:"#555",cursor:"pointer",fontSize:12}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
