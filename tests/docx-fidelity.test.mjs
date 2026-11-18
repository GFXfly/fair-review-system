import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');

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

    const zip = new JSZip();
    zip.file('word/document.xml', '<w:document/>');
    const preloadedBuffer = await zip.generateAsync({ type: 'nodebuffer' });
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

test('extractChineseDocxParagraphHints extracts charScaleX, letterSpacing, vector red rule and TOC hints from docx', async () => {
    const zip = new JSZip();
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r>
        <w:rPr><w:w w:val="66"/><w:spacing w:val="-20"/></w:rPr>
        <w:t>某某省人民政府文件</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r><w:t>某政发〔2026〕18号</w:t></w:r>
      <w:r>
        <w:drawing>
          <wp:inline>
            <wp:extent cx="5400000" cy="28575"/>
            <a:graphic>
              <a:graphicData>
                <a:ln w="28575">
                  <a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>
                </a:ln>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:drawing>
          <wp:inline>
            <a:graphic>
              <a:graphicData>
                <a:blip r:embed="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                <a:ln w="28575"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:ln>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
      <w:r><w:t>带位图段落</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tr><w:tc><w:p><w:r><w:t>表格内忽略段落</w:t></w:r></w:p></w:tc></w:tr>
    </w:tbl>
    <w:sdt>
      <w:sdtContent>
        <w:p>
          <w:pPr>
            <w:pStyle w:val="TOC1"/>
            <w:tabs><w:tab w:val="right" w:leader="dot" w:pos="8300"/></w:tabs>
          </w:pPr>
          <w:hyperlink w:anchor="_Toc1">
            <w:r><w:t>第一章 招标公告</w:t></w:r>
            <w:r><w:tab/></w:r>
            <w:r><w:t>1</w:t></w:r>
          </w:hyperlink>
        </w:p>
      </w:sdtContent>
    </w:sdt>
    <w:p>
      <w:r><w:t>正文要求投标人必须具备本地注册资质。</w:t></w:r>
      <w:r>
        <w:pict>
          <v:textbox><w:txbxContent><w:p><w:r><w:t>文本框忽略</w:t></w:r></w:p></w:txbxContent></v:textbox>
        </w:pict>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

    zip.file('word/document.xml', documentXml);
    const docxUint8 = await zip.generateAsync({ type: 'uint8array' });

    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const { extractChineseDocxParagraphHints } = loadTs('src/app/review/[id]/docx-enhance.ts', {
        jszip: JSZip,
    });

    const hints = await extractChineseDocxParagraphHints(docxUint8, {
        domParser: new dom.window.DOMParser(),
    });

    assert.equal(hints.length, 5);

    // 1. 红头大标题
    assert.equal(hints[0].plainText, '某某省人民政府文件');
    assert.equal(hints[0].minCharScaleX, 0.66);
    assert.equal(hints[0].maxCharScaleX, 0.66);
    assert.deepEqual(Array.from(hints[0].runLetterSpacingsPt), [-1]);

    // 2. 发文字号 + 纯矢量红线
    assert.equal(hints[1].plainText, '某政发〔2026〕18号');
    assert.equal(hints[1].hasRedHorizontalRule, true);
    assert.equal(hints[1].redRuleColor, '#FF0000');
    assert.equal(hints[1].redRuleWidthPt, 2.25);

    // 3. 含 a:blip 位图图片不应误判为纯矢量红线
    assert.equal(hints[2].hasRedHorizontalRule, false);

    // 4. sdtContent 展开的 TOC 目录段落
    assert.equal(hints[3].plainText, '第一章 招标公告1');
    assert.equal(hints[3].isTocStyle, true);
    assert.equal(hints[3].hasRightLeaderTab, true);

    // 5. 正文（排除了 table 与 txbxContent 内部段落）
    assert.equal(hints[4].plainText, '正文要求投标人必须具备本地注册资质。');
});

test('enhanceRenderedDocxDom restores redhead scale, red rule, and elastic TOC rows while preserving highlightTextInNode', () => {
    const dom = new JSDOM(`
        <div id="docx-root">
          <section class="docx">
            <p id="p-redhead" style="text-align: center; font-size: 36pt; color: rgb(255, 0, 0);">
              <span>某某省人民政府文件</span>
            </p>
            <p id="p-docno" style="text-align: center;">
              <span>某政发〔2026〕18号</span>
            </p>
            <p id="p-toc-title" style="text-align: center;">目  录</p>
            <p id="p-toc-link" class="docx-toc1">
              <a href="#_Toc1"><span>第一章 招标公告</span><span class="docx-tab-stop" style="word-spacing: 380pt; text-decoration: underline dotted;">&nbsp;</span><span>1</span></a>
            </p>
            <p id="p-toc-plain" style="margin-left: 16pt;"><span>1.1 项目概况与招标范围</span><span><span class="docx-tab-stop" style="word-spacing: 340pt; text-decoration: underline dotted;">&nbsp;</span></span><span>12</span></p>
            <p id="p-body">
              <span>本项目要求投标人在本地设立分公司方可参与投标。</span>
            </p>
          </section>
        </div>
    `);
    const { document, NodeFilter } = dom.window;

    const { enhanceRenderedDocxDom } = loadTs('src/app/review/[id]/docx-enhance.ts', {
        jszip: JSZip,
    });
    const { highlightTextInNode, clearHighlights } = loadTs(
        'src/app/review/[id]/highlight-utils.ts',
        { './doc-utils': {} },
        { document, NodeFilter }
    );

    const hints = [
        {
            index: 0,
            plainText: '某某省人民政府文件',
            maxCharScaleX: 0.66,
            minCharScaleX: 0.66,
            runCharScales: [0.66],
            runLetterSpacingsPt: [-1],
            runs: [{ text: '某某省人民政府文件', charScaleX: 0.66, letterSpacingPt: -1 }],
            hasRedHorizontalRule: false,
            redRuleColor: null,
            redRuleWidthPt: null,
            isTocStyle: false,
            hasRightLeaderTab: false,
        },
        {
            index: 1,
            plainText: '某政发〔2026〕18号',
            maxCharScaleX: null,
            minCharScaleX: null,
            runCharScales: [null],
            runLetterSpacingsPt: [null],
            hasRedHorizontalRule: true,
            redRuleColor: '#FF0000',
            redRuleWidthPt: 2.25,
            isTocStyle: false,
            hasRightLeaderTab: false,
        },
        {
            index: 2,
            plainText: '目  录',
            maxCharScaleX: null,
            minCharScaleX: null,
            runCharScales: [null],
            runLetterSpacingsPt: [null],
            hasRedHorizontalRule: false,
            redRuleColor: null,
            redRuleWidthPt: null,
            isTocStyle: false,
            hasRightLeaderTab: false,
        },
        {
            index: 3,
            plainText: '第一章 招标公告1',
            maxCharScaleX: null,
            minCharScaleX: null,
            runCharScales: [null],
            runLetterSpacingsPt: [null],
            hasRedHorizontalRule: false,
            redRuleColor: null,
            redRuleWidthPt: null,
            isTocStyle: true,
            hasRightLeaderTab: true,
        },
        {
            index: 4,
            plainText: '1.1 项目概况与招标范围12',
            maxCharScaleX: null,
            minCharScaleX: null,
            runCharScales: [null],
            runLetterSpacingsPt: [null],
            hasRedHorizontalRule: false,
            redRuleColor: null,
            redRuleWidthPt: null,
            isTocStyle: false,
            hasRightLeaderTab: true,
        },
        {
            index: 5,
            plainText: '本项目要求投标人在本地设立分公司方可参与投标。',
            maxCharScaleX: null,
            minCharScaleX: null,
            runCharScales: [null],
            runLetterSpacingsPt: [null],
            hasRedHorizontalRule: false,
            redRuleColor: null,
            redRuleWidthPt: null,
            isTocStyle: false,
            hasRightLeaderTab: false,
        },
    ];

    const root = document.getElementById('docx-root');
    enhanceRenderedDocxDom(root, hints);

    // 1. 红头断言
    const pRedhead = document.getElementById('p-redhead');
    const scaleWrapper = pRedhead.querySelector('.docx-redhead-scale');
    assert.ok(scaleWrapper);
    assert.ok(scaleWrapper.style.transform.includes('scaleX(0.66)'));
    assert.equal(scaleWrapper.style.flexShrink, '0');
    assert.equal(scaleWrapper.style.whiteSpace, 'nowrap');
    assert.equal(pRedhead.style.display, 'flex');
    assert.equal(pRedhead.style.justifyContent, 'center');
    const innerRedheadSpan = scaleWrapper.querySelector('span');
    assert.equal(innerRedheadSpan.style.letterSpacing, '-1pt');
    assert.equal(innerRedheadSpan.style.whiteSpace, 'nowrap');

    // 2. 发文字号红横线断言
    const pDocNo = document.getElementById('p-docno');
    assert.ok(pDocNo.style.borderBottom.includes('2.25pt'));
    assert.ok(
        pDocNo.style.borderBottom.toLowerCase().includes('rgb(255, 0, 0)') ||
        pDocNo.style.borderBottom.toUpperCase().includes('#FF0000')
    );

    // 3. “目 录”标题不应被误转为三段式
    const pTocTitle = document.getElementById('p-toc-title');
    assert.equal(pTocTitle.classList.contains('docx-toc-row'), false);

    // 4. 带 <a> 的目录行三段式断言
    const pTocLink = document.getElementById('p-toc-link');
    const anchor = pTocLink.querySelector('a');
    assert.ok(anchor.classList.contains('docx-toc-row'));
    const linkTitle = anchor.querySelector('.docx-toc-title');
    const linkLeader = anchor.querySelector('.docx-toc-leader');
    const linkPage = anchor.querySelector('.docx-toc-page');
    assert.ok(linkTitle && linkLeader && linkPage);
    assert.equal(linkTitle.textContent, '第一章 招标公告');
    assert.equal(linkPage.textContent, '1');
    assert.equal(linkLeader.style.wordSpacing, '0');
    assert.equal(linkLeader.textContent, '');

    // 5. 不带 <a> 且 tab 包在 run span 内的普通目录行三段式断言
    const pTocPlain = document.getElementById('p-toc-plain');
    assert.ok(pTocPlain.classList.contains('docx-toc-row'));
    assert.equal(pTocPlain.style.marginLeft, '16pt');
    const plainTitle = pTocPlain.querySelector('.docx-toc-title');
    const plainLeader = pTocPlain.querySelector('.docx-toc-leader');
    const plainPage = pTocPlain.querySelector('.docx-toc-page');
    assert.ok(plainTitle && plainLeader && plainPage);
    assert.equal(plainTitle.textContent, '1.1 项目概况与招标范围');
    assert.equal(plainPage.textContent, '12');
    assert.equal(plainLeader.style.wordSpacing, '0');

    // 6. highlightTextInNode 在增强后的目录行与正文上依然正常工作
    assert.equal(highlightTextInNode(root, '项目概况与招标范围'), true);
    assert.equal(root.querySelectorAll('mark.risk-highlight').length, 1);
    clearHighlights();
    assert.equal(highlightTextInNode(root, '投标人在本地设立分公司'), true);
    assert.equal(root.querySelectorAll('mark.risk-highlight').length, 1);
    clearHighlights();
});

test('extractChineseDocxParagraphHints supports styles.xml TOC mapping and VML red line', async () => {
    const zip = new JSZip();
    zip.file(
        'word/styles.xml',
        `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="a5">
    <w:name w:val="toc 1"/>
  </w:style>
</w:styles>`
    );
    zip.file(
        'word/document.xml',
        `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:v="urn:schemas-microsoft-com:vml">
  <w:body>
    <w:p>
      <w:r><w:t>市发改委〔2026〕1号</w:t></w:r>
      <w:r><w:pict><v:line strokecolor="#D40000" strokeweight="2.25pt"/></w:pict></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="a5"/></w:pPr>
      <w:r><w:t>第一部分 竞争性磋商公告</w:t><w:tab/><w:t>3</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`
    );
    const docxUint8 = await zip.generateAsync({ type: 'uint8array' });
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const { extractChineseDocxParagraphHints } = loadTs('src/app/review/[id]/docx-enhance.ts', {
        jszip: JSZip,
    });
    const hints = await extractChineseDocxParagraphHints(docxUint8, {
        domParser: new dom.window.DOMParser(),
    });
    assert.equal(hints.length, 2);
    assert.equal(hints[0].hasRedHorizontalRule, true);
    assert.equal(hints[0].redRuleColor, '#D40000');
    assert.equal(hints[0].redRuleWidthPt, 2.25);
    assert.equal(hints[1].isTocStyle, true);
});

test('enhanceRenderedDocxDom auto-scales overflowing redhead title when <w:w> is absent', () => {
    const dom = new JSDOM(`
        <div id="docx-root">
          <section class="docx">
            <p id="p-auto-redhead" style="text-align: center; font-size: 36pt; line-height: 44px; color: rgb(212, 0, 0);">
              <span>某某市市场监督管理局办公室文件</span>
            </p>
          </section>
        </div>
    `);
    const { document } = dom.window;
    const p = document.getElementById('p-auto-redhead');
    Object.defineProperty(p, 'clientHeight', { value: 92, configurable: true });
    Object.defineProperty(p, 'clientWidth', { value: 600, configurable: true });

    const origCreateElement = document.createElement.bind(document);
    document.createElement = tagName => {
        const el = origCreateElement(tagName);
        if (String(tagName).toLowerCase() === 'span') {
            Object.defineProperty(el, 'scrollWidth', { value: 800, configurable: true });
        }
        return el;
    };

    const { enhanceRenderedDocxDom } = loadTs('src/app/review/[id]/docx-enhance.ts', {
        jszip: JSZip,
    });
    enhanceRenderedDocxDom(document.getElementById('docx-root'), []);

    const wrapper = p.querySelector('.docx-redhead-scale');
    assert.ok(wrapper);
    assert.equal(wrapper.style.transform, 'scaleX(0.750)');
    assert.equal(wrapper.style.flexShrink, '0');
    assert.equal(wrapper.style.whiteSpace, 'nowrap');
    assert.equal(wrapper.querySelector('span').style.whiteSpace, 'nowrap');
    assert.equal(p.style.display, 'flex');
    assert.equal(p.style.justifyContent, 'center');
});

test('enhanceRenderedDocxDom upgrades plain text \\t TOC paragraphs without harming normal \\t paragraphs', () => {
    const dom = new JSDOM(`
        <div id="docx-root">
          <section class="docx">
            <p id="p-toc-text-tab" class="docx-toc1"><span>第一章 招标公告\t1</span></p>
            <p id="p-toc-tail-tab"><span>1.2 投标人资格要求</span><span>\t42</span></p>
            <p id="p-normal-tab"><span>普通段落说明\t仅供参考</span></p>
          </section>
        </div>
    `);
    const { document } = dom.window;

    const { enhanceRenderedDocxDom } = loadTs('src/app/review/[id]/docx-enhance.ts', {
        jszip: JSZip,
    });

    const root = document.getElementById('docx-root');
    enhanceRenderedDocxDom(root, []);

    const p1 = document.getElementById('p-toc-text-tab');
    assert.ok(p1.classList.contains('docx-toc-row'));
    assert.equal(p1.querySelector('.docx-toc-title').textContent, '第一章 招标公告');
    assert.equal(p1.querySelector('.docx-toc-page').textContent, '1');
    assert.ok(p1.querySelector('.docx-toc-leader'));

    const p2 = document.getElementById('p-toc-tail-tab');
    assert.ok(p2.classList.contains('docx-toc-row'));
    assert.equal(p2.querySelector('.docx-toc-title').textContent, '1.2 投标人资格要求');
    assert.equal(p2.querySelector('.docx-toc-page').textContent, '42');

    const pNormal = document.getElementById('p-normal-tab');
    assert.equal(pNormal.classList.contains('docx-toc-row'), false);
    assert.equal(pNormal.querySelector('.docx-tab-stop'), null);
    assert.equal(pNormal.textContent, '普通段落说明\t仅供参考');
});
