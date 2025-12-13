import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AuthError, handleAuthError } from '@/lib/auth';
import { logSuccess } from '@/lib/audit-logger';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    try {
        if (id) {
            const caseItem = await prisma.case.findUnique({
                where: { id: parseInt(id) },
                include: { report: true }
            });
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
                // content: false, // Don't fetch full content list for performance
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
                // embedding: false // Definitely don't fetch vectors
            }
        });

        // Ensure shape matches what frontend expects (which seems to expect 'report' property)
        // Since we used include (now select with nested select), 'cases' already has 'report' property.

        return NextResponse.json(cases);
    } catch (error) {
        console.error('Error fetching cases:', error);
        return NextResponse.json({
            error: 'Failed to fetch cases',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        // Require admin authentication for creating cases
        const admin = await requireAdmin(request as NextRequest);

        const body = await request.json();
        const cases = Array.isArray(body) ? body : [body];

        const createdCases = await prisma.case.createMany({
            data: cases.map((c: any) => ({
                title: c.title,
                content: c.content,
                violationType: c.violationType,
                result: c.result,
                publishDate: c.publishDate,
                province: c.province || '江西省',
                department: c.department
            }))
        });

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
