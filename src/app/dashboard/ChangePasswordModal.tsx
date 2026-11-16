'use client';

import React, { useState } from 'react';
import kit from '@/components/ui/kit.module.css';
import { CloseIcon, KeyIcon, LockIcon } from '@/components/ui/Icons';

interface ChangePasswordModalProps {
    /** 改密成功后由调用方决定后续动作（当前是强制重新登录） */
    onSuccess: () => void;
    onClose: () => void;
}

export default function ChangePasswordModal({ onSuccess, onClose }: ChangePasswordModalProps) {
    const [form, setForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (form.newPassword !== form.confirmPassword) {
            alert('两次输入的新密码不一致');
            return;
        }

        if (form.newPassword.length < 8) {
            alert('新密码长度至少需要8位');
            return;
        }

        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: form.currentPassword,
                    newPassword: form.newPassword
                })
            });

            const data = await res.json();

            if (res.ok) {
                alert('密码修改成功，请重新登录');
                onClose();
                setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                onSuccess();
            } else {
                alert(data.error || '修改失败');
            }
        } catch (error) {
            console.error('Change password error:', error);
            alert('修改失败，请稍后重试');
        }
    };

    return (
        <div className={kit.overlay} onClick={onClose}>
            <div
                className={kit.modal}
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="change-password-title"
            >
                <button type="button" className={kit.modalClose} onClick={onClose} aria-label="关闭">
                    <CloseIcon size={16} />
                </button>
                <div className={kit.modalHeader}>
                    <span className={kit.modalIcon}><KeyIcon size={19} /></span>
                    <div>
                        <h3 id="change-password-title" className={kit.modalTitle}>修改登录密码</h3>
                        <p className={kit.modalDesc}>修改成功后需使用新密码重新登录</p>
                    </div>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className={kit.modalBody}>
                        <div className={kit.field} style={{ marginBottom: 14 }}>
                            <label className={kit.label} htmlFor="cp-current">当前密码</label>
                            <div className={kit.inputWrap}>
                                <input
                                    id="cp-current"
                                    type="password"
                                    required
                                    className={kit.input}
                                    value={form.currentPassword}
                                    onChange={e => setForm({ ...form, currentPassword: e.target.value })}
                                    placeholder="请输入当前密码"
                                    autoComplete="current-password"
                                />
                                <span className={kit.inputIcon}><LockIcon size={16} /></span>
                            </div>
                        </div>
                        <div className={kit.field} style={{ marginBottom: 14 }}>
                            <label className={kit.label} htmlFor="cp-new">新密码</label>
                            <div className={kit.inputWrap}>
                                <input
                                    id="cp-new"
                                    type="password"
                                    required
                                    className={kit.input}
                                    value={form.newPassword}
                                    onChange={e => setForm({ ...form, newPassword: e.target.value })}
                                    placeholder="至少 8 位，建议包含字母与数字"
                                    minLength={6}
                                    autoComplete="new-password"
                                />
                                <span className={kit.inputIcon}><KeyIcon size={16} /></span>
                            </div>
                        </div>
                        <div className={kit.field}>
                            <label className={kit.label} htmlFor="cp-confirm">确认新密码</label>
                            <div className={kit.inputWrap}>
                                <input
                                    id="cp-confirm"
                                    type="password"
                                    required
                                    className={kit.input}
                                    value={form.confirmPassword}
                                    onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                                    placeholder="再次输入新密码"
                                    minLength={6}
                                    autoComplete="new-password"
                                />
                                <span className={kit.inputIcon}><KeyIcon size={16} /></span>
                            </div>
                        </div>
                    </div>
                    <div className={kit.modalFooter}>
                        <button type="button" className={`${kit.btn} ${kit.btnSecondary}`} onClick={onClose}>取消</button>
                        <button type="submit" className={`${kit.btn} ${kit.btnPrimary}`}>确认修改</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
