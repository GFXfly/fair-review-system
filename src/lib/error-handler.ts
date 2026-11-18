/**
 * 错误处理工具
 * 将技术错误转换为用户友好的提示信息
 */

export interface UserFriendlyError {
    title: string;           // 错误标题
    message: string;         // 用户友好的错误描述
    suggestion?: string;     // 解决建议
    technicalDetails?: string; // 技术细节（可选，用于调试）
}

/**
 * 将错误转换为用户友好的格式
 */
export function formatError(error: any, context?: string): UserFriendlyError {
    const errorMessage = error?.message || String(error);

    // 数据库错误
    if (errorMessage.includes('Prisma') || errorMessage.includes('database')) {
        if (errorMessage.includes('Unique constraint')) {
            return {
                title: '数据重复',
                message: '该记录已存在，请检查是否重复操作。',
                suggestion: '如果需要修改现有记录，请先删除或编辑原记录。',
                technicalDetails: errorMessage
            };
        }
        if (errorMessage.includes('Foreign key constraint')) {
            return {
                title: '数据关联错误',
                message: '无法完成操作，因为存在关联的数据。',
                suggestion: '请先删除或解除相关联的数据。',
                technicalDetails: errorMessage
            };
        }
        if (errorMessage.includes('database is locked')) {
            return {
                title: '系统繁忙',
                message: '系统当前正在处理其他请求，请稍后重试。',
                suggestion: '等待几秒后再次尝试操作。',
                technicalDetails: errorMessage
            };
        }
        return {
            title: '数据库错误',
            message: '数据存储服务暂时不可用。',
            suggestion: '请稍后重试，如果问题持续请联系系统管理员。',
            technicalDetails: errorMessage
        };
    }

    // LLM API 错误
    if (errorMessage.includes('API') || errorMessage.includes('LLM') || errorMessage.includes('deepseek') || errorMessage.includes('siliconflow')) {
        if (errorMessage.includes('401') || errorMessage.includes('Authentication')) {
            return {
                title: 'AI服务配置错误',
                message: 'AI分析服务的密钥配置有误。',
                suggestion: '请联系系统管理员检查API密钥配置。',
                technicalDetails: errorMessage
            };
        }
        if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
            return {
                title: 'AI服务繁忙',
                message: 'AI分析请求过于频繁，已达到服务限制。',
                suggestion: '请等待几分钟后再次尝试。',
                technicalDetails: errorMessage
            };
        }
        if (errorMessage.includes('timeout')) {
            return {
                title: 'AI服务超时',
                message: 'AI分析服务响应超时。',
                suggestion: '文件可能过大或内容复杂，请尝试精简文件后重新上传。',
                technicalDetails: errorMessage
            };
        }
        if (errorMessage.includes('not set') || errorMessage.includes('not configured')) {
            return {
                title: 'AI服务未配置',
                message: 'AI分析服务尚未正确配置。',
                suggestion: '请联系系统管理员配置环境变量。',
                technicalDetails: errorMessage
            };
        }
        return {
            title: 'AI分析服务异常',
            message: 'AI分析服务暂时不可用。',
            suggestion: '请稍后重试，如果问题持续请联系系统管理员。',
            technicalDetails: errorMessage
        };
    }

    // 文件处理错误
    if (
        errorMessage.includes('file') ||
        errorMessage.includes('文件') ||
        errorMessage.includes('PDF') ||
        errorMessage.includes('图片扫描件') ||
        errorMessage.includes('压缩炸弹') ||
        context?.includes('file') ||
        context?.includes('文件')
    ) {
        if (errorMessage.includes('图片扫描件')) {
            return {
                title: '暂不支持图片扫描件 PDF',
                message: errorMessage,
                suggestion: '请使用 Word / WPS 打开原稿直接导出或另存为电子文字版 PDF（确保文字可选中），或直接上传 .docx 源文件。',
                technicalDetails: errorMessage
            };
        }
        if (errorMessage.includes('密码加密')) {
            return {
                title: 'PDF 文档受密码保护',
                message: errorMessage,
                suggestion: '请先解除文档密码保护，或上传未加密的 .docx / 电子文字版 .pdf 源文件。',
                technicalDetails: errorMessage
            };
        }
        if (errorMessage.includes('文件头格式校验失败')) {
            return {
                title: '文件格式校验失败',
                message: errorMessage,
                suggestion: '请确认文件扩展名与实际格式一致，勿直接修改文件后缀，建议使用 Word / WPS 重新导出。',
                technicalDetails: errorMessage
            };
        }
        if (errorMessage.includes('体积异常') || errorMessage.includes('压缩炸弹')) {
            return {
                title: '文件安全校验未通过',
                message: errorMessage,
                suggestion: '请检查文档内是否包含异常超大对象或损坏的压缩结构，可尝试另存为新文档后重新上传。',
                technicalDetails: errorMessage
            };
        }
        if (errorMessage.includes('not supported') || errorMessage.includes('不支持')) {
            return {
                title: '文件格式不支持',
                message: '该文件格式无法识别。',
                suggestion: '目前支持 .docx（Word）、电子文字版 .pdf 及 .txt（纯文本）格式。请转换文件格式后重新上传。',
                technicalDetails: errorMessage
            };
        }
        if (errorMessage.includes('parse') || errorMessage.includes('解析')) {
            return {
                title: '文件解析失败',
                message: '无法读取文件内容，文件可能已损坏或格式不正确。',
                suggestion: '请尝试：\n1. 用 Word/WPS 重新打开并另存为 .docx 或导出电子文字版 .pdf\n2. 检查文件是否加密或受保护\n3. 尝试上传纯文本版本',
                technicalDetails: errorMessage
            };
        }
        if (errorMessage.includes('size') || errorMessage.includes('大小')) {
            return {
                title: '文件过大',
                message: '上传的文件超过大小限制。',
                suggestion: '请确保文件小于 50MB，或压缩内嵌图片、精简文件内容后重新上传。',
                technicalDetails: errorMessage
            };
        }
        return {
            title: '文件处理错误',
            message: '处理文件时遇到问题。',
            suggestion: '请检查文件是否完整且格式正确。',
            technicalDetails: errorMessage
        };
    }

    // 认证错误
    if (errorMessage.includes('auth') || errorMessage.includes('认证') || errorMessage.includes('Unauthorized')) {
        return {
            title: '身份验证失败',
            message: '您的登录状态已过期或无效。',
            suggestion: '请重新登录后再试。',
            technicalDetails: errorMessage
        };
    }

    // 权限错误
    if (errorMessage.includes('permission') || errorMessage.includes('权限') || errorMessage.includes('Forbidden')) {
        return {
            title: '权限不足',
            message: '您没有执行此操作的权限。',
            suggestion: '如需访问此功能，请联系管理员申请相应权限。',
            technicalDetails: errorMessage
        };
    }

    // 网络错误
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED')) {
        return {
            title: '网络连接错误',
            message: '无法连接到服务器。',
            suggestion: '请检查您的网络连接，或稍后重试。',
            technicalDetails: errorMessage
        };
    }

    // 通用错误
    return {
        title: context ? `${context}失败` : '操作失败',
        message: '系统遇到了一个未预期的错误。',
        suggestion: '请稍后重试，如果问题持续请联系系统管理员并提供以下技术信息。',
        technicalDetails: errorMessage
    };
}

/**
 * 获取简化的错误消息（用于简短提示）
 */
export function getSimpleErrorMessage(error: any): string {
    const formatted = formatError(error);
    return formatted.message;
}

/**
 * 获取完整的错误信息（用于详细提示）
 */
export function getDetailedErrorMessage(error: any, context?: string): string {
    const formatted = formatError(error, context);
    let message = `${formatted.title}\n\n${formatted.message}`;

    if (formatted.suggestion) {
        message += `\n\n建议：\n${formatted.suggestion}`;
    }

    return message;
}

/**
 * 创建 API 错误响应
 */
export function createErrorResponse(error: any, context?: string) {
    const formatted = formatError(error, context);

    return {
        error: formatted.title,
        message: formatted.message,
        suggestion: formatted.suggestion,
        // 只在开发环境返回技术细节
        ...(process.env.NODE_ENV === 'development' && {
            technicalDetails: formatted.technicalDetails
        })
    };
}
