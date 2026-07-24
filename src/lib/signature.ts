import { saveAs } from 'file-saver';

// 업로드한 이미지에 "David" 서명을 그려넣고 바로 다운로드한다.
// 이미지 파일(png/jpg 등)에만 적용 가능 — PDF/엑셀은 캔버스에 그릴 수 없어 지원하지 않는다.
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

  // 서명 위치: 우측 하단, 여백을 두고 살짝 기울여서 손글씨 느낌을 낸다.
  const fontSize = Math.max(28, Math.round(canvas.width * 0.05));
  const marginX = canvas.width * 0.07;
  const marginY = canvas.height * 0.06;

  ctx.save();
  ctx.translate(canvas.width - marginX, canvas.height - marginY);
  ctx.rotate(-0.05);
  ctx.font = `italic ${fontSize}px cursive`;
  ctx.fillStyle = '#1a3a8f';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('David', 0, 0);
  ctx.restore();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('이미지 변환에 실패했습니다.'))), 'image/png');
  });

  const cleanName = file.name.replace(/\.[^/.]+$/, '');
  saveAs(blob, `${cleanName}_서명.png`);
}
