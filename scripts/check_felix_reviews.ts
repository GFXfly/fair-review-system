import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkFelixReviews() {
    try {
        // 1. Check Felix user
        const felix = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: 'Felix' },
                    { username: 'felix' },
                    { username: 'admin' },
                    { name: 'Felix' }
                ]
            }
        });

        console.log('=== Felix User Info ===');
        if (felix) {
            console.log(`ID: ${felix.id}`);
            console.log(`Username: ${felix.username}`);
            console.log(`Name: ${felix.name}`);
            console.log(`Role: ${felix.role}`);
            console.log(`Department: ${felix.department || 'N/A'}`);
        } else {
            console.log('❌ Felix user not found!');
            return;
        }

        // 2. Check all review records
        const allReviews = await prisma.reviewRecord.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        role: true
                    }
                },
                risks: true
            }
        });

        console.log('\n=== All Review Records ===');
        console.log(`Total records: ${allReviews.length}`);

        // 3. Check Felix's reviews
        const felixReviews = allReviews.filter(r => r.userId === felix.id);
        console.log(`\n=== Felix's Reviews (userId=${felix.id}) ===`);
        console.log(`Count: ${felixReviews.length}`);

        if (felixReviews.length > 0) {
            felixReviews.forEach((review, idx) => {
                console.log(`\n${idx + 1}. ID: ${review.id}`);
                console.log(`   File: ${review.fileName}`);
                console.log(`   Status: ${review.status}`);
                console.log(`   Risks: ${review.risks.length}`);
                console.log(`   Created: ${review.createdAt}`);
            });
        } else {
            console.log('⚠️  No reviews found for Felix');
        }

        // 4. Show all reviews by user
        console.log('\n=== Reviews by User ===');
        const reviewsByUser = allReviews.reduce((acc, review) => {
            const userName = review.user?.name || `Unknown (ID: ${review.userId})`;
            if (!acc[userName]) {
                acc[userName] = [];
            }
            acc[userName].push(review);
            return acc;
        }, {} as Record<string, any[]>);

        Object.entries(reviewsByUser).forEach(([userName, reviews]) => {
            console.log(`\n${userName}: ${reviews.length} records`);
            reviews.slice(0, 3).forEach(r => {
                console.log(`  - ${r.fileName} (${r.status}, ${r.risks.length} risks)`);
            });
            if (reviews.length > 3) {
                console.log(`  ... and ${reviews.length - 3} more`);
            }
        });

        // 5. Check if there are orphaned reviews (user deleted)
        const orphanedReviews = allReviews.filter(r => !r.user);
        if (orphanedReviews.length > 0) {
            console.log(`\n⚠️  Found ${orphanedReviews.length} orphaned reviews (user deleted):`);
            orphanedReviews.forEach(r => {
                console.log(`  - ${r.fileName} (userId: ${r.userId})`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkFelixReviews();
