'use client';

import React, { useState } from 'react';
import styles from './page.module.css';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/Icons';

interface PaginationProps {
    total: number;
    page: number;
    onChange: (p: number) => void;
    pageSize?: number;
}

export default function Pagination({
    total,
    page,
    onChange,
    pageSize = 20
}: PaginationProps) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // 输入中的页码草稿；为 null 时显示当前页（随 page 变化自动同步，无需 effect）
    const [draft, setDraft] = useState<string | null>(null);
    const inputVal = draft ?? page.toString();

    const commit = () => {
        let p = parseInt(inputVal, 10);
        setDraft(null);
        if (isNaN(p)) return;
        if (p < 1) p = 1;
        if (p > totalPages) p = totalPages;
        if (p !== page) {
            onChange(p);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            commit();
        }
    };

    return (
        <div className={styles.pagination}>
            <span className={styles.pageTotal}>
                共 <b>{total}</b> 条 · 每页 {pageSize} 条
            </span>
            <div className={styles.pageControls}>
                <button
                    type="button"
                    className={styles.pageBtn}
                    disabled={page <= 1}
                    onClick={() => onChange(Math.max(1, page - 1))}
                    aria-label="上一页"
                >
                    <ChevronLeftIcon size={15} />
                </button>
                <div className={styles.pageJump}>
                    <span>第</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        className={styles.pageInput}
                        value={inputVal}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={commit}
                        onKeyDown={handleKeyDown}
                        aria-label="跳转页码"
                    />
                    <span>/ {totalPages} 页</span>
                </div>
                <button
                    type="button"
                    className={styles.pageBtn}
                    disabled={page >= totalPages}
                    onClick={() => onChange(Math.min(totalPages, page + 1))}
                    aria-label="下一页"
                >
                    <ChevronRightIcon size={15} />
                </button>
            </div>
        </div>
    );
}
