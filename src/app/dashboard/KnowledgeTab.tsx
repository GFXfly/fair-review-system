'use client';

import React from 'react';
import styles from './page.module.css';
import kit from '@/components/ui/kit.module.css';
import Pagination from './Pagination';
import { ITEMS_PER_PAGE } from './use-knowledge-base';
import type { KnowledgeItem } from './types';
import {
    BookOpenIcon,
    ChevronRightIcon,
    CloseIcon,
    ScaleLawIcon,
    SearchIcon,
} from '@/components/ui/Icons';

interface KnowledgeTabProps {
    kind: 'regulations' | 'cases';
    items: KnowledgeItem[];
    page: number;
    onPageChange: (p: number) => void;
    isLoading: boolean;
    searchQuery: string;
    onSearchQueryChange: (q: string) => void;
    onSearch: () => void;
    onItemClick: (item: KnowledgeItem) => void;
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
    const colCount = isCases ? 5 : 4;

    return (
        <div className={styles.knowledgeSection}>
            <div className={styles.pageHead}>
                <div>
                    <div className={styles.pageEyebrow}>{isCases ? '典型案例' : '核心法规'}</div>
                    <h1 className={styles.pageTitle}>{isCases ? '典型案例库' : '核心法规库'}</h1>
                    <p className={styles.pageDesc}>
                        {isCases
                            ? '收录市场监管部门公开通报的公平竞争审查典型案例，可按关键词检索违规情形。'
                            : '公平竞争审查相关法律、行政法规、部门规章与浙江省招投标领域细则，点击条目查看全文。'}
                    </p>
                </div>

                {/* 法规库沿用此前的设计，不显示搜索框 */}
                {isCases && (
                    <form
                        className={styles.searchBox}
                        role="search"
                        onSubmit={(e) => {
                            e.preventDefault();
                            onSearch();
                        }}
                    >
                        <div className={styles.searchField}>
                            <span className={styles.searchIcon}><SearchIcon size={16} /></span>
                            <input
                                type="text"
                                placeholder="搜索案例，如“指定交易”“补贴”…"
                                className={styles.searchInput}
                                value={searchQuery}
                                onChange={(e) => onSearchQueryChange(e.target.value)}
                                aria-label="搜索案例"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    className={styles.searchClear}
                                    onClick={() => onSearchQueryChange('')}
                                    aria-label="清空搜索词"
                                >
                                    <CloseIcon size={14} />
                                </button>
                            )}
                        </div>
                        <button type="submit" className={`${kit.btn} ${kit.btnPrimary}`} disabled={isLoading}>
                            {isLoading ? <span className={kit.spinner} /> : <SearchIcon size={15} />}
                            {isLoading ? '检索中' : '检索'}
                        </button>
                    </form>
                )}
            </div>

            <div className={`${kit.card} ${styles.knowledgeCard}`}>
                <div className={styles.knowledgeToolbar}>
                    <span className={styles.knowledgeCount}>
                        {isCases ? '案例' : '法规'}共 <b className={kit.mono}>{items.length}</b> 条
                    </span>
                    {isLoading && (
                        <span className={styles.knowledgeLoading}>
                            <span className={kit.spinner} /> 正在加载
                        </span>
                    )}
                </div>

                <div className={kit.tableWrap}>
                    <table className={`${kit.table} ${styles.knowledgeTable}`}>
                        <thead>
                            {isCases ? (
                                <tr>
                                    <th className={styles.colIcon} />
                                    <th>事件名称</th>
                                    <th className={styles.colOrg}>通告机构</th>
                                    <th className={styles.colLevel}>案例级别</th>
                                    <th className={styles.colDate}>通告日期</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th className={styles.colIcon} />
                                    <th>法规名称</th>
                                    <th className={styles.colLevel}>效力级别</th>
                                    <th className={styles.colDate}>发布日期</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {pageItems.map((item) => {
                                if (!isCases) {
                                    return (
                                        <tr key={item.id} className={styles.knowledgeRow} onClick={() => onItemClick(item)}>
                                            <td className={styles.colIcon}>
                                                <span className={styles.rowIcon}><BookOpenIcon size={15} /></span>
                                            </td>
                                            <td>
                                                <div className={styles.rowTitle}>
                                                    <span>{item.title}</span>
                                                    <ChevronRightIcon size={14} className={styles.rowArrow} />
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`${kit.badge} ${kit.badgeSquare} ${kit.toneBrand}`}>
                                                    {item.level || '未知级别'}
                                                </span>
                                            </td>
                                            <td className={kit.cellNum}>{item.publishDate || '—'}</td>
                                        </tr>
                                    );
                                }

                                const isNational = item.report?.department?.includes('总局') || item.report?.department?.includes('国家');
                                const levelTag = isNational ? '国家级' : '省级';

                                return (
                                    <tr key={item.id} className={styles.knowledgeRow} onClick={() => onItemClick(item)}>
                                        <td className={styles.colIcon}>
                                            <span className={`${styles.rowIcon} ${styles.rowIconCase}`}><ScaleLawIcon size={15} /></span>
                                        </td>
                                        <td>
                                            <div className={styles.rowTitle}>
                                                <span>{item.title}</span>
                                                <ChevronRightIcon size={14} className={styles.rowArrow} />
                                            </div>
                                        </td>
                                        <td className={styles.rowOrg}>{item.report?.department || '未知机构'}</td>
                                        <td>
                                            <span className={`${kit.badge} ${kit.badgeSquare} ${isNational ? kit.toneSeal : kit.toneBrand}`}>
                                                {levelTag}
                                            </span>
                                        </td>
                                        <td className={kit.cellNum}>{item.publishDate || '—'}</td>
                                    </tr>
                                );
                            })}
                            {items.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={colCount}>
                                        <div className={kit.empty}>
                                            <span className={kit.emptyIcon}>
                                                {isCases ? <ScaleLawIcon size={24} strokeWidth={1.5} /> : <BookOpenIcon size={24} strokeWidth={1.5} />}
                                            </span>
                                            <div className={kit.emptyTitle}>{isCases ? '暂无相关案例' : '暂无相关法规'}</div>
                                            {isCases && searchQuery && <div className={kit.emptyDesc}>换个关键词再试试</div>}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    total={items.length}
                    page={page}
                    onChange={onPageChange}
                    pageSize={ITEMS_PER_PAGE}
                />
            </div>
        </div>
    );
}
