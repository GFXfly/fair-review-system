'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatParagraphText, getCategoryLabel, parseDocContent, type DocParagraph } from './doc-utils';
import { findMatchingParagraphIds, highlightTextInNode, clearHighlights } from './highlight-utils';
import { exportReviewReport, type RiskItem, type RiskLevel } from './export-utils';
import SmartTable from './SmartTable';
import RiskDetail from './RiskDetail';

const LEVEL_BADGE: Record<RiskLevel, { label: string }> = {
    high: { label: '🔴 高风险' },
    medium: { label: '🟡 疑似风险' },
    low: { label: '🔵 低风险' },
};

function normalizeLevel(raw: unknown): RiskLevel {
    const v = String(raw ?? '').toLowerCase();
    if (v === 'high') return 'high';
    if (v === 'low') return 'low';
    return 'medium';
}

function toNumberOrNull(v: unknown): number | null {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
    return null;
}

export default function ReviewPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [activeRiskId, setActiveRiskId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'risks' | 'summary'>('risks');
    const [isHeaderCompact, setIsHeaderCompact] = useState(false);
    const [isIgnored, setIsIgnored] = useState(false);
    const [ignoreReason, setIgnoreReason] = useState('');
    const [docType, setDocType] = useState('政策文件');

    const [docContent, setDocContent] = useState<DocParagraph[]>([]);
    const [risks, setRisks] = useState<RiskItem[]>([]);
    const [summary, setSummary] = useState('正在加载分析结果...');
    const [fileName, setFileName] = useState('正在加载...');
    const [realReviewId, setRealReviewId] = useState<string | null>(null);

    const docContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = docContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const shouldCompact = container.scrollTop > 24;
            setIsHeaderCompact(prev => (prev === shouldCompact ? prev : shouldCompact));
        };

        handleScroll();
        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            container.removeEventListener('scroll', handleScroll);
        };
    }, []);

    useEffect(() => {
        if (id === 'temp') {
            const dataStr = sessionStorage.getItem('temp_review_data');
            if (!dataStr) {
                setSummary('未找到审查数据，请重新上传文件。');
                return;
            }
            try {
                const data = JSON.parse(dataStr);

                if (data.fileName) setFileName(data.fileName);
                if (data.id) setRealReviewId(data.id);

                let newDocContent: DocParagraph[] = [];
                if (data.html) {
                    newDocContent = [{ id: 'doc_html', type: 'html', html: data.html }];
                } else if (data.text) {
                    newDocContent = parseDocContent(data.text);
                } else {
                    newDocContent = [{ id: 'p0', type: 'text', text: '无法读取文件内容或内容为空。' }];
                }
                setDocContent(newDocContent);

                if (data.auditor && Array.isArray(data.auditor)) {
                    const mappedRisks: RiskItem[] = data.auditor.map((item: any, index: number) => ({
                        id: item.id || `risk_${index}`,
                        snippet: item.location || '（无定位）',
                        type: '合规风险',
                        level: normalizeLevel(item.risk_level),
                        title: item.description ? item.description.substring(0, 15) + '...' : '风险点',
                        reason: item.description,
                        law: item.violated_law || '《公平竞争审查条例》相关条款（AI未明确引用）',
                        case: item.reference || '暂无相似案例匹配',
                        suggestion: item.suggestion,
                        defense: item.defense ?? null,
                        rulingReason: item.rulingReason ?? null,
                        confidence: toNumberOrNull(item.confidence),
                    }));
                    setRisks(mappedRisks);
                } else {
                    setRisks([]);
                }

                if (data.gatekeeper) {
                    setDocType(getCategoryLabel(data.gatekeeper.category));
                    const isNotNeeded = data.gatekeeper.category === 'IGNORE' || data.gatekeeper.needs_review === false;
                    if (isNotNeeded) {
                        setIsIgnored(true);
                        setIgnoreReason(data.gatekeeper.reason || 'AI 判定该文件不属于公平竞争审查范畴。');
                        setSummary(`【无需审查】AI 判定理由：${data.gatekeeper.reason}`);
                    } else {
                        setIsIgnored(false);
                        setSummary(`文件类型：${data.gatekeeper.category}。AI 判定理由：${data.gatekeeper.reason}`);
                    }
                }
            } catch (e) {
                console.error('Failed to parse temp data', e);
                setSummary('数据加载失败，请重试。');
            }
            return;
        }

        if (!id) return;

        fetch(`/api/reviews/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch review');
                return res.json();
            })
            .then(data => {
                if (data.fileName) setFileName(data.fileName);
                setRealReviewId(id);

                let newDocContent: DocParagraph[] = [];
                if (data.html) {
                    newDocContent = [{ id: 'doc_html', type: 'html', html: data.html }];
                } else if (data.text) {
                    newDocContent = parseDocContent(data.text);
                    if (newDocContent.length === 0) {
                        newDocContent = [{ id: 'p0', type: 'text', text: '【提示】由于系统数据库未存储原始文档全文，此处仅展示审查记录摘要。若需查看对应位置，请下载原始文件对照阅读。' }];
                    }
                } else {
                    newDocContent = [{ id: 'p0', type: 'text', text: '【提示】由于系统数据库未存储原始文档全文，此处仅展示审查记录摘要。若需查看对应位置，请下载原始文件对照阅读。' }];
                }
                setDocContent(newDocContent);

                if (data.risks && Array.isArray(data.risks)) {
                    const mappedRisks: RiskItem[] = data.risks.map((item: any, index: number) => {
                        const matchedParaIds = findMatchingParagraphIds(newDocContent, item.location || item.quote);
                        return {
                            id: item.id || `risk_${index}`,
                            paragraphIds: matchedParaIds,
                            type: '历史审查记录',
                            level: normalizeLevel(item.level),
                            title: item.title || '风险点',
                            snippet: item.quote || item.location || '（详细定位需对照原文）',
                            reason: item.description,
                            law: item.law || '《公平竞争审查条例》相关条款',
                            case: item.relatedCase || '暂无数据',
                            suggestion: item.suggestion,
                            defense: item.defense ?? null,
                            rulingReason: item.rulingReason ?? null,
                            confidence: toNumberOrNull(item.confidence),
                        };
                    });
                    setRisks(mappedRisks);
                } else {
                    setRisks([]);
                }

                if (data.gatekeeper) {
                    setDocType(getCategoryLabel(data.gatekeeper.category));
                    const isNotNeeded = data.gatekeeper.category === 'IGNORE' || data.gatekeeper.needs_review === false;
                    if (isNotNeeded) {
                        setIsIgnored(true);
                        setIgnoreReason(data.gatekeeper.reason);
                        setSummary(`【无需审查】${data.gatekeeper.reason}`);
                    } else {
                        setIsIgnored(false);
                        setSummary(data.gatekeeper.reason || '无摘要信息');
                    }
                }
            })
            .catch(err => {
                console.error(err);
                setSummary('加载历史记录失败。');
            });
    }, [id]);

    useEffect(() => {
        if (!activeRiskId) return;
        const risk = risks.find(r => r.id === activeRiskId);
        clearHighlights();
        if (!risk) return;

        if (risk.paragraphIds && risk.paragraphIds.length > 0) {
            const element = document.getElementById(risk.paragraphIds[0]);
            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        if (!risk.snippet) return;
        const htmlContainers = document.querySelectorAll('[data-html-content="true"]');
        if (htmlContainers.length === 0) return;

        let searchText = risk.snippet
            .replace(/^[^：]*：\s*/g, '')
            .replace(/\.\.\./g, ' ')
            .replace(/^"|"$/g, '')
            .trim();

        if (searchText.length < 20 && risk.snippet.length > searchText.length) {
            searchText = risk.snippet.replace(/\.\.\./g, ' ').replace(/^"|"$/g, '').trim();
        }

        if (searchText.length > 500) searchText = searchText.substring(0, 500);
        if (searchText.length <= 5) return;

        let foundMatch = false;
        for (let i = 0; i < htmlContainers.length; i++) {
            if (highlightTextInNode(htmlContainers[i] as HTMLElement, searchText)) {
                foundMatch = true;
                break;
            }
        }

        if (!foundMatch) return;

        const scrollToHighlight = (attempt = 0) => {
            const firstHighlight = document.querySelector('mark.risk-highlight');
            if (firstHighlight) {
                firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (attempt < 5) {
                setTimeout(() => scrollToHighlight(attempt + 1), 100);
            }
        };
        setTimeout(() => scrollToHighlight(), 150);
    }, [activeRiskId, risks]);

    const handleRiskClick = (riskId: string) => {
        setActiveRiskId(riskId);
        setActiveTab('risks');
    };

    const handleExport = async () => {
        try {
            await exportReviewReport(risks, summary, fileName);
        } catch (error) {
            console.error('Export failed:', error);
            alert('导出失败，请重试');
        }
    };

    const searchParams = useSearchParams();
    const backUrl = searchParams.get('backUrl');

    const handleBack = (e: React.MouseEvent) => {
        e.preventDefault();
        if (backUrl) {
            const decodedUrl = decodeURIComponent(backUrl);
            if (decodedUrl.startsWith('/') && !decodedUrl.startsWith('//')) {
                router.push(decodedUrl);
            } else {
                console.warn('Blocked potentially unsafe redirect:', decodedUrl);
                router.push('/dashboard');
            }
        } else {
            router.push('/dashboard');
        }
    };

    const handleComplete = () => {
        if (backUrl) {
            const decodedUrl = decodeURIComponent(backUrl);
            if (decodedUrl.startsWith('/') && !decodedUrl.startsWith('//')) {
                router.push(decodedUrl);
                return;
            }
        }
        router.push('/dashboard');
    };

    const activeRisk = useMemo(() => risks.find(r => r.id === activeRiskId), [risks, activeRiskId]);

    const levelCounts = useMemo(() => {
        const counts = { high: 0, medium: 0, low: 0 } as Record<RiskLevel, number>;
        risks.forEach(r => { counts[r.level] = (counts[r.level] ?? 0) + 1; });
        return counts;
    }, [risks]);

    return (
        <div className={styles.container}>
            <header className={`${styles.header} ${isHeaderCompact ? styles.headerCompact : ''}`}>
                <div className={styles.fileInfo}>
                    <a href="#" onClick={handleBack} className={styles.backLink}>
                        ← 返回{backUrl ? '上一页' : '工作台'}
                    </a>
                    <span className={styles.fileName}>{fileName}</span>
                    {isIgnored ? (
                        <span className={styles.fileTag} style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                            ✅ 无需审查
                        </span>
                    ) : (
                        <span className={styles.fileTag}>{docType}</span>
                    )}
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.actionBtn} onClick={handleExport}>导出报告</button>
                    <button className={`${styles.actionBtn} ${styles.primaryBtn}`} onClick={handleComplete}>完成审查</button>
                </div>
            </header>

            <div className={styles.main}>
                <div className={styles.docPanel} ref={docContainerRef}>
                    <div className={styles.docPaper}>
                        {docContent.length === 0 && <div style={{ padding: '20px', color: '#999' }}>文档内容为空或正在加载...</div>}
                        {docContent.map(para => {
                            const linkedRisks = risks.filter(r => r.paragraphIds && r.paragraphIds.includes(para.id));
                            const hasRisk = linkedRisks.length > 0;
                            const isActive = activeRiskId && activeRisk?.paragraphIds?.includes(para.id);

                            return (
                                <div
                                    key={para.id}
                                    id={para.id}
                                    className={`
                                        ${para.type === 'title' ? styles.docTitle : styles.docParagraph}
                                        ${hasRisk ? styles.highlight : ''}
                                        ${isActive ? styles.highlightActive : ''}
                                    `}
                                    onClick={() => {
                                        if (linkedRisks.length > 0) handleRiskClick(linkedRisks[0].id);
                                    }}
                                >
                                    {para.type === 'html' ? (
                                        <div
                                            className={styles.htmlContent}
                                            data-html-content="true"
                                            dangerouslySetInnerHTML={{ __html: para.html ?? '' }}
                                        />
                                    ) : para.type === 'smart_table' ? (
                                        <div className={styles.markdownTableWrapper}>
                                            <SmartTable rows={para.rows as string[][]} maxCols={para.maxCols} />
                                        </div>
                                    ) : para.type === 'table' ? (
                                        <div className={styles.markdownTableWrapper}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {para.text}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        formatParagraphText(para.text ?? '')
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className={styles.reviewPanel}>
                    <div className={styles.panelTabs}>
                        <div
                            className={`${styles.tab} ${activeTab === 'risks' ? styles.active : ''}`}
                            onClick={() => setActiveTab('risks')}
                        >
                            风险审查 ({risks.length})
                        </div>
                        <div
                            className={`${styles.tab} ${activeTab === 'summary' ? styles.active : ''}`}
                            onClick={() => setActiveTab('summary')}
                        >
                            全文摘要
                        </div>
                    </div>

                    <div className={styles.panelContent}>
                        {activeTab === 'summary' && (
                            <div style={{ padding: '20px', lineHeight: '1.6', color: '#374151' }}>
                                <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '16px' }}>📄 文件核心内容摘要</div>
                                <div style={{ fontSize: '14px', background: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                    {summary}
                                </div>
                                <div style={{ marginTop: '20px', fontSize: '13px', color: '#6b7280' }}>
                                    💡 该摘要由 AI 自动生成，旨在帮助审查员快速了解文件主旨。
                                </div>
                            </div>
                        )}

                        {activeTab === 'risks' && (
                            <>
                                {!activeRiskId && (
                                    <div className={styles.riskList}>
                                        {isIgnored && (
                                            <div style={{
                                                background: '#ecfdf5',
                                                border: '1px solid #a7f3d0',
                                                borderRadius: '12px',
                                                padding: '24px',
                                                marginBottom: '20px',
                                                textAlign: 'center',
                                            }}>
                                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                                                <h3 style={{ margin: '0 0 8px 0', color: '#065f46', fontSize: '18px' }}>此文件无需进行审查</h3>
                                                <p style={{ margin: 0, color: '#047857', lineHeight: 1.5 }}>{ignoreReason}</p>
                                            </div>
                                        )}

                                        {risks.length > 0 && (
                                            <div style={{
                                                display: 'flex',
                                                gap: '8px',
                                                padding: '12px 16px',
                                                background: '#f8fafc',
                                                borderBottom: '1px solid #e2e8f0',
                                                fontSize: '12px',
                                                color: '#475569',
                                            }}>
                                                <span>🔴 高 {levelCounts.high}</span>
                                                <span>🟡 中 {levelCounts.medium}</span>
                                                <span>🔵 低 {levelCounts.low}</span>
                                            </div>
                                        )}

                                        {risks.length === 0 && !isIgnored && (
                                            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                                                未发现明显风险点，或正在分析中...
                                            </div>
                                        )}

                                        {risks.map(risk => (
                                            <div
                                                key={risk.id}
                                                className={styles.riskCard}
                                                onClick={() => handleRiskClick(risk.id)}
                                            >
                                                <div className={styles.cardHeader}>
                                                    <span className={styles.riskLevel}>
                                                        {LEVEL_BADGE[risk.level]?.label ?? LEVEL_BADGE.medium.label}
                                                    </span>
                                                    {typeof risk.confidence === 'number' && (
                                                        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>
                                                            置信度 {risk.confidence}%
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={styles.riskTitle}>{risk.title}</div>
                                                <div className={styles.riskSnippet}>“{risk.snippet}”</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeRisk && (
                                    <RiskDetail
                                        risk={activeRisk}
                                        reviewId={realReviewId}
                                        onBack={() => setActiveRiskId(null)}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
