import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkReviewRecordsStructure() {
    try {
        console.log('=== Checking ReviewRecord Structure ===\n');

        // Get a sample record to check its structure
        const sampleRecord = await prisma.reviewRecord.findFirst({
            include: {
                risks: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        role: true,
                        department: true
                    }
                }
            }
        });

        if (sampleRecord) {
            console.log('Sample record fields:');
            console.log(JSON.stringify(sampleRecord, null, 2));

            console.log('\n=== Field Analysis ===');
            console.log(`Has riskCount field: ${sampleRecord.hasOwnProperty('riskCount')}`);
            console.log(`riskCount value: ${(sampleRecord as any).riskCount}`);
            console.log(`Actual risks array length: ${sampleRecord.risks.length}`);
            console.log(`Has user relation: ${!!sampleRecord.user}`);
            if (sampleRecord.user) {
                console.log(`User info: ${sampleRecord.user.name} (${sampleRecord.user.role})`);
            }
        }

        // Check records for admin user (ID 1)
        console.log('\n=== Admin User Records (Take 50, Ordered by createdAt DESC) ===');
        const adminRecords = await prisma.reviewRecord.findMany({
            take: 50,
            where: {}, // Empty where clause (admin mode)
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                risks: true,
                user: {
                    select: {
                        name: true,
                        department: true
                    }
                }
            }
        });

        console.log(`Total records returned: ${adminRecords.length}`);
        console.log('\nFirst 5 records:');
        adminRecords.slice(0, 5).forEach((record, idx) => {
            console.log(`\n${idx + 1}. ${record.fileName}`);
            console.log(`   ID: ${record.id}`);
            console.log(`   Status: ${record.status}`);
            console.log(`   Risks: ${record.risks.length}`);
            console.log(`   User: ${record.user?.name || 'Unknown'} (${record.user?.department || 'N/A'})`);
            console.log(`   Created: ${record.createdAt.toLocaleString()}`);
        });

        // Group by user
        console.log('\n=== Records by User ===');
        const byUser: Record<string, number> = {};
        adminRecords.forEach(record => {
            const userName = record.user?.name || 'Unknown';
            byUser[userName] = (byUser[userName] || 0) + 1;
        });

        Object.entries(byUser).forEach(([name, count]) => {
            console.log(`${name}: ${count} records`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkReviewRecordsStructure();
