import React from 'react';
import styles from './RiskRadar.module.css';

interface RiskAlert {
    id: string;
    message: string;
    level: 'high' | 'medium' | 'low' | 'safe';
    timestamp: string;
    department?: string;
    detail?: string;
}

interface Props {
    newAlerts?: RiskAlert[];
    variant?: 'dark' | 'light';
}

const MOCK_ALERTS: RiskAlert[] = [
    {
        id: '1',
        timestamp: '10:42',
        level: 'high',
        department: '[教育局]',
        message: '中小学食堂采购项目',
        detail: '疑似包含本地化配送服务加分项'
    },
    {
        id: '2',
        timestamp: '10:35',
        level: 'medium',
        department: '[住建局]',
        message: '某老旧小区改造招标',
        detail: '疑似设定过高资质门槛（双甲级）'
    },
    {
        id: '3',
        timestamp: '10:15',
        level: 'high',
        department: '[开发区]',
        message: '关于引入XX新能源项目的协议',
        detail: '疑似包含土地出让金全额返还承诺'
    },
    {
        id: '4',
        timestamp: '09:50',
        level: 'safe',
        department: '[卫健委]',
        message: '医疗器械采购公告',
        detail: '经审查后已修正'
    },
];

export default function RiskRadar({ newAlerts = [], variant = 'light' }: Props) {
    const displayAlerts = [...newAlerts, ...MOCK_ALERTS];

    return (
        <div className={`${styles.radarContainer} ${styles[variant]}`}>
            <div className={styles.scrollContent}>
                {displayAlerts.map((alert) => (
                    <div key={alert.id} className={`${styles.alertItem} ${styles[alert.level]}`}>
                        <div className={styles.alertHeader}>
                            <span className={styles.time}>{alert.timestamp}</span>
                            <span className={`${styles.badge} ${styles['badge' + alert.level]}`}>
                                {alert.level === 'high' ? '🔴 高风险' : alert.level === 'medium' ? '🟡 预警' : alert.level === 'safe' ? '🟢 已处置' : '🔵 关注'}
                            </span>
                            <span className={styles.department}>{alert.department}</span>
                            <span className={styles.message}>{alert.message}</span>
                        </div>
                        {alert.detail && (
                            <div className={styles.alertDetail}>
                                &gt; {alert.detail}
                            </div>
                        )}
                    </div>
                ))}
                {/* Duplicate for seamless scrolling */}
                {displayAlerts.map((alert) => (
                    <div key={`dup-${alert.id}`} className={`${styles.alertItem} ${styles[alert.level]}`}>
                        <div className={styles.alertHeader}>
                            <span className={styles.time}>{alert.timestamp}</span>
                            <span className={`${styles.badge} ${styles['badge' + alert.level]}`}>
                                {alert.level === 'high' ? '🔴 高风险' : alert.level === 'medium' ? '🟡 预警' : alert.level === 'safe' ? '🟢 已处置' : '🔵 关注'}
                            </span>
                            <span className={styles.department}>{alert.department}</span>
                            <span className={styles.message}>{alert.message}</span>
                        </div>
                        {alert.detail && (
                            <div className={styles.alertDetail}>
                                &gt; {alert.detail}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
