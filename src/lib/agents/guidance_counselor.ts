
import { callLLM } from '@/lib/llm';
import { prisma } from '@/lib/prisma';

export async function runGuidanceCounselor(text: string): Promise<string> {
    console.log('[GuidanceCounselor] Starting retrieval of expert Q&A criteria...');

    try {
        // 1. Fetch all QA titles
        // Since there are only ~60-100, this is feasible context for an LLM
        const allQAs = await prisma.regulation.findMany({
            where: {
                OR: [
                    { category: 'QA_Fragment' },
                    { title: { startsWith: '[总局答疑' } } // Fallback if category wasn't set on some
                ]
            },
            select: {
                id: true,
                title: true
            }
        });

        if (allQAs.length === 0) {
            console.log('[GuidanceCounselor] No QA fragments found.');
            return "";
        }

        // 2. Ask LLM to pick the top 5 relevant questions based on the input text
        // We send a summary of the text (first 3000 chars) to save tokens
        const summaryText = text.substring(0, 3000);

        const selectionPrompt = `
        你是一个专业的审查助手。以下是一份正在被审查的政府文件内容摘要：
        
        """
        ${summaryText}
        ... (剩余内容省略)
        """

        我们的数据库中有以下【总局公平竞争审查答疑口径】（Q&A）：
        ${allQAs.map(q => `[ID:${q.id}] ${q.title}`).join('\n')}

        请判断：这份文件可能涉及上述哪些“答疑口径”中的场景？
        请选出最相关的 3-5 个问题的 ID。
        如果文件内容与这些问题都不相关，请返回空。
        
        只返回一个 JSON 数组，包含 ID 数字，例如：[129, 135, 140]。不要返回其他文字。
        `;

        const selectionResult = await callLLM(
            "你是一个精准的检索助手。只返回 JSON 数组。",
            selectionPrompt,
            true, // Expect JSON
            'deepseek-chat' // Use V3 for fast retrieval
        );

        let selectedIds: number[] = [];
        try {
            selectedIds = JSON.parse(selectionResult || "[]");
        } catch (e) {
            console.error('[GuidanceCounselor] Failed to parse ID selection:', selectionResult);
            // Fallback: if parsing fails, maybe regex match the IDs?
            const matches = selectionResult?.match(/\d+/g);
            if (matches) {
                selectedIds = matches.map(Number);
            }
        }

        if (selectedIds.length === 0) {
            console.log('[GuidanceCounselor] No relevant QA selected by LLM.');
            return "";
        }

        console.log('[GuidanceCounselor] Selected IDs:', selectedIds);

        // 3. Fetch full content of selected QAs
        const selectedQAs = await prisma.regulation.findMany({
            where: {
                id: { in: selectedIds }
            },
            select: {
                title: true,
                content: true
            }
        });

        // 4. Format the output
        let guidanceText = "★【总局权威答疑口径（最高优先级，必须严格执行）】：\n";
        selectedQAs.forEach((qa, idx) => {
            guidanceText += `\n【规则 ${idx + 1}】${qa.title}\n`;
            guidanceText += `👉 官方认定标准：${qa.content}\n`;
        });
        guidanceText += "\n（以上规则来自总局实践答疑，具有最高效力，若文件内容触犯上述规则，直接判定为违规。）\n";

        return guidanceText;

    } catch (error) {
        console.error('[GuidanceCounselor] Error:', error);
        return "";
    }
    // Note: Do NOT disconnect Prisma here - it's a global singleton that should persist
}
