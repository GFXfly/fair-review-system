import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const category = searchParams.get('category');
    const id = searchParams.get('id');

    try {
        if (id) {
            const regulation = await prisma.regulation.findUnique({
                where: { id: parseInt(id) }
            });
            return NextResponse.json(regulation);
        }

        const where: any = {};

        if (query) {
            where.OR = [
                { title: { contains: query } },
                { content: { contains: query } },
            ];
        }

        // If no search query, hide the atomic fragments to keep list clean
        if (!query) {
            where.category = {
                not: 'QA_Fragment'
            };
        } else {
            // If searching, we want everything, including fragments
        }

        // If specific category selected (overrides the above if needed, but usually 'category' filter is from UI tab)
        if (category && category !== '全部') {
            where.category = category;
        }

        const regulations = await prisma.regulation.findMany({
            where,
            select: {
                id: true,
                title: true,
                level: true,
                publishDate: true,
                department: true,
                category: true,
                // content is excluded for list view to optimize performance
            },
            orderBy: {
                publishDate: 'desc',
            },
        });

        return NextResponse.json(regulations);
    } catch (error) {
        console.error('Error fetching regulations:', error);
        return NextResponse.json({ error: 'Failed to fetch regulations' }, { status: 500 });
    }
}
