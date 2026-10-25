/**
 * マニュアルの検査。実行時の依存を増やさないため、形の検査も自前で書く（JSON Schema と同じ規則）。
 *
 * - errors: 形の誤り（必須項目が無い、型が違う、列挙に無い値、coords の長さ）、参照切れ（transition.to / assetRef /
 *   scopeRefs / targetRef / startScreenRef）、id の重複
 * - warnings: 到達できない画面、遷移の無い画面（終端でないのに次が無い）、素材の無い参照先、使われていない素材・適用範囲
 */
import type { Manual } from './types.js';

export interface ValidationIssue {
  /** JSON Pointer 風の場所（例: /topics/0/screens/2/hotspots/1/transition/to） */
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const nonEmpty = (v: unknown): v is string => isStr(v) && v.length > 0;

const TOPIC_KINDS = ['description', 'procedure', 'screenFlow', 'troubleshooting'];
const BLOCK_KINDS = ['section', 'para', 'list', 'table', 'figure', 'admonition'];
const LEVELS = ['warning', 'caution', 'note'];
const SHAPES = ['rect', 'circle', 'poly'];
const ACTIONS = ['press', 'input', 'read'];
const ASSET_KINDS = ['image', 'video', 'model3d', 'document'];

class Checker {
  errors: ValidationIssue[] = [];
  warnings: ValidationIssue[] = [];
  /** 種類ごとの id の集合（重複と参照の検査に使う） */
  ids = {
    scope: new Set<string>(),
    asset: new Set<string>(),
    topic: new Set<string>(),
    step: new Set<string>(),
    screen: new Set<string>(),
    hotspot: new Set<string>(),
    block: new Set<string>(),
  };
  usedAssets = new Set<string>();
  usedScopes = new Set<string>();
  private allIds = new Map<string, string>();

  err(path: string, message: string) {
    this.errors.push({ path, message });
  }
  warn(path: string, message: string) {
    this.warnings.push({ path, message });
  }

  id(kind: keyof Checker['ids'], v: unknown, path: string): string | undefined {
    if (!nonEmpty(v)) {
      this.err(path, 'id must be a non-empty string');
      return undefined;
    }
    const prev = this.allIds.get(v);
    if (prev) this.err(path, `duplicate id "${v}" (also at ${prev})`);
    this.allIds.set(v, path);
    this.ids[kind].add(v);
    return v;
  }

  str(o: Obj, key: string, path: string, required = false) {
    const v = o[key];
    if (v === undefined) {
      if (required) this.err(`${path}/${key}`, `${key} is required`);
      return;
    }
    if (!isStr(v) || (required && v.length === 0))
      this.err(`${path}/${key}`, `${key} must be a ${required ? 'non-empty ' : ''}string`);
  }

  enumOf(o: Obj, key: string, values: string[], path: string, required = false) {
    const v = o[key];
    if (v === undefined) {
      if (required) this.err(`${path}/${key}`, `${key} is required`);
      return;
    }
    if (!isStr(v) || !values.includes(v))
      this.err(`${path}/${key}`, `${key} must be one of ${values.join(' / ')}`);
  }

  strArray(o: Obj, key: string, path: string) {
    const v = o[key];
    if (v === undefined) return;
    if (!Array.isArray(v) || !v.every(isStr))
      this.err(`${path}/${key}`, `${key} must be an array of strings`);
  }

  refs(o: Obj, key: string, path: string, collect: Set<string>) {
    this.strArray(o, key, path);
    const v = o[key];
    if (Array.isArray(v)) for (const s of v) if (isStr(s)) collect.add(s);
  }

  admonitions(o: Obj, path: string) {
    const v = o.admonitions;
    if (v === undefined) return;
    if (!Array.isArray(v)) return this.err(`${path}/admonitions`, 'admonitions must be an array');
    v.forEach((a, i) => {
      const p = `${path}/admonitions/${i}`;
      if (!isObj(a)) return this.err(p, 'admonition must be an object');
      this.enumOf(a, 'level', LEVELS, p, true);
      this.str(a, 'text', p, true);
    });
  }

  transition(v: unknown, path: string, targets: Array<{ to: string; path: string }>) {
    if (!isObj(v)) return this.err(path, 'transition must be an object');
    this.str(v, 'to', path, true);
    if (nonEmpty(v.to)) targets.push({ to: v.to, path: `${path}/to` });
    this.str(v, 'condition', path);
    this.str(v, 'label', path);
    if (v.when !== undefined) {
      if (!isObj(v.when)) this.err(`${path}/when`, 'when must be an object');
      else {
        this.str(v.when, 'property', `${path}/when`, true);
        this.strArray(v.when, 'values', `${path}/when`);
      }
    }
  }
}

export function validateManual(input: unknown): ValidationResult {
  const c = new Checker();
  if (!isObj(input)) {
    c.err('', 'manual must be an object');
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }
  const m = input;
  c.str(m, 'id', '', true);
  c.str(m, 'title', '', true);
  c.str(m, 'description', '');
  if (!isObj(m.version)) c.err('/version', 'version is required and must be an object');
  else {
    c.str(m.version, 'number', '/version', true);
    if (
      m.version.date !== undefined &&
      !(isStr(m.version.date) && /^\d{4}-\d{2}-\d{2}$/.test(m.version.date))
    )
      c.err('/version/date', 'date must be YYYY-MM-DD');
    c.str(m.version, 'note', '/version');
  }
  if (!(isStr(m.language) && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(m.language)))
    c.err('/language', 'language must be a BCP 47 tag such as "ja" or "en-US"');

  // scopes / assets を先に読む（参照の検査に使う）
  if (m.scopes !== undefined) {
    if (!Array.isArray(m.scopes)) c.err('/scopes', 'scopes must be an array');
    else
      m.scopes.forEach((s, i) => {
        const p = `/scopes/${i}`;
        if (!isObj(s)) return c.err(p, 'scope must be an object');
        c.id('scope', s.id, `${p}/id`);
        c.str(s, 'property', p, true);
        c.str(s, 'displayText', p, true);
        if (!Array.isArray(s.values) || s.values.length === 0 || !s.values.every(isStr))
          c.err(`${p}/values`, 'values must be a non-empty array of strings');
      });
  }
  if (m.assets !== undefined) {
    if (!Array.isArray(m.assets)) c.err('/assets', 'assets must be an array');
    else
      m.assets.forEach((a, i) => {
        const p = `/assets/${i}`;
        if (!isObj(a)) return c.err(p, 'asset must be an object');
        c.id('asset', a.id, `${p}/id`);
        c.enumOf(a, 'kind', ASSET_KINDS, p, true);
        for (const k of ['source', 'display'] as const) {
          const f = a[k];
          if (f === undefined) {
            if (k === 'source') c.err(`${p}/source`, 'source is required');
            continue;
          }
          if (!isObj(f)) c.err(`${p}/${k}`, `${k} must be an object`);
          else {
            c.str(f, 'path', `${p}/${k}`, true);
            c.str(f, 'mediaType', `${p}/${k}`);
            c.str(f, 'hash', `${p}/${k}`);
          }
        }
        c.str(a, 'alt', p);
        c.str(a, 'credit', p);
      });
  }
  if (m.glossary !== undefined) {
    if (!Array.isArray(m.glossary)) c.err('/glossary', 'glossary must be an array');
    else
      m.glossary.forEach((t, i) => {
        if (!isObj(t)) return c.err(`/glossary/${i}`, 'term must be an object');
        c.str(t, 'term', `/glossary/${i}`, true);
        c.str(t, 'definition', `/glossary/${i}`, true);
      });
  }

  const transitions: Array<{ to: string; path: string }> = [];
  const assetRefs: Array<{ id: string; path: string }> = [];
  const targetRefs: Array<{ id: string; path: string }> = [];
  const startRefs: Array<{ id: string; path: string; screens: Set<string> }> = [];
  /** 画面ごとの遷移先（到達の検査に使う） */
  const flows: Array<{ topicPath: string; screens: Map<string, string[]>; start?: string }> = [];

  const checkBlocks = (blocks: unknown, path: string) => {
    if (!Array.isArray(blocks)) return c.err(path, 'blocks must be an array');
    blocks.forEach((b, i) => {
      const p = `${path}/${i}`;
      if (!isObj(b)) return c.err(p, 'block must be an object');
      c.enumOf(b, 'kind', BLOCK_KINDS, p, true);
      if (b.id !== undefined) c.id('block', b.id, `${p}/id`);
      c.str(b, 'title', p);
      c.str(b, 'text', p);
      c.strArray(b, 'items', p);
      if (b.ordered !== undefined && typeof b.ordered !== 'boolean')
        c.err(`${p}/ordered`, 'ordered must be a boolean');
      if (
        b.rows !== undefined &&
        !(Array.isArray(b.rows) && b.rows.every((r) => Array.isArray(r) && r.every(isStr)))
      )
        c.err(`${p}/rows`, 'rows must be an array of arrays of strings');
      if (b.assetRef !== undefined) {
        c.str(b, 'assetRef', p);
        if (isStr(b.assetRef)) assetRefs.push({ id: b.assetRef, path: `${p}/assetRef` });
      }
      if (b.kind === 'admonition') c.enumOf(b, 'level', LEVELS, p, true);
      else if (b.level !== undefined) c.enumOf(b, 'level', LEVELS, p);
      c.refs(b, 'scopeRefs', p, c.usedScopes);
      if (b.children !== undefined) checkBlocks(b.children, `${p}/children`);
    });
  };

  const checkSteps = (steps: unknown, path: string) => {
    if (!Array.isArray(steps)) return c.err(path, 'steps must be an array');
    steps.forEach((s, i) => {
      const p = `${path}/${i}`;
      if (!isObj(s)) return c.err(p, 'step must be an object');
      c.id('step', s.id, `${p}/id`);
      c.str(s, 'text', p, true);
      c.str(s, 'expected', p);
      c.str(s, 'question', p);
      if (s.targetRef !== undefined) {
        c.str(s, 'targetRef', p);
        if (isStr(s.targetRef)) targetRefs.push({ id: s.targetRef, path: `${p}/targetRef` });
      }
      c.admonitions(s, p);
      c.refs(s, 'assetRefs', p, new Set());
      if (Array.isArray(s.assetRefs))
        for (const a of s.assetRefs)
          if (isStr(a)) assetRefs.push({ id: a, path: `${p}/assetRefs` });
      c.refs(s, 'scopeRefs', p, c.usedScopes);
      if (s.next !== undefined) {
        if (!Array.isArray(s.next)) c.err(`${p}/next`, 'next must be an array');
        else s.next.forEach((t, j) => c.transition(t, `${p}/next/${j}`, transitions));
      }
      if (s.answers !== undefined) {
        if (!Array.isArray(s.answers)) c.err(`${p}/answers`, 'answers must be an array');
        else
          s.answers.forEach((a, j) => {
            const ap = `${p}/answers/${j}`;
            if (!isObj(a)) return c.err(ap, 'answer must be an object');
            c.str(a, 'text', ap, true);
            c.transition(a.next, `${ap}/next`, transitions);
          });
      }
      if (s.children !== undefined) checkSteps(s.children, `${p}/children`);
    });
  };

  const checkScreens = (screens: unknown, path: string, flow: (typeof flows)[number]) => {
    if (!Array.isArray(screens)) return c.err(path, 'screens must be an array');
    screens.forEach((s, i) => {
      const p = `${path}/${i}`;
      if (!isObj(s)) return c.err(p, 'screen must be an object');
      const id = c.id('screen', s.id, `${p}/id`);
      c.str(s, 'caption', p);
      c.str(s, 'description', p);
      c.str(s, 'assetRef', p, true);
      if (isStr(s.assetRef)) assetRefs.push({ id: s.assetRef, path: `${p}/assetRef` });
      c.admonitions(s, p);
      c.refs(s, 'scopeRefs', p, c.usedScopes);
      const outs: string[] = [];
      if (!Array.isArray(s.hotspots))
        c.err(`${p}/hotspots`, 'hotspots is required and must be an array');
      else
        s.hotspots.forEach((h, j) => {
          const hp = `${p}/hotspots/${j}`;
          if (!isObj(h)) return c.err(hp, 'hotspot must be an object');
          c.id('hotspot', h.id, `${hp}/id`);
          c.str(h, 'label', hp);
          c.enumOf(h, 'shape', SHAPES, hp, true);
          c.enumOf(h, 'action', ACTIONS, hp);
          const coords = h.coords;
          if (
            !Array.isArray(coords) ||
            !coords.every((n) => typeof n === 'number' && Number.isFinite(n))
          )
            c.err(`${hp}/coords`, 'coords must be an array of numbers');
          else {
            const n = coords.length;
            if (h.shape === 'rect' && n !== 4)
              c.err(`${hp}/coords`, `rect needs 4 numbers [x1, y1, x2, y2], got ${n}`);
            if (h.shape === 'circle' && n !== 3)
              c.err(`${hp}/coords`, `circle needs 3 numbers [cx, cy, r], got ${n}`);
            if (h.shape === 'poly' && (n < 6 || n % 2 !== 0))
              c.err(`${hp}/coords`, `poly needs an even number of at least 6 numbers, got ${n}`);
          }
          if (h.transition !== undefined) {
            c.transition(h.transition, `${hp}/transition`, transitions);
            if (isObj(h.transition) && nonEmpty(h.transition.to)) outs.push(h.transition.to);
          }
        });
      if (id) flow.screens.set(id, outs);
    });
  };

  if (!Array.isArray(m.topics)) c.err('/topics', 'topics is required and must be an array');
  else
    m.topics.forEach((t, i) => {
      const p = `/topics/${i}`;
      if (!isObj(t)) return c.err(p, 'topic must be an object');
      c.id('topic', t.id, `${p}/id`);
      c.enumOf(t, 'kind', TOPIC_KINDS, p, true);
      c.str(t, 'title', p, true);
      c.str(t, 'summary', p);
      c.refs(t, 'scopeRefs', p, c.usedScopes);
      if (t.blocks !== undefined) checkBlocks(t.blocks, `${p}/blocks`);
      if (t.steps !== undefined) checkSteps(t.steps, `${p}/steps`);
      const flow: (typeof flows)[number] = { topicPath: p, screens: new Map() };
      if (t.screens !== undefined) checkScreens(t.screens, `${p}/screens`, flow);
      if (t.startScreenRef !== undefined) {
        c.str(t, 'startScreenRef', p);
        if (isStr(t.startScreenRef)) {
          flow.start = t.startScreenRef;
          startRefs.push({
            id: t.startScreenRef,
            path: `${p}/startScreenRef`,
            screens: new Set(flow.screens.keys()),
          });
        }
      }
      if (t.kind === 'screenFlow' && flow.screens.size === 0)
        c.warn(p, 'screenFlow topic has no screens');
      if (t.kind === 'procedure' && !Array.isArray(t.steps))
        c.warn(p, 'procedure topic has no steps');
      if (t.kind === 'description' && !Array.isArray(t.blocks))
        c.warn(p, 'description topic has no blocks');
      if (flow.screens.size > 0) flows.push(flow);
    });

  // 参照の検査
  for (const t of transitions) {
    if (!c.ids.screen.has(t.to) && !c.ids.step.has(t.to))
      c.err(t.path, `transition target "${t.to}" is not a screen or step id`);
  }
  for (const a of assetRefs) {
    c.usedAssets.add(a.id);
    if (!c.ids.asset.has(a.id)) c.err(a.path, `asset "${a.id}" is not defined in assets`);
  }
  for (const t of targetRefs) {
    if (!c.ids.hotspot.has(t.id) && !c.ids.block.has(t.id))
      c.warn(t.path, `targetRef "${t.id}" is not a hotspot or block id`);
  }
  for (const s of startRefs) {
    if (!s.screens.has(s.id))
      c.err(s.path, `startScreenRef "${s.id}" is not a screen of this topic`);
  }
  for (const scope of c.usedScopes) {
    if (!c.ids.scope.has(scope)) c.err('/scopes', `scope "${scope}" is referenced but not defined`);
  }
  for (const id of c.ids.asset)
    if (!c.usedAssets.has(id)) c.warn('/assets', `asset "${id}" is not used`);
  for (const id of c.ids.scope)
    if (!c.usedScopes.has(id)) c.warn('/scopes', `scope "${id}" is not used`);

  // 到達の検査（画面の流れ）
  for (const f of flows) {
    const start = f.start ?? [...f.screens.keys()][0];
    const seen = new Set<string>();
    const queue = [start];
    while (queue.length > 0) {
      const s = queue.shift()!;
      if (seen.has(s)) continue;
      seen.add(s);
      for (const next of f.screens.get(s) ?? []) if (f.screens.has(next)) queue.push(next);
    }
    for (const id of f.screens.keys())
      if (!seen.has(id))
        c.warn(`${f.topicPath}/screens`, `screen "${id}" cannot be reached from "${start}"`);
  }

  return { ok: c.errors.length === 0, errors: c.errors, warnings: c.warnings };
}

/** 型の上での補助: 検査に通ったものを Manual として扱う */
export function assertManual(input: unknown): Manual {
  const r = validateManual(input);
  if (!r.ok)
    throw new Error(`Invalid manual: ${r.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`);
  return input as Manual;
}
