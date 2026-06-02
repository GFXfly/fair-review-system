import OpenAI from 'openai';
import { APP_CONFIG } from '@/lib/config';

// Lazy load the client to ensure we pick up the latest env vars
// Helper to get DeepSeek client
function getDeepSeekClient() {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

    if (!apiKey) {
        throw new Error('DEEPSEEK_API_KEY is not configured. Please set it in your .env file.');
    }

    return new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL,
    });
}

// Helper to get SiliconFlow client (or any OpenAI-compatible provider)
function getSiliconFlowClient() {
    const apiKey = process.env.SILICONFLOW_API_KEY || 'no-key-needed-for-local';
    const baseURL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';

    return new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL,
    });
}

// Model Constants - Allow override via environment variables
//
// ⚠️ DeepSeek V4 迁移（2026-04）：
// 旧名 deepseek-chat / deepseek-reasoner 将于 2026-07-24 15:59 UTC 停用。
// V4 取消了"用不同模型名选推理"，改为同一模型 + thinking 参数切换（见 callLLM）。
//   - FLASH_MODEL：跑量环节（守门、检索、改写、预警），快
//   - PRO_MODEL：质量命门（核心审查 Auditor、裁决 Judge），开 thinking
export const FLASH_MODEL = process.env.FLASH_MODEL_NAME || 'deepseek-v4-flash';
export const PRO_MODEL = process.env.PRO_MODEL_NAME || 'deepseek-v4-pro';

// SiliconFlow / Local Provider Models
export const QWEN_MODEL = process.env.MAIN_MODEL_NAME || 'Qwen/Qwen3-235B-A22B-Instruct-2507';
export const GLM_MODEL = 'THUDM/glm-4-9b-chat';
export const KIMI_MODEL = 'Qwen/Qwen2.5-72B-Instruct';


/**
 * 从已解析的 LLM JSON 结果中提取数组负载。
 *
 * 背景：DeepSeek V4 在 `json_object` 模式下顶层必须是对象，倾向返回
 * `{"risks":[...]}` 这样的对象包数组；而旧模型（deepseek-reasoner）常直接返回裸数组 `[...]`。
 * 这里统一兼容两种形态：是数组直接返回；是对象则取其中第一个数组类型的值。
 * 返回 null 表示找不到任何数组负载（交由调用方决定如何降级）。
 */
export function firstArray<T = unknown>(parsed: unknown): T[] | null {
    if (Array.isArray(parsed)) return parsed as T[];
    if (parsed && typeof parsed === 'object') {
        for (const value of Object.values(parsed as Record<string, unknown>)) {
            if (Array.isArray(value)) return value as T[];
        }
    }
    return null;
}

export interface LLMCallOptions {
    jsonMode?: boolean;
    model?: string;
    // 仅 DeepSeek 模型生效。默认 false=disabled，显式规避 V4「thinking 默认开启」的陷阱，
    // 避免跑量环节误开思考链导致变慢。
    thinking?: boolean;
    // reasoning_effort，仅 thinking 时有意义（'high' 质量好且延迟可控，'max' 质量天花板但更慢）。
    effort?: 'high' | 'max';
}

// DeepSeek 在 OpenAI 兼容接口上扩展了 thinking 开关与 'max' 档位的 reasoning_effort，
// 标准 SDK 类型不含这两个字段，这里精确扩展类型，而非用 any 逃逸。
type DeepSeekChatParams = Omit<
    OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
    'reasoning_effort'
> & {
    thinking?: { type: 'enabled' | 'disabled' };
    reasoning_effort?: 'high' | 'max';
};

export async function callLLM(
    systemPrompt: string,
    userPrompt: string,
    options: LLMCallOptions = {}
): Promise<string | null> {
    const { jsonMode = false, model = FLASH_MODEL, thinking = false, effort } = options;

    let client: OpenAI;
    let actualModel = model;
    let isDeepSeek = false;

    // Route to appropriate client based on model name or explicit provider
    if (model.startsWith('deepseek') && !process.env.USE_LOCAL_LLM) {
        client = getDeepSeekClient();
        isDeepSeek = true;
    } else {
        // In Intranet mode, this serves local models like DeepSeek-R1-32B
        client = getSiliconFlowClient();
        // If we are in intranet, we might need to force the model name from env
        if (process.env.USE_LOCAL_LLM && process.env.MAIN_MODEL_NAME) {
            actualModel = process.env.MAIN_MODEL_NAME;
        }
    }

    const baseParams: DeepSeekChatParams = {
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        model: actualModel,
        response_format: jsonMode ? { type: 'json_object' } : { type: 'text' },
        temperature: APP_CONFIG.llm.temperature,
    };

    // DeepSeek V4 thinking toggle. OpenAI-compatible 格式下这些字段位于请求体顶层
    // （等价于 Python SDK 的 extra_body）。仅对 DeepSeek 云端模型附加，
    // SiliconFlow/本地 provider 可能拒绝未知字段。
    const params: DeepSeekChatParams = isDeepSeek
        ? {
              ...baseParams,
              thinking: { type: thinking ? 'enabled' : 'disabled' },
              ...(thinking && effort ? { reasoning_effort: effort } : {}),
          }
        : baseParams;

    try {
        // params 已用 DeepSeekChatParams 强类型构造；SDK 基础类型不含 DeepSeek 的扩展字段
        // （thinking / reasoning_effort='max'），故此处仅在调用边界做一次窄断言。
        const completion = await client.chat.completions.create(
            params as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
            { timeout: APP_CONFIG.llm.timeout },
        );

        return completion.choices[0].message.content;
    } catch (error: any) {
        console.error(`[LLM] Call Failed (${actualModel}):`, error.message);
        throw error;
    }
}


// New function to call Embedding API (Can be SiliconFlow or Local Ollama/vLLM)
async function getExternalEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    const baseUrl = process.env.EMBEDDING_API_URL || 'https://api.siliconflow.cn/v1/embeddings';

    if (!apiKey && !process.env.USE_LOCAL_EMBEDDING) {
        console.error('[LLM] No API key provided for Remote Embedding');
        return [];
    }

    try {
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: process.env.EMBEDDING_MODEL_NAME || 'BAAI/bge-m3',
                input: text
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Embedding API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        if (data.data && data.data.length > 0) {
            return data.data[0].embedding;
        } else {
            throw new Error('No embedding data returned from API');
        }
    } catch (error: any) {
        console.error('[LLM] Embedding Failed:', error.message);
        return [];
    }
}

export async function getEmbedding(text: string): Promise<number[]> {
    // If we want to use local in-process transformers.js (useful for complete offline without extra API)
    if (process.env.EMBEDDING_SOURCE === 'local-transformers') {
        // This will be handled in rag.ts for better code separation
        return [];
    }

    // Default: Use OpenAI-compatible Embedding API (Cloud or Local server)
    return await getExternalEmbedding(text);
}

