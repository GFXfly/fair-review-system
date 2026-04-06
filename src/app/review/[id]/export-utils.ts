// src/app/review/[id]/export-utils.ts

export interface RiskItem {
    id: string;
    type: string;
    level: 'high' | 'medium';
    title: string;
    reason: string;
    suggestion?: string;
    snippet: string;
    law: string;
    case: string;
    paragraphIds?: string[];
}

export const exportReviewReport = async (
    risks: RiskItem[],
    summary: string,
    fileName: string
): Promise<void> => {
    const {
        Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
        Table, TableRow, TableCell, WidthType, BorderStyle,
    } = await import('docx');

    const tableBorders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    };

    const riskRows = risks.flatMap((risk, index) => [
        new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: `${index + 1}` })], alignment: AlignmentType.CENTER })],
                    width: { size: 5, type: WidthType.PERCENTAGE },
                    verticalAlign: 'center',
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: risk.type })], alignment: AlignmentType.CENTER })],
                    width: { size: 15, type: WidthType.PERCENTAGE },
                    verticalAlign: 'center',
                }),
                new TableCell({
                    children: [
                        new Paragraph({ children: [new TextRun({ text: risk.title, bold: true })] }),
                        new Paragraph({
                            children: [new TextRun({
                                text: `风险等级: ${risk.level === 'high' ? '高' : '中'}`,
                                color: risk.level === 'high' ? 'FF0000' : 'FFA500',
                            })],
                        }),
                    ],
                    width: { size: 25, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                    children: [
                        new Paragraph({ children: [new TextRun({ text: '【问题描述】', bold: true })] }),
                        new Paragraph({ text: risk.reason }),
                        new Paragraph({ text: '' }),
                        new Paragraph({ children: [new TextRun({ text: '【修改建议】', bold: true })] }),
                        new Paragraph({ text: risk.suggestion || '无' }),
                    ],
                    width: { size: 55, type: WidthType.PERCENTAGE },
                }),
            ],
        }),
    ]);

    const headerRow = new TableRow({
        children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '序号', bold: true })], alignment: AlignmentType.CENTER })], width: { size: 5, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '风险类型', bold: true })], alignment: AlignmentType.CENTER })], width: { size: 15, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '风险摘要', bold: true })], alignment: AlignmentType.CENTER })], width: { size: 25, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '详细说明与建议', bold: true })], alignment: AlignmentType.CENTER })], width: { size: 55, type: WidthType.PERCENTAGE } }),
        ],
        tableHeader: true,
    });

    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    text: '公平竞争审查意见书',
                    heading: HeadingLevel.TITLE,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '文件名称：', bold: true }), new TextRun(fileName)],
                    spacing: { after: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '审查日期：', bold: true }), new TextRun(new Date().toLocaleDateString())],
                    spacing: { after: 400 },
                }),
                new Paragraph({ text: '一、审查结论', heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 200 } }),
                new Paragraph({
                    text: risks.length === 0
                        ? '经审查，该文件未发现违反《公平竞争审查条例》的相关内容，符合公平竞争要求。'
                        : `经审查，该文件存在 ${risks.length} 处涉嫌违反《公平竞争审查条例》的风险点，建议修改后发布。`,
                    spacing: { after: 400 },
                }),
                new Paragraph({ text: '二、文件摘要', heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 200 } }),
                new Paragraph({ text: summary, spacing: { after: 400 } }),
                new Paragraph({ text: '三、风险点详细分析', heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 200 } }),
                risks.length > 0
                    ? new Table({ rows: [headerRow, ...riskRows], width: { size: 100, type: WidthType.PERCENTAGE }, borders: tableBorders })
                    : new Paragraph({ text: '无风险点。' }),
                new Paragraph({ text: '', spacing: { before: 800 } }),
                new Paragraph({
                    children: [new TextRun({ text: '审查单位（盖章）：__________________' })],
                    alignment: AlignmentType.RIGHT,
                    spacing: { after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '审查人签字：__________________' })],
                    alignment: AlignmentType.RIGHT,
                    spacing: { after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '日期：______年____月____日' })],
                    alignment: AlignmentType.RIGHT,
                }),
            ],
        }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName.replace(/\.[^/.]+$/, '')}_审查意见书.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
