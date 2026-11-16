'use client';

import React from 'react';
import kit from '@/components/ui/kit.module.css';

const STATUS_META: Record<string, { label: string; tone: string; pulse?: boolean }> = {
    completed: { label: '已完成', tone: kit.toneOk },
    processing: { label: '审查中', tone: kit.toneLow, pulse: true },
    pending: { label: '待处理', tone: kit.toneMid },
    ignored: { label: '无需审查', tone: kit.toneMuted },
    failed: { label: '失败', tone: kit.toneHigh },
};

export const RECORD_STATUS_LABELS: Record<string, string> = Object.fromEntries(
    Object.entries(STATUS_META).map(([key, meta]) => [key, meta.label]),
);

/** 审查记录状态胶囊（带圆点指示器） */
export function RecordStatusBadge({ status }: { status: string }) {
    const meta = STATUS_META[status] ?? STATUS_META.pending;
    return (
        <span className={`${kit.badge} ${meta.tone}`}>
            <span className={`${kit.dot} ${meta.pulse ? kit.dotPulse : ''}`} />
            {meta.label}
        </span>
    );
}

/** 风险数徽章：有风险朱红、无风险翠绿、无需审查显示短横 */
export function RiskCountBadge({ status, riskCount }: { status: string; riskCount: number }) {
    if (status === 'ignored' || status === 'failed') {
        return <span className={kit.cellNum}>—</span>;
    }
    if (status !== 'completed') {
        return <span className={kit.cellNum}>…</span>;
    }
    if (riskCount > 0) {
        return (
            <span className={`${kit.badge} ${kit.badgeSquare} ${kit.toneHigh}`}>
                <span className={kit.mono}>{riskCount}</span> 项风险
            </span>
        );
    }
    return <span className={`${kit.badge} ${kit.badgeSquare} ${kit.toneOk}`}>未发现风险</span>;
}

/** 统一的日期时间格式：2026-11-16 20:18 */
export function formatDateTime(value: string | Date) {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '—';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
