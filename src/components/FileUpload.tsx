'use client';

import React, { useState, useCallback } from 'react';
import styles from './FileUpload.module.css';

interface Props {
    onFileSelect: (file: File) => void;
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
                            <div className={styles.icon}>📄</div>
                            <p>点击或拖拽文件到此处上传</p>
                            <span className={styles.hint}>仅支持 .docx 格式</span>
                        </>
                    )}
                </label>
            </div>
        </div>
    );
}
