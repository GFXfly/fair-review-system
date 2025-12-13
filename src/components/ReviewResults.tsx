import React from 'react';
import styles from './ReviewResults.module.css';

interface ReviewResult {
    quote: string;
    risk_level: 'High' | 'Medium' | 'Low';
    risk_tags?: string[];
    citation: string;
    similar_case?: string;
    reason: string;
    suggestion: string;
}

interface Props {
    results: ReviewResult[];
}

export default function ReviewResults({ results }: Props) {
    if (!results || results.length === 0) {
        return null;
    }

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>审查结果详情</h3>
            <div className={styles.list}>
                {results.map((item, index) => (
                    <div key={index} className={`${styles.card} ${styles[item.risk_level.toLowerCase()]}`}>
                        <div className={styles.header}>
                            <span className={`${styles.badge} ${styles['badge' + item.risk_level]}`}>
                                {item.risk_level === 'High' ? '高风险' : item.risk_level === 'Medium' ? '需关注' : '低风险'}
                            </span>
                            {item.risk_tags && item.risk_tags.map(tag => (
                                <span key={tag} className={styles.tag}>{tag}</span>
                            ))}
                        </div>

                        <div className={styles.section}>
                            <span className={styles.label}>原文片段：</span>
                            <blockquote className={styles.quote}>“{item.quote}”</blockquote>
                        </div>

                        <div className={styles.section}>
                            <span className={styles.label}>风险分析：</span>
                            <p className={styles.reason}>{item.reason}</p>
                        </div>

                        {item.similar_case && (
                            <div className={styles.section}>
                                <span className={styles.label}>相似案例：</span>
                                <p className={styles.case}>{item.similar_case}</p>
                            </div>
                        )}

                        <div className={styles.section}>
                            <span className={styles.label}>法规依据：</span>
                            <p className={styles.citation}>{item.citation}</p>
                        </div>

                        <div className={`${styles.section} ${styles.suggestionBox}`}>
                            <span className={styles.label}>修改建议：</span>
                            <p className={styles.suggestion}>{item.suggestion}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
