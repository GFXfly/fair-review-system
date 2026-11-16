export type OrgType = 'town' | 'agency' | 'gov';

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
    town: '镇街',
    agency: '招标代理公司',
    gov: '区级部门',
};

export const TOWN_LIST = [
    '锦城街道',
    '青山湖街道',
    '玲珑街道',
    '锦南街道',
    '锦北街道',
    '板桥镇',
    '高虹镇',
    '太湖源镇',
    '於潜镇',
    '天目山镇',
    '太阳镇',
    '潜川镇',
    '昌化镇',
    '龙岗镇',
    '河桥镇',
    '湍口镇',
    '清凉峰镇',
    '岛石镇',
] as const;

export const LEGACY_TOWN_ALIASES = ['高虹街道'] as const;

export const GOV_DEPT_LIST = [
    '发改局',
    '审管办',
    '住建局',
    '交通局',
    '水利水电局',
    '农业农村局',
    '市监局',
    '财政局',
    '规资局',
    '经信局',
    '教育局',
    '科技局',
    '公安分局',
    '民政局',
    '司法局',
    '人社局',
    '环保局',
    '商务局',
    '文旅局',
    '卫健局',
    '应急局',
    '统计局',
    '医保分局',
    '综合行政执法局',
    '数据局',
    '税务局',
    '青山湖管委会',
] as const;

export function isValidOrgType(value: unknown): value is OrgType {
    return value === 'town' || value === 'agency' || value === 'gov';
}

export function isValidPhone(phone: string): boolean {
    return /^1[3-9]\d{9}$/.test(phone.trim());
}

/**
 * 校验主体类型与所属单位/公司全称
 */
export function validateDepartmentByOrgType(
    orgType: OrgType,
    department: string,
    options?: { allowLegacyTown?: boolean }
): string | null {
    const trimmed = department.trim();
    if (orgType === 'town') {
        const isStandard = (TOWN_LIST as readonly string[]).includes(trimmed);
        const isLegacy = options?.allowLegacyTown && (LEGACY_TOWN_ALIASES as readonly string[]).includes(trimmed);
        if (!isStandard && !isLegacy) {
            return '请选择有效的所属镇街';
        }
        return null;
    }
    if (orgType === 'gov') {
        if (!(GOV_DEPT_LIST as readonly string[]).includes(trimmed)) {
            return '请选择有效的区级部门';
        }
        return null;
    }
    // agency
    if (trimmed.length < 4 || trimmed.length > 64) {
        return '请输入招标代理公司全称（4-64个字符）';
    }
    return null;
}
