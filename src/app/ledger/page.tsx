'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ReviewUser {
    name?: string;
    department?: string;
}

interface ReviewRecord {
    id: string;
    fileName: string;
    status: string;
    riskCount: number;
    summary?: string | null;
    createdAt: string;
    user?: ReviewUser;
}

interface CurrentUser {
    name?: string;
    role?: string;
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
    completed: { label: '已完成', color: '#10b981', bg: '#d1fae5' },
    ignored: { label: '无需审查', color: '#6b7280', bg: '#e5e7eb' },
    failed: { label: '失败', color: '#ef4444', bg: '#fee2e2' },
    processing: { label: '审查中', color: '#2563eb', bg: '#dbeafe' },
    pending: { label: '待处理', color: '#b45309', bg: '#fef3c7' },
};

export default function LedgerPage() {
    const router = useRouter();
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [records, setRecords] = useState<ReviewRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 鉴权与数据并行加载：身份用于决定是否展示「提交账号」列；
    // 记录范围由后端按 session role 决定（admin 全部 / 普通自己）。
    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Unauthorized');
            })
            .then(data => setUser(data))
            .catch(() => router.push('/'));

        fetch('/api/reviews?all=true', { cache: 'no-store' })
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Failed to load');
            })
            .then(data => setRecords(Array.isArray(data) ? data : []))
            .catch(error => console.error('Failed to fetch ledger:', error))
            .finally(() => setIsLoading(false));
    }, [router]);

    const isAdmin = user?.role === 'admin';

    const openRecord = (record: ReviewRecord) => {
        if (record.status === 'ignored') {
            alert(record.summary ?? '该文件无需审查');
        } else {
            router.push(`/review/${record.id}`);
        }
    };

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 600, margin: 0 }}>📋 全部审查台账</h1>
                <button
                    onClick={() => router.push('/dashboard')}
                    style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '14px' }}
                >
                    ← 返回工作台
                </button>
            </div>
            <p style={{ color: '#6b7280', fontSize: '13px', marginTop: 0, marginBottom: '20px' }}>
                {isAdmin ? '当前显示：全部用户的审查记录' : '当前显示：我提交的审查记录'}
            </p>

            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: '#9ca3af' }}>正在加载台账...</div>
            ) : records.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: '#9ca3af' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                    <div style={{ fontSize: '14px' }}>暂无审查记录</div>
                </div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>
                            <th style={{ padding: '10px 12px' }}>状态</th>
                            <th style={{ padding: '10px 12px' }}>文件名称</th>
                            {isAdmin && <th style={{ padding: '10px 12px' }}>提交账号</th>}
                            <th style={{ padding: '10px 12px' }}>风险点</th>
                            <th style={{ padding: '10px 12px' }}>审查时间</th>
                            <th style={{ padding: '10px 12px' }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.map(record => {
                            const badge = STATUS_BADGE[record.status] ?? STATUS_BADGE.pending;
                            return (
                                <tr key={record.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span style={{ color: badge.color, background: badge.bg, padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                                            {badge.label}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>{record.fileName}</td>
                                    {isAdmin && (
                                        <td style={{ padding: '10px 12px' }}>
                                            <div style={{ fontWeight: 500 }}>{record.user?.name || '未知'}</div>
                                            {record.user?.department && (
                                                <div style={{ fontSize: '12px', color: '#6b7280' }}>{record.user.department}</div>
                                            )}
                                        </td>
                                    )}
                                    <td style={{ padding: '10px 12px' }}>
                                        {record.status === 'ignored' ? '-' : (
                                            record.riskCount > 0
                                                ? <span style={{ color: '#ef4444' }}>{record.riskCount} 个风险</span>
                                                : <span style={{ color: '#10b981' }}>无风险</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                                        {new Date(record.createdAt).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <button
                                            onClick={() => openRecord(record)}
                                            style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '14px', padding: 0 }}
                                        >
                                            查看
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}
