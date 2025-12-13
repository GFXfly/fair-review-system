import OpenAI from 'openai';

// Lazy load the client to ensure we pick up the latest env vars
// Helper to get DeepSeek client (Official)
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

// Helper to get SiliconFlow client (For other models)
function getSiliconFlowClient() {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    const baseURL = 'https://api.siliconflow.cn/v1';

    if (!apiKey) {
        throw new Error('SILICONFLOW_API_KEY environment variable is not set. Please configure it in your .env file.');
    }

    return new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL,
    });
}

// Model Constants
export const DEEPSEEK_MODEL = 'deepseek-chat'; // V3
export const DEEPSEEK_REASONER_MODEL = 'deepseek-reasoner'; // R1

// SiliconFlow Models
export const QWEN_MODEL = 'Qwen/Qwen2.5-72B-Instruct'; // Example high-end Qwen
export const GLM_MODEL = 'THUDM/glm-4-9b-chat'; // Example GLM
export const KIMI_MODEL = 'Qwen/Qwen2.5-72B-Instruct'; // Placeholder if Kimi not direct, use Qwen as weak proxy or actual if available


export async function callLLM(
    systemPrompt: string,
    userPrompt: string,
    jsonMode: boolean = false,
    modelName: string = DEEPSEEK_MODEL
): Promise<string | null> {

    let client: OpenAI;
    let actualModel = modelName;

    // Route to appropriate client based on model name
    if (modelName.startsWith('deepseek')) {
        client = getDeepSeekClient();
    } else {
        client = getSiliconFlowClient();
    }

    try {
        const completion = await client.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            model: actualModel,
            response_format: jsonMode ? { type: 'json_object' } : { type: 'text' },
            temperature: 0.1,
        });

        return completion.choices[0].message.content;
    } catch (error: any) {
        console.error(`[LLM] Call Failed (${modelName}):`, error.message);
        if (error.status === 401) {
            console.error('[LLM] Authentication Error - Please check API Key.');
        }
        throw error;
    }
}


// Singleton for formatting/embedding pipeline
let embedder: any = null;

// New function to call SiliconFlow API
async function getSiliconFlowEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    const baseUrl = 'https://api.siliconflow.cn/v1/embeddings';

    if (!apiKey) {
        console.error('[LLM] SILICONFLOW_API_KEY is not set');
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
                model: 'BAAI/bge-m3', // Recommended model for Chinese text
                input: text
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SiliconFlow API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        if (data.data && data.data.length > 0) {
            return data.data[0].embedding;
        } else {
            throw new Error('No embedding data returned from API');
        }
    } catch (error: any) {
        console.error('[LLM] SiliconFlow Embedding Failed:', error.message);
        return [];
    }
}

export async function getEmbedding(text: string): Promise<number[]> {
    // Priority: Use SiliconFlow API if Key is present (or hardcoded for now as requested)
    return await getSiliconFlowEmbedding(text);

    /* 
    try {
        // TEMPORARY FIX: Disable local embedding on server to prevent Ort::Exception crash.
        // ... (Old local logic commented out)
    }
    */
}
