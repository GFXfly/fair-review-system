
import fetch from 'node-fetch';

async function listModels() {
    const apiKey = 'sk-gvmahzludywikpfxhuiyqswqxfcisofmeoqpumkqwjqqskdy';
    try {
        const response = await fetch('https://api.siliconflow.cn/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Failed to list models:', error);
    }
}

listModels();
