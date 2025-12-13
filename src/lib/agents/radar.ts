import { callLLM } from '@/lib/llm';
import { AuditIssue } from './auditor';

interface RadarAlert {
    level: 'High' | 'Medium';
    title: string;
    description: string;
}

export async function runRiskRadar(fileName: string, auditorResults: AuditIssue[]): Promise<RadarAlert | null> {
    console.log('Running Risk Radar on:', fileName);

    if (auditorResults.length === 0) {
        return null;
    }

    const systemPrompt = `
    你是一个“风险雷达”（Risk Radar）。你的任务是基于初审结果，进一步分析是否存在深层次的系统性风险或隐蔽的利益输送嫌疑。

    重点关注：
    1. **“萝卜坑”招标**: 资质要求是否过于具体，指向特定企业？
    2. **利益输送**: 是否存在明显的排他性条款？
    3. **重复违规**: (虽然目前没有历史数据，但请根据当前问题的严重程度判断)

    请根据文件名和初审发现的问题进行综合研判。

    如果发现重大隐患，请返回 JSON 对象：
    {
        "level": "High" | "Medium",
        "title": "简短的警示标题（如：疑似定向招标）",
        "description": "详细的风险分析。"
    }

    如果没有额外发现，返回 null。
    `;

    const userPrompt = `
    文件名: ${fileName}
    初审发现的问题:
    ${JSON.stringify(auditorResults, null, 2)}
    `;

    const resultStr = await callLLM(systemPrompt, userPrompt, true, 'deepseek-chat');

    if (!resultStr) {
        return null;
    }

    try {
        const result = JSON.parse(resultStr);
        // Check if result is empty or null-like
        if (!result || Object.keys(result).length === 0) return null;
        return result as RadarAlert;
    } catch (e) {
        console.error('Failed to parse Radar JSON:', resultStr);
        return null;
    }
}
