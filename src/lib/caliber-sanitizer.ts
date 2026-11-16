// 前后端通用纯工具模块：负责内部答疑口径识别、对外文本脱敏、内部溯源编解码与角色视图格式化。
// 严禁在此模块中 import prisma 或任何 Node/服务端专属包。

export interface RegulationCaliberMeta {
    title?: string | null;
    category?: string | null;
    level?: string | null;
}

const INTERNAL_CATEGORIES = new Set(['QA_Fragment', '集中答疑口径', '业务口径']);

/**
 * 判断法规条目是否属于仅供内部审查使用的答疑口径/业务口径。
 */
export function isInternalCaliberRegulation(reg: RegulationCaliberMeta | null | undefined): boolean {
    if (!reg) return false;

    const category = reg.category?.trim() ?? '';
    if (INTERNAL_CATEGORIES.has(category)) {
        return true;
    }

    const level = reg.level?.trim() ?? '';
    if (level.includes('口径')) {
        return true;
    }

    const title = reg.title?.trim() ?? '';
    if (!title) return false;

    if (title.includes('集中答疑口径') || title.includes('答疑口径')) {
        return true;
    }

    const compactTitle = title.replace(/\s+/g, '');
    return compactTitle.startsWith('[总局答疑') || compactTitle.startsWith('【总局答疑');
}

/**
 * Prisma where 条件片段：等价排除所有内部答疑口径记录。
 */
export const PUBLIC_REGULATION_WHERE = {
    AND: [
        { OR: [{ category: null }, { category: { notIn: ['QA_Fragment', '集中答疑口径', '业务口径'] } }] },
        { NOT: { level: { contains: '口径' } } },
        { NOT: { title: { contains: '答疑口径' } } },
        { NOT: { title: { startsWith: '[总局答疑' } } },
        { NOT: { title: { startsWith: '【总局答疑' } } },
    ],
};

const MARKER_PREFIX = '<!--INTERNAL_CALIBER:';
const MARKER_BLOCK_RE = /<!--INTERNAL_CALIBER:([\s\S]*?)-->\n?/g;

const GENERIC_LAW_SET = new Set([
    '公平竞争审查相关规定',
    '公平竞争审查实务标准',
    '公平竞争审查规定',
    '相关规定',
    '相关法律法规',
]);

/**
 * 确定性对外文本脱敏函数：
 * 剥离内部溯源注释标记与“集中答疑口径 / 总局答疑”等内部名称/编号，保留实质法理分析与修改建议。
 */
export function sanitizePublicText(text?: string | null, fallbackIfEmpty = ''): string {
    if (typeof text !== 'string') return fallbackIfEmpty;

    let cleaned = text
        // 1. 剥离内部溯源注释块
        .replace(MARKER_BLOCK_RE, '')
        // 2. 去掉编号前缀，如 [总局答疑41] / 【总局答疑41】 / 【内部口径 1】
        .replace(/[\[【]\s*总局答疑\d*\s*[\]】]\s*/g, '')
        .replace(/[\[【]\s*内部口径\s*\d*\s*[\]】]\s*/g, '')
        // 3. 替换“根据...集中答疑口径...”完整引用短语，保留后面的实质内容
        .replace(/根据《[^》\n]*(?:集中)?答疑口径[^》\n]*》(?:[（(]第[一二三四五六七八九十百\d]+批[）)])?/g, '根据公平竞争审查相关规定')
        .replace(/根据[^》，。；\n]*(?:集中)?答疑口径[^》，。；\n]*》?/g, '根据公平竞争审查相关规定')
        // 4. 替换带书名号的内部口径名称
        .replace(/《[^》\n]*(?:集中)?答疑口径[^》\n]*》(?:[（(]第[一二三四五六七八九十百\d]+批[）)])?/g, '公平竞争审查相关规定')
        // 5. 替换泛化的内部口径名称词组（按由长到短顺序）
        .replace(/国家市场监督管理总局答疑口径/g, '公平竞争审查实务标准')
        .replace(/市场监管总局答疑口径/g, '公平竞争审查实务标准')
        .replace(/总局权威答疑口径/g, '公平竞争审查实务标准')
        .replace(/总局答疑口径/g, '公平竞争审查实务标准')
        .replace(/总局实践答疑/g, '公平竞争审查实务标准')
        .replace(/总局答疑/g, '公平竞争审查实务标准')
        .replace(/内部答疑口径/g, '公平竞争审查实务标准')
        .replace(/集中答疑口径/g, '公平竞争审查实务标准')
        .replace(/内部业务口径/g, '公平竞争审查实务标准')
        .replace(/答疑口径/g, '公平竞争审查实务标准')
        // 6. 消除替换后可能出现的重复“规定”或空书名号/冗余标点
        .replace(/公平竞争审查相关规定(?:的)?规定/g, '公平竞争审查相关规定')
        .replace(/《\s*》/g, '')
        .replace(/[，,]{2,}/g, '，')
        .replace(/[。]{2,}/g, '。')
        .replace(/^[，、；：\s]+/, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return cleaned || fallbackIfEmpty;
}

/**
 * 将公开案例文本与内部口径溯源标记编码存入 ReviewRisk.relatedCase（零 Schema 变更）。
 */
export function encodeRelatedCaseWithCaliber(
    relatedCase?: string | null,
    internalCaliberRef?: string | null
): string {
    const cleanedCase = sanitizePublicText(relatedCase);
    const trimmedRef = typeof internalCaliberRef === 'string' ? internalCaliberRef.trim() : '';

    if (!trimmedRef) {
        return cleanedCase;
    }

    const header = `${MARKER_PREFIX}${JSON.stringify({ ref: trimmedRef })}-->\n`;
    return cleanedCase ? `${header}${cleanedCase}` : header;
}

/**
 * 从风险文本中提取内部口径溯源：
 * 1) 优先解析显式 <!--INTERNAL_CALIBER:{"ref":"..."}--> 注释标记；
 * 2) 否则兼容历史旧记录，嗅探其中的 [总局答疑XX] 或《...答疑口径...》引用。
 */
export function extractInternalCaliberFromText(...texts: Array<string | null | undefined>): string | null {
    // 1. 优先读取显式编码标记
    for (const text of texts) {
        if (typeof text !== 'string' || !text.includes(MARKER_PREFIX)) continue;
        const singleMarkerRe = /<!--INTERNAL_CALIBER:([\s\S]*?)-->/g;
        let match: RegExpExecArray | null;
        while ((match = singleMarkerRe.exec(text)) !== null) {
            try {
                const payload = JSON.parse(match[1]);
                if (payload && typeof payload.ref === 'string' && payload.ref.trim()) {
                    return payload.ref.trim();
                }
            } catch {
                // 忽略损坏的标记 JSON，继续尝试下一段
            }
        }
    }

    // 2. 兼容历史旧记录：嗅探口径编号与书名号引用
    const legacyHits = new Set<string>();
    const legacyRe = /([\[【]总局答疑\d+[\]】][^\n。；]*|《[^》\n]*答疑口径[^》\n]*》(?:[（(]第[一二三四五六七八九十百\d]+批[）)])?)/g;

    for (const text of texts) {
        if (typeof text !== 'string' || !text) continue;
        let match: RegExpExecArray | null;
        legacyRe.lastIndex = 0;
        while ((match = legacyRe.exec(text)) !== null) {
            const snippet = match[1].trim();
            if (snippet) {
                legacyHits.add(snippet);
            }
        }
    }

    if (legacyHits.size === 0) return null;
    return Array.from(legacyHits).join('；');
}

function normalizePublicLaw(rawLaw?: string | null): string {
    const fallbackLaw = '《公平竞争审查条例》及相关招投标公平竞争审查规定';
    const cleaned = sanitizePublicText(rawLaw);
    if (!cleaned) return fallbackLaw;

    if (!cleaned.includes('《')) {
        const bare = cleaned
            .replace(/^(?:根据|依据|按照|参照)+/, '')
            .replace(/[。；，,\s]+$/g, '')
            .trim();
        if (!bare || GENERIC_LAW_SET.has(bare)) {
            return fallbackLaw;
        }
    }

    return cleaned;
}

export interface FormattedRiskBase {
    title: string;
    description: string;
    location: string | null | undefined;
    suggestion: string | null | undefined;
    law: string;
    relatedCase: string | null | undefined;
    defense: string | null;
    rulingReason: string | null;
    internalCaliber?: string | null;
}

/**
 * 面向不同角色格式化风险对象：
 * - 所有角色（含管理员）看到的常规字段均已确定性脱敏；
 * - 非管理员（isAdmin === false）返回对象物理剥离 internalCaliber 属性；
 * - 管理员（isAdmin === true）额外附带 internalCaliber 字段用于内部溯源。
 */
export function formatRiskForViewer<T extends Record<string, any>>(
    rawRisk: T,
    isAdmin: boolean
): Omit<T, 'internalCaliber'> & { internalCaliber?: string | null } {
    const internalCaliber = extractInternalCaliberFromText(
        rawRisk.relatedCase,
        rawRisk.law,
        rawRisk.description,
        rawRisk.rulingReason
    );

    const formatted: Record<string, any> = {
        ...rawRisk,
        title: sanitizePublicText(rawRisk.title),
        description: sanitizePublicText(rawRisk.description),
        location: rawRisk.location != null ? sanitizePublicText(rawRisk.location) : rawRisk.location,
        suggestion: rawRisk.suggestion != null ? sanitizePublicText(rawRisk.suggestion) : rawRisk.suggestion,
        law: normalizePublicLaw(rawRisk.law),
        relatedCase: rawRisk.relatedCase != null ? sanitizePublicText(rawRisk.relatedCase) : rawRisk.relatedCase,
        defense: rawRisk.defense ? sanitizePublicText(rawRisk.defense) || null : null,
        rulingReason: rawRisk.rulingReason ? sanitizePublicText(rawRisk.rulingReason) || null : null,
    };

    if (isAdmin) {
        formatted.internalCaliber = internalCaliber || null;
    } else {
        delete formatted.internalCaliber;
    }

    return formatted as Omit<T, 'internalCaliber'> & { internalCaliber?: string | null };
}
