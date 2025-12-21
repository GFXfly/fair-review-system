'use client';

import { useState } from 'react';
import styles from './RiskFeedback.module.css';

interface RiskFeedbackProps {
    reviewId: string;
    riskId: number | string;
    onFeedbackSubmitted?: () => void;
}

export default function RiskFeedback({ reviewId, riskId, onFeedbackSubmitted }: RiskFeedbackProps) {
    const [feedbackStatus, setFeedbackStatus] = useState<'none' | 'accurate' | 'inaccurate' | 'error'>('none');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 将 riskId 转换为数字
    const numericRiskId = typeof riskId === 'number' ? riskId : parseInt(String(riskId), 10);

    // 如果 riskId 不是有效数字（比如 "risk_0"），则不显示反馈组件
    if (isNaN(numericRiskId)) {
        return null;
    }

    const handleFeedback = async (isAccurate: boolean) => {
        if (feedbackStatus !== 'none' || isSubmitting) return;

        setIsSubmitting(true);

        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reviewId,
                    riskId: numericRiskId,
                    isAccurate
                })
            });

            if (res.ok) {
                setFeedbackStatus(isAccurate ? 'accurate' : 'inaccurate');
                if (onFeedbackSubmitted) {
                    onFeedbackSubmitted();
                }
            } else {
                // 静默处理错误，只在控制台记录
                const data = await res.json();
                console.error('Feedback error:', data.error);
                setFeedbackStatus('error');
            }
        } catch (error) {
            console.error('Submit feedback error:', error);
            setFeedbackStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // 已提交反馈 - 显示完成状态
    if (feedbackStatus === 'accurate') {
        return (
            <div className={styles.feedbackSection}>
                <div className={styles.feedbackComplete}>
                    ✓ 反馈已提交（准确）
                </div>
            </div>
        );
    }

    if (feedbackStatus === 'inaccurate') {
        return (
            <div className={styles.feedbackSection}>
                <div className={styles.feedbackComplete} style={{ color: '#f59e0b' }}>
                    ✓ 反馈已提交（不准确）
                </div>
            </div>
        );
    }

    if (feedbackStatus === 'error') {
        return (
            <div className={styles.feedbackSection}>
                <div className={styles.feedbackComplete} style={{ color: '#888' }}>
                    反馈提交失败
                </div>
            </div>
        );
    }

    // 未提交 - 显示反馈按钮
    return (
        <div className={styles.feedbackSection}>
            <div className={styles.feedbackPrompt}>
                💬 这个风险判断准确吗？
            </div>
            <div className={styles.feedbackButtons}>
                <button
                    className={styles.feedbackBtn}
                    onClick={() => handleFeedback(true)}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? '提交中...' : '👍 准确'}
                </button>
                <button
                    className={`${styles.feedbackBtn} ${styles.feedbackBtnNegative}`}
                    onClick={() => handleFeedback(false)}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? '提交中...' : '👎 不准确'}
                </button>
            </div>
        </div>
    );
}
