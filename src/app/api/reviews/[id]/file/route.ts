import { NextRequest, NextResponse } from 'next/server';
import * as fsPromises from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

type ResolvedOriginal =
    | { ok: false; response: NextResponse }
    | {
          ok: true;
          ext: 'docx' | 'pdf';
          filePath: string;
          safeId: string;
          headers: Record<string, string>;
          buffer?: Buffer;
      };

function hasPdfMagicHeader(buf: Buffer): boolean {
    if (buf.length < 8) return false;
    return buf.subarray(0, Math.min(buf.length, 1024)).toString('latin1').includes('%PDF-');
}

function getInlineParam(req: NextRequest): boolean {
    const searchParams =
        req.nextUrl?.searchParams ??
        new URL(req.url || 'http://localhost', 'http://localhost').searchParams;
    return searchParams.get('inline') === '1';
}

function buildFileHeaders(
    ext: 'docx' | 'pdf',
    safeId: string,
    isInline: boolean,
    contentLength?: number
): Record<string, string> {
    if (ext === 'docx') {
        const headers: Record<string, string> = {
            'Content-Type':
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Cache-Control': 'private, max-age=3600',
            'X-Content-Type-Options': 'nosniff',
            'Content-Disposition': `attachment; filename="${safeId}.docx"`,
            'Cross-Origin-Resource-Policy': 'same-origin',
        };
        if (typeof contentLength === 'number') {
            headers['Content-Length'] = String(contentLength);
        }
        return headers;
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Disposition': `${isInline ? 'inline' : 'attachment'}; filename="${safeId}.pdf"`,
        'Cross-Origin-Resource-Policy': 'same-origin',
    };
    if (typeof contentLength === 'number') {
        headers['Content-Length'] = String(contentLength);
    }
    return headers;
}

async function tryReadHeaderChunk(filePath: string): Promise<{ size?: number; header: Buffer } | null> {
    if (typeof fsPromises.stat === 'function' && typeof fsPromises.open === 'function') {
        const st = await fsPromises.stat(filePath);
        const handle = await fsPromises.open(filePath, 'r');
        try {
            const len = Math.min(st.size, 1024);
            const buf = Buffer.alloc(len);
            if (len > 0) {
                await handle.read(buf, 0, len, 0);
            }
            return { size: st.size, header: buf };
        } finally {
            await handle.close();
        }
    }
    const full = await fsPromises.readFile(filePath);
    return { size: full.length, header: full.subarray(0, Math.min(full.length, 1024)) };
}

async function resolveOriginalFile(
    req: NextRequest,
    id: string,
    includeBody: boolean
): Promise<ResolvedOriginal> {
    const user = await getCurrentUser();
    if (!user) {
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const record = await prisma.reviewRecord.findUnique({
        where: { id },
        select: { userId: true },
    });
    if (!record) {
        return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
    }
    if (user.role !== 'admin' && record.userId !== user.id) {
        return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    const safeId = path.basename(id);
    const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
    const isInline = getInlineParam(req);

    // 1. 优先探测 .docx
    const docxPath = path.join(uploadsDir, `${safeId}.docx`);
    try {
        if (includeBody) {
            const buf = await fsPromises.readFile(docxPath);
            return {
                ok: true,
                ext: 'docx',
                filePath: docxPath,
                safeId,
                headers: buildFileHeaders('docx', safeId, false, buf.length),
                buffer: buf,
            };
        }
        const meta = await tryReadHeaderChunk(docxPath);
        if (meta) {
            return {
                ok: true,
                ext: 'docx',
                filePath: docxPath,
                safeId,
                headers: buildFileHeaders('docx', safeId, false, meta.size),
            };
        }
    } catch {
        // 不存在则继续探测 .pdf
    }

    // 2. 探测 .pdf 并做魔数双检
    const pdfPath = path.join(uploadsDir, `${safeId}.pdf`);
    try {
        if (includeBody) {
            const buf = await fsPromises.readFile(pdfPath);
            if (!hasPdfMagicHeader(buf)) {
                return { ok: false, response: NextResponse.json({ error: 'Invalid PDF file' }, { status: 404 }) };
            }
            return {
                ok: true,
                ext: 'pdf',
                filePath: pdfPath,
                safeId,
                headers: buildFileHeaders('pdf', safeId, isInline, buf.length),
                buffer: buf,
            };
        }
        const meta = await tryReadHeaderChunk(pdfPath);
        if (meta && hasPdfMagicHeader(meta.header)) {
            return {
                ok: true,
                ext: 'pdf',
                filePath: pdfPath,
                safeId,
                headers: buildFileHeaders('pdf', safeId, isInline, meta.size),
            };
        }
        return { ok: false, response: NextResponse.json({ error: 'Invalid PDF file' }, { status: 404 }) };
    } catch {
        // 旧记录或纯文本：未存原始文件
        return { ok: false, response: NextResponse.json({ error: 'File not found' }, { status: 404 }) };
    }
}

/**
 * 轻量探测原始文档是否存在及其类型（.docx / .pdf），避免前端为大 PDF 多拉一次流。
 */
export async function HEAD(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;
    const resolved = await resolveOriginalFile(req, id, false);
    if (!resolved.ok) {
        return resolved.response;
    }
    return new NextResponse(null, { status: 200, headers: resolved.headers });
}

/**
 * 返回审查记录对应的原始 .docx 或 .pdf 文件，供前端高保真还原或原版面预览。
 * 鉴权：必须登录；仅记录所有者或管理员可读。
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;
    const resolved = await resolveOriginalFile(req, id, true);
    if (!resolved.ok) {
        return resolved.response;
    }
    return new NextResponse(new Uint8Array(resolved.buffer!), {
        status: 200,
        headers: resolved.headers,
    });
}
