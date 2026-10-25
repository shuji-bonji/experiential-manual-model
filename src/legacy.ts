/**
 * 2021 年の作品 experience_based_operation_explanation の `JSON.json` を読む。
 *
 * 実物（2026-10-25 に GitHub から取得）の形:
 *   { purchaseTypes: [ { titleID, title, description, screens: [ { screenID, caption, description,
 *     supplementaryExplanation, imageUrl, buttons: [ { name, shape, destination, coords } ] } ] } ] }
 * README が示唆する `displayAreas` / `screenId` / `screenTransitionDestination` の表記も受け付ける。
 *
 * 分かっている癖: `rect` の coords に 5 つ目の値が付いた button が 2 件ある（捨てて警告にする）。
 */
import type { Admonition, Asset, Hotspot, Manual, Screen, Topic, Transition } from './types.js';

export interface LegacyConversion {
  manual: Manual;
  warnings: string[];
}

export interface LegacyOptions {
  /** Manual.id（省略時は "legacy-manual"） */
  id?: string;
  title?: string;
  language?: string;
  version?: string;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const pick = (o: Obj, ...keys: string[]): unknown => {
  for (const k of keys) if (o[k] !== undefined) return o[k];
  return undefined;
};
const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined;

export function fromLegacyJson(input: unknown, options: LegacyOptions = {}): LegacyConversion {
  const warnings: string[] = [];
  if (!isObj(input)) throw new Error('legacy JSON must be an object');
  const areas = pick(input, 'purchaseTypes', 'displayAreas');
  if (!Array.isArray(areas))
    throw new Error('legacy JSON has neither "purchaseTypes" nor "displayAreas"');

  const assets = new Map<string, Asset>();
  const assetIdFor = (url: string): string => {
    for (const [id, a] of assets) if (a.source.path === url) return id;
    const id = `asset-${String(assets.size + 1).padStart(3, '0')}`;
    assets.set(id, { id, kind: 'image', source: { path: url } });
    return id;
  };

  const topics: Topic[] = areas.map((area, ai) => {
    const a = isObj(area) ? area : {};
    const topicId = text(pick(a, 'titleID', 'titleId', 'id')) ?? `topic-${ai + 1}`;
    const screensIn = Array.isArray(a.screens) ? a.screens : [];
    const screens: Screen[] = screensIn.map((sc, si) => {
      const s = isObj(sc) ? sc : {};
      const screenId = text(pick(s, 'screenID', 'screenId', 'id')) ?? `${topicId}-screen-${si + 1}`;
      // 同じ screenID が別の話題にもあるので、話題ごとに接頭辞を付けて一意にする
      const qualified = `${topicId}/${screenId}`;
      const imageUrl = text(pick(s, 'imageUrl', 'image')) ?? '';
      if (!imageUrl) warnings.push(`${topicId}/${screenId}: no imageUrl`);
      const buttons = Array.isArray(s.buttons) ? s.buttons : [];
      const hotspots: Hotspot[] = buttons.map((bt, bi) => {
        const b = isObj(bt) ? bt : {};
        const shapeRaw = text(b.shape) ?? 'rect';
        const shape =
          shapeRaw === 'rect' || shapeRaw === 'circle' || shapeRaw === 'poly' ? shapeRaw : 'rect';
        let coords = Array.isArray(b.coords)
          ? b.coords.filter((n): n is number => typeof n === 'number')
          : [];
        const want = shape === 'rect' ? 4 : shape === 'circle' ? 3 : coords.length;
        if (shape !== 'poly' && coords.length > want) {
          warnings.push(
            `${qualified} button ${bi + 1}: ${shape} has ${coords.length} coords; extra values dropped`,
          );
          coords = coords.slice(0, want);
        }
        if (shape !== 'poly' && coords.length < want)
          warnings.push(`${qualified} button ${bi + 1}: ${shape} has only ${coords.length} coords`);
        const dest = text(pick(b, 'destination', 'screenTransitionDestination'));
        const h: Hotspot = {
          id: `${qualified}/hotspot-${bi + 1}`,
          label: text(b.name),
          shape,
          coords,
          action: 'press',
        };
        if (dest) {
          const t: Transition = { to: `${topicId}/${dest}` };
          h.transition = t;
        }
        return h;
      });
      const admonitions: Admonition[] = [];
      const supp = text(s.supplementaryExplanation);
      if (supp) admonitions.push({ level: 'note', text: supp });
      const screen: Screen = {
        id: qualified,
        caption: text(s.caption),
        assetRef: assetIdFor(imageUrl || `(missing image for ${qualified})`),
        description: text(s.description),
        hotspots,
      };
      if (admonitions.length > 0) screen.admonitions = admonitions;
      return screen;
    });
    const topic: Topic = {
      id: topicId,
      kind: 'screenFlow',
      title: text(a.title) ?? topicId,
      summary: text(a.description),
      screens,
    };
    if (screens.length > 0) topic.startScreenRef = screens[0].id;
    return topic;
  });

  const manual: Manual = {
    id: options.id ?? 'legacy-manual',
    title: options.title ?? '体験型操作説明（2021 年の JSON から変換）',
    version: { number: options.version ?? '1.0', note: 'converted by fromLegacyJson' },
    language: options.language ?? 'ja',
    topics,
    assets: [...assets.values()],
  };
  return { manual, warnings };
}
