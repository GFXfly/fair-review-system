'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './page.module.css';
import type { KnowledgeItem } from './types';

interface KnowledgeDrawerProps {
    item: KnowledgeItem;
    onClose: () => void;
}

export default function KnowledgeDrawer({ item, onClose }: KnowledgeDrawerProps) {
    return (
        <div className={styles.drawerOverlay} onClick={onClose}>
            <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
                <div className={styles.drawerHeader}>
                    <div className={styles.drawerTitle}>{item.title}</div>
                    <button className={styles.closeBtn} onClick={onClose}>×</button>
                </div>
                <div className={styles.drawerContent}>
                    <div id="meta-info" className={styles.metaInfo} style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
                        {item.publishDate && (
                            <div className={styles.metaItem}>
                                <span className={styles.metaLabel}>发布日期</span>
                                <span className={styles.metaValue}>{item.publishDate}</span>
                            </div>
                        )}
                        {item.department && (
                            <div className={styles.metaItem}>
                                <span className={styles.metaLabel}>发布部门</span>
                                <span className={styles.metaValue}>{item.department}</span>
                            </div>
                        )}
                        {item.level && (
                            <div className={styles.metaItem}>
                                <span className={styles.metaLabel}>效力级别</span>
                                <span className={styles.metaValue}>{item.level}</span>
                            </div>
                        )}
                    </div>

                    <div className={styles.articleContent} style={{ maxWidth: '800px', margin: '0 auto' }}>
                        <ReactMarkdown
                            components={{
                                h3: ({ node, ...props }) => <h3 {...props} style={{ color: '#1e40af', marginTop: '30px', borderLeft: '4px solid #2563eb', paddingLeft: '12px' }} />,
                                p: ({ node, ...props }) => <p {...props} style={{ lineHeight: '1.8', marginBottom: '16px', color: '#374151', fontSize: '15px' }} />,
                                strong: ({ node, ...props }) => <strong {...props} style={{ color: '#111827', fontWeight: 600 }} />
                            }}
                        >
                            {item.content}
                        </ReactMarkdown>
                    </div>
                </div>
            </div>
        </div>
    );
}
