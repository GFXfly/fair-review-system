'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import RiskRadar from '@/components/RiskRadar';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                router.push('/dashboard');
            } else {
                const data = await res.json();
                setError(data.error || '登录失败');
            }
        } catch (err) {
            setError('网络错误，请稍后重试');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className={styles.container}>
            {/* Left Side: The Sentinel */}
            <div className={styles.leftPanel}>
                <div className={styles.branding}>
                    <h1>招投标领域公平竞争审查辅助平台</h1>
                    <p>FAIR COMPETITION REVIEW ASSISTANCE PLATFORM</p>
                </div>

                <div className={styles.statsRow}>
                    <div className={styles.statCard}>
                        <span className={styles.statLabel}>📡 今日全网扫描</span>
                        <span className={styles.statValue}>1,208 条</span>
                    </div>
                    <div className={`${styles.statCard} ${styles.alertCard}`}>
                        <span className={styles.statLabel}>🚨 拦截疑似风险</span>
                        <span className={styles.statValue}>12 项</span>
                    </div>
                </div>

                <div className={styles.radarWrapper}>
                    <RiskRadar variant="dark" />
                </div>

                <div className={styles.footer}>
                    <div style={{ marginBottom: '8px' }}>数据来源：杭州市公共资源交易平台、招必得、浙江政府采购网</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
                        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                            浙ICP备2026097272号-1
                        </a>
                        <a href="https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=33018502002722" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <img src="/beian.png" alt="备案图标" style={{ width: '16px', height: '16px' }} />
                            浙公网安备33018502002722号
                        </a>
                    </div>
                </div>
            </div>

            {/* Right Side: Login Form */}
            <div className={styles.rightPanel}>
                <div className={styles.loginBox}>
                    <div className={styles.logoPlaceholder}>
                        <div className={styles.logoIcon}>⚖️</div>
                        <h2>审查员登录</h2>
                    </div>

                    <form className={styles.form} onSubmit={handleLogin}>
                        {error && <div style={{
                            color: '#ef4444',
                            fontSize: '13px',
                            background: '#fef2f2',
                            padding: '8px',
                            borderRadius: '6px',
                            marginBottom: '10px'
                        }}>{error}</div>}

                        <div className={styles.inputGroup}>
                            <label>用户名</label>
                            <input
                                type="text"
                                placeholder="请输入用户名"
                                className={styles.input}
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>密码</label>
                            <input
                                type="password"
                                placeholder="请输入密码"
                                className={styles.input}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className={styles.loginBtn}
                            disabled={isLoading}
                        >
                            {isLoading ? '登录中...' : '登录系统'}
                        </button>


                    </form>
                </div>
            </div>
        </main>
    );
}
