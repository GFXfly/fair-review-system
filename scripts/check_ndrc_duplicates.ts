
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const casesTitles = [
    '福建省发展改革委主动作为协调解决加油船企业准入经营难题',
    '福建省福州市台江区主动核查整改违规设置烟花爆竹零售企业准入障碍及限制外地企业准入经营问题',
    '福建省漳州市东山县主动核查整改违规设置准入前置条件限制餐饮企业准入问题',
    '云南省玉溪市新平县嘎洒镇主动核查整改准入环节违规收费问题',
    '云南省保山市隆阳区主动核查整改在行政许可审批过程中违规收费问题',
    '云南省保山市主动核查整改以不当理由拒绝相关民办非企业单位年度检查问题',
    '云南省西双版纳州勐海县主动核查整改违规排除、限制共享电单车企业准入问题',
    '山东省菏泽市有关部门主动核查整改违规排除、限制共享单车企业准入及违规收费问题',
    '山东省菏泽市有关部门在准入环节违规要求共享电单车企业缴纳占道经营费',
    '广东省信宜市有关部门违规设置共享电单车企业准入门槛并违规收费',
    '广东省佛山市有关部门以捆绑招标违规限制共享电单车企业准入',
    '广东省深圳市有关部门未按规定进行共享单车企业准入经营管理，影响共享单车企业平等准入经营',
    '广西壮族自治区梧州市有关部门违规增设共享电单车企业准入要求',
    '浙江省宁波市象山县有关部门违规设置房屋安全鉴定企业考核要求，造成企业准入障碍',
    '湖北省荆门市有关部门违规排除、限制户外广告企业平等准入经营',
    '浙江省绍兴市新昌县有关部门违规排除、限制外地企业进入本地市场',
    '江西省赣州市定南县有关部门违规对共享电单车企业准入收费',
    '四川省宜宾市珙县有关部门违规指定三家燃气公司实施集中燃气报警控制系统安装'
];

async function main() {
    console.log('Checking for duplicates...');

    for (const title of casesTitles) {
        const count = await prisma.case.count({
            where: {
                title: title
            }
        });

        if (count > 1) {
            console.log(`[DUPLICATE] Found ${count} instances of: ${title}`);
            // List the IDs and creation times
            const instances = await prisma.case.findMany({
                where: { title: title },
                select: { id: true, createdAt: true, reportId: true }
            });
            console.log(instances);
        } else if (count === 1) {
            // console.log(`[OK] 1 instance of: ${title}`);
        } else {
            console.log(`[MISSING] No instance of: ${title}`);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
