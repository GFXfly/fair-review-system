
import { runAuditor } from '../src/lib/agents/auditor';
import * as dotenv from 'dotenv';
dotenv.config({ override: true });

async function testAccuracy() {
    console.log("=== Testing Review Accuracy on Known Violation ===");

    // Construct a test case with a clear "Local Presence" violation
    // This looks like a typical procurement announcement
    const testText = `
    关于XX市智慧城市项目招标公告
    ...
    三、投标人资格要求
    1. 具有独立承担民事责任的能力；
    2. 投标人必须是本市行政区域内注册的企业，或者在本地设有分公司（需提供本地工商注册证明）；
    3. 外地企业参与投标，应当在开标前与本地企业组成联合体，且本地企业占股比例不低于 30%；
    4. 具有良好的商业信誉和健全的财务会计制度。
    ...
    `;

    console.log("Test Text Snippet:", testText);

    try {
        // Run the Auditor
        // Category 'BIDDING' is typical for this text
        const risks = await runAuditor('BIDDING', testText);

        console.log("\n=== Analysis Results ===");
        if (risks.length === 0) {
            console.log("❌ FAILED: No risks detected. System missed the violation.");
        } else {
            console.log(`✅ SUCCESS: Detected ${risks.length} risk(s).`);
            risks.forEach((risk, i) => {
                console.log(`\nRisk #${i + 1}:`);
                console.log(`- Level: ${risk.risk_level}`);
                console.log(`- Description: ${risk.description}`);
                console.log(`- Detected Clause: "${risk.location}"`);
                console.log(`- Suggestion: ${risk.suggestion}`);
            });
        }

    } catch (e) {
        console.error("Error during test:", e);
    }
}

testAccuracy();
