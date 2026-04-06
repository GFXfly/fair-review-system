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
