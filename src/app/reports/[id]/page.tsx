import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import ReportDetailClient from './ReportDetailClient';
import { notFound, redirect } from 'next/navigation';

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser();
    if (!user) {
        redirect('/');
    }

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
