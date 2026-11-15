/**
 * PDF 產生服務（第一階段：瀏覽器端）。
 * 把報告的每個 .pdf-block 轉成影像後依序排入 A4 頁面，區塊不足一頁時不會被切斷。
 * 中文字由瀏覽器以系統字型繪製，因此不需內嵌字型檔；缺點是 PDF 內文字不可選取。
 * 需要可選取文字時請使用「列印／另存 PDF」。第二階段可改為後端 PDF 服務，介面維持 exportReportPdf()。
 */
const A4 = { w: 210, h: 297 };
const MARGIN = 12;
const FOOT = 8;

function footerImage(text: string, widthMm: number): { url: string; h: number } {
  const scale = 8; // px per mm
  const cv = document.createElement('canvas');
  cv.width = widthMm * scale;
  cv.height = 5 * scale;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#5b6b7b';
  ctx.font = `${3 * scale}px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, cv.width / 2, cv.height / 2);
  return { url: cv.toDataURL('image/png'), h: 5 };
}

export async function exportReportPdf(root: HTMLElement, fileName: string, footer: string): Promise<void> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const contentW = A4.w - MARGIN * 2;
  const contentH = A4.h - MARGIN * 2 - FOOT;
  let y = MARGIN;
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('.pdf-block'));

  for (const block of blocks) {
    const canvas = await html2canvas(block, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
    const pxPerMm = canvas.width / contentW;
    const hMm = canvas.height / pxPerMm;
    if (hMm <= contentH) {
      if (y + hMm > MARGIN + contentH) { pdf.addPage(); y = MARGIN; }
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, y, contentW, hMm);
      y += hMm + 2;
      continue;
    }
    // 區塊比一頁還高：分段切開
    let offset = 0;
    while (offset < canvas.height) {
      const room = MARGIN + contentH - y;
      if (room < 30) { pdf.addPage(); y = MARGIN; continue; }
      const slicePx = Math.min(canvas.height - offset, Math.floor(room * pxPerMm));
      const part = document.createElement('canvas');
      part.width = canvas.width;
      part.height = slicePx;
      part.getContext('2d')!.drawImage(canvas, 0, offset, canvas.width, slicePx, 0, 0, canvas.width, slicePx);
      pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, y, contentW, slicePx / pxPerMm);
      y += slicePx / pxPerMm + 2;
      offset += slicePx;
    }
  }

  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    const f = footerImage(`${footer}　｜　第 ${p} / ${pages} 頁`, contentW);
    pdf.addImage(f.url, 'PNG', MARGIN, A4.h - MARGIN - f.h + 2, contentW, f.h);
  }
  const url = URL.createObjectURL(pdf.output('blob'));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
