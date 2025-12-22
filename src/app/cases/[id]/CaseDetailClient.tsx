
'use client';

import React, { useState, useEffect, useRef } from 'react';
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
    documentName: string | null;
    documentOrg: string | null;
}

interface Props {
    currentCase: Case;
    relatedCases: Case[];
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

export default function CaseDetailClient({ currentCase, relatedCases }: Props) {
    const searchParams = useSearchParams();

    // If no related cases (or only self), just show self.
    // But usually relatedCases includes self if we fetched by sourceTitle.
    // Let's ensure relatedCases is populated.
    const cases = relatedCases.length > 0 ? relatedCases : [currentCase];

    const [activeCaseId, setActiveCaseId] = useState<number>(currentCase.id);
    const sectionRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
    const isScrollingRef = useRef(false);

    // 获取高亮关键词
    const highlightKeyword = searchParams.get('highlight') || '';

    // Construct back link
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
            setTimeout(() => {
                const firstMark = document.querySelector(`.${styles.docPaper} mark`);
                if (firstMark) {
                    firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    (firstMark as HTMLElement).style.animation = 'highlightPulse 1.5s ease-in-out 2';
                }
            }, 300);
        }
    }, [highlightKeyword]);

    // Optional: Auto-detect active section on scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (isScrollingRef.current) return;

                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const id = Number(entry.target.getAttribute('data-id'));
                        if (id) {
                            setActiveCaseId(id);
                        }
                    }
                });
            },
            {
                root: null,
                rootMargin: '-20% 0px -60% 0px', // Trigger when element is near top-center
                threshold: 0.1
            }
        );

        Object.values(sectionRefs.current).forEach((el) => {
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [cases]);

    // Initial scroll to current case
    useEffect(() => {
        if (currentCase.id && !highlightKeyword) {
            const element = sectionRefs.current[currentCase.id];
            if (element) {
                element.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
        }
    }, []);

    const sourceTitle = cases[0]?.documentName || '典型案例详情';
    const publishDate = cases[0]?.publishDate || '未知日期';

    return (
        <div className={styles.container}>
            {/* Left Sidebar */}
            <div className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <span>📑 目录</span>
                </div>
                <div className={styles.sidebarContent}>
                    {cases.map((item, index) => (
                        <div
                            key={item.id}
                            className={`${styles.navItem} ${activeCaseId === item.id ? styles.navItemActive : ''}`}
                            onClick={() => handleNavClick(item.id)}
                        >
                            <div className={styles.navItemTitle}>
                                {index + 1}. <HighlightedText text={item.title} keyword={highlightKeyword} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Content */}
            <div className={styles.main}>
                <header className={styles.header}>
                    <Link href={backLink} className={styles.backLink}>
                        ← 返回案例库
                    </Link>
                    <div style={{ fontWeight: 600 }}>
                        <HighlightedText text={sourceTitle} keyword={highlightKeyword} />
                    </div>
                    <div style={{ width: '80px' }}></div> {/* Spacer */}
                </header>

                <div className={styles.docContainer}>
                    <div className={styles.docPaper}>
                        <h1 className={styles.reportTitle}>
                            <HighlightedText text={sourceTitle} keyword={highlightKeyword} />
                        </h1>
                        <div className={styles.reportMeta}>
                            <span>发布日期：{publishDate}</span>
                            <span>发布机构：{cases[0]?.documentOrg || '未知机构'}</span>
                        </div>

                        {cases.map((item, index) => (
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
