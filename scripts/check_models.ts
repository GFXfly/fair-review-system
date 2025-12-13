
import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
});

async function main() {
    try {
        console.log('Fetching models from:', client.baseURL);
        const list = await client.models.list();
        console.log('Available models:');
        list.data.forEach(m => console.log(` - ${m.id}`));
    } catch (e) {
        console.error('Error fetching models:', e);
    }
}

main();
