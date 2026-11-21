// Print manuscript/{manuscript,supplement,response_to_reviewer}.html to PDF with headless Chromium.
// Run: node scripts/17_manuscript_pdf.js
const { chromium } = require('playwright');
const path = require('path');
const dir = path.resolve(__dirname, '..', 'manuscript');
const docs = [['manuscript', 'Manuscript'], ['supplement', 'Supplementary material'], ['response_to_reviewer', 'Response to reviewer']];
(async () => {
  const b = await chromium.launch();
  for (const [f, label] of docs) {
    const p = await b.newPage();
    await p.goto('file://' + path.join(dir, f + '.html'), { waitUntil: 'load' });
    await p.waitForTimeout(1000);
    await p.addStyleTag({ content: `
      #TOC, .tocify, .col-md-3 { display: none !important; }
      .col-md-9, .toc-content, .main-container { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 4px !important; flex: 0 0 100% !important; }
      .row, .container-fluid { margin-left: 0 !important; margin-right: 0 !important; }
      body { font-size: 10.5pt; margin: 0 !important; background: #fff !important; }
      table { font-size: 8pt !important; page-break-inside: auto; }
      tr { page-break-inside: avoid; }
      td, th { padding: 2px 4px !important; }
      img { max-width: 100% !important; max-height: 245mm; height: auto !important; page-break-inside: avoid; }
      p:has(> img), .figure { page-break-inside: avoid; }
      h1, h2, h3, .caption, caption { page-break-after: avoid; }
      a[href]:after, abbr[title]:after { content: none !important; }
    `});
    await p.pdf({ path: path.join(dir, f + '.pdf'), format: 'A4', printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' },
      displayHeaderFooter: true, headerTemplate: '<span></span>',
      footerTemplate: `<div style="font-size:7pt;width:100%;text-align:center;color:#777">${label} — <span class="pageNumber"></span>/<span class="totalPages"></span></div>` });
    await p.close();
  }
  await b.close();
})();
