'use client';

import React from 'react';
import styles from './page.module.css';
import kit from '@/components/ui/kit.module.css';
import FileUpload from '@/components/FileUpload';
import type { DashboardUser, ReviewRecordSummary } from './types';
import { RecordStatusBadge, RiskCountBadge, formatDateTime } from './record-badges';
import {
    ArrowRightIcon,
    CheckIcon,
    FileTextIcon,
    HistoryIcon,
    LedgerIcon,
    RefreshIcon,
    SparklesIcon,
    UploadDocIcon,
} from '@/components/ui/Icons';

interface WorkspaceTabProps {
    pendingFile: File | null;
    selectedFile: File | null;
    isAnalyzing: boolean;
    analyzingStatus: string;
    analyzingProgress: number;
    onFileSelect: (file: File) => void;
    onRemoveFile: () => void;
    onStartReview: () => void;
    reviewRecords: ReviewRecordSummary[];
    user: DashboardUser | null;
    onViewRecord: (record: ReviewRecordSummary) => void;
    onViewLedger: () => void;
}

const SCOPE_TAGS = ['招标文件', '资格预审', '采购需求', '发包公告'];

/** 审查流程步骤（仅用于进度可视化，阈值与后端 progress 粗略对应） */
const REVIEW_STEPS = [
    { label: '文档解析', from: 0 },
    { label: '准入判定', from: 15 },
    { label: '法规检索', from: 30 },
    { label: '深度审查', from: 50 },
    { label: '复核出具', from: 80 },
];

function formatSize(bytes: number) {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function WorkspaceTab({
    pendingFile,
    selectedFile,
    isAnalyzing,
    analyzingStatus,
    analyzingProgress,
    onFileSelect,
    onRemoveFile,
    onStartReview,
    reviewRecords,
    user,
    onViewRecord,
    onViewLedger
}: WorkspaceTabProps) {
    const isAdmin = user?.role === 'admin';
    const progress = Math.min(100, Math.max(0, analyzingProgress));
    const currentStep = REVIEW_STEPS.reduce((acc, step, index) => (progress >= step.from ? index : acc), 0);

    return (
        <div className={styles.workspaceGrid}>
            {/* 页面抬头 */}
            <div className={styles.pageHead}>
                <div>
                    <div className={styles.pageEyebrow}>文件审查</div>
                    <h1 className={styles.pageTitle}>
                        {user ? `${user.name}，您好` : '审查工作台'}
                    </h1>
                    <p className={styles.pageDesc}>
                        上传招标文书，系统将对照《公平竞争审查条例》与浙江省招投标领域细则逐条排查排除、限制竞争条款。
                    </p>
                </div>
            </div>

            {/* 投递台 */}
            <section className={`${kit.card} ${styles.deskCard}`}>
                <div className={kit.cardHeader}>
                    <div>
                        <h2 className={kit.cardTitle}>
                            <span className={kit.cardTitleIcon}><UploadDocIcon size={17} /></span>
                            招标文书合规审查投递台
                        </h2>
                    </div>
                    <div className={styles.scopeTags}>
                        <span className={styles.scopeLabel}>审查范围</span>
                        {SCOPE_TAGS.map((tag, i) => (
                            <React.Fragment key={tag}>
                                {i > 0 && <span className={styles.scopeDot} aria-hidden="true">·</span>}
                                <span className={styles.scopeTag}>{tag}</span>
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div className={styles.uploadWrapper}>
                    {isAnalyzing ? (
                        <div className={styles.analyzingState}>
                            <div className={styles.analyzingHead}>
                                <span className={styles.analyzingIcon}>
                                    <span className={`${kit.spinner} ${kit.spinnerLg}`} />
                                </span>
                                <div className={styles.analyzingInfo}>
                                    <div className={styles.analyzingText}>{analyzingStatus}</div>
                                    <div className={styles.analyzingSubText}>
                                        {selectedFile ? selectedFile.name : '多智能体协同审查中'} · 请勿关闭页面
                                    </div>
                                </div>
                                <div className={styles.analyzingPct}>
                                    <span className={kit.mono}>{progress}</span>%
                                </div>
                            </div>

                            <div className={styles.progressTrack}>
                                <div className={styles.progressBar} style={{ width: `${progress}%` }} />
                            </div>

                            <ol className={styles.stepList}>
                                {REVIEW_STEPS.map((step, index) => {
                                    const state = index < currentStep ? 'done' : index === currentStep ? 'current' : 'todo';
                                    return (
                                        <li
                                            key={step.label}
                                            className={`${styles.stepItem} ${state === 'done' ? styles.stepDone : ''} ${state === 'current' ? styles.stepCurrent : ''}`}
                                        >
                                            <span className={styles.stepMark}>
                                                {state === 'done' ? <CheckIcon size={12} strokeWidth={2.4} /> : index + 1}
                                            </span>
                                            <span>{step.label}</span>
                                        </li>
                                    );
                                })}
                            </ol>
                        </div>
                    ) : selectedFile ? (
                        <div className={styles.readyState}>
                            <div className={styles.readyFileIcon}>
                                <FileTextIcon size={26} strokeWidth={1.5} />
                                <span className={styles.readyFileExt}>
                                    {(selectedFile.name.split('.').pop() || 'doc').toUpperCase()}
                                </span>
                            </div>
                            <div className={styles.readyFileInfo}>
                                <div className={styles.readyFileName} title={selectedFile.name}>{selectedFile.name}</div>
                                <div className={styles.readyFileSize}>
                                    <span className={kit.mono}>{formatSize(selectedFile.size)}</span>
                                    <span className={styles.readyDot} />
                                    已就绪，可开始审查
                                </div>
                            </div>
                            <div className={styles.readyActions}>
                                <button type="button" className={`${kit.btn} ${kit.btnSecondary}`} onClick={onRemoveFile}>
                                    <RefreshIcon size={15} />
                                    重新选择
                                </button>
                                <button type="button" className={`${kit.btn} ${kit.btnPrimary} ${styles.startBtn}`} onClick={onStartReview}>
                                    <SparklesIcon size={16} />
                                    开始智能审查
                                </button>
                            </div>
                        </div>
                    ) : (
                        <FileUpload key={pendingFile ? 'pending' : 'new'} onFileSelect={onFileSelect} />
                    )}
                </div>
            </section>

            {/* 最近审查记录 */}
            <section className={`${kit.card} ${styles.historySection}`}>
                <div className={kit.cardHeader}>
                    <div>
                        <h2 className={kit.cardTitle}>
                            <span className={kit.cardTitleIcon}><HistoryIcon size={17} /></span>
                            最近审查记录
                        </h2>
                        <p className={kit.cardSub}>
                            {isAdmin ? '全部用户最近提交的审查记录' : '您最近提交的审查记录'}
                        </p>
                    </div>
                    <button type="button" className={`${kit.btn} ${kit.btnSecondary} ${kit.btnSm}`} onClick={onViewLedger}>
                        <LedgerIcon size={15} />
                        查看全部台账
                    </button>
                </div>

                <div className={kit.tableWrap}>
                    <table className={kit.table}>
                        <thead>
                            <tr>
                                <th style={{ width: 110 }}>状态</th>
                                <th>文件名称</th>
                                {isAdmin && <th style={{ width: 180 }}>提交账号</th>}
                                <th style={{ width: 120 }}>风险点</th>
                                <th style={{ width: 150 }}>审查时间</th>
                                <th style={{ width: 120, textAlign: 'right' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reviewRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={isAdmin ? 6 : 5}>
                                        <div className={kit.empty}>
                                            <span className={kit.emptyIcon}><FileTextIcon size={24} strokeWidth={1.5} /></span>
                                            <div className={kit.emptyTitle}>暂无审查记录</div>
                                            <div className={kit.emptyDesc}>在上方投递台上传招标文书，开始第一次审查</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                reviewRecords.map((record) => (
                                    <tr key={record.id} className={styles.recordRow} onClick={() => onViewRecord(record)}>
                                        <td><RecordStatusBadge status={record.status} /></td>
                                        <td>
                                            <div className={styles.fileCell}>
                                                <span className={styles.fileCellIcon}><FileTextIcon size={16} /></span>
                                                <span className={styles.fileName} title={record.fileName}>{record.fileName}</span>
                                            </div>
                                        </td>
                                        {isAdmin && (
                                            <td>
                                                <div className={kit.cellMain}>{record.user?.name || '未知'}</div>
                                                {record.user?.department && (
                                                    <div className={kit.cellSub}>{record.user.department}</div>
                                                )}
                                            </td>
                                        )}
                                        <td><RiskCountBadge status={record.status} riskCount={record.riskCount} /></td>
                                        <td className={kit.cellNum}>{formatDateTime(record.createdAt)}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button
                                                type="button"
                                                className={styles.viewBtn}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onViewRecord(record);
                                                }}
                                            >
                                                查看报告
                                                <ArrowRightIcon size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
