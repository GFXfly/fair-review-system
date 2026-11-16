'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import type { DashboardUser } from './types';
import BrandSeal from '@/components/ui/BrandSeal';
import {
    BookOpenIcon,
    ChevronDownIcon,
    FileTextIcon,
    LockIcon,
    LogOutIcon,
    ScaleLawIcon,
    ShieldAdminIcon,
} from '@/components/ui/Icons';

interface DashboardNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    user: DashboardUser | null;
    onOpenPasswordModal: () => void;
    onLogout: () => void;
}

const NAV_ITEMS = [
    { key: 'workspace', label: '文件审查', Icon: FileTextIcon },
    { key: 'regulations', label: '核心法规', Icon: BookOpenIcon },
    { key: 'cases', label: '典型案例', Icon: ScaleLawIcon },
] as const;

const ORG_TYPE_SHORT: Record<string, string> = {
    town: '镇街',
    agency: '代理机构',
    gov: '区级部门',
};

export default function DashboardNav({
    activeTab,
    onTabChange,
    user,
    onOpenPasswordModal,
    onLogout
}: DashboardNavProps) {
    const router = useRouter();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const pendingCount = user?.pendingUserCount ?? 0;
    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        if (!showUserMenu) return;
        const handleDown = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowUserMenu(false);
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowUserMenu(false);
        };
        document.addEventListener('mousedown', handleDown);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleDown);
            document.removeEventListener('keydown', handleKey);
        };
    }, [showUserMenu]);

    const orgLabel = user?.department
        || (isAdmin ? '系统管理员' : '');

    return (
        <header className={styles.navbar}>
            <div className={styles.navInner}>
                <button type="button" className={styles.logoArea} onClick={() => onTabChange('workspace')}>
                    <BrandSeal char="审" size={30} />
                    <span className={styles.logoText}>
                        <span className={styles.logoTitle}>招投标领域公平竞争审查系统</span>
                        <span className={styles.logoSub}>临安区市场监督管理局</span>
                    </span>
                </button>

                <nav className={styles.navLinks} aria-label="主导航">
                    {NAV_ITEMS.map(({ key, label, Icon }) => (
                        <button
                            key={key}
                            type="button"
                            className={`${styles.navItem} ${activeTab === key ? styles.activeNav : ''}`}
                            aria-current={activeTab === key ? 'page' : undefined}
                            onClick={() => onTabChange(key)}
                        >
                            <Icon size={16} />
                            {label}
                        </button>
                    ))}
                </nav>

                <div className={styles.rightActions}>
                    {isAdmin && (
                        <button
                            type="button"
                            className={styles.adminEntryBtn}
                            onClick={() => router.push('/admin')}
                            title={pendingCount > 0 ? `${pendingCount} 个注册申请待审批` : '管理后台'}
                        >
                            <ShieldAdminIcon size={16} />
                            <span>管理后台</span>
                            {pendingCount > 0 && (
                                <span className={styles.badge}>{pendingCount > 99 ? '99+' : pendingCount}</span>
                            )}
                        </button>
                    )}

                    <div className={styles.userProfile} ref={menuRef}>
                        <button
                            type="button"
                            className={`${styles.userTrigger} ${showUserMenu ? styles.userTriggerOpen : ''}`}
                            onClick={() => setShowUserMenu((v) => !v)}
                            aria-haspopup="menu"
                            aria-expanded={showUserMenu}
                        >
                            <span className={styles.avatar}>{user ? user.name.slice(0, 1) : '·'}</span>
                            <span className={styles.userMeta}>
                                <span className={styles.userName}>{user ? user.name : '加载中'}</span>
                                {orgLabel && <span className={styles.userOrg}>{orgLabel}</span>}
                            </span>
                            <span className={`${styles.userChevron} ${showUserMenu ? styles.userChevronOpen : ''}`}>
                                <ChevronDownIcon size={14} />
                            </span>
                        </button>

                        {showUserMenu && (
                            <div className={styles.userMenuDropdown} role="menu">
                                <div className={styles.userMenuHead}>
                                    <div className={styles.userMenuName}>{user?.name}</div>
                                    <div className={styles.userMenuAccount}>
                                        <span className={styles.mono}>{user?.username}</span>
                                        {user?.orgType && ORG_TYPE_SHORT[user.orgType] && (
                                            <span className={styles.userMenuTag}>{ORG_TYPE_SHORT[user.orgType]}</span>
                                        )}
                                        {isAdmin && <span className={styles.userMenuTag}>管理员</span>}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    role="menuitem"
                                    className={styles.userMenuItem}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowUserMenu(false);
                                        onOpenPasswordModal();
                                    }}
                                >
                                    <LockIcon size={15} />
                                    修改密码
                                </button>
                                <button
                                    type="button"
                                    role="menuitem"
                                    className={`${styles.userMenuItem} ${styles.userMenuDanger}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onLogout();
                                    }}
                                >
                                    <LogOutIcon size={15} />
                                    退出登录
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
