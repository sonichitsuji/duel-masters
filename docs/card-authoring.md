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

> **`autoEffect` と `triggers` の違い**
> `autoEffect` は**そのカード自身をプレイした時**の効果（`trigger` は `play` / `cast` の2つだけ）。
> `triggers` は**汎用のイベント誘発**で、`on` で契機を選び `target` で誰のイベントかを指定します（§7）。
> クリーチャーの「出た時」は `autoEffect{trigger:"play"}` でも
> `triggers:[{on:"creaturePutBz"}]` でも書けます。**どちらも、効果でバトルゾーンに出された場合にも誘発します。**

### 共通パラメータ（effects の各要素）
| パラメータ | 説明 |
|---|---|
| `label` | モーダルに出す説明文 |
| `optional` | 「〜してもよい」（スキップ可） |
| `target` | **`"self"` / `"opponent"` / `"both"`**（どちらも） |
| `amount` | 数値、**または変数名の文字列**（例 `"count"`）。選択枚数の上限にもなる |
| `filter` | 対象条件（下記） |
| `zone` | 対象ゾーン（`hand` `bz` `mana` `grave` `shield` `deck` `revealed` `lastMoved` `under` `stack`） |
| `all` | 条件一致すべてに適用（選択不要） |
| `ifPrevious` | **「そうしたら」「そうした場合」**。直前のステップを実際に行わなかった場合、このステップ以降を実行しない → **§3.5** |

> `under` = **このクリーチャーの下にあるカード**（メテオバーン用）、
> `stack` = **このクリーチャーに含まれるカード**（自身＋下に敷かれたカード）。
> どちらも「いまバトルゾーンにいる能力の持ち主」を見るので、離れていれば空になります。

**filter**: `side`(ツインパクトの面) `civ` `civNot` `raceContains` `nameContains` `keyword`
`type`(`creature`＝進化含む / **`nonEvoCreature`**＝進化ではないクリーチャー / `evo_creature` / `nonCreature` / `spell` / `tamaseed`…)
`element`(クリーチャー/タマシード) `creatureOnly` `multiColor` `tapped` `maxCost` `minCost` `maxPower` `notNameSelf`
※ `maxCost` 等にも**変数名の文字列**を書けます。

**「〜または〜」は配列で書きます**（`civ` `civNot` `raceContains` `nameContains` `keyword` `type` が対応）。

```jsonc
{ "civ": ["water", "darkness"] }                  // 水または闇
{ "raceContains": ["ドラゴン", "コマンド"] }        // ドラゴンまたはコマンド
{ "type": ["spell", "tamaseed"] }                 // 呪文またはタマシード
{ "keyword": ["blocker", "slayer"] }              // ブロッカーまたはスレイヤーを持つ
{ "civNot": ["light", "fire"] }                   // 光でも火でもない
{ "civ": ["water", "darkness"], "maxCost": 5 }    // 「水または闇」かつ「コスト5以下」
```

**同じキーの中は OR、違うキーどうしは AND** です。多色カードは持っている文明のどれかが
一致すれば `civ` に該当します（例: 水/火の多色は `{"civ":["water","darkness"]}` に該当）。

### ツインパクトの面（`side`）

ツインパクトは**クリーチャーであり呪文でもある**ので、`type:"creature"` にも `type:"spell"` にも
一致します（`type:"twinpact"` にも一致）。

```jsonc
{ "type": "creature" }   // 「墓地からクリーチャーを手札に戻す」→ ツインパクトも対象（クリーチャー面）
{ "type": "spell" }      // 「墓地から呪文を唱える」→ ツインパクトも対象（呪文面）
```

ただし**プレイ中はどちらの面かが確定する**ので、そのカードには `side`（`"creature"` / `"spell"`）が
付き、`type` もその面で判定されます。「この**クリーチャーの召喚**コストを〜」のように
面を区別したい時は `filter.side` を使います。

```jsonc
// このクリーチャーの召喚コストを軽減（呪文面を唱える時には効かない）
"costReduce": { "amountPer": {…}, "filter": { "self": true, "side": "creature" },
                "zones": ["hand"], "min": 1 }
```

シビルカウントや `element` の数え上げにもツインパクトのクリーチャー面が含まれます。

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

## 3.5. 「そうしたら」「そうした場合」（`ifPrevious`）

「〜してもよい。**そうしたら**、…」のように、**前の効果を実際に行った場合だけ**続きが起きる書き方です。
続きのステップに `"ifPrevious": true` を付けます。行わなかった場合は**そのステップ以降がすべて実行されません**。

```jsonc
// 自分の手札を1枚捨ててもよい。そうしたら、カードを2枚引く。
[ {"label":"手札を1枚捨ててもよい","type":"handToGrave","target":"self","amount":1,"optional":true},
  {"label":"そうしたら、カードを2枚引く","type":"drawCards","amount":2,"ifPrevious":true} ]
```

「行った」の判定は次のとおりです。

| ステップの種類 | 「行った」とみなす条件 |
|---|---|
| 対象を選ぶステップ | 1枚以上選ばれた（スキップ・0枚選択は「行っていない」） |
| `drawCards` | 実際に1枚以上引けた（山札切れは「行っていない」） |
| `meteorBurn` | コストを支払えた → **§7.9** |
| その他の自動ステップ | 常に「行った」 |

> **メテオバーンは `ifPrevious` を書く必要がありません。** コストなので、支払わなければ
> 常に以降のステップが打ち切られます。

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
- `shuffleDeck {target}` — 山札をシャッフルする（`target` で自分/相手/おたがい）

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
- `destroy {target,filter,amount,all,self}` — 破壊。**`self:true` で「このクリーチャーを破壊する」**（選択不要・自分を対象）
- `bzToHand` / `bzToMana` / `bzToShield`（`target,filter,amount,all`）
- `tap` / `untap` / `tapToggle`（`target,zone,filter,all,noUntapNextTurn`）
- `untapAllMana` — 自分のマナを全アンタップ
- `powerBuff {target,count,amount,perUnit,expires,keywords}` — パワー増減（負値で弱体、0以下で破壊）
  - `amount` は**パワー増減値**（他の効果と違い選択枚数ではない）。選ぶ体数は `count`（既定1体）
  - `perUnit` を付けると「1つにつきN」。`amount` に変数を渡して掛ける
    ```jsonc
    // 自分の墓地のクリーチャー1体につき −1000（相手1体に、このターン）
    {"type":"count","zone":"grave","target":"self","filter":{"creatureOnly":true},"as":"graveCre"},
    {"type":"powerBuff","target":"opponent","count":1,"amount":"graveCre","perUnit":-1000,"expires":"endOfTurn"}
    ```
- `grant {keywords,untapAfterAttack,untap,expires}` — 能力付与
- `battle {target}` — このクリーチャーと相手1体をバトル

**墓地・シールド**
- `graveToBz {filter,owner,self,tempKeywords,destroyAtEndOfTurn,summoningSickness}` — 墓地から出す
  （`owner:"destroyed"`=直前に破壊されたクリーチャーの持ち主、`self:true`=このカード自身）
- `graveToHand {target,filter,amount}` — 墓地から手札に戻す
- `graveToDeckBottom {target,filter,amount,all,order}` — 墓地から山札の下へ
  - `order: "shuffle"`（既定）… シャッフルしてから置く。`all:true` か `amount` 省略で墓地すべてが対象
  - `order: "choose"` … **好きな順序で**置く。選んだ順に上から積まれ、全部選ぶまで確定できない
    （`amount` を書けばその枚数だけ選ぶ）
  ```jsonc
  // 自分の墓地をシャッフルして山札の下に置く
  { "type": "graveToDeckBottom", "all": true }
  // 自分の墓地のカードを好きな順序で山札の下に置く
  { "type": "graveToDeckBottom", "order": "choose" }
  // 自分の墓地から2枚選び、好きな順序で山札の下に置く
  { "type": "graveToDeckBottom", "amount": 2, "order": "choose" }
  ```
- `shieldToHand {target}` / `shieldToGrave {target}` / `breakShield {target}`

**進化元を動かすコスト**
- `meteorBurn {count,to,optional,tapped}` — メテオバーン → **§7.9**

**特殊勝利**
- `winGame {target,reason}` — EXWIN。`target` のプレイヤーがゲームに勝つ（既定 `self`）

**召喚元ゾーンの拡張**
- `grantSummonFrom {zone,filter,maxPerTurn,timing,target}` — そのターン、指定ゾーン（`grave`/`mana`）から
  クリーチャーを**召喚**できるようにする（コスト支払いあり）→ **§7.7**

**遅延**
- `scheduleReviveSubjectEndOfTurn` — 「そのクリーチャー」をターン終了時に墓地から出す

### 効果でバトルゾーンに出したクリーチャーの召喚酔い

`handToBz` / `manaToBz` / `graveToBz` / `revealedToBz` / `search{destination:"bz"}` で出したクリーチャーは、
**既定で召喚酔いします**（そのターンは攻撃できない）。DMの通常ルールどおりです。

「出したターンから攻撃できる」と書かれたカードだけ **`"summoningSickness": false`** を付けてください。
スピードアタッカー持ちは攻撃可否の判定側で除外されるので、この指定は不要です。

---

## 6. type とキーワード

**type**: `creature` / `evo_creature` / `spell` / `twinpact` / `tamaseed` / `castle`(G城・表向きシールド)

**keywords**: `speedAttacker` `wBreaker` `tBreaker` `blocker` `cantAttack` `sTrigger` `drawOnPlay`
`revolutionChange` `gStrike` `charger` `zRush` `escape` `slayer`

**文明**: `light` `water` `darkness` `fire` `nature`（表示順もこの順）

### `zRush`（Zラッシュ）
「シールドが離れたら、次の自分のターンのはじめまで、このクリーチャーのハイパーモードを解放する」。

**いつ・誰のシールドが・どこに離れても**成立する**状況起因処理**として実装している。
つまり自分のシールドでも相手のシールドでもよく、ブレイク／効果／エスケープ／置換のどれでも、
行き先が手札でも墓地でもマナでも関係なく、シールドゾーンからカードが消えた時点で
バトルゾーンにいる**全ての**Zラッシュ持ちが解放される。
解放されたハイパーモードは、そのクリーチャーの持ち主の次のターン開始時に戻る。

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
| `attackEnd` | **攻撃の終わり**（攻撃終了ステップ）。攻撃したクリーチャーが戦闘で破壊されていた場合、そのクリーチャー自身の能力は誘発しない |
| `leave` | カードが離れた時 |
| `destroyed` | 破壊された時 |
| `battleDestroy` | バトルで破壊された時 |
| `draw` | カードを引いた時。`"lastCard": true` で「**それが最後の1枚だったら**」（引いた結果、山札が0枚になった時）に限定できる |
| `discard` | 手札を捨てた時 |
| `shieldAdded` / `shieldLeave` | シールドが置かれた/離れた時。`shieldLeave` はシールドゾーンの中身を監視して検出するので、**ブレイク・効果・エスケープ・置換など離れ方と行き先を問わず**誘発する（`target` でどちらのシールドかを指定） |
| `startOfTurn` | ターンのはじめ（アンタップ後・ドロー前）。`target` で**誰のターンか**を指定（`self`=自分のターン(既定) / `opponent`=相手のターン / `both`=各ターン） |
| `endOfTurn` | ターンの終わり。`target` で**誰のターンか**を指定（`self`=自分のターン(既定) / `opponent`=相手のターン / `both`=各ターン） |

### `target`（誰のイベントに反応するか）
| 値 | 意味 |
|---|---|
| `this` | **このカード自身**のイベント |
| `self` | 自分の |
| `opponent` | 相手の |
| `both` | どちらでも |

**既定値**：カード自身のイベント（`creaturePutBz` `leave` `destroyed` `battleDestroy` `attack`）は **`this`**、
プレイヤーのイベント（`castSpell` `draw` `discard` `shieldAdded` `shieldLeave` `startOfTurn` `endOfTurn`）は **`self`**。
`startOfTurn` / `endOfTurn` の `self` は「**自分のターンの**はじめ／終わりに」。
「各ターンの〜」は `"target":"both"` を明示します。

> `startOfTurn` はターン交代時に発火するため、**ゲーム最初のターン（先攻1ターン目）では発火しません**
> （そのタイミングではまだバトルゾーンにカードがないので実害はありません）。

```jsonc
{"on":"leave"}                      // このクリーチャーが離れた時
{"on":"attackEnd"}                 // このクリーチャーの攻撃の終わりに（攻撃終了ステップ）
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
| `lastCard` | `on:"draw"` 専用。引いた結果、山札が0枚になった時だけ誘発 |
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

## 7.7. 墓地・マナゾーンからの召喚（`summonFrom` / `grantSummonFrom`）

通常クリーチャーは手札からしか召喚できません。この2つはその**召喚元ゾーンを追加**します。
どちらも「召喚」なので、**コストは通常どおり支払い**、召喚酔いも付き、
`creaturePutBz`（`method:"summon"`）が誘発します。効果でバトルゾーンに「出す」
（`graveToBz` / `manaToBz`）とは別物です。

### 継続能力 `summonFrom`（例: 貴布人 テブルカッケ＝エディ）

```jsonc
"ssx": {
  "summonFrom": [
    { "zone": "grave",            // "grave" | "mana"
      "timing": "ownTurn",        // "ownTurn"(既定) | "any"
      "maxPerTurn": 1,            // 省略すると回数無制限
      "filter": { "creatureOnly": true },
      "label": "自分のターン中、クリーチャーを1体、自分の墓地から召喚してもよい" }
  ]
}
```
- 能力フィールドなので**カード直下にも `ssx` 内にも**書けます（`ssx` なら下のクリーチャーへ伝播）。
- 有効ゾーンは **バトルゾーン＋表向きのシールド**。

### そのターン限りの許可 `grantSummonFrom`（例: 蛇手の親分ゴエモンキー！）

```jsonc
"autoEffect": { "trigger":"play", "effects":[
  { "label":"そのターン、自分のマナゾーンからクリーチャーを召喚してもよい",
    "type":"grantSummonFrom", "zone":"mana", "filter":{"creatureOnly":true} } ]}
```
`maxPerTurn` / `timing` / `target` も指定できます。許可はターン終了時に消えます。

### UI

召喚できるカードがあるゾーン（墓地／マナ）の枠が**黄色く光り ▲ が付き**、
クリックすると中身の一覧が開いて各カードに「召喚 (コスト)」ボタンが出ます。
マナから召喚する場合、そのカード自身はコスト支払いには使えません。

---

## 7.8. 進化元のゾーンと枚数（`evolution`）

`type:"evo_creature"` のカードに書きます。**進化元がどのゾーンの何体か**を指定します。

```jsonc
"evolution": { "zone":"grave", "count":1, "filter":{"civ":"darkness"} }  // 墓地進化−闇
"evolution": { "zone":"mana",  "count":1, "filter":{"civ":"fire"} }      // マナ進化−火
"evolution": { "zone":"grave", "count":3 }                               // 墓地進化GV
"evolution": { "zone":"grave", "min":1 }                                 // 超無限墓地進化
"evolution": { "filter":{"civ":"fire","raceContains":"ドラゴン"} }        // 通常の進化（BZ）
```

| フィールド | 説明 |
|---|---|
| `zone` | `"bz"`(既定) / `"grave"` / `"mana"` |
| `count` | 進化元の枚数（既定1）。ちょうどこの枚数を選ぶ |
| `min` | 「N体以上」。上限なし（超無限系）。`count` とは併用不可 |
| `filter` | 進化元の条件（§2 と同じ filter 語彙）。クリーチャー限定は暗黙に適用 |

### ルール上の注意

- **進化元は「バトルゾーンに出た」ことにならない**。バトルゾーンを経由せず直接下に敷かれるので、
  進化元の「出た時」は誘発せず、「クリーチャーが出た時」も**出た進化クリーチャー1体分**しか数えません。
  「手札以外からバトルゾーンに出せない」系の制限も、進化クリーチャー自身が手札から出るなら**かかりません**。
- **進化クリーチャーなので召喚酔いしない**（出たターンから攻撃できる）。種別は「進化クリーチャー」のまま。
- **マナ進化の進化元はタップされていても選べる**。ただし進化元にしたマナは**コスト支払いには使えません**。
- 複数体の進化元は**選んだ順に下から重なります**（バトルゾーンに出た後は順序を変えられない）。
- **ツインパクトは進化元にできます**。「クリーチャーを1体選び」はクリーチャー側を参照するので、
  墓地・マナ・バトルゾーンのどこにあっても候補に入ります（呪文とタマシードは候補外）。
- コストは通常どおり支払います。

## 7.9. メテオバーン（`meteorBurn`）

そのクリーチャーの**下にあるカード**を指定数だけ動かすことを**コスト**として発動する能力。
`effects` の**先頭**に置きます。

```jsonc
{ "on":"attack", "effects":[
  { "label":"このクリーチャーの下にあるカードを1枚墓地に置いてもよい",
    "type":"meteorBurn", "count":1, "to":"grave", "optional":true },
  { "label":"自分の山札の上から3枚を墓地に置く", "type":"topToGrave", "amount":3 },
  { "label":"相手のクリーチャーを1体選んで破壊する", "type":"destroy", "target":"opponent", "amount":1 } ]}
```

| フィールド | 説明 |
|---|---|
| `count` | 動かす枚数（既定1） |
| `to` | 移動先。`grave`(既定) / `mana` / `hand` / `shield` / `deck`(山札の下) |
| `optional` | 「〜してもよい」 |
| `tapped` | `to:"mana"` の時、タップして置く |

- 動かすカードは**選べます**。順番は変えられず、抜けた場所は**詰められます**。
- **支払えなければ（辞退・枚数不足・クリーチャーがバトルゾーンにいない）、以降のステップは実行されません。**
  メテオバーンはコストなので、後続に `ifPrevious`(§3.5) を書かなくても常にこうなります。
  革命チェンジ等でそのクリーチャーが居なくなっていれば**不発**です。

## 7.10. 敗北の置換（`replaceLose`）

「〜でゲームに負ける時、かわりに勝つ」を表現します。能力フィールドなので `ssx` にも書けます。
有効なゾーンは**バトルゾーン＋表向きのシールド**です。

```jsonc
"replaceLose": [
  { "from": "deckOut", "to": "win",
    "label": "自分の山札の最後の1枚を引いたことによってゲームに負ける時、かわりに勝つ" }
]
```

| フィールド | 説明 |
|---|---|
| `from` | 置換する敗北の原因。現状 `"deckOut"`（ライブラリアウト＝山札が0枚になった）のみ |
| `to` | `"win"`（EXWIN として勝利） |

置換効果なので、**必ず「例外処理で中止（通常どおり敗北）」を選べるモーダル**が出ます。
勝利画面は **EXTRA WIN!** 表示になります。

> **ライブラリアウト（LO）は「山札が0枚になった瞬間」に成立します**（引こうとした時ではありません）。
> ドローに限らず、山札が減るあらゆる操作（`topToGrave` / `topToMana` / `search` など）の直後に判定されます。
> 状態起因処理なので、同時に誘発した能力より**先に**解決されます。

---

## 8. 常在・付与・ハイパー等のフィールド

- `activated`: 起動型能力 → **§7.6**
- `summonFrom`: 墓地・マナからの召喚許可 → **§7.7**
- `replaceLose`: `[{from,to,label}]` — 敗北の置換 → **§7.10**
- `grantKeywords`: `[{keyword,filter?,condition?}]`（filter: `notSelf,raceContains,multiColor,nameContains,elementOnly`）
- `grantPowerBoost` / `grantPowerBoostGrave` / `selfPowerBoostGrave` / `condPower:[{condition,amount}]`
- `powerAttacker`: `N` — パワーアタッカー+N（**攻撃中のみ**パワー+N）
- `poweredBreaker`: `true` — パワード・ブレイカー（パワー6000ごとに1つブレイク、最低1）。
  W/Tブレイカーと併用した場合は**大きい方**が採用される
- `condition` の共通語彙: `{type:"civicCount",civ,count}` / `{type:"stackCount",count}` / `{flag:"…"}`
  - `stackCount` = そのカード自身＋下に敷かれたカードの枚数（進化元を含むスタックの厚み）
- `costReduce`: `{amount | amountPer, min, zones?, filter?}` — 自分がカードをプレイする際のコスト軽減
  - `zones`: **軽減元（このカード）がどのゾーンにいれば有効か**。`bz` `shield`(表向きのみ) `mana` `grave` `hand`
    既定は `["bz","shield"]`（バトルゾーン＋表向きシールド＝継続能力が働く場所）
  - `filter`: 軽減対象の条件 — `civ` `raceContains` `nameContains` `keyword` `multiColor` `maxCost`
    `type`(`creature`/`nonCreature`/`element`/`spell`…)、
    **`self:true`** =「このクリーチャーの召喚コストを〜」（軽減元自身にだけ効く）
  - `amountPer`: `{zone,filter}` — 「〜1枚につき1少なくする」の可変軽減（`amount` の代わりに書く）
    - `zone` には通常のゾーンのほか **`"evolutionBase"`**（**今回の召喚で実際に重ねる進化元の枚数**）を指定できる
  - `min`: 下限コスト。複数の軽減は重ねがけされる
  ```jsonc
  // バトルゾーンにいる間、自分のドラゴンのコストを2軽減（最低1）
  "costReduce": { "amount":2, "filter":{"raceContains":"ドラゴン"}, "min":1 }
  // 墓地にある間だけ、自分の光のカードのコストを1軽減
  "costReduce": { "amount":1, "zones":["grave"], "filter":{"civ":"light"}, "min":1 }
  // このクリーチャー自身の召喚コストを、自分の墓地のクリーチャー1体につき1軽減
  "costReduce": { "amountPer":{"zone":"grave","filter":{"creatureOnly":true}},
                  "filter":{"self":true}, "zones":["hand"], "min":1 }
  // このクリーチャー自身の召喚コストを、進化元クリーチャー1体につき1軽減（超無限進化など）
  "costReduce": { "amountPer":{"zone":"evolutionBase"},
                  "filter":{"self":true}, "zones":["hand"], "min":1 }
  ```
  > `zone:"evolutionBase"` は**進化元を選んだ後**でないと確定しません。UI は
  > 「PLAYできるか」の判定を**重ねられる最大枚数**（＝最も軽くなるケース）で行い、
  > 進化元選択モーダルに現在のコストを表示し、マナ支払い画面で実際の枚数のコストに確定します。
  > **`min` の読み方**: カードに「コストは**0以下**にはならない」とあれば **0にならない** ので `min:1`、
  > 「**1以下**にならない」なら `min:2` です。実際の下限はさらに文明数で抑えられます
  > （2色カードは最低2）。
- `revolutionChangeCond`: `{civs?,race?/races?,minCost?,minPower?,multiColor?,nameContains?}`
- `finalRevolution`: `{effects:[…]}` ／ `alternateCost`: `{cost,civs,condition}` ／ `gZero`: `{nameContains,raceContains}`
- `evolution`: 進化元のゾーンと枚数 → **§7.8**
- ハイパー: `hyperPower` `hyperKeywords` `hyperOnAttack` `hyperOnTargeted` `hyperUnlock:{type:"tapOwnCreature",count}`
- `zRush` `cantAttackPlayer` `faceUpLeaveTo:"grave"` `reactivePassive` `endOfTurnEffect` `staticDeny:{type:"cantPutCreature"}`
- `spellSide`（twinpact）: `{name,cost,civ,keywords,effect,autoEffect}`
  - **呪文面が `sTrigger` を持つ場合**、シールドをブレイクされた時にその呪文面が唱えられます
    （カード表示の ST バッジにも出ます）。クリーチャー面の能力は `triggers` 側に書きます。
  - プレイ中は `side`（`"creature"`/`"spell"`）で面を区別できます → **§2 の filter**

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
