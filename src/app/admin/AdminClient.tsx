'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './admin.module.css';
import FeedbackReviewPanel from '../felixgao/FeedbackReview';
import {
    GOV_DEPT_LIST,
    ORG_TYPE_LABELS,
    TOWN_LIST,
    isValidOrgType,
    isValidPhone,
    type OrgType,
} from '@/lib/org-constants';

type AdminTab = 'approval' | 'users' | 'reviews' | 'feedbacks';

interface CurrentAdmin {
    id: number;
    username: string;
    name: string;
    department: string | null;
}

interface AdminUserItem {
    id: number;
    username: string;
    name: string;
    department: string | null;
    orgType: string;
    phone: string | null;
    role: string;
    status: string;
    createdAt: string;
    reviewCount: number;
}

interface AdminReviewItem {
    id: string;
    fileName: string;
    status: string;
    riskCount: number;
    createdAt: string;
    summary: string | null;
    user?: {
        name: string;
        department: string | null;
        orgType?: string | null;
        phone?: string | null;
    } | null;
}

interface ReviewStats {
    totalFiles: number;
    completedFiles: number;
    failedFiles: number;
    totalRisks: number;
    ignoredFiles: number;
    activeUsers: number;
}

const VALID_TABS: readonly AdminTab[] = ['approval', 'users', 'reviews', 'feedbacks'];

const STATUS_META: Record<string, { label: string; className: string }> = {
    active: { label: '正常', className: styles.statusActive },
    pending: { label: '待审批', className: styles.statusPending },
    disabled: { label: '已禁用', className: styles.statusDisabled },
    rejected: { label: '未通过', className: styles.statusRejected },
};

const REVIEW_STATUS_LABELS: Record<string, { label: string; color: string }> = {
    completed: { label: '● 已完成', color: '#10b981' },
    ignored: { label: '● 无需审查', color: '#9ca3af' },
    failed: { label: '● 失败', color: '#ef4444' },
    processing: { label: '● 审查中', color: '#2563eb' },
    pending: { label: '● 待处理', color: '#f59e0b' },
};

function getOrgTypeLabel(orgType?: string | null): string {
    if (orgType && isValidOrgType(orgType)) {
        return ORG_TYPE_LABELS[orgType];
    }
    return '区级部门';
}

function getOrgBadgeClass(orgType?: string | null): string {
    if (orgType === 'town') return styles.orgTown;
    if (orgType === 'agency') return styles.orgAgency;
    return styles.orgGov;
}

function getCategoryLabel(summary: string | null): string {
    if (!summary) return '-';
    const match = summary.match(/文件类型：([^。、\s]+)/);
    const category = match ? match[1] : '';

    const categoryMap: Record<string, string> = {
        BIDDING: '招标文件',
        SUBSIDY: '补贴政策',
        MARKET_ACCESS: '市场准入文件',
        INDUSTRIAL: '产业扶持政策',
        SPECIAL_FUND: '专项资金文件',
        IGNORE: '非政策文件',
        POLICY: '政策文件',
        AGREEMENT: '行政协议',
    };

    return categoryMap[category] || category || '政策文件';
}

function getReviewStatusText(status: string): string {
    if (status === 'completed') return '已完成';
    if (status === 'ignored') return '无需审查';
    if (status === 'processing') return '审查中';
    if (status === 'pending') return '待处理';
    return '失败';
}

function renderDepartmentInput(
    orgType: OrgType,
    value: string,
    onChange: (val: string) => void,
    required: boolean
) {
    if (orgType === 'town') {
        const inList = (TOWN_LIST as readonly string[]).includes(value);
        return (
            <select value={value} onChange={(e) => onChange(e.target.value)} required={required}>
                <option value="">请选择所属镇街</option>
                {value && !inList && <option value={value}>{value}（历史名称）</option>}
                {TOWN_LIST.map((town) => (
                    <option key={town} value={town}>{town}</option>
                ))}
            </select>
        );
    }
    if (orgType === 'gov') {
        const inList = (GOV_DEPT_LIST as readonly string[]).includes(value);
        return (
            <select value={value} onChange={(e) => onChange(e.target.value)} required={required}>
                <option value="">请选择区级部门</option>
                {value && !inList && <option value={value}>{value}</option>}
                {GOV_DEPT_LIST.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                ))}
            </select>
        );
    }
    return (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="请输入招标代理公司全称（4-64个字符）"
            required={required}
            minLength={required ? 4 : undefined}
            maxLength={64}
        />
    );
}

function AdminContent({ currentAdmin }: { currentAdmin: CurrentAdmin }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlTab = searchParams.get('tab');
    const hasExplicitTab = Boolean(urlTab && (VALID_TABS as readonly string[]).includes(urlTab));

    const [activeTab, setActiveTab] = useState<AdminTab>(
        hasExplicitTab ? (urlTab as AdminTab) : 'users'
    );
    const hasResolvedDefaultTab = useRef(hasExplicitTab);

    const [users, setUsers] = useState<AdminUserItem[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [actionBusyId, setActionBusyId] = useState<number | null>(null);

    // User Filters
    const [userSearch, setUserSearch] = useState('');
    const [userOrgFilter, setUserOrgFilter] = useState<string>('all');
    const [userStatusFilter, setUserStatusFilter] = useState<string>('all');

    // Create User Modal
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newUser, setNewUser] = useState<{
        username: string;
        password: string;
        name: string;
        orgType: OrgType;
        department: string;
        phone: string;
        role: 'user' | 'admin';
    }>({
        username: '',
        password: '',
        name: '',
        orgType: 'town',
        department: '',
        phone: '',
        role: 'user',
    });

    // Edit User Modal
    const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);
    const [editForm, setEditForm] = useState<{
        name: string;
        orgType: OrgType;
        department: string;
        phone: string;
    }>({
        name: '',
        orgType: 'town',
        department: '',
        phone: '',
    });

    // Temp Password Modal
    const [tempPasswordInfo, setTempPasswordInfo] = useState<{
        username: string;
        name: string;
        password: string;
    } | null>(null);
    const [copiedPassword, setCopiedPassword] = useState(false);

    // Reviews State
    const [reviews, setReviews] = useState<AdminReviewItem[]>([]);
    const [reviewSearch, setReviewSearch] = useState('');
    const [reviewOrgFilter, setReviewOrgFilter] = useState<string>('all');
    const [stats, setStats] = useState<ReviewStats>({
        totalFiles: 0,
        completedFiles: 0,
        failedFiles: 0,
        totalRisks: 0,
        ignoredFiles: 0,
        activeUsers: 0,
    });

    const fetchUserList = useCallback(async () => {
        try {
            const res = await fetch('/api/users', { cache: 'no-store' });
            if (res.status === 401) {
                router.push('/');
                return;
            }
            const data = await res.json();
            if (Array.isArray(data)) {
                setUsers(data);
                if (!hasResolvedDefaultTab.current) {
                    hasResolvedDefaultTab.current = true;
                    const hasPending = data.some((u: AdminUserItem) => u.status === 'pending');
                    setActiveTab(hasPending ? 'approval' : 'users');
                }
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoadingUsers(false);
        }
    }, [router]);

    const fetchReviewsAndStats = useCallback(async () => {
        try {
            const [reviewsRes, statsRes] = await Promise.all([
                fetch('/api/reviews?mode=admin&all=true', { cache: 'no-store' }),
                fetch('/api/reviews/stats', { cache: 'no-store' }),
            ]);
            if (reviewsRes.ok) {
                const reviewsData = await reviewsRes.json();
                if (Array.isArray(reviewsData)) setReviews(reviewsData);
            }
            if (statsRes.ok) {
                const statsData = await statsRes.json();
                if (statsData && !statsData.error) setStats(statsData);
            }
        } catch (err) {
            console.error('Failed to fetch reviews/stats:', err);
        }
    }, []);

    useEffect(() => {
        fetchUserList();
    }, [fetchUserList]);

    useEffect(() => {
        if (urlTab && (VALID_TABS as readonly string[]).includes(urlTab)) {
            hasResolvedDefaultTab.current = true;
            setActiveTab(urlTab as AdminTab);
        }
    }, [urlTab]);

    useEffect(() => {
        if (activeTab === 'reviews') {
            fetchReviewsAndStats();
        }
    }, [activeTab, fetchReviewsAndStats]);

    const handleTabChange = (tab: AdminTab) => {
        hasResolvedDefaultTab.current = true;
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.push(`?${params.toString()}`);
    };

    const pendingUsers = useMemo(
        () => users.filter((u) => u.status === 'pending'),
        [users]
    );

    const filteredUsers = useMemo(() => {
        const q = userSearch.trim().toLowerCase();
        return users.filter((u) => {
            if (userOrgFilter !== 'all' && u.orgType !== userOrgFilter) return false;
            if (userStatusFilter !== 'all' && u.status !== userStatusFilter) return false;
            if (!q) return true;
            return (
                u.name.toLowerCase().includes(q) ||
                u.username.toLowerCase().includes(q) ||
                (u.phone || '').toLowerCase().includes(q) ||
                (u.department || '').toLowerCase().includes(q)
            );
        });
    }, [users, userSearch, userOrgFilter, userStatusFilter]);

    const filteredReviews = useMemo(() => {
        const q = reviewSearch.trim().toLowerCase();
        return reviews.filter((r) => {
            if (reviewOrgFilter !== 'all' && (r.user?.orgType || 'gov') !== reviewOrgFilter) {
                return false;
            }
            if (!q) return true;
            return (
                r.fileName.toLowerCase().includes(q) ||
                (r.user?.name || '').toLowerCase().includes(q) ||
                (r.user?.department || '').toLowerCase().includes(q)
            );
        });
    }, [reviews, reviewSearch, reviewOrgFilter]);

    const handleStatusAction = async (
        user: AdminUserItem,
        action: 'approve' | 'reject' | 'enable' | 'disable'
    ) => {
        if (action === 'reject' && !confirm(`确定拒绝用户「${user.name} (${user.username})」的注册申请吗？`)) {
            return;
        }
        if (action === 'disable' && !confirm(`确定禁用账号「${user.name} (${user.username})」吗？禁用后该账号的现有登录态将立即失效。`)) {
            return;
        }

        setActionBusyId(user.id);
        try {
            const res = await fetch(`/api/users/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            const data = await res.json();
            if (res.ok) {
                await fetchUserList();
            } else {
                alert(data.error || '操作失败');
            }
        } catch (err) {
            console.error('Status action error:', err);
            alert('网络错误，请重试');
        } finally {
            setActionBusyId(null);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newUser.phone.trim() && !isValidPhone(newUser.phone)) {
            alert('请输入有效的 11 位手机号码');
            return;
        }
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser),
            });
            const data = await res.json();
            if (res.ok) {
                alert('账号创建成功');
                setIsCreateModalOpen(false);
                setNewUser({
                    username: '',
                    password: '',
                    name: '',
                    orgType: 'town',
                    department: '',
                    phone: '',
                    role: 'user',
                });
                fetchUserList();
            } else {
                alert('创建失败：' + (data.error || '未知错误'));
            }
        } catch (err) {
            console.error('Create user error:', err);
            alert('创建失败，请重试');
        }
    };

    const openEditModal = (user: AdminUserItem) => {
        const resolvedOrgType: OrgType = isValidOrgType(user.orgType) ? user.orgType : 'gov';
        setEditingUser(user);
        setEditForm({
            name: user.name,
            orgType: resolvedOrgType,
            department: user.department || '',
            phone: user.phone || '',
        });
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        if (editForm.phone.trim() && !isValidPhone(editForm.phone)) {
            alert('请输入有效的 11 位手机号码');
            return;
        }

        try {
            const res = await fetch(`/api/users/${editingUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            });
            const data = await res.json();
            if (res.ok) {
                setEditingUser(null);
                fetchUserList();
            } else {
                alert('保存失败：' + (data.error || '未知错误'));
            }
        } catch (err) {
            console.error('Update user error:', err);
            alert('保存失败，请重试');
        }
    };

    const handleResetPassword = async (user: AdminUserItem) => {
        if (!confirm(`确定为「${user.name} (${user.username})」重置密码吗？系统将生成一次性随机临时密码，并使该账号旧登录态立即失效。`)) {
            return;
        }
        try {
            const res = await fetch('/api/users/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
            });
            const data = await res.json();
            if (res.ok && data.tempPassword) {
                setCopiedPassword(false);
                setTempPasswordInfo({
                    username: user.username,
                    name: user.name,
                    password: data.tempPassword,
                });
            } else {
                alert('重置失败：' + (data.error || '未知错误'));
            }
        } catch (err) {
            console.error('Reset password error:', err);
            alert('操作失败，请重试');
        }
    };

    const handleCopyPassword = async () => {
        if (!tempPasswordInfo) return;
        try {
            await navigator.clipboard.writeText(tempPasswordInfo.password);
            setCopiedPassword(true);
        } catch {
            alert('复制失败，请手动选中复制');
        }
    };

    const handleDeleteUser = async (user: AdminUserItem) => {
        if (user.reviewCount > 0) {
            alert(`该账号名下已有 ${user.reviewCount} 条历史审查记录，请改用「禁用」以保留台账归属信息`);
            return;
        }
        if (!confirm(`确定要彻底删除用户「${user.name} (${user.username})」吗？此操作无法撤销！`)) {
            return;
        }

        try {
            const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                fetchUserList();
            } else {
                alert(data.error || '删除失败');
            }
        } catch (err) {
            console.error('Delete user error:', err);
            alert('操作失败，请重试');
        }
    };

    const handleDeleteReview = async (id: string) => {
        if (!confirm('确定要删除这条审查记录吗？此操作无法撤销。')) {
            return;
        }
        try {
            const res = await fetch(`/api/reviews/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setReviews((prev) => prev.filter((r) => r.id !== id));
                fetchReviewsAndStats();
            } else {
                const data = await res.json();
                alert(data.error || '删除失败');
            }
        } catch (err) {
            console.error('Delete review error:', err);
            alert('删除失败，请重试');
        }
    };

    const handleExportCsv = async () => {
        try {
            const res = await fetch('/api/reviews?mode=admin&export=true');
            if (!res.ok) throw new Error('Export failed');
            const allRecords: AdminReviewItem[] = await res.json();

            const headers = [
                '文书名称',
                '文书类型',
                '提交人',
                '主体类型',
                '所属单位/代理公司',
                '联系电话',
                '审查状态',
                '风险数',
                '提交时间',
            ];
            const csvRows = [headers.join(',')];

            allRecords.forEach((r) => {
                const row = [
                    `"${r.fileName.replace(/"/g, '""')}"`,
                    `"${getCategoryLabel(r.summary).replace(/"/g, '""')}"`,
                    `"${(r.user?.name || '未知').replace(/"/g, '""')}"`,
                    `"${r.user ? getOrgTypeLabel(r.user.orgType) : '-'}"`,
                    `"${(r.user?.department || '-').replace(/"/g, '""')}"`,
                    `"${(r.user?.phone || '-').replace(/"/g, '""')}"`,
                    `"${getReviewStatusText(r.status)}"`,
                    r.riskCount,
                    `"${new Date(r.createdAt).toLocaleString()}"`,
                ];
                csvRows.push(row.join(','));
            });

            const csvContent = '\uFEFF' + csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `招投标公平竞争审查台账_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export CSV error:', err);
            alert('导出失败，请重试');
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.logoArea}>
                    <div className={styles.logoText}>🛡️ 招投标领域公平竞争审查系统 · 超级管理端</div>
                </div>
                <div className={styles.headerRight}>
                    <span className={styles.adminName}>管理员：{currentAdmin.name}</span>
                    <button
                        type="button"
                        className={styles.backWorkbenchBtn}
                        onClick={() => router.push('/dashboard')}
                    >
                        ← 返回审查工作台
                    </button>
                </div>
            </header>

            <div className={styles.main}>
                <aside className={styles.sidebar}>
                    <button
                        type="button"
                        className={`${styles.menuItem} ${activeTab === 'approval' ? styles.menuItemActive : ''}`}
                        onClick={() => handleTabChange('approval')}
                    >
                        <span className={styles.menuItemLabel}>
                            <span>✅</span> 用户审批
                        </span>
                        {pendingUsers.length > 0 && (
                            <span className={styles.menuBadge}>{pendingUsers.length}</span>
                        )}
                    </button>
                    <button
                        type="button"
                        className={`${styles.menuItem} ${activeTab === 'users' ? styles.menuItemActive : ''}`}
                        onClick={() => handleTabChange('users')}
                    >
                        <span className={styles.menuItemLabel}>
                            <span>👥</span> 用户管理
                        </span>
                    </button>
                    <button
                        type="button"
                        className={`${styles.menuItem} ${activeTab === 'reviews' ? styles.menuItemActive : ''}`}
                        onClick={() => handleTabChange('reviews')}
                    >
                        <span className={styles.menuItemLabel}>
                            <span>📑</span> 审查台账
                        </span>
                    </button>
                    <button
                        type="button"
                        className={`${styles.menuItem} ${activeTab === 'feedbacks' ? styles.menuItemActive : ''}`}
                        onClick={() => handleTabChange('feedbacks')}
                    >
                        <span className={styles.menuItemLabel}>
                            <span>💬</span> 反馈审核
                        </span>
                    </button>
                </aside>

                <main className={styles.content}>
                    {activeTab === 'approval' && (
                        <>
                            <div className={styles.sectionHeaderRow}>
                                <div>
                                    <h1 className={styles.sectionTitle}>待审批注册申请</h1>
                                    <p className={styles.sectionSub}>核实镇街、区级部门及招标代理公司提交的账号开通申请</p>
                                </div>
                            </div>
                            <div className={styles.card}>
                                {loadingUsers ? (
                                    <div className={styles.emptyState}>正在加载申请列表...</div>
                                ) : pendingUsers.length === 0 ? (
                                    <div className={styles.emptyState}>🎉 暂无待审批的注册申请</div>
                                ) : (
                                    <div className={styles.approvalList}>
                                        {pendingUsers.map((u) => (
                                            <div key={u.id} className={styles.approvalItem}>
                                                <div className={styles.approvalInfo}>
                                                    <div className={styles.approvalTop}>
                                                        <span className={styles.approvalName}>{u.name}</span>
                                                        <span className={styles.approvalUsername}>@{u.username}</span>
                                                        <span className={`${styles.tag} ${getOrgBadgeClass(u.orgType)}`}>
                                                            {getOrgTypeLabel(u.orgType)}
                                                        </span>
                                                    </div>
                                                    <div className={styles.approvalMeta}>
                                                        <span>🏢 {u.department || '-'}</span>
                                                        <span>📱 {u.phone || '未填写'}</span>
                                                        <span>🕒 申请时间：{new Date(u.createdAt).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                                <div className={styles.approvalActions}>
                                                    <button
                                                        type="button"
                                                        className={styles.approveBtn}
                                                        disabled={actionBusyId === u.id}
                                                        onClick={() => handleStatusAction(u, 'approve')}
                                                    >
                                                        ✓ 通过
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.rejectBtn}
                                                        disabled={actionBusyId === u.id}
                                                        onClick={() => handleStatusAction(u, 'reject')}
                                                    >
                                                        拒绝
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === 'users' && (
                        <>
                            <div className={styles.sectionHeaderRow}>
                                <div>
                                    <h1 className={styles.sectionTitle}>系统用户管理</h1>
                                    <p className={styles.sectionSub}>管理镇街经办、区级部门及招标代理机构账号与权限</p>
                                </div>
                                <button
                                    type="button"
                                    className={styles.actionBtn}
                                    onClick={() => setIsCreateModalOpen(true)}
                                >
                                    + 新增账号
                                </button>
                            </div>

                            <div className={styles.card}>
                                <div className={styles.toolbar}>
                                    <input
                                        type="text"
                                        className={styles.searchInput}
                                        placeholder="搜索姓名 / 用户名 / 手机号 / 单位名称..."
                                        value={userSearch}
                                        onChange={(e) => setUserSearch(e.target.value)}
                                    />
                                    <select
                                        className={styles.filterSelect}
                                        value={userOrgFilter}
                                        onChange={(e) => setUserOrgFilter(e.target.value)}
                                    >
                                        <option value="all">全部主体类型</option>
                                        <option value="town">镇街</option>
                                        <option value="agency">招标代理公司</option>
                                        <option value="gov">区级部门</option>
                                    </select>
                                    <select
                                        className={styles.filterSelect}
                                        value={userStatusFilter}
                                        onChange={(e) => setUserStatusFilter(e.target.value)}
                                    >
                                        <option value="all">全部状态</option>
                                        <option value="active">正常</option>
                                        <option value="pending">待审批</option>
                                        <option value="disabled">已禁用</option>
                                        <option value="rejected">未通过</option>
                                    </select>
                                    <span className={styles.countText}>
                                        当前 {filteredUsers.length} / 共 {users.length} 个账号
                                    </span>
                                </div>

                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>姓名 / 账号</th>
                                                <th>主体类型</th>
                                                <th>所属单位 / 公司</th>
                                                <th>手机号</th>
                                                <th>审查次数</th>
                                                <th>状态</th>
                                                <th>操作</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsers.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className={styles.emptyState}>
                                                        暂无符合条件的账号
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredUsers.map((u) => {
                                                    const statusMeta = STATUS_META[u.status] || {
                                                        label: u.status,
                                                        className: styles.statusDisabled,
                                                    };
                                                    const isAdminUser = u.role === 'admin';
                                                    return (
                                                        <tr key={u.id}>
                                                            <td>
                                                                <div style={{ fontWeight: 600, color: '#0f172a' }}>
                                                                    {u.name}
                                                                    {isAdminUser && (
                                                                        <span style={{ marginLeft: 6, fontSize: 11, color: '#2563eb' }}>[管理员]</span>
                                                                    )}
                                                                </div>
                                                                <div style={{ fontSize: 12, color: '#64748b' }}>@{u.username}</div>
                                                            </td>
                                                            <td>
                                                                <span className={`${styles.tag} ${getOrgBadgeClass(u.orgType)}`}>
                                                                    {getOrgTypeLabel(u.orgType)}
                                                                </span>
                                                            </td>
                                                            <td>{u.department || '-'}</td>
                                                            <td>{u.phone || '-'}</td>
                                                            <td>{u.reviewCount}</td>
                                                            <td>
                                                                <span className={`${styles.tag} ${statusMeta.className}`}>
                                                                    {statusMeta.label}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {isAdminUser ? (
                                                                    <span style={{ fontSize: 12, color: '#9ca3af' }}>系统管理员</span>
                                                                ) : (
                                                                    <div className={styles.opGroup}>
                                                                        <button
                                                                            type="button"
                                                                            className={`${styles.opBtn} ${styles.opPrimary}`}
                                                                            onClick={() => openEditModal(u)}
                                                                        >
                                                                            编辑资料
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className={`${styles.opBtn} ${styles.opWarn}`}
                                                                            onClick={() => handleResetPassword(u)}
                                                                        >
                                                                            重置密码
                                                                        </button>
                                                                        {u.status === 'active' && (
                                                                            <button
                                                                                type="button"
                                                                                className={`${styles.opBtn} ${styles.opDanger}`}
                                                                                disabled={actionBusyId === u.id}
                                                                                onClick={() => handleStatusAction(u, 'disable')}
                                                                            >
                                                                                禁用
                                                                            </button>
                                                                        )}
                                                                        {u.status === 'disabled' && (
                                                                            <button
                                                                                type="button"
                                                                                className={`${styles.opBtn} ${styles.opSuccess}`}
                                                                                disabled={actionBusyId === u.id}
                                                                                onClick={() => handleStatusAction(u, 'enable')}
                                                                            >
                                                                                启用
                                                                            </button>
                                                                        )}
                                                                        {(u.status === 'pending' || u.status === 'rejected') && (
                                                                            <button
                                                                                type="button"
                                                                                className={`${styles.opBtn} ${styles.opSuccess}`}
                                                                                disabled={actionBusyId === u.id}
                                                                                onClick={() => handleStatusAction(u, 'approve')}
                                                                            >
                                                                                通过
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            className={`${styles.opBtn} ${u.reviewCount > 0 ? styles.opMuted : styles.opDanger}`}
                                                                            onClick={() => handleDeleteUser(u)}
                                                                        >
                                                                            删除
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'reviews' && (
                        <>
                            <div className={styles.sectionHeaderRow}>
                                <div>
                                    <h1 className={styles.sectionTitle}>全局审查台账</h1>
                                    <p className={styles.sectionSub}>查看全区各单位及代理公司提交的招标文书审查明细并导出报表</p>
                                </div>
                            </div>

                            <div className={styles.statGrid}>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>总审查文书数</span>
                                    <span className={styles.statValue}>{stats.totalFiles}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>活跃提交账号数</span>
                                    <span className={styles.statValue} style={{ color: '#2563eb' }}>{stats.activeUsers || 0}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>发现风险点总数</span>
                                    <span className={styles.statValue} style={{ color: '#ef4444' }}>{stats.totalRisks}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>已完成审查</span>
                                    <span className={styles.statValue} style={{ color: '#10b981' }}>{stats.completedFiles}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>无需审查</span>
                                    <span className={styles.statValue} style={{ color: '#6b7280' }}>{stats.ignoredFiles}</span>
                                </div>
                            </div>

                            <div className={styles.card}>
                                <div className={styles.toolbar}>
                                    <input
                                        type="text"
                                        className={styles.searchInput}
                                        placeholder="搜索文书名称 / 提交人姓名 / 所属单位..."
                                        value={reviewSearch}
                                        onChange={(e) => setReviewSearch(e.target.value)}
                                    />
                                    <select
                                        className={styles.filterSelect}
                                        value={reviewOrgFilter}
                                        onChange={(e) => setReviewOrgFilter(e.target.value)}
                                    >
                                        <option value="all">全部主体类型</option>
                                        <option value="town">镇街</option>
                                        <option value="agency">招标代理公司</option>
                                        <option value="gov">区级部门</option>
                                    </select>
                                    <button
                                        type="button"
                                        className={styles.secondaryBtn}
                                        onClick={handleExportCsv}
                                    >
                                        📤 导出审查台账 CSV
                                    </button>
                                </div>

                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>文书名称</th>
                                                <th>文书类型</th>
                                                <th>提交人 / 单位</th>
                                                <th>主体类型</th>
                                                <th>联系电话</th>
                                                <th>审查状态</th>
                                                <th>风险数</th>
                                                <th>提交时间</th>
                                                <th>操作</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredReviews.length === 0 ? (
                                                <tr>
                                                    <td colSpan={9} className={styles.emptyState}>
                                                        暂无符合条件的审查记录
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredReviews.map((record) => {
                                                    const statusBadge = REVIEW_STATUS_LABELS[record.status] || {
                                                        label: `● ${record.status}`,
                                                        color: '#6b7280',
                                                    };
                                                    return (
                                                        <tr key={record.id}>
                                                            <td
                                                                style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                                title={record.fileName}
                                                            >
                                                                {record.fileName}
                                                            </td>
                                                            <td>
                                                                <span className={styles.tag} style={{ background: '#f1f5f9', color: '#475569' }}>
                                                                    {getCategoryLabel(record.summary)}
                                                                </span>
                                                            </td>
                                                            <td style={{ fontSize: 13 }}>
                                                                {record.user ? (
                                                                    <div>
                                                                        <div style={{ fontWeight: 500 }}>{record.user.name}</div>
                                                                        {record.user.department && (
                                                                            <div style={{ fontSize: 12, color: '#6b7280' }}>{record.user.department}</div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span style={{ color: '#9ca3af' }}>-</span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                {record.user ? (
                                                                    <span className={`${styles.tag} ${getOrgBadgeClass(record.user.orgType)}`}>
                                                                        {getOrgTypeLabel(record.user.orgType)}
                                                                    </span>
                                                                ) : (
                                                                    '-'
                                                                )}
                                                            </td>
                                                            <td style={{ fontSize: 13 }}>{record.user?.phone || '-'}</td>
                                                            <td>
                                                                <span style={{ color: statusBadge.color, fontSize: 13 }}>
                                                                    {statusBadge.label}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {record.riskCount > 0 ? (
                                                                    <span style={{ color: '#ef4444', fontWeight: 700 }}>{record.riskCount}</span>
                                                                ) : (
                                                                    <span style={{ color: '#10b981' }}>0</span>
                                                                )}
                                                            </td>
                                                            <td style={{ fontSize: 13, color: '#6b7280' }}>
                                                                {new Date(record.createdAt).toLocaleString()}
                                                            </td>
                                                            <td>
                                                                <div className={styles.opGroup}>
                                                                    <button
                                                                        type="button"
                                                                        className={`${styles.opBtn} ${styles.opPrimary}`}
                                                                        onClick={() => router.push(`/review/${record.id}?backUrl=${encodeURIComponent('/admin?tab=reviews')}`)}
                                                                    >
                                                                        查看
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className={`${styles.opBtn} ${styles.opDanger}`}
                                                                        onClick={() => handleDeleteReview(record.id)}
                                                                    >
                                                                        删除
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'feedbacks' && <FeedbackReviewPanel />}
                </main>
            </div>

            {/* Create User Modal */}
            {isCreateModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsCreateModalOpen(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h2 className={styles.modalTitle}>新增系统账号</h2>
                        <form onSubmit={handleCreateUser}>
                            <div className={styles.formGroup}>
                                <label>角色</label>
                                <select
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'user' | 'admin' })}
                                >
                                    <option value="user">普通用户</option>
                                    <option value="admin">管理员</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>主体类型</label>
                                <select
                                    value={newUser.orgType}
                                    onChange={(e) => setNewUser({ ...newUser, orgType: e.target.value as OrgType, department: '' })}
                                >
                                    <option value="town">镇街</option>
                                    <option value="agency">招标代理公司</option>
                                    <option value="gov">区级部门</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>
                                    {newUser.orgType === 'town'
                                        ? '所属镇街'
                                        : newUser.orgType === 'agency'
                                            ? '招标代理公司全称'
                                            : '所属区级部门'}
                                    {newUser.role === 'admin' && '（管理员选填）'}
                                </label>
                                {renderDepartmentInput(
                                    newUser.orgType,
                                    newUser.department,
                                    (department) => setNewUser({ ...newUser, department }),
                                    newUser.role !== 'admin'
                                )}
                            </div>
                            <div className={styles.formGroup}>
                                <label>真实姓名</label>
                                <input
                                    type="text"
                                    required
                                    minLength={2}
                                    maxLength={32}
                                    value={newUser.name}
                                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                    placeholder="2-32位姓名"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>手机号码（选填）</label>
                                <input
                                    type="tel"
                                    maxLength={11}
                                    value={newUser.phone}
                                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                                    placeholder="11位手机号"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>登录用户名</label>
                                <input
                                    type="text"
                                    required
                                    minLength={3}
                                    maxLength={32}
                                    value={newUser.username}
                                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                    placeholder="3-32位字母、数字、下划线或连字符"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>初始密码</label>
                                <input
                                    type="password"
                                    required
                                    minLength={8}
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    placeholder="至少8位，含字母/数字/符号中的两种"
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setIsCreateModalOpen(false)}>
                                    取消
                                </button>
                                <button type="submit" className={styles.actionBtn}>
                                    创建账号
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {editingUser && (
                <div className={styles.modalOverlay} onClick={() => setEditingUser(null)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h2 className={styles.modalTitle}>编辑账号资料（@{editingUser.username}）</h2>
                        <form onSubmit={handleSaveEdit}>
                            <div className={styles.formGroup}>
                                <label>真实姓名</label>
                                <input
                                    type="text"
                                    required
                                    minLength={2}
                                    maxLength={32}
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>主体类型</label>
                                <select
                                    value={editForm.orgType}
                                    onChange={(e) => setEditForm({ ...editForm, orgType: e.target.value as OrgType, department: '' })}
                                >
                                    <option value="town">镇街</option>
                                    <option value="agency">招标代理公司</option>
                                    <option value="gov">区级部门</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>
                                    {editForm.orgType === 'town'
                                        ? '所属镇街'
                                        : editForm.orgType === 'agency'
                                            ? '招标代理公司全称'
                                            : '所属区级部门'}
                                </label>
                                {renderDepartmentInput(
                                    editForm.orgType,
                                    editForm.department,
                                    (department) => setEditForm({ ...editForm, department }),
                                    true
                                )}
                            </div>
                            <div className={styles.formGroup}>
                                <label>手机号码</label>
                                <input
                                    type="tel"
                                    maxLength={11}
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                    placeholder="11位手机号（可留空）"
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setEditingUser(null)}>
                                    取消
                                </button>
                                <button type="submit" className={styles.actionBtn}>
                                    保存修改
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Temp Password Modal */}
            {tempPasswordInfo && (
                <div className={styles.modalOverlay} onClick={() => setTempPasswordInfo(null)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h2 className={styles.modalTitle}>密码重置成功</h2>
                        <p style={{ fontSize: 14, color: '#475569', margin: '0 0 8px 0' }}>
                            已为 <strong>{tempPasswordInfo.name}（@{tempPasswordInfo.username}）</strong> 生成一次性临时密码，该账号原有登录会话已立即吊销。请妥善转告用户并在登录后及时修改密码：
                        </p>
                        <div className={styles.tempPasswordBox}>
                            <div className={styles.tempPasswordCode}>{tempPasswordInfo.password}</div>
                        </div>
                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={handleCopyPassword}
                            >
                                {copiedPassword ? '✓ 已复制' : '复制密码'}
                            </button>
                            <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => setTempPasswordInfo(null)}
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AdminClient({ currentAdmin }: { currentAdmin: CurrentAdmin }) {
    return (
        <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}>正在加载超级管理端...</div>}>
            <AdminContent currentAdmin={currentAdmin} />
        </Suspense>
    );
}
