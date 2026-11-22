import * as htmlToImage from 'html-to-image';

export interface ExportedInfographic {
  dataUrl: string;
  base64: string;
  blob: Blob;
}

/**
 * Mengonversi gambar eksternal (http/https) di dalam elemen target ke Data URL sementara
 * agar SVG <foreignObject> tidak terkena error CORS taint saat render ke PNG.
 */
async function inlineExternalImages(root: HTMLElement): Promise<() => void> {
  const images = Array.from(root.querySelectorAll('img'));
  const restores: Array<() => void> = [];

  await Promise.all(
    images.map(async (img) => {
      const originalSrc = img.getAttribute('src') || '';
      if (!originalSrc || originalSrc.startsWith('data:') || originalSrc.startsWith('blob:')) {
        return;
      }

      try {
        const res = await fetch(originalSrc, { mode: 'cors' });
        if (!res.ok) throw new Error('Image fetch failed');
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ''));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if (dataUrl) {
          img.setAttribute('src', dataUrl);
          await img.decode().catch(() => {});
          restores.push(() => img.setAttribute('src', originalSrc));
        }
      } catch {
        // Jika server gambar memblokir CORS, sembunyikan sementara agar export tidak gagal total
        const prevVisibility = img.style.visibility;
        img.style.visibility = 'hidden';
        restores.push(() => {
          img.style.visibility = prevVisibility;
        });
      }
    })
  );

  return () => {
    restores.forEach((fn) => fn());
  };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(parts[1] || '');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Merender elemen DOM infografis menjadi gambar PNG beresolusi tinggi (2x)
 * menggunakan mesin layout asli browser (html-to-image) sehingga 100% persis tampilan layar,
 * mendukung Tailwind v4 oklch()/oklab(), CSS Grid, badge, dan shadow tanpa berantakan.
 */
export async function captureElementAsPng(element: HTMLElement): Promise<ExportedInfographic> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);
    } catch {
      // Lanjutkan jika fonts.ready gagal
    }
  }

  const restoreImages = await inlineExternalImages(element);

  try {
    const width = element.scrollWidth || element.offsetWidth || 720;
    const height = element.scrollHeight || element.offsetHeight;

    const baseOptions = {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      width,
      height,
      cacheBust: false,
      style: {
        margin: '0',
        boxShadow: 'none',
        transform: 'none',
      },
    };

    let dataUrl: string;
    try {
      dataUrl = await htmlToImage.toPng(element, baseOptions);
    } catch {
      // Fallback aman bila stylesheet font eksternal tidak mengizinkan pembacaan cssRules
      dataUrl = await htmlToImage.toPng(element, {
        ...baseOptions,
        skipFonts: true,
      });
    }

    const base64 = dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
    const blob = dataUrlToBlob(dataUrl);

    return { dataUrl, base64, blob };
  } finally {
    restoreImages();
  }
}
