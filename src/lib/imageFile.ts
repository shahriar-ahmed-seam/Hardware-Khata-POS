/**
 * TURNING A PICKED FILE INTO AN IMAGE THAT SURVIVES
 * ================================================
 *
 * THE BUG THIS EXISTS TO KILL
 * Product photos and the shop logo used to be stored as
 * `URL.createObjectURL(file)` — a `blob:` URL. That is a handle into the CURRENT
 * window's memory, valid until the document is discarded. It was being written
 * straight into the database, so every photo died on the next app restart (not
 * just on reinstall), leaving rows full of dead `blob:` strings and a broken
 * image on screen and on printed receipts.
 *
 * WHAT WE DO INSTEAD
 * Decode the picture, shrink it, re-encode it, and hand back a **data URL** —
 * the bytes themselves. That is stored in the database column, which buys three
 * things the owner actually asked for:
 *
 *  1. It survives restarts, reinstalls, and being carried to a different PC,
 *     because there is no path to go stale.
 *  2. It is BACKED UP automatically. Backups are whole-database snapshots, so a
 *     photo inside the database is protected by the existing snapshot, pendrive
 *     and cloud copies with no extra machinery, no second folder to keep in
 *     step, and no orphaned files.
 *  3. It cannot half-exist: either the row has its picture or it does not.
 *
 * WHY SHRINKING IS NOT OPTIONAL
 * A phone photo is 3–8 MB. Storing those verbatim would bloat the database and
 * every snapshot of it until backups became slow and huge — and it would cost far
 * more than disk: `products.list` selects every column for every product, so each
 * stored byte travels over IPC on every catalogue read, on a machine we have just
 * spent effort making faster.
 *
 * So callers pass a tight budget: product photos are capped at 256 px (the
 * largest they are ever drawn is a ~170 px POS tile) and the shop logo at 320 px.
 * A typical result is 10–20 KB, so even a few hundred photographed products add
 * only a couple of MB.
 */

export interface StoredImageOptions {
  /** Longest edge of the stored image, in pixels. */
  maxEdge?: number;
  /** JPEG quality, 0..1. Ignored when the image is kept as PNG. */
  quality?: number;
  /** Hard ceiling for the encoded result. Above this we refuse rather than bloat the DB. */
  maxBytes?: number;
  /**
   * Keep transparency (encode PNG instead of JPEG). Use for the shop logo, which
   * is usually a transparent PNG and would gain an ugly black box as JPEG.
   */
  preserveAlpha?: boolean;
}

const DEFAULTS: Required<Omit<StoredImageOptions, 'preserveAlpha'>> = {
  maxEdge: 256,
  quality: 0.78,
  maxBytes: 150_000,
};

/** Human-readable size for error messages. */
function kb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

/** Roughly how many bytes a base64 data URL represents. */
function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  // 4 base64 chars → 3 bytes, minus padding.
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/** Load a File into an HTMLImageElement, cleaning up the temporary handle. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // An object URL IS the right tool here — it just must never be persisted.
    // It is revoked as soon as the bitmap is decoded.
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(src);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error('That file could not be read as a picture.'));
    };
    img.src = src;
  });
}

/**
 * Convert a picked image file into a durable data URL, downscaled.
 *
 * Throws an `Error` with a message written for the shop owner, not a developer —
 * the caller shows it verbatim in a toast.
 */
export async function fileToStoredImage(
  file: File,
  options: StoredImageOptions = {},
): Promise<string> {
  const opts = { ...DEFAULTS, ...options };

  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a picture file (PNG or JPG).');
  }
  // Generous, because we are about to shrink it anyway. This only guards against
  // someone picking a 200 MB TIFF and freezing the app while it decodes.
  if (file.size > 25 * 1024 * 1024) {
    throw new Error(`That picture is very large (${kb(file.size)}). Please choose a smaller one.`);
  }

  const img = await loadImage(file);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new Error('That picture appears to be empty.');

  // Never scale UP — a small logo must not be blown up and blurred.
  const scale = Math.min(1, opts.maxEdge / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This computer could not process the picture.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, outW, outH);

  const asPng = options.preserveAlpha === true;
  let out = canvas.toDataURL(asPng ? 'image/png' : 'image/jpeg', opts.quality);

  // PNG of a photo can be enormous. If we were asked to keep transparency but
  // the result is unreasonable, fall back to JPEG rather than refusing outright —
  // a visible picture without transparency beats no picture.
  if (asPng && dataUrlBytes(out) > opts.maxBytes) {
    out = canvas.toDataURL('image/jpeg', opts.quality);
  }

  // Still too big → step the quality down before giving up.
  for (let q = opts.quality - 0.15; dataUrlBytes(out) > opts.maxBytes && q >= 0.4; q -= 0.15) {
    out = canvas.toDataURL('image/jpeg', q);
  }

  const bytes = dataUrlBytes(out);
  if (bytes > opts.maxBytes) {
    throw new Error(
      `This picture is too detailed to store (${kb(bytes)} after shrinking). Please choose a simpler or smaller image.`,
    );
  }

  return out;
}

/**
 * True for a reference that will not survive a restart. Used to ignore the dead
 * `blob:` values written by builds before this fix, so a broken image is never
 * rendered — the category placeholder shows instead.
 */
export function isEphemeralImage(url: string | undefined | null): boolean {
  return typeof url === 'string' && url.startsWith('blob:');
}

/** The image to render, or undefined when the stored value is unusable. */
export function usableImage(url: string | undefined | null): string | undefined {
  if (!url || isEphemeralImage(url)) return undefined;
  return url;
}
