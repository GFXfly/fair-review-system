/**
 * 全站统一线性图标（1.75px 描边，24×24 视窗，currentColor）。
 * 用于替代页面中的 Emoji 图标；颜色随父元素 color 继承。
 */
import React from 'react';

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'ref'> {
    size?: number | string;
    strokeWidth?: number;
    title?: string;
}

function createIcon(displayName: string, children: React.ReactNode) {
    function Icon({ size = 16, strokeWidth = 1.75, title, ...rest }: IconProps) {
        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden={title ? undefined : true}
                role={title ? 'img' : undefined}
                focusable="false"
                {...rest}
            >
                {title ? <title>{title}</title> : null}
                {children}
            </svg>
        );
    }
    Icon.displayName = displayName;
    return Icon;
}

/** 天平印章：系统徽标 */
export const SealIcon = createIcon('SealIcon', (
    <>
        <path d="M12 3v18" />
        <path d="M7 21h10" />
        <path d="M5 7h14" />
        <path d="M12 4.5 9.5 7" />
        <path d="m12 4.5 2.5 2.5" />
        <path d="m5 7-2.5 6a3 3 0 0 0 5 0Z" />
        <path d="m19 7-2.5 6a3 3 0 0 0 5 0Z" />
    </>
));

export const ScaleLawIcon = createIcon('ScaleLawIcon', (
    <>
        <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
        <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
        <path d="M7 21h10" />
        <path d="M12 3v18" />
        <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </>
));

export const UploadDocIcon = createIcon('UploadDocIcon', (
    <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
        <path d="M14 3v5h5" />
        <path d="M12 17v-6" />
        <path d="m9.5 13.5 2.5-2.5 2.5 2.5" />
    </>
));

export const FileTextIcon = createIcon('FileTextIcon', (
    <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
        <path d="M9 9h1.5" />
    </>
));

export const FilesStackIcon = createIcon('FilesStackIcon', (
    <>
        <path d="M15.5 2H9a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V6.5Z" />
        <path d="M15 2v5h5" />
        <path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22H14" />
    </>
));

export const SearchIcon = createIcon('SearchIcon', (
    <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.6-3.6" />
    </>
));

export const CheckIcon = createIcon('CheckIcon', <path d="M20 6 9 17l-5-5" />);

export const CloseIcon = createIcon('CloseIcon', (
    <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </>
));

export const ChevronDownIcon = createIcon('ChevronDownIcon', <path d="m6 9 6 6 6-6" />);
export const ChevronUpIcon = createIcon('ChevronUpIcon', <path d="m18 15-6-6-6 6" />);
export const ChevronLeftIcon = createIcon('ChevronLeftIcon', <path d="m15 18-6-6 6-6" />);
export const ChevronRightIcon = createIcon('ChevronRightIcon', <path d="m9 18 6-6-6-6" />);

export const ArrowLeftIcon = createIcon('ArrowLeftIcon', (
    <>
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
    </>
));

export const ArrowRightIcon = createIcon('ArrowRightIcon', (
    <>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
    </>
));

export const ExternalLinkIcon = createIcon('ExternalLinkIcon', (
    <>
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>
));

export const ShieldAdminIcon = createIcon('ShieldAdminIcon', (
    <>
        <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
    </>
));

export const UserIcon = createIcon('UserIcon', (
    <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
    </>
));

export const UserCheckIcon = createIcon('UserCheckIcon', (
    <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="m16 11 2 2 4-4" />
    </>
));

export const UserPlusIcon = createIcon('UserPlusIcon', (
    <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M19 8v6" />
        <path d="M22 11h-6" />
    </>
));

export const UsersIcon = createIcon('UsersIcon', (
    <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
));

export const BuildingIcon = createIcon('BuildingIcon', (
    <>
        <path d="M3 21h18" />
        <path d="M5 21V8l7-4 7 4v13" />
        <path d="M9 21v-5h6v5" />
        <path d="M9 11h.01" />
        <path d="M15 11h.01" />
    </>
));

export const BookOpenIcon = createIcon('BookOpenIcon', (
    <>
        <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2Z" />
        <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7Z" />
    </>
));

export const DownloadIcon = createIcon('DownloadIcon', (
    <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m7 10 5 5 5-5" />
        <path d="M12 15V3" />
    </>
));

export const CopyIcon = createIcon('CopyIcon', (
    <>
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
));

export const LockIcon = createIcon('LockIcon', (
    <>
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
));

export const KeyIcon = createIcon('KeyIcon', (
    <>
        <circle cx="7.5" cy="15.5" r="4.5" />
        <path d="m10.7 12.3 9.8-9.8" />
        <path d="m17 6 3 3" />
        <path d="m14.5 8.5 2 2" />
    </>
));

export const LogOutIcon = createIcon('LogOutIcon', (
    <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
    </>
));

export const AlertTriangleIcon = createIcon('AlertTriangleIcon', (
    <>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
    </>
));

export const AlertCircleIcon = createIcon('AlertCircleIcon', (
    <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
    </>
));

export const InfoIcon = createIcon('InfoIcon', (
    <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
    </>
));

export const CheckCircleIcon = createIcon('CheckCircleIcon', (
    <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
));

export const SparklesIcon = createIcon('SparklesIcon', (
    <>
        <path d="M9.9 3.6 11 7a3 3 0 0 0 2 2l3.4 1.1a.5.5 0 0 1 0 1L13 12.2a3 3 0 0 0-2 2l-1.1 3.4a.5.5 0 0 1-1 0L7.8 14.2a3 3 0 0 0-2-2L2.4 11.1a.5.5 0 0 1 0-1L5.8 9a3 3 0 0 0 2-2l1.1-3.4a.5.5 0 0 1 1 0Z" />
        <path d="M19 3v4" />
        <path d="M21 5h-4" />
        <path d="M18 17v3" />
        <path d="M19.5 18.5h-3" />
    </>
));

export const ClockIcon = createIcon('ClockIcon', (
    <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
    </>
));

export const HistoryIcon = createIcon('HistoryIcon', (
    <>
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l4 2" />
    </>
));

export const LedgerIcon = createIcon('LedgerIcon', (
    <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8" />
        <path d="M8 11h8" />
        <path d="M8 15h5" />
    </>
));

export const EyeIcon = createIcon('EyeIcon', (
    <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
    </>
));

export const EyeOffIcon = createIcon('EyeOffIcon', (
    <>
        <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
        <path d="M14.1 14.1a3 3 0 1 1-4.2-4.2" />
        <path d="m2 2 20 20" />
    </>
));

export const PlusIcon = createIcon('PlusIcon', (
    <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
    </>
));

export const EditIcon = createIcon('EditIcon', (
    <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
));

export const TrashIcon = createIcon('TrashIcon', (
    <>
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
    </>
));

export const BanIcon = createIcon('BanIcon', (
    <>
        <circle cx="12" cy="12" r="9" />
        <path d="m5.6 5.6 12.8 12.8" />
    </>
));

export const RefreshIcon = createIcon('RefreshIcon', (
    <>
        <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
        <path d="M3 21v-5h5" />
    </>
));

export const FilterIcon = createIcon('FilterIcon', <path d="M22 3H2l8 9.46V19l4 2v-8.54Z" />);

export const MessageIcon = createIcon('MessageIcon', (
    <>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
    </>
));

export const ThumbsUpIcon = createIcon('ThumbsUpIcon', (
    <>
        <path d="M7 10v12" />
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </>
));

export const ThumbsDownIcon = createIcon('ThumbsDownIcon', (
    <>
        <path d="M17 14V2" />
        <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
    </>
));

export const GavelIcon = createIcon('GavelIcon', (
    <>
        <path d="m14 13-7.5 7.5a2.12 2.12 0 0 1-3-3L11 10" />
        <path d="m16 16 6-6" />
        <path d="m8 8 6-6" />
        <path d="m9 7 8 8" />
        <path d="m21 11-8-8" />
    </>
));

export const LightbulbIcon = createIcon('LightbulbIcon', (
    <>
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </>
));

export const QuoteIcon = createIcon('QuoteIcon', (
    <>
        <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.76-2.02-2-2H4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .01-1 1.03V20c0 1 0 1 1 1Z" />
        <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.76-2.02-2-2h-4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1Z" />
    </>
));

export const TargetIcon = createIcon('TargetIcon', (
    <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
    </>
));

export const CalendarIcon = createIcon('CalendarIcon', (
    <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4" />
        <path d="M8 2v4" />
        <path d="M3 10h18" />
    </>
));

export const MapPinIcon = createIcon('MapPinIcon', (
    <>
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
    </>
));

export const PhoneIcon = createIcon('PhoneIcon', (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
));

export const MenuGridIcon = createIcon('MenuGridIcon', (
    <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
));

export const BarChartIcon = createIcon('BarChartIcon', (
    <>
        <path d="M3 3v18h18" />
        <path d="M8 17v-5" />
        <path d="M13 17V8" />
        <path d="M18 17v-8" />
    </>
));

export const LoaderIcon = createIcon('LoaderIcon', <path d="M21 12a9 9 0 1 1-6.22-8.56" />);
