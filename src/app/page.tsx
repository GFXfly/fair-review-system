'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import {
    GOV_DEPT_LIST,
    TOWN_LIST,
    isValidPhone,
    type OrgType,
} from '@/lib/org-constants';

const CAPABILITY_CARDS = [
    {
        icon: '📋',
        title: '招标文书编制阶段合规自查',
        desc: '面向全区各镇街审查员、工程经办人员及工程建设招标代理机构，在招标文件发布前智能排查排除、限制竞争隐患。',
    },
    {
        icon: '⚖️',
        title: '浙江招投标 21 条细则精准对标',
        desc: '内置《公平竞争审查条例》与《浙江省招标投标领域公平竞争审查细则》，多智能体协同识别地域业绩加分、变相资质门槛与保证金限制。',
    },
    {
        icon: '📄',
        title: '原文高亮定位与意见书一键导出',
        desc: '自动定位文书风险条款原文、匹配典型通报案例，一键导出标准 Word 格式《招投标领域公平竞争审查意见书》。',
    },
];

const ORG_TYPE_OPTIONS: { value: OrgType; label: string }[] = [
    { value: 'town', label: '镇街经办' },
    { value: 'agency', label: '招标代理公司' },
    { value: 'gov', label: '区级部门' },
];

export default function LoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState<'login' | 'register'>('login');

    // Login state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Register state
    const [regOrgType, setRegOrgType] = useState<OrgType>('town');
    const [regDepartment, setRegDepartment] = useState('');
    const [regName, setRegName] = useState('');
    const [regPhone, setRegPhone] = useState('');
    const [regUsername, setRegUsername] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regConfirmPassword, setRegConfirmPassword] = useState('');
    const [regLoading, setRegLoading] = useState(false);

    const switchMode = (nextMode: 'login' | 'register') => {
        setMode(nextMode);
        setError('');
        if (nextMode === 'register') {
            setNotice('');
        }
    };

    const handleOrgTypeChange = (nextType: OrgType) => {
        setRegOrgType(nextType);
        setRegDepartment('');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setNotice('');
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
        } catch {
            setError('网络错误，请稍后重试');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setNotice('');

        if (!regDepartment.trim()) {
            setError(
                regOrgType === 'agency'
                    ? '请输入工程建设代理公司全称'
                    : regOrgType === 'town'
                        ? '请选择所属镇街'
                        : '请选择所属区级部门'
            );
            return;
        }
        if (!isValidPhone(regPhone)) {
            setError('请输入有效的 11 位手机号码');
            return;
        }
        if (regPassword !== regConfirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }

        setRegLoading(true);
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: regUsername,
                    password: regPassword,
                    name: regName,
                    orgType: regOrgType,
                    department: regDepartment,
                    phone: regPhone,
                }),
            });

            const data = await res.json();
            if (res.ok) {
                setRegOrgType('town');
                setRegDepartment('');
                setRegName('');
                setRegPhone('');
                setRegUsername('');
                setRegPassword('');
                setRegConfirmPassword('');
                setMode('login');
                setNotice(data.message || '注册申请已提交，请等待管理员审批通过后登录');
            } else {
                setError(data.error || '注册失败，请检查填写内容');
            }
        } catch {
            setError('网络错误，请稍后重试');
        } finally {
            setRegLoading(false);
        }
    };

    return (
        <main className={styles.container}>
            {/* Left Side: System Branding & Core Capabilities */}
            <div className={styles.leftPanel}>
                <div className={styles.leftContent}>
                    <div className={styles.branding}>
                        <div className={styles.orgBadge}>杭州市临安区市场监督管理局</div>
                        <h1>招投标领域公平竞争审查系统</h1>
                        <p>BIDDING &amp; TENDERING FAIR COMPETITION REVIEW SYSTEM</p>
                    </div>

                    <div className={styles.capabilityList}>
                        {CAPABILITY_CARDS.map((card) => (
                            <div key={card.title} className={styles.capabilityCard}>
                                <div className={styles.capabilityIcon}>{card.icon}</div>
                                <div className={styles.capabilityText}>
                                    <h3>{card.title}</h3>
                                    <p>{card.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.footer}>
                    <div className={styles.beianRow}>
                        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
                            浙ICP备2026097272号-1
                        </a>
                        <a
                            href="https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=33018502002722"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.beianLink}
                        >
                            <img src="/beian.png" alt="备案图标" style={{ width: '16px', height: '16px' }} />
                            浙公网安备33018502002722号
                        </a>
                    </div>
                </div>
            </div>

            {/* Right Side: Login / Register Switch */}
            <div className={styles.rightPanel}>
                <div className={styles.rightPanelInner}>
                    <div className={styles.loginBox}>
                        {mode === 'login' ? (
                            <>
                                <div className={styles.logoPlaceholder}>
                                    <div className={styles.logoIcon}>⚖️</div>
                                    <h2>审查员登录</h2>
                                    <p className={styles.subTitle}>请使用已审批通过的账号登录系统</p>
                                </div>

                                <form className={styles.form} onSubmit={handleLogin}>
                                    {notice && <div className={styles.noticeBox}>{notice}</div>}
                                    {error && <div className={styles.errorBox}>{error}</div>}

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

                                <div className={styles.switchBar}>
                                    还没有账号？
                                    <button
                                        type="button"
                                        className={styles.switchBtn}
                                        onClick={() => switchMode('register')}
                                    >
                                        立即注册
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className={styles.logoPlaceholderCompact}>
                                    <h2>申请开通账号</h2>
                                    <p className={styles.subTitle}>提交后经管理员审核通过即可登录使用</p>
                                </div>

                                <form className={styles.regForm} onSubmit={handleRegister}>
                                    {error && <div className={styles.errorBox}>{error}</div>}

                                    <div className={styles.inputGroup}>
                                        <label>主体类型</label>
                                        <div className={styles.segmentGroup}>
                                            {ORG_TYPE_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    className={`${styles.segmentBtn} ${regOrgType === opt.value ? styles.segmentActive : ''}`}
                                                    onClick={() => handleOrgTypeChange(opt.value)}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={styles.inputGroup}>
                                        <label>
                                            {regOrgType === 'town'
                                                ? '所属镇街'
                                                : regOrgType === 'gov'
                                                    ? '所属区级部门'
                                                    : '招标代理公司全称'}
                                        </label>
                                        {regOrgType === 'town' ? (
                                            <select
                                                className={styles.input}
                                                value={regDepartment}
                                                onChange={(e) => setRegDepartment(e.target.value)}
                                                required
                                            >
                                                <option value="">请选择所属镇街</option>
                                                {TOWN_LIST.map((town) => (
                                                    <option key={town} value={town}>{town}</option>
                                                ))}
                                            </select>
                                        ) : regOrgType === 'gov' ? (
                                            <select
                                                className={styles.input}
                                                value={regDepartment}
                                                onChange={(e) => setRegDepartment(e.target.value)}
                                                required
                                            >
                                                <option value="">请选择区级部门</option>
                                                {GOV_DEPT_LIST.map((dept) => (
                                                    <option key={dept} value={dept}>{dept}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                placeholder="请输入工程建设代理公司全称（如：杭州XX工程管理有限公司）"
                                                className={styles.input}
                                                value={regDepartment}
                                                onChange={(e) => setRegDepartment(e.target.value)}
                                                minLength={4}
                                                maxLength={64}
                                                required
                                            />
                                        )}
                                    </div>

                                    <div className={styles.twoColRow}>
                                        <div className={styles.inputGroup}>
                                            <label>真实姓名</label>
                                            <input
                                                type="text"
                                                placeholder="2-32位姓名"
                                                className={styles.input}
                                                value={regName}
                                                onChange={(e) => setRegName(e.target.value)}
                                                minLength={2}
                                                maxLength={32}
                                                required
                                            />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label>手机号码</label>
                                            <input
                                                type="tel"
                                                placeholder="11位手机号"
                                                className={styles.input}
                                                value={regPhone}
                                                onChange={(e) => setRegPhone(e.target.value)}
                                                maxLength={11}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className={styles.inputGroup}>
                                        <label>登录用户名</label>
                                        <input
                                            type="text"
                                            placeholder="3-32位字母、数字、下划线或连字符"
                                            className={styles.input}
                                            value={regUsername}
                                            onChange={(e) => setRegUsername(e.target.value)}
                                            minLength={3}
                                            maxLength={32}
                                            required
                                        />
                                    </div>

                                    <div className={styles.twoColRow}>
                                        <div className={styles.inputGroup}>
                                            <label>设置密码</label>
                                            <input
                                                type="password"
                                                placeholder="至少8位含两种字符"
                                                className={styles.input}
                                                value={regPassword}
                                                onChange={(e) => setRegPassword(e.target.value)}
                                                minLength={8}
                                                required
                                            />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label>确认密码</label>
                                            <input
                                                type="password"
                                                placeholder="再次输入密码"
                                                className={styles.input}
                                                value={regConfirmPassword}
                                                onChange={(e) => setRegConfirmPassword(e.target.value)}
                                                minLength={8}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        className={styles.loginBtn}
                                        disabled={regLoading}
                                    >
                                        {regLoading ? '提交中...' : '提交注册申请'}
                                    </button>
                                </form>

                                <div className={styles.switchBar}>
                                    已有账号？
                                    <button
                                        type="button"
                                        className={styles.switchBtn}
                                        onClick={() => switchMode('login')}
                                    >
                                        返回登录
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
