'use client';

import React from 'react';
import RiskFeedback from '@/components/RiskFeedback';
import styles from './page.module.css';
import type { RiskItem, RiskLevel } from './export-utils';

interface RiskDetailProps {
    risk: RiskItem;
    reviewId: string | null;
    onBack: () => void;
}

const LEVEL_BADGE: Record<RiskLevel, { label: string; bg: string; color: string }> = {
    high: { label: '🔴 高风险', bg: '#fee2e2', color: '#b91c1c' },
    medium: { label: '🟡 疑似风险', bg: '#fef3c7', color: '#b45309' },
    low: { label: '🔵 低风险', bg: '#dbeafe', color: '#1d4ed8' },
};

export default function RiskDetail({ risk, reviewId, onBack }: RiskDetailProps) {
    const badge = LEVEL_BADGE[risk.level] ?? LEVEL_BADGE.medium;
    const hasCase = risk.case && risk.case !== '暂无数据' && risk.case !== '暂无相似案例匹配';
    const hasDebate = Boolean(risk.defense || risk.rulingReason);

    return (
        <div className={styles.riskDetail}>
            <button className={styles.backLink} style={{ marginBottom: '16px' }} onClick={onBack}>
                ← 返回列表
            </button>

            <div className={styles.detailSection}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{
                        background: badge.bg,
                        color: badge.color,
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                    }}>
                        {badge.label}
                    </span>
                    {typeof risk.confidence === 'number' && (
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                            裁决置信度 {risk.confidence}%
                        </span>
                    )}
                </div>
                <div className={styles.riskTitle} style={{ fontSize: '18px' }}>{risk.title}</div>
                <div className={styles.riskSnippet}>原文：“{risk.snippet}”</div>
            </div>

            <div className={styles.detailSection}>
                <div className={styles.detailTitle}>🤖 AI 审查意见</div>
                <div className={styles.detailContent}>{risk.reason}</div>
            </div>

            <div className={styles.detailSection}>
                <div className={styles.detailTitle}>⚖️ 违反条款</div>
                <div className={styles.lawBox}>
                    {risk.law.split('\n').map((line, idx, arr) => (
                        <div key={idx} style={{ marginBottom: idx < arr.length - 1 ? '8px' : 0, lineHeight: 1.6 }}>
                            {line}
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.detailSection}>
                <div className={styles.detailTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📖 相似案例引用</span>
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px' }}>
                        权威佐证
                    </span>
                </div>

                {!hasCase ? (
                    <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: '10px 0', fontSize: '14px' }}>
                        暂无相似案例数据。
                    </div>
                ) : (
                    <div className={styles.caseBox} style={{
                        background: 'linear-gradient(to bottom right, #ffffff, #f8fafc)',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        marginTop: '8px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    }}>
                        <div style={{ background: '#f1f5f9', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                            <span style={{ marginRight: '6px' }}>🏛️</span> 案例来源 / 权威答疑
                        </div>
                        <div style={{ padding: '16px 16px 16px 20px', position: 'relative' }}>
                            <span style={{ position: 'absolute', top: '8px', left: '6px', fontSize: '40px', color: '#e2e8f0', fontFamily: 'serif', lineHeight: 1, userSelect: 'none' }}>“</span>
                            <div style={{ position: 'relative', zIndex: 1, fontSize: '14px', lineHeight: '1.7', color: '#334155' }}>
                                {risk.case.split('\n').map((line, idx) => (
                                    <p key={idx} style={{ margin: '0 0 8px 0' }}>{line}</p>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className={styles.detailSection}>
                <div className={styles.detailTitle}>💡 修改建议</div>
                <div className={styles.suggestionBox}>{risk.suggestion}</div>
            </div>

            {hasDebate && (
                <div className={styles.detailSection}>
                    <div className={styles.detailTitle}>🧑‍⚖️ 辩论记录</div>
                    <div style={{
                        display: 'grid',
                        gap: '12px',
                        fontSize: '14px',
                        marginTop: '8px',
                    }}>
                        {risk.defense && (
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                                <div style={{ fontWeight: 600, color: '#334155', marginBottom: '6px' }}>起草人辩护</div>
                                <div style={{ color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{risk.defense}</div>
                            </div>
                        )}
                        {risk.rulingReason && (
                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 14px' }}>
                                <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: '6px' }}>
                                    裁决理由{typeof risk.confidence === 'number' ? `（置信度 ${risk.confidence}%）` : ''}
                                </div>
                                <div style={{ color: '#1e3a8a', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{risk.rulingReason}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {reviewId && <RiskFeedback reviewId={reviewId} riskId={risk.id} />}
        </div>
    );
}
