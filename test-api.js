// Test API endpoint for admin reviews
// Run this in browser console or use curl

async function testAdminReviewsAPI() {
    try {
        console.log('Testing /api/reviews?mode=admin...');
        const response = await fetch('/api/reviews?mode=admin', {
            cache: 'no-store'
        });

        console.log('Status:', response.status);

        if (!response.ok) {
            const error = await response.json();
            console.error('Error:', error);
            return;
        }

        const data = await response.json();
        console.log('Total reviews:', data.length);
        console.log('Reviews:', data);

        // Group by user
        const byUser = data.reduce((acc, review) => {
            const userName = review.user?.name || 'Unknown';
            if (!acc[userName]) acc[userName] = 0;
            acc[userName]++;
            return acc;
        }, {});

        console.log('By user:', byUser);

        return data;
    } catch (error) {
        console.error('Failed to test API:', error);
    }
}

// Test regular endpoint
async function testRegularReviewsAPI() {
    try {
        console.log('Testing /api/reviews...');
        const response = await fetch('/api/reviews', {
            cache: 'no-store'
        });

        console.log('Status:', response.status);

        if (!response.ok) {
            const error = await response.json();
            console.error('Error:', error);
            return;
        }

        const data = await response.json();
        console.log('Total reviews:', data.length);
        console.log('Reviews:', data);

        return data;
    } catch (error) {
        console.error('Failed to test API:', error);
    }
}

console.log('Run testAdminReviewsAPI() or testRegularReviewsAPI() in console');
