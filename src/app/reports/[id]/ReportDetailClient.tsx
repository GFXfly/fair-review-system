'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';

interface Case {
    id: number;
    title: string;
    content: string;
    violationType: string;
    result: string;
    publishDate: string | null;
    province: string | null;
    violationClause: string | null;
    documentName: string | null;
    documentOrg: string | null;
    violationDetail: string | null;
    legalScope: string | null;
}

interface Report {
    id: number;
    title: string;
    department: string;
    publishDate: string | null;
    province: string | null;
    cases: Case[];
}

interface Props {
    report: Report;
}

// 高亮文本组件
function HighlightedText({ text, keyword }: { text: string; keyword: string }) {
    if (!keyword || !text) {
        return <>{text}</>;
    }

    // 创建不区分大小写的正则表达式
    const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, index) => {
                if (part.toLowerCase() === keyword.toLowerCase()) {
                    return (
                        <mark
                            key={index}
                            className={styles.highlightMark}
                            style={{
                                backgroundColor: '#FBBF24',
                                color: '#78350F',
                                padding: '1px 2px',
                                borderRadius: '2px',
                                fontWeight: 500
                            }}
                        >
                            {part}
                        </mark>
                    );
                }
                return <span key={index}>{part}</span>;
            })}
        </>
    );
}

export default function ReportDetailClient({ report }: Props) {
    const searchParams = useSearchParams();
    const [activeCaseId, setActiveCaseId] = useState<number | null>(report.cases[0]?.id || null);
    const sectionRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
    const isScrollingRef = useRef(false);
    const firstHighlightRef = useRef<HTMLElement | null>(null);

    // 获取高亮关键词
    const highlightKeyword = searchParams.get('highlight') || '';

    // Construct back link with page parameter
    const page = searchParams.get('page') || '1';
    const backLink = `/dashboard?tab=cases&page=${page}`;

    const handleNavClick = (id: number) => {
        setActiveCaseId(id);
        const element = sectionRefs.current[id];
        if (element) {
            isScrollingRef.current = true;
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                isScrollingRef.current = false;
            }, 500);
        }
    };

    // 自动滚动到第一个高亮位置
    useEffect(() => {
        if (highlightKeyword) {
            // 延迟执行以确保 DOM 已渲染
            setTimeout(() => {
                const firstMark = document.querySelector(`.${styles.docPaper} mark`);
                if (firstMark) {
                    firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // 添加闪烁动画效果
                    (firstMark as HTMLElement).style.animation = 'highlightPulse 1.5s ease-in-out 2';
                }
            }, 300);
        }
    }, [highlightKeyword]);

    // Auto-detect active section on scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (isScrollingRef.current) return;

                // Filter only intersecting entries
                const intersecting = entries.filter(entry => entry.isIntersecting);
                if (intersecting.length === 0) return;

                // Find the entry closest to the center of the viewport
                let closestEntry = intersecting[0];
                let minDistance = Infinity;

                intersecting.forEach((entry) => {
                    const rect = entry.boundingClientRect;
                    const viewportCenter = window.innerHeight / 2;
                    const elementCenter = rect.top + rect.height / 2;
                    const distance = Math.abs(elementCenter - viewportCenter);

                    if (distance < minDistance) {
                        minDistance = distance;
                        closestEntry = entry;
                    }
                });

                const id = Number(closestEntry.target.getAttribute('data-id'));
                if (id && id !== activeCaseId) {
                    setActiveCaseId(id);
                }
            },
            {
                root: null,
                rootMargin: '0px',
                threshold: [0, 0.25, 0.5, 0.75, 1.0]
            }
        );

        Object.values(sectionRefs.current).forEach((el) => {
            if (el) observer.observe(el);
        });

        // Add scroll end detection for last case
        const docContainer = document.querySelector(`.${styles.docContainer}`);
        const handleScroll = () => {
            if (isScrollingRef.current || !docContainer) return;

            const scrollTop = docContainer.scrollTop;
            const scrollHeight = docContainer.scrollHeight;
            const clientHeight = docContainer.clientHeight;

            // If scrolled to bottom (within 50px), activate last case
            if (scrollHeight - scrollTop - clientHeight < 50) {
                const lastCase = report.cases[report.cases.length - 1];
                if (lastCase && activeCaseId !== lastCase.id) {
                    setActiveCaseId(lastCase.id);
                }
            }
        };

        if (docContainer) {
            docContainer.addEventListener('scroll', handleScroll, { passive: true });
        }

        return () => {
            observer.disconnect();
            if (docContainer) {
                docContainer.removeEventListener('scroll', handleScroll);
            }
        };
    }, [report.cases, styles.docContainer, activeCaseId]);

    return (
        <div className={styles.container}>
            {/* Left Sidebar */}
            <div className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <Link href={backLink} className={styles.backLink}>
                        ← 返回案例库
                    </Link>
                    <div className={styles.sidebarTitle}>
                        <span>📑</span>
                        <span>目录</span>
                    </div>
                </div>
                <div className={styles.sidebarContent}>
                    {report.cases.map((item, index) => {
                        const isExpanded = activeCaseId === item.id;
                        return (
                            <div
                                key={item.id}
                                className={`${styles.navItem} ${isExpanded ? styles.navItemExpanded : ''} ${activeCaseId === item.id ? styles.navItemActive : ''}`}
                            >
                                <div
                                    className={styles.navItemHeader}
                                    onClick={() => handleNavClick(item.id)}
                                >
                                    <div className={styles.navItemIcon}>
                                        ▶
                                    </div>
                                    <div className={styles.navItemTitle}>
                                        案例{index + 1}：<HighlightedText text={item.title} keyword={highlightKeyword} />
                                    </div>
                                </div>
                                <div className={styles.navItemContent}>
                                    <div className={styles.navItemDetails}>
                                        <div className={styles.navItemMeta}>
                                            <span className={styles.navItemMetaLabel}>违　　反：</span>
                                            <span className={styles.navItemMetaValue}>
                                                <HighlightedText text={item.violationClause || ''} keyword={highlightKeyword} />
                                            </span>
                                        </div>
                                        <div className={styles.navItemMeta}>
                                            <span className={styles.navItemMetaLabel}>文件名称：</span>
                                            <span className={styles.navItemMetaValue}>
                                                <HighlightedText text={item.documentName || ''} keyword={highlightKeyword} />
                                            </span>
                                        </div>
                                        <div className={styles.navItemMeta}>
                                            <span className={styles.navItemMetaLabel}>发文机构：</span>
                                            <span className={styles.navItemMetaValue}>
                                                <HighlightedText text={item.documentOrg || ''} keyword={highlightKeyword} />
                                            </span>
                                        </div>
                                        <div className={styles.navItemMeta}>
                                            <span className={styles.navItemMetaLabel}>地　　区：</span>
                                            <span className={styles.navItemMetaValue}>
                                                <HighlightedText text={item.province || ''} keyword={highlightKeyword} />
                                            </span>
                                        </div>
                                        <div className={styles.navItemMeta}>
                                            <span className={styles.navItemMetaLabel}>违规内容：</span>
                                            <span className={styles.navItemMetaValue}>
                                                <HighlightedText text={item.violationDetail || ''} keyword={highlightKeyword} />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right Content */}
            <div className={styles.main}>
                <div className={styles.docContainer}>
                    <div className={styles.docPaper}>
                        <h1 className={styles.reportTitle}>
                            <HighlightedText text={report.title} keyword={highlightKeyword} />
                        </h1>
                        <div className={styles.reportMeta}>
                            <span>发布日期：{report.publishDate}</span>
                            <span>发布机构：{report.department}</span>
                        </div>

                        {report.cases.map((item, index) => (
                            <div
                                key={item.id}
                                data-id={item.id}
                                ref={el => { sectionRefs.current[item.id] = el; }}
                                className={`${styles.caseSection} ${activeCaseId === item.id ? styles.caseSectionActive : ''}`}
                            >
                                <div className={styles.caseTitle}>
                                    {index + 1}. <HighlightedText text={item.title} keyword={highlightKeyword} />
                                </div>
                                <div className={styles.caseContent}>
                                    {item.content.split(/\r?\n/).map((para, i) => (
                                        para.trim() ? (
                                            <div key={i} style={{ textIndent: '2em', marginBottom: '8px' }}>
                                                <HighlightedText text={para.trim()} keyword={highlightKeyword} />
                                            </div>
                                        ) : null
                                    ))}
                                </div>
                                <div className={styles.caseMeta}>
                                    <span className={`${styles.tag} ${styles.tagViolation}`}>
                                        违规类型：<HighlightedText text={item.violationType} keyword={highlightKeyword} />
                                    </span>
                                    <span className={`${styles.tag} ${styles.tagResult}`}>
                                        处理结果：<HighlightedText text={item.result} keyword={highlightKeyword} />
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
