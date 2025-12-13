import { prisma } from '@/lib/prisma';
import ReportDetailClient from './ReportDetailClient';
import { notFound } from 'next/navigation';

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);

    if (isNaN(id)) {
        notFound();
    }

    const report = await prisma.report.findUnique({
        where: { id },
        include: {
            cases: {
                orderBy: {
                    id: 'asc'
                }
            }
        }
    });

    if (!report) {
        notFound();
    }

    return (
        <ReportDetailClient
            report={report}
        />
    );
}
