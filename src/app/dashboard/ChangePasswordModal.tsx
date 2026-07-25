'use client';

import React, { useState } from 'react';
import styles from './page.module.css';

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
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} style={{ width: '400px' }} onClick={e => e.stopPropagation()}>
                <h3 className={styles.modalTitle}>🔒 修改密码</h3>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>当前密码</label>
                        <input
                            type="password"
                            required
                            value={form.currentPassword}
                            onChange={e => setForm({ ...form, currentPassword: e.target.value })}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                            placeholder="请输入当前密码"
                        />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>新密码</label>
                        <input
                            type="password"
                            required
                            value={form.newPassword}
                            onChange={e => setForm({ ...form, newPassword: e.target.value })}
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
                            value={form.confirmPassword}
                            onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                            placeholder="再次输入新密码"
                            minLength={6}
                        />
                    </div>
                    <div className={styles.modalActions}>
                        <button type="button" className={styles.secondaryBtn} onClick={onClose}>取消</button>
                        <button type="submit" className={styles.primaryBtn}>确认修改</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
