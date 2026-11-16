'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import kit from '@/components/ui/kit.module.css';
import DashboardNav from '@/app/dashboard/DashboardNav';
import ChangePasswordModal from '@/app/dashboard/ChangePasswordModal';
import type { DashboardUser } from '@/app/dashboard/types';
import { RecordStatusBadge, RiskCountBadge, formatDateTime } from '@/app/dashboard/record-badges';
import CustomSelect from '@/components/ui/CustomSelect';
import {
    AlertTriangleIcon,
    ArrowLeftIcon,
    ArrowRightIcon,
    CheckCircleIcon,
    CloseIcon,
    FileTextIcon,
    FilterIcon,
    LedgerIcon,
    SearchIcon,
} from '@/components/ui/Icons';

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

type StatusFilter = 'all' | 'completed' | 'processing' | 'pending' | 'ignored' | 'failed';
type RiskFilter = 'all' | 'risky' | 'clean';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: '全部状态' },
    { value: 'completed', label: '已完成' },
    { value: 'processing', label: '审查中' },
    { value: 'pending', label: '待处理' },
    { value: 'ignored', label: '无需审查' },
    { value: 'failed', label: '失败' },
];

const RISK_OPTIONS: { value: RiskFilter; label: string }[] = [
    { value: 'all', label: '全部结果' },
    { value: 'risky', label: '发现风险' },
    { value: 'clean', label: '未发现风险' },
];

export default function LedgerPage() {
    const router = useRouter();
    const [user, setUser] = useState<DashboardUser | null>(null);
    const [records, setRecords] = useState<ReviewRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
    const [showPasswordModal, setShowPasswordModal] = useState(false);

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

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
    };

    const openRecord = (record: ReviewRecord) => {
        if (record.status === 'ignored') {
            alert(record.summary ?? '该文件无需审查');
        } else {
            router.push(`/review/${record.id}`);
        }
    };

    const stats = useMemo(() => {
        const completed = records.filter(r => r.status === 'completed');
        const risky = completed.filter(r => r.riskCount > 0);
        return {
            total: records.length,
            completed: completed.length,
            risky: risky.length,
            riskItems: risky.reduce((sum, r) => sum + r.riskCount, 0),
        };
    }, [records]);

    const filtered = useMemo(() => {
        const k = keyword.trim().toLowerCase();
        return records.filter((r) => {
            if (statusFilter !== 'all' && r.status !== statusFilter) return false;
            if (riskFilter === 'risky' && !(r.status === 'completed' && r.riskCount > 0)) return false;
            if (riskFilter === 'clean' && !(r.status === 'completed' && r.riskCount === 0)) return false;
            if (!k) return true;
            return [r.fileName, r.user?.name, r.user?.department]
                .some(v => (v || '').toLowerCase().includes(k));
        });
    }, [records, keyword, statusFilter, riskFilter]);

    const hasFilter = Boolean(keyword.trim()) || statusFilter !== 'all' || riskFilter !== 'all';
    const resetFilters = () => {
        setKeyword('');
        setStatusFilter('all');
        setRiskFilter('all');
    };

    return (
        <div className={styles.page}>
            <DashboardNav
                activeTab="workspace"
                onTabChange={(tab) => router.push(tab === 'workspace' ? '/dashboard' : `/dashboard?tab=${tab}`)}
                user={user}
                onOpenPasswordModal={() => setShowPasswordModal(true)}
                onLogout={handleLogout}
            />

            <main className={styles.main}>
                <div className={styles.breadcrumb}>
                    <button type="button" className={styles.backLink} onClick={() => router.push('/dashboard')}>
                        <ArrowLeftIcon size={14} />
                        返回工作台
                    </button>
                    <span className={styles.crumbSep}>/</span>
                    <span>审查台账</span>
                </div>

                <header className={styles.head}>
                    <div>
                        <div className={styles.eyebrow}>审查台账</div>
                        <h1 className={styles.title}>全部审查台账</h1>
                        <p className={styles.desc}>
                            {isAdmin ? '当前显示：全部用户的审查记录' : '当前显示：我提交的审查记录'}
                        </p>
                    </div>
                </header>

                {/* 统计摘要 */}
                <section className={styles.stats}>
                    <div className={styles.statCard}>
                        <span className={styles.statIcon}><LedgerIcon size={18} /></span>
                        <div>
                            <div className={styles.statLabel}>审查记录</div>
                            <div className={styles.statValue}>{isLoading ? '—' : stats.total}<small>份</small></div>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <span className={`${styles.statIcon} ${styles.statIconOk}`}><CheckCircleIcon size={18} /></span>
                        <div>
                            <div className={styles.statLabel}>已完成审查</div>
                            <div className={styles.statValue}>{isLoading ? '—' : stats.completed}<small>份</small></div>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <span className={`${styles.statIcon} ${styles.statIconHigh}`}><AlertTriangleIcon size={18} /></span>
                        <div>
                            <div className={styles.statLabel}>发现风险文书</div>
                            <div className={styles.statValue}>{isLoading ? '—' : stats.risky}<small>份</small></div>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <span className={`${styles.statIcon} ${styles.statIconSeal}`}><FileTextIcon size={18} /></span>
                        <div>
                            <div className={styles.statLabel}>累计风险条款</div>
                            <div className={styles.statValue}>{isLoading ? '—' : stats.riskItems}<small>项</small></div>
                        </div>
                    </div>
                </section>

                <section className={`${kit.card} ${styles.tableCard}`}>
                    {/* 工具栏 */}
                    <div className={styles.toolbar}>
                        <div className={styles.searchField}>
                            <span className={styles.searchIcon}><SearchIcon size={15} /></span>
                            <input
                                className={styles.searchInput}
                                placeholder={isAdmin ? '搜索文件名称、提交人或单位…' : '搜索文件名称…'}
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                aria-label="搜索台账"
                            />
                            {keyword && (
                                <button type="button" className={styles.searchClear} onClick={() => setKeyword('')} aria-label="清空搜索">
                                    <CloseIcon size={13} />
                                </button>
                            )}
                        </div>
                        <div className={styles.filterGroup}>
                            <div className={styles.filterItem}>
                                <CustomSelect<StatusFilter>
                                    size="sm"
                                    value={statusFilter}
                                    onChange={setStatusFilter}
                                    options={STATUS_OPTIONS}
                                    icon={<FilterIcon size={13} />}
                                    aria-label="按状态筛选"
                                />
                            </div>
                            <div className={styles.filterItem}>
                                <CustomSelect<RiskFilter>
                                    size="sm"
                                    value={riskFilter}
                                    onChange={setRiskFilter}
                                    options={RISK_OPTIONS}
                                    icon={<AlertTriangleIcon size={13} />}
                                    aria-label="按审查结果筛选"
                                />
                            </div>
                            {hasFilter && (
                                <button type="button" className={`${kit.btn} ${kit.btnGhost} ${kit.btnSm}`} onClick={resetFilters}>
                                    重置
                                </button>
                            )}
                        </div>
                        <div className={styles.resultCount}>
                            {hasFilter ? <>筛选出 <b>{filtered.length}</b> / {records.length} 条</> : <>共 <b>{records.length}</b> 条</>}
                        </div>
                    </div>

                    {isLoading ? (
                        <div className={styles.skeletonList} aria-label="正在加载台账">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className={styles.skeletonRow}>
                                    <span className={styles.skeletonPill} />
                                    <span className={styles.skeletonLine} />
                                    <span className={styles.skeletonShort} />
                                </div>
                            ))}
                        </div>
                    ) : records.length === 0 ? (
                        <div className={kit.empty}>
                            <span className={kit.emptyIcon}><LedgerIcon size={24} strokeWidth={1.5} /></span>
                            <div className={kit.emptyTitle}>暂无审查记录</div>
                            <div className={kit.emptyDesc}>在工作台上传招标文书后，记录会出现在这里</div>
                            <button
                                type="button"
                                className={`${kit.btn} ${kit.btnPrimary} ${kit.btnSm}`}
                                style={{ marginTop: 12 }}
                                onClick={() => router.push('/dashboard')}
                            >
                                前往工作台
                            </button>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className={kit.empty}>
                            <span className={kit.emptyIcon}><SearchIcon size={24} strokeWidth={1.5} /></span>
                            <div className={kit.emptyTitle}>没有符合条件的记录</div>
                            <div className={kit.emptyDesc}>调整关键词或筛选条件后重试</div>
                            <button
                                type="button"
                                className={`${kit.btn} ${kit.btnSecondary} ${kit.btnSm}`}
                                style={{ marginTop: 12 }}
                                onClick={resetFilters}
                            >
                                清除筛选
                            </button>
                        </div>
                    ) : (
                        <div className={kit.tableWrap}>
                            <table className={kit.table}>
                                <thead>
                                    <tr>
                                        <th className={styles.colNo}>序号</th>
                                        <th className={styles.colStatus}>状态</th>
                                        <th>文件名称</th>
                                        {isAdmin && <th className={styles.colUser}>提交账号</th>}
                                        <th className={styles.colRisk}>风险点</th>
                                        <th className={styles.colTime}>审查时间</th>
                                        <th className={styles.colAction}>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((record, index) => (
                                        <tr key={record.id} className={styles.row} onClick={() => openRecord(record)}>
                                            <td className={`${kit.cellNum} ${styles.colNo}`}>{String(index + 1).padStart(2, '0')}</td>
                                            <td><RecordStatusBadge status={record.status} /></td>
                                            <td>
                                                <div className={styles.fileCell}>
                                                    <span className={styles.fileIcon}><FileTextIcon size={16} /></span>
                                                    <span className={styles.fileName} title={record.fileName}>{record.fileName}</span>
                                                </div>
                                            </td>
                                            {isAdmin && (
                                                <td>
                                                    <div className={kit.cellMain}>{record.user?.name || '未知'}</div>
                                                    {record.user?.department && (
                                                        <div className={kit.cellSub}>{record.user.department}</div>
                                                    )}
                                                </td>
                                            )}
                                            <td><RiskCountBadge status={record.status} riskCount={record.riskCount} /></td>
                                            <td className={kit.cellNum}>{formatDateTime(record.createdAt)}</td>
                                            <td className={styles.colAction}>
                                                <button
                                                    type="button"
                                                    className={styles.viewBtn}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openRecord(record);
                                                    }}
                                                >
                                                    查看
                                                    <ArrowRightIcon size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>

            {showPasswordModal && (
                <ChangePasswordModal
                    onSuccess={handleLogout}
                    onClose={() => setShowPasswordModal(false)}
                />
            )}
        </div>
    );
}
