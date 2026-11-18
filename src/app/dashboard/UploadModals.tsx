'use client';

import React from 'react';
import styles from './page.module.css';
import kit from '@/components/ui/kit.module.css';
import { AlertTriangleIcon, InfoIcon, LockIcon, RefreshIcon } from '@/components/ui/Icons';

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
            {/* 涉密文档安全提示 */}
            {showSecurityWarning && (
                <div className={kit.overlay}>
                    <div className={kit.modal} role="alertdialog" aria-modal="true" aria-labelledby="security-title">
                        <div className={kit.modalHeader}>
                            <span className={`${kit.modalIcon} ${kit.modalIconDanger}`}><LockIcon size={20} /></span>
                            <div>
                                <h3 id="security-title" className={kit.modalTitle}>严禁上传涉密文档</h3>
                                <p className={kit.modalDesc}>
                                    涉密文书一律禁止上传至本系统。请确认所选文件不涉及国家秘密与工作秘密。
                                </p>
                            </div>
                        </div>
                        <div className={kit.modalBody}>
                            <ul className={styles.checkList}>
                                <li>文件不含密级标识或涉密内容</li>
                                <li>确认后将上传文件并进入智能审查流程</li>
                            </ul>
                        </div>
                        <div className={kit.modalFooter}>
                            <button type="button" className={`${kit.btn} ${kit.btnSecondary}`} onClick={onCancelUpload}>取消</button>
                            <button type="button" className={`${kit.btn} ${kit.btnSeal}`} onClick={onConfirmUpload}>
                                我已确认，继续上传
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 旧版 .doc 格式提示 */}
            {showDocWarning && (
                <div className={kit.overlay}>
                    <div className={kit.modal} role="alertdialog" aria-modal="true" aria-labelledby="doc-title">
                        <div className={kit.modalHeader}>
                            <span className={`${kit.modalIcon} ${kit.modalIconWarn}`}><RefreshIcon size={20} /></span>
                            <div>
                                <h3 id="doc-title" className={kit.modalTitle}>请转换为 .docx 或文字版 .pdf 格式</h3>
                                <p className={kit.modalDesc}>
                                    为确保审查精准度，系统支持标准 Word（.docx）与电子文字版 PDF（.pdf）文件，暂不直接支持旧版 .doc 格式。
                                </p>
                            </div>
                        </div>
                        <div className={kit.modalBody}>
                            <div className={`${kit.alert} ${kit.alertInfo}`}>
                                <InfoIcon size={16} />
                                <span>
                                    在 Word / WPS 中打开文件，选择 <strong>「文件」→「另存为」</strong>，
                                    并将保存类型选为 <strong>Word 文档（.docx）</strong>，或直接导出为<strong>电子文字版 PDF（.pdf）</strong>。
                                </span>
                            </div>
                        </div>
                        <div className={kit.modalFooter}>
                            <button type="button" className={`${kit.btn} ${kit.btnPrimary} ${kit.btnBlock}`} onClick={onCloseDocWarning}>
                                <AlertTriangleIcon size={15} />
                                我知道了，去转换
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
