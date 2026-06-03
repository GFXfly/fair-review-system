import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/**
 * 返回审查记录对应的原始 .docx 文件，供前端 docx-preview 高保真还原。
 * 鉴权：必须登录；仅记录所有者或管理员可读。
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;

    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const record = await prisma.reviewRecord.findUnique({
        where: { id },
        select: { userId: true },
    });
    if (!record) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (user.role !== 'admin' && record.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const filePath = path.join(process.cwd(), 'data', 'uploads', `${id}.docx`);
        const buf = await readFile(filePath);
        return new NextResponse(new Uint8Array(buf), {
            headers: {
                'Content-Type':
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Cache-Control': 'private, max-age=3600',
            },
        });
    } catch {
        // 旧记录或非 docx：未存原始文件
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
}
