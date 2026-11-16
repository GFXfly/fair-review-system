'use client';

import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './page.module.css';
import kit from '@/components/ui/kit.module.css';
import type { KnowledgeItem } from './types';
import { BookOpenIcon, BuildingIcon, CalendarIcon, CloseIcon, ScaleLawIcon } from '@/components/ui/Icons';

interface KnowledgeDrawerProps {
    item: KnowledgeItem;
    onClose: () => void;
}

export default function KnowledgeDrawer({ item, onClose }: KnowledgeDrawerProps) {
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div className={styles.drawerOverlay} onClick={onClose}>
            <aside
                className={styles.drawer}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={item.title}
            >
                <div className={styles.drawerHeader}>
                    <div className={styles.drawerHeadMain}>
                        <span className={styles.drawerKicker}>
                            <BookOpenIcon size={14} />
                            法规全文
                        </span>
                        <h2 className={styles.drawerTitle}>{item.title}</h2>
                    </div>
                    <button type="button" className={kit.btnIcon + ' ' + kit.btn} onClick={onClose} aria-label="关闭">
                        <CloseIcon size={18} />
                    </button>
                </div>

                <div className={styles.drawerContent}>
                    {(item.publishDate || item.department || item.level) && (
                        <div id="meta-info" className={styles.metaInfo}>
                            {item.publishDate && (
                                <div className={styles.metaItem}>
                                    <span className={styles.metaLabel}><CalendarIcon size={13} />发布日期</span>
                                    <span className={`${styles.metaValue} ${kit.mono}`}>{item.publishDate}</span>
                                </div>
                            )}
                            {item.department && (
                                <div className={styles.metaItem}>
                                    <span className={styles.metaLabel}><BuildingIcon size={13} />发布部门</span>
                                    <span className={styles.metaValue}>{item.department}</span>
                                </div>
                            )}
                            {item.level && (
                                <div className={styles.metaItem}>
                                    <span className={styles.metaLabel}><ScaleLawIcon size={13} />效力级别</span>
                                    <span className={styles.metaValue}>{item.level}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <article className={styles.articleContent}>
                        <ReactMarkdown>{item.content}</ReactMarkdown>
                    </article>
                </div>
            </aside>
        </div>
    );
}
