import OpenAI from 'openai';

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
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL_NAME || 'deepseek-chat';
export const DEEPSEEK_REASONER_MODEL = process.env.REASONER_MODEL_NAME || 'deepseek-reasoner';

// SiliconFlow / Local Provider Models
export const QWEN_MODEL = process.env.MAIN_MODEL_NAME || 'Qwen/Qwen3-235B-A22B-Instruct-2507';
export const GLM_MODEL = 'THUDM/glm-4-9b-chat';
export const KIMI_MODEL = 'Qwen/Qwen2.5-72B-Instruct';


export async function callLLM(
    systemPrompt: string,
    userPrompt: string,
    jsonMode: boolean = false,
    modelName: string = DEEPSEEK_MODEL
): Promise<string | null> {

    let client: OpenAI;
    let actualModel = modelName;

    // Route to appropriate client based on model name or explicit provider
    if (modelName.startsWith('deepseek') && !process.env.USE_LOCAL_LLM) {
        client = getDeepSeekClient();
    } else {
        // In Intranet mode, this serves local models like DeepSeek-R1-32B
        client = getSiliconFlowClient();
        // If we are in intranet, we might need to force the model name from env
        if (process.env.USE_LOCAL_LLM && process.env.MAIN_MODEL_NAME) {
            actualModel = process.env.MAIN_MODEL_NAME;
        }
    }

    try {
        const completion = await client.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            model: actualModel,
            response_format: jsonMode ? { type: 'json_object' } : { type: 'text' },
            temperature: Number(process.env.LLM_TEMPERATURE) || 0.1,
        });

        return completion.choices[0].message.content;
    } catch (error: any) {
        console.error(`[LLM] Call Failed (${modelName}):`, error.message);
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

