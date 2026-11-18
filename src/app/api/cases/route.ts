import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { logSuccess } from '@/lib/audit-logger';
import { invalidateEmbeddingCache } from '@/lib/rag';

interface CreateCaseInput {
    title: string;
    content: string;
    violationType: string;
    result: string;
    publishDate?: string | null;
    province?: string | null;
    documentOrg?: string | null;
    department?: string | null;
    violationClause?: string | null;
    documentName?: string | null;
    violationDetail?: string | null;
    legalScope?: string | null;
}

export async function GET(request: NextRequest) {
    try {
        await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');
        const type = searchParams.get('type');
        const id = searchParams.get('id');

        if (id !== null) {
            if (!/^\d+$/.test(id)) {
                return NextResponse.json({ error: '无效的案例ID' }, { status: 400 });
            }
            const caseItem = await prisma.case.findUnique({
                where: { id: parseInt(id, 10) },
                include: { report: true }
            });
            if (!caseItem) {
                return NextResponse.json({ error: '案例不存在' }, { status: 404 });
            }
            return NextResponse.json(caseItem);
        }

        const where: any = {};
        if (query) {
            where.OR = [
                { title: { contains: query } },
                { content: { contains: query } },
            ];
        }
        if (type && type !== '全部') {
            where.violationType = type;
        }

        const cases = await prisma.case.findMany({
            where,
            orderBy: { publishDate: 'desc' },
            select: {
                id: true,
                title: true,
                violationType: true,
                result: true,
                publishDate: true,
                province: true,
                reportId: true,
                report: {
                    select: {
                        department: true,
                        title: true
                    }
                }
            }
        });

        return NextResponse.json(cases);
    } catch (error) {
        return handleAuthError(error);
    }
}

export async function POST(request: Request) {
    try {
        // Require admin authentication for creating cases
        const admin = await requireAdmin(request as NextRequest);

        const body = await request.json();
        const cases = Array.isArray(body) ? body : [body];

        const createdCases = await prisma.case.createMany({
            data: cases.map((c: CreateCaseInput) => ({
                title: c.title,
                content: c.content,
                violationType: c.violationType,
                result: c.result,
                publishDate: c.publishDate,
                province: c.province || '江西省',
                documentOrg: c.documentOrg ?? c.department ?? null,
                violationClause: c.violationClause ?? null,
                documentName: c.documentName ?? null,
                violationDetail: c.violationDetail ?? null,
                legalScope: c.legalScope ?? null,
            }))
        });

        invalidateEmbeddingCache('case');

        await logSuccess('create_cases', admin.id, admin.username, {
            count: createdCases.count
        }, request as NextRequest);

        return NextResponse.json({ count: createdCases.count }, { status: 201 });
    } catch (error) {
        if (error instanceof AuthError) {
            return handleAuthError(error);
        }
        console.error('Error creating cases:', error);
        return NextResponse.json({
            error: 'Failed to create cases',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
