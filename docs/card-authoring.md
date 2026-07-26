# カード作成ガイド / 用語集

新しいカードを `public/cards.json` に追加するための、実装済みの語彙（フィールド・キーワード・
トリガー・ステップ型）の一覧です。**このファイルは実装の索引**で、ここに載っている名前は
`cards.json` にデータを書くだけで動きます。載っていない挙動は新規実装（`engine/steps.js` などの拡張）が必要です。

> 出典: `src/constants.js`(keywords) / `src/engine/steps.js`(step型) / `src/engine/effects.js`(単純効果) /
> `src/screens/BattleScreen.jsx`(トリガー). 齟齬があればソースが正。

---

## 1. 追加手順（トークン節約フロー）

1. カード情報を **下記スキーマのJSON**で用意（1枚 or 配列）。`id` は省略可（自動採番）。
2. 追記: `node scripts/add-card.mjs <file.json>`（整形を壊さず末尾に挿入・id自動採番）。
3. 検証: `npm run validate-cards`（JSON妥当性・未知のstep/trigger/keyword・重複name/id・デッキ参照切れを一括チェック）。
4. `npm run build` で最終確認。デッキに入れる場合は `src/decks.js` にidを追加。

---

## 2. カードオブジェクトのフィールド

| フィールド | 必須 | 型 | 説明 |
|---|---|---|---|
| `id` | ○ | number | 一意。`add-card.mjs` が自動採番可 |
| `name` | ○ | string | 一意（重複は validate で警告） |
| `type` | ○ | string | §3参照 |
| `civ` | ○ | string \| string[] | 文明。多色は配列 `["light","fire"]` |
| `cost` | ○ | number | マナコスト |
| `power` | ○ | number | クリーチャー以外は 0 |
| `race` | ○ | string \| null | 種族。複数は `/` 区切り |
| `keywords` | ○ | string[] | §3のキーワードID |
| `effect` | ○ | string | 表示用テキスト（改行 `\n`） |
| `autoEffect` | ○ | object \| null | 「出た時/唱えた時」等。§4 |
| `triggers` | | object[] | 誘発能力の配列。§5 |
| その他 | | | 常在/付与/ハイパー等。§8 |

**文明コード**: `light` `water` `darkness` `fire` `nature`（表示順もこの順）。

---

## 3. type とキーワード

**type**: `creature` / `evo_creature`(進化) / `spell` / `twinpact`(両面) / `tamaseed`(タマシード) / `castle`(G城・表向きシールド)
- `tamaseed` はBZに出る非クリーチャー永続（攻撃不可・パワー無し・エレメント扱い）。
- `castle` はプレイ時に**表向きシールド**として置かれ、表向きの間 `triggers` が有効。

**keywords（ALL_KEYWORDS）**:
`speedAttacker` `wBreaker` `tBreaker` `blocker` `cantAttack` `sTrigger` `drawOnPlay`
`revolutionChange` `gStrike` `charger` `zRush` `escape` `slayer`

「エレメント」= creature/evo_creature/tamaseed（バウンス等の対象判定）。

---

## 4. autoEffect（出た時 / 唱えた時）と効果の形

`autoEffect` は主に「出た時(creature)」「唱えた時(spell)」の効果。形は3種:

```jsonc
// (a) 多段ステップ（最も一般的）: 上から順に解決
"autoEffect": { "trigger":"play", "type":"steps", "steps":[ {"type":"drawCards","amount":1} ] }
// trigger は "play"(クリーチャー/タマシード出た時) か "cast"(呪文唱えた時)

// (b) テンプレ選択（○回、同じものを選んでよい）
"autoEffect": { "trigger":"cast", "type":"chooseTimes", "count":2, "templates":[
  { "label":"…", "steps":[ … ] }, { "label":"…", "steps":[ … ] } ] }

// (c) 単純効果（§7の type。選択UIは自動で開く）
"autoEffect": { "trigger":"cast", "type":"destroy", "target":"opponent", "amount":1 }
```

`triggers[].effect` も同じ3形が使える。呪文の複数能力は**1つの steps 配列**に上から並べる（順序固定）。

---

## 5. triggers（誘発能力）: `on` の一覧

```jsonc
"triggers":[
  { "on":"attack", "optional":true, "hyperOnly":false,
    "condition":{ "type":"civicCount","civ":"light","count":5 },
    "effect":{ "type":"steps","steps":[ … ] } }
]
```
- `optional`: 「〜してもよい」。`hyperOnly`: ハイパーモード時のみ。
- `condition`: `{type:"civicCount",civ,count}`（自分のその文明のクリーチャー/タマシード数≧count）または `{flag:"shieldAddedThisTurn"}`。

**`on` の値**（発火契機）:

| on | 契機 |
|---|---|
| `selfCreaturePlay` / `opponentCreaturePlay` | 自分/相手のクリーチャーが出た時 |
| `attack` | このクリーチャー自身が攻撃する時 |
| `ownCreatureAttack` | 自分のクリーチャーが攻撃する時（各ターン初回のみ発火・監視用。G城等） |
| `selfDraw` | 自分がカードを引いた時 |
| `shieldLeave` / `shieldAdded` | 自分のシールドが離れた/置かれた時 |
| `opponentDiscard` | 相手が手札を捨てた時 |
| `leave` / `destroyed` / `battleDestroy` | このカード自身が 離れた/破壊された/バトルで破壊された 時 |
| `selfCreatureLeave` / `opponentCreatureLeave` | 自分/相手のクリーチャーが離れた時（監視） |
| `selfBattleDestroy` / `opponentBattleDestroy` | 自分/相手のクリーチャーがバトルで破壊された時（監視。subject=そのカード） |
| `selfCreatureDestroyed` / `opponentCreatureDestroyed` | 同上（破壊全般） |
| `endOfTurn` | 各ターンの終わり（`hyperOnly`/`condition` と併用可） |

---

## 6. ステップ型カタログ（`steps[].type`）

共通パラメータ: `label`(表示文), `optional`(スキップ可), `target`("opponent"|"self"),
`filter`(`{civ,maxCost,raceContains,nameContains,keyword,type,element,creatureOnly,multiColor}`), `amount`, `maxCost`。

**ドロー/山札**
- `drawCards` {amount} — ○枚引く
- `drawPerFilter` {filter} — 条件一致のクリーチャー1体につき1枚引く
- `drawCardsPerTappedOpponent` — 相手のタップ数だけ引く
- `discardHandDrawPlusOne` — 手札を全捨てし+1枚引く
- `revealDeckTop` {amount} → `chooseFromRevealed` {filter,destination,amount,takeAll} → `restRevealedToBottom` — 山札公開→選ぶ→残りを下へ
- `playFromRevealed` {filter} — 公開の中から踏み倒し
- `millTop` {amount} / `millTopToMana` {amount} / `millTopToManaIfDragon` — 墓地/マナ落とし
- `searchSpellToTop` — 山札から呪文を上に（無ければシャッフル）
- `deckToMana` は§7（単純効果）

**破壊/除去/バトル**
- `destroyChooseAny` — 全体から1体破壊（誰でも）
- `destroyNonColor` {color} — 指定色以外を全破壊
- `debuffOpponentPower` {amount} — 相手1体に-パワー（0以下で破壊。このターン）
- `battleOpponentCreature` — このクリーチャーと相手1体をバトル
- `breakOpponentShieldChoice` — 相手シールドを1つブレイク（ETBバトル勝利時など）
- `tapAllOpponent` / `tapSelectCreature` {target} / `tapOrUntapSelectCreature` / `untapSelectCreature` {tempBuff}
- `tapNoUntapNextTurn` — 相手1体タップし次の相手ターンに起きない
- （単純効果の `destroy`/`destroyUnder` も §7）

**手札/バウンス**
- `bounceSelectCreature` {target} — 選んで手札へ
- `bounceElement` — 相手のエレメント（creature/tamaseed）1つを手札へ
- `bounceMaxCost` {maxCost} — コスト以下を手札へ
- `handDiscard` {target} — 手札を選んで捨てる
- `randomDiscardOpponent` — 相手手札を見ないで1枚捨てさせる

**シールド**
- `shieldizeTopDeck` — 山札上1枚をシールド化
- `shieldizeFromHand` — 手札1枚をシールド化
- `shieldizeOpponentCreature` — 相手クリーチャー1体を相手のシールドへ
- `returnShieldToHand` — 自分のシールド1つを手札へ（S・トリガー不使用）
- `selectShieldToGrave` {target} — シールドを墓地へ

**踏み倒し/召喚（手札・マナ・墓地・場から）**
- `putFilteredFromHand` {filter,tempKeyword} — 手札から条件一致を出す（例: ヘブンズ・ゲート=ブロッカー）
- `putFromHandFreeUnderHandCount` — 手札枚数以下コストの「クリーチャー以外」を踏み倒し
- `playLightCreatureFromHand` {maxCost} — 光のコスト○以下クリーチャーを手札から出す
- `manaCreatureSelectToBZ` — マナのクリーチャーをBZへ
- `bzSelectToMana` {target} — BZのクリーチャーをマナへ
- `reviveFilteredFromGrave` {filter} — 墓地から出す（SA付与＋ターン終了に破壊）
- `reviveFromDestroyedOwnerGrave` — 直前に破壊されたクリーチャーの持ち主の墓地から出す
- `reviveSelfFromGrave` — 墓地にいるこのカード自身を出す（DARK MEMORY）
- `scheduleReviveSubjectEndOfTurn` — 「そのクリーチャー」をターン終了時に墓地から出す（subject使用）

**呪文詠唱**
- `castFilteredSpellFromHand` {filter} — 手札の呪文を無償で唱える
- `castFreeSTriggerSpellFromHand` — 手札のS・トリガー呪文を無償で唱える

**マナ/バフ/その他**
- `untapAllMana` — マナ全アンタップ
- `grantTempBuffToSelf` {power,keywords,expires} — 自分1体に一時バフ
- `grantSAUntapAfterAttack` / `setUntapAfterAttack` — SA付与＆攻撃後アンタップ 等
- `optionalReviveFromMilled` — 墓地送りにした中から出す

---

## 7. 単純効果 type（`type:"steps"` 以外の autoEffect / trigger effect）

`draw` `destroy` `handDestroy` `sendToMana` `bounce` `manaReturn` `deckSearch`
`destroyUnder`(threshold) `tapAll` `deckToMana`
- 共通: `target:"opponent"|"self"`, `amount`。選択が要る物は自動でモーダルが開く。
- 例: `{ "type":"destroy", "target":"opponent", "amount":1 }`（ハーデスのオシオキムーン）。

---

## 8. 常在・付与・ハイパー等のフィールド

- `grantKeywords`: `[{ keyword, filter?, condition? }]` — 自軍などにキーワード付与。
  `filter`: `{notSelf, raceContains, multiColor, nameContains, elementOnly}`。`condition`: civicCount/flag。
- `grantPowerBoost` / `grantPowerBoostGrave` / `selfPowerBoostGrave` — パワー付与（墓地参照可）。
- `condPower`: `[{condition,amount}]` — 条件付き自己パワー（例: シビルカウント5で+10000）。
- `costReduce`: `{amount, filter:{civ|raceContains|nameContains}, min}` — 自分のプレイコスト軽減。
- `revolutionChangeCond`: `{civs?, race?/races?, minCost?, minPower?, multiColor?, nameContains?}` — 革命チェンジ条件。
- `finalRevolution`: `{effect}` — ファイナル革命。`alternateCost`: `{cost,civs,condition}`。`gZero`: `{nameContains,raceContains}`。
- `evolution`: `{civFilter,raceContains}`（進化元条件）。
- ハイパー: `hyperPower`, `hyperKeywords`, `hyperOnAttack`, `hyperOnTargeted`, `hyperUnlock:{type:"tapOwnCreature",count}`。
- `zRush`(bool), `escape`(keyword), `cantAttackPlayer`(bool), `faceUpLeaveTo:"grave"`(G城の離脱置換),
  `reactivePassive:{type:"cantAttackUntilControllerTurn"}`, `endOfTurnEffect:{type:"untapOthers"|"destroySelf"}`,
  `staticDeny:{type:"cantPutCreature"}`（常在の枠組み）。
- `spellSide`（twinpact用）: `{name,cost,civ,keywords,effect,autoEffect}`。

---

## 9. テンプレ & 実例

```jsonc
// 単純クリーチャー（効果なし）
{ "id":0,"name":"サンプル","type":"creature","civ":"fire","race":"ヒューマノイド",
  "cost":3,"power":3000,"keywords":["speedAttacker"],"effect":"スピードアタッカー","autoEffect":null }

// 出た時ドロー＋攻撃時に条件ドロー、誘発持ち
{ "id":0,"name":"サンプル2","type":"creature","civ":"light","race":"メカ",
  "cost":5,"power":5500,"keywords":["blocker"],
  "effect":"ブロッカー\nこのクリーチャーが出た時、カードを1枚引く。",
  "autoEffect":{"trigger":"play","type":"steps","steps":[{"type":"drawCards","amount":1,"label":"1枚引く"}]},
  "triggers":[{"on":"attack","optional":true,
    "effect":{"type":"steps","steps":[{"type":"drawPerFilter","filter":{"creatureOnly":true,"maxCost":4},"optional":true}]}}] }
```
