'use client';

import { useCallback, useEffect, useState } from 'react';
import kit from '@/components/ui/kit.module.css';
import {
    ArrowLeftIcon,
    BuildingIcon,
    CheckCircleIcon,
    CheckIcon,
    ChevronRightIcon,
    ClockIcon,
    CloseIcon,
    FileTextIcon,
    LightbulbIcon,
    MessageIcon,
    SparklesIcon,
    UserIcon,
} from '@/components/ui/Icons';
import styles from './FeedbackReview.module.css';

interface Feedback {
    id: number;
    reviewId: string;
    riskId: number;
    isAccurate: boolean;
    adminStatus: string;
    createdAt: string;
    user: {
        username: string;
        name: string;
        department: string | null;
    };
    review: {
        fileName: string;
        summary: string | null;
    };
    risk: {
        level: string;
        type: string;
        title: string;
        description: string;
        quote: string | null;
        location: string | null;
        suggestion: string | null;
        law: string | null;
        relatedCase: string | null;
    };
}

interface RiskLevelMeta {
    text: string;
    tone: string;
    bar: string;
}

export default function FeedbackReviewPanel() {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'pending' | 'all'>('pending');
    const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);

    const fetchFeedbacks = useCallback(async () => {
        setLoading(true);
        try {
            const url = filter === 'pending'
                ? '/api/feedback?onlyNeedReview=true'
                : '/api/feedback';

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setFeedbacks(data);
            }
        } catch (error) {
            console.error('Fetch feedbacks error:', error);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchFeedbacks();
    }, [fetchFeedbacks]);

    const handleReview = async (feedbackId: number, status: 'approved' | 'rejected', comment?: string) => {
        if (status === 'rejected' && !confirm('确定驳回此反馈？这表示AI的判断是正确的。')) {
            return;
        }
        if (status === 'approved' && !confirm('确定通过此反馈？这表示AI确实误判。')) {
            return;
        }

        try {
            const res = await fetch(`/api/feedback/${feedbackId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adminStatus: status,
                    adminComment: comment
                })
            });

            if (res.ok) {
                setSelectedFeedback(null); // 返回列表
                fetchFeedbacks();
            } else {
                const data = await res.json();
                alert(data.error || '操作失败');
            }
        } catch (error) {
            console.error('Review feedback error:', error);
            alert('操作失败，请重试');
        }
    };

    const getRiskLevelBadge = (level: string): RiskLevelMeta => {
        if (level === 'High' || level === 'high') return { text: '高风险', tone: kit.toneHigh, bar: styles.barHigh };
        if (level === 'Medium' || level === 'medium') return { text: '中风险', tone: kit.toneMid, bar: styles.barMid };
        return { text: '低风险', tone: kit.toneLow, bar: styles.barLow };
    };

    // 从 summary 中提取文件类型
    const getDocType = (summary: string | null) => {
        if (!summary) return '未知';
        if (summary.includes('BIDDING')) return '招标文件';
        if (summary.includes('POLICY')) return '政策文件';
        if (summary.includes('AGREEMENT')) return '政府协议';
        if (summary.includes('IGNORE')) return '非审查范围';
        return '其他';
    };

    const pendingCount = feedbacks.filter(f => f.adminStatus === 'pending' && !f.isAccurate).length;

    // 详情视图
    if (selectedFeedback) {
        const feedback = selectedFeedback;
        const riskLevel = getRiskLevelBadge(feedback.risk.level);

        return (
            <div className={styles.panel}>
                <div>
                    <button
                        type="button"
                        className={`${kit.btn} ${kit.btnSm} ${kit.btnGhost} ${styles.backBtn}`}
                        onClick={() => setSelectedFeedback(null)}
                    >
                        <ArrowLeftIcon size={15} />
                        返回列表
                    </button>
                </div>

                <div className={`${kit.card} ${styles.detailCard} ${riskLevel.bar}`}>
                    {/* 文件信息 */}
                    <div className={styles.detailHeader}>
                        <span className={styles.detailFileIcon}><FileTextIcon size={20} /></span>
                        <div className={styles.detailHeaderText}>
                            <h2 className={styles.detailTitle}>{feedback.review.fileName}</h2>
                            <div className={styles.detailMeta}>
                                <span className={styles.metaItem}>
                                    <UserIcon size={13} />
                                    {feedback.user.name || feedback.user.username}
                                    {feedback.user.name && (
                                        <span className={styles.metaMono}>@{feedback.user.username}</span>
                                    )}
                                </span>
                                {feedback.user.department && (
                                    <span className={styles.metaItem}>
                                        <BuildingIcon size={13} />
                                        {feedback.user.department}
                                    </span>
                                )}
                                <span className={styles.metaItem}>
                                    <ClockIcon size={13} />
                                    <span className={styles.metaMono}>{new Date(feedback.createdAt).toLocaleString()}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* AI判断区域 */}
                    <div className={styles.detailSection}>
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionIcon}><SparklesIcon size={15} /></span>
                            <span>AI 判断结果</span>
                            <span className={`${kit.badge} ${riskLevel.tone}`}>
                                <span className={kit.dot} />
                                {riskLevel.text}
                            </span>
                        </div>

                        <dl className={styles.detailList}>
                            {feedback.risk.location && (
                                <div className={styles.detailRow}>
                                    <dt className={styles.rowLabel}>原文位置</dt>
                                    <dd className={styles.rowContent}>
                                        <blockquote className={styles.quote}>{feedback.risk.location}</blockquote>
                                    </dd>
                                </div>
                            )}

                            <div className={styles.detailRow}>
                                <dt className={styles.rowLabel}>问题描述</dt>
                                <dd className={styles.rowContent}>{feedback.risk.description}</dd>
                            </div>

                            {feedback.risk.law && (
                                <div className={styles.detailRow}>
                                    <dt className={styles.rowLabel}>违反条款</dt>
                                    <dd className={`${styles.rowContent} ${styles.lawText}`}>{feedback.risk.law}</dd>
                                </div>
                            )}

                            {feedback.risk.suggestion && (
                                <div className={styles.detailRow}>
                                    <dt className={styles.rowLabel}>修改建议</dt>
                                    <dd className={styles.rowContent}>{feedback.risk.suggestion}</dd>
                                </div>
                            )}
                        </dl>
                    </div>

                    {/* 操作区域 */}
                    {feedback.adminStatus === 'pending' && (
                        <div className={styles.detailActions}>
                            <div className={styles.actionHint}>
                                <LightbulbIcon size={15} />
                                请根据专业知识判断 AI 的分析是否正确
                            </div>
                            <div className={styles.actionBtns}>
                                <button
                                    type="button"
                                    className={`${kit.btn} ${kit.btnDanger}`}
                                    onClick={() => handleReview(feedback.id, 'rejected')}
                                >
                                    <CloseIcon size={15} />
                                    驳回（AI 正确）
                                </button>
                                <button
                                    type="button"
                                    className={`${kit.btn} ${kit.btnPrimary}`}
                                    onClick={() => handleReview(feedback.id, 'approved')}
                                >
                                    <CheckIcon size={15} />
                                    通过（AI 误判）
                                </button>
                            </div>
                        </div>
                    )}

                    {feedback.adminStatus !== 'pending' && (
                        <div className={styles.detailStatus}>
                            {feedback.adminStatus === 'approved' ? (
                                <div className={`${kit.alert} ${kit.alertOk}`}>
                                    <CheckCircleIcon size={15} />
                                    <span>已通过 - AI 确实误判</span>
                                </div>
                            ) : (
                                <div className={`${kit.alert} ${styles.alertMuted}`}>
                                    <CloseIcon size={15} />
                                    <span>已驳回 - AI 判断正确</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 列表视图
    return (
        <div className={styles.panel}>
            {/* 标题和过滤器 */}
            <div className={styles.listHeader}>
                <div>
                    <div className={styles.eyebrow}>反馈审核</div>
                    <h1 className={styles.pageTitle}>
                        风险反馈审核
                        {pendingCount > 0 && (
                            <span className={`${kit.badge} ${kit.toneSeal}`}>
                                <span className={kit.dot} />
                                {pendingCount} 条待审核
                            </span>
                        )}
                    </h1>
                    <p className={styles.pageSub}>复核用户对 AI 风险判断提出的异议，确认是否属于误判</p>
                </div>
                <div className={kit.segment} role="tablist" aria-label="反馈筛选">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={filter === 'pending'}
                        className={`${kit.segmentItem} ${filter === 'pending' ? kit.segmentActive : ''}`}
                        onClick={() => setFilter('pending')}
                    >
                        待审核
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={filter === 'all'}
                        className={`${kit.segmentItem} ${filter === 'all' ? kit.segmentActive : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        全部
                    </button>
                </div>
            </div>

            {/* 列表 */}
            <div className={`${kit.card} ${styles.listCard}`}>
                {loading ? (
                    <div className={kit.empty}>
                        <span className={kit.spinner} />
                        <span className={kit.emptyDesc}>加载中...</span>
                    </div>
                ) : feedbacks.length === 0 ? (
                    <div className={kit.empty}>
                        <span className={kit.emptyIcon}>
                            {filter === 'pending' ? <CheckCircleIcon size={24} /> : <MessageIcon size={24} />}
                        </span>
                        <span className={kit.emptyTitle}>
                            {filter === 'pending' ? '暂无待审核反馈' : '暂无反馈数据'}
                        </span>
                    </div>
                ) : (
                    <div className={kit.tableWrap}>
                        <table className={kit.table}>
                            <thead>
                                <tr>
                                    <th>文件名</th>
                                    <th>文件类型</th>
                                    <th>用户名</th>
                                    <th>姓名</th>
                                    <th>风险等级</th>
                                    <th>时间</th>
                                    <th>状态</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {feedbacks.map((feedback) => {
                                    const riskLevel = getRiskLevelBadge(feedback.risk.level);
                                    return (
                                        <tr key={feedback.id}>
                                            <td>
                                                <div className={styles.fileCell} title={feedback.review.fileName}>
                                                    <span className={`${styles.riskBar} ${riskLevel.bar}`} aria-hidden="true" />
                                                    <FileTextIcon size={15} />
                                                    <span className={styles.fileName}>
                                                        {feedback.review.fileName.length > 50
                                                            ? feedback.review.fileName.substring(0, 50) + '...'
                                                            : feedback.review.fileName}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`${kit.badge} ${kit.badgeSquare} ${kit.toneMuted}`}>
                                                    {getDocType(feedback.review.summary)}
                                                </span>
                                            </td>
                                            <td className={kit.cellNum}>{feedback.user.username}</td>
                                            <td className={kit.cellMain}>{feedback.user.name}</td>
                                            <td>
                                                <span className={`${kit.badge} ${riskLevel.tone}`}>
                                                    {riskLevel.text}
                                                </span>
                                            </td>
                                            <td className={kit.cellNum}>
                                                {new Date(feedback.createdAt).toLocaleDateString()}
                                            </td>
                                            <td>
                                                {feedback.adminStatus === 'pending' ? (
                                                    <span className={`${kit.badge} ${kit.toneMid}`}>
                                                        <span className={kit.dot} />
                                                        待审核
                                                    </span>
                                                ) : feedback.adminStatus === 'approved' ? (
                                                    <span className={`${kit.badge} ${kit.toneOk}`}>
                                                        <span className={kit.dot} />
                                                        已通过
                                                    </span>
                                                ) : (
                                                    <span className={`${kit.badge} ${kit.toneMuted}`}>
                                                        <span className={kit.dot} />
                                                        已驳回
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className={`${kit.btn} ${kit.btnXs} ${kit.btnSecondary}`}
                                                    onClick={() => setSelectedFeedback(feedback)}
                                                >
                                                    查看详情
                                                    <ChevronRightIcon size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
