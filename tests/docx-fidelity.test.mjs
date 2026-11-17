import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

function loadTs(relativePath, mocks = {}, globals = {}) {
    const filename = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', relativePath);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            esModuleInterop: true,
        },
    }).outputText;
    const exports = {};
    vm.runInNewContext(
        code,
        {
            exports,
            require: id => {
                if (id in mocks) return mocks[id];
                throw new Error(`Unexpected dependency: ${id}`);
            },
            console: { log() {}, warn() {}, error() {} },
            process,
            Buffer,
            TextDecoder,
            ...globals,
        },
        { filename }
    );
    return exports;
}

test('extractTextFromFile reuses preloadedBuffer without calling file.arrayBuffer() again', async () => {
    let mammothCalls = 0;
    const { extractTextFromFile } = loadTs('src/lib/file-parser.ts', {
        mammoth: {
            convertToHtml: async ({ buffer }) => {
                mammothCalls += 1;
                assert.ok(Buffer.isBuffer(buffer));
                return { value: '<p>本招标项目要求投标人在本地设立分公司。</p>' };
            },
        },
        dompurify: createDOMPurify,
        jsdom: { JSDOM },
    });

    const preloadedBuffer = Buffer.from('mock-docx-binary');
    const mockFile = {
        name: '招标文件.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        arrayBuffer: async () => {
            throw new Error('file.arrayBuffer() must not be called when preloadedBuffer is provided');
        },
    };

    const parsed = await extractTextFromFile(mockFile, preloadedBuffer);
    assert.equal(mammothCalls, 1);
    assert.ok(parsed.text.includes('本招标项目要求投标人在本地设立分公司'));
    assert.ok(parsed.html.includes('本招标项目要求投标人在本地设立分公司'));
});

test('extractTextFromFile remains backward-compatible when preloadedBuffer is omitted', async () => {
    const { extractTextFromFile } = loadTs('src/lib/file-parser.ts', {
        mammoth: { convertToHtml: async () => ({ value: '' }) },
        dompurify: createDOMPurify,
        jsdom: { JSDOM },
    });

    let arrayBufferCalls = 0;
    const raw = Buffer.from('纯文本内容测试', 'utf8');
    const mockFile = {
        name: 'notice.txt',
        type: 'text/plain',
        arrayBuffer: async () => {
            arrayBufferCalls += 1;
            return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
        },
    };

    const parsed = await extractTextFromFile(mockFile);
    assert.equal(arrayBufferCalls, 1);
    assert.equal(parsed.text, '纯文本内容测试');
});

test('highlightTextInNode splits text nodes precisely without bolding and clearHighlights restores original DOM', () => {
    const dom = new JSDOM(
        '<div id="doc"><p id="target">第一条总则。本项目要求投标人必须在本地注册并纳税满三年，否则视为无效投标。其余条款按国家有关规定执行。</p></div>'
    );
    const { document, NodeFilter } = dom.window;

    const { highlightTextInNode, clearHighlights } = loadTs(
        'src/app/review/[id]/highlight-utils.ts',
        { './doc-utils': {} },
        { document, NodeFilter }
    );

    const container = document.getElementById('doc');
    const p = document.getElementById('target');
    const originalText = p.textContent;
    const snippet = '本项目要求投标人必须在本地注册并纳税满三年';

    const matched = highlightTextInNode(container, snippet);
    assert.equal(matched, true);

    const marks = container.querySelectorAll('mark.risk-highlight');
    assert.equal(marks.length, 1);
    assert.equal(marks[0].textContent, snippet);
    assert.equal(marks[0].style.fontWeight, '');
    assert.equal(marks[0].style.paddingLeft, '0px');
    assert.equal(marks[0].style.paddingRight, '0px');
    assert.equal(p.textContent, originalText);
    assert.equal(p.childNodes.length, 3);
    assert.equal(p.childNodes[0].textContent, '第一条总则。');
    assert.equal(p.childNodes[2].textContent, '，否则视为无效投标。其余条款按国家有关规定执行。');

    clearHighlights();
    assert.equal(container.querySelectorAll('mark.risk-highlight').length, 0);
    assert.equal(p.textContent, originalText);
    assert.equal(p.childNodes.length, 1);
});

test('highlightTextInNode handles cross-span sentence highlights and restores clean text nodes', () => {
    const dom = new JSDOM(
        '<div id="doc"><p id="multi">前文说明：<span>投标人须在</span><span>本地设立分支机构</span>才能参与评审，详情见附件。</p></div>'
    );
    const { document, NodeFilter } = dom.window;

    const { highlightTextInNode, clearHighlights } = loadTs(
        'src/app/review/[id]/highlight-utils.ts',
        { './doc-utils': {} },
        { document, NodeFilter }
    );

    const container = document.getElementById('doc');
    const p = document.getElementById('multi');
    const originalText = p.textContent;
    const snippet = '投标人须在本地设立分支机构才能参与评审';

    const matched = highlightTextInNode(container, snippet);
    assert.equal(matched, true);

    const marks = container.querySelectorAll('mark.risk-highlight');
    assert.ok(marks.length >= 2);
    const highlightedText = Array.from(marks).map(m => m.textContent).join('');
    assert.equal(highlightedText, snippet);
    for (const mark of marks) {
        assert.equal(mark.style.fontWeight, '');
    }
    assert.equal(p.textContent, originalText);

    clearHighlights();
    assert.equal(container.querySelectorAll('mark.risk-highlight').length, 0);
    assert.equal(p.textContent, originalText);
});
