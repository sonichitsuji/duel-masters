export const ALL_KEYWORDS = ["speedAttacker","wBreaker","tBreaker","blocker","cantAttack","sTrigger","drawOnPlay","revolutionChange","gStrike","charger","zRush","escape"];
export const KEYWORD_LABELS = { speedAttacker:"スピードアタッカー", wBreaker:"W・ブレイカー", tBreaker:"T・ブレイカー", blocker:"ブロッカー", cantAttack:"攻撃不可", sTrigger:"S・トリガー", drawOnPlay:"ドロー(召喚時)", revolutionChange:"革命チェンジ", gStrike:"G・ストライク", charger:"チャージャー", zRush:"Zラッシュ", escape:"エスケープ" };

export const CIV = {
  light:    { label:"光", color:"#f1c40f", glow:"#ffcc44", bg:"#101005", textColor:"#ffdd66" },
  water:    { label:"水", color:"#3498db", glow:"#4488ff", bg:"#020a1a", textColor:"#77aaff" },
  darkness: { label:"闇", color:"#9b59b6", glow:"#aa44ff", bg:"#0a0010", textColor:"#bb88ff" },
  fire:     { label:"火", color:"#e74c3c", glow:"#ff4444", bg:"#1a0505", textColor:"#ff8877" },
  nature:   { label:"自", color:"#27ae60", glow:"#44ff88", bg:"#021008", textColor:"#88ff99" },
};
export const CIVS = Object.keys(CIV);

export const ZONES = ["hand","battle","mana","grave","shield","deck"];
export const ZONE_LABELS = { hand:"手札", battle:"バトルゾーン", mana:"マナゾーン", grave:"墓地", shield:"シールド", deck:"山札" };

// ===========================
// EFFECT TEXT (bullet-point display)
// ===========================
export const KEYWORD_PATTERNS = ["スピードアタッカー","W・ブレイカー","T・ブレイカー","ブロッカー","S・トリガー","ハイパーモード","エスケープ","革命チェンジ","ファイナル革命","メガ・ラスト・バースト"];

// ===========================
// EFFECT CONFIRM MODAL
// ===========================
export const EFFECT_TYPE_LABELS = {
  draw:"カードをドロー", handDestroy:"相手の手札を破壊", destroy:"クリーチャーを破壊",
  sendToMana:"クリーチャーをマナゾーンへ", bounce:"クリーチャーを手札に戻す",
  manaReturn:"マナゾーンのカードを手札へ", deckSearch:"山札からカードをサーチ",
  destroyUnder:"パワー以下のクリーチャーを破壊", tapAll:"相手クリーチャーを全タップ",
  deckToMana:"山札の上をマナゾーンへ", destroyMaxPower:"最大パワーの相手クリーチャーを破壊",
};
