# 実装計画：蒼き団長 ドギラゴン剣 & 轟く侵略 レッドゾーン

## Context

デュエルマスターズシミュレーター（React製）に、革命チェンジ世代の代表的な2枚を追加する。
どちらも現在未実装のキーワード能力・処理を必要とするため、カードデータ追加だけでなく
App.jsx のゲームロジック・UI の両面を拡張する。

---

## カードスペック（調査済み）

### 蒼き団長 ドギラゴン剣（id: 37）
| 項目 | 値 |
|------|-----|
| コスト | 8 |
| パワー | 13000 |
| 文明 | 火 / 自然（多色） |
| 種族 | メガ・コマンド・ドラゴン/革命軍/ハムカツ団 |
| キーワード | T・ブレイカー, 革命チェンジ |

**効果テキスト**
```
革命チェンジ―火または自然のコスト5以上のドラゴン
自分の多色クリーチャーすべてに「スピードアタッカー」を与える。
T・ブレイカー
ファイナル革命―このクリーチャーが「革命チェンジ」によってバトルゾーンに出た時、
そのターン中に他の「ファイナル革命」をまだ使っていなければ、コストが合計6以下になるよう、
進化ではない多色クリーチャーを自分のマナゾーンまたは手札から選び、バトルゾーンに出す。
```

### 轟く侵略 レッドゾーン（id: 38）
| 項目 | 値 |
|------|-----|
| コスト | 6 |
| パワー | 12000 |
| 文明 | 火 |
| 種族 | ソニック・コマンド/侵略者 |
| キーワード | T・ブレイカー, 侵略 |

**効果テキスト**
```
進化―自分の火のクリーチャー1体の上に置く。
侵略―火のコマンド（自分の火のコマンドが攻撃する時、
  自分の手札にあるこのクリーチャーをその上に重ねてもよい）
T・ブレイカー
このクリーチャーがバトルゾーンに出た時、
一番パワーが大きい相手のクリーチャーをすべて破壊する。
```

---

## 新規実装が必要なもの

| 機能 | 種別 | 難易度 |
|------|------|--------|
| `invasion` キーワード + `invasionCond` | 新キーワード | 中 |
| 侵略モーダル（攻撃トリガー） | 新UIコンポーネント | 中 |
| 進化召喚モーダル（手札プレイ時） | 新UIコンポーネント | 中 |
| `destroyMaxPower` autoEffect | processEffect新ケース | 小 |
| ファイナル革命モーダル | 新UIコンポーネント | 大 |
| `revolutionChangeCond.minCost` 条件 | 既存ロジック拡張 | 小 |
| 多色SAパッシブ効果 | 既存ロジック拡張 | 小 |
| 効果発動確認ステップ（無限ループ防止） | 既存ロジック拡張 | 中 |
| 付与能力の別色表示 | UI拡張 | 小 |

---

## 実装ステップ

### Step 1: `public/cards.json` にカードを追加

```json
// ドギラゴン剣 (id: 37)
{
  "id": 37,
  "name": "蒼き団長 ドギラゴン剣",
  "race": "メガ・コマンド・ドラゴン/革命軍/ハムカツ団",
  "cost": 8,
  "power": 13000,
  "type": "creature",
  "civ": ["fire", "nature"],
  "keywords": ["revolutionChange", "tBreaker"],
  "effect": "革命チェンジ―火または自然のコスト5以上のドラゴン\n自分の多色クリーチャーすべてに「スピードアタッカー」を与える。\nT・ブレイカー\nファイナル革命―このクリーチャーが「革命チェンジ」によってバトルゾーンに出た時、そのターン中に他の「ファイナル革命」をまだ使っていなければ、コストが合計6以下になるよう、進化ではない多色クリーチャーを自分のマナゾーンまたは手札から選び、バトルゾーンに出す。",
  "autoEffect": null,
  "revolutionChangeCond": { "civs": ["fire", "nature"], "race": "ドラゴン", "minCost": 5 }
}

// レッドゾーン (id: 38)
{
  "id": 38,
  "name": "轟く侵略 レッドゾーン",
  "race": "ソニック・コマンド/侵略者",
  "cost": 6,
  "power": 12000,
  "type": "creature",
  "civ": "fire",
  "keywords": ["invasion", "tBreaker"],
  "effect": "進化―自分の火のクリーチャー1体の上に置く。\n侵略―火のコマンド（自分の火のコマンドが攻撃する時、自分の手札にあるこのクリーチャーをその上に重ねてもよい）\nT・ブレイカー\nこのクリーチャーがバトルゾーンに出た時、一番パワーが大きい相手のクリーチャーをすべて破壊する。",
  "autoEffect": { "trigger": "play", "type": "destroyMaxPower", "target": "opponent" },
  "invasionCond": { "civs": ["fire"], "race": "コマンド" }
}
```

---

### Step 2: `src/App.jsx` ― キーワード定義の追加

**対象行**: `ALL_KEYWORDS`（line 4）, `KEYWORD_LABELS`（line 5）

```js
// ALL_KEYWORDS に追加
"invasion"   // 侵略

// KEYWORD_LABELS に追加
invasion: "侵略"
```

---

### Step 3: `processEffect` に `destroyMaxPower` ケースを追加

**対象**: `processEffect` 関数（line 125〜165）の switch 末尾

```js
case "destroyMaxPower": {
  // 相手BZの最大パワーを求め、同パワーの全クリーチャーを破壊
  const tgt = effect.target === "opponent" ? otherState : selfState;
  const st  = effect.target === "opponent" ? setOther   : setSelf;
  if (tgt.battle.length === 0) break;
  const maxPow = Math.max(...tgt.battle.map(c => c.power));
  const toDestroy = tgt.battle.filter(c => c.power === maxPow);
  st(s => ({
    ...s,
    battle: s.battle.filter(c => c.power !== maxPow),
    grave:  [...s.grave, ...toDestroy],
  }));
  addLog(`${pid}: 最大パワー${maxPow} の ${toDestroy.length}体を破壊`);
  break;
}
```

---

### Step 4: 革命チェンジ条件に `minCost` チェックを追加

**対象**: `AttackTriggerModal`（line 484〜493）と
`handleAttackWithTriggerCheck`（line 556〜563）の条件判定部分

両箇所にある条件判定に、以下の1行を追加:

```js
const costMatch = !cond.minCost || (attacker.cost >= cond.minCost);
// 既存の civMatch && raceMatch に && costMatch を追加
```

---

### Step 5: 多色クリーチャーへの SA 付与（パッシブ効果）

**対象**: `CreatureDetailPanel` の「攻撃可能」判定、および攻撃宣言ボタンの `disabled` 条件

現在の攻撃可能チェック（`summonedThisTurn` 確認）に以下を追加:

```js
// 自分のBZにドギラゴン剣がいれば、多色クリーチャーはSA扱い
const dogiragoonInBattle = state.battle.some(c => c.name === "蒼き団長 ドギラゴン剣");
const isMulticolor = Array.isArray(card.civ) && card.civ.length >= 2;
const effectiveSA = card.keywords?.includes("speedAttacker") 
                    || (dogiragoonInBattle && isMulticolor);
// canAttack の判定で summonedThisTurn の無効化に effectiveSA を使用
```

**対象箇所**: `CreatureDetailPanel` コンポーネント内の `canAttack` 計算
（`PlayerBoard` → `CreatureDetailPanel` に `state` を渡す必要があれば props 追加）

---

### Step 6: 新コンポーネント `InvasionModal`（侵略）

攻撃宣言時に侵略カードが手札にある場合に表示。
**既存の `AttackTriggerModal` を拡張**する形で実装する。

```
InvasionModal が表示する内容:
  - 「〇〇が攻撃！侵略できます」
  - 手札にある invasionCond 一致カードをリスト表示
  - 選択 → 進化（元クリーチャーをBZから除去し、侵略者をBZに追加）
  - 「侵略しない」→ そのまま攻撃続行

侵略実行時の状態変化:
  1. 攻撃クリーチャーを battle から除去し grave に追加（進化コスト）
  2. 侵略者カードを手札から battle に追加（tapped:false, summonedThisTurn:false）
  3. 侵略者の UID で onStartAttack を呼ぶ
  4. invasionCard.autoEffect があれば triggerEffect 実行
```

**実装箇所**: `PlayerBoard` コンポーネント内の `handleAttackWithTriggerCheck` を拡張し、
革命チェンジと侵略を同時チェック。両方ある場合は両方を `AttackTriggerModal` に渡す。

---

### Step 7: 新コンポーネント `EvolutionModal`（進化召喚）

手札からレッドゾーン（または `invasion` キーワード持ちクリーチャー）をプレイする際、
BZ の対象クリーチャーを選択させる。

```
EvolutionModal が表示する内容:
  - 「進化元を選んでください（自分のBZにある火のクリーチャー）」
  - 条件に合うクリーチャーをリスト表示
  - 選択 → 進化元を BZ から除去し、進化クリーチャーをその場に配置
  - 「キャンセル」→ プレイ中断
```

**実装箇所**: `handlePlayCard`（line 1016）内の `type === "creature"` 分岐で、
`keywords.includes("invasion")` の場合は `EvolutionModal` を表示してから処理する。

`evolutionBase` が null（BZに対象クリーチャーがいない）の場合はプレイ不可とし、
メッセージを表示する。

---

### Step 8: 新コンポーネント `FinalRevolutionModal`（ファイナル革命）

`handleRevChange` 内で革命チェンジ実行後、出てきたカードに `name === "蒼き団長 ドギラゴン剣"` 
（または将来的には `finalRevolution: true` フラグ）を検出し、モーダルを表示。

```
FinalRevolutionModal の仕様:
  state:
    - selectedCards: { from: "hand"|"mana", uid }[]
    - totalCost: number（選択カードのコスト合計）
    - usedFinalRevolutionThisTurn: boolean（1ターン1回制限）

  表示:
    - 手札の多色非進化クリーチャーを一覧表示（グレー＝進化持ち or 単色）
    - マナの多色非進化クリーチャーを一覧表示
    - 「合計コスト: X / 6」をリアルタイム表示
    - 合計コスト > 6 になる選択はボタン disabled
    - 「バトルゾーンに出す」ボタン（0枚でも可、スキップ）
    - 「スキップ」ボタン

  実行:
    - 選択カードを hand / mana から除去
    - battle に追加（tapped:false, summonedThisTurn:false）
    - usedFinalRevolutionThisTurn を true にセット（ターン終了でリセット）

  1ターン1回制限:
    - GameScreen の state に usedFinalRevThisTurn: boolean を追加
    - handleEndTurn でリセット
    - FinalRevolutionModal を開く前にチェック
```

**モーダルのフロー**（革命チェンジ後）:
```
handleRevChange → onStartAttack(handCard.uid) → 
  if (handCard.name === "蒼き団長 ドギラゴン剣" && !usedFinalRevThisTurn):
    setFinalRevModal(true)
```

`finalRevModal` は `GameScreen` の state として管理し、`PlayerBoard` に props で渡す。

---

### Step 9: `CardFace` の侵略キーワードアイコン追加

**対象**: `CardFace` コンポーネント（line 186〜193）のキーワードアイコン表示部分

```jsx
{card.keywords?.includes("invasion") && <span style={{fontSize:7}}>⚡⬆</span>}
```

---

### Step 10: 効果発動確認ステップ（無限ループ防止・例外処理対応）

**目的**: 「出た時」「攻撃する時」などの自動発動効果が意図しない無限ループや
誤処理に陥った際に手動で中断・修正できるようにする。

**現在の挙動**: `triggerEffect` → `setTimeout` → `processEffect` が即時実行される。

**変更後の挙動**:
1. 効果をトリガーする前に `EffectConfirmModal` を表示
2. カードの名前・効果テキスト・効果種別を表示
3. ユーザーが「発動」ボタンを押すまで次の処理に進まない
4. モーダルに「例外処理で手動対応」ボタンも設置し、押した場合は
   processEffect をスキップして例外処理パネルを開く

**`EffectConfirmModal` の仕様**:
```
表示内容:
  - カード名（文明アイコン付き）
  - 効果の説明（autoEffect.type を日本語化して表示）
  - 「発動する」ボタン → processEffect 実行
  - 「例外処理で手動対応」ボタン → モーダルを閉じるだけ（例外処理パネルは常時表示中）

表示タイミング（triggerEffect 呼び出し時）:
  - クリーチャー召喚時の autoEffect
  - 呪文詠唱時の autoEffect
  - S・トリガー発動時の autoEffect
  - 侵略成功時の autoEffect（レッドゾーンの「出た時」など）
```

**実装箇所**:
- `triggerEffect` 関数（line 996〜1001）を変更:
  - `processEffect` を直接呼ぶ代わりに `setEffectConfirmModal({effect, ownerPid, selfSnap, otherSnap, srcCard})` をセット
- `GameScreen` に `effectConfirmModal` state を追加
- `EffectConfirmModal` 新コンポーネントを追加
  - 「発動」押下時に `processEffect` を実行してモーダルを閉じる
  - 「例外処理」押下時はモーダルを閉じるのみ（例外処理パネルは常時アクセス可能）

**autoEffect.type の日本語マッピング**（表示用）:
```js
const EFFECT_TYPE_LABELS = {
  draw:            "カードをドロー",
  handDestroy:     "相手の手札を破壊",
  destroy:         "クリーチャーを破壊",
  sendToMana:      "クリーチャーをマナゾーンへ",
  bounce:          "クリーチャーを手札に戻す",
  manaReturn:      "マナゾーンのカードを手札へ",
  deckSearch:      "山札からカードをサーチ",
  destroyUnder:    "パワー以下のクリーチャーを破壊",
  tapAll:          "相手クリーチャーを全タップ",
  deckToMana:      "山札の上をマナゾーンへ",
  destroyMaxPower: "最大パワーの相手クリーチャーを破壊",
};
```

---

### Step 11: 付与能力の別色表示

**目的**: ドギラゴン剣の「多色クリーチャーにSA付与」など、外部から付与された能力を
元々の能力とは別の色（金色）でカード上に表示する。

**設計**:
- `CardFace` コンポーネントに `grantedKeywords?: string[]` プロパティを追加
- アイコン表示部分で、`grantedKeywords` に含まれるキーワードを金色（`#ffe066`）で描画
- 元々の `card.keywords` は既存の色のまま

**計算箇所**: `PlayerBoard` で各クリーチャーの `CardFace` を描画する際に、
パッシブ効果を計算して `grantedKeywords` として渡す:

```js
// PlayerBoard 内で BZ カードを描画する際
const dogiragoonPresent = state.battle.some(c => c.name === "蒼き団長 ドギラゴン剣");

const getGrantedKeywords = (card) => {
  const granted = [];
  const isMulticolor = Array.isArray(card.civ) && card.civ.length >= 2;
  if (dogiragoonPresent && isMulticolor && !card.keywords?.includes("speedAttacker")) {
    granted.push("speedAttacker");
  }
  return granted;
};
```

**`CardFace` のアイコン表示変更**:
```jsx
// 既存（元々の能力）: 白系アイコン
{card.keywords?.includes("speedAttacker") && <span style={{fontSize:7}}>⚡</span>}

// 追加（付与された能力）: 金色アイコン
{grantedKeywords?.includes("speedAttacker") && !card.keywords?.includes("speedAttacker") &&
  <span style={{fontSize:7, color:"#ffe066", textShadow:"0 0 4px #ffe066"}}>⚡</span>}
```

**手札のカードへの適用**: 手札表示でも同様に `grantedKeywords` を渡す
（現時点では手札への付与効果はないため、将来対応のために props のみ追加）

---

## 修正ファイル一覧

| ファイル | 変更内容 |
|----------|---------|
| `public/cards.json` | id 37, 38 のカードオブジェクトを末尾に追加 |
| `src/App.jsx` | 下記の通り多箇所に変更 |

### App.jsx 変更箇所まとめ

| 対象 | 変更種別 | 内容 |
|------|---------|------|
| `ALL_KEYWORDS` (line 4) | 追加 | `"invasion"` |
| `KEYWORD_LABELS` (line 5) | 追加 | `invasion: "侵略"` |
| `processEffect` (line 163) | 追加 | `destroyMaxPower` ケース |
| `AttackTriggerModal` (line 489) | 拡張 | `minCost` 条件 + 侵略カード表示 |
| `handleAttackWithTriggerCheck` (line 556) | 拡張 | 侵略チェック追加 + `minCost` 条件 |
| `handleRevChange` (line 573) | 拡張 | ファイナル革命トリガー |
| `handlePlayCard` (line 1016) | 拡張 | 進化召喚モーダル表示 |
| `CreatureDetailPanel` | 拡張 | 多色SAパッシブ判定 |
| `PlayerBoard` | 拡張 | `invasionTarget`, `finalRevModal` state追加 |
| `GameScreen` | 拡張 | `usedFinalRevThisTurn` state追加, `handleEndTurn` でリセット |
| 新コンポーネント追加 | 新規 | `InvasionModal`, `EvolutionModal`, `FinalRevolutionModal`, `EffectConfirmModal` |
| `CardFace` (line 186) | 拡張 | 侵略アイコン + `grantedKeywords` props（付与能力を金色表示） |
| `triggerEffect` (line 996) | 変更 | processEffect 直接実行 → EffectConfirmModal 経由に変更 |
| `GameScreen` | 追加 | `effectConfirmModal` state, `usedFinalRevThisTurn` state |
| `EFFECT_TYPE_LABELS` | 新規 | autoEffect.type の日本語マッピング定数 |

---

## 検証方法

1. **カード追加確認**: カードマネージャー画面でid 37, 38 が表示されること
2. **レッドゾーン進化召喚**: 手札からプレイ → 火クリーチャー選択モーダルが出る → 進化元が BZ から消え、レッドゾーンが着地 → 効果確認モーダルが出る → 「発動」で最大パワーのクリーチャーが破壊される
3. **レッドゾーン侵略**: 火コマンドで攻撃 → 侵略モーダルが出る → 侵略実行 → 効果確認モーダルが出る → 「発動」で最大パワー破壊 → T・ブレイカー 3 枚ブレイク
4. **ドギラゴン剣 革命チェンジ**: 火または自然のコスト5以上ドラゴンで攻撃 → 革命チェンジモーダルに表示される（コスト4以下のドラゴンでは表示されない）→ チェンジ実行
5. **ドギラゴン剣 ファイナル革命**: チェンジ後にファイナル革命モーダルが出る → 手札とマナから多色クリーチャーを選択（合計6以下制約が機能している）→ バトルゾーンに展開
6. **多色SAパッシブ**: ドギラゴン剣 BZ 在中に多色クリーチャーを召喚 → 同ターンに攻撃可能 → カード上の⚡が金色で表示される
7. **1ターン1回制限**: 同ターンに革命チェンジを2回行ってもファイナル革命は1度だけ発動
8. **効果確認モーダル**: S・トリガー・召喚時効果・呪文効果の全autoEffectで確認モーダルが出る → 「例外処理」を選ぶと効果をスキップして例外処理パネルで手動対応できる
