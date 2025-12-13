
import 'dotenv/config';
import { runAuditor } from '../src/lib/agents/auditor';

async function main() {
    const category = "BIDDING"; // 招标投标
    const text = `
    关于印发《进一步规范本市工程建设招标投标工作的通知》
    
    各有关单位：
    为进一步规范本市工程建设招标投标工作，优化营商环境，现就有关事项通知如下：

    一、加强投标人资格审查
    为保证工程质量和安全，凡参与本市依法必须招标项目的投标人，建议在本市行政区域内设立分支机构，以便于沟通协调。对于未设立分支机构的，在同等条件下可优先考虑本地企业。

    二、支持本地产业发展
    在政府采购和招投标活动中，鼓励采购人优先采购本地企业生产的创新产品。

    三、规范保证金管理
    外地企业中标后，中标人应在签订合同前缴纳履约保证金。为防止税收流失，中标人必须承诺将项目产生的增值税、企业所得税等在本地缴纳。
    
    本通知自发布之日起施行。
    `;

    console.log("Testing Auditor Agent with RAG...");
    const issues = await runAuditor(category, text);

    console.log(`\nFound ${issues.length} issues:`);
    issues.forEach(i => {
        console.log(`\n[${i.risk_level}] ${i.description}`);
        console.log(`Location: ${i.location}`);
        console.log(`Suggestion: ${i.suggestion}`);
        console.log(`Reference: ${i.reference || 'None'}`);
    });
}

main().catch(console.error);
