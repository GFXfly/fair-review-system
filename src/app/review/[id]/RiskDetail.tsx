'use client';

import React from 'react';
import RiskFeedback from '@/components/RiskFeedback';
import kit from '@/components/ui/kit.module.css';
import {
    AlertTriangleIcon,
    ArrowLeftIcon,
    BookOpenIcon,
    GavelIcon,
    LightbulbIcon,
    QuoteIcon,
    ScaleLawIcon,
} from '@/components/ui/Icons';
import styles from './page.module.css';
import type { RiskItem, RiskLevel } from './export-utils';

interface RiskDetailProps {
    risk: RiskItem;
    reviewId: string | null;
    onBack: () => void;
}

const LEVEL_META: Record<RiskLevel, { label: string; tone: string; cls: string }> = {
    high: { label: '高风险', tone: kit.toneHigh, cls: styles.levelHigh },
    medium: { label: '疑似风险', tone: kit.toneMid, cls: styles.levelMid },
    low: { label: '低风险', tone: kit.toneLow, cls: styles.levelLow },
};

function SectionTitle({ icon, children, extra }: { icon: React.ReactNode; children: React.ReactNode; extra?: React.ReactNode }) {
    return (
        <h3 className={styles.detailTitle}>
            <span className={styles.detailTitleIcon}>{icon}</span>
            <span>{children}</span>
            {extra}
        </h3>
    );
}

export default function RiskDetail({ risk, reviewId, onBack }: RiskDetailProps) {
    const meta = LEVEL_META[risk.level] ?? LEVEL_META.medium;
    const hasCase = risk.case && risk.case !== '暂无数据' && risk.case !== '暂无相似案例匹配';
    const hasDebate = Boolean(risk.defense || risk.rulingReason);

    return (
        <div className={styles.riskDetail}>
            <div className={styles.detailTopbar}>
                <button type="button" className={`${kit.btn} ${kit.btnGhost} ${kit.btnXs}`} onClick={onBack}>
                    <ArrowLeftIcon size={14} />
                    返回列表
                </button>
            </div>

            <div className={`${styles.detailHero} ${meta.cls}`}>
                <div className={styles.detailBadges}>
                    <span className={`${kit.badge} ${meta.tone}`}>
                        <span className={kit.dot} />
                        {meta.label}
                    </span>
                    {typeof risk.confidence === 'number' && (
                        <span className={styles.confidence}>
                            裁决置信度 <span className={styles.confidenceNum}>{risk.confidence}%</span>
                        </span>
                    )}
                </div>
                <h2 className={styles.detailHeading}>{risk.title}</h2>
            </div>

            <section className={styles.detailSection}>
                <SectionTitle icon={<QuoteIcon size={14} />}>风险条款原文</SectionTitle>
                <blockquote className={styles.detailQuote}>{risk.snippet}</blockquote>
            </section>

            <section className={styles.detailSection}>
                <SectionTitle icon={<AlertTriangleIcon size={14} />}>违规原因剖析</SectionTitle>
                <div className={styles.detailContent}>{risk.reason}</div>
            </section>

            <section className={styles.detailSection}>
                <SectionTitle icon={<ScaleLawIcon size={14} />}>违反法规依据</SectionTitle>
                <div className={styles.lawBox}>
                    {risk.law.split('\n').map((line, idx) => (
                        <p key={idx} className={styles.lawLine}>{line}</p>
                    ))}
                </div>
            </section>

            <section className={styles.detailSection}>
                <SectionTitle
                    icon={<BookOpenIcon size={14} />}
                    extra={<span className={`${kit.badge} ${kit.toneMuted} ${styles.titleTag}`}>权威佐证</span>}
                >
                    相似案例引用
                </SectionTitle>
                {!hasCase ? (
                    <div className={styles.detailMuted}>暂无相似案例数据。</div>
                ) : (
                    <div className={styles.caseBox}>
                        <div className={styles.caseBoxHead}>案例来源 / 权威答疑</div>
                        <div className={styles.caseBoxBody}>
                            {risk.case.split('\n').map((line, idx) => (
                                <p key={idx}>{line}</p>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {hasDebate && (
                <section className={styles.detailSection}>
                    <SectionTitle icon={<GavelIcon size={14} />}>合规抗辩与终审裁决</SectionTitle>
                    <div className={styles.debateList}>
                        {risk.defense && (
                            <div className={styles.debateItem}>
                                <div className={styles.debateLabel}>起草人抗辩</div>
                                <div className={styles.debateText}>{risk.defense}</div>
                            </div>
                        )}
                        {risk.rulingReason && (
                            <div className={`${styles.debateItem} ${styles.debateRuling}`}>
                                <div className={styles.debateLabel}>
                                    终审裁决理由{typeof risk.confidence === 'number' ? `（置信度 ${risk.confidence}%）` : ''}
                                </div>
                                <div className={styles.debateText}>{risk.rulingReason}</div>
                            </div>
                        )}
                    </div>
                </section>
            )}

            <section className={styles.detailSection}>
                <SectionTitle icon={<LightbulbIcon size={14} />}>整改完善建议</SectionTitle>
                <div className={styles.suggestionBox}>{risk.suggestion}</div>
            </section>

            {reviewId && <RiskFeedback reviewId={reviewId} riskId={risk.id} />}
        </div>
    );
}
