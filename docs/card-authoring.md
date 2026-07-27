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
| `condition` | `{type:"civicCount",civ,count}` または `{flag:"shieldAddedThisTurn"}` |

```jsonc
// 相手が効果でクリーチャーを出した時（召喚は対象外）
{"on":"creaturePutBz","target":"opponent","method":"put","effects":[ … ]}

// 各ターン、はじめて自分のクリーチャーが攻撃する時
{"on":"attack","target":"self","firstEachTurn":true,"effects":[ … ]}

// 相手が呪文を唱えた時
{"on":"castSpell","target":"opponent","effects":[ … ]}
```

## 8. 常在・付与・ハイパー等のフィールド

- `grantKeywords`: `[{keyword,filter?,condition?}]`（filter: `notSelf,raceContains,multiColor,nameContains,elementOnly`）
- `grantPowerBoost` / `grantPowerBoostGrave` / `selfPowerBoostGrave` / `condPower:[{condition,amount}]`
- `costReduce`: `{amount,filter:{civ|raceContains|nameContains},min}`
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
