'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import RiskFeedback from '@/components/RiskFeedback';

// --- Mock Data ---

const MOCK_DOC_CONTENT = [
    { id: 'p1', type: 'title', text: '关于扶持直播电商发展的若干意见' },
    { id: 'p2', type: 'text', text: '为进一步促进我区直播电商产业发展，优化营商环境，根据国家和省市有关规定，结合我区实际，制定本意见。' },
    { id: 'p3', type: 'text', text: '一、支持对象' },
    { id: 'p4', type: 'text', text: '本意见适用于在我区注册登记、纳税，并具有独立法人资格的直播电商企业、MCN机构及相关服务机构。' },
    { id: 'p5', type: 'text', text: '二、扶持政策' },
    { id: 'p6', type: 'text', text: '（一）鼓励企业做大做强。对年直播带货销售额首次突破1亿元、5亿元、10亿元的企业，分别给予50万元、100万元、200万元的一次性奖励。' },
    { id: 'p7', type: 'text', text: '（二）指定服务机构。为规范行业发展，指定区电子商务协会为全区直播电商唯一官方合作认证机构，负责全区直播电商企业的资质认证与培训工作。所有申请本政策扶持资金的企业，须先通过该协会的资质认证。' },
    { id: 'p8', type: 'text', text: '（三）优先采购产品。在政府采购活动中，同等条件下优先采购本区直播电商企业推荐的本地产品，支持本地企业拓展市场。' },
    { id: 'p9', type: 'text', text: '三、附则' },
    { id: 'p10', type: 'text', text: '本意见自发布之日起施行，有效期三年。' },
];

const MOCK_RISKS = [
    {
        id: 'r1',
        paragraphId: 'p7',
        type: '市场准入与退出',
        level: 'high',
        title: '指定特定服务机构',
        snippet: '指定区电子商务协会为全区直播电商唯一官方合作认证机构...',
        reason: '该条款指定了特定的社会组织（区电子商务协会）作为唯一认证机构，并将其作为申请补贴的前置条件，排除了其他潜在的合格服务提供商，涉嫌限定交易。',
        law: '《公平竞争审查条例》第十条：起草单位起草的政策措施，不得含有下列限制或者排斥竞争的内容：...（二）限定经营、购买、使用特定经营者提供的商品和服务。',
        case: '【案例】某市住建局发文要求所有建筑企业必须在指定协会办理诚信档案，被省市场监管局通报整改。',
        suggestion: '建议删除“指定...为唯一...”及“须先通过该协会资质认证”的表述。如确需认证，应通过公开招标方式选择服务机构，或承认第三方具备资质机构的认证结果。'
    },
    {
        id: 'r2',
        paragraphId: 'p8',
        type: '商品要素自由流动',
        level: 'medium',
        title: '优先采购本地产品',
        snippet: '同等条件下优先采购本区直播电商企业推荐的本地产品...',
        reason: '在政府采购中明确提出“优先采购本地产品”，构成了对通过本地企业销售的产品的优待，实际上是对外地产品或非本地企业推荐产品的歧视，阻碍了商品自由流通。',
        law: '《公平竞争审查条例》第十一条：...（一）对外地和进口商品、服务实行歧视性价格或者补贴政策；（三）排斥或者限制外地经营者参加本地招标投标活动。',
        case: '【案例】某县在学校食堂原材料采购招标中，设置“本地农业龙头企业加分”条款，被认定为排斥外地经营者。',
        suggestion: '建议删除“优先采购...本地产品”条款，或修改为“鼓励采购符合标准的优质产品”，不得限定产地或来源。'
    }
];

// --- Components ---

const formatParagraphText = (text: string) => {
    // Regex to match "第X条", "1.", "2.", "（一）", "一、" at start of line
    const regex = /^((?:第[0-9零一二三四五六七八九十百千万]+条)|(?:[0-9]+\.)|(?:（[0-9零一二三四五六七八九十]+）)|(?:[一二三四五六七八九十]+、))/;
    const match = text.match(regex);

    if (match) {
        const titlePart = match[1];
        const restPart = text.substring(titlePart.length);
        return (
            <>
                <strong style={{ fontWeight: 600 }}>{titlePart}</strong>{restPart}
            </>
        );
    }
    return text;
};

// Map category to Chinese document type label
const getCategoryLabel = (category: string): string => {
    const categoryMap: Record<string, string> = {
        'BIDDING': '招标文件',
        'SUBSIDY': '补贴政策',
        'MARKET_ACCESS': '市场准入文件',
        'INDUSTRIAL': '产业扶持政策',
        'SPECIAL_FUND': '专项资金文件',
        'IGNORE': '非政策文件',
        'POLICY': '政策文件',
    };
    return categoryMap[category] || '政策文件';
};

export default function ReviewPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [activeRiskId, setActiveRiskId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'risks' | 'summary'>('risks');
    const [isHeaderCompact, setIsHeaderCompact] = useState(false);
    const [isIgnored, setIsIgnored] = useState(false);
    const [ignoreReason, setIgnoreReason] = useState("");
    const [docType, setDocType] = useState("政策文件"); // Default: 政策文件

    // Initialize state based on ID
    // If 'temp', start empty to wait for sessionStorage. If not, use Mock.
    // Initialize state
    // We start with empty/loading state.
    const [docContent, setDocContent] = useState<any[]>([]);
    const [risks, setRisks] = useState<any[]>([]);
    const [summary, setSummary] = useState("正在加载分析结果...");
    const [fileName, setFileName] = useState("正在加载...");
    const [realReviewId, setRealReviewId] = useState<string | null>(null); // 存储真实的数据库ID

    const docContainerRef = useRef<HTMLDivElement>(null);

    // Compact header when user scrolls down the document to free vertical space.
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

    // Helper to find matching paragraphs with fuzzy matching (returns array of IDs)
    const findMatchingParagraphIds = (paragraphs: any[], snippet: string): string[] => {
        if (!snippet || !paragraphs || paragraphs.length === 0) return [];

        // 1. Aggressive Normalization
        const normalize = (str: string) => str.replace(/[\s\u3000,.，。、；;：:!！?？"“”‘’'()[\]【】\-_]/g, '').toLowerCase();

        // 2. Split snippet into significant chunks
        let parts = [snippet];
        if (snippet.includes('...') || snippet.includes('…') || snippet.includes('\n')) {
            parts = snippet.split(/[….\n]+/).filter(s => {
                const normalized = normalize(s);
                return normalized.length > 3; // Chunk must have some substance (raw length might be spaces, check normalized length?)
                // Better: check normalized length > 3 to avoid matching "1." or "of"
            });
        }

        // Filter out empty parts after verification
        const significantParts = parts.filter(p => normalize(p).length > 3);

        // If no significant parts, try matching the whole thing if it's short but distinct?
        // Or just fallback to the whole normal string matched
        if (significantParts.length === 0) {
            const normSnippet = normalize(snippet);
            if (normSnippet.length > 2) {
                significantParts.push(snippet);
            } else {
                return [];
            }
        }

        const matchedIds = new Set<string>();

        // 3. Check each paragraph for ANY of the significant parts
        // This supports cases where a quote spans multiple paragraphs (e.g. Header + Body)
        for (const para of paragraphs) {
            // "smart_table" paragraphs store content in rows arrays, not 'text' field directly
            let paraText = para.text || '';
            if (para.type === 'smart_table' && para.rows) {
                // Flatten table content for matching
                paraText = para.rows.map((r: string[]) => r.join('')).join('');
            }

            const normPara = normalize(paraText);

            for (const part of significantParts) {
                const normPart = normalize(part);
                if (normPara.includes(normPart)) {
                    matchedIds.add(para.id);
                    // Don't break; a paragraph might contain multiple parts, but we just need to add it once.
                    // Also we want to find OTHER paragraphs that match OTHER parts.
                }
            }
        }

        return Array.from(matchedIds);
    };

    // Helper to parse content into paragraphs and robust tables
    const parseDocContent = (text: string) => {
        if (!text) return [];
        const lines = text.split('\n');
        const newContent: any[] = [];
        let pCounter = 0;

        // Smart Table Detection State Machine
        let currentTableBuffer: string[] = [];
        let inTable = false;

        const flushTable = () => {
            if (currentTableBuffer.length > 0) {
                // Determine max columns to normalize grid
                let maxCols = 0;

                // Advanced Row Merging Strategy
                // Goal: Fix fragmented rows like "Technique\nAdvance" becoming 2 rows instead of 1 cell
                // or "Input | 20" becoming 2 rows.

                // 1. Initial Clean: remove garbage lines
                let rowsRaw = currentTableBuffer.filter(rowStr => rowStr.replace(/[|\s]/g, '').length > 0);

                // 2. Normalize Pipes: ensure every row string handles pipes consistently
                // We trust explicit pipes '|' as delimiters.
                // If a line HAS NO pipes, but we are in a table, it is likely a cell continuation OR a fragmented cell.

                const finalRows: string[][] = [];

                rowsRaw.forEach(rowStr => {
                    // Normalize: Remove outer pipes
                    const content = rowStr.trim().replace(/^\||\|$/g, '');

                    // Split by pipe
                    // Note: If explicit pipes exist, use them. 
                    // If NOT, we need to decide if this is a new row or part of previous.

                    if (rowStr.includes('|')) {
                        // Explicit structure found
                        const cells = content.split('|').map(c => c.trim());
                        if (cells.length > maxCols) maxCols = cells.length;
                        finalRows.push(cells);
                    } else {
                        // No pipes. This is the tricky case (Fragments).
                        // Case A: It's a text continuation of the previous cell (e.g. "10\n万元")
                        // Case B: It's a next cell value that lost its pipe (e.g. "20" following "Item Input")

                        if (finalRows.length > 0) {
                            const lastRow = finalRows[finalRows.length - 1];

                            // Heuristic: If the last row is "short" (fewer cols than maxCols detected so far),
                            // maybe this line is the Next Cell?
                            if (lastRow.length < maxCols) {
                                lastRow.push(rowStr.trim());
                            } else {
                                // Otherwise, append to the LAST cell of last row (Text Wrap)
                                lastRow[lastRow.length - 1] += rowStr.trim();
                            }
                        } else {
                            // Orphan text at start of table? Treat as single cell row
                            finalRows.push([rowStr.trim()]);
                        }
                    }
                });

                if (finalRows.length > 0) {
                    newContent.push({
                        id: `p_${pCounter++}`,
                        type: 'smart_table',
                        rows: finalRows,
                        maxCols: maxCols || 1
                    });
                }
                currentTableBuffer = [];
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trimEnd();
            const trimmedLine = line.trim();
            const hasPipe = trimmedLine.includes('|');

            // Heuristic for Table Start/Continuance
            // 1. Line has Pipe -> Definitely Table
            // 2. Line has NO Pipe, but we are InTable?
            //    -> Check if it looks like a Section Header (Long text, no numbers/short phrases).
            //    -> If Section Header, BREAK Table.

            if (hasPipe) {
                if (!inTable) inTable = true;
                currentTableBuffer.push(trimmedLine);
            } else if (inTable) {
                // We are in table, but line has no pipe.
                // Is this a Table Exit signal?

                // Signal 1: Empty Line -> Exit
                if (trimmedLine.length === 0) {
                    flushTable();
                    inTable = false;
                }
                // Signal 2: Long continuous text (likely a title or paragraph, e.g. "附件2...")
                // Heuristic: Length > 20 chars usually means it's not a fragmented table cell value
                else if (trimmedLine.length > 30) {
                    flushTable();
                    inTable = false;
                    // Push this line as normal text
                    newContent.push({
                        id: `p_${pCounter++}`,
                        type: 'text',
                        text: line
                    });
                }
                // Signal 3: It looks like a short value ("20", "10%", "Project Input") -> Keep in table
                else {
                    currentTableBuffer.push(trimmedLine);
                }
            } else {
                // Not in table, not a pipe line. Normal text.
                if (trimmedLine.length > 0) {
                    newContent.push({
                        id: `p_${pCounter++}`,
                        type: (i === 0 && pCounter === 1) ? 'title' : 'text',
                        text: line
                    });
                }
            }
        }
        // Flush remaining
        if (inTable) flushTable();

        return newContent;
    };

    // Load data from sessionStorage if id is 'temp'
    useEffect(() => {
        if (id === 'temp') {
            const dataStr = sessionStorage.getItem('temp_review_data');
            if (dataStr) {
                try {
                    const data = JSON.parse(dataStr);

                    if (data.fileName) {
                        setFileName(data.fileName);
                    }

                    // 保存真实的数据库ID
                    if (data.id) {
                        setRealReviewId(data.id);
                    }

                    // 1. Set Document Content
                    let newDocContent: any[] = [];

                    // Prefer HTML rendering if available (preserves table structure perfectly)
                    if (data.html) {
                        newDocContent = [{
                            id: 'doc_html',
                            type: 'html',
                            html: data.html
                        }];
                        setDocContent(newDocContent);
                    } else if (data.text) {
                        // Fallback to text parsing for backwards compatibility
                        newDocContent = parseDocContent(data.text);
                        setDocContent(newDocContent);
                    } else {
                        setDocContent([{ id: 'p0', type: 'text', text: '无法读取文件内容或内容为空。' }]);
                    }

                    // 2. Map Risks
                    if (data.auditor && Array.isArray(data.auditor)) {
                        const mappedRisks = data.auditor.map((item: any, index: number) => {
                            // For HTML mode, we'll use text matching instead of paragraph IDs
                            const snippet = item.location || '（无定位）';

                            return {
                                id: item.id || `risk_${index}`,
                                snippet: snippet,
                                type: '合规风险',
                                level: item.risk_level === 'High' ? 'high' : 'medium',
                                title: item.description ? (item.description.substring(0, 15) + '...') : '风险点',
                                reason: item.description,
                                law: item.violated_law || '《公平竞争审查条例》相关条款（AI未明确引用）',
                                case: item.reference || '暂无相似案例匹配',
                                suggestion: item.suggestion
                            };
                        });
                        setRisks(mappedRisks);
                    } else {
                        setRisks([]);
                    }

                    // 3. Set Summary and Document Type
                    if (data.gatekeeper) {
                        // Set document type label based on category
                        setDocType(getCategoryLabel(data.gatekeeper.category));

                        const isNotNeeded = data.gatekeeper.category === 'IGNORE' || data.gatekeeper.needs_review === false;
                        if (isNotNeeded) {
                            setIsIgnored(true);
                            setIgnoreReason(data.gatekeeper.reason || "AI 判定该文件不属于公平竞争审查范畴。");
                            setSummary(`【無需审查】AI 判定理由：${data.gatekeeper.reason}`);
                        } else {
                            setIsIgnored(false);
                            setSummary(`文件类型：${data.gatekeeper.category}。AI 判定理由：${data.gatekeeper.reason}`);
                        }
                    }

                } catch (e) {
                    console.error('Failed to parse temp data', e);
                    setSummary("数据加载失败，请重试。");
                }
            } else {
                setSummary("未找到审查数据，请重新上传文件。");
            }
        } else if (id) {
            // Load from Database via API
            fetch(`/api/reviews/${id}`)
                .then(res => {
                    if (!res.ok) throw new Error('Failed to fetch review');
                    return res.json();
                })
                .then(data => {
                    if (data.fileName) setFileName(data.fileName);

                    // 设置真实的reviewId（对于从数据库加载的记录，就是id本身）
                    setRealReviewId(id);

                    let newDocContent: any[] = [];
                    if (data.text) {
                        newDocContent = parseDocContent(data.text);
                        if (newDocContent.length > 0) {
                            setDocContent(newDocContent);
                        } else {
                            setDocContent([{ id: 'p0', type: 'text', text: '【提示】由于系统数据库未存储原始文档全文，此处仅展示审查记录摘要。若需查看对应位置，请下载原始文件对照阅读。' }]);
                            newDocContent = [{ id: 'p0', type: 'text', text: '【提示】由于系统数据库未存储原始文档全文，此处仅展示审查记录摘要。若需查看对应位置，请下载原始文件对照阅读。' }];
                        }
                    } else {
                        setDocContent([{ id: 'p0', type: 'text', text: '【提示】由于系统数据库未存储原始文档全文，此处仅展示审查记录摘要。若需查看对应位置，请下载原始文件对照阅读。' }]);
                        newDocContent = [{ id: 'p0', type: 'text', text: '【提示】由于系统数据库未存储原始文档全文，此处仅展示审查记录摘要。若需查看对应位置，请下载原始文件对照阅读。' }];
                    }

                    if (data.risks && Array.isArray(data.risks)) {
                        const mappedRisks = data.risks.map((item: any, index: number) => {
                            const matchedParaIds = findMatchingParagraphIds(newDocContent, item.location || item.quote);

                            return {
                                id: item.id || `risk_${index}`,
                                paragraphIds: matchedParaIds, // Array
                                type: '历史审查记录',
                                level: item.level === 'High' ? 'high' : 'medium',
                                title: item.title || '风险点',
                                snippet: item.quote || item.location || '（详细定位需对照原文）',
                                reason: item.description,
                                law: item.law || '《公平竞争审查条例》相关条款',
                                case: item.relatedCase || '暂无数据',
                                suggestion: item.suggestion
                            };
                        });
                        setRisks(mappedRisks);
                    } else {
                        setRisks([]);
                    }

                    if (data.gatekeeper) {
                        // Set document type label
                        setDocType(getCategoryLabel(data.gatekeeper.category));

                        const isNotNeeded = data.gatekeeper.category === 'IGNORE' || data.gatekeeper.needs_review === false;
                        if (isNotNeeded) {
                            setIsIgnored(true);
                            setIgnoreReason(data.gatekeeper.reason);
                            setSummary(`【无需审查】${data.gatekeeper.reason}`);
                        } else {
                            setIsIgnored(false);
                            setSummary(data.gatekeeper.reason || "无摘要信息");
                        }
                    }

                })
                .catch(err => {
                    console.error(err);
                    setSummary("加载历史记录失败。");
                });
        }
    }, [id]);

    // Highlight text when risk is selected (works for both paragraph and HTML modes)
    useEffect(() => {
        if (activeRiskId) {
            const risk = risks.find(r => r.id === activeRiskId);

            // Clear previous highlights
            // Clear previous highlights safely
            document.querySelectorAll('mark.risk-highlight').forEach(mark => {
                const parent = mark.parentNode;
                if (parent) {
                    // Move all children out of the mark tag before removing it
                    while (mark.firstChild) {
                        parent.insertBefore(mark.firstChild, mark);
                    }
                    parent.removeChild(mark);
                    parent.normalize();
                }
            });

            if (risk) {
                console.log('[Risk Click] Risk object:', {
                    id: risk.id,
                    hasSnippet: !!risk.snippet,
                    snippetLength: risk.snippet?.length || 0,
                    hasParagraphIds: !!risk.paragraphIds,
                    snippet: risk.snippet?.substring(0, 100)
                });

                // For paragraph mode (old)
                if (risk.paragraphIds && risk.paragraphIds.length > 0) {
                    const element = document.getElementById(risk.paragraphIds[0]);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
                else if (risk.snippet) {
                    const htmlContainers = document.querySelectorAll('[data-html-content="true"]');

                    console.log(`[Risk Click] HTML containers found: ${htmlContainers.length}`);

                    if (htmlContainers.length > 0) {
                        console.log(`[Risk Click] Searching in ${htmlContainers.length} HTML containers`);

                        // Extract meaningful text from snippet
                        // Remove chapter/section titles (e.g., "第二部分投标人须知前附表第13条：")
                        let searchText = risk.snippet
                            .replace(/^[^：]*：\s*/g, '')  // Remove "XXX: " prefix
                            .replace(/\.\.\./g, ' ')
                            .replace(/^"|"$/g, '')
                            .trim();

                        // If the cleaned text is too short, try using the original
                        if (searchText.length < 20 && risk.snippet.length > searchText.length) {
                            console.log('[Risk Click] Cleaned text too short, using original snippet');
                            searchText = risk.snippet.replace(/\.\.\./g, ' ').replace(/^"|"$/g, '').trim();
                        }

                        // Increase truncation limit to 500 for better matching
                        if (searchText.length > 500) {
                            searchText = searchText.substring(0, 500);
                        }

                        console.log('[Risk Click] Searching for:', searchText.substring(0, 100) + '...');

                        if (searchText.length > 5) {
                            // Try highlighting in each container until one succeeds
                            let foundMatch = false;
                            for (let i = 0; i < htmlContainers.length; i++) {
                                if (highlightTextInNode(htmlContainers[i] as HTMLElement, searchText)) {
                                    foundMatch = true;
                                    break;
                                }
                            }

                            if (foundMatch) {
                                // Scroll to first highlight with retry
                                const scrollToHighlight = (attempt = 0) => {
                                    const firstHighlight = document.querySelector('mark.risk-highlight');
                                    if (firstHighlight) {
                                        console.log('[Risk Click] Scrolling to highlight, attempt:', attempt);
                                        firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    } else if (attempt < 5) {
                                        setTimeout(() => scrollToHighlight(attempt + 1), 100);
                                    }
                                };
                                setTimeout(() => scrollToHighlight(), 150);
                            } else {
                                console.warn('[Risk Click] All containers searched, no match found');
                                console.warn('[Risk Click] Search text was:', searchText.substring(0, 200));
                            }
                        } else {
                            console.warn('[Risk Click] Search text too short:', searchText);
                        }
                    } else {
                        console.warn('[Risk Click] No HTML containers found');
                        console.warn('[Risk Click] Available elements:', document.querySelectorAll('[data-html-content]').length);
                    }
                } else {
                    console.warn('[Risk Click] No snippet or paragraphIds available for highlighting');
                }
            }
        }
    }, [activeRiskId, risks]);


    // Enhanced multi-strategy text highlighting function
    const highlightTextInNode = (container: HTMLElement, searchText: string): boolean => {
        if (!searchText || searchText.length < 5) return false;

        console.log('[Highlight] === Starting search in container ===');

        // Helper: normalize text
        const normalize = (text: string) => {
            return text
                .replace(/[\s\u3000]/g, '')
                .replace(/[,，.。、;；:：!！?？""''「」『』（）()[\]【】《》<>«»]/g, '')
                .toLowerCase();
        };

        const fullText = container.textContent || '';
        const normalizedFull = normalize(fullText);
        const normalizedSearch = normalize(searchText);

        // Strategy 2: Exact normalized match
        if (normalizedFull.indexOf(normalizedSearch) !== -1) {
            console.log('[Highlight] ✓ Strategy 2: Exact normalized match');
            highlightByNormalizedMatch(container, searchText, normalizedSearch);
            return true;
        }

        // Strategy 3: Sliding window segments
        // Be more permissive with punctuation and length
        const segments = searchText.split(/[,，.。、；;：:!！?？\n\r|｜]/).map(s => s.trim()).filter(s => s.length >= 6);
        console.log(`[Highlight] Strategy 3: Trying ${segments.length} segments`);

        for (const segment of segments) {
            const normalizedSegment = normalize(segment);
            if (normalizedSegment.length >= 6 && normalizedFull.indexOf(normalizedSegment) !== -1) {
                console.log('[Highlight] ✓ Strategy 3: Found segment match:', segment.substring(0, 20));
                highlightByNormalizedMatch(container, segment, normalizedSegment);
                return true;
            }
        }

        // Strategy 4: Prefix matching with backoff
        for (let len = Math.min(searchText.length, 120); len >= 15; len -= 5) {
            const prefix = searchText.substring(0, len);
            const normalizedPrefix = normalize(prefix);
            if (normalizedPrefix.length >= 10 && normalizedFull.indexOf(normalizedPrefix) !== -1) {
                console.log('[Highlight] ✓ Strategy 4: Found prefix match of length:', len);
                highlightByNormalizedMatch(container, prefix, normalizedPrefix);
                return true;
            }
        }

        return false;
    };

    // Helper function to highlight by normalized matching (Robust version)
    const highlightByNormalizedMatch = (container: HTMLElement, originalText: string, normalizedSearch: string) => {
        const textNodes: Text[] = [];
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode as Text);
        }

        // 1. Build a map of normalized character index -> (original node, offset)
        let normalizedFullText = '';
        const charMap: Array<{ node: Text; offset: number }> = [];

        textNodes.forEach(node => {
            const text = node.textContent || '';
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                // Check if this character would be preserved by our normalization
                const isPreserved = !/[\s\u3000]/.test(char) && !/[,，.。、;；:：!！?？""''「」『』（）()[\]【】《》<>]/.test(char);
                if (isPreserved) {
                    charMap.push({ node, offset: i });
                    normalizedFullText += char.toLowerCase();
                }
            }
        });

        // 2. Find the match in the normalized text
        const matchIndex = normalizedFullText.indexOf(normalizedSearch.toLowerCase());
        if (matchIndex === -1) {
            console.warn('[Highlight] Precise normalized match failed');
            return;
        }

        // 3. Identify all nodes and their ranges involved in the match
        const startEntry = charMap[matchIndex];
        const endEntry = charMap[matchIndex + normalizedSearch.length - 1];

        if (!startEntry || !endEntry) return;

        // Find all nodes between start node and end node in textNodes array
        const startIndex = textNodes.indexOf(startEntry.node);
        const endIndex = textNodes.indexOf(endEntry.node);

        if (startIndex === -1 || endIndex === -1) return;

        // Highlight affected nodes
        for (let i = startIndex; i <= endIndex; i++) {
            const node = textNodes[i];
            const parent = node.parentNode;
            if (!parent) continue;

            const mark = document.createElement('mark');
            mark.className = 'risk-highlight';
            mark.style.backgroundColor = 'rgba(252, 165, 165, 0.7)';
            mark.style.padding = '3px 0'; // Vertical padding only to avoid layout shifts
            mark.style.borderRadius = '2px';
            mark.style.fontWeight = '500';

            // Wrap the whole node content for simplicity in this loop
            // In a truly precise version, we'd split the start and end nodes
            // but wrapping involved nodes is usually sufficient for visual feedback.
            parent.replaceChild(mark, node);
            mark.appendChild(node);
        }

        console.log('[Highlight] ✓ Multi-node highlight applied successfully');
    };

    const handleRiskClick = (riskId: string) => {
        setActiveRiskId(riskId);
        setActiveTab('risks');
    };

    const handleExport = async () => {
        try {
            const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = await import("docx");

            // Define borders for the table
            const tableBorders = {
                top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            };

            // Create Risk Rows
            const riskRows = risks.flatMap((risk, index) => [
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: `${index + 1}` })], alignment: AlignmentType.CENTER })],
                            width: { size: 5, type: WidthType.PERCENTAGE },
                            verticalAlign: "center",
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: risk.type })], alignment: AlignmentType.CENTER })],
                            width: { size: 15, type: WidthType.PERCENTAGE },
                            verticalAlign: "center",
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({ children: [new TextRun({ text: risk.title, bold: true })] }),
                                new Paragraph({ children: [new TextRun({ text: `风险等级: ${risk.level === 'high' ? '高' : '中'}`, color: risk.level === 'high' ? "FF0000" : "FFA500" })] }),
                            ],
                            width: { size: 25, type: WidthType.PERCENTAGE },
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({ children: [new TextRun({ text: "【问题描述】", bold: true })] }),
                                new Paragraph({ text: risk.reason }),
                                new Paragraph({ text: "" }),
                                new Paragraph({ children: [new TextRun({ text: "【修改建议】", bold: true })] }),
                                new Paragraph({ text: risk.suggestion || "无" }),
                            ],
                            width: { size: 55, type: WidthType.PERCENTAGE },
                        }),
                    ],
                }),
            ]);

            // Header Row
            const headerRow = new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "序号", bold: true })], alignment: AlignmentType.CENTER })], width: { size: 5, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "风险类型", bold: true })], alignment: AlignmentType.CENTER })], width: { size: 15, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "风险摘要", bold: true })], alignment: AlignmentType.CENTER })], width: { size: 25, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "详细说明与建议", bold: true })], alignment: AlignmentType.CENTER })], width: { size: 55, type: WidthType.PERCENTAGE } }),
                ],
                tableHeader: true,
            });

            const doc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        new Paragraph({
                            text: "公平竞争审查意见书",
                            heading: HeadingLevel.TITLE,
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 400 },
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({ text: "文件名称：", bold: true }),
                                new TextRun(fileName),
                            ],
                            spacing: { after: 100 },
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({ text: "审查日期：", bold: true }),
                                new TextRun(new Date().toLocaleDateString()),
                            ],
                            spacing: { after: 400 },
                        }),

                        // 1. Conclusion
                        new Paragraph({
                            text: "一、审查结论",
                            heading: HeadingLevel.HEADING_1,
                            spacing: { before: 200, after: 200 },
                        }),
                        new Paragraph({
                            text: risks.length === 0
                                ? "经审查，该文件未发现违反《公平竞争审查条例》的相关内容，符合公平竞争要求。"
                                : `经审查，该文件存在 ${risks.length} 处涉嫌违反《公平竞争审查条例》的风险点，建议修改后发布。`,
                            spacing: { after: 400 },
                        }),

                        // 2. Summary
                        new Paragraph({
                            text: "二、文件摘要",
                            heading: HeadingLevel.HEADING_1,
                            spacing: { before: 200, after: 200 },
                        }),
                        new Paragraph({
                            text: summary,
                            spacing: { after: 400 },
                        }),

                        // 3. Risks Table
                        new Paragraph({
                            text: "三、风险点详细分析",
                            heading: HeadingLevel.HEADING_1,
                            spacing: { before: 200, after: 200 },
                        }),
                        risks.length > 0 ? new Table({
                            rows: [headerRow, ...riskRows],
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            borders: tableBorders,
                        }) : new Paragraph({ text: "无风险点。" }),

                        // 4. Signatures
                        new Paragraph({
                            text: "",
                            spacing: { before: 800 },
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({ text: "审查单位（盖章）：__________________" }),
                            ],
                            alignment: AlignmentType.RIGHT,
                            spacing: { after: 200 },
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({ text: "审查人签字：__________________" }),
                            ],
                            alignment: AlignmentType.RIGHT,
                            spacing: { after: 200 },
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({ text: "日期：______年____月____日" }),
                            ],
                            alignment: AlignmentType.RIGHT,
                        }),
                    ],
                }],
            });

            const blob = await Packer.toBlob(doc);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${fileName.replace(/\.[^/.]+$/, "")}_审查意见书.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export failed:", error);
            alert("导出失败，请重试");
        }
    };

    const searchParams = useSearchParams();
    const backUrl = searchParams.get('backUrl');

    const handleBack = (e: React.MouseEvent) => {
        e.preventDefault();
        if (backUrl) {
            const decodedUrl = decodeURIComponent(backUrl);
            // Only allow relative paths (starting with /) to prevent open redirect
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

    const activeRisk = risks.find(r => r.id === activeRiskId);

    return (
        <div className={styles.container}>
            {/* Header ... */}
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

            {/* Main Split View */}
            <div className={styles.main}>

                {/* Left: Document Viewer */}
                <div className={styles.docPanel} ref={docContainerRef}>
                    <div className={styles.docPaper}>
                        {docContent.length === 0 && <div style={{ padding: '20px', color: '#999' }}>文档内容为空或正在加载...</div>}
                        {docContent.map(para => {
                            // Check if this paragraph is involved in ANY risk
                            // A paragraph might be linked to multiple risks, find the first or all?
                            // Logic: If activeRiskId is set, highlight only if it belongs to activeRiskId.
                            // If NO activeRiskId is set, highlight if it belongs to ANY risk? No, usually we just indicate it's risky.
                            // Current design: Highligh all risky paragraphs slightly? NO, previous logic was:
                            // const risk = risks.find(r => r.paragraphId === para.id);

                            // New logic:
                            // Find risks linked to this paragraph
                            const linkedRisks = risks.filter(r => r.paragraphIds && r.paragraphIds.includes(para.id));
                            const hasRisk = linkedRisks.length > 0;

                            // Check if it belongs to the *active* risk
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
                                        if (linkedRisks.length > 0) {
                                            // Activating the first risk associated with this paragraph
                                            // Or toggle?
                                            handleRiskClick(linkedRisks[0].id);
                                        }
                                    }}
                                >
                                    {para.type === 'html' ? (
                                        // Direct HTML rendering - preserves all table structure
                                        <div
                                            className={styles.htmlContent}
                                            data-html-content="true"
                                            dangerouslySetInnerHTML={{ __html: para.html }}
                                        />
                                    ) : para.type === 'smart_table' ? (
                                        <div className={styles.markdownTableWrapper}>
                                            <table>
                                                {(() => {
                                                    // Smart rowspan detection and rendering
                                                    const rows = para.rows as string[][];
                                                    const maxCols = para.maxCols || Math.max(...rows.map(r => r.length));

                                                    // Normalize rows: ensure all rows have same length
                                                    const normalizedRows = rows.map(row => {
                                                        if (row.length === 1 && rows.length > 1) {
                                                            // Single cell row - likely a section header, span all columns
                                                            return [{ content: row[0], colSpan: maxCols, rowSpan: 1, skip: false }];
                                                        }
                                                        // Pad row to maxCols
                                                        const padded = [...row];
                                                        while (padded.length < maxCols) padded.push('');
                                                        return padded.map(content => ({ content, colSpan: 1, rowSpan: 1, skip: false }));
                                                    });

                                                    // Detect and mark rowspan cells
                                                    // For each column, find consecutive duplicate cells and merge them
                                                    for (let col = 0; col < maxCols; col++) {
                                                        let currentRunStart = 0;

                                                        for (let row = 0; row < normalizedRows.length; row++) {
                                                            const currentCell = normalizedRows[row][col];
                                                            if (!currentCell) continue;

                                                            const currentContent = currentCell.content?.trim();

                                                            // Check if this cell should continue the current run
                                                            if (row > currentRunStart) {
                                                                const runStartContent = normalizedRows[currentRunStart][col]?.content?.trim();

                                                                // If content matches and is not empty, extend the run
                                                                if (currentContent && currentContent === runStartContent) {
                                                                    // Extend rowspan of the start cell
                                                                    normalizedRows[currentRunStart][col].rowSpan++;
                                                                    // Mark current cell to skip
                                                                    currentCell.skip = true;
                                                                } else {
                                                                    // Start a new run
                                                                    currentRunStart = row;
                                                                }
                                                            }
                                                        }
                                                    }

                                                    // Detect header row (first row with grey background styling)
                                                    const isHeaderRow = (rowIdx: number) => rowIdx === 0 || (
                                                        rowIdx > 0 &&
                                                        normalizedRows[rowIdx].length === 1 &&
                                                        normalizedRows[rowIdx][0].colSpan > 1
                                                    );

                                                    return (
                                                        <>
                                                            {/* Render thead if first row looks like headers */}
                                                            {normalizedRows.length > 0 && rows[0].length > 1 && (
                                                                <thead>
                                                                    <tr>
                                                                        {normalizedRows[0].map((cell, idx) =>
                                                                            !cell.skip ? (
                                                                                <th
                                                                                    key={idx}
                                                                                    colSpan={cell.colSpan}
                                                                                    rowSpan={cell.rowSpan}
                                                                                    style={{
                                                                                        textAlign: 'center',
                                                                                        background: '#9ca3af',
                                                                                        color: 'white',
                                                                                        fontWeight: 600
                                                                                    }}
                                                                                >
                                                                                    {cell.content}
                                                                                </th>
                                                                            ) : null
                                                                        )}
                                                                    </tr>
                                                                </thead>
                                                            )}
                                                            <tbody>
                                                                {normalizedRows.slice(rows[0].length > 1 ? 1 : 0).map((row, rIdx) => {
                                                                    const actualRowIdx = rows[0].length > 1 ? rIdx + 1 : rIdx;
                                                                    const isSectionHeader = row.length > 0 && row[0].colSpan > 1;

                                                                    return (
                                                                        <tr key={actualRowIdx}>
                                                                            {row.map((cell, cIdx) =>
                                                                                !cell.skip ? (
                                                                                    <td
                                                                                        key={cIdx}
                                                                                        colSpan={cell.colSpan}
                                                                                        rowSpan={cell.rowSpan}
                                                                                        style={{
                                                                                            textAlign: isSectionHeader ? 'center' : (cIdx === 0 ? 'center' : 'left'),
                                                                                            background: isSectionHeader ? '#e5e7eb' : 'transparent',
                                                                                            fontWeight: isSectionHeader ? 600 : 'normal',
                                                                                            verticalAlign: 'middle'
                                                                                        }}
                                                                                    >
                                                                                        {cell.content}
                                                                                    </td>
                                                                                ) : null
                                                                            )}
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </>
                                                    );
                                                })()}
                                            </table>
                                        </div>
                                    ) : para.type === 'table' ? (
                                        <div className={styles.markdownTableWrapper}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {para.text}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        formatParagraphText(para.text)
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Review Panel */}
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
                        {/* Summary Tab Content */}
                        {activeTab === 'summary' && (
                            <div style={{ padding: '20px', lineHeight: '1.6', color: '#374151' }}>
                                <div style={{ fontWeight: '600', marginBottom: '12px', fontSize: '16px' }}>📄 文件核心内容摘要</div>
                                <div style={{ fontSize: '14px', background: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                    {summary}
                                </div>
                                <div style={{ marginTop: '20px', fontSize: '13px', color: '#6b7280' }}>
                                    💡 该摘要由 AI 自动生成，旨在帮助审查员快速了解文件主旨。
                                </div>
                            </div>
                        )}

                        {/* Risks Tab Content */}
                        {activeTab === 'risks' && (
                            <>
                                {/* List View (When no risk selected) */}
                                {!activeRiskId && (
                                    <div className={styles.riskList}>
                                        {isIgnored && (
                                            <div style={{
                                                background: '#ecfdf5',
                                                border: '1px solid #a7f3d0',
                                                borderRadius: '12px',
                                                padding: '24px',
                                                marginBottom: '20px',
                                                textAlign: 'center'
                                            }}>
                                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                                                <h3 style={{ margin: '0 0 8px 0', color: '#065f46', fontSize: '18px' }}>此文件无需进行审查</h3>
                                                <p style={{ margin: 0, color: '#047857', lineHeight: 1.5 }}>
                                                    {ignoreReason}
                                                </p>
                                            </div>
                                        )}
                                        {risks.length === 0 && !isIgnored && <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>未发现明显风险点，或正在分析中...</div>}
                                        {risks.map(risk => (
                                            <div
                                                key={risk.id}
                                                className={styles.riskCard}
                                                onClick={() => handleRiskClick(risk.id)}
                                            >
                                                <div className={styles.cardHeader}>
                                                    <span className={styles.riskType}>{risk.type}</span>
                                                    <span className={styles.riskLevel}>
                                                        {risk.level === 'high' ? '🔴 高风险' : '🟡 疑似风险'}
                                                    </span>
                                                </div>
                                                <div className={styles.riskTitle}>{risk.title}</div>
                                                <div className={styles.riskSnippet}>“{risk.snippet}”</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Detail View (When risk selected) */}
                                {activeRisk && (
                                    <div className={styles.riskDetail}>
                                        <button
                                            className={styles.backLink}
                                            style={{ marginBottom: '16px' }}
                                            onClick={() => setActiveRiskId(null)}
                                        >
                                            ← 返回列表
                                        </button>

                                        <div className={styles.detailSection}>
                                            <div className={styles.riskTitle} style={{ fontSize: '18px' }}>
                                                {activeRisk.title}
                                            </div>
                                            <div className={styles.riskSnippet}>
                                                原文：“{activeRisk.snippet}”
                                            </div>
                                        </div>

                                        <div className={styles.detailSection}>
                                            <div className={styles.detailTitle}>🤖 AI 审查意见</div>
                                            <div className={styles.detailContent}>
                                                {activeRisk.reason}
                                            </div>
                                        </div>

                                        <div className={styles.detailSection}>
                                            <div className={styles.detailTitle}>⚖️ 违反条款</div>
                                            <div className={styles.lawBox}>
                                                {activeRisk.law.split('\n').map((line: string, idx: number) => (
                                                    <div key={idx} style={{
                                                        marginBottom: idx < activeRisk.law.split('\n').length - 1 ? '8px' : '0',
                                                        lineHeight: '1.6'
                                                    }}>
                                                        {line}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className={styles.detailSection}>
                                            <div className={styles.detailTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span>📖 相似案例引用</span>
                                                <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px' }}>权威佐证</span>
                                            </div>

                                            {(!activeRisk.case || activeRisk.case === '暂无数据' || activeRisk.case === '暂无相似案例匹配') ? (
                                                <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: '10px 0', fontSize: '14px' }}>暂无相似案例数据。</div>
                                            ) : (
                                                <div className={styles.caseBox} style={{ background: 'linear-gradient(to bottom right, #ffffff, #f8fafc)', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', marginTop: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                                    {/* Header */}
                                                    <div style={{ background: '#f1f5f9', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                                                        <span style={{ marginRight: '6px' }}>🏛️</span> 案例来源 / 权威答疑
                                                    </div>

                                                    {/* Content */}
                                                    <div style={{ padding: '16px 16px 16px 20px', position: 'relative' }}>
                                                        {/* Decorative Quote Mark */}
                                                        <span style={{ position: 'absolute', top: '8px', left: '6px', fontSize: '40px', color: '#e2e8f0', fontFamily: 'serif', lineHeight: 1, userSelect: 'none' }}>“</span>

                                                        <div style={{ position: 'relative', zIndex: 1, fontSize: '14px', lineHeight: '1.7', color: '#334155', fontFamily: 'system-ui, -apple-system, serif' }}>
                                                            {activeRisk.case.split('\n').map((line: string, idx: number) => (
                                                                <p key={idx} style={{ margin: '0 0 8px 0', textIndent: '0em' }}>
                                                                    {line}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Footer / Analysis */}
                                                    <div style={{ padding: '8px 12px', background: '#fffbeb', borderTop: '1px solid #fef3c7', fontSize: '12px', color: '#b45309', display: 'flex', gap: '8px', alignItems: 'start' }}>
                                                        <span style={{ fontSize: '14px' }}>💡</span>
                                                        <span style={{ lineHeight: '1.4' }}>
                                                            <strong>对比说明：</strong> 该案例中的违规情形（如“{activeRisk.title.substring(0, 6)}...”）与当前文档存在高度相似性，已被监管部门明确认定为违规，请务必引起重视。
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className={styles.detailSection}>
                                            <div className={styles.detailTitle}>💡 修改建议</div>
                                            <div className={styles.suggestionBox}>
                                                {activeRisk.suggestion}
                                            </div>
                                        </div>

                                        {/* Feedback Section */}
                                        {realReviewId && (
                                            <RiskFeedback
                                                reviewId={realReviewId}
                                                riskId={activeRisk.id}
                                            />
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
