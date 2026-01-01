/**
 * 批量创建用户账号脚本
 * 
 * 功能：
 * 1. 根据姓名生成用户名（拼音首字母）
 * 2. 生成易记密码
 * 3. 导入数据库
 * 4. 导出Excel
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { pinyin } from 'pinyin-pro';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

// 用户数据（从图片中提取）
const userData = [
    // 第一部分：部门
    { name: '马伶俐', department: '财政局' },
    { name: '阮扬帆', department: '综合行政执法局' },
    { name: '方仲', department: '规资局' },
    { name: '杨君', department: '环保局' },
    { name: '童佳琦', department: '交通局' },
    { name: '钱尧佳', department: '科技局' },
    { name: '冯萱', department: '民政局' },
    { name: '柳闻霞', department: '人社局' },
    { name: '王超', department: '税务局' },
    { name: '鲁瑞', department: '卫健局' },
    { name: '胡劲仙', department: '文旅局' },
    { name: '梁贤琴', department: '应急局' },
    { name: '洪丽玲', department: '商务局' },
    { name: '潘旭耀', department: '教育局' },
    { name: '金小苗', department: '经信局' },
    { name: '索玺', department: '农业农村局' },
    { name: '王卫强', department: '水利水电局' },
    { name: '练蓉蓉', department: '住建局' },
    { name: '徐莎', department: '医保分局' },
    { name: '王润谦', department: '审管办' },
    { name: '范丹玖', department: '数据局' },
    { name: '俞凌雁', department: '统计局' },
    { name: '周向荣', department: '青山湖管委会' },

    // 第二部分：乡镇
    { name: '俞梦楠', department: '锦城街道' },
    { name: '金方昊', department: '锦北' },
    { name: '高诗琪', department: '高虹' },
    { name: '韩伦', department: '锦南' },
    { name: '傅信钧', department: '玲珑' },
    { name: '徐璐鸣', department: '太湖源镇' },
    { name: '蒋锋', department: '青山湖街道' },
    { name: '张国栋', department: '板桥镇' },
    { name: '王镇', department: '於潜镇' },
    { name: '张帆', department: '潜川镇' },
    { name: '严丹', department: '天目山镇' },
    { name: '冯蕾', department: '河桥镇' },
    { name: '钟人可', department: '太阳镇' },
    { name: '徐茂峰', department: '昌化镇' },
    { name: '童涛', department: '湍口镇' },
    { name: '翁进雅', department: '清凉峰镇' },
    { name: '潘旭君', department: '龙岗镇' },
    { name: '冯政', department: '岛石镇' },
];

// 易记密码列表
const easyPasswords = [
    'Hello@123', 'Welcome#1', 'Review$88', 'Fair@2024',
    'Check#666', 'Audit@789', 'Safe$2025', 'Trust#100',
    'Good@2024', 'Best$123', 'Nice#888', 'Cool@666',
    'Work$999', 'Team@123', 'Star#777', 'Top$2024',
    'Win@8888', 'Pro#2025', 'Ace$1234', 'Go@12345',
];

// 生成用户名（拼音首字母）
function generateUsername(name: string, existingUsernames: Set<string>): string {
    // 获取每个字的拼音首字母
    const pinyinResult = pinyin(name, { pattern: 'first', toneType: 'none' });
    const letters = pinyinResult.replace(/\s/g, '').toUpperCase();

    let username: string;

    if (name.length === 2) {
        // 两字名：姓的前两个字母 + 名的首字母
        const surnameFullPinyin = pinyin(name[0], { toneType: 'none' }).toUpperCase();
        const givenNameFirst = pinyin(name[1], { pattern: 'first', toneType: 'none' }).toUpperCase();
        username = surnameFullPinyin.substring(0, 2) + givenNameFirst;
    } else {
        // 三字或更多：每个字的首字母
        username = letters.substring(0, 3);
    }

    // 处理冲突：如果用户名已存在，增加更多字母
    if (existingUsernames.has(username)) {
        // 尝试用姓的完整拼音
        const surnameFullPinyin = pinyin(name[0], { toneType: 'none' }).toUpperCase();
        const restInitials = pinyin(name.substring(1), { pattern: 'first', toneType: 'none' }).replace(/\s/g, '').toUpperCase();
        username = surnameFullPinyin.substring(0, 2) + restInitials;

        // 如果还是冲突，加数字
        let counter = 2;
        let baseUsername = username;
        while (existingUsernames.has(username)) {
            username = baseUsername + counter;
            counter++;
        }
    }

    return username;
}

// 随机选择密码
function generatePassword(): string {
    return easyPasswords[Math.floor(Math.random() * easyPasswords.length)];
}

async function main() {
    console.log('🚀 开始批量创建用户...\n');

    // 获取已存在的用户名
    const existingUsers = await prisma.user.findMany({ select: { username: true } });
    const existingUsernames = new Set(existingUsers.map(u => u.username.toUpperCase()));

    const results: Array<{
        name: string;
        department: string;
        username: string;
        password: string;
        status: string;
    }> = [];

    for (const user of userData) {
        try {
            const username = generateUsername(user.name, existingUsernames);
            const password = generatePassword();
            const hashedPassword = await bcrypt.hash(password, 10);

            // 检查用户名是否已存在
            const existing = await prisma.user.findFirst({
                where: { username: username }
            });

            // 记录 hash 后的密码用于生成 SQL
            results.push({
                name: user.name,
                department: user.department,
                username: username,
                password: password,
                hashedPassword: hashedPassword,
                status: existing ? '跳过' : '创建成功'
            });

            if (existing) {
                console.log(`⚠️ 跳过 ${user.name}：用户名 ${username} 已存在`);
                continue;
            }

            // 创建用户（本地）
            await prisma.user.create({
                data: {
                    username: username,
                    password: hashedPassword,
                    name: user.name,
                    department: user.department,
                    role: 'user',
                }
            });

            existingUsernames.add(username.toUpperCase());

            console.log(`✅ 创建成功：${user.name} -> ${username} (${user.department})`);
        } catch (error: any) {
            console.error(`❌ 创建失败 ${user.name}:`, error.message);
            results.push({
                name: user.name,
                department: user.department,
                username: '-',
                password: '-',
                status: `失败: ${error.message}`
            });
        }
    }

    // 导出到 Excel
    const worksheet = XLSX.utils.json_to_sheet(results.map(r => ({
        '姓名': r.name,
        '部门': r.department,
        '用户名': r.username,
        '初始密码': r.password,
        '状态': r.status
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '用户账号');

    // 设置列宽
    worksheet['!cols'] = [
        { wch: 10 },  // 姓名
        { wch: 18 },  // 部门
        { wch: 12 },  // 用户名
        { wch: 15 },  // 初始密码
        { wch: 15 },  // 状态
    ];

    const outputPath = path.join(process.cwd(), 'user_accounts.xlsx');
    XLSX.writeFile(workbook, outputPath);

    console.log(`\n📊 Excel 已导出到：${outputPath}`);

    // 生成 SQL 文件
    const sqlPath = path.join(process.cwd(), 'insert_users.sql');

    // 生成 SQLite 兼容的 INSERT 语句
    const sqlStatements = results
        .filter(r => r.status === '创建成功' || r.status === '跳过') // 即使本地跳过，也生成SQL以便远程执行
        .map(r => {
            const id = createId();
            const now = new Date().toISOString();
            // 简单的防注入处理（虽然我们知道输入是安全的）
            const safe = (str: string) => `'${str.replace(/'/g, "''")}'`;

            return `INSERT INTO "User" ("id", "username", "password", "name", "department", "role", "createdAt", "updatedAt") VALUES ('${id}', ${safe(r.username)}, ${safe(r.hashedPassword!)}, ${safe(r.name)}, ${safe(r.department)}, 'user', '${now}', '${now}');`;
        })
        .join('\n');

    fs.writeFileSync(sqlPath, sqlStatements);
    console.log(`\n💾 SQL 文件已导出到：${sqlPath}`);

    console.log(`\n✅ 完成！共处理 ${results.length} 个用户`);
    console.log(`   - 创建成功：${results.filter(r => r.status === '创建成功').length}`);
    console.log(`   - 跳过：${results.filter(r => r.status === '跳过').length}`);
    console.log(`   - 失败：${results.filter(r => r.status.startsWith('失败')).length}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
