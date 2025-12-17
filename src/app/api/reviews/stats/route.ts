
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser();

        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const [
            totalFiles,
            completedFiles,
            failedFiles,
            totalRisks,
            ignoredFiles,
            distinctUsers
        ] = await Promise.all([
            prisma.reviewRecord.count(),
            prisma.reviewRecord.count({ where: { status: 'completed' } }),
            prisma.reviewRecord.count({ where: { status: 'failed' } }),
            prisma.reviewRecord.aggregate({
                _sum: { riskCount: true }
            }),
            prisma.reviewRecord.count({ where: { status: 'ignored' } }),
            prisma.reviewRecord.groupBy({
                by: ['userId'],
                _count: {
                    userId: true
                }
            })
        ]);

        return NextResponse.json({
            totalFiles,
            completedFiles,
            failedFiles,
            totalRisks: totalRisks._sum.riskCount || 0,
            ignoredFiles,
            activeUsers: distinctUsers.length
        });
    } catch (error) {
        console.error('Failed to fetch review stats:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
