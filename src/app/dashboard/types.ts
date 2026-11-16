/**
 * 仪表盘用到的接口返回结构。
 *
 * 字段以各 API 路由实际的 Prisma `select` 为准，不是完整的数据库模型——
 * 列表接口都做了字段裁剪，别照着 prisma/schema.prisma 补字段。
 */

/** GET /api/auth/me —— 见 src/lib/auth.ts 的 getCurrentUser */
export interface DashboardUser {
    id: number;
    username: string;
    name: string;
    department: string | null;
    orgType?: string;
    phone?: string | null;
    role: string; // 'admin' | 'user'
    createdAt: string;
    pendingUserCount?: number;
}

/**
 * GET /api/reviews —— 列表接口刻意排除了 originalText / originalHtml 两个全文
 * 大字段（见 src/app/api/reviews/route.ts），需要全文请走 /api/reviews/[id]。
 * 路由返回前会把 _count.risks 映射成 riskCount。
 */
export interface ReviewRecordSummary {
    id: string;
    fileName: string;
    fileSize: number | null;
    status: string; // pending | processing | completed | failed | ignored
    progress: number;
    progressMessage: string | null;
    riskCount: number;
    summary: string | null;
    createdAt: string;
    updatedAt: string;
    userId: number | null;
    user: {
        name: string;
        department: string | null;
        orgType?: string | null;
        phone?: string | null;
    } | null;
}

/**
 * 法规（GET /api/regulations）与案例（GET /api/cases）共用同一套 UI——
 * 同一张表格组件、同一个点击分发、同一个详情抽屉，运行时靠字段是否存在来区分
 * （见 use-knowledge-base.ts 的 handleItemClick）。因此这里合并成一个结构，
 * 两侧独有的字段都是可选的，而不是拆成联合类型再到处窄化。
 */
export interface KnowledgeItem {
    id: number;
    title: string;
    /** 两者共有 */
    publishDate?: string | null;

    // —— 法规字段
    level?: string | null;
    department?: string | null;
    category?: string | null;
    /** 列表接口不返回 content，点开详情时用 ?id= 单独拉取 */
    content?: string | null;

    // —— 案例字段
    violationType?: string | null;
    result?: string | null;
    province?: string | null;
    reportId?: number | null;
    report?: {
        department?: string | null;
        title?: string | null;
    } | null;
}
