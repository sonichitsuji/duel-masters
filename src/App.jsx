import { useState, useEffect } from "react";
import INITIAL_CARD_DB from "../public/cards.json";
import { DECK_BOLSHACK, DECK_MIRADANTE, DECK_HEAVENS, DECK_DOOM, DECK_ACE } from "./decks";
import { BattleScreen } from "./screens/BattleScreen";
import { MenuScreen } from "./screens/MenuScreen";
import { syncCardIdSeed } from "./gameLogic";

// ===========================
// ROOT (with localStorage)
// ===========================

// 同梱データ（cards.json / decks.js）を更新したら上げる。
// 保存済みの版数と違えば、同梱カードとサンプルデッキを取り込み直す。
const DATA_VERSION = 8;

const SAMPLE_DECKS = [
  { name: "サンプルデッキA (ボルシャック)", ids: DECK_BOLSHACK },
  { name: "サンプルデッキB (ミラダンテ)", ids: DECK_MIRADANTE },
  { name: "サンプルデッキC (光 超化獣)", ids: DECK_HEAVENS },
  { name: "サンプルデッキD (闇水 DOOM墓地進化)", ids: DECK_DOOM },
  { name: "サンプルデッキE (自然 ACEランプ)", ids: DECK_ACE },
];

const readJson = key => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
};

// 同梱カードは常に最新で上書きし、自分で追加したカード(id 201〜)だけ残す
function mergeCardDb(saved) {
  if (!Array.isArray(saved)) return INITIAL_CARD_DB;
  const bundledIds = new Set(INITIAL_CARD_DB.map(c => c.id));
  return [...INITIAL_CARD_DB, ...saved.filter(c => !bundledIds.has(c.id))];
}

// サンプルデッキは同梱の内容で置き換え、自分で作ったデッキは残す
function mergeDecks(saved) {
  if (!Array.isArray(saved)) return SAMPLE_DECKS;
  const sampleNames = new Set(SAMPLE_DECKS.map(d => d.name));
  return [...SAMPLE_DECKS, ...saved.filter(d => !sampleNames.has(d.name))];
}

export default function App() {
  // 保存済みデータの版数が古ければ、同梱データを取り込み直す
  const stale = (() => {
    try { return localStorage.getItem("dm_dataVersion") !== String(DATA_VERSION); }
    catch { return false; }
  })();

  const [cardDb, setCardDb] = useState(() => {
    const saved = readJson("dm_cardDb");
    const db = !saved ? INITIAL_CARD_DB : stale ? mergeCardDb(saved) : saved;
    syncCardIdSeed(db); // 再読み込み後も自作カードのidが衝突しないようにする
    return db;
  });

  const [decks, setDecks] = useState(() => {
    const saved = readJson("dm_decks");
    if (!saved) return SAMPLE_DECKS;
    return stale ? mergeDecks(saved) : saved;
  });

  const clampIdx = i => Math.min(Math.max(0, i), decks.length - 1);
  const [p1DeckIdx, setP1DeckIdx] = useState(() => {
    try { const s = localStorage.getItem("dm_p1DeckIdx"); return s !== null ? clampIdx(Number(s)) : 0; } catch { return 0; }
  });

  const [p2DeckIdx, setP2DeckIdx] = useState(() => {
    try { const s = localStorage.getItem("dm_p2DeckIdx"); return s !== null ? clampIdx(Number(s)) : 1; } catch { return 1; }
  });

  const [gameState, setGameState] = useState(null);

  // Persist to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem("dm_dataVersion", String(DATA_VERSION)); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem("dm_cardDb", JSON.stringify(cardDb)); } catch { /* ignore */ }
  }, [cardDb]);

  useEffect(() => {
    try { localStorage.setItem("dm_decks", JSON.stringify(decks)); } catch { /* ignore */ }
  }, [decks]);

  useEffect(() => {
    try { localStorage.setItem("dm_p1DeckIdx", String(p1DeckIdx)); } catch { /* ignore */ }
  }, [p1DeckIdx]);

  useEffect(() => {
    try { localStorage.setItem("dm_p2DeckIdx", String(p2DeckIdx)); } catch { /* ignore */ }
  }, [p2DeckIdx]);

  if (gameState) {
    return <BattleScreen p1DeckIds={gameState.p1Ids} p2DeckIds={gameState.p2Ids} cardDb={cardDb} onBackToMenu={() => setGameState(null)}/>;
  }
  return (
    <MenuScreen
      cardDb={cardDb} setCardDb={setCardDb}
      decks={decks} setDecks={setDecks}
      p1DeckIdx={p1DeckIdx} setP1DeckIdx={setP1DeckIdx}
      p2DeckIdx={p2DeckIdx} setP2DeckIdx={setP2DeckIdx}
      onStartGame={(p1Ids, p2Ids) => setGameState({ p1Ids, p2Ids })}
    />
  );
}
