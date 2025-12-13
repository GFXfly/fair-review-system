
import { prisma } from '@/lib/prisma';
import CaseDetailClient from './CaseDetailClient';
import { notFound } from 'next/navigation';

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);

    if (isNaN(id)) {
        notFound();
    }

    const currentCase = await prisma.case.findUnique({
        where: { id }
    });

    if (!currentCase) {
        notFound();
    }

    let relatedCases: any[] = [];

    // Priority: Group by Report ID (Best for cases from the same announcement)
    if (currentCase.reportId) {
        relatedCases = await prisma.case.findMany({
            where: {
                reportId: currentCase.reportId
            },
            orderBy: {
                id: 'asc'
            }
        });
    }
    // Fallback: Group by Document Name (Old legacy behavior)
    else if (currentCase.documentName) {
        relatedCases = await prisma.case.findMany({
            where: {
                documentName: currentCase.documentName
            },
            orderBy: {
                id: 'asc'
            }
        });
    } else {
        relatedCases = [currentCase];
    }

    return (
        <CaseDetailClient
            currentCase={currentCase}
            relatedCases={relatedCases}
        />
    );
}
