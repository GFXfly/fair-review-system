'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './page.module.css';

interface User {
    id: number;
    username: string;
    name: string;
    department: string | null;
    role: string;
    createdAt: string;
}

interface ReviewRecord {
    id: string;
    fileName: string;
    status: string;
    riskCount: number;
    createdAt: string;
    summary: string | null;
    user?: {
        name: string;
        department: string | null;
    };
}
// ... (rest of the file remains same until table header)
<thead>
    <tr>
        <th>文件名称</th>
        <th>提交账号</th>
        <th>审查状态</th>
        <th>风险数</th>
        <th>提交时间</th>
        <th>摘要</th>
        <th>操作</th>
    </tr>
</thead>

export default function AdminPage() {
    return (
        <React.Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading admin dashboard...</div>}>
            <AdminContent />
        </React.Suspense>
    );
}

function AdminContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState('monitor'); // monitor, users, reviews, config
    const [realReviewRecords, setRealReviewRecords] = useState<ReviewRecord[]>([]);
    const [stats, setStats] = useState({
        totalFiles: 0,
        completedFiles: 0,
        failedFiles: 0,
        totalRisks: 0,
        ignoredFiles: 0,
        activeUsers: 0
    });
    const [users, setUsers] = useState<User[]>([]);

    // User Modal State
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [newUser, setNewUser] = useState({
        username: '',
        password: '',
        name: '',
        department: '',
        role: 'user'
    });

    // Sync state with URL params on mount/update
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['monitor', 'users', 'reviews', 'config'].includes(tab)) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    // Handle tab change with URL update
    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.push(`?${params.toString()}`);
    };

    useEffect(() => {
        if (activeTab === 'reviews') {
            // Fetch List
            fetch('/api/reviews?mode=admin')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setRealReviewRecords(data);
                    }
                })
                .catch(err => console.error('Failed to fetch reviews:', err));

            // Fetch Stats
            fetch('/api/reviews/stats')
                .then(res => res.json())
                .then(data => {
                    if (data && !data.error) {
                        setStats(data);
                    }
                })
                .catch(err => console.error('Failed to fetch stats:', err));

        } else if (activeTab === 'users') {
            fetchUserList();
        }
    }, [activeTab]);

    const fetchUserList = () => {
        fetch('/api/users')
            .then(async res => {
                if (res.status === 401) {
                    alert('登录已过期，请重新登录');
                    router.push('/login');
                    return [];
                }
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    setUsers(data);
                }
            })
            .catch(err => console.error('Failed to fetch users:', err));
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });

            if (res.ok) {
                alert('用户创建成功');
                setIsUserModalOpen(false);
                setNewUser({ username: '', password: '', name: '', department: '', role: 'user' });
                fetchUserList();
            } else {
                const data = await res.json();
                alert('创建失败: ' + (data.error || '未知错误'));
            }
        } catch (err) {
            console.error('Error creating user:', err);
            alert('创建失败，请重试');
        }
    };

    const handleResetPassword = async (userId: number, username: string) => {
        const defaultPwd = 'Admin@123456';
        const newPassword = prompt(`请输入用户 "${username}" 的新密码\n(格式要求：8位以上，包含字母/数字/符号中的两种)`, defaultPwd);

        if (newPassword === null) return; // 用户取消

        try {
            const res = await fetch('/api/users/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, newPassword })
            });

            if (res.ok) {
                alert(`用户 ${username} 密码已重置`);
            } else {
                const data = await res.json();
                alert('重置失败: ' + (data.error || '未知错误'));
            }
        } catch (err) {
            console.error('Reset password error:', err);
            alert('操作失败，请重试');
        }
    };

    const handleDeleteUser = async (userId: number, username: string) => {
        if (!confirm(`⚠️ 警告：确定要彻底删除用户 "${username}" 吗？此操作无法撤销！`)) {
            return;
        }

        try {
            const res = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                alert(`用户 "${username}" 已成功删除`);
                fetchUserList();
            } else {
                const data = await res.json();
                alert('删除失败: ' + (data.error || '未知错误'));
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
            const res = await fetch(`/api/reviews/${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                setRealReviewRecords(prev => prev.filter(r => r.id !== id));
            } else {
                const data = await res.json();
                alert(data.error || '删除失败');
            }
        } catch (error) {
            console.error('Delete failed:', error);
            alert('删除失败，请重试');
        }
    };

    // CSV Export
    const handleExportValues = async () => {
        try {
            const res = await fetch('/api/reviews?mode=admin&export=true');
            if (!res.ok) throw new Error('Export failed');

            const records: ReviewRecord[] = await res.json();

            // Convert to CSV
            const headers = ['文件名称', '提交账号', '所属部门', '审查状态', '风险数', '摘要', '提交时间'];
            const csvRows = [headers.join(',')];

            records.forEach(r => {
                const row = [
                    `"${r.fileName.replace(/"/g, '""')}"`,
                    `"${r.user?.name || '未知'}"`,
                    `"${r.user?.department || '-'}"`,
                    `"${r.status === 'completed' ? '已完成' : r.status === 'ignored' ? '无需审查' : '失败'}"`,
                    r.riskCount,
                    `"${(r.summary || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
                    `"${new Date(r.createdAt).toLocaleString()}"`
                ];
                csvRows.push(row.join(','));
            });

            const csvContent = '\uFEFF' + csvRows.join('\n'); // Add BOM for Excel
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `审计报表_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error('Export error:', error);
            alert('导出失败，请重试');
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.logoArea}>
                    <div className={styles.logoText}>🛡️ 公平竞争审查系统 · 超级管理端</div>
                </div>
                <div style={{ fontSize: '14px', color: '#94a3b8' }}>Admin Administrator</div>
            </header>

            <div className={styles.main}>
                <aside className={styles.sidebar}>
                    <div
                        className={`${styles.menuItem} ${activeTab === 'monitor' ? styles.menuItemActive : ''}`}
                        onClick={() => handleTabChange('monitor')}
                    >
                        <span>📊</span> 态势感知
                    </div>
                    <div
                        className={`${styles.menuItem} ${activeTab === 'users' ? styles.menuItemActive : ''}`}
                        onClick={() => handleTabChange('users')}
                    >
                        <span>👥</span> 用户管理
                    </div>
                    <div
                        className={`${styles.menuItem} ${activeTab === 'reviews' ? styles.menuItemActive : ''}`}
                        onClick={() => handleTabChange('reviews')}
                    >
                        <span>📑</span> 审计日志
                    </div>
                    <div
                        className={`${styles.menuItem} ${activeTab === 'config' ? styles.menuItemActive : ''}`}
                        onClick={() => handleTabChange('config')}
                    >
                        <span>⚙️</span> 系统配置
                    </div>
                </aside>

                <main className={styles.content}>
                    {activeTab === 'monitor' && (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h1 className={styles.sectionTitle}>全网风险监控指挥塔</h1>
                                <button className={styles.actionBtn} onClick={() => alert('已触发全网扫描任务，预计耗时 5 分钟')}>
                                    📡 立即启动全网扫描
                                </button>
                            </div>

                            <div className={styles.statGrid}>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>今日抓取数据量</span>
                                    <span className={styles.statValue}>12,504</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>涉嫌违规线索</span>
                                    <span className={styles.statValue} style={{ color: '#d97706' }}>86</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>高风险自动拦截</span>
                                    <span className={styles.statValue} style={{ color: '#ef4444' }}>12</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>待人工研判</span>
                                    <span className={styles.statValue} style={{ color: '#2563eb' }}>45</span>
                                </div>
                            </div>

                            <div className={styles.card}>
                                <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: '600' }}>最新风险线索</h3>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>风险等级</th>
                                            <th>文件标题</th>
                                            <th>来源站点</th>
                                            <th>抓取时间</th>
                                            <th>智能分析结果</th>
                                            <th>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { id: 1, level: 'high', title: '某市各区县环卫一体化招标公告', source: '市公共资源交易网', time: '10:30', desc: '排斥外地经营者（设定本地业绩加分）' },
                                            { id: 2, level: 'medium', title: '关于印发《进一步促进建筑业发展若干措施》的通知', source: '区政府门户网站', time: '09:15', desc: '疑似包含指定推荐产品名录' },
                                            { id: 3, level: 'high', title: 'XX行业协会自律公约', source: '行业协会官网', time: '08:45', desc: '涉嫌横向价格垄断协议' },
                                            { id: 4, level: 'medium', title: '2025年信息化项目采购需求公示', source: '政府采购网', time: '昨天 17:00', desc: '技术参数具有明显指向性' },
                                        ].map(item => (
                                            <tr key={item.id}>
                                                <td>
                                                    {item.level === 'high' ? <span className={`${styles.tag} ${styles.tagHigh}`}>高风险</span> :
                                                        <span className={`${styles.tag} ${styles.tagMedium}`}>疑似风险</span>}
                                                </td>
                                                <td>{item.title}</td>
                                                <td>{item.source}</td>
                                                <td>{item.time}</td>
                                                <td>{item.desc}</td>
                                                <td>
                                                    <button style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', marginRight: '10px' }}>下发</button>
                                                    <button style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>忽略</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {activeTab === 'users' && (
                        <>
                            <h1 className={styles.sectionTitle}>系统用户管理</h1>
                            <div className={styles.card}>
                                <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
                                    <button className={styles.actionBtn} onClick={() => setIsUserModalOpen(true)}>+ 新增用户账号</button>
                                </div>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>用户名</th>
                                            <th>姓名</th>
                                            <th>主要部门/单位</th>
                                            <th>角色</th>
                                            <th>创建时间</th>
                                            <th>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                                                    暂无用户数据
                                                </td>
                                            </tr>
                                        ) : (
                                            users.map((user) => (
                                                <tr key={user.id}>
                                                    <td>{user.username}</td>
                                                    <td>{user.name}</td>
                                                    <td>{user.department || '-'}</td>
                                                    <td>
                                                        {user.role === 'admin' ?
                                                            <span className={`${styles.tag} ${styles.tagHigh}`}>管理员</span> :
                                                            <span className={`${styles.tag} ${styles.tagLow}`}>普通用户</span>
                                                        }
                                                    </td>
                                                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                                                    <td>
                                                        <button
                                                            style={{ color: '#d97706', background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px' }}
                                                            onClick={() => handleResetPassword(user.id, user.username)}
                                                        >
                                                            重置密码
                                                        </button>
                                                        <button
                                                            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                                                            onClick={() => handleDeleteUser(user.id, user.username)}
                                                        >
                                                            删除
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {activeTab === 'reviews' && (
                        <>
                            <h1 className={styles.sectionTitle}>审计日志概览</h1>

                            {/* Stats Dashboard */}
                            <div className={styles.statGrid} style={{ marginBottom: '30px', gridTemplateColumns: 'repeat(5, 1fr)' }}>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>总审查文件数</span>
                                    <span className={styles.statValue}>{stats.totalFiles}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>提交单位/用户数</span>
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
                                    <span className={styles.statLabel}>无需审查文件</span>
                                    <span className={styles.statValue} style={{ color: '#6b7280' }}>{stats.ignoredFiles}</span>
                                </div>
                            </div>

                            <div className={styles.card}>
                                <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
                                    <button
                                        className={styles.actionBtn}
                                        style={{ background: 'white', color: '#374151', border: '1px solid #d1d5db' }}
                                        onClick={handleExportValues}
                                    >
                                        📤 导出审计报表
                                    </button>
                                </div>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>文件名称</th>
                                            <th>提交账号</th>
                                            <th>审查状态</th>
                                            <th>风险数</th>
                                            <th>提交时间</th>
                                            <th>摘要</th>
                                            <th>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {realReviewRecords.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                                                    暂无审计数据
                                                </td>
                                            </tr>
                                        ) : (
                                            realReviewRecords.map((record) => (
                                                <tr key={record.id}>
                                                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={record.fileName}>
                                                        {record.fileName}
                                                    </td>
                                                    <td style={{ fontSize: '12px' }}>
                                                        {record.user ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <span style={{ fontWeight: 500 }}>{record.user.name}</span>
                                                                {record.user.department && <span style={{ color: '#6b7280' }}>{record.user.department}</span>}
                                                            </div>
                                                        ) : <span style={{ color: '#9ca3af' }}>-</span>}
                                                    </td>
                                                    <td>
                                                        {record.status === 'completed' && <span style={{ color: '#10b981' }}>● 已完成</span>}
                                                        {record.status === 'ignored' && <span style={{ color: '#9ca3af' }}>● 无需审查</span>}
                                                        {record.status === 'failed' && <span style={{ color: '#ef4444' }}>● 失败</span>}
                                                        {record.status === 'pending' && <span style={{ color: '#f59e0b' }}>● 进行中</span>}
                                                    </td>
                                                    <td>
                                                        {record.riskCount > 0 ? (
                                                            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{record.riskCount}</span>
                                                        ) : (
                                                            <span style={{ color: '#10b981' }}>0</span>
                                                        )}
                                                    </td>
                                                    <td>{new Date(record.createdAt).toLocaleString()}</td>
                                                    <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px', color: '#6b7280' }} title={record.summary || ''}>
                                                        {record.summary || '-'}
                                                    </td>
                                                    <td>
                                                        <button
                                                            style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px' }}
                                                            onClick={() => router.push(`/review/${record.id}?backUrl=${encodeURIComponent('/felixgao?tab=reviews')}`)}
                                                        >
                                                            查看
                                                        </button>
                                                        <button
                                                            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                                                            onClick={() => handleDeleteReview(record.id)}
                                                        >
                                                            删除
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {activeTab === 'config' && (
                        <>
                            <h1 className={styles.sectionTitle}>系统监控配置</h1>
                            <div className={styles.card}>
                                <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>🕷️ 爬虫策略配置</h3>
                                <div style={{ display: 'grid', gap: '16px', maxWidth: '600px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>自动扫描频率</label>
                                        <select style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                                            <option>每天一次 (凌晨 02:00)</option>
                                            <option>每 6 小时一次</option>
                                            <option>实时监控 (资源消耗大)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>监控目标源</label>
                                        <textarea
                                            rows={5}
                                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                            defaultValue={`浙江省政府采购网 (zhejiang.gov.cn)\n杭州市公共资源交易平台 (hzctc.cn)\n招必得招标信息网 (zhaobide.com)`}
                                        />
                                    </div>
                                    <button className={styles.actionBtn}>保存配置</button>
                                </div>
                            </div>
                        </>
                    )}
                </main>
            </div>

            {/* User Modal */}
            {isUserModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsUserModalOpen(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h2 className={styles.modalTitle}>新增用户</h2>
                        <form onSubmit={handleCreateUser}>
                            <div className={styles.formGroup}>
                                <label>用户名</label>
                                <input
                                    type="text"
                                    required
                                    value={newUser.username}
                                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                    placeholder="请输入登录用户名"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>密码</label>
                                <input
                                    type="password"
                                    required
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    placeholder="设置初始密码（至少8位，含字母/数字/符号）"
                                    minLength={8}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>姓名/单位名称</label>
                                <input
                                    type="text"
                                    required
                                    value={newUser.name}
                                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                    placeholder="例如：张三 或 某某局"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>部门 (选填)</label>
                                <input
                                    type="text"
                                    value={newUser.department}
                                    onChange={e => setNewUser({ ...newUser, department: e.target.value })}
                                    placeholder="例如：市场监管处"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>角色</label>
                                <select
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                >
                                    <option value="user">普通用户</option>
                                    <option value="admin">管理员</option>
                                </select>
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setIsUserModalOpen(false)}>取消</button>
                                <button type="submit" className={styles.actionBtn}>创建用户</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
