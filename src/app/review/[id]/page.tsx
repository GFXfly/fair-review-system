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
import kit from '@/components/ui/kit.module.css';
import BrandSeal from '@/components/ui/BrandSeal';
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    CheckIcon,
    ChevronRightIcon,
    DownloadIcon,
    FileTextIcon,
    ScaleLawIcon,
    SearchIcon,
    SparklesIcon,
} from '@/components/ui/Icons';

const LEVEL_ORDER: RiskLevel[] = ['high', 'medium', 'low'];

const LEVEL_META: Record<RiskLevel, { label: string; tone: string; cls: string }> = {
    high: { label: '高风险', tone: kit.toneHigh, cls: styles.levelHigh },
    medium: { label: '疑似风险', tone: kit.toneMid, cls: styles.levelMid },
    low: { label: '低风险', tone: kit.toneLow, cls: styles.levelLow },
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
    // 从详情返回列表时，标记上一次查看的风险卡片（纯视觉态）
    const [lastRiskId, setLastRiskId] = useState<string | null>(null);
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

    // 原始 .docx 高保真还原（docx-preview）。docxAvailable: null=检测中 / true=有原文件用 docx-preview / false=回退 mammoth。
    const docxRef = useRef<HTMLDivElement>(null);
    const docxBlobRef = useRef<Blob | null>(null);
    const naturalMaxWidthRef = useRef<number>(0);
    const [docxAvailable, setDocxAvailable] = useState<boolean | null>(null);
    const [docxReady, setDocxReady] = useState(false);
    const [docxRenderSeq, setDocxRenderSeq] = useState(0);
    const [zoomMode, setZoomMode] = useState<'fit' | 'manual'>('fit');
    const [manualZoom, setManualZoom] = useState(1);
    const [fitZoom, setFitZoom] = useState(1);

    const effectiveZoom = zoomMode === 'fit' ? fitZoom : manualZoom;

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
                setDocxAvailable(false);
                return;
            }
            try {
                const data = JSON.parse(dataStr);

                if (data.fileName) setFileName(data.fileName);
                if (data.id) {
                    setRealReviewId(data.id);
                } else {
                    setDocxAvailable(false);
                }

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
                setDocxAvailable(false);
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
                            internalCaliber: item.internalCaliber ?? null,
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
        if (docxAvailable === null || (docxAvailable === true && !docxReady)) return;

        const risk = risks.find(r => r.id === activeRiskId);
        clearHighlights();
        if (!risk) return;

        if (docxAvailable !== true && risk.paragraphIds && risk.paragraphIds.length > 0) {
            const element = document.getElementById(risk.paragraphIds[0]);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
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
    }, [activeRiskId, risks, docxAvailable, docxReady, docxRenderSeq]);

    // 检测并拉取原始 .docx（旧记录/非docx 会 404 → 回退 mammoth 渲染）
    useEffect(() => {
        if (id === 'temp' && !realReviewId) return;
        const reviewId = realReviewId || (id && id !== 'temp' ? id : null);
        if (!reviewId) {
            setDocxAvailable(false);
            setDocxReady(false);
            return;
        }
        let cancelled = false;
        setDocxAvailable(null);
        setDocxReady(false);
        fetch(`/api/reviews/${reviewId}/file`)
            .then(res => { if (!res.ok) throw new Error('no original file'); return res.blob(); })
            .then(blob => { if (!cancelled) { docxBlobRef.current = blob; setDocxAvailable(true); } })
            .catch(() => {
                if (!cancelled) {
                    setDocxReady(false);
                    setDocxAvailable(false);
                }
            });
        return () => { cancelled = true; };
    }, [realReviewId, id]);

    // 用 docx-preview 渲染原始 docx（动态 import 避免 SSR；失败回退 mammoth）
    useEffect(() => {
        if (docxAvailable !== true || !docxRef.current || !docxBlobRef.current) return;
        let cancelled = false;
        setDocxReady(false);
        naturalMaxWidthRef.current = 0;

        (async () => {
            try {
                const { renderAsync } = await import('docx-preview');
                if (cancelled || !docxRef.current) return;
                docxRef.current.innerHTML = '';
                await renderAsync(docxBlobRef.current!, docxRef.current, undefined, {
                    inWrapper: true,                     // 使用多页纸张包装器
                    ignoreWidth: false,                  // 100% 保留原文档每节真实页宽（支持纵向A4与横向宽表混排！）
                    ignoreHeight: false,                 // 保留原文档真实页高与分页留白
                    ignoreFonts: false,                  // 保留原文档设定的全部字体
                    breakPages: true,                    // 启用真实分页显示
                    renderHeaders: true,                 // 还原页眉（如招标编号、页眉横线）
                    renderFooters: true,                 // 还原页脚与页码
                    renderFootnotes: true,               // 还原脚注
                    renderEndnotes: true,                // 还原尾注
                    ignoreLastRenderedPageBreak: false,  // 尊重 Word 保存的分页断点
                    experimental: true,                  // 启用制表位(tab stops)等精细排版计算
                    useBase64URL: true,                  // 稳定还原文档内嵌图片与签章
                });
                if (cancelled || !docxRef.current) return;

                const sections = docxRef.current.querySelectorAll('section.docx');
                const widths = Array.from(sections)
                    .map(s => (s as HTMLElement).offsetWidth)
                    .filter(w => w > 0);
                const maxPageWidth = widths.length > 0 ? Math.max(...widths) : 794;
                naturalMaxWidthRef.current = maxPageWidth;

                const containerWidth = docContainerRef.current?.clientWidth ?? 0;
                if (containerWidth > 0 && maxPageWidth > 0) {
                    const availableWidth = Math.max(240, containerWidth - 64);
                    const nextFit = Math.min(1, Math.max(0.55, Math.floor((availableWidth / maxPageWidth) * 100) / 100));
                    setFitZoom(nextFit);
                } else {
                    setFitZoom(1);
                }

                setDocxReady(true);
                setDocxRenderSeq(seq => seq + 1);
            } catch (e) {
                console.error('docx-preview 渲染失败，回退 mammoth:', e);
                if (!cancelled) {
                    setDocxReady(false);
                    setDocxAvailable(false);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [docxAvailable]);

    // 监听文档面板尺寸变化，动态重算“适应页宽”缩放比例
    useEffect(() => {
        if (docxAvailable !== true || !docxReady) return;
        const container = docContainerRef.current;
        if (!container || typeof ResizeObserver === 'undefined') return;

        const recalcFitZoom = () => {
            const maxPageWidth = naturalMaxWidthRef.current;
            if (!maxPageWidth || maxPageWidth <= 0) return;
            const availableWidth = Math.max(240, container.clientWidth - 64);
            const nextFit = Math.min(1, Math.max(0.55, Math.floor((availableWidth / maxPageWidth) * 100) / 100));
            setFitZoom(prev => (prev === nextFit ? prev : nextFit));
        };

        recalcFitZoom();
        const observer = new ResizeObserver(recalcFitZoom);
        observer.observe(container);
        return () => observer.disconnect();
    }, [docxAvailable, docxReady]);

    const clampManualZoom = (val: number) => Math.min(1.5, Math.max(0.6, Math.round(val * 10) / 10));

    const handleZoomOut = () => {
        setZoomMode('manual');
        setManualZoom(clampManualZoom(effectiveZoom - 0.1));
    };

    const handleZoomIn = () => {
        setZoomMode('manual');
        setManualZoom(clampManualZoom(effectiveZoom + 0.1));
    };

    const handleZoomReset = () => {
        setZoomMode('manual');
        setManualZoom(1);
    };

    const handleZoomFit = () => {
        setZoomMode('fit');
    };

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

    const statusBadge = isIgnored ? (
        <span className={`${kit.badge} ${kit.toneOk}`}>
            <CheckCircleIcon size={13} />
            无需审查
        </span>
    ) : risks.length > 0 ? (
        <span className={`${kit.badge} ${levelCounts.high > 0 ? kit.toneHigh : kit.toneMid}`}>
            <span className={kit.dot} />
            发现 <span className={styles.badgeNum}>{risks.length}</span> 处风险
        </span>
    ) : null;

    return (
        <div className={styles.container}>
            <header className={`${styles.header} ${isHeaderCompact ? styles.headerCompact : ''}`}>
                <div className={styles.fileInfo}>
                    <a href="#" onClick={handleBack} className={styles.backLink} title={backUrl ? '返回上一页' : '返回工作台'}>
                        <ArrowLeftIcon size={16} />
                        <span>返回{backUrl ? '上一页' : '工作台'}</span>
                    </a>
                    <span className={styles.headerDivider} aria-hidden="true" />
                    <BrandSeal char="审" size={26} variant="outline" className={styles.headerSeal} />
                    <h1 className={styles.fileName} title={fileName}>{fileName}</h1>
                    <div className={styles.headerBadges}>
                        {!isIgnored && (
                            <span className={`${kit.badge} ${kit.toneBrand}`}>
                                <FileTextIcon size={13} />
                                {docType}
                            </span>
                        )}
                        {statusBadge}
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <button className={`${kit.btn} ${kit.btnSecondary} ${kit.btnSm}`} onClick={handleExport}>
                        <DownloadIcon size={15} />
                        <span className={styles.actionLabel}>导出审查意见书（Word）</span>
                    </button>
                    <button className={`${kit.btn} ${kit.btnPrimary} ${kit.btnSm}`} onClick={handleComplete}>
                        <CheckIcon size={15} />
                        完成审查
                    </button>
                </div>
            </header>

            <div className={styles.main}>
                <div className={styles.docPanel} ref={docContainerRef}>
                    {docxAvailable === true && docxReady && (
                        <div className={styles.zoomBarWrap}>
                            <div className={styles.zoomBar} role="toolbar" aria-label="文档页面缩放">
                                <button
                                    type="button"
                                    className={`${styles.zoomBtn} ${zoomMode === 'fit' ? styles.zoomBtnActive : ''}`}
                                    onClick={handleZoomFit}
                                    title="自动适应面板宽度"
                                >
                                    适应页宽
                                </button>
                                <span className={styles.zoomDivider} aria-hidden="true" />
                                <button
                                    type="button"
                                    className={styles.zoomBtn}
                                    onClick={handleZoomOut}
                                    disabled={effectiveZoom <= 0.6}
                                    title="缩小"
                                    aria-label="缩小"
                                >
                                    -
                                </button>
                                <button
                                    type="button"
                                    className={styles.zoomValueBtn}
                                    onClick={handleZoomReset}
                                    title="恢复 100% 原始尺寸"
                                >
                                    {Math.round(effectiveZoom * 100)}%
                                </button>
                                <button
                                    type="button"
                                    className={styles.zoomBtn}
                                    onClick={handleZoomIn}
                                    disabled={effectiveZoom >= 1.5}
                                    title="放大"
                                    aria-label="放大"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    )}

                    {(docxAvailable === null || (docxAvailable === true && !docxReady)) && (
                        <div className={styles.docSkeletonPaper} aria-busy="true" aria-live="polite">
                            <div className={styles.docSkeletonStatus}>
                                <span className={styles.docSkeletonSpinner} aria-hidden="true" />
                                <span>正在还原原文件版式…</span>
                            </div>
                            <div className={styles.docSkeletonTitle} />
                            <div className={styles.docSkeletonLines}>
                                <div className={styles.docSkeletonLine} style={{ width: '92%' }} />
                                <div className={styles.docSkeletonLine} style={{ width: '100%' }} />
                                <div className={styles.docSkeletonLine} style={{ width: '88%' }} />
                                <div className={styles.docSkeletonLine} style={{ width: '96%' }} />
                                <div className={styles.docSkeletonLine} style={{ width: '74%' }} />
                                <div className={styles.docSkeletonLine} style={{ width: '94%', marginTop: '12px' }} />
                                <div className={styles.docSkeletonLine} style={{ width: '100%' }} />
                                <div className={styles.docSkeletonLine} style={{ width: '85%' }} />
                            </div>
                        </div>
                    )}

                    {docxAvailable === true && (
                        <div className={`${styles.docxStage} ${docxReady ? '' : styles.docxStageHidden}`}>
                            <div
                                ref={docxRef}
                                className={styles.docxNative}
                                data-html-content="true"
                                style={{ zoom: docxReady ? effectiveZoom : 1 }}
                            />
                        </div>
                    )}

                    {docxAvailable === false && (
                        <div className={styles.docPaper}>
                            {docContent.length === 0 && (
                                <div className={styles.docEmpty}>
                                    <FileTextIcon size={16} />
                                    文档内容为空或正在加载...
                                </div>
                            )}
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
                    )}
                </div>

                <aside className={styles.reviewPanel}>
                    <div className={styles.panelTabs}>
                        <div className={`${kit.segment} ${styles.panelSegment}`} role="tablist">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab === 'risks'}
                                className={`${kit.segmentItem} ${styles.tab} ${activeTab === 'risks' ? `${kit.segmentActive} ${styles.active}` : ''}`}
                                onClick={() => setActiveTab('risks')}
                            >
                                <ScaleLawIcon size={14} />
                                审查意见
                                <span className={styles.tabCount}>{risks.length}</span>
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab === 'summary'}
                                className={`${kit.segmentItem} ${styles.tab} ${activeTab === 'summary' ? `${kit.segmentActive} ${styles.active}` : ''}`}
                                onClick={() => setActiveTab('summary')}
                            >
                                <FileTextIcon size={14} />
                                全文摘要
                            </button>
                        </div>
                    </div>

                    <div className={styles.panelContent}>
                        {activeTab === 'summary' && (
                            <div className={styles.summaryView}>
                                <div className={styles.summaryHead}>
                                    <span className={kit.cardTitleIcon}><FileTextIcon size={16} /></span>
                                    <h2 className={styles.summaryTitle}>文件核心内容摘要</h2>
                                </div>
                                <div className={styles.summaryBody}>{summary}</div>
                                <div className={styles.summaryNote}>
                                    <SparklesIcon size={14} />
                                    该摘要由 AI 自动生成，旨在帮助审查员快速了解文件主旨。
                                </div>
                            </div>
                        )}

                        {activeTab === 'risks' && (
                            <>
                                {!activeRiskId && (
                                    <div className={styles.riskList}>
                                        {isIgnored && (
                                            <div className={styles.ignoredCard}>
                                                <span className={styles.ignoredIcon}><CheckCircleIcon size={26} /></span>
                                                <h3 className={styles.ignoredTitle}>此文件无需进行审查</h3>
                                                <p className={styles.ignoredReason}>{ignoreReason}</p>
                                            </div>
                                        )}

                                        {risks.length > 0 && (
                                            <div className={styles.statsBar}>
                                                <div className={styles.statsHead}>
                                                    <span className={kit.eyebrow}>风险分级统计</span>
                                                    <span className={styles.statsTotal}>
                                                        共 <span className={styles.statsTotalNum}>{risks.length}</span> 项
                                                    </span>
                                                </div>
                                                <div className={styles.statsPills}>
                                                    {LEVEL_ORDER.map(level => (
                                                        <span
                                                            key={level}
                                                            className={`${kit.badge} ${LEVEL_META[level].tone} ${styles.statPill} ${levelCounts[level] === 0 ? styles.statPillZero : ''}`}
                                                        >
                                                            <span className={kit.dot} />
                                                            {LEVEL_META[level].label}
                                                            <span className={styles.statNum}>{levelCounts[level]}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className={styles.statsTrack} aria-hidden="true">
                                                    {LEVEL_ORDER.map(level => (
                                                        levelCounts[level] > 0 ? (
                                                            <span
                                                                key={level}
                                                                className={`${styles.statsSeg} ${LEVEL_META[level].cls}`}
                                                                style={{ flexGrow: levelCounts[level] }}
                                                            />
                                                        ) : null
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {risks.length === 0 && !isIgnored && (
                                            <div className={kit.empty}>
                                                <span className={kit.emptyIcon}><SearchIcon size={22} /></span>
                                                <div className={kit.emptyTitle}>未发现明显风险点，或正在分析中...</div>
                                            </div>
                                        )}

                                        {risks.map((risk, index) => {
                                            const meta = LEVEL_META[risk.level] ?? LEVEL_META.medium;
                                            return (
                                                <div
                                                    key={risk.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    className={`${styles.riskCard} ${meta.cls} ${lastRiskId === risk.id ? styles.riskCardActive : ''}`}
                                                    onClick={() => handleRiskClick(risk.id)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            handleRiskClick(risk.id);
                                                        }
                                                    }}
                                                >
                                                    <div className={styles.cardHeader}>
                                                        <span className={`${kit.badge} ${meta.tone}`}>
                                                            <span className={kit.dot} />
                                                            {meta.label}
                                                        </span>
                                                        {typeof risk.confidence === 'number' && (
                                                            <span className={styles.confidence}>
                                                                置信度 <span className={styles.confidenceNum}>{risk.confidence}%</span>
                                                            </span>
                                                        )}
                                                        <span className={styles.cardIndex}>{String(index + 1).padStart(2, '0')}</span>
                                                    </div>
                                                    <div className={styles.riskTitle}>{risk.title}</div>
                                                    <blockquote className={styles.riskSnippet}>{risk.snippet}</blockquote>
                                                    <div className={styles.cardFoot}>
                                                        <span>查看审查意见</span>
                                                        <ChevronRightIcon size={14} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {activeRisk && (
                                    <RiskDetail
                                        risk={activeRisk}
                                        reviewId={realReviewId}
                                        onBack={() => { clearHighlights(); setLastRiskId(activeRiskId); setActiveRiskId(null); }}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}
