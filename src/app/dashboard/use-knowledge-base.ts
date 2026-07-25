'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { KnowledgeItem } from './types';

export const ITEMS_PER_PAGE = 20;

/**
 * 法规库 / 案例库的数据与交互状态。
 *
 * 必须在 page.tsx 里调用、而不是在 KnowledgeTab 内部：tab 切换是条件渲染，
 * 状态放在子组件里会在离开 tab 时被卸载，搜索词和页码都会丢。
 */
export function useKnowledgeBase(activeTab: string) {
    const router = useRouter();

    const [regulations, setRegulations] = useState<KnowledgeItem[]>([]);
    const [cases, setCases] = useState<KnowledgeItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingKnowledge, setIsLoadingKnowledge] = useState(false);
    const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);

    const [regPage, setRegPage] = useState(1);
    const [casePage, setCasePage] = useState(1);

    const fetchKnowledge = async (query = '') => {
        setIsLoadingKnowledge(true);
        try {
            const [regRes, caseRes] = await Promise.all([
                fetch(`/api/regulations?q=${query}`, { cache: 'no-store' }),
                fetch(`/api/cases?q=${query}`, { cache: 'no-store' })
            ]);

            if (regRes.ok) {
                const regData = await regRes.json();
                setRegulations(regData);
            }

            if (caseRes.ok) {
                const caseData = await caseRes.json();
                setCases(caseData);
            }
        } catch (error) {
            console.error('Failed to fetch knowledge base:', error);
        } finally {
            setIsLoadingKnowledge(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'regulations' || activeTab === 'cases') {
            fetchKnowledge(searchQuery);
        }
    }, [activeTab]);

    const handleSearch = () => {
        setRegPage(1);
        setCasePage(1);
        fetchKnowledge(searchQuery);
    };

    const handleItemClick = async (item: KnowledgeItem) => {
        // Identify if the item is a Case based on specific fields or active tab
        const isCase = activeTab === 'cases' || item.violationType || item.result;

        if (isCase) {
            // Build highlight parameter for keyword highlighting in detail page
            const highlightParam = searchQuery.trim() ? `&highlight=${encodeURIComponent(searchQuery.trim())}` : '';

            // Navigate to the report page if reportId exists
            if (item.reportId) {
                router.push(`/reports/${item.reportId}?from=cases&page=${casePage}${highlightParam}`);
            } else {
                // Fallback to individual case page if no report
                router.push(`/cases/${item.id}?from=cases&page=${casePage}${highlightParam}`);
            }
        } else {
            // It is a Regulation, fetch full content if missing
            if (!item.content) {
                try {
                    const res = await fetch(`/api/regulations?id=${item.id}`);
                    if (res.ok) {
                        const fullItem = await res.json();
                        setSelectedItem(fullItem);
                    } else {
                        console.error('Failed to fetch full regulation details');
                        setSelectedItem(item); // Fallback
                    }
                } catch (e) {
                    console.error('Error fetching regulation details:', e);
                    setSelectedItem(item); // Fallback
                }
            } else {
                setSelectedItem(item);
            }
        }
    };

    return {
        regulations,
        cases,
        searchQuery,
        setSearchQuery,
        isLoadingKnowledge,
        selectedItem,
        setSelectedItem,
        regPage,
        setRegPage,
        casePage,
        setCasePage,
        handleSearch,
        handleItemClick
    };
}
