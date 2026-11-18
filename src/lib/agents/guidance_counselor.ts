
import { callLLM, firstArray, FLASH_MODEL } from '@/lib/llm';
import { prisma } from '@/lib/prisma';
import { prepareDocumentForAudit } from '@/lib/bidding-precision';

export async function runGuidanceCounselor(text: string, category: string = ''): Promise<string> {
    console.log('[GuidanceCounselor] Starting retrieval of expert Q&A criteria...');

    let guidanceText = "";

    try {
        // 0. 根据文件类型加载核心法规
        if (category === 'BIDDING') {
            // 招标文件 → 加载《浙江省招标投标领域公平竞争审查细则》
            console.log('[GuidanceCounselor] Category is BIDDING, fetching Zhejiang rules...');
            const zhejiangRules = await prisma.regulation.findFirst({
                where: { title: '浙江省招标投标领域公平竞争审查细则' },
                select: { content: true }
            });

            if (zhejiangRules) {
                guidanceText += "★【浙江省招标投标领域公平竞争审查细则（招标文件类最高优先级标准）】：\n";
                guidanceText += zhejiangRules.content;
                guidanceText += "\n\n（针对招标文件，请重点对照上述细则进行审查，若违反直接判定为违规。）\n\n";
            } else {
                console.warn('[GuidanceCounselor] Zhejiang rules not found in DB!');
            }
        } else {
            // 其他政策文件/政府协议 → 加载《公平竞争审查条例实施办法》
            console.log('[GuidanceCounselor] Category is', category, ', fetching Implementation Rules...');
            const implementationRules = await prisma.regulation.findFirst({
                where: { title: '公平竞争审查条例实施办法' },
                select: { content: true }
            });

            if (implementationRules) {
                guidanceText += "★【公平竞争审查条例实施办法（第9-24条审查标准）】：\n";
                guidanceText += implementationRules.content;
                guidanceText += "\n\n（针对政策文件/政府协议，请重点对照上述实施办法的审查标准进行审查。）\n\n";
            } else {
                console.warn('[GuidanceCounselor] Implementation Rules not found in DB!');
            }
        }


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
            return guidanceText;
        }

        // 2. Ask LLM to pick the top 5 relevant questions based on the high-density summary
        const summaryText = prepareDocumentForAudit(text, category).summaryForGuidance;

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
        如果文件内容与这些问题都不相关，请返回空数组。
        
        只返回一个 JSON 对象，格式为 {"ids": [129, 135, 140]}；若无相关项则返回 {"ids": []}。不要返回其他文字。
        `;

        const selectionResult = await callLLM(
            "你是一个精准的检索助手。只返回包含 ids 数组的 JSON 对象。",
            selectionPrompt,
            { jsonMode: true, model: FLASH_MODEL } // 跑量检索，用 flash
        );

        let selectedIds: number[] = [];
        try {
            const rawIds = firstArray<unknown>(JSON.parse(selectionResult || "{}") ) ?? [];
            selectedIds = rawIds
                .map(id => (typeof id === 'number' ? id : Number(id)))
                .filter(id => Number.isSafeInteger(id) && id > 0);
        } catch (e) {
            console.error('[GuidanceCounselor] Failed to parse ID selection:', selectionResult);
            // Fallback: if parsing fails, maybe regex match the IDs?
            const matches = selectionResult?.match(/\d+/g);
            if (matches) {
                selectedIds = matches.map(Number).filter(id => Number.isSafeInteger(id) && id > 0);
            }
        }

        if (selectedIds.length === 0) {
            console.log('[GuidanceCounselor] No relevant QA selected by LLM.');
            return guidanceText;
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

        if (selectedQAs.length > 0) {
            // 4. Format the output
            guidanceText += "★【内部审查实务口径参考（⚠️ 内部资料，严禁在对外字段中提及名称或编号！）】：\n";
            selectedQAs.forEach((qa, idx) => {
                guidanceText += `\n【内部口径 ${idx + 1}】${qa.title}\n`;
                guidanceText += `👉 内部认定逻辑与上位法依据：${qa.content}\n`;
            });
            guidanceText += `\n（内部口径转换与对外脱敏规则，必须严格遵守：\n` +
                `1）上述内容属于内部审查实务口径，具有最高判定优先级，若文件内容触犯上述标准应判定为风险；\n` +
                `2）对外脱敏铁律：在 description、violated_law、suggestion、reference 中严禁出现“集中答疑口径”“总局答疑”“业务口径”“内部口径”或 [总局答疑XX] 等任何字样；\n` +
                `3）依据归位：请在 violated_law 中直接提取并引用该口径正文所援引的公开正式法规条款（如《公平竞争审查条例》《公平竞争审查条例实施办法》《浙江省招标投标领域公平竞争审查细则》《招标投标领域公平竞争审查规则》《公路工程建设项目资格预审文件和招标文件公平竞争合规指引》）；\n` +
                `4）建议内化：将口径中的违规法理分析与整改替代路径转化为客观专业的审查理由与具体可执行的修改建议写入 description 与 suggestion；\n` +
                `5）内部溯源标记：若某风险点参考了上述内部口径，请将该条的简短标题（如 "[总局答疑41] 投标文件中规定，供应商需提供连续投保食品安全责任险记录的期限..."）填入 internal_caliber_ref 字段；未参考则填 ""。）\n`;
        }

        return guidanceText;

    } catch (error) {
        console.error('[GuidanceCounselor] Error:', error);
        return guidanceText;
    }
    // Note: Do NOT disconnect Prisma here - it's a global singleton that should persist
}
