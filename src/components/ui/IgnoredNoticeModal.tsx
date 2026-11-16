'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import kit from '@/components/ui/kit.module.css';
import styles from './IgnoredNoticeModal.module.css';
import {
    AlertCircleIcon,
    CheckCircleIcon,
    CloseIcon,
    FileTextIcon,
    InfoIcon,
} from '@/components/ui/Icons';

export interface NoticeModalState {
    open: boolean;
    mode: 'ignored' | 'error';
    fileName?: string | null;
    message?: string | null;
    suggestion?: string | null;
    recordId?: string | null;
}

export interface IgnoredNoticeModalProps {
    open: boolean;
    mode?: 'ignored' | 'error';
    fileName?: string | null;
    message?: string | null;
    suggestion?: string | null;
    recordId?: string | null;
    onClose: () => void;
    onViewOriginal?: (recordId: string) => void;
}

const DEFAULT_IGNORED_REASON =
    '经智能门禁预审，该文书不涉及市场准入、产业发展、招商引资、招标投标或政府采购等市场主体经济活动，已自动跳过公平竞争审查流程。';

function formatIgnoredReason(raw?: string | null): string {
    if (typeof raw !== 'string') return DEFAULT_IGNORED_REASON;

    const cleaned = raw
        .replace(/^【无需审查】\s*/g, '')
        .replace(/^无需审查[：:]\s*/g, '')
        .replace(/^文件类型[：:]\s*IGNORE[。.]?\s*/i, '')
        .replace(/^AI\s*判定理由[：:]\s*/i, '')
        .trim();

    if (!cleaned || cleaned === '审查完成（无需审查）' || cleaned === '该文件无需审查') {
        return DEFAULT_IGNORED_REASON;
    }

    return cleaned;
}

export default function IgnoredNoticeModal({
    open,
    mode = 'ignored',
    fileName,
    message,
    suggestion,
    recordId,
    onClose,
    onViewOriginal,
}: IgnoredNoticeModalProps) {
    const router = useRouter();

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    const isError = mode === 'error';
    const titleId = isError ? 'notice-error-title' : 'notice-ignored-title';

    const handleViewOriginal = () => {
        if (!recordId) return;
        onClose();
        if (onViewOriginal) {
            onViewOriginal(recordId);
        } else {
            router.push(`/review/${recordId}`);
        }
    };

    return (
        <div
            className={kit.overlay}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className={kit.modal}
                role={isError ? 'alertdialog' : 'dialog'}
                aria-modal="true"
                aria-labelledby={titleId}
            >
                <button
                    type="button"
                    className={kit.modalClose}
                    onClick={onClose}
                    aria-label="关闭弹窗"
                >
                    <CloseIcon size={16} />
                </button>

                <div className={kit.modalHeader}>
                    <span
                        className={`${kit.modalIcon} ${
                            isError ? kit.modalIconDanger : styles.iconOk
                        }`}
                    >
                        {isError ? <AlertCircleIcon size={20} /> : <CheckCircleIcon size={20} />}
                    </span>
                    <div>
                        <h3 id={titleId} className={kit.modalTitle}>
                            {isError ? '审查未能完成' : '该文件无需开展公平竞争审查'}
                        </h3>
                        <p className={kit.modalDesc}>
                            {isError
                                ? '文书提交或处理过程中出现异常，请查看下方原因后重试'
                                : '经智能门禁预审，文书不涉及市场主体经济活动或不属于审查范畴'}
                        </p>
                    </div>
                </div>

                <div className={kit.modalBody}>
                    {fileName && (
                        <div className={styles.fileRow}>
                            <div className={styles.fileMeta}>
                                <span className={styles.fileIcon}>
                                    <FileTextIcon size={15} />
                                </span>
                                <span className={styles.fileName} title={fileName}>
                                    {fileName}
                                </span>
                            </div>
                            {!isError && (
                                <span className={`${kit.badge} ${kit.toneOk}`}>无需审查</span>
                            )}
                        </div>
                    )}

                    {isError ? (
                        <>
                            <div className={`${kit.alert} ${kit.alertError}`}>
                                <AlertCircleIcon size={16} />
                                <span>{message?.trim() || '审查启动失败，请稍后重试。'}</span>
                            </div>
                            {suggestion?.trim() && (
                                <div className={`${kit.alert} ${kit.alertWarn} ${styles.suggestionCard}`}>
                                    <InfoIcon size={16} />
                                    <span>{suggestion.trim()}</span>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={styles.reasonCard}>
                            <div className={styles.reasonLabel}>门禁预审判定依据</div>
                            <div className={styles.reasonText}>{formatIgnoredReason(message)}</div>
                        </div>
                    )}
                </div>

                <div className={kit.modalFooter}>
                    {!isError && recordId && (
                        <button
                            type="button"
                            className={`${kit.btn} ${kit.btnSecondary}`}
                            onClick={handleViewOriginal}
                        >
                            查看文书原文
                        </button>
                    )}
                    <button
                        type="button"
                        className={`${kit.btn} ${kit.btnPrimary}`}
                        onClick={onClose}
                    >
                        {isError ? '关闭' : '我知道了'}
                    </button>
                </div>
            </div>
        </div>
    );
}
