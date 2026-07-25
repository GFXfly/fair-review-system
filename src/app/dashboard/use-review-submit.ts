'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 文件上传与审查提交的全部状态，含 /api/analyze 提交后的指数退避轮询。
 *
 * 必须在 page.tsx 里调用、而不是在 WorkspaceTab 内部：tab 切换是条件渲染，
 * 状态放在子组件里会在离开「文件审查」时被卸载，进行中的审查轮询会被打断、
 * 已选文件会被清空。
 */
export function useReviewSubmit() {
    const router = useRouter();

    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [showSecurityWarning, setShowSecurityWarning] = useState(false);
    const [showDocWarning, setShowDocWarning] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzingStatus, setAnalyzingStatus] = useState("正在进行智能审查...");
    const [analyzingProgress, setAnalyzingProgress] = useState(0);

    const handleFileSelect = (file: File) => {
        // Check for .doc extension
        if (file.name.toLowerCase().endsWith('.doc')) {
            setShowDocWarning(true);
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
                    throw new Error(errorData.details || errorData.error || 'Analysis failed');
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
                try {
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
                        alert(`【无需审查】\n\n该文件不属于公平竞争审查范围：\n${statusData.progressMessage || '已自动跳过'}`);
                        setIsAnalyzing(false);
                        window.location.reload();
                        return;

                    } else if (statusData.status === 'failed') {
                        throw new Error(statusData.progressMessage || '审查失败');

                    } else if (Date.now() - startedAt >= MAX_ELAPSED_MS) {
                        throw new Error('审查超时，请刷新页面查看审查记录');

                    } else {
                        setTimeout(pollStatus, interval);
                    }

                } catch (pollError: any) {
                    console.error('[Poll] Error:', pollError);
                    throw pollError;
                }
            };

            // Start polling
            await pollStatus();

        } catch (error: any) {
            console.error('Error starting review:', error);

            let errorMessage = '审查启动失败';

            if (error.message) {
                errorMessage += `\n\n错误详情：${error.message}`;
            }

            if (error.suggestion) {
                errorMessage += `\n\n建议：${error.suggestion}`;
            }

            alert(errorMessage);
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
        handleFileSelect,
        confirmUpload,
        cancelUpload,
        removeFile,
        closeDocWarning,
        startReview
    };
}
