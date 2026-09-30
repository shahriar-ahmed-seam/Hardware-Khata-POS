/**
 * electron-builder afterPack hook — Linux only.
 *
 * WHY THIS EXISTS
 * Chromium needs a sandbox helper on Linux: either unprivileged user namespaces,
 * or a `chrome-sandbox` binary owned by root with mode 4755. Ubuntu 23.10+
 * blocks the first for unconfined apps (AppArmor), and an AppImage cannot
 * provide the second — it runs from a FUSE mount owned by the user. So a
 * double-clicked AppImage aborts at start-up with "The SUID sandbox helper
 * binary was found, but is not configured correctly".
 *
 * electron-builder only adds `--no-sandbox` to the AppImage's .desktop entry,
 * which is not used when the file is simply run. This hook renames the real
 * binary to `<name>.bin` and puts a small launcher in its place that adds
 * `--no-sandbox` ONLY when running as an AppImage (`$APPIMAGE` is set by the
 * AppImage runtime). The .deb installs `chrome-sandbox` as root 4755 in its
 * postinst, so it keeps the full sandbox.
 *
 * The app loads only its own local files (no remote content), which is why
 * running the AppImage without the Chromium sandbox is an acceptable trade.
 */
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function linuxAfterPack(context) {
  if (context.electronPlatformName !== 'linux') return;

  const name = context.packager.executableName;
  const bin = path.join(context.appOutDir, name);
  const real = `${bin}.bin`;

  // Idempotent: a re-run over an already-wrapped folder leaves it alone.
  if (fs.existsSync(real)) return;
  if (!fs.existsSync(bin)) throw new Error(`[after-pack] ${bin} not found`);

  fs.renameSync(bin, real);
  const launcher = [
    '#!/bin/sh',
    '# Launcher written by scripts/linux-after-pack.cjs — see the note there.',
    'HERE="$(dirname "$(readlink -f "$0")")"',
    'if [ -n "$APPIMAGE" ]; then',
    `  exec "$HERE/${name}.bin" --no-sandbox "$@"`,
    'fi',
    `exec "$HERE/${name}.bin" "$@"`,
    '',
  ].join('\n');
  fs.writeFileSync(bin, launcher, { mode: 0o755 });
  // eslint-disable-next-line no-console
  console.log(`  • after-pack: wrapped ${name} (adds --no-sandbox only inside an AppImage)`);
};
