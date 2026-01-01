/**
 * 仅生成用户创建 SQL 语句的脚本 (本地运行)
 */

import { pinyin } from 'pinyin-pro';
import * as path from 'path';
import * as fs from 'fs';
import bcrypt from 'bcryptjs';

const XLSX = require('xlsx');

// 用户数据
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
    { name: '范丹玫', department: '数据局' }, // 修正：范丹玖 -> 范丹玫
    { name: '俞凌雁', department: '统计局' },
    { name: '周向荣', department: '青山湖管委会' },

    // 第二部分：乡镇
    { name: '俞梦楠', department: '锦城街道' },
    { name: '金方昊', department: '锦北街道' }, // 修正：加街道
    { name: '高诗琪', department: '高虹街道' }, // 修正：加街道
    { name: '韩伦', department: '锦南街道' }, // 修正：加街道
    { name: '傅信钧', department: '玲珑街道' }, // 修正：加街道
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

// 已使用的用户名集合
const usedUsernames = new Set<string>();

// 生成用户名
function generateUsername(name: string): string {
    const pinyinResult = pinyin(name, { pattern: 'first', toneType: 'none' });
    const letters = pinyinResult.replace(/\s/g, '').toUpperCase();

    let username: string;
    if (name.length === 2) {
        const surnameFullPinyin = pinyin(name[0], { toneType: 'none' }).toUpperCase();
        const givenNameFirst = pinyin(name[1], { pattern: 'first', toneType: 'none' }).toUpperCase();
        username = surnameFullPinyin.substring(0, 2) + givenNameFirst;
    } else {
        username = letters.substring(0, 3);
    }

    if (usedUsernames.has(username)) {
        // 简单冲突处理
        let counter = 2;
        let base = username;
        while (usedUsernames.has(base + counter)) {
            counter++;
        }
        username = base + counter;
    }
    usedUsernames.add(username);
    return username;
}

// 随机密码
function generatePassword(): string {
    return easyPasswords[Math.floor(Math.random() * easyPasswords.length)];
}

interface UserResult {
    name: string;
    department: string;
    username: string;
    password: string;
    hashedPassword: string;
}

async function main() {
    console.log('🚀 开始生成 SQL 和 Excel...\n');

    const results: UserResult[] = [];
    const usernamesToDelete = new Set<string>();

    // 旧的错误用户名也需要清理
    usernamesToDelete.add('FDJ');

    for (const user of userData) {
        const username = generateUsername(user.name);
        usernamesToDelete.add(username);

        const password = generatePassword();
        const hashedPassword = await bcrypt.hash(password, 10);

        results.push({
            name: user.name,
            department: user.department,
            username,
            password,
            hashedPassword
        });
    }

    // 1. 生成 SQL
    // 先生成 DELETE 语句清理旧数据
    const deleteList = Array.from(usernamesToDelete).map(u => `'${u}'`).join(', ');
    const deleteSql = `DELETE FROM "User" WHERE "username" IN (${deleteList});`;

    const insertStatements = results.map(r => {
        const now = new Date().toISOString();
        const safe = (str: string) => `'${str.replace(/'/g, "''")}'`;
        return `INSERT INTO "User" ("username", "password", "name", "department", "role", "createdAt", "updatedAt") VALUES (${safe(r.username)}, ${safe(r.hashedPassword)}, ${safe(r.name)}, ${safe(r.department)}, 'user', '${now}', '${now}');`;
    }).join('\n');

    // 加上事务
    // 注意：Prisma $executeRawUnsafe 可能不支持一次执行多条语句（视驱动而定），但 SQLite 通常允许 ; 分隔
    // 为了保险，我们不加 BEGIN/COMMIT，让 run_sql.js 逐行执行，或者 run_sql.js 逻辑我们已经改为按 ; 分割执行了。
    const fullSql = `${deleteSql}\n${insertStatements}`;

    const sqlPath = path.join(process.cwd(), 'insert_users.sql');
    fs.writeFileSync(sqlPath, fullSql);
    console.log(`✅ SQL 文件已生成：${sqlPath}`);

    // 2. 生成 Excel
    const worksheet = XLSX.utils.json_to_sheet(results.map(r => ({
        '姓名': r.name,
        '部门': r.department,
        '用户名': r.username,
        '初始密码': r.password,
        '状态': '待同步'
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '用户账号');

    // 设置列宽
    worksheet['!cols'] = [
        { wch: 10 },  // 姓名
        { wch: 20 },  // 部门 (加宽)
        { wch: 12 },  // 用户名
        { wch: 15 },  // 初始密码
        { wch: 10 },  // 状态
    ];

    const excelPath = path.join(process.cwd(), 'user_accounts.xlsx');
    XLSX.writeFile(workbook, excelPath);
    console.log(`✅ Excel 文件已生成：${excelPath}`);
}

main().catch(console.error);
