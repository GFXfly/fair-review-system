'use client';

import React, { useMemo } from 'react';

interface SmartTableProps {
    rows: string[][];
    maxCols?: number;
}

interface Cell {
    content: string;
    colSpan: number;
    rowSpan: number;
    skip: boolean;
}

interface PreparedTable {
    normalizedRows: Cell[][];
    hasHeaderRow: boolean;
}

function prepareTable(rows: string[][], maxColsHint?: number): PreparedTable {
    const maxCols = maxColsHint || Math.max(1, ...rows.map(r => r.length));

    const normalizedRows: Cell[][] = rows.map(row => {
        if (row.length === 1 && rows.length > 1) {
            return [{ content: row[0], colSpan: maxCols, rowSpan: 1, skip: false }];
        }
        const padded = [...row];
        while (padded.length < maxCols) padded.push('');
        return padded.map(content => ({ content, colSpan: 1, rowSpan: 1, skip: false }));
    });

    // Vertical cell merging: consecutive identical values in the same column.
    for (let col = 0; col < maxCols; col++) {
        let runStart = 0;
        for (let row = 0; row < normalizedRows.length; row++) {
            const currentCell = normalizedRows[row][col];
            if (!currentCell) continue;

            if (row > runStart) {
                const runStartContent = normalizedRows[runStart][col]?.content?.trim();
                const currentContent = currentCell.content?.trim();
                if (currentContent && currentContent === runStartContent) {
                    normalizedRows[runStart][col].rowSpan++;
                    currentCell.skip = true;
                } else {
                    runStart = row;
                }
            }
        }
    }

    const hasHeaderRow = rows.length > 0 && rows[0].length > 1;
    return { normalizedRows, hasHeaderRow };
}

export default function SmartTable({ rows, maxCols }: SmartTableProps) {
    const { normalizedRows, hasHeaderRow } = useMemo(
        () => prepareTable(rows, maxCols),
        [rows, maxCols],
    );

    if (normalizedRows.length === 0) return null;

    const bodyStartIdx = hasHeaderRow ? 1 : 0;

    return (
        <table>
            {hasHeaderRow && (
                <thead>
                    <tr>
                        {normalizedRows[0].map((cell, idx) =>
                            cell.skip ? null : (
                                <th
                                    key={idx}
                                    colSpan={cell.colSpan}
                                    rowSpan={cell.rowSpan}
                                    style={{
                                        textAlign: 'center',
                                        background: '#9ca3af',
                                        color: 'white',
                                        fontWeight: 600,
                                    }}
                                >
                                    {cell.content}
                                </th>
                            ),
                        )}
                    </tr>
                </thead>
            )}
            <tbody>
                {normalizedRows.slice(bodyStartIdx).map((row, rIdx) => {
                    const isSectionHeader = row.length > 0 && row[0].colSpan > 1;
                    return (
                        <tr key={rIdx + bodyStartIdx}>
                            {row.map((cell, cIdx) =>
                                cell.skip ? null : (
                                    <td
                                        key={cIdx}
                                        colSpan={cell.colSpan}
                                        rowSpan={cell.rowSpan}
                                        style={{
                                            textAlign: isSectionHeader ? 'center' : cIdx === 0 ? 'center' : 'left',
                                            background: isSectionHeader ? '#e5e7eb' : 'transparent',
                                            fontWeight: isSectionHeader ? 600 : 'normal',
                                            verticalAlign: 'middle',
                                        }}
                                    >
                                        {cell.content}
                                    </td>
                                ),
                            )}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
