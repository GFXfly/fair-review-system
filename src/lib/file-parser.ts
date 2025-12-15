import mammoth from 'mammoth';

export interface ParsedDocument {
    text: string;  // Plain text for AI analysis
    html: string;  // Rich HTML for frontend display (preserves table structure)
}

export async function extractTextFromFile(file: File): Promise<ParsedDocument> {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    try {
        // 1. Support DOCX / WPS (Modern XML)
        if (
            fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            fileName.endsWith('.docx') ||
            fileName.endsWith('.wps')
        ) {
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
                    const plainText = content.replace(/<[^>]+>/g, '').trim();

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

                // Decode entities in HTML version too
                displayHtml = displayHtml
                    .replace(/&nbsp;/g, " ")
                    .replace(/&amp;/g, "&")
                    .replace(/&lt;/g, "<")
                    .replace(/&gt;/g, ">")
                    .replace(/&quot;/g, '"');

                return {
                    text,
                    html: displayHtml
                };

            } catch (mammothError: any) {
                console.error('Mammoth extraction failed for:', fileName, mammothError);
                throw new Error(`无法解析 Word 文档 (${fileName})。可能原因：\n1. 文件虽然后缀是 .docx，但实际是旧版 .doc 格式；\n2. 文档被加密保护。\n\n建议您用 Word/WPS 打开文档，选择"另存为" .docx 格式后再上传。`);
            }
        }
        // 2. Support Plain Text
        else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
            const textDecoder = new TextDecoder('utf-8');
            const text = textDecoder.decode(buffer);
            return {
                text,
                html: `<div class="doc-content">${text.replace(/\n/g, '<br>')}</div>`
            };
        }
        // 3. Fallback for others
        else {
            throw new Error(`不支持的文件格式: ${fileName}。目前系统仅支持 .docx (Word) 和 .txt 格式。`);
        }
    } catch (error: any) {
        console.error('Error parsing file:', error);
        throw new Error(error.message || `文件解析失败: ${fileName}`);
    }
}
