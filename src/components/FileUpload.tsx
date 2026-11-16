'use client';

import React, { useState, useCallback } from 'react';
import styles from './FileUpload.module.css';

interface Props {
    onFileSelect: (file: File) => void;
}

/** 文书层叠插画（线性、克制，品牌色描边） */
function DocStackIllustration() {
    return (
        <svg width="76" height="64" viewBox="0 0 76 64" fill="none" aria-hidden="true">
            <rect x="20" y="4" width="40" height="50" rx="4" transform="rotate(8 20 4)" fill="#EFECE6" stroke="#D2CDC2" strokeWidth="1.5" />
            <rect x="12" y="6" width="40" height="50" rx="4" transform="rotate(-6 12 6)" fill="#F6F5F1" stroke="#D2CDC2" strokeWidth="1.5" />
            <rect x="18" y="8" width="40" height="52" rx="4" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.75" />
            <path d="M26 20h18M26 27h24M26 34h24M26 41h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" opacity="0.55" />
            <rect x="44" y="40" width="12" height="12" rx="2" stroke="#C84B31" strokeWidth="1.5" fill="#FBEDE8" />
            <path d="M47 46h6M50 43v6" stroke="#C84B31" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

export default function FileUpload({ onFileSelect }: Props) {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const selectedFile = e.dataTransfer.files[0];
            setFile(selectedFile);
            onFileSelect(selectedFile);
        }
    }, [onFileSelect]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            onFileSelect(selectedFile);
        }
    }, [onFileSelect]);

    return (
        <div className={styles.container}>
            <div
                className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    id="fileInput"
                    className={styles.hiddenInput}
                    onChange={handleFileSelect}
                    accept=".docx,.txt"
                />
                <label htmlFor="fileInput" className={styles.label}>
                    {file ? (
                        <div className={styles.fileInfo}>
                            <span className={styles.fileName}>{file.name}</span>
                            <span className={styles.fileSize}>{(file.size / 1024).toFixed(2)} KB</span>
                        </div>
                    ) : (
                        <>
                            <div className={styles.icon}><DocStackIllustration /></div>
                            <p className={styles.title}>
                                {isDragging ? '松开鼠标，投递文书' : (
                                    <>将招标文件拖拽至此，或 <span className={styles.browse}>点击选择文件</span></>
                                )}
                            </p>
                            <span className={styles.hint}>
                                支持 <b>.docx</b> 格式，单个文件不超过 10MB · 自动对照《浙江省招标投标领域公平竞争审查细则》
                            </span>
                        </>
                    )}
                </label>
            </div>
        </div>
    );
}
