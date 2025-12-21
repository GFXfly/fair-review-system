'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

export default function FeedbackReviewPanel() {
    const router = useRouter();
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'pending' | 'all'>('pending');
    const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);

    useEffect(() => {
        fetchFeedbacks();
    }, [filter]);

    const fetchFeedbacks = async () => {
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
    };

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

    const getRiskLevelBadge = (level: string) => {
        if (level === 'High' || level === 'high') return { text: '高风险', color: '#ef4444', bg: '#fef2f2' };
        if (level === 'Medium' || level === 'medium') return { text: '中风险', color: '#f59e0b', bg: '#fffbeb' };
        return { text: '低风险', color: '#6b7280', bg: '#f3f4f6' };
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
            <div>
                {/* 返回按钮 */}
                <button
                    className={styles.backBtn}
                    onClick={() => setSelectedFeedback(null)}
                >
                    ← 返回列表
                </button>

                {/* 详情卡片 */}
                <div className={styles.detailCard}>
                    {/* 文件信息 */}
                    <div className={styles.detailHeader}>
                        <div className={styles.detailTitle}>
                            📄 {feedback.review.fileName}
                        </div>
                        <div className={styles.detailMeta}>
                            <span>👤 {feedback.user.name || feedback.user.username}</span>
                            {feedback.user.name && <span style={{ color: '#9ca3af' }}>（{feedback.user.username}）</span>}
                            {feedback.user.department && <span>- {feedback.user.department}</span>}
                            <span style={{ marginLeft: '16px' }}>🕐 {new Date(feedback.createdAt).toLocaleString()}</span>
                        </div>
                    </div>

                    {/* AI判断区域 */}
                    <div className={styles.detailSection}>
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionIcon}>🤖</span>
                            <span>AI 判断结果</span>
                            <span
                                className={styles.levelBadge}
                                style={{ background: riskLevel.bg, color: riskLevel.color }}
                            >
                                {riskLevel.text}
                            </span>
                        </div>

                        {feedback.risk.location && (
                            <div className={styles.detailRow}>
                                <div className={styles.rowLabel}>原文位置</div>
                                <div className={styles.rowContent}>"{feedback.risk.location}"</div>
                            </div>
                        )}

                        <div className={styles.detailRow}>
                            <div className={styles.rowLabel}>问题描述</div>
                            <div className={styles.rowContent}>{feedback.risk.description}</div>
                        </div>

                        {feedback.risk.law && (
                            <div className={styles.detailRow}>
                                <div className={styles.rowLabel}>违反条款</div>
                                <div className={styles.rowContent}>{feedback.risk.law}</div>
                            </div>
                        )}

                        {feedback.risk.suggestion && (
                            <div className={styles.detailRow}>
                                <div className={styles.rowLabel}>修改建议</div>
                                <div className={styles.rowContent}>{feedback.risk.suggestion}</div>
                            </div>
                        )}
                    </div>


                    {/* 操作区域 */}
                    {feedback.adminStatus === 'pending' && (
                        <div className={styles.detailActions}>
                            <div className={styles.actionHint}>
                                💡 请根据专业知识判断AI的分析是否正确
                            </div>
                            <div className={styles.actionBtns}>
                                <button
                                    className={styles.btnApprove}
                                    onClick={() => handleReview(feedback.id, 'approved')}
                                >
                                    ✓ 通过（AI 误判）
                                </button>
                                <button
                                    className={styles.btnReject}
                                    onClick={() => handleReview(feedback.id, 'rejected')}
                                >
                                    ✗ 驳回（AI 正确）
                                </button>
                            </div>
                        </div>
                    )}

                    {feedback.adminStatus !== 'pending' && (
                        <div className={styles.detailStatus}>
                            {feedback.adminStatus === 'approved' ? (
                                <span className={styles.statusApproved}>✓ 已通过 - AI确实误判</span>
                            ) : (
                                <span className={styles.statusRejected}>✗ 已驳回 - AI判断正确</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 列表视图
    return (
        <div>
            {/* 标题和过滤器 */}
            <div className={styles.listHeader}>
                <h1 className={styles.pageTitle}>
                    风险反馈审核
                    {pendingCount > 0 && (
                        <span className={styles.badge}>{pendingCount} 条待审核</span>
                    )}
                </h1>
                <div className={styles.filterGroup}>
                    <button
                        className={filter === 'pending' ? styles.filterBtnActive : styles.filterBtn}
                        onClick={() => setFilter('pending')}
                    >
                        待审核
                    </button>
                    <button
                        className={filter === 'all' ? styles.filterBtnActive : styles.filterBtn}
                        onClick={() => setFilter('all')}
                    >
                        全部
                    </button>
                </div>
            </div>

            {/* 列表 */}
            {loading ? (
                <div className={styles.emptyState}>加载中...</div>
            ) : feedbacks.length === 0 ? (
                <div className={styles.emptyState}>
                    {filter === 'pending' ? '🎉 暂无待审核反馈' : '暂无反馈数据'}
                </div>
            ) : (
                <div className={styles.feedbackTable}>
                    <div className={styles.tableHeader}>
                        <div className={styles.colFile}>文件名</div>
                        <div className={styles.colType}>文件类型</div>
                        <div className={styles.colUsername}>用户名</div>
                        <div className={styles.colName}>姓名</div>
                        <div className={styles.colRisk}>风险等级</div>
                        <div className={styles.colTime}>时间</div>
                        <div className={styles.colStatus}>状态</div>
                        <div className={styles.colAction}>操作</div>
                    </div>
                    {feedbacks.map((feedback) => {
                        const riskLevel = getRiskLevelBadge(feedback.risk.level);
                        return (
                            <div key={feedback.id} className={styles.tableRow}>
                                <div className={styles.colFile} title={feedback.review.fileName}>
                                    📄 {feedback.review.fileName.length > 50
                                        ? feedback.review.fileName.substring(0, 50) + '...'
                                        : feedback.review.fileName}
                                </div>
                                <div className={styles.colType}>
                                    {getDocType(feedback.review.summary)}
                                </div>
                                <div className={styles.colUsername}>
                                    {feedback.user.username}
                                </div>
                                <div className={styles.colName}>
                                    {feedback.user.name}
                                </div>
                                <div className={styles.colRisk}>
                                    <span
                                        className={styles.riskBadge}
                                        style={{ background: riskLevel.bg, color: riskLevel.color }}
                                    >
                                        {riskLevel.text}
                                    </span>
                                </div>
                                <div className={styles.colTime}>
                                    {new Date(feedback.createdAt).toLocaleDateString()}
                                </div>
                                <div className={styles.colStatus}>
                                    {feedback.adminStatus === 'pending' ? (
                                        <span className={styles.statusPending}>待审核</span>
                                    ) : feedback.adminStatus === 'approved' ? (
                                        <span className={styles.statusApprovedSmall}>已通过</span>
                                    ) : (
                                        <span className={styles.statusRejectedSmall}>已驳回</span>
                                    )}
                                </div>
                                <div className={styles.colAction}>
                                    <button
                                        className={styles.viewBtn}
                                        onClick={() => setSelectedFeedback(feedback)}
                                    >
                                        查看详情
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
