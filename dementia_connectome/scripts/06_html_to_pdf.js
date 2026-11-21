// Print analysis.html to analysis.pdf with headless Chromium (Playwright). Run: node scripts/06_html_to_pdf.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file:///home/user/Studio/dementia_connectome/analysis.html', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await p.addStyleTag({ content: `
    #TOC, .tocify, .toc-content + div:empty { display: none !important; }
    .col-md-3 { display: none !important; }
    .col-md-9, .toc-content, .main-container { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; flex: 0 0 100% !important; }
    body { font-size: 10.5pt; margin: 0 !important; }
    .row, .container-fluid, .main-container { margin-left: 0 !important; margin-right: 0 !important; }
    .col-md-9, .toc-content { padding-left: 4px !important; padding-right: 4px !important; }
    .main-container { max-width: none !important; }
    pre, pre code { white-space: pre-wrap !important; word-break: break-word; font-size: 7.5pt !important; }
    table { font-size: 8pt !important; display: block; overflow: visible; }
    td, th { padding: 2px 4px !important; }
    img { max-width: 100% !important; height: auto !important; page-break-inside: avoid; }
    h1 { page-break-before: auto; }
    h1, h2, h3 { page-break-after: avoid; }
  `});
  await p.pdf({ path: '/home/user/Studio/dementia_connectome/analysis.pdf', format: 'A4', printBackground: true,
                margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
                displayHeaderFooter: true, headerTemplate: '<span></span>',
                footerTemplate: '<div style="font-size:7pt;width:100%;text-align:center;color:#777">Dementia atrophy networks — <span class="pageNumber"></span>/<span class="totalPages"></span></div>' });
  await b.close();
})();
