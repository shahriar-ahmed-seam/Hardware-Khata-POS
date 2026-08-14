/**
 * Rasterise build/icon.svg -> build/icon.png (256x256) using Electron itself.
 *
 * WHY THIS EXISTS
 * electron-builder needs a .png (>=256px) or .ico for the Windows icon; it does
 * NOT accept SVG. The repo only ships build/icon.svg, and no image converter
 * (sharp/jimp/png-to-ico) is installed. Rather than add a native image
 * dependency just for packaging, we borrow the Chromium renderer that is
 * already in the tree: load the SVG in an offscreen transparent window and
 * capture it.
 *
 * Run with:  npx electron scripts/make-icon.cjs
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const SIZE = 256;
const svg = path.join(__dirname, '..', 'build', 'icon.svg');
const out = path.join(__dirname, '..', 'build', 'icon.png');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    // Transparent capture needs a fully transparent backdrop, otherwise the
    // rounded corners come out filled with the window colour.
    backgroundColor: '#00000000',
    useContentSize: true,
    webPreferences: { offscreen: true },
  });

  try {
    await win.loadFile(svg);
    // The SVG has gradients and a blur filter; give the compositor a beat.
    await new Promise((r) => setTimeout(r, 400));
    const image = await win.capturePage();
    const size = image.getSize();
    if (size.width < SIZE || size.height < SIZE) {
      throw new Error(`captured ${size.width}x${size.height}, expected ${SIZE}x${SIZE}`);
    }
    fs.writeFileSync(out, image.toPNG());
    console.log(`[icon] wrote ${out} (${size.width}x${size.height})`);
  } catch (e) {
    console.error('[icon] failed:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.quit();
  }
});
