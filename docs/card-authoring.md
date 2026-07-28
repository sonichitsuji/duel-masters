# カード作成ガイド / 用語集

新しいカードを `public/cards.json` に追加するための、実装済みの語彙（フィールド・キーワード・
トリガー・効果）の一覧です。**ここに載っている名前は `cards.json` にデータを書くだけで動きます。**
載っていない挙動は新規実装（`src/engine/effects.js` の拡張）が必要です。

> 出典: `src/constants.js`(keywords) / `src/engine/effects.js`(効果) / `src/screens/BattleScreen.jsx`(トリガー)。
> 齟齬があればソースが正。旧記法（`type:"steps"` / 単純効果 / 旧ステップ名）は**廃止済み**で、
> `npm run validate-cards` がエラーとして検出します。

---

## 1. 追加手順（トークン節約フロー）

1. カード情報を **下記スキーマのJSON**で用意（1枚 or 配列）。`id` は省略可（自動採番）。
2. 追記: `node scripts/add-card.mjs <file.json>`（整形を壊さず末尾に挿入・id自動採番）。
3. 検証: `npm run validate-cards`（JSON妥当性・未知/旧記法の効果・重複name/id・デッキ参照切れ）。
4. `npm run build` で最終確認。デッキに入れる場合は `src/decks.js` にidを追加。

---

## 2. 記法の基本

効果は **`effects` 配列**（上から順に解決）。`"type":"steps"` のような入れ子は不要。

```jsonc
// 出た時(creature/tamaseed) / 唱えた時(spell)
"autoEffect": { "trigger":"play", "effects":[ {"type":"drawCards","amount":1} ] }

// 誘発能力（effects を直接持つ）
"triggers":[ { "on":"attack", "optional":true, "effects":[ … ] } ]

// 唯一の特殊形：○回選んで実行
"autoEffect": { "trigger":"cast", "type":"chooseTimes", "count":2,
  "templates":[ { "label":"…", "effects":[ … ] } ] }
```

### 共通パラメータ（effects の各要素）
| パラメータ | 説明 |
|---|---|
| `label` | モーダルに出す説明文 |
| `optional` | 「〜してもよい」（スキップ可） |
| `target` | **`"self"` / `"opponent"` / `"both"`**（どちらも） |
| `amount` | 数値、**または変数名の文字列**（例 `"count"`）。選択枚数の上限にもなる |
| `filter` | 対象条件（下記） |
| `zone` | 対象ゾーン（`hand` `bz` `mana` `grave` `shield` `deck` `revealed` `lastMoved`） |
| `all` | 条件一致すべてに適用（選択不要） |

**filter**: `civ` `civNot` `raceContains` `nameContains` `keyword` `type`(`creature`/`nonCreature`/`spell`/`tamaseed`…)
`element`(クリーチャー/タマシード) `creatureOnly` `multiColor` `tapped` `maxCost` `minCost` `maxPower` `notNameSelf`
※ `maxCost` 等にも**変数名の文字列**を書けます。

---

## 3. 変数ステップ（variable）

先に数えて／選んでおき、後続の効果が `amount` などで参照します。**加算は行いません**——
「その枚数引く」＋「1枚引く」のように**効果を重ねて**表現します。

| type | 説明 |
|---|---|
| `count` | `{zone,target,filter,as?}` 条件一致の枚数を変数（既定名 `count`）へ |
| `pick` | `{zone,target,filter,as?}` 対象を選んで変数（既定名 `picked`）へ |

```jsonc
// 自分の光のクリーチャー/タマシード1つにつき1枚引く
[ {"type":"count","zone":"bz","target":"self","filter":{"civ":"light","element":true}},
  {"type":"drawCards","amount":"count","optional":true} ]

// 手札を全部捨て、その枚数+1引く（加算不要）
[ {"type":"count","zone":"hand","target":"self"},
  {"type":"handToGrave","target":"self","all":true},
  {"type":"drawCards","amount":"count"},
  {"type":"drawCards","amount":1} ]

// 山札上をマナへ、それがドラゴンならもう1枚（条件分岐も変数で）
[ {"type":"topToMana","amount":1},
  {"type":"count","zone":"lastMoved","filter":{"raceContains":"ドラゴン"}},
  {"type":"topToMana","amount":"count"} ]
```

---

## 4. 命名規則

- **ゾーン移動は `<from>To<To>`**（「出す」「置く」「戻す」「捨てる」）。`play` は使わない。
- **「実行(プレイ)」は `playFromHand`**（呪文なら唱える／クリーチャーなら召喚）。効果で「出す」場合と区別。
- **破壊は `destroy`**（destroyed 誘発を伴うため移動と区別）。

---

## 5. 効果カタログ

**ドロー / 山札**
- `drawCards {amount}` — ○枚引く
- `reveal {amount}` — 山札の上を公開（以降 `revealed*` の対象になる）
- `search {destination,amount,takeAll,filter}` — 山札から探す。`destination`: `hand`/`deckTop`/`bz`/`mana`（実行後シャッフル）
- `topToGrave {amount}` / `topToMana {amount,tapped}` / `topToShield {amount}` — 山札の上を各ゾーンへ

**公開カードの行き先**
- `revealedToHand` / `revealedToBz` / `revealedToMana` / `revealedToGrave` / `revealedToDeckTop` / `revealedToDeckBottom`
  （`filter` `takeAll` `amount` 可。残りを戻すのは `revealedToDeckBottom`）

**手札から**
- `handToBz {filter,amount,tempKeyword,summoningSickness}` — 手札から**出す**
- `handToShield {amount}` — シールド化
- `handToGrave {target,amount,all,random}` — 捨てる（`random`=見ないで選ぶ）
- `playFromHand {free,filter}` — **実行**（呪文=唱える／クリーチャー=召喚／城=表向きシールド化）

**マナから**：`manaToBz {filter}` / `manaToHand {amount}`

**バトルゾーンから**
- `destroy {target,filter,amount,all}` — 破壊
- `bzToHand` / `bzToMana` / `bzToShield`（`target,filter,amount,all`）
- `tap` / `untap` / `tapToggle`（`target,zone,filter,all,noUntapNextTurn`）
- `untapAllMana` — 自分のマナを全アンタップ
- `powerBuff {target,amount,expires,keywords}` — パワー増減（負値で弱体、0以下で破壊）
- `grant {keywords,untapAfterAttack,untap,expires}` — 能力付与
- `battle {target}` — このクリーチャーと相手1体をバトル

**墓地・シールド**
- `graveToBz {filter,owner,self,tempKeywords,destroyAtEndOfTurn,summoningSickness}` — 墓地から出す
  （`owner:"destroyed"`=直前に破壊されたクリーチャーの持ち主、`self:true`=このカード自身）
- `shieldToHand {target}` / `shieldToGrave {target}` / `breakShield {target}`

**遅延**
- `scheduleReviveSubjectEndOfTurn` — 「そのクリーチャー」をターン終了時に墓地から出す

---

## 6. type とキーワード

**type**: `creature` / `evo_creature` / `spell` / `twinpact` / `tamaseed` / `castle`(G城・表向きシールド)

**keywords**: `speedAttacker` `wBreaker` `tBreaker` `blocker` `cantAttack` `sTrigger` `drawOnPlay`
`revolutionChange` `gStrike` `charger` `zRush` `escape` `slayer`

**文明**: `light` `water` `darkness` `fire` `nature`（表示順もこの順）

---

## 7. triggers（誘発能力）

**`on`（イベント名）＋ `target`（誰の）＋ `filter`（どんなカード）** の組み合わせで書きます。

```jsonc
"triggers":[
  { "on":"creaturePutBz", "target":"opponent", "optional":true, "effects":[ … ] },
  { "on":"destroyed", "filter":{"raceContains":"ドラゴン"}, "effects":[ … ] }
]
```

### イベント一覧（`on`）
| on | 契機 |
|---|---|
| `creaturePutBz` | クリーチャーがバトルゾーンに出た時（`method` 指定可） |
| `castSpell` | 呪文を唱えた時 |
| `attack` | クリーチャーが攻撃する時（`firstEachTurn` 指定可） |
| `leave` | カードが離れた時 |
| `destroyed` | 破壊された時 |
| `battleDestroy` | バトルで破壊された時 |
| `draw` | カードを引いた時 |
| `discard` | 手札を捨てた時 |
| `shieldAdded` / `shieldLeave` | シールドが置かれた/離れた時 |
| `endOfTurn` | 各ターンの終わり |

### `target`（誰のイベントに反応するか）
| 値 | 意味 |
|---|---|
| `this` | **このカード自身**のイベント |
| `self` | 自分の |
| `opponent` | 相手の |
| `both` | どちらでも |

**既定値**：カード自身のイベント（`creaturePutBz` `leave` `destroyed` `battleDestroy` `attack`）は **`this`**、
プレイヤーのイベント（`castSpell` `draw` `discard` `shieldAdded` `shieldLeave` `endOfTurn`）は **`self`**。

```jsonc
{"on":"leave"}                      // このクリーチャーが離れた時
{"on":"leave","target":"self"}      // 自分のクリーチャーが離れた時
{"on":"destroyed","target":"opponent"} // 相手のクリーチャーが破壊された時
```

### 追加パラメータ
| パラメータ | 説明 |
|---|---|
| `filter` | 主体カードの条件（効果と同じ filter 語彙）。例 `{"raceContains":"ドラゴン"}` |
| `method` | `creaturePutBz` 専用。`"summon"`(召喚＝プレイして出た) / `"put"`(効果で出された)。未指定なら両方 |
| `firstEachTurn` | `attack` 等で「各ターン最初の1回のみ」 |
| `optional` | 「〜してもよい」 |
| `hyperOnly` | ハイパーモード時のみ発火 |
| `oncePerTurn` | 「各ターンに一度」。実際に解決した時だけ消費（辞退しても消費しない） |
| `oncePerGame` | 「ゲーム中に一度」（終極宣言など） |
| `condition` | `{type:"civicCount",civ,count}` / `{type:"stackCount",count}` / `{flag:"shieldAddedThisTurn"}` |

```jsonc
// 相手が効果でクリーチャーを出した時（召喚は対象外）
{"on":"creaturePutBz","target":"opponent","method":"put","effects":[ … ]}

// 各ターン、はじめて自分のクリーチャーが攻撃する時
{"on":"attack","target":"self","firstEachTurn":true,"effects":[ … ]}

// 相手が呪文を唱えた時
{"on":"castSpell","target":"opponent","effects":[ … ]}

// 各ターンに一度、クリーチャーが出た時、山札の上をシールド化してもよい
{"on":"creaturePutBz","target":"both","oncePerTurn":true,"optional":true,
 "effects":[{"type":"topToShield","amount":1,"label":"山札の上をシールド化"}]}
```

### 任意誘発（`optional`）の確認タイミング

`optional` / `oncePerTurn` の誘発は、**他の任意誘発と同じモーダル**（誘発順序モーダル）で
「発動する／発動しない」を問われます。単独で誘発した場合もモーダルが出ます。
「発動しない」を選んだ能力は `oncePerTurn` を **消費しません**（同ターン中に再び誘発すれば再度問われる）。

## 7.5. 超魂X（SSX / Super Soul Cross）

`ssx` に書いた能力は **そのカードが持つ「通常の能力」**（`keywords` / `triggers` に書いたものと同じ扱い）。
特別なゾーン処理はありません。**SSX 固有のルールは1つだけ**——

> **このカードがクリーチャーの「下」に置かれている間、その上のクリーチャーもこの能力を持つ。**

```jsonc
// 例: ガヤルドスカイ-A3 — 超魂X の「ブロッカー」
{ "name":"ガヤルドスカイ-A3", "type":"creature", "civ":"light", "cost":3, "power":4500,
  "keywords":[],                       // 通常表記の能力は無し
  "ssx": { "keywords":["blocker"] } }  // 超魂X の能力（＝このカードの通常能力）
```

- このカード自身は、`keywords:["blocker"]` と書いたのと同じようにブロッカーとして扱われます。
- **加えて**、このカードを下に持つクリーチャー（進化元など）もブロッカーを得ます。

### `ssx` には任意の「能力フィールド」が書ける

`ssx` の中身は **カード直下に書ける能力フィールドと同じ語彙**です。`keywords` / `triggers` に限らず、
`activated`(§7.6) `costReduce` `condPower` `grantKeywords` `grantPowerBoost` `grantPowerBoostGrave`
`selfPowerBoostGrave` `powerAttacker` `poweredBreaker` `hyperKeywords` `hyperPower` が使えます。
（`id` `name` `cost` `power` `civ` `type` `race` などカードの同一性に関わるものは書けません。）

マージ規則は「配列＝連結／数値＝加算／真偽＝OR」なので、**同じ能力を複数持つ**ことも、
**下のカードの超魂Xを重ねる**こともそのまま表現できます。

```jsonc
// 誘発能力（通常の triggers と同じ書式。下のクリーチャーにも伝播する）
"ssx": { "triggers":[ { "on":"attack", "optional":true, "effects":[ … ] } ] }

// 複数の能力を1枚に（例: パワーアタッカー＋4000 と 起動型能力）
"ssx": {
  "powerAttacker": 4000,
  "activated": [ { "label":"自分の墓地からクリーチャーを1体出す", "oncePerTurn":true,
                   "effects":[{"type":"graveToBz","filter":{"creatureOnly":true}}] } ]
}

// スタック枚数を条件にする（このクリーチャーにカードが3枚以上あれば +6000 かつ Wブレイカー）
"ssx": {
  "condPower":[ { "condition":{"type":"stackCount","count":3}, "amount":6000 } ],
  "grantKeywords":[ { "keyword":"wBreaker", "condition":{"type":"stackCount","count":3} } ]
}
```

カード表示では紫の **SSX** バッジが付き、キーワードのバッジは通常能力と同じ色で表示されます。

## 7.6. 起動型能力（`activated`）と「各ターンに一度」

プレイヤーが任意のタイミングで自分から使う能力は `activated` に書きます。
バトルゾーンのボタン **「起動能力 (N)」** から一覧が開き、選んで発動します。

```jsonc
"activated": [
  { "label": "自分の墓地からクリーチャーを1体、バトルゾーンに出す",
    "oncePerTurn": true,        // 各ターンに一度（"oncePerGame":true なら ゲーム中に一度＝終極宣言）
    "timing": "ownTurn",        // "ownTurn"(自分のターン中/既定) | "any"(いつでも)
    "condition": {"type":"stackCount","count":3},   // 省略可
    "effects": [ { "type":"graveToBz", "filter":{"creatureOnly":true} } ] }
]
```

| フィールド | 説明 |
|---|---|
| `label` | UI に出る説明文（必須ではないが無いと何の能力か分からない） |
| `effects` | 効果本体（§2 と同じ記法。必須） |
| `oncePerTurn` / `oncePerGame` | 使用回数制限。使用済みの間は候補に出ない |
| `timing` | `"ownTurn"`(既定) / `"any"` |
| `condition` | §7 の `condition` と同じ |

- 有効なゾーンは **バトルゾーン＋表向きのシールド**（継続能力が働く場所）。
- `oncePerTurn` はターン終了時にリセット、`oncePerGame` はゲーム中リセットされません。
- `ssx.activated` に書けば、下に敷かれたクリーチャーの起動型能力として上のクリーチャーも使えます。

---

## 8. 常在・付与・ハイパー等のフィールド

- `activated`: 起動型能力 → **§7.6**
- `grantKeywords`: `[{keyword,filter?,condition?}]`（filter: `notSelf,raceContains,multiColor,nameContains,elementOnly`）
- `grantPowerBoost` / `grantPowerBoostGrave` / `selfPowerBoostGrave` / `condPower:[{condition,amount}]`
- `powerAttacker`: `N` — パワーアタッカー+N（**攻撃中のみ**パワー+N）
- `poweredBreaker`: `true` — パワード・ブレイカー（パワー6000ごとに1つブレイク、最低1）。
  W/Tブレイカーと併用した場合は**大きい方**が採用される
- `condition` の共通語彙: `{type:"civicCount",civ,count}` / `{type:"stackCount",count}` / `{flag:"…"}`
  - `stackCount` = そのカード自身＋下に敷かれたカードの枚数（進化元を含むスタックの厚み）
- `costReduce`: `{amount, min, zones?, filter?}` — 自分がカードをプレイする際のコスト軽減
  - `zones`: **軽減元（このカード）がどのゾーンにいれば有効か**。`bz` `shield`(表向きのみ) `mana` `grave` `hand`
    既定は `["bz","shield"]`（バトルゾーン＋表向きシールド＝継続能力が働く場所）
  - `filter`: 軽減対象の条件 — `civ` `raceContains` `nameContains` `keyword` `multiColor` `maxCost`
    `type`(`creature`/`nonCreature`/`element`/`spell`…)
  - `min`: 下限コスト。複数の軽減は重ねがけされる
  ```jsonc
  // バトルゾーンにいる間、自分のドラゴンのコストを2軽減（最低1）
  "costReduce": { "amount":2, "filter":{"raceContains":"ドラゴン"}, "min":1 }
  // 墓地にある間だけ、自分の光のカードのコストを1軽減
  "costReduce": { "amount":1, "zones":["grave"], "filter":{"civ":"light"}, "min":1 }
  ```
- `revolutionChangeCond`: `{civs?,race?/races?,minCost?,minPower?,multiColor?,nameContains?}`
- `finalRevolution`: `{effects:[…]}` ／ `alternateCost`: `{cost,civs,condition}` ／ `gZero`: `{nameContains,raceContains}`
- `evolution`: `{civFilter,raceContains}`
- ハイパー: `hyperPower` `hyperKeywords` `hyperOnAttack` `hyperOnTargeted` `hyperUnlock:{type:"tapOwnCreature",count}`
- `zRush` `cantAttackPlayer` `faceUpLeaveTo:"grave"` `reactivePassive` `endOfTurnEffect` `staticDeny:{type:"cantPutCreature"}`
- `spellSide`（twinpact）: `{name,cost,civ,keywords,effect,autoEffect}`

---

## 9. テンプレ

```jsonc
// 効果なしクリーチャー
{ "id":0,"name":"サンプル","type":"creature","civ":"fire","race":"ヒューマノイド",
  "cost":3,"power":3000,"keywords":["speedAttacker"],"effect":"スピードアタッカー","autoEffect":null }

// 出た時ドロー ＋ 攻撃時に条件ドロー
{ "id":0,"name":"サンプル2","type":"creature","civ":"light","race":"メカ",
  "cost":5,"power":5500,"keywords":["blocker"],
  "effect":"ブロッカー\nこのクリーチャーが出た時、カードを1枚引く。",
  "autoEffect":{"trigger":"play","effects":[{"type":"drawCards","amount":1,"label":"1枚引く"}]},
  "triggers":[{"on":"attack","optional":true,"effects":[
    {"type":"count","zone":"bz","target":"self","filter":{"creatureOnly":true,"maxCost":4}},
    {"type":"drawCards","amount":"count","optional":true} ]}] }
```
