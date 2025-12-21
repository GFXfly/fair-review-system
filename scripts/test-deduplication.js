// Test the deduplication logic

const testRisks = [
    {
        id: 'risk_1',
        risk_level: 'High',
        description: '【地域性限制/不合理的准入条件】文件要求联合体各方均需提供资信证明，这可能排斥小企业。',
        location: '第二部分投标人须知前附表第13条：联合体投标的，联合体各方均需按招标文件第四部分评标标准要求提供资信证明文件，否则视为不符合相关要求。'
    },
    {
        id: 'risk_2',
        risk_level: 'Medium',
        description: '【不合理的准入条件/潜在所有制歧视】文件规定联合体中有一方提供即可，存在模糊性。',
        location: '第二部分投标人须知前附表第13条：联合体投标的，联合体中有一方或者联合体成员根据分工按招标文件第四部分评标标准要求提供资信证明文件的，视为符合了相关要求。'
    },
    {
        id: 'risk_3',
        risk_level: 'High',
        description: '【完全不同的风险】这是另一个条款',
        location: '第五条：其他完全不同的内容'
    }
];

// Normalize function
const normalize = (text) => {
    return text
        .replace(/[\s\u3000]/g, '')
        .replace(/[,，.。、;；:：!！?？"""''()[\]【】《》<>]/g, '')
        .toLowerCase();
};

// Similarity function
const similarity = (a, b) => {
    const normA = normalize(a);
    const normB = normalize(b);

    if (!normA || !normB) return 0;

    const setA = new Set(normA.split(''));
    const setB = new Set(normB.split(''));

    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
};

console.log('=== Testing Risk Deduplication ===\n');

console.log('Risk 1 location:', testRisks[0].location.substring(0, 80) + '...');
console.log('Risk 2 location:', testRisks[1].location.substring(0, 80) + '...');
console.log('\nSimilarity between Risk 1 and Risk 2:', (similarity(testRisks[0].location, testRisks[1].location) * 100).toFixed(1) + '%');

console.log('\n');
console.log('Risk 1 location:', testRisks[0].location.substring(0, 80) + '...');
console.log('Risk 3 location:', testRisks[2].location);
console.log('\nSimilarity between Risk 1 and Risk 3:', (similarity(testRisks[0].location, testRisks[2].location) * 100).toFixed(1) + '%');

console.log('\n=== Expected Result ===');
console.log('✓ Risk 1 and Risk 2 should be merged (similarity > 60%)');
console.log('✓ Risk 3 should remain separate');
console.log('✓ Final risk count: 2 (down from 3)');
console.log('✓ Merged risk should keep High level and combine descriptions');
