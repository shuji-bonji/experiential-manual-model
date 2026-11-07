# Changelog

## 0.2.0 (未リリース)

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
