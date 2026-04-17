'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import FileUpload from '@/components/FileUpload';
import ReactMarkdown from 'react-markdown';



// Helper Component for Pagination
function Pagination({
    total,
    page,
    onChange,
    pageSize = 20
}: {
    total: number;
    page: number;
    onChange: (p: number) => void;
    pageSize?: number;
}) {
    const totalPages = Math.ceil(total / pageSize);
    const [inputVal, setInputVal] = useState(page.toString());

    // Sync local input state when page prop changes
    useEffect(() => {
        setInputVal(page.toString());
    }, [page]);

    const handleInputBlur = () => {
        let p = parseInt(inputVal, 10);
        if (isNaN(p)) {
            setInputVal(page.toString());
            return;
        }
        if (p < 1) p = 1;
        if (p > totalPages) p = totalPages;

        setInputVal(p.toString());
        if (p !== page) {
            onChange(p);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleInputBlur();
        }
    };

    return (
        <div className={styles.pagination}>
            <span>共 {total} 条</span>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button
                    className={styles.pageBtn}
                    disabled={page === 1}
                    onClick={() => onChange(Math.max(1, page - 1))}
                >
                    &lt;
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '0 8px' }}>
                    <span>第</span>
                    <input
                        type="text"
                        value={inputVal}
                        onChange={(e) => setInputVal(e.target.value)}
                        onBlur={handleInputBlur}
                        onKeyDown={handleKeyDown}
                        style={{
                            width: '40px',
                            textAlign: 'center',
                            padding: '4px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '13px'
                        }}
                    />
                    <span>页 / 共 {totalPages} 页</span>
                </div>
                <button
                    className={styles.pageBtn}
                    disabled={page >= totalPages}
                    onClick={() => onChange(Math.min(totalPages, page + 1))}
                >
                    &gt;
                </button>
            </div>
        </div>
    );
}

function DashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') || 'workspace';
    const [activeTab, setActiveTab] = useState(initialTab); // workspace | monitor | knowledge
    const [showUserMenu, setShowUserMenu] = useState(false);

    // Change Password State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    // Sync activeTab with URL params if they change
    useEffect(() => {
        const tab = searchParams.get('tab');
        const page = searchParams.get('page');

        if (tab) {
            setActiveTab(tab);
        }

        // Restore page number when returning from detail page
        if (page && tab === 'cases') {
            setCasePage(parseInt(page, 10));
        }
    }, [searchParams]);

    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [showSecurityWarning, setShowSecurityWarning] = useState(false);
    const [showDocWarning, setShowDocWarning] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Knowledge Base State
    const [regulations, setRegulations] = useState<any[]>([]);
    const [cases, setCases] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingKnowledge, setIsLoadingKnowledge] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    // Pagination State
    const [regPage, setRegPage] = useState(1);
    const [casePage, setCasePage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    const [reviewRecords, setReviewRecords] = useState<any[]>([]);



    const [user, setUser] = useState<any>(null);

    // Check Auth
    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Unauthorized');
            })
            .then(data => setUser(data))
            .catch(() => router.push('/'));
    }, []);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            alert('两次输入的新密码不一致');
            return;
        }

        if (passwordForm.newPassword.length < 8) {
            alert('新密码长度至少需要8位');
            return;
        }

        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword
                })
            });

            const data = await res.json();

            if (res.ok) {
                alert('密码修改成功，请重新登录');
                setShowPasswordModal(false);
                setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                handleLogout();
            } else {
                alert(data.error || '修改失败');
            }
        } catch (error) {
            console.error('Change password error:', error);
            alert('修改失败，请稍后重试');
        }
    };

    const fetchReviewRecords = async () => {
        try {
            // If user is admin, fetch all records; otherwise fetch only user's own records
            const url = user?.role === 'admin' ? '/api/reviews?mode=admin' : '/api/reviews';
            console.log(`[Dashboard] Fetching reviews. User role: ${user?.role}, URL: ${url}`);
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                console.log(`[Dashboard] Received ${data.length} review records`);
                console.log('[Dashboard] First 3 records:', data.slice(0, 3).map((r: any) => ({
                    fileName: r.fileName,
                    user: r.user?.name,
                    status: r.status
                })));
                setReviewRecords(data);
            } else {
                console.error('[Dashboard] Failed to fetch reviews. Status:', res.status);
            }
        } catch (error) {
            console.error('Failed to fetch review records:', error);
        }
    };

    // Fetch Knowledge Data and Review Records
    useEffect(() => {
        if (activeTab === 'regulations' || activeTab === 'cases') {
            fetchKnowledge(searchQuery);
        }
        if (activeTab === 'workspace' && user) {
            fetchReviewRecords();
        }
    }, [activeTab, user]);



    const fetchKnowledge = async (query = '') => {
        setIsLoadingKnowledge(true);
        try {
            const [regRes, caseRes] = await Promise.all([
                fetch(`/api/regulations?q=${query}`, { cache: 'no-store' }),
                fetch(`/api/cases?q=${query}`, { cache: 'no-store' })
            ]);

            if (regRes.ok) {
                const regData = await regRes.json();
                setRegulations(regData);
            }

            if (caseRes.ok) {
                const caseData = await caseRes.json();
                setCases(caseData);
            }
        } catch (error) {
            console.error('Failed to fetch knowledge base:', error);
        } finally {
            setIsLoadingKnowledge(false);
        }
    };

    const handleSearch = () => {
        setRegPage(1);
        setCasePage(1);
        fetchKnowledge(searchQuery);
    };

    const handleFileSelect = (file: File) => {
        // Check for .doc extension
        if (file.name.toLowerCase().endsWith('.doc')) {
            setShowDocWarning(true);
            return;
        }

        setPendingFile(file);
        setShowSecurityWarning(true);
    };

    const confirmUpload = () => {
        setSelectedFile(pendingFile);
        setPendingFile(null);
        setShowSecurityWarning(false);
    };

    const cancelUpload = () => {
        setPendingFile(null);
        setShowSecurityWarning(false);
    };

    const removeFile = () => {
        setSelectedFile(null);
    };

    const [analyzingStatus, setAnalyzingStatus] = useState("正在进行智能审查...");
    const [analyzingProgress, setAnalyzingProgress] = useState(0);

    const startReview = async () => {
        if (!selectedFile) return;
        setIsAnalyzing(true);
        setAnalyzingStatus("正在解析文档内容...");
        setAnalyzingProgress(0);

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            // Step 1: Submit file and get task ID
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData,
            });

            const contentType = response.headers.get('content-type') || '';

            if (!response.ok) {
                if (contentType.includes('application/json')) {
                    const errorData = await response.json();
                    throw new Error(errorData.details || errorData.error || 'Analysis failed');
                } else {
                    const errorText = await response.text();
                    console.error('API returned non-JSON response:', errorText.substring(0, 200));
                    throw new Error(`服务器返回错误 (${response.status})。请检查后端服务是否正常运行。`);
                }
            }

            const data = await response.json();
            const recordId = data.id;

            if (!recordId) {
                throw new Error('服务器未返回审查记录ID');
            }

            console.log(`[Review] Started async review with ID: ${recordId}`);

            // Step 2: Poll with exponential backoff. Start at 2s, grow ×1.5 up to 8s cap.
            // Reset to base whenever progress advances so we stay responsive during active phases.
            const BASE_INTERVAL = 2000;
            const MAX_INTERVAL = 8000;
            const MAX_ELAPSED_MS = 10 * 60 * 1000; // 10 minutes
            const startedAt = Date.now();
            let interval = BASE_INTERVAL;
            let lastProgress = -1;

            const pollStatus = async (): Promise<void> => {
                try {
                    const statusResponse = await fetch(`/api/reviews/${recordId}/status`);

                    if (!statusResponse.ok) {
                        throw new Error('获取审查状态失败');
                    }

                    const statusData = await statusResponse.json();

                    if (typeof statusData.progress === 'number') {
                        setAnalyzingProgress(statusData.progress);
                        if (statusData.progress > lastProgress) {
                            lastProgress = statusData.progress;
                            interval = BASE_INTERVAL;
                        } else {
                            interval = Math.min(Math.round(interval * 1.5), MAX_INTERVAL);
                        }
                    }
                    if (statusData.progressMessage) {
                        setAnalyzingStatus(statusData.progressMessage);
                    }

                    if (statusData.status === 'completed') {
                        const fullReviewResponse = await fetch(`/api/reviews/${recordId}`);
                        const fullReviewData = await fullReviewResponse.json();

                        sessionStorage.setItem('temp_review_data', JSON.stringify({
                            fileName: selectedFile.name,
                            fileSize: selectedFile.size,
                            id: recordId,
                            ...fullReviewData
                        }));

                        setAnalyzingProgress(100);
                        setAnalyzingStatus("审查完成，正在生成报告...");
                        setTimeout(() => router.push(`/review/${recordId}`), 500);
                        return;

                    } else if (statusData.status === 'ignored') {
                        setAnalyzingStatus("该文件无需审查");
                        alert(`【无需审查】\n\n该文件不属于公平竞争审查范围：\n${statusData.progressMessage || '已自动跳过'}`);
                        setIsAnalyzing(false);
                        window.location.reload();
                        return;

                    } else if (statusData.status === 'failed') {
                        throw new Error(statusData.progressMessage || '审查失败');

                    } else if (Date.now() - startedAt >= MAX_ELAPSED_MS) {
                        throw new Error('审查超时，请刷新页面查看审查记录');

                    } else {
                        setTimeout(pollStatus, interval);
                    }

                } catch (pollError: any) {
                    console.error('[Poll] Error:', pollError);
                    throw pollError;
                }
            };

            // Start polling
            await pollStatus();

        } catch (error: any) {
            console.error('Error starting review:', error);

            let errorMessage = '审查启动失败';

            if (error.message) {
                errorMessage += `\n\n错误详情：${error.message}`;
            }

            if (error.suggestion) {
                errorMessage += `\n\n建议：${error.suggestion}`;
            }

            alert(errorMessage);
            setIsAnalyzing(false);
        }
    };

    const formatAction = (action: string) => {
        const map: Record<string, string> = {
            'login': '用户登录',
            'login_failed': '登录失败',
            'logout': '用户登出',
            'change_password': '修改密码',
            'create_cases': '新増案例',
            'upload_file': '上传文件',
            'analyze_file': '智能审查',
            'view_review': '查看结果',
            'delete_review': '删除记录',
            'delete_user': '删除用户',
            'create_user': '创建用户',
            'access_denied': '访问拒绝'
        };
        return map[action] || action;
    };

    const handleItemClick = async (item: any) => {
        // Identify if the item is a Case based on specific fields or active tab
        const isCase = activeTab === 'cases' || item.violationType || item.result;

        if (isCase) {
            // Build highlight parameter for keyword highlighting in detail page
            const highlightParam = searchQuery.trim() ? `&highlight=${encodeURIComponent(searchQuery.trim())}` : '';

            // Navigate to the report page if reportId exists
            if (item.reportId) {
                router.push(`/reports/${item.reportId}?from=cases&page=${casePage}${highlightParam}`);
            } else {
                // Fallback to individual case page if no report
                router.push(`/cases/${item.id}?from=cases&page=${casePage}${highlightParam}`);
            }
        } else {
            // It is a Regulation, fetch full content if missing
            if (!item.content) {
                try {
                    const res = await fetch(`/api/regulations?id=${item.id}`);
                    if (res.ok) {
                        const fullItem = await res.json();
                        setSelectedItem(fullItem);
                    } else {
                        console.error('Failed to fetch full regulation details');
                        setSelectedItem(item); // Fallback
                    }
                } catch (e) {
                    console.error('Error fetching regulation details:', e);
                    setSelectedItem(item); // Fallback
                }
            } else {
                setSelectedItem(item);
            }
        }
    };

    return (
        <div className={styles.container}>
            {/* Top Navigation - Based on User Workflow */}
            <header className={styles.navbar}>
                <div className={styles.logoArea}>
                    <div className={styles.logoIcon}>⚖️</div>
                    <div className={styles.logoText}>公平竞争审查系统</div>
                </div>

                <nav className={styles.navLinks}>
                    <button
                        className={`${styles.navItem} ${activeTab === 'workspace' ? styles.activeNav : ''}`}
                        onClick={() => setActiveTab('workspace')}
                    >
                        📝 文件审查
                    </button>

                    <button
                        className={`${styles.navItem} ${activeTab === 'regulations' ? styles.activeNav : ''}`}
                        onClick={() => setActiveTab('regulations')}
                    >
                        📜 核心法规
                    </button>
                    <button
                        className={`${styles.navItem} ${activeTab === 'cases' ? styles.activeNav : ''}`}
                        onClick={() => setActiveTab('cases')}
                    >
                        ⚖️ 典型案例
                    </button>


                </nav>

                <div
                    className={styles.userProfile}
                    onMouseEnter={() => setShowUserMenu(true)}
                    onMouseLeave={() => setShowUserMenu(false)}
                >
                    <div className={styles.avatar}>{user ? user.name[0] : '...'}</div>

                    {showUserMenu && (
                        <div className={styles.userMenuDropdown}>
                            <div className={styles.userMenuItem} onClick={(e) => {
                                e.stopPropagation();
                                setShowUserMenu(false);
                                setShowPasswordModal(true);
                            }}>
                                🔒 修改密码
                            </div>
                            <div className={styles.userMenuItem} onClick={(e) => {
                                e.stopPropagation();
                                handleLogout();
                            }}>
                                🚪 退出登录
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <main className={styles.mainContent}>

                {/* SCENE 1: REVIEW WORKSPACE (The "Doing" phase) */}
                {activeTab === 'workspace' && (
                    <div className={styles.workspaceGrid}>
                        {/* Left: The Main Action - Upload & Review */}
                        <div className={styles.mainActionArea}>
                            <div className={styles.sectionHeader}>
                                <h2>🚀 发起新审查</h2>
                                {/* Description removed as requested */}
                            </div>
                            <div className={styles.uploadWrapper}>
                                {isAnalyzing ? (
                                    <div className={styles.analyzingState}>
                                        <div className={styles.spinner}></div>
                                        <div className={styles.analyzingText}>{analyzingStatus}</div>
                                        <div style={{ width: '80%', maxWidth: '480px', marginTop: '16px' }}>
                                            <div style={{
                                                height: '8px',
                                                background: '#e5e7eb',
                                                borderRadius: '999px',
                                                overflow: 'hidden',
                                            }}>
                                                <div style={{
                                                    width: `${Math.min(100, Math.max(0, analyzingProgress))}%`,
                                                    height: '100%',
                                                    background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                                                    transition: 'width 400ms ease',
                                                }} />
                                            </div>
                                            <div style={{
                                                marginTop: '6px',
                                                fontSize: '12px',
                                                color: '#6b7280',
                                                textAlign: 'right',
                                            }}>
                                                {analyzingProgress}%
                                            </div>
                                        </div>
                                        <div className={styles.analyzingSubText}>AI 多智能体系统正在云端计算中...</div>
                                    </div>
                                ) : selectedFile ? (
                                    <div className={styles.readyState}>
                                        <div className={styles.readyFileIcon}>📄</div>
                                        <div className={styles.readyFileInfo}>
                                            <div className={styles.readyFileName}>{selectedFile.name}</div>
                                            <div className={styles.readyFileSize}>{(selectedFile.size / 1024).toFixed(2)} KB</div>
                                        </div>
                                        <div className={styles.readyActions}>
                                            <button className={styles.secondaryBtn} onClick={removeFile}>重新上传</button>
                                            <button className={styles.primaryBtn} onClick={startReview}>开始审查</button>
                                        </div>
                                    </div>
                                ) : (
                                    // Force remount to clear internal state if needed by using a key, 
                                    // though FileUpload state is internal, so key is good practice if we want to reset it.
                                    <FileUpload key={pendingFile ? 'pending' : 'new'} onFileSelect={handleFileSelect} />
                                )}
                            </div>
                        </div>

                        {/* Right: The "Trigger" - System Alerts */}
                        <div className={styles.sidePanel}>
                            <div className={styles.panelHeader}>
                                <h3>🚨 预警消息</h3>
                            </div>
                            <div className={styles.alertList}>
                                {/* Passive view of system alerts pushed by admin/system */}
                                {[
                                    { id: 101, title: '来自管理员的风险提示', content: '你单位发布的《关于促进XX行业发展的通知》疑似包含指定交易条款，请自查。', time: '10:00' }
                                ].map(alert => (
                                    <div key={alert.id} style={{ padding: '12px', borderBottom: '1px solid #f3f4f6' }}>
                                        <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px', color: '#ef4444' }}>{alert.title}</div>
                                        <div style={{ fontSize: '13px', color: '#4b5563', marginBottom: '4px' }}>{alert.content}</div>
                                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>{alert.time}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Bottom: The "History" - Recent Reviews */}
                        <div className={styles.historySection}>
                            <div className={styles.sectionHeader}>
                                <h2>🕒 最近审查记录</h2>
                                <button className={styles.linkBtn}>查看全部台账</button>
                            </div>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>状态</th>
                                        <th>文件名称</th>
                                        {user?.role === 'admin' && <th>提交账号</th>}
                                        <th>风险点</th>
                                        <th>审查时间</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reviewRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={user?.role === 'admin' ? 6 : 5} style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                                                <div style={{ fontSize: '14px' }}>暂无审查记录</div>
                                                <div style={{ fontSize: '12px', marginTop: '8px', color: '#d1d5db' }}>上传文件开始审查</div>
                                            </td>
                                        </tr>
                                    ) : (
                                        reviewRecords.map((record: any) => (
                                            <tr key={record.id}>
                                                <td>
                                                    {record.status === 'completed' && <span style={{ color: '#10b981', background: '#d1fae5', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>已完成</span>}
                                                    {record.status === 'ignored' && <span style={{ color: '#6b7280', background: '#e5e7eb', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>无需审查</span>}
                                                    {record.status === 'failed' && <span style={{ color: '#ef4444', background: '#fee2e2', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>失败</span>}
                                                </td>
                                                <td className={styles.fileName}>{record.fileName}</td>
                                                {user?.role === 'admin' && (
                                                    <td style={{ fontSize: '13px' }}>
                                                        <div style={{ fontWeight: 500 }}>{record.user?.name || '未知'}</div>
                                                        {record.user?.department && (
                                                            <div style={{ fontSize: '12px', color: '#6b7280' }}>{record.user.department}</div>
                                                        )}
                                                    </td>
                                                )}
                                                <td>
                                                    {record.status === 'ignored' ? '-' : (
                                                        record.riskCount > 0 ?
                                                            <span style={{ color: '#ef4444' }}>{record.riskCount} 个风险</span> :
                                                            <span style={{ color: '#10b981' }}>无风险</span>
                                                    )}
                                                </td>
                                                <td style={{ color: '#6b7280' }}>
                                                    {new Date(record.createdAt).toLocaleString()}
                                                </td>
                                                <td>
                                                    <button
                                                        className={styles.linkBtn}
                                                        onClick={() => {
                                                            if (record.status === 'ignored') {
                                                                alert(record.summary);
                                                            } else {
                                                                router.push(`/review/${record.id}`);
                                                            }
                                                        }}
                                                    >
                                                        查看
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* SCENE 3: REGULATIONS */}
                {activeTab === 'regulations' && (
                    <div className={styles.knowledgeSection}>
                        <div className={styles.sectionHeader} style={{ textAlign: 'center' }}>
                            <h2>📜 核心法规库</h2>
                        </div>

                        {/* Search Bar */}


                        <div className={styles.knowledgeContent}>
                            <div className={styles.knowledgeCard} style={{ padding: 0, overflow: 'hidden' }}>
                                <table className={styles.caseTable}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px' }}></th>
                                            <th>法规名称</th>
                                            <th style={{ width: '120px' }}>效力级别</th>
                                            <th style={{ width: '120px' }}>发布日期</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {regulations.slice((regPage - 1) * ITEMS_PER_PAGE, regPage * ITEMS_PER_PAGE).map((item) => (
                                            <tr key={item.id} onClick={() => handleItemClick(item)} style={{ cursor: 'pointer' }}>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span className={styles.caseIcon}>📜</span>
                                                </td>
                                                <td>
                                                    <div className={styles.caseTitle}>{item.title}</div>
                                                </td>
                                                <td>
                                                    <span className={`${styles.caseTag} ${styles.tagNational}`}>
                                                        {item.level || '未知级别'}
                                                    </span>
                                                </td>
                                                <td style={{ color: '#6b7280' }}>{item.publishDate}</td>
                                            </tr>
                                        ))}
                                        {regulations.length === 0 && !isLoadingKnowledge && (
                                            <tr>
                                                <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                                                    暂无相关法规
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>

                                {/* Pagination Footer */}
                                <Pagination
                                    total={regulations.length}
                                    page={regPage}
                                    onChange={setRegPage}
                                    pageSize={ITEMS_PER_PAGE}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* SCENE 4: CASES */}
                {activeTab === 'cases' && (
                    <div className={styles.knowledgeSection}>
                        <div className={styles.sectionHeader} style={{ textAlign: 'center' }}>
                            <h2>⚖️ 典型案例库</h2>
                        </div>

                        {/* Search Bar */}
                        <div className={styles.searchBox}>
                            <input
                                type="text"
                                placeholder="🔍 搜索案例，如“指定交易”、“补贴”..."
                                className={styles.searchInput}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <button className={styles.primaryBtn} onClick={handleSearch}>
                                {isLoadingKnowledge ? '搜索中...' : '搜索'}
                            </button>
                        </div>

                        <div className={styles.knowledgeContent}>
                            <div className={styles.knowledgeCard} style={{ padding: 0, overflow: 'hidden' }}>
                                <table className={styles.caseTable}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px' }}></th>
                                            <th>事件名称</th>
                                            <th style={{ width: '200px' }}>通告机构</th>
                                            <th style={{ width: '100px' }}>案例级别</th>
                                            <th style={{ width: '120px' }}>通告日期</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cases.slice((casePage - 1) * ITEMS_PER_PAGE, casePage * ITEMS_PER_PAGE).map((item) => {
                                            const isNational = item.report?.department?.includes('总局') || item.report?.department?.includes('国家');
                                            const levelTag = isNational ? '国家级' : '省级';
                                            const tagClass = isNational ? styles.tagNational : styles.tagProvincial;

                                            return (
                                                <tr key={item.id} onClick={() => handleItemClick(item)} style={{ cursor: 'pointer' }}>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span className={styles.caseIcon}>📂</span>
                                                    </td>
                                                    <td>
                                                        <div className={styles.caseTitle}>{item.title}</div>
                                                    </td>
                                                    <td>{item.report?.department || '未知机构'}</td>
                                                    <td>
                                                        <span className={`${styles.caseTag} ${tagClass}`}>
                                                            {levelTag}
                                                        </span>
                                                    </td>
                                                    <td style={{ color: '#6b7280' }}>{item.publishDate}</td>
                                                </tr>
                                            );
                                        })}
                                        {cases.length === 0 && !isLoadingKnowledge && (
                                            <tr>
                                                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                                                    暂无相关案例
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>

                                {/* Pagination Footer */}
                                <Pagination
                                    total={cases.length}
                                    page={casePage}
                                    onChange={setCasePage}
                                    pageSize={ITEMS_PER_PAGE}
                                />
                            </div>
                        </div>
                    </div>
                )}

            </main>

            {/* Security Warning Modal */}
            {showSecurityWarning && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalIcon}>⚠️</div>
                        <h3 className={styles.modalTitle}>严禁上传涉密文档</h3>
                        <div className={styles.modalActions}>
                            <button className={styles.secondaryBtn} onClick={cancelUpload}>取消</button>
                            <button className={`${styles.primaryBtn} ${styles.dangerBtn}`} onClick={confirmUpload}>确认</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Old .doc Format Warning Modal */}
            {showDocWarning && (
                <div className={styles.modalOverlay}>
                    {/* ... (existing content) ... */}
                    <div className={styles.modalContent} style={{ width: '400px', padding: '30px', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                backgroundColor: '#EFF6FF',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '20px',
                                color: '#3B82F6',
                                fontSize: '32px'
                            }}>
                                🔄
                            </div>

                            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1F2937', marginBottom: '8px' }}>
                                请转换为 .docx 格式
                            </h3>

                            <div style={{ fontSize: '14px', color: '#6B7280', lineHeight: '1.6', marginBottom: '24px' }}>
                                <p>为了确保 AI 审查的精准度，系统目前仅支持标准的 Word (.docx) 文件。</p>
                                <p style={{ marginTop: '8px', fontSize: '13px', backgroundColor: '#F3F4F6', padding: '10px', borderRadius: '8px', color: '#4B5563' }}>
                                    💡 提示：请在 Word 中打开文件，选择<br />
                                    <strong>"文件" &gt; "另存为"</strong>，并将格式选为 <strong>Word 文档 (.docx)</strong>
                                </p>
                            </div>

                            <button
                                className={styles.primaryBtn}
                                onClick={() => setShowDocWarning(false)}
                                style={{ width: '100%', padding: '12px', fontSize: '15px' }}
                            >
                                我知道了，去转换
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {showPasswordModal && (
                <div className={styles.modalOverlay} onClick={() => setShowPasswordModal(false)}>
                    <div className={styles.modalContent} style={{ width: '400px' }} onClick={e => e.stopPropagation()}>
                        <h3 className={styles.modalTitle}>🔒 修改密码</h3>
                        <form onSubmit={handleChangePassword}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>当前密码</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordForm.currentPassword}
                                    onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                    placeholder="请输入当前密码"
                                />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>新密码</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordForm.newPassword}
                                    onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                    placeholder="设置新密码 (至少6位)"
                                    minLength={6}
                                />
                            </div>
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>确认新密码</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordForm.confirmPassword}
                                    onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                    placeholder="再次输入新密码"
                                    minLength={6}
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.secondaryBtn} onClick={() => setShowPasswordModal(false)}>取消</button>
                                <button type="submit" className={styles.primaryBtn}>确认修改</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Drawer */}
            {selectedItem && (
                <div className={styles.drawerOverlay} onClick={() => setSelectedItem(null)}>
                    <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.drawerHeader}>
                            <div className={styles.drawerTitle}>{selectedItem.title}</div>
                            <button className={styles.closeBtn} onClick={() => setSelectedItem(null)}>×</button>
                        </div>
                        <div className={styles.drawerContent}>
                            <div id="meta-info" className={styles.metaInfo} style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
                                {selectedItem.publishDate && (
                                    <div className={styles.metaItem}>
                                        <span className={styles.metaLabel}>发布日期</span>
                                        <span className={styles.metaValue}>{selectedItem.publishDate}</span>
                                    </div>
                                )}
                                {selectedItem.department && (
                                    <div className={styles.metaItem}>
                                        <span className={styles.metaLabel}>发布部门</span>
                                        <span className={styles.metaValue}>{selectedItem.department}</span>
                                    </div>
                                )}
                                {selectedItem.level && (
                                    <div className={styles.metaItem}>
                                        <span className={styles.metaLabel}>效力级别</span>
                                        <span className={styles.metaValue}>{selectedItem.level}</span>
                                    </div>
                                )}
                            </div>

                            <div className={styles.articleContent} style={{ maxWidth: '800px', margin: '0 auto' }}>
                                <ReactMarkdown
                                    components={{
                                        h3: ({ node, ...props }) => <h3 {...props} style={{ color: '#1e40af', marginTop: '30px', borderLeft: '4px solid #2563eb', paddingLeft: '12px' }} />,
                                        p: ({ node, ...props }) => <p {...props} style={{ lineHeight: '1.8', marginBottom: '16px', color: '#374151', fontSize: '15px' }} />,
                                        strong: ({ node, ...props }) => <strong {...props} style={{ color: '#111827', fontWeight: 600 }} />
                                    }}
                                >
                                    {selectedItem.content}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DashboardContent />
        </Suspense>
    );
}
