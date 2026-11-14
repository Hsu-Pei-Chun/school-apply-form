// 在瀏覽器把申請表（.sheet）轉成 A4 單頁 PDF 並下載。只能在 client 端使用。
// 做法：複製一份 .sheet 到畫面外，套上 .pdf-mode（固定 A4 寬度、與列印相同的版面），
// 轉成高解析度圖片後放進 A4 PDF。轉成圖片而不是向量文字，是為了不必在 PDF 內嵌中文字型（動輒數 MB），
// 也能保證手機、電腦產生的 PDF 長得一樣。

const A4_W = 210;
const A4_H = 297;

/** 檔名不可含路徑或作業系統保留字元；條碼內的空格改成底線。 */
export function pdfFilename(prefix: string, barcode: string): string {
  const safe = `${prefix}-${barcode}`.replace(/[\\/:*?"<>|\s]+/g, '_');
  return `${safe}.pdf`;
}

/** 圖片尺寸（px）放進 A4 的大小與位置（mm）：寬度貼滿，太高時等比縮小並水平置中。 */
export function fitToA4(pxWidth: number, pxHeight: number): { x: number; y: number; w: number; h: number } {
  let w = A4_W;
  let h = (pxHeight * A4_W) / pxWidth;
  if (h > A4_H) {
    w = (w * A4_H) / h;
    h = A4_H;
  }
  return { x: (A4_W - w) / 2, y: 0, w, h };
}

export async function downloadSheetPdf(sheet: HTMLElement, filename: string): Promise<void> {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none;';
  const clone = sheet.cloneNode(true) as HTMLElement;
  clone.classList.add('pdf-mode');
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    await document.fonts?.ready;
    const opts = { pixelRatio: 3, backgroundColor: '#ffffff', cacheBust: true };
    // iOS Safari 第一次轉換常漏掉字型或 SVG，先暖身一次再取正式結果
    await toCanvas(clone, opts);
    const canvas = await toCanvas(clone, opts);

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const { x, y, w, h } = fitToA4(canvas.width, canvas.height);
    pdf.addImage(canvas, 'PNG', x, y, w, h, undefined, 'FAST');
    pdf.save(filename);
  } finally {
    host.remove();
  }
}
