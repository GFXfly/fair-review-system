import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect('/');
    }

    if (user.role !== 'admin') {
        redirect('/dashboard');
    }

    return (
        <AdminClient
            currentAdmin={{
                id: user.id,
                username: user.username,
                name: user.name,
                department: user.department,
            }}
        />
    );
}
