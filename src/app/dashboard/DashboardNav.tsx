'use client';

import React, { useState } from 'react';
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
    const [showUserMenu, setShowUserMenu] = useState(false);

    return (
        <header className={styles.navbar}>
            <div className={styles.logoArea}>
                <div className={styles.logoIcon}>⚖️</div>
                <div className={styles.logoText}>公平竞争审查系统</div>
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
        </header>
    );
}
