'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NoticeModalState } from '@/components/ui/IgnoredNoticeModal';
import { MAX_UPLOAD_SIZE_BYTES } from '@/lib/upload-constants';

export interface UseReviewSubmitOptions {
    onRefreshRecords?: () => void;
}

/**
 * 文件上传与审查提交的全部状态，含 /api/analyze 提交后的指数退避轮询。
 *
 * 必须在 page.tsx 里调用、而不是在 WorkspaceTab 内部：tab 切换是条件渲染，
 * 状态放在子组件里会在离开「文件审查」时被卸载，进行中的审查轮询会被打断、
 * 已选文件会被清空。
 */
export function useReviewSubmit(options?: UseReviewSubmitOptions) {
    const router = useRouter();

    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [showSecurityWarning, setShowSecurityWarning] = useState(false);
    const [showDocWarning, setShowDocWarning] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzingStatus, setAnalyzingStatus] = useState("正在进行智能审查...");
    const [analyzingProgress, setAnalyzingProgress] = useState(0);
    const [noticeModal, setNoticeModal] = useState<NoticeModalState>({
        open: false,
        mode: 'ignored',
    });

    const closeNoticeModal = () => {
        setNoticeModal(prev => ({ ...prev, open: false }));
    };

    const handleFileSelect = (file: File) => {
        const lowerName = file.name.toLowerCase();

        // Check for .doc extension
        if (lowerName.endsWith('.doc')) {
            setShowDocWarning(true);
            return;
        }

        // Format whitelist check
        if (
            !lowerName.endsWith('.docx') &&
            !lowerName.endsWith('.wps') &&
            !lowerName.endsWith('.pdf') &&
            !lowerName.endsWith('.txt')
        ) {
            setNoticeModal({
                open: true,
                mode: 'error',
                fileName: file.name,
                message: '不支持该文件格式，目前支持 .docx（Word）与电子文字版 .pdf 文件。',
                suggestion: '请将文书在 Word/WPS 中另存为 .docx 或直接导出为电子文字版 .pdf 后重新上传。',
            });
            return;
        }

        // 50MB client-side limit check
        if (file.size > MAX_UPLOAD_SIZE_BYTES) {
            setNoticeModal({
                open: true,
                mode: 'error',
                fileName: file.name,
                message: '单个文件大小不能超过 50MB',
                suggestion: '请压缩文档内嵌大图或拆分附件后重新上传。',
            });
            return;
        }

        setPendingFile(file);
        setShowSecurityWarning(true);
    };

    const confirmUpload = () => {
        setSelectedFile(pendingFile);
        setPendingFile(null);
        setShowSecurityWarning(false);
    };

    const cancelUpload = () => {
        setPendingFile(null);
        setShowSecurityWarning(false);
    };

    const removeFile = () => {
        setSelectedFile(null);
    };

    const closeDocWarning = () => {
        setShowDocWarning(false);
    };

    const startReview = async () => {
        if (!selectedFile) return;
        setIsAnalyzing(true);
        setAnalyzingStatus("正在解析文档内容...");
        setAnalyzingProgress(0);

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            // Step 1: Submit file and get task ID
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData,
            });

            const contentType = response.headers.get('content-type') || '';

            if (!response.ok) {
                if (contentType.includes('application/json')) {
                    const errorData = await response.json();
                    const err = new Error(
                        errorData.message || errorData.details || errorData.error || 'Analysis failed'
                    ) as Error & { suggestion?: string | null };
                    err.suggestion = errorData.suggestion || null;
                    throw err;
                } else {
                    const errorText = await response.text();
                    console.error('API returned non-JSON response:', errorText.substring(0, 200));
                    throw new Error(`服务器返回错误 (${response.status})。请检查后端服务是否正常运行。`);
                }
            }

            const data = await response.json();
            const recordId = data.id;

            if (!recordId) {
                throw new Error('服务器未返回审查记录ID');
            }

            console.log(`[Review] Started async review with ID: ${recordId}`);

            // Step 2: Poll with exponential backoff. Start at 2s, grow ×1.5 up to 8s cap.
            // Reset to base whenever progress advances so we stay responsive during active phases.
            const BASE_INTERVAL = 2000;
            const MAX_INTERVAL = 8000;
            const MAX_ELAPSED_MS = 10 * 60 * 1000; // 10 minutes
            const startedAt = Date.now();
            let interval = BASE_INTERVAL;
            let lastProgress = -1;

            const pollStatus = async (): Promise<void> => {
                while (true) {
                    const statusResponse = await fetch(`/api/reviews/${recordId}/status`);

                    if (!statusResponse.ok) {
                        throw new Error('获取审查状态失败');
                    }

                    const statusData = await statusResponse.json();

                    if (typeof statusData.progress === 'number') {
                        setAnalyzingProgress(statusData.progress);
                        if (statusData.progress > lastProgress) {
                            lastProgress = statusData.progress;
                            interval = BASE_INTERVAL;
                        } else {
                            interval = Math.min(Math.round(interval * 1.5), MAX_INTERVAL);
                        }
                    }
                    if (statusData.progressMessage) {
                        setAnalyzingStatus(statusData.progressMessage);
                    }

                    if (statusData.status === 'completed') {
                        const fullReviewResponse = await fetch(`/api/reviews/${recordId}`);
                        if (!fullReviewResponse.ok) {
                            throw new Error('获取审查结果失败，请在审查记录中重新打开');
                        }
                        const fullReviewData = await fullReviewResponse.json();

                        sessionStorage.setItem('temp_review_data', JSON.stringify({
                            fileName: selectedFile.name,
                            fileSize: selectedFile.size,
                            id: recordId,
                            ...fullReviewData
                        }));

                        setAnalyzingProgress(100);
                        setAnalyzingStatus("审查完成，正在生成报告...");
                        setTimeout(() => router.push(`/review/${recordId}`), 500);
                        return;

                    } else if (statusData.status === 'ignored') {
                        setAnalyzingStatus("该文件无需审查");
                        let detailReason: string | null = statusData.progressMessage || null;
                        try {
                            const detailRes = await fetch(`/api/reviews/${recordId}`);
                            if (detailRes.ok) {
                                const detailData = await detailRes.json();
                                if (detailData?.gatekeeper?.reason) {
                                    detailReason = detailData.gatekeeper.reason;
                                }
                            }
                        } catch {
                            // 详情拉取失败时保留 progressMessage 兜底
                        }

                        setNoticeModal({
                            open: true,
                            mode: 'ignored',
                            fileName: selectedFile.name,
                            message: detailReason,
                            recordId,
                        });
                        setSelectedFile(null);
                        setIsAnalyzing(false);
                        options?.onRefreshRecords?.();
                        return;

                    } else if (statusData.status === 'failed') {
                        throw new Error(statusData.progressMessage || '审查失败');

                    } else if (Date.now() - startedAt >= MAX_ELAPSED_MS) {
                        throw new Error('审查超时，请刷新页面查看审查记录');

                    } else {
                        await new Promise<void>(resolve => setTimeout(resolve, interval));
                    }

                }
            };

            // Start polling
            await pollStatus();

        } catch (error: any) {
            console.error('Error starting review:', error);

            setNoticeModal({
                open: true,
                mode: 'error',
                fileName: selectedFile?.name || null,
                message: error?.message || '审查启动失败，请稍后重试',
                suggestion: error?.suggestion || null,
            });
            setIsAnalyzing(false);
        }
    };

    return {
        pendingFile,
        selectedFile,
        showSecurityWarning,
        showDocWarning,
        isAnalyzing,
        analyzingStatus,
        analyzingProgress,
        noticeModal,
        handleFileSelect,
        confirmUpload,
        cancelUpload,
        removeFile,
        closeDocWarning,
        closeNoticeModal,
        startReview
    };
}
