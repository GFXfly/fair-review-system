'use client';

import { scan } from 'react-scan';
import { useEffect } from 'react';

export function ReactScan() {
    useEffect(() => {
        scan({
            enabled: true,
            log: false, // Set to true if you want console logs
        });
    }, []);

    return null;
}
