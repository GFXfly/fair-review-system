/**
 * 系统配置文件
 * 集中管理所有可调参数，便于优化和维护
 */

export const APP_CONFIG = {
    // ==========================================
    // RAG检索配置
    // ==========================================
    rag: {
        // 相似度阈值
        caseSimilarityThreshold: parseFloat(process.env.CASE_SIMILARITY_THRESHOLD || '0.65'),
        regulationSimilarityThreshold: parseFloat(process.env.REG_SIMILARITY_THRESHOLD || '0.60'),

        // 检索数量
        maxCasesPerQuery: parseInt(process.env.MAX_CASES_PER_QUERY || '10'),
        maxRegulationsPerQuery: parseInt(process.env.MAX_REGS_PER_QUERY || '5'),

        // 最终使用数量
        finalCasesCount: 5,
        finalRegulationsCount: 3,

        // 检索策略
        ragInputLength: parseInt(process.env.RAG_INPUT_LENGTH || '5000'),

        // 高质量案例阈值（用于警告）
        highQualityThreshold: 0.75,
        minHighQualityCases: 2,
    },

    // ==========================================
    // 文件处理配置
    // ==========================================
    file: {
        maxSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
        allowedTypes: ['docx', 'txt'],
    },

    // ==========================================
    // Agent文本长度配置
    // ==========================================
    agent: {
        gatekeeperMaxLength: 2000,
        auditorMaxLength: 15000,
        auditorMaxLengthForLongDoc: 25000, // 长文件时使用
        longDocThreshold: 20000, // 超过此长度视为长文件
        defenderMaxLength: 5000,
        guidanceMaxLength: 3000,
    },

    // ==========================================
    // LLM调用配置
    // ==========================================
    llm: {
        temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.1'),
        timeout: parseInt(process.env.LLM_TIMEOUT || '60000'),
    },

    // ==========================================
    // 辩论系统配置
    // ==========================================
    debate: {
        // DISMISS决定的最低置信度要求
        dismissConfidenceThreshold: parseInt(process.env.DISMISS_CONFIDENCE_THRESHOLD || '85'),
    },
} as const;

// 导出类型
export type AppConfig = typeof APP_CONFIG;
