import mammoth from 'mammoth';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const MAX_ZIP_ENTRIES = 5000;
const MAX_SINGLE_ENTRY_BYTES = 100 * 1024 * 1024;
const MAX_SINGLE_XML_BYTES = 45 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 220 * 1024 * 1024;

/**
 * 校验 .docx/.wps 压缩包结构与解压安全性，防止伪造文件头、路径穿越及 Zip Bomb
 */
export function validateDocxArchiveSafety(buffer: Buffer): void {
    if (
        !Buffer.isBuffer(buffer) ||
        buffer.length < 4 ||
        buffer[0] !== 0x50 ||
        buffer[1] !== 0x4b ||
        buffer[2] !== 0x03 ||
        buffer[3] !== 0x04
    ) {
        throw new Error('文件头格式校验失败：不是有效的 .docx 文档');
    }

    if (buffer.length < 22) {
        throw new Error('无效或异常的压缩结构，无法安全解析');
    }

    const searchMinOffset = Math.max(0, buffer.length - Math.min(buffer.length, 65557));
    let eocdOffset = -1;
    let fallbackEocdOffset = -1;

    for (let i = buffer.length - 22; i >= searchMinOffset; i--) {
        if (buffer.readUInt32LE(i) === 0x06054b50) {
            const commentLen = buffer.readUInt16LE(i + 20);
            if (i + 22 + commentLen === buffer.length) {
                eocdOffset = i;
                break;
            }
            if (fallbackEocdOffset === -1 && i + 22 + commentLen <= buffer.length) {
                fallbackEocdOffset = i;
            }
        }
    }

    if (eocdOffset === -1) {
        eocdOffset = fallbackEocdOffset;
    }

    if (eocdOffset === -1) {
        throw new Error('无效或异常的压缩结构，无法安全解析');
    }

    const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
    const cdStartDisk = buffer.readUInt16LE(eocdOffset + 6);
    const entriesOnDisk = buffer.readUInt16LE(eocdOffset + 8);
    const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
    const cdSize = buffer.readUInt32LE(eocdOffset + 12);
    const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

    if (
        diskNumber !== 0 ||
        cdStartDisk !== 0 ||
        entriesOnDisk !== totalEntries ||
        totalEntries === 0xffff ||
        cdSize === 0xffffffff ||
        cdOffset === 0xffffffff ||
        cdOffset + cdSize > buffer.length ||
        cdOffset + cdSize > eocdOffset
    ) {
        throw new Error('无效或异常的压缩结构，无法安全解析');
    }

    if (totalEntries > MAX_ZIP_ENTRIES) {
        throw new Error('文档解压后体积异常（疑似压缩炸弹或超大内嵌对象），已拒绝解析');
    }

    let pos = cdOffset;
    const cdEnd = cdOffset + cdSize;
    let totalUncompressedBytes = 0;
    let hasDocumentXml = false;

    for (let i = 0; i < totalEntries; i++) {
        if (pos + 46 > cdEnd || buffer.readUInt32LE(pos) !== 0x02014b50) {
            throw new Error('无效或异常的压缩结构，无法安全解析');
        }

        const compressedSize = buffer.readUInt32LE(pos + 20);
        const uncompressedSize = buffer.readUInt32LE(pos + 24);
        const fnLen = buffer.readUInt16LE(pos + 28);
        const exLen = buffer.readUInt16LE(pos + 30);
        const cmLen = buffer.readUInt16LE(pos + 32);

        if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
            throw new Error('无效或异常的压缩结构，无法安全解析');
        }

        const nextPos = pos + 46 + fnLen + exLen + cmLen;
        if (nextPos > cdEnd) {
            throw new Error('无效或异常的压缩结构，无法安全解析');
        }

        const entryName = buffer.toString('utf8', pos + 46, pos + 46 + fnLen);
        if (
            entryName.includes('\0') ||
            entryName.startsWith('/') ||
            entryName.startsWith('\\') ||
            /^[a-zA-Z]:/.test(entryName) ||
            entryName.split(/[/\\]/).includes('..')
        ) {
            throw new Error('无效或异常的压缩结构，无法安全解析');
        }

        if (entryName === 'word/document.xml') {
            hasDocumentXml = true;
        }

        const lowerEntryName = entryName.toLowerCase();
        const isXmlEntry = lowerEntryName.endsWith('.xml') || lowerEntryName.endsWith('.rels');

        totalUncompressedBytes += uncompressedSize;
        if (
            uncompressedSize > MAX_SINGLE_ENTRY_BYTES ||
            (isXmlEntry && uncompressedSize > MAX_SINGLE_XML_BYTES) ||
            totalUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES
        ) {
            throw new Error('文档解压后体积异常（疑似压缩炸弹或超大内嵌对象），已拒绝解析');
        }

        pos = nextPos;
    }

    if (pos !== cdEnd || !hasDocumentXml) {
        throw new Error('无效或异常的压缩结构，无法安全解析');
    }
}

/**
 * 校验 PDF 文件头魔数，防止伪造后缀名的非 PDF 文件进入解析器
 */
export function validatePdfBufferSafety(buffer: Buffer): void {
    if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
        throw new Error('文件头格式校验失败：不是有效的 PDF 文档');
    }

    const header = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('latin1');
    if (!/%PDF-[12]\./.test(header)) {
        throw new Error('文件头格式校验失败：不是有效的 PDF 文档');
    }
}

const SCANNED_PDF_ERROR_MESSAGE =
    '检测到该 PDF 为图片扫描件（无有效文字层，平均每页可提取文字不足 25 字），无法确保条款无遗漏审查。请上传由编标软件或 Word 直接导出的电子文字版 PDF，或上传 .docx 源文件。';

function isPdfPageMarkerLine(line: string): boolean {
    if (!line) return true;
    if (/^[-—–•·\s]*\d{1,5}(?:\s*\/\s*\d{1,5})?[-—–•·\s]*$/.test(line)) return true;
    if (/^第\s*\d{1,5}\s*页(?:\s*[共/]\s*\d{1,5}\s*页)?$/.test(line)) return true;
    if (/^page\s+\d+(?:\s*(?:of|\/)\s*\d+)?$/i.test(line)) return true;
    return false;
}

function countEffectivePdfChars(rawText: string): number {
    const joined = rawText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => !isPdfPageMarkerLine(line))
        .join('');
    const matches = joined.match(/[\u4e00-\u9fa5a-zA-Z0-9]/g);
    return matches ? matches.length : 0;
}

function detectPdfHeadingLevel(line: string): 'h2' | 'h3' | 'h4' | null {
    if (!line || /[。！？；]$/.test(line)) {
        return null;
    }
    if (
        line.length < 60 &&
        /^(?:第[一二三四五六七八九十百零\d]+[章节部分篇]|附件[\d一二三四五六七八九十]*[：:\s]?|[一二三四五六七八九十]+、)/.test(line)
    ) {
        return 'h2';
    }
    if (
        line.length < 80 &&
        /^(?:[（(][一二三四五六七八九十\d]+[）)]|表\s*\d+(?:[.\-]\d+)*\b)/.test(line)
    ) {
        return 'h3';
    }
    if (
        line.length < 100 &&
        /^\d+(?:\.\d+)+(?=[、.\s\u4e00-\u9fa5a-zA-Z])|^\d+[、.](?=\s*[^\d%万千亿元])/.test(line)
    ) {
        return 'h4';
    }
    return null;
}

function joinPdfWrappedLines(prev: string, next: string): string {
    if (!prev) return next;
    const prevLast = prev.slice(-1);
    const nextFirst = next.slice(0, 1);
    const isCjkOrFullWidth = (ch: string) => /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(ch);
    if (isCjkOrFullWidth(prevLast) || isCjkOrFullWidth(nextFirst)) {
        return prev + next;
    }
    return `${prev} ${next}`;
}

function formatPdfParagraphs(rawText: string): ParsedDocument {
    const lines = rawText
        .split(/\r?\n/)
        .map(line => line.replace(/\u00a0/g, ' ').trim())
        .filter(line => !isPdfPageMarkerLine(line));

    interface PdfBlock {
        tag: 'h2' | 'h3' | 'h4' | 'p';
        text: string;
        lastLineLen: number;
    }

    const blocks: PdfBlock[] = [];

    for (const line of lines) {
        const headingTag = detectPdfHeadingLevel(line);
        const prevBlock = blocks[blocks.length - 1];

        const shouldStartNewBlock =
            !prevBlock ||
            headingTag !== null ||
            prevBlock.tag !== 'p' ||
            /[。！？；：”」』】）]$/.test(prevBlock.text) ||
            prevBlock.lastLineLen < 22;

        if (shouldStartNewBlock) {
            blocks.push({
                tag: headingTag ?? 'p',
                text: line,
                lastLineLen: line.length,
            });
        } else {
            prevBlock.text = joinPdfWrappedLines(prevBlock.text, line);
            prevBlock.lastLineLen = line.length;
        }
    }

    const text = blocks
        .map(b => (b.tag === 'p' ? `\u3000\u3000${b.text}` : b.text))
        .join('\n\n')
        .trim();

    const rawHtml = blocks
        .map(b => `<${b.tag}>${escapeHtml(b.text)}</${b.tag}>`)
        .join('\n');

    return {
        text,
        html: sanitizeHtml(rawHtml),
    };
}

async function loadPdfParse(): Promise<(buf: Buffer) => Promise<{ numpages?: number; text?: string }>> {
    const mod = await import('pdf-parse-fork');
    const fn = (mod as unknown as { default?: unknown }).default ?? mod;
    if (typeof fn !== 'function') {
        throw new Error('PDF 解析组件加载失败');
    }
    return fn as (buf: Buffer) => Promise<{ numpages?: number; text?: string }>;
}

/**
 * Sanitize HTML to prevent XSS while preserving document structure
 */
function sanitizeHtml(html: string): string {
    const cleaned = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
            'p', 'br', 'b', 'i', 'em', 'strong', 'a',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
            'div', 'span', 'ul', 'ol', 'li'
        ],
        ALLOWED_ATTR: ['class', 'id', 'colspan', 'rowspan', 'href', 'rel', 'data-html-content'],
    });

    return cleaned.replace(/<a\b([^>]*)>/gi, (match, attrs) => {
        if (/\brel\s*=/i.test(attrs)) {
            return match.replace(/\brel\s*=\s*(['"])[^'"]*\1/i, 'rel="noopener noreferrer"');
        }
        return `<a${attrs} rel="noopener noreferrer">`;
    });
}

/**
 * Simple HTML escape for plain text
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


export interface ParsedDocument {
    text: string;  // Plain text for AI analysis
    html: string;  // Rich HTML for frontend display (preserves table structure)
}

export async function extractTextFromFile(file: File, preloadedBuffer?: Buffer): Promise<ParsedDocument> {
    const buffer = preloadedBuffer ?? Buffer.from(await file.arrayBuffer());
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    try {
        // 1. Support DOCX / WPS (Modern XML)
        if (
            fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            fileName.endsWith('.docx') ||
            fileName.endsWith('.wps')
        ) {
            validateDocxArchiveSafety(buffer);

            try {
                // Use convertToHtml to preserve structure like tables
                const result = await mammoth.convertToHtml({ buffer });
                const originalHtml = result.value;

                if (!originalHtml.trim()) {
                    console.warn(`Warning: Extracted text is empty for ${fileName}`);
                }

                // === GENERATE PLAIN TEXT VERSION (for AI analysis) ===
                let htmlForText = originalHtml;

                // 0. SPECIAL HANDLING: Flatten paragraphs INSIDE table rows first.
                htmlForText = htmlForText.replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g, (match, content) => {
                    return `<tr>${content.replace(/<\/p>/g, " ")}</tr>`;
                });

                // 1. Replace cell endings with a separator
                htmlForText = htmlForText.replace(/<\/td>/g, "  |  ").replace(/<\/th>/g, "  |  ");
                // 2. Replace row endings with newlines
                htmlForText = htmlForText.replace(/<\/tr>/g, "\n");
                // 3. Replace paragraph endings with newlines
                htmlForText = htmlForText.replace(/<\/p>/g, "\n");
                // 4. Replace breaks
                htmlForText = htmlForText.replace(/<br\s*\/?>/g, "\n");
                // 5. Strip all other tags
                let text = htmlForText.replace(/<[^>]*>/g, "");

                // 6. Decode common entities
                text = text
                    .replace(/&nbsp;/g, " ")
                    .replace(/&amp;/g, "&")
                    .replace(/&lt;/g, "<")
                    .replace(/&gt;/g, ">")
                    .replace(/&quot;/g, '"');

                // 7. Clean up excessive newlines
                text = text.replace(/\n\s*\n/g, "\n\n").trim();

                // 7.1 Fix spaces between Chinese characters
                text = text.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');

                // 8. Add indentation (2 full-width spaces) for better readability
                text = text.split('\n').map(line => {
                    const trimmedLine = line.trim();
                    if (trimmedLine && !trimmedLine.includes('|')) {
                        return '\u3000\u3000' + trimmedLine;
                    }
                    return line;
                }).join('\n');

                // === GENERATE HTML VERSION (for frontend display) ===
                // Clean up the HTML for better rendering
                let displayHtml = originalHtml;

                // Add basic styling to tables for better display
                displayHtml = displayHtml.replace(/<table>/g, '<table class="doc-table">');

                // === ENHANCED HEADINGS DETECTION (ROBUST) ===
                // Instead of matching complex HTML strings, we iterate all paragraphs,
                // check their PLAIN TEXT content, and convert if they match patterns.

                displayHtml = displayHtml.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (match, attributes, content) => {
                    // 1. Extract plain text to check patterns ignoring tags (like <strong>, <span>)
                    const plainText = content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

                    // 1.1 Skip truly empty paragraphs to avoid excessive vertical spacing
                    if (plainText.length === 0) {
                        return '';
                    }

                    // 2. Level 1 Pattern: "一、", "二、"
                    // Must be short (< 50 chars) to avoid matching long paragraphs that happen to start with these.
                    if (/^[一二三四五六七八九十]+、/.test(plainText) && plainText.length < 50) {
                        // Convert to <h2> (Left aligned via CSS), dropping original <p> attributes (like center)
                        return `<h2>${content}</h2>`;
                    }

                    // 3. Level 2 Pattern: "（一）", "(一)"
                    if (/^[（(][一二三四五六七八九十]+[）)]/.test(plainText) && plainText.length < 80) {
                        return `<h3>${content}</h3>`;
                    }

                    // 4. Level 3 Pattern: "1.", "1、"
                    if (/^[0-9]+[、.]/.test(plainText) && plainText.length < 100) {
                        return `<h4>${content}</h4>`;
                    }

                    // No match, keep original paragraph
                    return match;
                });

                // mammoth 把 Word 中被正文打断的自动编号标题，转成了多个各自独立的单项
                // <ol><li>…</li></ol>，浏览器渲染时每个独立 <ol> 都从 1 开始，导致序号全是"1."。
                // 这类“单项有序列表”实为章节标题，转成 <h4> 去掉错误编号；多项 <ol>（真正的
                // 列表）保持不变。
                displayHtml = displayHtml.replace(/<ol>([\s\S]*?)<\/ol>/gi, (match, inner) => {
                    const liCount = (inner.match(/<li\b/gi) || []).length;
                    if (liCount !== 1) {
                        return match;
                    }
                    const liInner = inner.replace(/^\s*<li\b[^>]*>([\s\S]*?)<\/li>\s*$/i, '$1').trim();
                    return liInner ? `<h4>${liInner}</h4>` : '';
                });

                return {
                    text,
                    html: sanitizeHtml(displayHtml)
                };

            } catch (mammothError: any) {
                console.error('Mammoth extraction failed for:', fileName, mammothError);
                throw new Error(`无法解析 Word 文档 (${fileName})。可能原因：\n1. 文件虽然后缀是 .docx，但实际是旧版 .doc 格式；\n2. 文档被加密保护。\n\n建议您用 Word/WPS 打开文档，选择"另存为" .docx 格式后再上传。`);
            }
        } // This closing brace was missing for the 'if' block
        // 2. Support Electronic Text PDF (via pdf-parse-fork)
        else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
            validatePdfBufferSafety(buffer);

            let pdfData: { numpages?: number; text?: string };
            try {
                const pdfParse = await loadPdfParse();
                pdfData = await pdfParse(buffer);
            } catch (pdfError: any) {
                const errMsg = String(pdfError?.message || pdfError || '');
                if (/password|encrypted/i.test(errMsg)) {
                    throw new Error('该 PDF 文档受密码加密保护，请先解除密码或上传未加密版本。');
                }
                console.error('PDF extraction failed for:', fileName, pdfError);
                throw new Error(`无法解析 PDF 文档 (${fileName})。请确认文件未损坏且为标准 PDF 格式。`);
            }

            const rawText = pdfData?.text || '';
            const numPages = Math.max(1, Number(pdfData?.numpages) || 1);
            const effectiveCharCount = countEffectivePdfChars(rawText);

            if (effectiveCharCount < 40 || (numPages >= 3 && effectiveCharCount / numPages < 25)) {
                throw new Error(SCANNED_PDF_ERROR_MESSAGE);
            }

            return formatPdfParagraphs(rawText);
        }
        // 3. Support Plain Text
        else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
            const textDecoder = new TextDecoder('utf-8');
            const text = textDecoder.decode(buffer);
            const escapedText = escapeHtml(text);
            return {
                text,
                html: `<div class="doc-content">${escapedText.replace(/\n/g, '<br>')}</div>`
            };
        }
        // 4. Fallback for others
        else {
            throw new Error(`不支持的文件格式: ${fileName}。目前系统支持 .docx（Word）、电子文字版 .pdf 及 .txt 格式。`);
        }
    } catch (error: any) {
        console.error('Error parsing file:', error);
        throw new Error(error.message || `文件解析失败: ${fileName}`);
    }
}
