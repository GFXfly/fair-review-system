import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('开始添加浙江省宁波市镇海区典型案例...');

    const caseData = {
        title: '浙江省市场监管局纠正宁波市镇海区住房和建设交通局滥用行政权力排除、限制竞争行为',
        content: `【文件名称】《关于印发<局工程建设项目采购管理办法（修订）>的通知》（镇建交〔2023〕10号）、《战略合作框架协议》
【违规内容】当事人与当地某国有企业签订《战略合作框架协议》，约定绿化迁移工程全权委托该公司施工。后下发通知明确属于自主采购的工程等，经讨论通过可以直接发包。截至2023年9月，累计将8个工程项目直接发包给该公司，合同金额共计1730769元。
【审查解析】当事人在没有法律法规和国家政策依据情况下，通过与特定经营主体签订协议并制定配套政策，指定特定经营者实施相关工程项目，排除、限制了其他经营主体参与竞争。违反了《中华人民共和国反垄断法》第四十条“行政机关和法律、法规授权的具有管理公共事务职能的组织不得滥用行政权力，通过与经营者签订合作协议、备忘录等方式，妨碍其他经营者进入相关市场或者对其他经营者实行不平等待遇，排除、限制竞争”的规定。
【处理结果】当事人积极整改，主动与该公司终止合作协议，废止有关政策措施，在政府网站进行公布，并向浙江省市场监管局提交了整改报告。`,
        violationType: '指定交易',
        result: '已整改',
        publishDate: '2024-09-29',
        province: '浙江省',
        violationClause: `《中华人民共和国反垄断法》
第四十条 行政机关和法律、法规授权的具有管理公共事务职能的组织不得滥用行政权力，通过与经营者签订合作协议、备忘录等方式，妨碍其他经营者进入相关市场或者对其他经营者实行不平等待遇，排除、限制竞争。`,
        documentName: '《关于印发<局工程建设项目采购管理办法（修订）>的通知》',
        documentOrg: '宁波市镇海区住房和建设交通局',
        violationDetail: '在没有法律法规和国家政策依据情况下，通过与特定经营主体签订《战略合作框架协议》，指定特定经营者实施相关绿化迁移工程项目',
        legalScope: '《中华人民共和国反垄断法》'
    };

    // Check if case already exists to avoid duplicates (fuzzy match on title)
    const existingCase = await prisma.case.findFirst({
        where: {
            title: caseData.title
        }
    });

    if (existingCase) {
        console.log(`案例 "${caseData.title}" 已存在，正在更新内容...`);
        await prisma.case.update({
            where: { id: existingCase.id },
            data: caseData
        });
        console.log(`案例 "${caseData.title}" 更新成功。`);
    } else {
        await prisma.case.create({
            data: caseData
        });
        console.log(`案例 "${caseData.title}" 添加成功。`);
    }

    console.log('案例处理完成。');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
