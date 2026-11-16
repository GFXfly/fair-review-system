
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import BrandSeal from '@/components/ui/BrandSeal';
import { ArrowLeftIcon, BuildingIcon, CalendarIcon, AlertTriangleIcon, CheckCircleIcon, FilesStackIcon, MapPinIcon } from '@/components/ui/Icons';

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
                        <mark key={index} className={styles.highlightMark}>
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
                    // 闪烁动画类在本模块内定义，避免 CSS Modules 对 keyframes 改名后内联动画失效
                    firstMark.classList.add(styles.markPulse);
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
            <header className={styles.header}>
                <Link href={backLink} className={styles.backLink}>
                    <ArrowLeftIcon size={16} />
                    <span>返回案例库</span>
                </Link>
                <span className={styles.headerDivider} aria-hidden="true" />
                <h1 className={styles.headerTitle} title={sourceTitle}>
                    <HighlightedText text={sourceTitle} keyword={highlightKeyword} />
                </h1>
                <span className={styles.headerCount}>
                    共 <span className={styles.num}>{cases.length}</span> 个案例
                </span>
            </header>

            <div className={styles.body}>
                {/* Left Sidebar */}
                <nav className={styles.sidebar}>
                    <div className={styles.sidebarHeader}>
                        <FilesStackIcon size={16} />
                        <span>目录</span>
                    </div>
                    <div className={styles.sidebarContent}>
                        {cases.map((item, index) => (
                            <div
                                key={item.id}
                                className={`${styles.navItem} ${activeCaseId === item.id ? styles.navItemActive : ''}`}
                                onClick={() => handleNavClick(item.id)}
                            >
                                <span className={styles.navIndex}>{String(index + 1).padStart(2, '0')}</span>
                                <div className={styles.navItemTitle}>
                                    <HighlightedText text={item.title} keyword={highlightKeyword} />
                                </div>
                            </div>
                        ))}
                    </div>
                </nav>

                {/* Right Content */}
                <div className={styles.main}>
                    <div className={styles.docContainer}>
                        <article className={styles.docPaper}>
                            <div className={styles.reportHead}>
                                <BrandSeal char="案" size={30} variant="outline" />
                                <span className={styles.reportEyebrow}>典型案例通报</span>
                            </div>
                            <h1 className={styles.reportTitle}>
                                <HighlightedText text={sourceTitle} keyword={highlightKeyword} />
                            </h1>
                            <div className={styles.reportMeta}>
                                <span className={styles.metaItem}>
                                    <CalendarIcon size={14} />
                                    发布日期：{publishDate}
                                </span>
                                <span className={styles.metaItem}>
                                    <BuildingIcon size={14} />
                                    发布机构：{cases[0]?.documentOrg || '未知机构'}
                                </span>
                                {cases[0]?.province && (
                                    <span className={styles.metaItem}>
                                        <MapPinIcon size={14} />
                                        {cases[0].province}
                                    </span>
                                )}
                            </div>
                            <div className={styles.reportRule} aria-hidden="true" />

                            {cases.map((item, index) => (
                                <div
                                    key={item.id}
                                    data-id={item.id}
                                    ref={el => { sectionRefs.current[item.id] = el; }}
                                    className={`${styles.caseSection} ${activeCaseId === item.id ? styles.caseSectionActive : ''}`}
                                >
                                    <div className={styles.caseIndex}>案例 {String(index + 1).padStart(2, '0')}</div>
                                    <h2 className={styles.caseTitle}>
                                        <HighlightedText text={item.title} keyword={highlightKeyword} />
                                    </h2>
                                    <div className={styles.caseContent}>
                                        {item.content.split(/\r?\n/).map((para, i) => (
                                            para.trim() ? (
                                                <p key={i} className={styles.casePara}>
                                                    <HighlightedText text={para.trim()} keyword={highlightKeyword} />
                                                </p>
                                            ) : null
                                        ))}
                                    </div>
                                    <div className={styles.caseMeta}>
                                        <span className={`${styles.tag} ${styles.tagViolation}`}>
                                            <AlertTriangleIcon size={13} />
                                            <span>违规类型：<HighlightedText text={item.violationType} keyword={highlightKeyword} /></span>
                                        </span>
                                        <span className={`${styles.tag} ${styles.tagResult}`}>
                                            <CheckCircleIcon size={13} />
                                            <span>处理结果：<HighlightedText text={item.result} keyword={highlightKeyword} /></span>
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </article>
                    </div>
                </div>
            </div>
        </div>
    );
}
