import JSZip from 'jszip';

export interface ParagraphRunHint {
    text: string;
    charScaleX: number | null;
    letterSpacingPt: number | null;
}

export interface ParagraphXmlHint {
    index: number;
    plainText: string;
    maxCharScaleX: number | null;
    minCharScaleX: number | null;
    runCharScales: Array<number | null>;
    runLetterSpacingsPt: Array<number | null>;
    runs?: ParagraphRunHint[];
    hasRedHorizontalRule: boolean;
    redRuleColor: string | null;
    redRuleWidthPt: number | null;
    isTocStyle: boolean;
    hasRightLeaderTab: boolean;
}

export interface ExtractDocxHintsOptions {
    domParser?: DOMParser;
}

const LEADER_TAB_VALUES = new Set(['dot', 'middledot', 'hyphen', 'underscore', 'heavy']);
const NAMED_RED_COLORS: Record<string, string> = {
    red: '#FF0000',
    crimson: '#DC143C',
    firebrick: '#B22222',
    darkred: '#8B0000',
};

function getLocalName(node: Node | null | undefined): string {
    if (!node || node.nodeType !== 1) return '';
    const el = node as Element;
    if (el.localName) return el.localName;
    const tag = el.tagName || '';
    const idx = tag.indexOf(':');
    return idx >= 0 ? tag.slice(idx + 1) : tag;
}

function getAttr(el: Element, name: string): string | null {
    return (
        el.getAttribute(`w:${name}`) ??
        el.getAttribute(name) ??
        el.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', name) ??
        null
    );
}

function findDirectChild(parent: Element, localName: string): Element | null {
    for (let i = 0; i < parent.childNodes.length; i++) {
        const child = parent.childNodes[i];
        if (child.nodeType === 1 && getLocalName(child) === localName) {
            return child as Element;
        }
    }
    return null;
}

function findDirectChildren(parent: Element, localName: string): Element[] {
    const out: Element[] = [];
    for (let i = 0; i < parent.childNodes.length; i++) {
        const child = parent.childNodes[i];
        if (child.nodeType === 1 && getLocalName(child) === localName) {
            out.push(child as Element);
        }
    }
    return out;
}

function parseHexRgb(raw: string): [number, number, number] | null {
    const cleaned = raw.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
        return [
            parseInt(cleaned.slice(0, 2), 16),
            parseInt(cleaned.slice(2, 4), 16),
            parseInt(cleaned.slice(4, 6), 16),
        ];
    }
    if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
        return [
            parseInt(cleaned[0] + cleaned[0], 16),
            parseInt(cleaned[1] + cleaned[1], 16),
            parseInt(cleaned[2] + cleaned[2], 16),
        ];
    }
    return null;
}

function parseColorInfo(raw: string | null | undefined, maxGb = 80): { isRed: boolean; hex: string | null } {
    if (!raw) return { isRed: false, hex: null };
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed || trimmed === 'auto' || trimmed === 'none') {
        return { isRed: false, hex: null };
    }
    if (trimmed in NAMED_RED_COLORS) {
        return { isRed: true, hex: NAMED_RED_COLORS[trimmed] };
    }
    const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) {
        const r = Number(rgbMatch[1]);
        const g = Number(rgbMatch[2]);
        const b = Number(rgbMatch[3]);
        const isRed = r >= 160 && g <= maxGb && b <= maxGb;
        const hex = `#${[r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0').toUpperCase()).join('')}`;
        return { isRed, hex };
    }
    const hexRgb = parseHexRgb(trimmed);
    if (hexRgb) {
        const [r, g, b] = hexRgb;
        const isRed = r >= 160 && g <= maxGb && b <= maxGb;
        const hex = `#${trimmed.replace(/^#/, '').toUpperCase()}`;
        return { isRed, hex };
    }
    return { isRed: false, hex: null };
}

function parseCharScaleFromRPr(rPr: Element | null): number | null {
    if (!rPr) return null;
    const wEl = findDirectChild(rPr, 'w');
    if (!wEl) return null;
    const val = getAttr(wEl, 'val');
    if (!val) return null;
    const num = Number(val);
    if (!Number.isFinite(num) || num <= 0) return null;
    return Math.round((num / 100) * 1000) / 1000;
}

function parseLetterSpacingPtFromRPr(rPr: Element | null): number | null {
    if (!rPr) return null;
    const spacingEl = findDirectChild(rPr, 'spacing');
    if (!spacingEl) return null;
    const val = getAttr(spacingEl, 'val');
    if (!val) return null;
    const twips = Number(val);
    if (!Number.isFinite(twips)) return null;
    return Math.round((twips / 20) * 1000) / 1000;
}

function hasAnyDescendantNamed(root: Element, targetNames: Set<string>): boolean {
    const stack: Element[] = [root];
    while (stack.length > 0) {
        const cur = stack.pop()!;
        for (let i = 0; i < cur.childNodes.length; i++) {
            const child = cur.childNodes[i];
            if (child.nodeType !== 1) continue;
            const el = child as Element;
            if (targetNames.has(getLocalName(el))) return true;
            stack.push(el);
        }
    }
    return false;
}

function findDescendantsNamed(root: Element, targetName: string): Element[] {
    const result: Element[] = [];
    const stack: Element[] = [root];
    while (stack.length > 0) {
        const cur = stack.pop()!;
        for (let i = 0; i < cur.childNodes.length; i++) {
            const child = cur.childNodes[i];
            if (child.nodeType !== 1) continue;
            const el = child as Element;
            if (getLocalName(el) === targetName) {
                result.push(el);
            }
            stack.push(el);
        }
    }
    return result;
}

function parsePointLength(raw: string | null | undefined, defaultPt = 2.25): number {
    if (!raw) return defaultPt;
    const cleaned = raw.trim().toLowerCase();
    const num = parseFloat(cleaned);
    if (!Number.isFinite(num) || num <= 0) return defaultPt;
    if (cleaned.endsWith('px')) return Math.round(num * 0.75 * 100) / 100;
    if (cleaned.endsWith('mm')) return Math.round(num * 2.83465 * 100) / 100;
    if (cleaned.endsWith('in')) return Math.round(num * 72 * 100) / 100;
    return Math.round(num * 100) / 100;
}

function detectRedHorizontalRuleInParagraph(p: Element): {
    hasRedHorizontalRule: boolean;
    redRuleColor: string | null;
    redRuleWidthPt: number | null;
} {
    const drawings = findDescendantsNamed(p, 'drawing');
    for (const drawing of drawings) {
        if (hasAnyDescendantNamed(drawing, new Set(['blip']))) continue;

        // 若存在尺寸框，排除明显的竖线或大框图形
        const extents = findDescendantsNamed(drawing, 'ext');
        let isVerticalShape = false;
        for (const ext of extents) {
            const cx = Number(ext.getAttribute('cx'));
            const cy = Number(ext.getAttribute('cy'));
            if (Number.isFinite(cx) && Number.isFinite(cy) && cx > 0 && cy > 0) {
                if (cy > cx * 2 && cy > 200000) {
                    isVerticalShape = true;
                    break;
                }
            }
        }
        if (isVerticalShape) continue;

        const lines = findDescendantsNamed(drawing, 'ln');
        for (const ln of lines) {
            const srgbColors = findDescendantsNamed(ln, 'srgbClr');
            for (const clr of srgbColors) {
                const val = clr.getAttribute('val') ?? getAttr(clr, 'val');
                const parsed = parseColorInfo(val, 80);
                if (parsed.isRed) {
                    const wAttr = ln.getAttribute('w');
                    const wNum = wAttr ? Number(wAttr) : NaN;
                    const widthPt =
                        Number.isFinite(wNum) && wNum > 0
                            ? Math.round((wNum / 12700) * 100) / 100
                            : 2.25;
                    return {
                        hasRedHorizontalRule: true,
                        redRuleColor: parsed.hex || '#D40000',
                        redRuleWidthPt: widthPt,
                    };
                }
            }
        }
    }

    const picts = findDescendantsNamed(p, 'pict');
    for (const pict of picts) {
        if (hasAnyDescendantNamed(pict, new Set(['imagedata']))) continue;
        const vlines = findDescendantsNamed(pict, 'line');
        for (const vline of vlines) {
            const strokeColor = vline.getAttribute('strokecolor') ?? vline.getAttribute('strokeColor');
            const parsed = parseColorInfo(strokeColor, 80);
            if (parsed.isRed) {
                const strokeWeight = vline.getAttribute('strokeweight') ?? vline.getAttribute('strokeWeight');
                return {
                    hasRedHorizontalRule: true,
                    redRuleColor: parsed.hex || '#D40000',
                    redRuleWidthPt: parsePointLength(strokeWeight, 2.25),
                };
            }
        }
    }

    return {
        hasRedHorizontalRule: false,
        redRuleColor: null,
        redRuleWidthPt: null,
    };
}

interface StyleMeta {
    name: string;
    hasRightLeaderTab: boolean;
}

function parseStylesMap(xmlText: string | null, parser: DOMParser): Map<string, StyleMeta> {
    const map = new Map<string, StyleMeta>();
    if (!xmlText) return map;
    try {
        const doc = parser.parseFromString(xmlText, 'application/xml');
        const styles = findDescendantsNamed(doc.documentElement, 'style');
        for (const style of styles) {
            const styleId = getAttr(style, 'styleId');
            if (!styleId) continue;
            const nameEl = findDirectChild(style, 'name');
            const nameVal = nameEl ? getAttr(nameEl, 'val') || '' : '';
            const pPr = findDirectChild(style, 'pPr');
            let hasRightLeaderTab = false;
            if (pPr) {
                const tabsEl = findDirectChild(pPr, 'tabs');
                if (tabsEl) {
                    const tabs = findDirectChildren(tabsEl, 'tab');
                    hasRightLeaderTab = tabs.some(tab => {
                        const val = (getAttr(tab, 'val') || '').toLowerCase();
                        const leader = (getAttr(tab, 'leader') || '').toLowerCase();
                        return val === 'right' && LEADER_TAB_VALUES.has(leader);
                    });
                }
            }
            map.set(styleId, { name: nameVal, hasRightLeaderTab });
        }
    } catch {
        // 忽略 styles.xml 解析异常
    }
    return map;
}

function collectParagraphElements(body: Element): Element[] {
    const paragraphs: Element[] = [];

    const walk = (node: Element) => {
        for (let i = 0; i < node.childNodes.length; i++) {
            const child = node.childNodes[i];
            if (child.nodeType !== 1) continue;
            const el = child as Element;
            const name = getLocalName(el);
            if (name === 'tbl' || name === 'txbxContent' || name === 'Fallback') {
                continue;
            }
            if (name === 'p') {
                paragraphs.push(el);
                continue;
            }
            walk(el);
        }
    };

    walk(body);
    return paragraphs;
}

function collectRunsAndFieldsInParagraph(p: Element): {
    runs: Element[];
    fieldInstructions: string[];
} {
    const runs: Element[] = [];
    const fieldInstructions: string[] = [];

    const walk = (node: Element) => {
        for (let i = 0; i < node.childNodes.length; i++) {
            const child = node.childNodes[i];
            if (child.nodeType !== 1) continue;
            const el = child as Element;
            const name = getLocalName(el);
            if (name === 'pPr' || name === 'txbxContent' || name === 'drawing' || name === 'pict' || name === 'Fallback') {
                continue;
            }
            if (name === 'fldSimple') {
                const instr = getAttr(el, 'instr');
                if (instr) fieldInstructions.push(instr);
                walk(el);
                continue;
            }
            if (name === 'r') {
                runs.push(el);
                const instrEls = findDirectChildren(el, 'instrText');
                for (const instrEl of instrEls) {
                    if (instrEl.textContent) {
                        fieldInstructions.push(instrEl.textContent);
                    }
                }
                continue;
            }
            walk(el);
        }
    };

    walk(p);
    return { runs, fieldInstructions };
}

function extractTextFromRun(run: Element): string {
    let text = '';
    for (let i = 0; i < run.childNodes.length; i++) {
        const child = run.childNodes[i];
        if (child.nodeType !== 1) continue;
        const name = getLocalName(child);
        if (name === 't') {
            text += child.textContent || '';
        }
    }
    return text;
}

function toArrayBufferOrUint8(data: Blob | ArrayBuffer | Uint8Array): Promise<ArrayBuffer | Uint8Array> {
    if (
        data instanceof Uint8Array ||
        data instanceof ArrayBuffer ||
        ArrayBuffer.isView(data) ||
        Object.prototype.toString.call(data) === '[object ArrayBuffer]' ||
        Object.prototype.toString.call(data) === '[object Uint8Array]'
    ) {
        return Promise.resolve(data as ArrayBuffer | Uint8Array);
    }
    if (typeof (data as Blob).arrayBuffer === 'function') {
        return (data as Blob).arrayBuffer();
    }
    return Promise.reject(new Error('Unsupported docx data input'));
}

export async function extractChineseDocxParagraphHints(
    data: Blob | ArrayBuffer | Uint8Array,
    options?: ExtractDocxHintsOptions
): Promise<ParagraphXmlHint[]> {
    try {
        const parser =
            options?.domParser ??
            (typeof globalThis !== 'undefined' && typeof globalThis.DOMParser !== 'undefined'
                ? new globalThis.DOMParser()
                : null);
        if (!parser) return [];

        const raw = await toArrayBufferOrUint8(data);
        const zip = await JSZip.loadAsync(raw);
        const docFile = zip.file('word/document.xml');
        if (!docFile) return [];

        const docXmlText = await docFile.async('string');
        const stylesFile = zip.file('word/styles.xml');
        const stylesXmlText = stylesFile ? await stylesFile.async('string') : null;
        const stylesMap = parseStylesMap(stylesXmlText, parser);

        const xmlDoc = parser.parseFromString(docXmlText, 'application/xml');
        const root = xmlDoc?.documentElement;
        if (!root) return [];

        const body = findDirectChild(root, 'body') || findDescendantsNamed(root, 'body')[0];
        if (!body) return [];

        const pElements = collectParagraphElements(body);
        const hints: ParagraphXmlHint[] = [];

        for (let index = 0; index < pElements.length; index++) {
            const p = pElements[index];
            const pPr = findDirectChild(p, 'pPr');
            const pDefaultRPr = pPr ? findDirectChild(pPr, 'rPr') : null;
            const pDefaultScale = parseCharScaleFromRPr(pDefaultRPr);
            const pDefaultSpacing = parseLetterSpacingPtFromRPr(pDefaultRPr);

            // 样式与制表位检查
            const pStyleEl = pPr ? findDirectChild(pPr, 'pStyle') : null;
            const pStyleVal = pStyleEl ? getAttr(pStyleEl, 'val') || '' : '';
            const mappedStyle = pStyleVal ? stylesMap.get(pStyleVal) : undefined;
            const styleNameCombined = `${pStyleVal} ${mappedStyle?.name || ''}`;
            let isTocStyle = /(?:toc|目录)/i.test(styleNameCombined);

            let hasRightLeaderTab = Boolean(mappedStyle?.hasRightLeaderTab);
            const tabsEl = pPr ? findDirectChild(pPr, 'tabs') : null;
            if (tabsEl) {
                const tabs = findDirectChildren(tabsEl, 'tab');
                for (const tab of tabs) {
                    const val = (getAttr(tab, 'val') || '').toLowerCase();
                    const leader = (getAttr(tab, 'leader') || '').toLowerCase();
                    if (val === 'right' && LEADER_TAB_VALUES.has(leader)) {
                        hasRightLeaderTab = true;
                        break;
                    }
                }
            }

            const { runs, fieldInstructions } = collectRunsAndFieldsInParagraph(p);
            if (!isTocStyle && fieldInstructions.some(instr => /\b(?:TOC|PAGEREF)\b/i.test(instr))) {
                isTocStyle = true;
            }

            let plainText = '';
            const runCharScales: Array<number | null> = [];
            const runLetterSpacingsPt: Array<number | null> = [];
            const runHints: ParagraphRunHint[] = [];

            for (const run of runs) {
                const runText = extractTextFromRun(run);
                const rPr = findDirectChild(run, 'rPr');
                const scaleX = parseCharScaleFromRPr(rPr) ?? pDefaultScale;
                const spacingPt = parseLetterSpacingPtFromRPr(rPr) ?? pDefaultSpacing;

                if (runText.length > 0) {
                    plainText += runText;
                    runCharScales.push(scaleX);
                    runLetterSpacingsPt.push(spacingPt);
                    runHints.push({
                        text: runText,
                        charScaleX: scaleX,
                        letterSpacingPt: spacingPt,
                    });
                }
            }

            const validScales = runCharScales.filter((v): v is number => v !== null);
            if (validScales.length === 0 && pDefaultScale !== null) {
                validScales.push(pDefaultScale);
            }
            const maxCharScaleX = validScales.length > 0 ? Math.max(...validScales) : null;
            const minCharScaleX = validScales.length > 0 ? Math.min(...validScales) : null;

            const ruleInfo = detectRedHorizontalRuleInParagraph(p);

            hints.push({
                index,
                plainText,
                maxCharScaleX,
                minCharScaleX,
                runCharScales,
                runLetterSpacingsPt,
                runs: runHints,
                hasRedHorizontalRule: ruleInfo.hasRedHorizontalRule,
                redRuleColor: ruleInfo.redRuleColor,
                redRuleWidthPt: ruleInfo.redRuleWidthPt,
                isTocStyle,
                hasRightLeaderTab,
            });
        }

        return hints;
    } catch {
        return [];
    }
}

function normalizeForMatch(text: string): string {
    return text.replace(/[\s\u00a0\u3000\t\r\n]+/g, '');
}

function matchParagraphHints(
    paragraphs: HTMLParagraphElement[],
    hints: ParagraphXmlHint[]
): Array<ParagraphXmlHint | null> {
    if (!hints || hints.length === 0) {
        return paragraphs.map(() => null);
    }

    const hintNorms = hints.map(h => normalizeForMatch(h.plainText));
    const matched: Array<ParagraphXmlHint | null> = [];
    let cursor = 0;

    for (const p of paragraphs) {
        const domNorm = normalizeForMatch(p.textContent || '');
        let foundIdx = -1;

        if (cursor < hints.length && hintNorms[cursor] === domNorm) {
            foundIdx = cursor;
        } else {
            const lookaheadLimit = Math.min(hints.length, cursor + 10);
            for (let k = cursor; k < lookaheadLimit; k++) {
                if (hintNorms[k] === domNorm && (domNorm.length > 0 || hints[k].hasRedHorizontalRule)) {
                    foundIdx = k;
                    break;
                }
            }

            if (foundIdx === -1 && domNorm.length >= 4) {
                for (let k = cursor; k < lookaheadLimit; k++) {
                    const hn = hintNorms[k];
                    if (hn.length >= 4 && (domNorm.endsWith(hn) || hn.endsWith(domNorm))) {
                        foundIdx = k;
                        break;
                    }
                }
            }
        }

        if (foundIdx !== -1) {
            matched.push(hints[foundIdx]);
            cursor = foundIdx + 1;
        } else {
            matched.push(null);
        }
    }

    return matched;
}

function getComputedStyleSafe(el: Element): CSSStyleDeclaration | null {
    const win = el.ownerDocument?.defaultView;
    if (!win || typeof win.getComputedStyle !== 'function') return null;
    try {
        return win.getComputedStyle(el);
    } catch {
        return null;
    }
}

function resolveFontSizePx(el: Element): number {
    const inlineSize = (el as HTMLElement).style?.fontSize;
    const raw = inlineSize || getComputedStyleSafe(el)?.fontSize || '';
    const num = parseFloat(raw);
    if (!Number.isFinite(num) || num <= 0) return 0;
    if (raw.toLowerCase().endsWith('pt')) return num * (96 / 72);
    return num;
}

function resolveLineHeightPx(p: HTMLParagraphElement, fontSizePx: number): number {
    const cs = getComputedStyleSafe(p);
    const raw = p.style?.lineHeight || cs?.lineHeight || '';
    if (raw && raw !== 'normal') {
        const num = parseFloat(raw);
        if (Number.isFinite(num) && num > 0) {
            if (raw.toLowerCase().endsWith('pt')) return num * (96 / 72);
            if (raw.toLowerCase().endsWith('px')) return num;
            if (/^[\d.]+$/.test(raw.trim())) return num * (fontSizePx || 16);
        }
    }
    return (fontSizePx || 16) * 1.25;
}

function isTabStopElement(node: Node): boolean {
    if (node.nodeType !== 1) return false;
    const el = node as HTMLElement;
    if (el.tagName.toLowerCase() !== 'span') return false;
    return el.classList.contains('docx-tab-stop') || /(?:^|\s)[^\s]+-tab-stop(?:\s|$)/.test(el.className);
}

function applyRunLetterSpacing(p: HTMLParagraphElement, hint: ParagraphXmlHint): void {
    const nonZeroSpacings = hint.runLetterSpacingsPt.filter((v): v is number => v !== null && Math.abs(v) > 0.001);
    if (nonZeroSpacings.length === 0) return;

    const spans = Array.from(p.querySelectorAll('span')).filter(
        s => !isTabStopElement(s) && !s.classList.contains('docx-redhead-scale') && (s.textContent || '').length > 0
    );

    if (spans.length > 0 && hint.runs && hint.runs.length > 0) {
        let runCursor = 0;
        for (const span of spans) {
            const spanText = span.textContent || '';
            let matchedPt: number | null = null;
            for (let k = runCursor; k < hint.runs.length; k++) {
                const r = hint.runs[k];
                if (r.text === spanText || spanText.includes(r.text) || r.text.includes(spanText)) {
                    matchedPt = r.letterSpacingPt;
                    runCursor = k + 1;
                    break;
                }
            }
            if (matchedPt !== null && Math.abs(matchedPt) > 0.001) {
                span.style.letterSpacing = `${matchedPt}pt`;
            }
        }
        return;
    }

    // 回退：如果 span 无法一一对齐且段落只有一种非零字间距，直接应用到段落
    const firstNonZero = nonZeroSpacings[0];
    if (nonZeroSpacings.every(v => Math.abs(v - firstNonZero) < 0.01)) {
        p.style.letterSpacing = `${firstNonZero}pt`;
    }
}

function applyRedheadHorizontalScale(
    p: HTMLParagraphElement,
    scaleX: number,
    doc: Document
): HTMLSpanElement {
    const cs = getComputedStyleSafe(p);
    const align = (p.style.textAlign || cs?.textAlign || '').toLowerCase();
    const isCenter = align === 'center';
    const isRight = align === 'right';
    const origin = isCenter ? 'center baseline' : isRight ? 'right baseline' : 'left baseline';

    const wrapper = doc.createElement('span');
    wrapper.className = 'docx-redhead-scale';
    wrapper.style.display = 'inline-block';
    wrapper.style.flexShrink = '0';
    wrapper.style.setProperty('white-space', 'nowrap', 'important');
    wrapper.style.transform = `scaleX(${scaleX})`;
    wrapper.style.transformOrigin = origin;

    while (p.firstChild) {
        wrapper.appendChild(p.firstChild);
    }
    const innerSpans = wrapper.querySelectorAll('span');
    for (let i = 0; i < innerSpans.length; i++) {
        (innerSpans[i] as HTMLElement).style.setProperty('white-space', 'nowrap', 'important');
    }
    p.appendChild(wrapper);

    p.style.overflow = 'visible';
    if (scaleX < 1) {
        p.style.display = 'flex';
        p.style.justifyContent = isCenter ? 'center' : isRight ? 'flex-end' : 'flex-start';
    }
    return wrapper;
}

function checkParagraphRedColor(p: HTMLParagraphElement): boolean {
    const direct = parseColorInfo(p.style.color || getComputedStyleSafe(p)?.color, 85);
    if (direct.isRed) return true;
    const spans = p.querySelectorAll('span');
    for (let i = 0; i < spans.length; i++) {
        const s = spans[i] as HTMLElement;
        if (!(s.textContent || '').trim()) continue;
        const info = parseColorInfo(s.style.color || getComputedStyleSafe(s)?.color, 85);
        if (info.isRed) return true;
    }
    return false;
}

function checkParagraphFontSizePx(p: HTMLParagraphElement): number {
    let maxSize = resolveFontSizePx(p);
    const spans = p.querySelectorAll('span');
    for (let i = 0; i < spans.length; i++) {
        const s = spans[i];
        if (!(s.textContent || '').trim()) continue;
        const size = resolveFontSizePx(s);
        if (size > maxSize) maxSize = size;
    }
    return maxSize;
}

function hasVisibleRuleElement(p: HTMLParagraphElement): boolean {
    const imgs = p.querySelectorAll('img');
    if (imgs.length > 0) return true;
    const svgs = p.querySelectorAll('svg');
    for (let i = 0; i < svgs.length; i++) {
        if (svgs[i].querySelector('line, path, rect, polyline, polygon')) {
            return true;
        }
    }
    return false;
}

function hasBottomBorder(p: HTMLParagraphElement): boolean {
    const inlineW = parseFloat(p.style.borderBottomWidth || '0');
    if (inlineW > 0 && p.style.borderBottomStyle !== 'none') return true;
    const cs = getComputedStyleSafe(p);
    if (cs) {
        const cw = parseFloat(cs.borderBottomWidth || '0');
        if (cw > 0 && cs.borderBottomStyle !== 'none') return true;
    }
    return false;
}

const TOC_TITLE_PATTERN =
    /^(第[一二三四五六七八九十百零\d]+[章节篇部分条]|[一二三四五六七八九十]+、|[（(][一二三四五六七八九十\d]+[)）]|\d+(?:\.\d+)*[\s、.]|附件|附表)/;
const TOC_PAGE_PATTERN = /^(?:\d{1,4}|[IVXLCDM]{1,8}|[ivxlcdm]{1,8}|第\s*\d{1,4}\s*页)$/;

function isLeaderTabStopStyled(tab: HTMLElement): boolean {
    const rawStyleAttr = (tab.getAttribute('style') || '').toLowerCase();
    const td = (tab.style.textDecoration || '').toLowerCase();
    const tdLine = (tab.style.textDecorationLine || '').toLowerCase();
    const tdStyle = (tab.style.textDecorationStyle || '').toLowerCase();
    const ws = parseFloat(tab.style.wordSpacing || '0');

    return (
        tdStyle === 'dotted' ||
        td.includes('dotted') ||
        td.includes('underline') ||
        tdLine.includes('underline') ||
        rawStyleAttr.includes('dotted') ||
        rawStyleAttr.includes('underline') ||
        (Number.isFinite(ws) && ws > 0)
    );
}

function collectTextNodes(root: Node): Text[] {
    const nodes: Text[] = [];
    const stack: Node[] = [root];
    while (stack.length > 0) {
        const cur = stack.pop()!;
        if (cur.nodeType === 3) {
            nodes.push(cur as Text);
            continue;
        }
        for (let i = cur.childNodes.length - 1; i >= 0; i--) {
            stack.push(cur.childNodes[i]);
        }
    }
    return nodes;
}

function tryUpgradeTocParagraph(
    p: HTMLParagraphElement,
    hint: ParagraphXmlHint | null,
    doc: Document
): void {
    const cleanWholeText = (p.textContent || '').replace(/[\s\u00a0\u3000]+/g, '');
    if (!cleanWholeText || cleanWholeText === '目录' || cleanWholeText === '目次') {
        return;
    }

    let tabStops = Array.from(p.querySelectorAll('span')).filter(isTabStopElement);
    let syntheticTabSpan: HTMLSpanElement | null = null;

    if (tabStops.length === 0) {
        const textNodes = collectTextNodes(p);
        for (let i = textNodes.length - 1; i >= 0; i--) {
            const tn = textNodes[i];
            const val = tn.nodeValue || '';
            const tabIdx = val.lastIndexOf('\t');
            const parent = tn.parentNode;
            if (tabIdx !== -1 && parent) {
                const tabNode = tn.splitText(tabIdx);
                if ((tabNode.nodeValue || '').length > 1) {
                    tabNode.splitText(1);
                }
                const span = doc.createElement('span');
                span.className = 'docx-tab-stop';
                parent.replaceChild(span, tabNode);
                syntheticTabSpan = span;
                tabStops = [span];
                break;
            }
        }
        if (tabStops.length === 0) {
            return;
        }
    }

    const rollbackSyntheticTab = () => {
        if (syntheticTabSpan && syntheticTabSpan.parentNode) {
            syntheticTabSpan.parentNode.replaceChild(doc.createTextNode('\t'), syntheticTabSpan);
            p.normalize();
        }
    };

    const lastTab = tabStops[tabStops.length - 1];
    const anchor = lastTab.closest('a');
    let rowContainer: HTMLElement = p;
    if (anchor && p.contains(anchor)) {
        const anchorTextLen = normalizeForMatch(anchor.textContent || '').length;
        const pTextLen = normalizeForMatch(p.textContent || '').length;
        if (anchorTextLen > 0 && anchorTextLen === pTextLen) {
            rowContainer = anchor;
        }
    }

    // 找到 lastTab 在 rowContainer 下的直接子节点（兼容 docx-preview 将 tab 包在 run <span> 内）
    let splitChild: Node = lastTab;
    while (splitChild.parentNode && splitChild.parentNode !== rowContainer) {
        splitChild = splitChild.parentNode;
    }
    if (splitChild.parentNode !== rowContainer) {
        rollbackSyntheticTab();
        return;
    }

    const children = Array.from(rowContainer.childNodes);
    const splitIndex = children.indexOf(splitChild as ChildNode);
    if (splitIndex === -1) {
        rollbackSyntheticTab();
        return;
    }

    const beforeTopNodes: Node[] = children.slice(0, splitIndex);
    const afterTopNodes: Node[] = children.slice(splitIndex + 1);

    let innerBefore: Node[] = [];
    let innerAfter: Node[] = [];
    let splitEl: HTMLElement | null = null;

    if (splitChild !== lastTab && splitChild.nodeType === 1) {
        splitEl = splitChild as HTMLElement;
        let seenLastTab = false;
        const innerChildren = Array.from(splitEl.childNodes);
        for (const ic of innerChildren) {
            if (ic === lastTab) {
                seenLastTab = true;
            } else if (!seenLastTab) {
                innerBefore.push(ic);
            } else {
                innerAfter.push(ic);
            }
        }
    }

    const titleText = [...beforeTopNodes, ...innerBefore]
        .map(n => n.textContent || '')
        .join('')
        .replace(/[\u00a0\t]+/g, ' ')
        .trim();
    const pageText = [...innerAfter, ...afterTopNodes]
        .map(n => n.textContent || '')
        .join('')
        .replace(/[\u00a0\t]+/g, ' ')
        .trim();

    if (!titleText || !pageText || pageText.length > 8 || !TOC_PAGE_PATTERN.test(pageText)) {
        rollbackSyntheticTab();
        return;
    }

    const isTocClassOrHint =
        /(^|\s|_|-)toc\d*(\s|$)/i.test(p.className) || Boolean(hint?.isTocStyle);
    const isLeaderOrTitleMatch =
        Boolean(hint?.hasRightLeaderTab) ||
        isLeaderTabStopStyled(lastTab) ||
        TOC_TITLE_PATTERN.test(titleText);

    if (!isTocClassOrHint && !isLeaderOrTitleMatch) {
        rollbackSyntheticTab();
        return;
    }

    const beforeNodes: Node[] = [...beforeTopNodes];
    const afterNodes: Node[] = [...afterTopNodes];
    let hostSpanToRemove: ChildNode | null = null;

    if (splitEl) {
        if (innerBefore.length > 0) {
            const cloneBefore = splitEl.cloneNode(false);
            for (const n of innerBefore) cloneBefore.appendChild(n);
            beforeNodes.push(cloneBefore);
        }
        if (innerAfter.length > 0) {
            const cloneAfter = splitEl.cloneNode(false);
            for (const n of innerAfter) cloneAfter.appendChild(n);
            afterNodes.unshift(cloneAfter);
        }
        hostSpanToRemove = splitEl;
    }

    // 构造三段式弹性布局
    const titleSpan = doc.createElement('span');
    titleSpan.className = 'docx-toc-title';
    titleSpan.style.minWidth = '0';
    titleSpan.style.textIndent = '0';

    for (const node of beforeNodes) {
        if (node.nodeType === 1) {
            const innerTabs = [
                ...(isTabStopElement(node) ? [node as HTMLElement] : []),
                ...Array.from((node as Element).querySelectorAll('span')).filter(isTabStopElement),
            ];
            for (const innerTab of innerTabs) {
                innerTab.style.setProperty('word-spacing', '0', 'important');
                innerTab.style.setProperty('text-decoration', 'none', 'important');
                innerTab.style.display = 'inline-block';
                innerTab.style.width = '0.5em';
                innerTab.textContent = '';
            }
        }
        titleSpan.appendChild(node);
    }

    lastTab.className = 'docx-toc-leader';
    lastTab.setAttribute('aria-hidden', 'true');
    lastTab.textContent = '';
    lastTab.style.setProperty('word-spacing', '0', 'important');
    lastTab.style.setProperty('text-decoration', 'none', 'important');
    lastTab.style.textDecorationStyle = '';
    lastTab.style.flex = '1 1 24px';
    lastTab.style.minWidth = '16px';
    lastTab.style.borderBottom = '1.5px dotted currentColor';
    lastTab.style.opacity = '0.55';
    lastTab.style.margin = '0 6px';
    lastTab.style.transform = 'translateY(-0.26em)';

    const pageSpan = doc.createElement('span');
    pageSpan.className = 'docx-toc-page';
    pageSpan.style.flexShrink = '0';
    pageSpan.style.whiteSpace = 'nowrap';
    pageSpan.style.fontVariantNumeric = 'tabular-nums';
    pageSpan.style.textIndent = '0';

    for (const node of afterNodes) {
        pageSpan.appendChild(node);
    }

    if (hostSpanToRemove && hostSpanToRemove.parentNode === rowContainer) {
        rowContainer.removeChild(hostSpanToRemove);
    }

    rowContainer.appendChild(titleSpan);
    rowContainer.appendChild(lastTab);
    rowContainer.appendChild(pageSpan);

    rowContainer.classList.add('docx-toc-row');
    rowContainer.style.setProperty('display', 'flex', 'important');
    rowContainer.style.alignItems = 'baseline';
    rowContainer.style.setProperty('text-indent', '0', 'important');

    if (rowContainer.tagName.toLowerCase() === 'a') {
        rowContainer.style.width = '100%';
        rowContainer.style.textDecoration = 'none';
        rowContainer.style.color = 'inherit';
        p.style.setProperty('text-indent', '0', 'important');
    }
}

const DANGEROUS_DOCX_ELEMENTS =
    'script, iframe, frame, frameset, object, embed, applet, form, input, button, textarea, select, meta, base, link';
const URL_ATTR_NAMES = new Set(['href', 'src', 'xlink:href']);
const SAFE_URI_PATTERN = /^(?:#|https?:|mailto:|blob:|data:image\/)/i;

function sanitizeInlineStyleValue(styleValue: string): string {
    const declarations = styleValue.split(';');
    const safeDeclarations: string[] = [];

    for (const decl of declarations) {
        const trimmed = decl.trim();
        if (!trimmed) continue;
        const normalized = trimmed.replace(/[\u0000-\u001f\u007f\s]+/g, '').toLowerCase();
        if (
            normalized.includes('expression(') ||
            normalized.includes('javascript:') ||
            normalized.includes('vbscript:') ||
            /position\s*:\s*fixed/i.test(trimmed)
        ) {
            continue;
        }
        safeDeclarations.push(trimmed);
    }

    return safeDeclarations.join('; ');
}

/**
 * 净化 docx-preview 渲染后的容器 DOM，移除恶意脚本、事件处理器、危险协议链接及钓鱼遮罩样式
 */
export function sanitizeRenderedDocxContainer(container: HTMLElement): void {
    if (!container) return;

    const dangerousElements = container.querySelectorAll(DANGEROUS_DOCX_ELEMENTS);
    for (let i = 0; i < dangerousElements.length; i++) {
        dangerousElements[i].remove();
    }

    const allElements = container.querySelectorAll('*');
    for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        const attrs = Array.from(el.attributes);

        for (const attr of attrs) {
            const attrNameLower = attr.name.toLowerCase();

            if (attrNameLower.startsWith('on')) {
                el.removeAttribute(attr.name);
                continue;
            }

            if (URL_ATTR_NAMES.has(attrNameLower)) {
                const normalizedUrl = attr.value.replace(/[\u0000-\u001f\u007f\s]+/g, '').toLowerCase();
                if (
                    normalizedUrl.startsWith('javascript:') ||
                    normalizedUrl.startsWith('vbscript:') ||
                    normalizedUrl.startsWith('data:text/html') ||
                    (normalizedUrl.includes(':') && !SAFE_URI_PATTERN.test(normalizedUrl))
                ) {
                    el.removeAttribute(attr.name);
                }
                continue;
            }

            if (attrNameLower === 'style') {
                const safeStyle = sanitizeInlineStyleValue(attr.value);
                if (!safeStyle) {
                    el.removeAttribute('style');
                } else if (safeStyle !== attr.value) {
                    el.setAttribute('style', safeStyle);
                }
            }
        }
    }
}

export function enhanceRenderedDocxDom(
    container: HTMLElement,
    hints: ParagraphXmlHint[] = []
): void {
    if (!container) return;
    const doc = container.ownerDocument;
    if (!doc) return;

    sanitizeRenderedDocxContainer(container);

    const sections = Array.from(container.querySelectorAll('section.docx'));
    const roots = sections.length > 0 ? sections : [container];

    const allBodyParagraphs: HTMLParagraphElement[] = [];
    const sectionParagraphGroups: HTMLParagraphElement[][] = [];

    for (const root of roots) {
        const paras = Array.from(root.querySelectorAll('p')).filter(
            p => !p.closest('table') && !p.closest('header') && !p.closest('footer')
        ) as HTMLParagraphElement[];
        sectionParagraphGroups.push(paras);
        allBodyParagraphs.push(...paras);
    }

    const matchedHints = matchParagraphHints(allBodyParagraphs, hints);
    const hintMap = new Map<HTMLParagraphElement, ParagraphXmlHint | null>();
    allBodyParagraphs.forEach((p, i) => {
        hintMap.set(p, matchedHints[i] ?? null);
    });

    for (const sectionParas of sectionParagraphGroups) {
        let nonTableIndex = 0;

        for (const p of sectionParas) {
            if (p.dataset.docxEnhanced === '1') {
                nonTableIndex += 1;
                continue;
            }
            p.dataset.docxEnhanced = '1';

            const hint = hintMap.get(p) ?? null;

            // 1. 字符级字间距还原
            if (hint) {
                applyRunLetterSpacing(p, hint);
            }

            // 2. 显式 <w:w> 横向压窄字还原
            const compactText = (p.textContent || '').replace(/[\s\u00a0\u3000]+/g, '');
            const hasLineBreak = p.querySelector('br') !== null;
            const explicitScale =
                hint?.minCharScaleX !== null && hint?.minCharScaleX !== undefined && hint.minCharScaleX < 0.99
                    ? hint.minCharScaleX
                    : hint?.maxCharScaleX !== null && hint?.maxCharScaleX !== undefined && hint.maxCharScaleX > 1.01
                      ? hint.maxCharScaleX
                      : null;

            if (explicitScale !== null && compactText.length > 0 && compactText.length <= 60 && !hasLineBreak) {
                applyRedheadHorizontalScale(p, explicitScale, doc);
            } else if (nonTableIndex < 6 && !hasLineBreak) {
                // 3. 智能公文红头溢出自适应兜底
                const cs = getComputedStyleSafe(p);
                const align = (p.style.textAlign || cs?.textAlign || '').toLowerCase();
                const textTrimmed = (p.textContent || '').replace(/\u00a0/g, ' ').trim();
                const fontSizePx = checkParagraphFontSizePx(p);
                const isRed = checkParagraphRedColor(p);

                if (
                    align === 'center' &&
                    isRed &&
                    fontSizePx >= 29 &&
                    textTrimmed.length >= 4 &&
                    textTrimmed.length <= 32 &&
                    !textTrimmed.includes('。')
                ) {
                    const lineHeightPx = resolveLineHeightPx(p, fontSizePx);
                    if (p.clientHeight > lineHeightPx * 1.45) {
                        const origOverflow = p.style.overflow;
                        const origDisplay = p.style.display;
                        const origJustify = p.style.justifyContent;
                        const origSpanWhiteSpaces = Array.from(p.querySelectorAll('span')).map(s => ({
                            el: s as HTMLElement,
                            ws: (s as HTMLElement).style.getPropertyValue('white-space'),
                            prio: (s as HTMLElement).style.getPropertyPriority('white-space'),
                        }));

                        const wrapper = applyRedheadHorizontalScale(p, 1, doc);
                        const availW = p.clientWidth;
                        const naturalW = wrapper.scrollWidth;
                        const ratio = availW > 0 && naturalW > availW ? availW / naturalW : 1;

                        if (ratio < 1 && ratio >= 0.58) {
                            p.style.display = 'flex';
                            p.style.justifyContent = 'center';
                            wrapper.style.transform = `scaleX(${ratio.toFixed(3)})`;
                            wrapper.style.transformOrigin = 'center baseline';
                        } else {
                            // 撤回包装，恢复原结构
                            while (wrapper.firstChild) {
                                p.insertBefore(wrapper.firstChild, wrapper);
                            }
                            p.removeChild(wrapper);
                            for (const item of origSpanWhiteSpaces) {
                                if (item.ws) {
                                    item.el.style.setProperty('white-space', item.ws, item.prio);
                                } else {
                                    item.el.style.removeProperty('white-space');
                                }
                            }
                            p.style.overflow = origOverflow;
                            p.style.display = origDisplay;
                            p.style.justifyContent = origJustify;
                        }
                    }
                }
            }

            // 4. 公文版头矢量红横线兜底
            if (hint?.hasRedHorizontalRule && !hasBottomBorder(p) && !hasVisibleRuleElement(p)) {
                const widthPt = hint.redRuleWidthPt && hint.redRuleWidthPt > 0 ? hint.redRuleWidthPt : 2.25;
                const color = hint.redRuleColor || '#D40000';
                p.style.borderBottom = `${widthPt}pt solid ${color}`;
                if (!p.style.paddingBottom) {
                    p.style.paddingBottom = '4pt';
                }
            }

            // 5. 目录（TOC）弹性三段式防断行升级
            tryUpgradeTocParagraph(p, hint, doc);

            nonTableIndex += 1;
        }
    }
}
