/**
 * 브라우저에서 PDF 텍스트를 추출한다(바이트는 서버로 보내지 않음).
 * 스캔(이미지)만 있는 PDF는 빈 문자열을 돌려줄 수 있다.
 * pdfjs-dist 워커는 CDN에서 로드한다(버전 일치).
 */
export async function extractPdfText(
  file: File,
  maxChars = 20_000,
): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const maxPages = Math.min(doc.numPages, 30);
  let text = "";
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text +=
      content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
    if (text.length > maxChars) break;
  }
  return text.trim().slice(0, maxChars);
}
