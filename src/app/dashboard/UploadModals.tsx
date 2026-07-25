'use client';

import React from 'react';
import styles from './page.module.css';

interface UploadModalsProps {
    showSecurityWarning: boolean;
    showDocWarning: boolean;
    onConfirmUpload: () => void;
    onCancelUpload: () => void;
    onCloseDocWarning: () => void;
}

export default function UploadModals({
    showSecurityWarning,
    showDocWarning,
    onConfirmUpload,
    onCancelUpload,
    onCloseDocWarning
}: UploadModalsProps) {
    return (
        <>
            {/* Security Warning Modal */}
            {showSecurityWarning && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalIcon}>⚠️</div>
                        <h3 className={styles.modalTitle}>严禁上传涉密文档</h3>
                        <div className={styles.modalActions}>
                            <button className={styles.secondaryBtn} onClick={onCancelUpload}>取消</button>
                            <button className={`${styles.primaryBtn} ${styles.dangerBtn}`} onClick={onConfirmUpload}>确认</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Old .doc Format Warning Modal */}
            {showDocWarning && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent} style={{ width: '400px', padding: '30px', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                backgroundColor: '#EFF6FF',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '20px',
                                color: '#3B82F6',
                                fontSize: '32px'
                            }}>
                                🔄
                            </div>

                            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1F2937', marginBottom: '8px' }}>
                                请转换为 .docx 格式
                            </h3>

                            <div style={{ fontSize: '14px', color: '#6B7280', lineHeight: '1.6', marginBottom: '24px' }}>
                                <p>为了确保 AI 审查的精准度，系统目前仅支持标准的 Word (.docx) 文件。</p>
                                <p style={{ marginTop: '8px', fontSize: '13px', backgroundColor: '#F3F4F6', padding: '10px', borderRadius: '8px', color: '#4B5563' }}>
                                    💡 提示：请在 Word 中打开文件，选择<br />
                                    <strong>"文件" &gt; "另存为"</strong>，并将格式选为 <strong>Word 文档 (.docx)</strong>
                                </p>
                            </div>

                            <button
                                className={styles.primaryBtn}
                                onClick={onCloseDocWarning}
                                style={{ width: '100%', padding: '12px', fontSize: '15px' }}
                            >
                                我知道了，去转换
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
