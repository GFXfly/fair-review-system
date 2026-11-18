declare module 'pdf-parse-fork' {
    export interface PdfParseResult {
        numpages: number;
        numrender?: number;
        info?: Record<string, unknown>;
        metadata?: unknown;
        text: string;
        version?: string;
    }

    export interface PdfParseOptions {
        max?: number;
        version?: string;
    }

    function pdfParse(dataBuffer: Buffer, options?: PdfParseOptions): Promise<PdfParseResult>;
    export default pdfParse;
}
