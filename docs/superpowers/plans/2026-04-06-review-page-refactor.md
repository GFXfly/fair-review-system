# Review Page Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `src/app/review/[id]/page.tsx`（1286行）拆分为3个工具文件，使主文件缩减至约550行，功能完全不变。

**Architecture:** 纯逻辑提取，不引入新的组件层级。将文档解析、文本高亮、Word导出三块独立逻辑移到同目录的工具文件中，`page.tsx` 只保留状态管理、数据加载、JSX渲染。

**Tech Stack:** TypeScript, Next.js App Router, docx 库（已有）

---

## 文件结构

```
src/app/review/[id]/
├── page.tsx              修改：删除提取的函数，改为 import
├── page.module.css       不动
├── doc-utils.ts          新建：文档解析工具函数
├── highlight-utils.ts    新建：文本高亮引擎
└── export-utils.ts       新建：Word 导出逻辑
```

---

## Task 1: 提取文档解析工具 (`doc-utils.ts`)

**Files:**
- Create: `src/app/review/[id]/doc-utils.ts`
- Modify: `src/app/review/[id]/page.tsx`（删除对应函数，添加 import）

- [ ] **Step 1: 创建 `doc-utils.ts`，包含3个函数**

```typescript
// src/app/review/[id]/doc-utils.ts

import React from 'react';

export const formatParagraphText = (text: string): React.ReactNode => {
    const regex = /^((?:第[0-9零一二三四五六七八九十百千万]+条)|(?:[0-9]+\.)|(?:（[0-9零一二三四五六七八九十]+）)|(?:[一二三四五六七八九十]+、))/;
    const match = text.match(regex);

    if (match) {
        const titlePart = match[1];
        const restPart = text.substring(titlePart.length);
        return (
            <>
                <strong style={{ fontWeight: 600 }}>{titlePart}</strong>{restPart}
            </>
        );
    }
    return text;
};

export const getCategoryLabel = (category: string): string => {
    const categoryMap: Record<string, string> = {
        'BIDDING': '招标文件',
        'SUBSIDY': '补贴政策',
        'MARKET_ACCESS': '市场准入文件',
        'INDUSTRIAL': '产业扶持政策',
        'SPECIAL_FUND': '专项资金文件',
        'IGNORE': '非政策文件',
        'POLICY': '政策文件',
    };
    return categoryMap[category] || '政策文件';
};

export interface DocParagraph {
    id: string;
    type: 'title' | 'text' | 'html' | 'table' | 'smart_table';
    text?: string;
    html?: string;
    rows?: string[][];
    maxCols?: number;
}

export const parseDocContent = (text: string): DocParagraph[] => {
    if (!text) return [];
    const lines = text.split('\n');
    const newContent: DocParagraph[] = [];
    let pCounter = 0;

    let currentTableBuffer: string[] = [];
    let inTable = false;

    const flushTable = () => {
        if (currentTableBuffer.length === 0) return;

        let maxCols = 0;
        let rowsRaw = currentTableBuffer.filter(rowStr => rowStr.replace(/[|\s]/g, '').length > 0);
        const finalRows: string[][] = [];

        rowsRaw.forEach(rowStr => {
            const content = rowStr.trim().replace(/^\||\|$/g, '');
            if (rowStr.includes('|')) {
                const cells = content.split('|').map(c => c.trim());
                if (cells.length > maxCols) maxCols = cells.length;
                finalRows.push(cells);
            } else {
                if (finalRows.length > 0) {
                    const lastRow = finalRows[finalRows.length - 1];
                    if (lastRow.length < maxCols) {
                        lastRow.push(rowStr.trim());
                    } else {
                        lastRow[lastRow.length - 1] += rowStr.trim();
                    }
                } else {
                    finalRows.push([rowStr.trim()]);
                }
            }
        });

        if (finalRows.length > 0) {
            newContent.push({
                id: `p_${pCounter++}`,
                type: 'smart_table',
                rows: finalRows,
                maxCols: maxCols || 1,
            });
        }
        currentTableBuffer = [];
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trimEnd();
        const trimmedLine = line.trim();
        const hasPipe = trimmedLine.includes('|');

        if (hasPipe) {
            if (!inTable) inTable = true;
            currentTableBuffer.push(trimmedLine);
        } else if (inTable) {
            if (trimmedLine.length === 0) {
                flushTable();
                inTable = false;
            } else if (trimmedLine.length > 30) {
                flushTable();
                inTable = false;
                newContent.push({ id: `p_${pCounter++}`, type: 'text', text: line });
            } else {
                currentTableBuffer.push(trimmedLine);
            }
        } else {
            if (trimmedLine.length > 0) {
                newContent.push({
                    id: `p_${pCounter++}`,
                    type: (i === 0 && pCounter === 1) ? 'title' : 'text',
                    text: line,
                });
            }
        }
    }
    if (inTable) flushTable();

    return newContent;
};
```

- [ ] **Step 2: 在 `page.tsx` 顶部添加 import，删除原函数**

在 `page.tsx` 第10行（`import RiskFeedback` 后面）添加：
```typescript
import { formatParagraphText, getCategoryLabel, parseDocContent, type DocParagraph } from './doc-utils';
```

删除 `page.tsx` 中以下内容（行55-84、行186-316）：
- `const formatParagraphText = ...`（整个函数）
- `const getCategoryLabel = ...`（整个函数）
- `const parseDocContent = ...`（整个函数）

同时将页面中所有 `any[]` 类型的 docContent 声明改为 `DocParagraph[]`：
```typescript
const [docContent, setDocContent] = useState<DocParagraph[]>([]);
```

- [ ] **Step 3: 验证编译无报错**

```bash
cd "/Users/gaofeixiang/Desktop/完成项目/公平竞争审查系统"
npx tsc --noEmit 2>&1 | head -30
```

期望输出：无错误（或仅有已存在的无关警告）

- [ ] **Step 4: Commit**

```bash
cd "/Users/gaofeixiang/Desktop/完成项目/公平竞争审查系统"
git add src/app/review/\[id\]/doc-utils.ts src/app/review/\[id\]/page.tsx
git commit -m "refactor: extract doc parsing utils from review page"
```

---

## Task 2: 提取文本高亮引擎 (`highlight-utils.ts`)

**Files:**
- Create: `src/app/review/[id]/highlight-utils.ts`
- Modify: `src/app/review/[id]/page.tsx`（删除对应函数，添加 import）

- [ ] **Step 1: 创建 `highlight-utils.ts`，包含3个函数**

```typescript
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
```

- [ ] **Step 2: 在 `page.tsx` 顶部添加 import，删除原函数，替换 clearHighlights 调用**

添加 import（紧跟 `doc-utils` import 后面）：
```typescript
import { findMatchingParagraphIds, highlightTextInNode, clearHighlights } from './highlight-utils';
```

删除 `page.tsx` 中以下内容（行128-183、行482-705）：
- `const findMatchingParagraphIds = ...`（整个函数）
- `const highlightTextInNode = ...`（整个函数）
- `const highlightByNormalizedMatch = ...`（整个函数）

在高亮 useEffect 中，将原来内联的清除高亮代码块（`document.querySelectorAll('mark.risk-highlight').forEach(...)`）替换为：
```typescript
clearHighlights();
```

- [ ] **Step 3: 验证编译无报错**

```bash
cd "/Users/gaofeixiang/Desktop/完成项目/公平竞争审查系统"
npx tsc --noEmit 2>&1 | head -30
```

期望输出：无错误

- [ ] **Step 4: Commit**

```bash
cd "/Users/gaofeixiang/Desktop/完成项目/公平竞争审查系统"
git add src/app/review/\[id\]/highlight-utils.ts src/app/review/\[id\]/page.tsx
git commit -m "refactor: extract text highlight engine from review page"
```

---

## Task 3: 提取 Word 导出逻辑 (`export-utils.ts`)

**Files:**
- Create: `src/app/review/[id]/export-utils.ts`
- Modify: `src/app/review/[id]/page.tsx`（删除 handleExport 内部逻辑，改为调用工具函数）

- [ ] **Step 1: 创建 `export-utils.ts`**

```typescript
// src/app/review/[id]/export-utils.ts

export interface RiskItem {
    id: string;
    type: string;
    level: string;
    title: string;
    reason: string;
    suggestion?: string;
    snippet: string;
    law: string;
    case: string;
    paragraphIds?: string[];
}

export const exportReviewReport = async (
    risks: RiskItem[],
    summary: string,
    fileName: string
): Promise<void> => {
    const {
        Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
        Table, TableRow, TableCell, WidthType, BorderStyle,
    } = await import('docx');

    const tableBorders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    };

    const riskRows = risks.flatMap((risk, index) => [
        new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: `${index + 1}` })], alignment: AlignmentType.CENTER })],
                    width: { size: 5, type: WidthType.PERCENTAGE },
                    verticalAlign: 'center',
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: risk.type })], alignment: AlignmentType.CENTER })],
                    width: { size: 15, type: WidthType.PERCENTAGE },
                    verticalAlign: 'center',
                }),
                new TableCell({
                    children: [
                        new Paragraph({ children: [new TextRun({ text: risk.title, bold: true })] }),
                        new Paragraph({
                            children: [new TextRun({
                                text: `风险等级: ${risk.level === 'high' ? '高' : '中'}`,
                                color: risk.level === 'high' ? 'FF0000' : 'FFA500',
                            })],
                        }),
                    ],
                    width: { size: 25, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                    children: [
                        new Paragraph({ children: [new TextRun({ text: '【问题描述】', bold: true })] }),
                        new Paragraph({ text: risk.reason }),
                        new Paragraph({ text: '' }),
                        new Paragraph({ children: [new TextRun({ text: '【修改建议】', bold: true })] }),
                        new Paragraph({ text: risk.suggestion || '无' }),
                    ],
                    width: { size: 55, type: WidthType.PERCENTAGE },
                }),
            ],
        }),
    ]);

    const headerRow = new TableRow({
        children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '序号', bold: true })], alignment: AlignmentType.CENTER })], width: { size: 5, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '风险类型', bold: true })], alignment: AlignmentType.CENTER })], width: { size: 15, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '风险摘要', bold: true })], alignment: AlignmentType.CENTER })], width: { size: 25, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '详细说明与建议', bold: true })], alignment: AlignmentType.CENTER })], width: { size: 55, type: WidthType.PERCENTAGE } }),
        ],
        tableHeader: true,
    });

    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    text: '公平竞争审查意见书',
                    heading: HeadingLevel.TITLE,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '文件名称：', bold: true }), new TextRun(fileName)],
                    spacing: { after: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '审查日期：', bold: true }), new TextRun(new Date().toLocaleDateString())],
                    spacing: { after: 400 },
                }),
                new Paragraph({ text: '一、审查结论', heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 200 } }),
                new Paragraph({
                    text: risks.length === 0
                        ? '经审查，该文件未发现违反《公平竞争审查条例》的相关内容，符合公平竞争要求。'
                        : `经审查，该文件存在 ${risks.length} 处涉嫌违反《公平竞争审查条例》的风险点，建议修改后发布。`,
                    spacing: { after: 400 },
                }),
                new Paragraph({ text: '二、文件摘要', heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 200 } }),
                new Paragraph({ text: summary, spacing: { after: 400 } }),
                new Paragraph({ text: '三、风险点详细分析', heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 200 } }),
                risks.length > 0
                    ? new Table({ rows: [headerRow, ...riskRows], width: { size: 100, type: WidthType.PERCENTAGE }, borders: tableBorders })
                    : new Paragraph({ text: '无风险点。' }),
                new Paragraph({ text: '', spacing: { before: 800 } }),
                new Paragraph({
                    children: [new TextRun({ text: '审查单位（盖章）：__________________' })],
                    alignment: AlignmentType.RIGHT,
                    spacing: { after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '审查人签字：__________________' })],
                    alignment: AlignmentType.RIGHT,
                    spacing: { after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '日期：______年____月____日' })],
                    alignment: AlignmentType.RIGHT,
                }),
            ],
        }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName.replace(/\.[^/.]+$/, '')}_审查意见书.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
```

- [ ] **Step 2: 修改 `page.tsx` 中的 `handleExport`**

添加 import：
```typescript
import { exportReviewReport, type RiskItem } from './export-utils';
```

将 `page.tsx` 中原来的 `handleExport` 函数（行712-875）整体替换为：
```typescript
const handleExport = async () => {
    try {
        await exportReviewReport(risks, summary, fileName);
    } catch (error) {
        console.error('Export failed:', error);
        alert('导出失败，请重试');
    }
};
```

同时将 `risks` 的 state 类型从 `any[]` 改为 `RiskItem[]`：
```typescript
const [risks, setRisks] = useState<RiskItem[]>([]);
```

- [ ] **Step 3: 验证编译无报错**

```bash
cd "/Users/gaofeixiang/Desktop/完成项目/公平竞争审查系统"
npx tsc --noEmit 2>&1 | head -30
```

期望输出：无错误

- [ ] **Step 4: Commit**

```bash
cd "/Users/gaofeixiang/Desktop/完成项目/公平竞争审查系统"
git add src/app/review/\[id\]/export-utils.ts src/app/review/\[id\]/page.tsx
git commit -m "refactor: extract Word export logic from review page"
```

---

## Task 4: 最终验证

**Files:**
- Read: `src/app/review/[id]/page.tsx`（确认行数缩减）

- [ ] **Step 1: 确认 page.tsx 行数**

```bash
wc -l "/Users/gaofeixiang/Desktop/完成项目/公平竞争审查系统/src/app/review/[id]/page.tsx"
```

期望输出：500-600 行

- [ ] **Step 2: 确认新文件存在且不为空**

```bash
wc -l "/Users/gaofeixiang/Desktop/完成项目/公平竞争审查系统/src/app/review/[id]/doc-utils.ts" \
       "/Users/gaofeixiang/Desktop/完成项目/公平竞争审查系统/src/app/review/[id]/highlight-utils.ts" \
       "/Users/gaofeixiang/Desktop/完成项目/公平竞争审查系统/src/app/review/[id]/export-utils.ts"
```

期望输出：每个文件都有内容（>50行）

- [ ] **Step 3: 最终编译检查**

```bash
cd "/Users/gaofeixiang/Desktop/完成项目/公平竞争审查系统"
npx tsc --noEmit 2>&1
```

期望输出：0 errors

- [ ] **Step 4: 启动开发服务器，手动验证功能**

```bash
cd "/Users/gaofeixiang/Desktop/完成项目/公平竞争审查系统"
npm run dev
```

在浏览器中访问 `http://localhost:3000`，验证：
1. 上传一个文件，能正常进入审查页面
2. 点击风险点，文档中有高亮效果
3. 点击"导出报告"，能正常下载 `.docx` 文件
4. 点击"返回工作台"，能正常跳转

- [ ] **Step 5: 最终 Commit**

```bash
cd "/Users/gaofeixiang/Desktop/完成项目/公平竞争审查系统"
git add -A
git commit -m "refactor: complete review page split - 1286 lines → ~550 lines"
```
