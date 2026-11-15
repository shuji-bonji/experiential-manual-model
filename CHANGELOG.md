# Changelog

## 0.4.0 (2026-11-15)

実在の技術マニュアルの消耗品の一覧が、品目を部品番号ではなく NATO 物品番号（NSN）で示していたので、品目に NSN の項目を足しました（s1000d-stack の notes/tm-eval-progress.md）。追加だけで、0.3.0 の JSON はそのまま読めます。

### 追加

- `Topic.prerequisites` の `equipment`・`supplies`・`spares` の品目に `natoStockNumber`（任意）: NATO 物品番号（NSN）。数字 13 桁で、`6850-00-181-7933` のように 4-2-3-4 桁をハイフンで区切って書けます
- `validateManual` と JSON Schema: `natoStockNumber` が 13 桁の数字（ハイフンは 4-2-3-4 桁の間だけ）でなければ誤りにします
- テストを 15 件に

## 0.3.0 (2026-11-15)

実在の技術マニュアルを写して分かった不足のうち、作業前の要件とホットスポットの説明を足しました（s1000d-stack の design/manual-model-0.3.0.md、notes/tm-eval-requests.md の M-1・M-2・M-3）。追加だけで、0.2.0 の JSON はそのまま読めます。

### 追加

- `Topic.prerequisites`（任意）: 手順（`procedure`）と困ったとき（`troubleshooting`）の作業前の要件。区分は 7 つで、どれも任意です
  - `conditions`: 作業を始める条件。`{ text, topicRef? }`（`topicRef` は、条件を満たす手順がある Topic の id）
  - `personnel`: 必要な人員。`{ role, count? }`（`count` は 1 以上の整数）
  - `references`: 参照する文書。`{ title, code?, topicRef? }`
  - `equipment`（試験器材・工具）、`supplies`（材料・消耗品）、`spares`（予備品）: `{ name, quantity?, unit?, partNumber?, manufacturerCode?, note? }`
  - `safety`: 作業全体にかかる警告・注意・備考（`Admonition` の配列）。閲覧ソフトは手順の先頭に表示します
- `Hotspot.description`（任意）: 説明。`label` には名前だけを書きます
- `Hotspot.callout`（任意）: 図の引き出し線の番号・記号
- `validateManual`: `prerequisites` の形と、`topicRef` が Topic の id であることを検査します（誤り）。説明・画面の流れの Topic に `prerequisites` があるときは、表示する場所が無いので警告にします
- 券売機の例の「前面扉を開ける」に `prerequisites` を、最初のホットスポットに `description` と `callout` を足し、テストを 14 件に

## 0.2.0 (2026-11-08)

作成ツール・閲覧部品の設計（s1000d-stack の design/player-and-editor.md 6 節、notes/editor-and-viewer-study.md 6 節）で必要になった項目の追加。追加だけで、0.1.0 の JSON はそのまま読めます。

### 追加

- `AssetFile.data`（任意）: 内容を埋め込む data URL。0.1.0 では `path` に入れていたものの置き場所。`path` と `data` のどちらか一方があればよく、`validateManual` と JSON Schema は両方が無いときだけ誤りにします。`data` は `data:` で始まらなければ誤りです
- `AssetFile.width` / `height`（任意）: 画像の元の大きさ（1 以上の整数、ピクセル）
- `Screen.capture`（任意）: `{ url, viewport?: { width, height }, capturedAt? }`。Web アプリの画面を撮ったときの記録
- `Hotspot.capture`（任意）: `{ selector }`。撮り直したときに同じ要素を探すための CSS セレクター
- `Admonition.title`（任意）: 注意書きの見出し
- `Screen` の JSDoc と README に、画像はスクリーンショットに限らないことを明記
- 券売機の例に上の項目を足し、テストを 13 件に

### 変更

- `AssetFile.path` が任意になりました（`data` があれば省けます）。型の上では `path?: string` になるため、`source.path` を文字列として直接使っているコードは `??` などで扱いを足してください
- `fromLegacyJson`: `imageUrl` が data URL のときは `source.path` ではなく `source.data` に入れます

## 0.1.0 (2026-10-26)

最初の版。s1000d-stack の段階 2 の作業 8（design/manual-model.md、DECISIONS D-01・D-09・U-04）。

### 追加

- 型（`Manual` / `Topic` / `Block` / `Step` / `Screen` / `Hotspot` / `Transition` / `Asset` / `Scope` / `Admonition` / `Term`）
- JSON Schema `schema/manual.schema.json`（draft 2020-12。`Hotspot.shape` ごとの `coords` の長さも検査）
- `validateManual` / `assertManual`: 実行時の依存なしで、形・参照・id の重複を `errors`、到達できない画面と未使用の素材・適用範囲を `warnings` で返す
- `fromLegacyJson`: 2021 年の `JSON.json`（`purchaseTypes` / `screenID` / `destination`。README の表記 `displayAreas` / `screenId` / `screenTransitionDestination` も可）を読む
- `numberSteps` / `findStepByNumber`
- 券売機の例 `examples/kenbaiki.manual.json`（4 種類の話題）
