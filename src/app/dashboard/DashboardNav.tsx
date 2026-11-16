'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import type { DashboardUser } from './types';

interface DashboardNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    user: DashboardUser | null;
    onOpenPasswordModal: () => void;
    onLogout: () => void;
}

export default function DashboardNav({
    activeTab,
    onTabChange,
    user,
    onOpenPasswordModal,
    onLogout
}: DashboardNavProps) {
    const router = useRouter();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const pendingCount = user?.pendingUserCount ?? 0;

    return (
        <header className={styles.navbar}>
            <div className={styles.logoArea}>
                <div className={styles.logoIcon}>⚖️</div>
                <div className={styles.logoText}>招投标领域公平竞争审查系统</div>
            </div>

            <nav className={styles.navLinks}>
                <button
                    className={`${styles.navItem} ${activeTab === 'workspace' ? styles.activeNav : ''}`}
                    onClick={() => onTabChange('workspace')}
                >
                    📝 文件审查
                </button>

                <button
                    className={`${styles.navItem} ${activeTab === 'regulations' ? styles.activeNav : ''}`}
                    onClick={() => onTabChange('regulations')}
                >
                    📜 核心法规
                </button>
                <button
                    className={`${styles.navItem} ${activeTab === 'cases' ? styles.activeNav : ''}`}
                    onClick={() => onTabChange('cases')}
                >
                    ⚖️ 典型案例
                </button>
            </nav>

            <div className={styles.rightActions}>
                {user?.role === 'admin' && (
                    <button
                        type="button"
                        className={styles.adminEntryBtn}
                        onClick={() => router.push('/admin')}
                    >
                        <span>🛡️ 管理后台</span>
                        {pendingCount > 0 && (
                            <span className={styles.badge}>{pendingCount}</span>
                        )}
                    </button>
                )}

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
                                onOpenPasswordModal();
                            }}>
                                🔒 修改密码
                            </div>
                            <div className={styles.userMenuItem} onClick={(e) => {
                                e.stopPropagation();
                                onLogout();
                            }}>
                                🚪 退出登录
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
