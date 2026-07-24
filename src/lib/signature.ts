import { saveAs } from 'file-saver';

// layout.tsx에서 next/font로 로드해둔 손글씨체(Dancing Script, bold)를 캔버스에 그린다.
// next/font는 실제로 CSS에서 쓰여야만 폰트 파일을 내려받는 지연 로딩 방식이라, 이 페이지
// 어디에도 이 폰트가 적용된 요소가 없으면 document.fonts.ready가 있어도 폰트 자체는
// 로드되지 않은 채로 남는다. document.fonts.load()로 명시적으로 강제 로드한다.
async function drawSignature(canvas: HTMLCanvasElement): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 초기화할 수 없습니다.');

  const fontSize = Math.max(32, Math.round(canvas.width * 0.045));
  const signatureFontVar = getComputedStyle(document.documentElement)
    .getPropertyValue('--font-signature')
    .trim();
  const fontFamily = signatureFontVar || 'cursive';

  if (signatureFontVar && typeof document.fonts?.load === 'function') {
    try {
      await document.fonts.load(`bold ${fontSize}px "Dancing Script"`);
    } catch {
      // 로드 실패 시 폴백 폰트로 계속 진행
    }
  }
  if (typeof document.fonts?.ready?.then === 'function') {
    await document.fonts.ready;
  }

  // 서명 위치: 우측 하단, 여백을 두고 살짝 기울여서 손글씨 느낌을 낸다.
  const marginX = canvas.width * 0.05;
  const marginY = canvas.height * 0.04;

  ctx.save();
  ctx.translate(canvas.width - marginX, canvas.height - marginY);
  ctx.rotate(-0.05);
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('David', 0, 0);
  ctx.restore();
}

async function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('이미지 변환에 실패했습니다.'))), 'image/png');
  });
  saveAs(blob, filename);
}

// 업로드한 이미지 파일에 직접 "David" 서명을 그려넣고 다운로드한다.
export async function stampSignatureAndDownload(file: File): Promise<void> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일(PNG/JPG)에서만 서명을 추가할 수 있습니다.');
  }

  const imgUrl = URL.createObjectURL(file);
  let img: HTMLImageElement;
  try {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
      image.src = imgUrl;
    });
  } finally {
    URL.revokeObjectURL(imgUrl);
  }

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 초기화할 수 없습니다.');
  ctx.drawImage(img, 0, 0);

  await drawSignature(canvas);

  const cleanName = file.name.replace(/\.[^/.]+$/, '');
  await downloadCanvas(canvas, `${cleanName}_서명.png`);
}

// PDF/엑셀처럼 캔버스에 직접 그릴 수 없는 파일일 때, 화면에 렌더링된 패킹리스트
// 결과 화면을 캡쳐해서 그 위에 서명을 찍어 다운로드한다.
// (html2canvas는 Tailwind v4가 쓰는 oklch() 색상 문법을 파싱하지 못해 실패하므로,
// SVG foreignObject 기반으로 브라우저 자체 렌더링을 활용하는 modern-screenshot을 사용한다.)
export async function stampSignatureOnElementAndDownload(element: HTMLElement, baseName: string): Promise<void> {
  const { domToCanvas } = await import('modern-screenshot');
  const canvas = await domToCanvas(element, {
    backgroundColor: '#ffffff',
    scale: Math.min(2, window.devicePixelRatio || 1.5),
  });

  await drawSignature(canvas);

  const cleanName = baseName.replace(/\.[^/.]+$/, '');
  await downloadCanvas(canvas, `${cleanName}_서명.png`);
}
