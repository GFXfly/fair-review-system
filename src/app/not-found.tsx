import Link from 'next/link';
import BrandSeal from '@/components/ui/BrandSeal';
import kit from '@/components/ui/kit.module.css';
import { ArrowLeftIcon } from '@/components/ui/Icons';

export default function NotFound() {
    return (
        <main
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                padding: 24,
                background: 'var(--bg-canvas)',
                textAlign: 'center',
            }}
        >
            <BrandSeal char="缺" size={52} variant="outline" />
            <div className="mono" style={{ fontSize: 13, letterSpacing: '0.2em', color: 'var(--ink-4)' }}>404</div>
            <h1 className={kit.serifTitle} style={{ margin: 0, fontSize: 24 }}>未找到该页面或卷宗</h1>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-3)' }}>
                链接可能已失效，或相关记录已被删除。
            </p>
            <Link href="/dashboard" className={`${kit.btn} ${kit.btnSecondary}`} style={{ marginTop: 8 }}>
                <ArrowLeftIcon size={15} />
                返回审查工作台
            </Link>
        </main>
    );
}
