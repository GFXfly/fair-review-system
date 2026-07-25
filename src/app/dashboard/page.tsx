'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import DashboardNav from './DashboardNav';
import WorkspaceTab from './WorkspaceTab';
import KnowledgeTab from './KnowledgeTab';
import KnowledgeDrawer from './KnowledgeDrawer';
import UploadModals from './UploadModals';
import ChangePasswordModal from './ChangePasswordModal';
import { useReviewSubmit } from './use-review-submit';
import { useKnowledgeBase } from './use-knowledge-base';
import type { DashboardUser, ReviewRecordSummary } from './types';

function DashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') || 'workspace';
    const [activeTab, setActiveTab] = useState(initialTab); // workspace | monitor | knowledge
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [reviewRecords, setReviewRecords] = useState<ReviewRecordSummary[]>([]);
    const [user, setUser] = useState<DashboardUser | null>(null);

    // 上传/审查与知识库的状态都留在本组件：tab 切换是条件渲染，
    // 放进子组件会在离开 tab 时被卸载，进行中的审查和搜索词都会丢。
    const review = useReviewSubmit();
    const knowledge = useKnowledgeBase(activeTab);

    // Sync activeTab with URL params if they change
    useEffect(() => {
        const tab = searchParams.get('tab');
        const page = searchParams.get('page');

        if (tab) {
            setActiveTab(tab);
        }

        // Restore page number when returning from detail page
        if (page && tab === 'cases') {
            knowledge.setCasePage(parseInt(page, 10));
        }
    }, [searchParams]);

    // Check Auth
    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Unauthorized');
            })
            .then(data => setUser(data))
            .catch(() => router.push('/'));
    }, []);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
    };

    const fetchReviewRecords = async () => {
        try {
            // 范围由后端按 session 的 role 自动决定（admin 看全部 / 普通看自己），
            // 因此无需等待前端 user 状态，可与鉴权请求并行，消除首屏串行延迟。
            const res = await fetch('/api/reviews', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setReviewRecords(data);
            } else {
                console.error('[Dashboard] Failed to fetch reviews. Status:', res.status);
            }
        } catch (error) {
            console.error('Failed to fetch review records:', error);
        }
    };

    useEffect(() => {
        if (activeTab === 'workspace') {
            fetchReviewRecords();
        }
    }, [activeTab]);

    const handleViewRecord = (record: ReviewRecordSummary) => {
        if (record.status === 'ignored') {
            alert(record.summary);
        } else {
            router.push(`/review/${record.id}`);
        }
    };

    return (
        <div className={styles.container}>
            {/* Top Navigation - Based on User Workflow */}
            <DashboardNav
                activeTab={activeTab}
                onTabChange={setActiveTab}
                user={user}
                onOpenPasswordModal={() => setShowPasswordModal(true)}
                onLogout={handleLogout}
            />

            <main className={styles.mainContent}>

                {/* SCENE 1: REVIEW WORKSPACE (The "Doing" phase) */}
                {activeTab === 'workspace' && (
                    <WorkspaceTab
                        pendingFile={review.pendingFile}
                        selectedFile={review.selectedFile}
                        isAnalyzing={review.isAnalyzing}
                        analyzingStatus={review.analyzingStatus}
                        analyzingProgress={review.analyzingProgress}
                        onFileSelect={review.handleFileSelect}
                        onRemoveFile={review.removeFile}
                        onStartReview={review.startReview}
                        reviewRecords={reviewRecords}
                        user={user}
                        onViewRecord={handleViewRecord}
                        onViewLedger={() => router.push('/ledger')}
                    />
                )}

                {/* SCENE 3: REGULATIONS */}
                {activeTab === 'regulations' && (
                    <KnowledgeTab
                        kind="regulations"
                        items={knowledge.regulations}
                        page={knowledge.regPage}
                        onPageChange={knowledge.setRegPage}
                        isLoading={knowledge.isLoadingKnowledge}
                        searchQuery={knowledge.searchQuery}
                        onSearchQueryChange={knowledge.setSearchQuery}
                        onSearch={knowledge.handleSearch}
                        onItemClick={knowledge.handleItemClick}
                    />
                )}

                {/* SCENE 4: CASES */}
                {activeTab === 'cases' && (
                    <KnowledgeTab
                        kind="cases"
                        items={knowledge.cases}
                        page={knowledge.casePage}
                        onPageChange={knowledge.setCasePage}
                        isLoading={knowledge.isLoadingKnowledge}
                        searchQuery={knowledge.searchQuery}
                        onSearchQueryChange={knowledge.setSearchQuery}
                        onSearch={knowledge.handleSearch}
                        onItemClick={knowledge.handleItemClick}
                    />
                )}

            </main>

            <UploadModals
                showSecurityWarning={review.showSecurityWarning}
                showDocWarning={review.showDocWarning}
                onConfirmUpload={review.confirmUpload}
                onCancelUpload={review.cancelUpload}
                onCloseDocWarning={review.closeDocWarning}
            />

            {showPasswordModal && (
                <ChangePasswordModal
                    onSuccess={handleLogout}
                    onClose={() => setShowPasswordModal(false)}
                />
            )}

            {knowledge.selectedItem && (
                <KnowledgeDrawer
                    item={knowledge.selectedItem}
                    onClose={() => knowledge.setSelectedItem(null)}
                />
            )}
        </div>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DashboardContent />
        </Suspense>
    );
}
