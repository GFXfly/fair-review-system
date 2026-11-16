import React from 'react';
import styles from './BrandSeal.module.css';

interface BrandSealProps {
    /** 印文，默认「审」 */
    char?: string;
    size?: number;
    /** onDark：深色底上使用（朱砂细框 + 浅色印文） */
    variant?: 'solid' | 'outline' | 'onDark';
    className?: string;
}

/** 朱砂方印徽记：细框篆意方印，内刻衬线单字 */
export default function BrandSeal({ char = '审', size = 34, variant = 'solid', className }: BrandSealProps) {
    return (
        <span
            className={`${styles.seal} ${styles[variant]} ${className || ''}`}
            style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
            aria-hidden="true"
        >
            <span className={styles.inner}>{char}</span>
        </span>
    );
}
