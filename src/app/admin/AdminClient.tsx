'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './admin.module.css';
import kit from '@/components/ui/kit.module.css';
import BrandSeal from '@/components/ui/BrandSeal';
import CustomSelect, { type SelectOption } from '@/components/ui/CustomSelect';
import OrgPicker from '@/components/ui/OrgPicker';
import {
    AlertTriangleIcon,
    ArrowLeftIcon,
    BanIcon,
    BuildingIcon,
    CheckCircleIcon,
    CheckIcon,
    ClockIcon,
    CloseIcon,
    CopyIcon,
    DownloadIcon,
    EditIcon,
    EyeIcon,
    FileTextIcon,
    FilterIcon,
    KeyIcon,
    LedgerIcon,
    LockIcon,
    MessageIcon,
    PhoneIcon,
    PlusIcon,
    SearchIcon,
    ShieldAdminIcon,
    TrashIcon,
    UserCheckIcon,
    UserPlusIcon,
    UsersIcon,
} from '@/components/ui/Icons';
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
    active: { label: '正常', className: kit.toneOk },
    pending: { label: '待审批', className: kit.toneMid },
    disabled: { label: '已禁用', className: kit.toneMuted },
    rejected: { label: '未通过', className: kit.toneHigh },
};

const REVIEW_STATUS_LABELS: Record<string, { label: string; className: string; pulse?: boolean }> = {
    completed: { label: '已完成', className: kit.toneOk },
    ignored: { label: '无需审查', className: kit.toneMuted },
    failed: { label: '失败', className: kit.toneHigh },
    processing: { label: '审查中', className: kit.toneLow, pulse: true },
    pending: { label: '待处理', className: kit.toneMid },
};

const ORG_FILTER_OPTIONS: readonly SelectOption[] = [
    { value: 'all', label: '全部主体类型' },
    { value: 'town', label: '镇街' },
    { value: 'agency', label: '招标代理公司' },
    { value: 'gov', label: '区级部门' },
];

const STATUS_FILTER_OPTIONS: readonly SelectOption[] = [
    { value: 'all', label: '全部状态' },
    { value: 'active', label: '正常' },
    { value: 'pending', label: '待审批' },
    { value: 'disabled', label: '已禁用' },
    { value: 'rejected', label: '未通过' },
];

const ORG_TYPE_OPTIONS: readonly SelectOption<OrgType>[] = [
    { value: 'town', label: '镇街' },
    { value: 'agency', label: '招标代理公司' },
    { value: 'gov', label: '区级部门' },
];

const ROLE_OPTIONS: readonly SelectOption<'user' | 'admin'>[] = [
    { value: 'user', label: '普通用户', hint: '提交审查' },
    { value: 'admin', label: '管理员', hint: '后台权限' },
];

function getInitial(name: string): string {
    return name.trim().charAt(0) || '?';
}

function getOrgTypeLabel(orgType?: string | null): string {
    if (orgType && isValidOrgType(orgType)) {
        return ORG_TYPE_LABELS[orgType];
    }
    return '区级部门';
}

function getOrgBadgeClass(orgType?: string | null): string {
    if (orgType === 'town') return kit.toneBrand;
    if (orgType === 'agency') return kit.toneSeal;
    return kit.toneLow;
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
        return (
            <OrgPicker
                value={value}
                onChange={onChange}
                options={TOWN_LIST}
                title="选择所属镇街"
                unitLabel="镇街"
                placeholder="请选择所属镇街"
                required={required}
                aria-label="所属镇街"
            />
        );
    }
    if (orgType === 'gov') {
        return (
            <OrgPicker
                value={value}
                onChange={onChange}
                options={GOV_DEPT_LIST}
                title="选择所属区级部门"
                unitLabel="部门"
                placeholder="请选择区级部门"
                required={required}
                aria-label="所属区级部门"
            />
        );
    }
    return (
        <input
            type="text"
            className={kit.input}
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

    const navItems: { key: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
        { key: 'approval', label: '用户审批', icon: <UserCheckIcon size={18} />, badge: pendingUsers.length },
        { key: 'users', label: '用户管理', icon: <UsersIcon size={18} /> },
        { key: 'reviews', label: '审查台账', icon: <LedgerIcon size={18} /> },
        { key: 'feedbacks', label: '反馈审核', icon: <MessageIcon size={18} /> },
    ];

    const statCards: { label: string; value: number; icon: React.ReactNode; tone: string; unit: string }[] = [
        { label: '总审查文书数', value: stats.totalFiles, icon: <FileTextIcon size={15} />, tone: styles.statBrand, unit: '份' },
        { label: '活跃提交账号数', value: stats.activeUsers || 0, icon: <UsersIcon size={15} />, tone: styles.statLow, unit: '个' },
        { label: '发现风险点总数', value: stats.totalRisks, icon: <AlertTriangleIcon size={15} />, tone: styles.statHigh, unit: '处' },
        { label: '已完成审查', value: stats.completedFiles, icon: <CheckCircleIcon size={15} />, tone: styles.statOk, unit: '份' },
        { label: '无需审查', value: stats.ignoredFiles, icon: <BanIcon size={15} />, tone: styles.statMuted, unit: '份' },
    ];

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.brand}>
                    <BrandSeal char="审" size={34} variant="onDark" />
                    <div className={styles.brandText}>
                        <span className={styles.brandTitle}>
                            招投标领域公平竞争审查系统<span className={styles.brandDot}>·</span>管理后台
                        </span>
                        <span className={styles.brandSub}>FAIR COMPETITION REVIEW · ADMINISTRATION</span>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.adminInfo}>
                        <span className={styles.adminAvatar}>{getInitial(currentAdmin.name)}</span>
                        <span className={styles.adminMeta}>
                            <span className={styles.adminName}>{currentAdmin.name}</span>
                            <span className={styles.adminRole}>
                                <ShieldAdminIcon size={12} /> 系统管理员
                            </span>
                        </span>
                    </div>
                    <span className={styles.headerDivider} aria-hidden="true" />
                    <button
                        type="button"
                        className={styles.backBtn}
                        onClick={() => router.push('/dashboard')}
                    >
                        <ArrowLeftIcon size={15} />
                        返回审查工作台
                    </button>
                </div>
            </header>

            <div className={styles.main}>
                <aside className={styles.sidebar}>
                    <div className={styles.navGroupLabel}>管理功能</div>
                    <nav className={styles.nav} aria-label="管理后台导航">
                        {navItems.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                className={`${styles.menuItem} ${activeTab === item.key ? styles.menuItemActive : ''}`}
                                aria-current={activeTab === item.key ? 'page' : undefined}
                                onClick={() => handleTabChange(item.key)}
                            >
                                <span className={styles.menuIcon}>{item.icon}</span>
                                <span className={styles.menuLabel}>{item.label}</span>
                                {item.badge ? <span className={styles.menuBadge}>{item.badge}</span> : null}
                            </button>
                        ))}
                    </nav>
                    <div className={styles.sidebarFoot}>
                        <LockIcon size={13} />
                        <span>账号审批、密码重置与删除操作即时生效，请审慎核对后执行。</span>
                    </div>
                </aside>

                <main className={styles.content}>
                    <div className={styles.contentInner}>
                        {activeTab === 'approval' && (
                            <>
                                <div className={styles.sectionHeaderRow}>
                                    <div>
                                        <div className={styles.sectionEyebrow}>用户审批</div>
                                        <h1 className={styles.sectionTitle}>待审批注册申请</h1>
                                        <p className={styles.sectionSub}>核实镇街、区级部门及招标代理公司提交的账号开通申请</p>
                                    </div>
                                    {!loadingUsers && pendingUsers.length > 0 && (
                                        <span className={`${kit.badge} ${kit.toneMid}`}>
                                            <span className={kit.dot} />
                                            {pendingUsers.length} 条待处理
                                        </span>
                                    )}
                                </div>

                                {loadingUsers ? (
                                    <div className={kit.card}>
                                        <div className={kit.empty}>
                                            <span className={kit.spinner} />
                                            <span className={kit.emptyDesc}>正在加载申请列表...</span>
                                        </div>
                                    </div>
                                ) : pendingUsers.length === 0 ? (
                                    <div className={kit.card}>
                                        <div className={kit.empty}>
                                            <span className={kit.emptyIcon}><CheckCircleIcon size={24} /></span>
                                            <span className={kit.emptyTitle}>暂无待审批的注册申请</span>
                                            <span className={kit.emptyDesc}>新的账号申请提交后将在此处显示</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.approvalList}>
                                        {pendingUsers.map((u) => (
                                            <div key={u.id} className={styles.approvalItem}>
                                                <div className={styles.approvalTop}>
                                                    <span className={styles.avatar}>{getInitial(u.name)}</span>
                                                    <div className={styles.approvalIdentity}>
                                                        <div className={styles.approvalNameRow}>
                                                            <span className={styles.approvalName}>{u.name}</span>
                                                            <span className={`${kit.badge} ${kit.badgeSquare} ${getOrgBadgeClass(u.orgType)}`}>
                                                                {getOrgTypeLabel(u.orgType)}
                                                            </span>
                                                        </div>
                                                        <span className={styles.username}>@{u.username}</span>
                                                    </div>
                                                </div>
                                                <div className={styles.approvalMeta}>
                                                    <span className={`${styles.metaItem} ${styles.metaWide}`}>
                                                        <BuildingIcon size={14} />
                                                        <span className={styles.metaText} title={u.department || ''}>
                                                            {u.department || '-'}
                                                        </span>
                                                    </span>
                                                    <span className={styles.metaItem}>
                                                        <PhoneIcon size={14} />
                                                        <span className={`${styles.metaText} ${u.phone ? styles.mono : styles.placeholder}`}>
                                                            {u.phone || '未填写'}
                                                        </span>
                                                    </span>
                                                    <span className={styles.metaItem}>
                                                        <ClockIcon size={14} />
                                                        <span className={`${styles.metaText} ${styles.mono}`}>
                                                            {new Date(u.createdAt).toLocaleString()}
                                                        </span>
                                                    </span>
                                                </div>
                                                <div className={styles.approvalActions}>
                                                    <button
                                                        type="button"
                                                        className={`${kit.btn} ${kit.btnSm} ${kit.btnDanger}`}
                                                        disabled={actionBusyId === u.id}
                                                        onClick={() => handleStatusAction(u, 'reject')}
                                                    >
                                                        <CloseIcon size={14} />
                                                        驳回
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`${kit.btn} ${kit.btnSm} ${kit.btnPrimary}`}
                                                        disabled={actionBusyId === u.id}
                                                        onClick={() => handleStatusAction(u, 'approve')}
                                                    >
                                                        <CheckIcon size={14} />
                                                        通过
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === 'users' && (
                            <>
                                <div className={styles.sectionHeaderRow}>
                                    <div>
                                        <div className={styles.sectionEyebrow}>用户管理</div>
                                        <h1 className={styles.sectionTitle}>系统用户管理</h1>
                                        <p className={styles.sectionSub}>管理镇街经办、区级部门及招标代理机构账号与权限</p>
                                    </div>
                                    <button
                                        type="button"
                                        className={`${kit.btn} ${kit.btnPrimary}`}
                                        onClick={() => setIsCreateModalOpen(true)}
                                    >
                                        <PlusIcon size={16} />
                                        新增账号
                                    </button>
                                </div>

                                <div className={`${kit.card} ${styles.cardFlush}`}>
                                    <div className={styles.toolbar}>
                                        <div className={`${kit.inputWrap} ${styles.searchBox}`}>
                                            <input
                                                type="text"
                                                className={`${kit.input} ${kit.inputSm}`}
                                                placeholder="搜索姓名 / 用户名 / 手机号 / 单位名称..."
                                                value={userSearch}
                                                onChange={(e) => setUserSearch(e.target.value)}
                                                aria-label="搜索用户"
                                            />
                                            <span className={kit.inputIcon}><SearchIcon size={15} /></span>
                                        </div>
                                        <div className={styles.filterBox}>
                                            <CustomSelect
                                                value={userOrgFilter}
                                                onChange={setUserOrgFilter}
                                                options={ORG_FILTER_OPTIONS}
                                                size="sm"
                                                icon={<FilterIcon size={14} />}
                                                aria-label="按主体类型筛选"
                                            />
                                        </div>
                                        <div className={styles.filterBox}>
                                            <CustomSelect
                                                value={userStatusFilter}
                                                onChange={setUserStatusFilter}
                                                options={STATUS_FILTER_OPTIONS}
                                                size="sm"
                                                aria-label="按账号状态筛选"
                                            />
                                        </div>
                                        <span className={styles.toolbarSpacer} />
                                        <span className={styles.countText}>
                                            当前 <span className={styles.countNum}>{filteredUsers.length}</span> / 共{' '}
                                            <span className={styles.countNum}>{users.length}</span> 个账号
                                        </span>
                                    </div>

                                    <div className={kit.tableWrap}>
                                        <table className={kit.table}>
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
                                                        <td colSpan={7}>
                                                            <div className={kit.empty}>
                                                                <span className={kit.emptyIcon}><UsersIcon size={24} /></span>
                                                                <span className={kit.emptyTitle}>
                                                                    {loadingUsers ? '正在加载账号列表...' : '暂无符合条件的账号'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredUsers.map((u) => {
                                                        const statusMeta = STATUS_META[u.status] || {
                                                            label: u.status,
                                                            className: kit.toneMuted,
                                                        };
                                                        const isAdminUser = u.role === 'admin';
                                                        return (
                                                            <tr key={u.id}>
                                                                <td>
                                                                    <div className={styles.userCell}>
                                                                        <span className={`${styles.avatar} ${styles.avatarSm}`}>{getInitial(u.name)}</span>
                                                                        <div>
                                                                            <div className={styles.nameRow}>
                                                                                <span className={kit.cellMain}>{u.name}</span>
                                                                                {isAdminUser && (
                                                                                    <span className={`${kit.badge} ${kit.badgeSquare} ${kit.toneBrand}`}>
                                                                                        <ShieldAdminIcon size={11} />
                                                                                        管理员
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className={`${kit.cellSub} ${kit.mono}`}>@{u.username}</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <span className={`${kit.badge} ${kit.badgeSquare} ${getOrgBadgeClass(u.orgType)}`}>
                                                                        {getOrgTypeLabel(u.orgType)}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <div className={styles.deptCell} title={u.department || ''}>
                                                                        {u.department || <span className={styles.placeholder}>-</span>}
                                                                    </div>
                                                                </td>
                                                                <td className={kit.cellNum}>{u.phone || '-'}</td>
                                                                <td className={kit.cellNum}>{u.reviewCount}</td>
                                                                <td>
                                                                    <span className={`${kit.badge} ${statusMeta.className}`}>
                                                                        <span className={kit.dot} />
                                                                        {statusMeta.label}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    {isAdminUser ? (
                                                                        <span className={styles.adminNote}>
                                                                            <LockIcon size={12} />
                                                                            系统管理员
                                                                        </span>
                                                                    ) : (
                                                                        <div className={styles.opGroup}>
                                                                            <button
                                                                                type="button"
                                                                                className={`${styles.opBtn} ${styles.opBrand}`}
                                                                                onClick={() => openEditModal(u)}
                                                                            >
                                                                                <EditIcon size={13} />
                                                                                编辑资料
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className={styles.opBtn}
                                                                                onClick={() => handleResetPassword(u)}
                                                                            >
                                                                                <KeyIcon size={13} />
                                                                                重置密码
                                                                            </button>
                                                                            {u.status === 'active' && (
                                                                                <button
                                                                                    type="button"
                                                                                    className={`${styles.opBtn} ${styles.opDanger}`}
                                                                                    disabled={actionBusyId === u.id}
                                                                                    onClick={() => handleStatusAction(u, 'disable')}
                                                                                >
                                                                                    <BanIcon size={13} />
                                                                                    禁用
                                                                                </button>
                                                                            )}
                                                                            {u.status === 'disabled' && (
                                                                                <button
                                                                                    type="button"
                                                                                    className={`${styles.opBtn} ${styles.opOk}`}
                                                                                    disabled={actionBusyId === u.id}
                                                                                    onClick={() => handleStatusAction(u, 'enable')}
                                                                                >
                                                                                    <CheckCircleIcon size={13} />
                                                                                    启用
                                                                                </button>
                                                                            )}
                                                                            {(u.status === 'pending' || u.status === 'rejected') && (
                                                                                <button
                                                                                    type="button"
                                                                                    className={`${styles.opBtn} ${styles.opOk}`}
                                                                                    disabled={actionBusyId === u.id}
                                                                                    onClick={() => handleStatusAction(u, 'approve')}
                                                                                >
                                                                                    <CheckIcon size={13} />
                                                                                    通过
                                                                                </button>
                                                                            )}
                                                                            <button
                                                                                type="button"
                                                                                className={`${styles.opBtn} ${u.reviewCount > 0 ? styles.opMuted : styles.opDanger}`}
                                                                                title={u.reviewCount > 0 ? '已有审查记录，建议改用禁用' : undefined}
                                                                                onClick={() => handleDeleteUser(u)}
                                                                            >
                                                                                <TrashIcon size={13} />
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
                                        <div className={styles.sectionEyebrow}>审查台账</div>
                                        <h1 className={styles.sectionTitle}>全局审查台账</h1>
                                        <p className={styles.sectionSub}>查看全区各单位及代理公司提交的招标文书审查明细并导出报表</p>
                                    </div>
                                </div>

                                <div className={styles.statGrid}>
                                    {statCards.map((card) => (
                                        <div key={card.label} className={`${styles.statCard} ${card.tone}`}>
                                            <div className={styles.statTop}>
                                                <span className={styles.statLabel}>{card.label}</span>
                                                <span className={styles.statIcon}>{card.icon}</span>
                                            </div>
                                            <span className={styles.statValue}>
                                                {card.value}
                                                <span className={styles.statUnit}>{card.unit}</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className={`${kit.card} ${styles.cardFlush}`}>
                                    <div className={styles.toolbar}>
                                        <div className={`${kit.inputWrap} ${styles.searchBox}`}>
                                            <input
                                                type="text"
                                                className={`${kit.input} ${kit.inputSm}`}
                                                placeholder="搜索文书名称 / 提交人姓名 / 所属单位..."
                                                value={reviewSearch}
                                                onChange={(e) => setReviewSearch(e.target.value)}
                                                aria-label="搜索审查记录"
                                            />
                                            <span className={kit.inputIcon}><SearchIcon size={15} /></span>
                                        </div>
                                        <div className={styles.filterBox}>
                                            <CustomSelect
                                                value={reviewOrgFilter}
                                                onChange={setReviewOrgFilter}
                                                options={ORG_FILTER_OPTIONS}
                                                size="sm"
                                                icon={<FilterIcon size={14} />}
                                                aria-label="按主体类型筛选"
                                            />
                                        </div>
                                        <span className={styles.toolbarSpacer} />
                                        <span className={styles.countText}>
                                            共 <span className={styles.countNum}>{filteredReviews.length}</span> 条记录
                                        </span>
                                        <button
                                            type="button"
                                            className={`${kit.btn} ${kit.btnSm} ${kit.btnSecondary}`}
                                            onClick={handleExportCsv}
                                        >
                                            <DownloadIcon size={15} />
                                            导出审查台账 CSV
                                        </button>
                                    </div>

                                    <div className={kit.tableWrap}>
                                        <table className={kit.table}>
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
                                                        <td colSpan={9}>
                                                            <div className={kit.empty}>
                                                                <span className={kit.emptyIcon}><LedgerIcon size={24} /></span>
                                                                <span className={kit.emptyTitle}>暂无符合条件的审查记录</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredReviews.map((record) => {
                                                        const statusBadge = REVIEW_STATUS_LABELS[record.status] || {
                                                            label: record.status,
                                                            className: kit.toneMuted,
                                                        };
                                                        return (
                                                            <tr key={record.id}>
                                                                <td>
                                                                    <div className={styles.fileCell} title={record.fileName}>
                                                                        <FileTextIcon size={15} />
                                                                        <span className={styles.fileName}>{record.fileName}</span>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <span className={`${kit.badge} ${kit.badgeSquare} ${kit.toneMuted}`}>
                                                                        {getCategoryLabel(record.summary)}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    {record.user ? (
                                                                        <div>
                                                                            <div className={kit.cellMain}>{record.user.name}</div>
                                                                            {record.user.department && (
                                                                                <div className={kit.cellSub}>{record.user.department}</div>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span className={styles.placeholder}>-</span>
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    {record.user ? (
                                                                        <span className={`${kit.badge} ${kit.badgeSquare} ${getOrgBadgeClass(record.user.orgType)}`}>
                                                                            {getOrgTypeLabel(record.user.orgType)}
                                                                        </span>
                                                                    ) : (
                                                                        <span className={styles.placeholder}>-</span>
                                                                    )}
                                                                </td>
                                                                <td className={kit.cellNum}>{record.user?.phone || '-'}</td>
                                                                <td>
                                                                    <span className={`${kit.badge} ${statusBadge.className}`}>
                                                                        <span className={`${kit.dot} ${statusBadge.pulse ? kit.dotPulse : ''}`} />
                                                                        {statusBadge.label}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    {record.riskCount > 0 ? (
                                                                        <span className={styles.riskNum}>{record.riskCount}</span>
                                                                    ) : (
                                                                        <span className={styles.riskZero}>0</span>
                                                                    )}
                                                                </td>
                                                                <td className={kit.cellNum}>
                                                                    {new Date(record.createdAt).toLocaleString()}
                                                                </td>
                                                                <td>
                                                                    <div className={styles.opGroup}>
                                                                        <button
                                                                            type="button"
                                                                            className={`${styles.opBtn} ${styles.opBrand}`}
                                                                            onClick={() => router.push(`/review/${record.id}?backUrl=${encodeURIComponent('/admin?tab=reviews')}`)}
                                                                        >
                                                                            <EyeIcon size={13} />
                                                                            查看
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className={`${styles.opBtn} ${styles.opDanger}`}
                                                                            onClick={() => handleDeleteReview(record.id)}
                                                                        >
                                                                            <TrashIcon size={13} />
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
                    </div>
                </main>
            </div>

            {/* Create User Modal */}
            {isCreateModalOpen && (
                <div className={kit.overlay} onClick={() => setIsCreateModalOpen(false)}>
                    <div
                        className={`${kit.modal} ${kit.modalWide}`}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-create-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className={kit.modalClose}
                            onClick={() => setIsCreateModalOpen(false)}
                            aria-label="关闭"
                        >
                            <CloseIcon size={16} />
                        </button>
                        <div className={kit.modalHeader}>
                            <span className={kit.modalIcon}><UserPlusIcon size={20} /></span>
                            <div className={styles.modalHeaderText}>
                                <h2 id="admin-create-title" className={kit.modalTitle}>新增系统账号</h2>
                                <p className={kit.modalDesc}>由管理员直接开通的账号无需审批，创建后即可登录。</p>
                            </div>
                        </div>
                        <form className={styles.modalForm} onSubmit={handleCreateUser}>
                            <div className={kit.modalBody}>
                                <div className={styles.formGrid}>
                                    <div className={kit.field}>
                                        <span className={kit.label}>角色</span>
                                        <CustomSelect
                                            value={newUser.role}
                                            onChange={(role) => setNewUser({ ...newUser, role })}
                                            options={ROLE_OPTIONS}
                                            icon={<ShieldAdminIcon size={15} />}
                                            aria-label="角色"
                                        />
                                    </div>
                                    <div className={kit.field}>
                                        <span className={kit.label}>主体类型</span>
                                        <CustomSelect
                                            value={newUser.orgType}
                                            onChange={(orgType) => setNewUser({ ...newUser, orgType, department: '' })}
                                            options={ORG_TYPE_OPTIONS}
                                            icon={<BuildingIcon size={15} />}
                                            aria-label="主体类型"
                                        />
                                    </div>
                                    <div className={`${kit.field} ${styles.span2}`}>
                                        <span className={`${kit.label} ${newUser.role !== 'admin' ? kit.labelReq : ''}`}>
                                            {newUser.orgType === 'town'
                                                ? '所属镇街'
                                                : newUser.orgType === 'agency'
                                                    ? '招标代理公司全称'
                                                    : '所属区级部门'}
                                            {newUser.role === 'admin' && <span className={styles.labelHint}>（管理员选填）</span>}
                                        </span>
                                        {renderDepartmentInput(
                                            newUser.orgType,
                                            newUser.department,
                                            (department) => setNewUser({ ...newUser, department }),
                                            newUser.role !== 'admin'
                                        )}
                                    </div>
                                    <label className={kit.field}>
                                        <span className={`${kit.label} ${kit.labelReq}`}>真实姓名</span>
                                        <input
                                            type="text"
                                            className={kit.input}
                                            required
                                            minLength={2}
                                            maxLength={32}
                                            value={newUser.name}
                                            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                            placeholder="2-32位姓名"
                                        />
                                    </label>
                                    <label className={kit.field}>
                                        <span className={kit.label}>
                                            手机号码<span className={styles.labelHint}>（选填）</span>
                                        </span>
                                        <input
                                            type="tel"
                                            className={`${kit.input} ${kit.mono}`}
                                            maxLength={11}
                                            value={newUser.phone}
                                            onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                                            placeholder="11位手机号"
                                        />
                                    </label>
                                    <label className={kit.field}>
                                        <span className={`${kit.label} ${kit.labelReq}`}>登录用户名</span>
                                        <input
                                            type="text"
                                            className={`${kit.input} ${kit.mono}`}
                                            required
                                            minLength={3}
                                            maxLength={32}
                                            value={newUser.username}
                                            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                            placeholder="3-32位字母、数字、下划线或连字符"
                                        />
                                    </label>
                                    <label className={kit.field}>
                                        <span className={`${kit.label} ${kit.labelReq}`}>初始密码</span>
                                        <input
                                            type="password"
                                            className={kit.input}
                                            required
                                            minLength={8}
                                            value={newUser.password}
                                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                            placeholder="至少8位，含字母/数字/符号中的两种"
                                        />
                                    </label>
                                </div>
                            </div>
                            <div className={kit.modalFooter}>
                                <button
                                    type="button"
                                    className={`${kit.btn} ${kit.btnSecondary}`}
                                    onClick={() => setIsCreateModalOpen(false)}
                                >
                                    取消
                                </button>
                                <button type="submit" className={`${kit.btn} ${kit.btnPrimary}`}>
                                    <CheckIcon size={15} />
                                    创建账号
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {editingUser && (
                <div className={kit.overlay} onClick={() => setEditingUser(null)}>
                    <div
                        className={kit.modal}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-edit-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className={kit.modalClose}
                            onClick={() => setEditingUser(null)}
                            aria-label="关闭"
                        >
                            <CloseIcon size={16} />
                        </button>
                        <div className={kit.modalHeader}>
                            <span className={kit.modalIcon}><EditIcon size={19} /></span>
                            <div className={styles.modalHeaderText}>
                                <h2 id="admin-edit-title" className={kit.modalTitle}>
                                    编辑账号资料
                                    <span className={styles.modalUser}>@{editingUser.username}</span>
                                </h2>
                                <p className={kit.modalDesc}>修改姓名、主体类型、所属单位及联系方式。</p>
                            </div>
                        </div>
                        <form className={styles.modalForm} onSubmit={handleSaveEdit}>
                            <div className={kit.modalBody}>
                                <div className={`${styles.formGrid} ${styles.formGridSingle}`}>
                                    <label className={kit.field}>
                                        <span className={`${kit.label} ${kit.labelReq}`}>真实姓名</span>
                                        <input
                                            type="text"
                                            className={kit.input}
                                            required
                                            minLength={2}
                                            maxLength={32}
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        />
                                    </label>
                                    <div className={kit.field}>
                                        <span className={kit.label}>主体类型</span>
                                        <CustomSelect
                                            value={editForm.orgType}
                                            onChange={(orgType) => setEditForm({ ...editForm, orgType, department: '' })}
                                            options={ORG_TYPE_OPTIONS}
                                            icon={<BuildingIcon size={15} />}
                                            aria-label="主体类型"
                                        />
                                    </div>
                                    <div className={kit.field}>
                                        <span className={`${kit.label} ${kit.labelReq}`}>
                                            {editForm.orgType === 'town'
                                                ? '所属镇街'
                                                : editForm.orgType === 'agency'
                                                    ? '招标代理公司全称'
                                                    : '所属区级部门'}
                                        </span>
                                        {renderDepartmentInput(
                                            editForm.orgType,
                                            editForm.department,
                                            (department) => setEditForm({ ...editForm, department }),
                                            true
                                        )}
                                    </div>
                                    <label className={kit.field}>
                                        <span className={kit.label}>手机号码</span>
                                        <input
                                            type="tel"
                                            className={`${kit.input} ${kit.mono}`}
                                            maxLength={11}
                                            value={editForm.phone}
                                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                            placeholder="11位手机号（可留空）"
                                        />
                                    </label>
                                </div>
                            </div>
                            <div className={kit.modalFooter}>
                                <button
                                    type="button"
                                    className={`${kit.btn} ${kit.btnSecondary}`}
                                    onClick={() => setEditingUser(null)}
                                >
                                    取消
                                </button>
                                <button type="submit" className={`${kit.btn} ${kit.btnPrimary}`}>
                                    <CheckIcon size={15} />
                                    保存修改
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Temp Password Modal */}
            {tempPasswordInfo && (
                <div className={kit.overlay} onClick={() => setTempPasswordInfo(null)}>
                    <div
                        className={kit.modal}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-temp-pwd-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className={kit.modalClose}
                            onClick={() => setTempPasswordInfo(null)}
                            aria-label="关闭"
                        >
                            <CloseIcon size={16} />
                        </button>
                        <div className={kit.modalHeader}>
                            <span className={`${kit.modalIcon} ${kit.modalIconWarn}`}><KeyIcon size={20} /></span>
                            <div className={styles.modalHeaderText}>
                                <h2 id="admin-temp-pwd-title" className={kit.modalTitle}>密码重置成功</h2>
                                <p className={kit.modalDesc}>
                                    已为 <strong>{tempPasswordInfo.name}（@{tempPasswordInfo.username}）</strong> 生成一次性临时密码，该账号原有登录会话已立即吊销。
                                </p>
                            </div>
                        </div>
                        <div className={kit.modalBody}>
                            <div className={styles.tempPasswordBox}>
                                <code className={styles.tempPasswordCode}>{tempPasswordInfo.password}</code>
                                <button
                                    type="button"
                                    className={`${kit.btn} ${kit.btnSm} ${kit.btnSecondary} ${copiedPassword ? styles.copiedBtn : ''}`}
                                    onClick={handleCopyPassword}
                                >
                                    {copiedPassword ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                                    {copiedPassword ? '已复制' : '复制密码'}
                                </button>
                            </div>
                            <div className={`${kit.alert} ${kit.alertWarn}`}>
                                <AlertTriangleIcon size={15} />
                                <span>该密码仅在此显示一次，关闭后无法再次查看。请通过安全渠道妥善转告用户，并提醒其登录后及时修改密码。</span>
                            </div>
                        </div>
                        <div className={kit.modalFooter}>
                            <button
                                type="button"
                                className={`${kit.btn} ${kit.btnPrimary}`}
                                onClick={() => setTempPasswordInfo(null)}
                            >
                                我已记录，关闭
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
        <Suspense
            fallback={
                <div className={styles.loadingFallback}>
                    <span className={kit.spinner} />
                    正在加载超级管理端...
                </div>
            }
        >
            <AdminContent currentAdmin={currentAdmin} />
        </Suspense>
    );
}
