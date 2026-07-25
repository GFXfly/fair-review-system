'use client';

import React from 'react';
import styles from './page.module.css';
import Pagination from './Pagination';
import { ITEMS_PER_PAGE } from './use-knowledge-base';

interface KnowledgeTabProps {
    kind: 'regulations' | 'cases';
    items: any[];
    page: number;
    onPageChange: (p: number) => void;
    isLoading: boolean;
    searchQuery: string;
    onSearchQueryChange: (q: string) => void;
    onSearch: () => void;
    onItemClick: (item: any) => void;
}

export default function KnowledgeTab({
    kind,
    items,
    page,
    onPageChange,
    isLoading,
    searchQuery,
    onSearchQueryChange,
    onSearch,
    onItemClick
}: KnowledgeTabProps) {
    const isCases = kind === 'cases';
    const pageItems = items.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    return (
        <div className={styles.knowledgeSection}>
            <div className={styles.sectionHeader} style={{ textAlign: 'center' }}>
                <h2>{isCases ? '⚖️ 典型案例库' : '📜 核心法规库'}</h2>
            </div>

            {/* Search Bar：法规库沿用此前的设计，不显示搜索框 */}
            {isCases && (
                <div className={styles.searchBox}>
                    <input
                        type="text"
                        placeholder="🔍 搜索案例，如“指定交易”、“补贴”..."
                        className={styles.searchInput}
                        value={searchQuery}
                        onChange={(e) => onSearchQueryChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                    />
                    <button className={styles.primaryBtn} onClick={onSearch}>
                        {isLoading ? '搜索中...' : '搜索'}
                    </button>
                </div>
            )}

            <div className={styles.knowledgeContent}>
                <div className={styles.knowledgeCard} style={{ padding: 0, overflow: 'hidden' }}>
                    <table className={styles.caseTable}>
                        <thead>
                            {isCases ? (
                                <tr>
                                    <th style={{ width: '40px' }}></th>
                                    <th>事件名称</th>
                                    <th style={{ width: '200px' }}>通告机构</th>
                                    <th style={{ width: '100px' }}>案例级别</th>
                                    <th style={{ width: '120px' }}>通告日期</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th style={{ width: '40px' }}></th>
                                    <th>法规名称</th>
                                    <th style={{ width: '120px' }}>效力级别</th>
                                    <th style={{ width: '120px' }}>发布日期</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {pageItems.map((item) => {
                                if (!isCases) {
                                    return (
                                        <tr key={item.id} onClick={() => onItemClick(item)} style={{ cursor: 'pointer' }}>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className={styles.caseIcon}>📜</span>
                                            </td>
                                            <td>
                                                <div className={styles.caseTitle}>{item.title}</div>
                                            </td>
                                            <td>
                                                <span className={`${styles.caseTag} ${styles.tagNational}`}>
                                                    {item.level || '未知级别'}
                                                </span>
                                            </td>
                                            <td style={{ color: '#6b7280' }}>{item.publishDate}</td>
                                        </tr>
                                    );
                                }

                                const isNational = item.report?.department?.includes('总局') || item.report?.department?.includes('国家');
                                const levelTag = isNational ? '国家级' : '省级';
                                const tagClass = isNational ? styles.tagNational : styles.tagProvincial;

                                return (
                                    <tr key={item.id} onClick={() => onItemClick(item)} style={{ cursor: 'pointer' }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={styles.caseIcon}>📂</span>
                                        </td>
                                        <td>
                                            <div className={styles.caseTitle}>{item.title}</div>
                                        </td>
                                        <td>{item.report?.department || '未知机构'}</td>
                                        <td>
                                            <span className={`${styles.caseTag} ${tagClass}`}>
                                                {levelTag}
                                            </span>
                                        </td>
                                        <td style={{ color: '#6b7280' }}>{item.publishDate}</td>
                                    </tr>
                                );
                            })}
                            {items.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={isCases ? 5 : 4} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                                        {isCases ? '暂无相关案例' : '暂无相关法规'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Pagination Footer */}
                    <Pagination
                        total={items.length}
                        page={page}
                        onChange={onPageChange}
                        pageSize={ITEMS_PER_PAGE}
                    />
                </div>
            </div>
        </div>
    );
}
