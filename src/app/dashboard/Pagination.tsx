'use client';

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';

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
    const totalPages = Math.ceil(total / pageSize);
    const [inputVal, setInputVal] = useState(page.toString());

    // Sync local input state when page prop changes
    useEffect(() => {
        setInputVal(page.toString());
    }, [page]);

    const handleInputBlur = () => {
        let p = parseInt(inputVal, 10);
        if (isNaN(p)) {
            setInputVal(page.toString());
            return;
        }
        if (p < 1) p = 1;
        if (p > totalPages) p = totalPages;

        setInputVal(p.toString());
        if (p !== page) {
            onChange(p);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleInputBlur();
        }
    };

    return (
        <div className={styles.pagination}>
            <span>共 {total} 条</span>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button
                    className={styles.pageBtn}
                    disabled={page === 1}
                    onClick={() => onChange(Math.max(1, page - 1))}
                >
                    &lt;
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '0 8px' }}>
                    <span>第</span>
                    <input
                        type="text"
                        value={inputVal}
                        onChange={(e) => setInputVal(e.target.value)}
                        onBlur={handleInputBlur}
                        onKeyDown={handleKeyDown}
                        style={{
                            width: '40px',
                            textAlign: 'center',
                            padding: '4px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '13px'
                        }}
                    />
                    <span>页 / 共 {totalPages} 页</span>
                </div>
                <button
                    className={styles.pageBtn}
                    disabled={page >= totalPages}
                    onClick={() => onChange(Math.min(totalPages, page + 1))}
                >
                    &gt;
                </button>
            </div>
        </div>
    );
}
