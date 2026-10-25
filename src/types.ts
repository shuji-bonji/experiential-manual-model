/**
 * @shuji-bonji/experiential-manual-model
 *
 * 体験型操作マニュアルの共通データモデル。作成ツール・閲覧ソフトと、S1000D への入出力（writer）が共有する。
 * S1000D の語（DMC・データモジュール・BREX・ICN・適用性）はフィールド名に使わない（DECISIONS D-01、D-09）。
 * S1000D との対応表は design/manual-model.md にあり、変換は writer 側に置く。
 */

/** マニュアル 1 冊 */
export interface Manual {
  /** 作成ツールが付ける一意の識別子（UUID を推奨） */
  id: string;
  title: string;
  version: Version;
  /** BCP 47（ja、en-US など） */
  language: string;
  description?: string;
  /** 適用範囲（この機種・この版の画面、など）。Topic / Step / Block が scopeRefs で参照する */
  scopes?: Scope[];
  topics: Topic[];
  assets?: Asset[];
  glossary?: Term[];
}

export interface Version {
  /** 版の表記（"1.0"、"2026-10" など。形式は決めない） */
  number: string;
  /** ISO 8601 の日付（YYYY-MM-DD） */
  date?: string;
  note?: string;
}

export type TopicKind = 'description' | 'procedure' | 'screenFlow' | 'troubleshooting';

/** 1 つの話題。kind によって主に使う配列が変わる */
export interface Topic {
  id: string;
  kind: TopicKind;
  title: string;
  summary?: string;
  scopeRefs?: string[];
  /** description の本文 */
  blocks?: Block[];
  /** procedure / troubleshooting の手順 */
  steps?: Step[];
  /** screenFlow の画面 */
  screens?: Screen[];
  /** screenFlow で最初に表示する画面の id */
  startScreenRef?: string;
}

export type BlockKind = 'section' | 'para' | 'list' | 'table' | 'figure' | 'admonition';

export interface Block {
  kind: BlockKind;
  id?: string;
  title?: string;
  text?: string;
  /** list の項目 */
  items?: string[];
  ordered?: boolean;
  /** table の行（先頭行を見出しに使う） */
  rows?: string[][];
  /** figure の素材 */
  assetRef?: string;
  /** admonition の種類 */
  level?: AdmonitionLevel;
  scopeRefs?: string[];
  children?: Block[];
}

export type AdmonitionLevel = 'warning' | 'caution' | 'note';

export interface Admonition {
  level: AdmonitionLevel;
  text: string;
}

/** 手順の 1 段。番号は保存せず表示時に組み立てる（numberSteps） */
export interface Step {
  id: string;
  text: string;
  /** 操作対象（Hotspot.id か部品の id） */
  targetRef?: string;
  /** 操作後に起きること */
  expected?: string;
  admonitions?: Admonition[];
  assetRefs?: string[];
  scopeRefs?: string[];
  /** 次に進む先（分岐があるとき）。無ければ次の兄弟 */
  next?: Transition[];
  /** troubleshooting の問い */
  question?: string;
  /** troubleshooting の答えごとの行き先 */
  answers?: Array<{ text: string; next: Transition }>;
  children?: Step[];
}

/** 画面（スクリーンショット）1 枚と、その上の操作できる場所 */
export interface Screen {
  id: string;
  /** 表示用の短い名前（"STEP1" など） */
  caption?: string;
  assetRef: string;
  description?: string;
  admonitions?: Admonition[];
  hotspots: Hotspot[];
  scopeRefs?: string[];
}

export type HotspotShape = 'rect' | 'circle' | 'poly';
export type HotspotAction = 'press' | 'input' | 'read';

/**
 * 画面上の操作できる領域。coords は HTML の <area> と同じ書き方:
 * rect [x1, y1, x2, y2]、circle [cx, cy, r]、poly [x1, y1, x2, y2, …]
 */
export interface Hotspot {
  id: string;
  label?: string;
  shape: HotspotShape;
  coords: number[];
  action?: HotspotAction;
  transition?: Transition;
}

export interface Transition {
  /** Screen.id または Step.id */
  to: string;
  /** 文で書いた条件（例: 残高が不足しているとき） */
  condition?: string;
  /** 機械判定用の条件（省略可）。Scope と同じ property / values */
  when?: { property: string; values: string[] };
  label?: string;
}

export type AssetKind = 'image' | 'video' | 'model3d' | 'document';

export interface AssetFile {
  path: string;
  mediaType?: string;
  /** 内容のハッシュ（"sha256:…"）。変更の検出に使う */
  hash?: string;
}

/** 素材。source が原本、display が表示用の変換物（3D の glTF、動画のサムネイルなど） */
export interface Asset {
  id: string;
  kind: AssetKind;
  source: AssetFile;
  display?: AssetFile;
  alt?: string;
  credit?: string;
}

/** 適用範囲。property（例: model）と values（例: ["MV-50", "MV-60"]）、人が読む displayText */
export interface Scope {
  id: string;
  property: string;
  values: string[];
  displayText: string;
}

export interface Term {
  term: string;
  definition: string;
}
