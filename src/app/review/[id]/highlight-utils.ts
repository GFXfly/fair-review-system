// src/app/review/[id]/highlight-utils.ts

import { DocParagraph } from './doc-utils';

export const findMatchingParagraphIds = (paragraphs: DocParagraph[], snippet: string): string[] => {
    if (!snippet || !paragraphs || paragraphs.length === 0) return [];

    const normalize = (str: string) =>
        str.replace(/[\s\u3000,.，。、；;：:!！?？"""'''()[\]【】\-_]/g, '').toLowerCase();

    let parts = [snippet];
    if (snippet.includes('...') || snippet.includes('…') || snippet.includes('\n')) {
        parts = snippet.split(/[….\n]+/).filter(s => normalize(s).length > 3);
    }

    const significantParts = parts.filter(p => normalize(p).length > 3);

    if (significantParts.length === 0) {
        const normSnippet = normalize(snippet);
        if (normSnippet.length > 2) {
            significantParts.push(snippet);
        } else {
            return [];
        }
    }

    const matchedIds = new Set<string>();

    for (const para of paragraphs) {
        let paraText = para.text || '';
        if (para.type === 'smart_table' && para.rows) {
            paraText = para.rows.map((r: string[]) => r.join('')).join('');
        }

        const normPara = normalize(paraText);

        for (const part of significantParts) {
            const normPart = normalize(part);
            if (normPara.includes(normPart)) {
                matchedIds.add(para.id);
            }
        }
    }

    return Array.from(matchedIds);
};

const highlightByNormalizedMatch = (container: HTMLElement, originalText: string, normalizedSearch: string): void => {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode as Text);
    }

    let normalizedFullText = '';
    const charMap: Array<{ node: Text; offset: number }> = [];

    textNodes.forEach(node => {
        const text = node.textContent || '';
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const isPreserved =
                !/[\s\u3000]/.test(char) &&
                !/[,，.。、;；:：!！?？""''「」『』（）()[\]【】《》<>]/.test(char);
            if (isPreserved) {
                charMap.push({ node, offset: i });
                normalizedFullText += char.toLowerCase();
            }
        }
    });

    const matchIndex = normalizedFullText.indexOf(normalizedSearch.toLowerCase());
    if (matchIndex === -1) return;

    const startEntry = charMap[matchIndex];
    const endEntry = charMap[matchIndex + normalizedSearch.length - 1];
    if (!startEntry || !endEntry) return;

    const startIndex = textNodes.indexOf(startEntry.node);
    const endIndex = textNodes.indexOf(endEntry.node);
    if (startIndex === -1 || endIndex === -1) return;

    for (let i = startIndex; i <= endIndex; i++) {
        const node = textNodes[i];
        const parent = node.parentNode;
        if (!parent) continue;

        const mark = document.createElement('mark');
        mark.className = 'risk-highlight';
        mark.style.backgroundColor = 'rgba(252, 165, 165, 0.7)';
        mark.style.padding = '3px 0';
        mark.style.borderRadius = '2px';
        mark.style.fontWeight = '500';

        parent.replaceChild(mark, node);
        mark.appendChild(node);
    }
};

export const highlightTextInNode = (container: HTMLElement, searchText: string): boolean => {
    if (!searchText || searchText.length < 5) return false;

    const normalize = (text: string) =>
        text
            .replace(/[\s\u3000]/g, '')
            .replace(/[,，.。、;；:：!！?？""''「」『』（）()[\]【】《》<>«»]/g, '')
            .toLowerCase();

    const fullText = container.textContent || '';
    const normalizedFull = normalize(fullText);
    const normalizedSearch = normalize(searchText);

    if (normalizedFull.indexOf(normalizedSearch) !== -1) {
        highlightByNormalizedMatch(container, searchText, normalizedSearch);
        return true;
    }

    const segments = searchText
        .split(/[,，.。、；;：:!！?？\n\r|｜]/)
        .map(s => s.trim())
        .filter(s => s.length >= 6);

    for (const segment of segments) {
        const normalizedSegment = normalize(segment);
        if (normalizedSegment.length >= 6 && normalizedFull.indexOf(normalizedSegment) !== -1) {
            highlightByNormalizedMatch(container, segment, normalizedSegment);
            return true;
        }
    }

    for (let len = Math.min(searchText.length, 120); len >= 15; len -= 5) {
        const prefix = searchText.substring(0, len);
        const normalizedPrefix = normalize(prefix);
        if (normalizedPrefix.length >= 10 && normalizedFull.indexOf(normalizedPrefix) !== -1) {
            highlightByNormalizedMatch(container, prefix, normalizedPrefix);
            return true;
        }
    }

    return false;
};

export const clearHighlights = (): void => {
    document.querySelectorAll('mark.risk-highlight').forEach(mark => {
        const parent = mark.parentNode;
        if (parent) {
            while (mark.firstChild) {
                parent.insertBefore(mark.firstChild, mark);
            }
            parent.removeChild(mark);
            parent.normalize();
        }
    });
};
