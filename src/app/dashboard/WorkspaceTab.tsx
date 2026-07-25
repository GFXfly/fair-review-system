'use client';

import React from 'react';
import styles from './page.module.css';
import FileUpload from '@/components/FileUpload';
import type { DashboardUser, ReviewRecordSummary } from './types';

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

    return (
        <div className={styles.workspaceGrid}>
            {/* Left: The Main Action - Upload & Review */}
            <div className={styles.mainActionArea}>
                <div className={styles.sectionHeader}>
                    <h2>🚀 发起新审查</h2>
                    {/* Description removed as requested */}
                </div>
                <div className={styles.uploadWrapper}>
                    {isAnalyzing ? (
                        <div className={styles.analyzingState}>
                            <div className={styles.spinner}></div>
                            <div className={styles.analyzingText}>{analyzingStatus}</div>
                            <div style={{ width: '80%', maxWidth: '480px', marginTop: '16px' }}>
                                <div style={{
                                    height: '8px',
                                    background: '#e5e7eb',
                                    borderRadius: '999px',
                                    overflow: 'hidden',
                                }}>
                                    <div style={{
                                        width: `${Math.min(100, Math.max(0, analyzingProgress))}%`,
                                        height: '100%',
                                        background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                                        transition: 'width 400ms ease',
                                    }} />
                                </div>
                                <div style={{
                                    marginTop: '6px',
                                    fontSize: '12px',
                                    color: '#6b7280',
                                    textAlign: 'right',
                                }}>
                                    {analyzingProgress}%
                                </div>
                            </div>
                            <div className={styles.analyzingSubText}>AI 多智能体系统正在云端计算中...</div>
                        </div>
                    ) : selectedFile ? (
                        <div className={styles.readyState}>
                            <div className={styles.readyFileIcon}>📄</div>
                            <div className={styles.readyFileInfo}>
                                <div className={styles.readyFileName}>{selectedFile.name}</div>
                                <div className={styles.readyFileSize}>{(selectedFile.size / 1024).toFixed(2)} KB</div>
                            </div>
                            <div className={styles.readyActions}>
                                <button className={styles.secondaryBtn} onClick={onRemoveFile}>重新上传</button>
                                <button className={styles.primaryBtn} onClick={onStartReview}>开始审查</button>
                            </div>
                        </div>
                    ) : (
                        // Force remount to clear internal state if needed by using a key,
                        // though FileUpload state is internal, so key is good practice if we want to reset it.
                        <FileUpload key={pendingFile ? 'pending' : 'new'} onFileSelect={onFileSelect} />
                    )}
                </div>
            </div>

            {/* Right: The "Trigger" - System Alerts */}
            <div className={styles.sidePanel}>
                <div className={styles.panelHeader}>
                    <h3>🚨 预警消息</h3>
                </div>
                <div className={styles.alertList}>
                    {/* 预警数据源尚未接入。在有真实接口之前保持空态，
                        不要在这里放示例数据——业务人员会当成真实风险提示。 */}
                    <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9ca3af' }}>
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔔</div>
                        <div style={{ fontSize: '13px' }}>暂无预警消息</div>
                    </div>
                </div>
            </div>

            {/* Bottom: The "History" - Recent Reviews */}
            <div className={styles.historySection}>
                <div className={styles.sectionHeader}>
                    <h2>🕒 最近审查记录</h2>
                    <button className={styles.linkBtn} onClick={onViewLedger}>查看全部台账</button>
                </div>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>状态</th>
                            <th>文件名称</th>
                            {isAdmin && <th>提交账号</th>}
                            <th>风险点</th>
                            <th>审查时间</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reviewRecords.length === 0 ? (
                            <tr>
                                <td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                                    <div style={{ fontSize: '14px' }}>暂无审查记录</div>
                                    <div style={{ fontSize: '12px', marginTop: '8px', color: '#d1d5db' }}>上传文件开始审查</div>
                                </td>
                            </tr>
                        ) : (
                            reviewRecords.map((record) => (
                                <tr key={record.id}>
                                    <td>
                                        {record.status === 'completed' && <span style={{ color: '#10b981', background: '#d1fae5', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>已完成</span>}
                                        {record.status === 'ignored' && <span style={{ color: '#6b7280', background: '#e5e7eb', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>无需审查</span>}
                                        {record.status === 'failed' && <span style={{ color: '#ef4444', background: '#fee2e2', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>失败</span>}
                                    </td>
                                    <td className={styles.fileName}>{record.fileName}</td>
                                    {isAdmin && (
                                        <td style={{ fontSize: '13px' }}>
                                            <div style={{ fontWeight: 500 }}>{record.user?.name || '未知'}</div>
                                            {record.user?.department && (
                                                <div style={{ fontSize: '12px', color: '#6b7280' }}>{record.user.department}</div>
                                            )}
                                        </td>
                                    )}
                                    <td>
                                        {record.status === 'ignored' ? '-' : (
                                            record.riskCount > 0 ?
                                                <span style={{ color: '#ef4444' }}>{record.riskCount} 个风险</span> :
                                                <span style={{ color: '#10b981' }}>无风险</span>
                                        )}
                                    </td>
                                    <td style={{ color: '#6b7280' }}>
                                        {new Date(record.createdAt).toLocaleString()}
                                    </td>
                                    <td>
                                        <button
                                            className={styles.linkBtn}
                                            onClick={() => onViewRecord(record)}
                                        >
                                            查看
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
