import { useState, useEffect } from "react";
import INITIAL_CARD_DB from "../public/cards.json";
import { DECK_BOLSHACK, DECK_MIRADANTE, DECK_HEAVENS } from "./decks";
import { BattleScreen } from "./screens/BattleScreen";
import { MenuScreen } from "./screens/MenuScreen";

// ===========================
// ROOT (with localStorage)
// ===========================
export default function App(){
  // Load from localStorage or use defaults
  const [cardDb, setCardDb] = useState(() => {
    try {
      const saved = localStorage.getItem("dm_cardDb");
      return saved ? JSON.parse(saved) : INITIAL_CARD_DB;
    } catch { return INITIAL_CARD_DB; }
  });

  const [decks, setDecks] = useState(() => {
    try {
      const saved = localStorage.getItem("dm_decks");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { name:"サンプルデッキA (ボルシャック)", ids:DECK_BOLSHACK },
      { name:"サンプルデッキB (ミラダンテ)", ids:DECK_MIRADANTE },
      { name:"サンプルデッキC (光 超化獣)", ids:DECK_HEAVENS },
    ];
  });

  const [p1DeckIdx, setP1DeckIdx] = useState(() => {
    try { const s=localStorage.getItem("dm_p1DeckIdx"); return s!==null?Number(s):0; } catch { return 0; }
  });

  const [p2DeckIdx, setP2DeckIdx] = useState(() => {
    try { const s=localStorage.getItem("dm_p2DeckIdx"); return s!==null?Number(s):1; } catch { return 1; }
  });

  const [gameState, setGameState] = useState(null);

  // Persist to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem("dm_cardDb", JSON.stringify(cardDb)); } catch {}
  }, [cardDb]);

  useEffect(() => {
    try { localStorage.setItem("dm_decks", JSON.stringify(decks)); } catch {}
  }, [decks]);

  useEffect(() => {
    try { localStorage.setItem("dm_p1DeckIdx", String(p1DeckIdx)); } catch {}
  }, [p1DeckIdx]);

  useEffect(() => {
    try { localStorage.setItem("dm_p2DeckIdx", String(p2DeckIdx)); } catch {}
  }, [p2DeckIdx]);

  if (gameState) {
    return <BattleScreen p1DeckIds={gameState.p1Ids} p2DeckIds={gameState.p2Ids} cardDb={cardDb} onBackToMenu={()=>setGameState(null)}/>;
  }
  return (
    <MenuScreen
      cardDb={cardDb} setCardDb={setCardDb}
      decks={decks} setDecks={setDecks}
      p1DeckIdx={p1DeckIdx} setP1DeckIdx={setP1DeckIdx}
      p2DeckIdx={p2DeckIdx} setP2DeckIdx={setP2DeckIdx}
      onStartGame={(p1Ids,p2Ids)=>setGameState({p1Ids,p2Ids})}
    />
  );
}
