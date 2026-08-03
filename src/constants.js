export const ALL_KEYWORDS = ["speedAttacker","wBreaker","tBreaker","blocker","cantAttack","sTrigger","drawOnPlay","revolutionChange","gStrike","charger","zRush","escape","slayer","guardman","unselectable"];
export const KEYWORD_LABELS = { speedAttacker:"スピードアタッカー", wBreaker:"W・ブレイカー", tBreaker:"T・ブレイカー", blocker:"ブロッカー", cantAttack:"攻撃不可", sTrigger:"S・トリガー", drawOnPlay:"ドロー(召喚時)", revolutionChange:"革命チェンジ", gStrike:"G・ストライク", charger:"チャージャー", zRush:"Zラッシュ", escape:"エスケープ", slayer:"スレイヤー", guardman:"ガードマン", unselectable:"相手に選ばれない" };

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

// カード種別ラベル（タマシード/G城など、パワーを持たない永続/シールド系を含む）
export const CARD_TYPE_LABELS = { creature:"クリーチャー", evo_creature:"進化クリーチャー", spell:"呪文", twinpact:"ツインパクト", tamaseed:"タマシード", castle:"城", field:"フィールド" };
// 「エレメント」= クリーチャーまたはタマシード（バウンス等の対象判定に使用）
export const ELEMENT_TYPES = ["creature","evo_creature","tamaseed","field"];

// ===========================
// EFFECT TEXT (bullet-point display)
// ===========================
export const KEYWORD_PATTERNS = ["スピードアタッカー","W・ブレイカー","T・ブレイカー","ブロッカー","S・トリガー","ハイパーモード","エスケープ","革命チェンジ","ファイナル革命","メガ・ラスト・バースト"];

// ===========================
// EFFECT CONFIRM MODAL
// ===========================
// label を書いていない効果ステップを日本語で表示するための既定文言。
// 誘発した能力の中身を解決前に確認するのに使うので、cards.json で使う type は一通り埋めておく。
export const EFFECT_TYPE_LABELS = {
  // ドロー・手札
  drawCards:"カードを引く", draw:"カードをドロー", handToGrave:"手札を捨てる",
  handDestroy:"相手の手札を破壊", handToBz:"手札からバトルゾーンへ出す",
  // バトルゾーン
  destroy:"クリーチャーを破壊", destroyUnder:"パワー以下のクリーチャーを破壊",
  destroyMaxPower:"最大パワーの相手クリーチャーを破壊", battle:"バトルする",
  bzToHand:"クリーチャーを手札に戻す", bounce:"クリーチャーを手札に戻す",
  bzToMana:"クリーチャーをマナゾーンへ", sendToMana:"クリーチャーをマナゾーンへ",
  bzToDeck:"クリーチャーを山札へ", bzToShield:"クリーチャーをシールドへ",
  tap:"タップする", untap:"アンタップする", tapAll:"相手クリーチャーを全タップ",
  powerBuff:"パワーを変更する", grant:"能力を与える",
  // マナ・墓地・山札
  manaToHand:"マナゾーンのカードを手札へ", manaReturn:"マナゾーンのカードを手札へ",
  manaToGrave:"マナゾーンのカードを墓地へ", topToMana:"山札の上をマナゾーンへ",
  deckToMana:"山札の上をマナゾーンへ", topToGrave:"山札の上を墓地へ",
  graveToBz:"墓地からバトルゾーンへ出す", graveToHand:"墓地から手札へ",
  graveToDeckBottom:"墓地を山札の下へ", shuffleDeck:"山札をシャッフルする",
  search:"山札からカードをサーチ", deckSearch:"山札からカードをサーチ",
  // シールド・その他
  addShield:"シールドを追加する", shieldToHand:"シールドを手札へ",
  shieldToGrave:"シールドを墓地へ", breakShield:"シールドをブレイク",
  meteorBurn:"メテオバーン（下のカードを動かす）", castFromGrave:"墓地から唱える",
  grantSummonFrom:"召喚できるゾーンを増やす", winGame:"ゲームに勝つ",
};
