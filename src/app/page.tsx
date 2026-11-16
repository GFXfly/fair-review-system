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
import OrgPicker from '@/components/ui/OrgPicker';
import BrandSeal from '@/components/ui/BrandSeal';
import {
    AlertCircleIcon,
    ArrowRightIcon,
    BuildingIcon,
    CheckCircleIcon,
    EyeIcon,
    EyeOffIcon,
    LockIcon,
    PhoneIcon,
    UserIcon,
} from '@/components/ui/Icons';

const CAPABILITY_PILLS = [
    { no: '01', label: '事前合规自查' },
    { no: '02', label: '浙江 21 条细则对标' },
    { no: '03', label: '意见书一键导出' },
];

const ORG_TYPE_OPTIONS: { value: OrgType; label: string }[] = [
    { value: 'town', label: '镇街经办' },
    { value: 'agency', label: '招标代理公司' },
    { value: 'gov', label: '区级部门' },
];

interface PasswordInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    minLength?: number;
    autoComplete?: string;
    id: string;
}

function PasswordInput({ value, onChange, placeholder, minLength, autoComplete, id }: PasswordInputProps) {
    const [visible, setVisible] = useState(false);
    return (
        <div className={styles.inputWrap}>
            <span className={styles.inputIcon}><LockIcon size={16} /></span>
            <input
                id={id}
                type={visible ? 'text' : 'password'}
                placeholder={placeholder}
                className={`${styles.input} ${styles.inputHasAction}`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                minLength={minLength}
                autoComplete={autoComplete}
                required
            />
            <button
                type="button"
                className={styles.inputAction}
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? '隐藏密码' : '显示密码'}
                title={visible ? '隐藏密码' : '显示密码'}
            >
                {visible ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
            </button>
        </div>
    );
}

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

    const orgFieldLabel = regOrgType === 'town'
        ? '所属镇街'
        : regOrgType === 'gov'
            ? '所属区级部门'
            : '招标代理公司全称';

    return (
        <main className={styles.container}>
            {/* 左栏：精装卷宗封面 */}
            <section className={styles.cover}>
                <div className={styles.coverTexture} aria-hidden="true" />
                <div className={styles.coverGrid} aria-hidden="true" />

                <header className={styles.coverHead}>
                    <BrandSeal char="审" size={40} variant="onDark" />
                    <div className={styles.coverOrg}>
                        <span className={styles.coverOrgName}>杭州市临安区市场监督管理局</span>
                    </div>
                </header>

                <div className={styles.coverMain}>
                    <span className={styles.coverAccentLine} aria-hidden="true" />
                    <h1 className={styles.coverTitle}>
                        招投标领域
                        <br />
                        <em>公平竞争</em>审查系统
                    </h1>
                    <p className={styles.coverLead}>
                        面向工程招投标文书的事前合规自查与辅助审查平台
                    </p>

                    <div className={styles.capStrip} aria-label="核心能力">
                        {CAPABILITY_PILLS.map((item, idx) => (
                            <React.Fragment key={item.no}>
                                {idx > 0 && <span className={styles.capDot} aria-hidden="true" />}
                                <span className={styles.capPill}>
                                    <span className={styles.capPillNo}>{item.no}</span>
                                    <span>{item.label}</span>
                                </span>
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <footer className={styles.coverFoot}>
                    <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
                        浙ICP备2026097272号-1
                    </a>
                    <span className={styles.footSep} aria-hidden="true" />
                    <a
                        href="https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=33018502002722"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.beianLink}
                    >
                        <img src="/beian.png" alt="备案图标" width={14} height={14} />
                        浙公网安备33018502002722号
                    </a>
                </footer>
            </section>

            {/* 右栏：精装公文卡片 */}
            <section className={styles.formSide}>
                <div className={styles.formScroll}>
                    <div className={`${styles.card} ${mode === 'register' ? styles.cardWide : ''}`}>
                        {mode === 'login' ? (
                            <>
                                <div className={styles.cardHead}>
                                    <h2 className={styles.cardTitle}>系统登录</h2>
                                </div>

                                <form className={styles.form} onSubmit={handleLogin}>
                                    {notice && (
                                        <div className={`${styles.alert} ${styles.alertOk}`} role="status">
                                            <CheckCircleIcon size={16} />
                                            <span>{notice}</span>
                                        </div>
                                    )}
                                    {error && (
                                        <div className={`${styles.alert} ${styles.alertError}`} role="alert">
                                            <AlertCircleIcon size={16} />
                                            <span>{error}</span>
                                        </div>
                                    )}

                                    <div className={styles.field}>
                                        <label htmlFor="login-username" className={styles.label}>用户名</label>
                                        <div className={styles.inputWrap}>
                                            <span className={styles.inputIcon}><UserIcon size={16} /></span>
                                            <input
                                                id="login-username"
                                                type="text"
                                                placeholder="请输入用户名"
                                                className={styles.input}
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                autoComplete="username"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className={styles.field}>
                                        <label htmlFor="login-password" className={styles.label}>密码</label>
                                        <PasswordInput
                                            id="login-password"
                                            value={password}
                                            onChange={setPassword}
                                            placeholder="请输入密码"
                                            autoComplete="current-password"
                                        />
                                    </div>

                                    <button type="submit" className={styles.submitBtn} disabled={isLoading}>
                                        {isLoading ? (
                                            <><span className={styles.spinner} />登录中…</>
                                        ) : (
                                            <>登录系统<ArrowRightIcon size={16} /></>
                                        )}
                                    </button>
                                </form>

                                <div className={styles.switchBar}>
                                    还没有账号？
                                    <button type="button" className={styles.switchBtn} onClick={() => switchMode('register')}>
                                        申请开通账号
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className={styles.cardHead}>
                                    <h2 className={styles.cardTitle}>申请开通账号</h2>
                                    <p className={styles.cardSub}>提交后经管理员审核通过即可使用</p>
                                </div>

                                <form className={styles.form} onSubmit={handleRegister}>
                                    {error && (
                                        <div className={`${styles.alert} ${styles.alertError}`} role="alert">
                                            <AlertCircleIcon size={16} />
                                            <span>{error}</span>
                                        </div>
                                    )}

                                    <div className={styles.field}>
                                        <span className={styles.label}>主体类型</span>
                                        <div className={styles.segment} role="tablist" aria-label="主体类型">
                                            {ORG_TYPE_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={regOrgType === opt.value}
                                                    className={`${styles.segmentBtn} ${regOrgType === opt.value ? styles.segmentActive : ''}`}
                                                    onClick={() => handleOrgTypeChange(opt.value)}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={styles.field}>
                                        <label className={styles.label} htmlFor="reg-org">{orgFieldLabel}</label>
                                        {regOrgType === 'town' ? (
                                            <OrgPicker
                                                key="town"
                                                id="reg-org"
                                                value={regDepartment}
                                                onChange={setRegDepartment}
                                                options={TOWN_LIST}
                                                title="选择所属镇街"
                                                unitLabel="镇街"
                                                placeholder="请选择所属镇街"
                                                searchPlaceholder="快速检索镇街名称..."
                                                required
                                            />
                                        ) : regOrgType === 'gov' ? (
                                            <OrgPicker
                                                key="gov"
                                                id="reg-org"
                                                value={regDepartment}
                                                onChange={setRegDepartment}
                                                options={GOV_DEPT_LIST}
                                                title="选择所属区级部门"
                                                unitLabel="部门"
                                                placeholder="请选择所属区级部门"
                                                searchPlaceholder="快速检索部门名称..."
                                                required
                                            />
                                        ) : (
                                            <div className={styles.inputWrap}>
                                                <span className={styles.inputIcon}><BuildingIcon size={16} /></span>
                                                <input
                                                    id="reg-org"
                                                    type="text"
                                                    placeholder="如：杭州××工程管理有限公司"
                                                    className={styles.input}
                                                    value={regDepartment}
                                                    onChange={(e) => setRegDepartment(e.target.value)}
                                                    minLength={4}
                                                    maxLength={64}
                                                    required
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className={styles.twoCol}>
                                        <div className={styles.field}>
                                            <label className={styles.label} htmlFor="reg-name">真实姓名</label>
                                            <div className={styles.inputWrap}>
                                                <span className={styles.inputIcon}><UserIcon size={16} /></span>
                                                <input
                                                    id="reg-name"
                                                    type="text"
                                                    placeholder="2–32 位姓名"
                                                    className={styles.input}
                                                    value={regName}
                                                    onChange={(e) => setRegName(e.target.value)}
                                                    minLength={2}
                                                    maxLength={32}
                                                    autoComplete="name"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className={styles.field}>
                                            <label className={styles.label} htmlFor="reg-phone">手机号码</label>
                                            <div className={styles.inputWrap}>
                                                <span className={styles.inputIcon}><PhoneIcon size={15} /></span>
                                                <input
                                                    id="reg-phone"
                                                    type="tel"
                                                    placeholder="11 位手机号"
                                                    className={`${styles.input} ${styles.inputMono}`}
                                                    value={regPhone}
                                                    onChange={(e) => setRegPhone(e.target.value)}
                                                    maxLength={11}
                                                    autoComplete="tel"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.field}>
                                        <label className={styles.label} htmlFor="reg-username">登录用户名</label>
                                        <div className={styles.inputWrap}>
                                            <span className={styles.inputIcon}><UserIcon size={16} /></span>
                                            <input
                                                id="reg-username"
                                                type="text"
                                                placeholder="3–32 位字母、数字、下划线或连字符"
                                                className={`${styles.input} ${styles.inputMono}`}
                                                value={regUsername}
                                                onChange={(e) => setRegUsername(e.target.value)}
                                                minLength={3}
                                                maxLength={32}
                                                autoComplete="username"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className={styles.twoCol}>
                                        <div className={styles.field}>
                                            <label className={styles.label} htmlFor="reg-password">设置密码</label>
                                            <PasswordInput
                                                id="reg-password"
                                                value={regPassword}
                                                onChange={setRegPassword}
                                                placeholder="至少 8 位含两种字符"
                                                minLength={8}
                                                autoComplete="new-password"
                                            />
                                        </div>
                                        <div className={styles.field}>
                                            <label className={styles.label} htmlFor="reg-confirm">确认密码</label>
                                            <PasswordInput
                                                id="reg-confirm"
                                                value={regConfirmPassword}
                                                onChange={setRegConfirmPassword}
                                                placeholder="再次输入密码"
                                                minLength={8}
                                                autoComplete="new-password"
                                            />
                                        </div>
                                    </div>

                                    <button type="submit" className={styles.submitBtn} disabled={regLoading}>
                                        {regLoading ? (
                                            <><span className={styles.spinner} />提交中…</>
                                        ) : (
                                            <>提交注册申请<ArrowRightIcon size={16} /></>
                                        )}
                                    </button>
                                </form>

                                <div className={styles.switchBar}>
                                    已有账号？
                                    <button type="button" className={styles.switchBtn} onClick={() => switchMode('login')}>
                                        返回登录
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <p className={styles.formNote}>
                        <LockIcon size={13} />
                        内部政务及授权代理机构使用 · 严禁上传涉密文档
                    </p>
                </div>
            </section>
        </main>
    );
}
