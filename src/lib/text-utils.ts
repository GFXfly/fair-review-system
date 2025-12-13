/**
 * 统一的文本处理工具
 * 管理不同 Agent 的文本截断策略
 */

export class TextChunker {
    // 定义各个 Agent 的文本长度限制
    static readonly GATEKEEPER_CHUNK = 2000;    // 门卫只需要看前面部分判断类型
    static readonly AUDITOR_CHUNK = 15000;      // 审计员需要看更多内容
    static readonly DEBATE_CHUNK = 5000;        // 辩论需要足够上下文（从3000增加到5000）
    static readonly GUIDANCE_CHUNK = 3000;      // 指导顾问检索相关规则

    /**
     * 根据 Agent 类型获取适当的文本截断
     */
    static getChunkForAgent(text: string, agentType: 'gatekeeper' | 'auditor' | 'debate' | 'guidance'): string {
        let maxLength: number;

        switch (agentType) {
            case 'gatekeeper':
                maxLength = this.GATEKEEPER_CHUNK;
                break;
            case 'auditor':
                maxLength = this.AUDITOR_CHUNK;
                break;
            case 'debate':
                maxLength = this.DEBATE_CHUNK;
                break;
            case 'guidance':
                maxLength = this.GUIDANCE_CHUNK;
                break;
            default:
                maxLength = 10000;
        }

        return this.truncate(text, maxLength);
    }

    /**
     * 安全截断文本
     * 优先在句子结束处截断，避免截断到句子中间
     */
    static truncate(text: string, maxLength: number): string {
        if (text.length <= maxLength) {
            return text;
        }

        // 截断到指定长度
        let truncated = text.substring(0, maxLength);

        // 尝试找到最后一个句子结束符（。！？）
        const lastSentenceEnd = Math.max(
            truncated.lastIndexOf('。'),
            truncated.lastIndexOf('！'),
            truncated.lastIndexOf('？'),
            truncated.lastIndexOf('\n')
        );

        // 如果找到了句子结束符，且位置不太靠前（至少要有50%的内容）
        if (lastSentenceEnd > maxLength * 0.5) {
            truncated = truncated.substring(0, lastSentenceEnd + 1);
        }

        return truncated;
    }

    /**
     * 滑动窗口分块
     * 用于 RAG 检索时扫描全文
     */
    static* slidingWindow(text: string, windowSize: number = 1000, overlap: number = 200): Generator<string> {
        for (let i = 0; i < text.length; i += (windowSize - overlap)) {
            const chunk = text.substring(i, i + windowSize);
            if (chunk.length < 100) break; // 跳过过小的尾块
            yield chunk;
        }
    }
}
