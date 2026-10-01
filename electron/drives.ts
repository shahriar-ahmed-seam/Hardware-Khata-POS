/**
 * REMOVABLE-DRIVE PARSING — pure, so backend/verify can test it.
 *
 * electron/backup.ts asks the operating system which drives are removable and
 * hands the raw answer here. Nothing in this file imports Electron or touches
 * the disk, which is what lets `backend/verify/backup.ts` feed it recorded
 * `lsblk` output and check the answer.
 */
import path from 'node:path';

/** A plugged-in removable drive the app can write a snapshot onto. */
export interface UsbDrive {
  /** Where to write: 'E:\\' on Windows, the mount point ('/media/me/SANDISK') on Linux. */
  root: string;
  /** Windows drive letter without the colon ('E'); empty on Linux, which has none. */
  letter: string;
  /** Volume label if the drive has one, e.g. 'SANDISK'. */
  label: string;
  /** Free bytes, or null when the system would not report it. */
  freeBytes: number | null;
  totalBytes: number | null;
  /** What the UI shows, e.g. 'E: (SANDISK)' or 'SANDISK'. */
  display: string;
}

/**
 * The columns asked of lsblk. FSAVAIL/FSSIZE need util-linux 2.33 (2018); an
 * older lsblk refuses the whole query over one unknown column, so the caller
 * retries with {@link LSBLK_COLUMNS_BASIC} and free space is simply unknown.
 */
export const LSBLK_COLUMNS = 'NAME,TYPE,RM,HOTPLUG,TRAN,FSTYPE,MOUNTPOINT,LABEL,FSAVAIL,FSSIZE,SIZE';
export const LSBLK_COLUMNS_BASIC = 'NAME,TYPE,RM,HOTPLUG,TRAN,FSTYPE,MOUNTPOINT,LABEL,SIZE';

interface LsblkNode {
  name?: unknown;
  type?: unknown;
  rm?: unknown;
  hotplug?: unknown;
  tran?: unknown;
  fstype?: unknown;
  mountpoint?: unknown;
  mountpoints?: unknown;
  label?: unknown;
  fsavail?: unknown;
  fssize?: unknown;
  size?: unknown;
  children?: unknown;
}

export interface LsblkResult {
  /** Mounted, removable filesystems outside the running system. */
  drives: UsbDrive[];
  /**
   * Removable filesystems that are plugged in but NOT mounted. The desktop
   * mounts a stick when it is opened in the file manager (or automatically, on
   * most desktops); until then there is no folder to write into. Counted so the
   * owner is told "open it first" rather than "no pendrive found".
   */
  unmounted: number;
}

/**
 * lsblk 2.33+ prints real JSON booleans and numbers; older versions print every
 * value as a string ("1", "0", "15728640"). Accept both.
 */
function flag(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true';
}

function bytes(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** lsblk 2.37+ also lists every mount of a filesystem in `mountpoints`. */
function mountOf(node: LsblkNode): string {
  const one = text(node.mountpoint);
  if (one) return one;
  if (Array.isArray(node.mountpoints)) {
    for (const m of node.mountpoints) {
      const s = text(m);
      if (s) return s;
    }
  }
  return '';
}

/**
 * Mount points that belong to the running system. A USB disk the machine BOOTS
 * from is still "removable" to the kernel; writing a snapshot of the shop onto
 * the system disk and calling it a pendrive would be exactly the lie the
 * Windows path refuses to tell.
 */
const SYSTEM_TREE = /^\/(boot|efi|snap|usr|var|etc|opt|srv|tmp|home|root|proc|sys|dev)(\/|$)/;
export function isSystemMount(mount: string): boolean {
  if (mount === '/' || mount.startsWith('[')) return true; // '[SWAP]'
  // /run holds runtime state; only /run/media/<user>/… (Fedora, Arch) is a stick.
  if (mount.startsWith('/run/') && !mount.startsWith('/run/media/')) return true;
  return SYSTEM_TREE.test(mount);
}

/**
 * Read `lsblk -J -b -o <LSBLK_COLUMNS>` output.
 *
 * A filesystem counts as a pendrive when the kernel says its device is
 * removable or hot-pluggable, or it hangs off the USB bus — on the device
 * itself or on the disk it is a partition of (older lsblk does not repeat the
 * parent's flags on partitions). Optical drives are removable too, and never
 * writable, so they are left out, as are loop devices (snaps, mounted images).
 *
 * Returns null when the text is not lsblk JSON at all.
 */
export function parseLsblk(stdout: string): LsblkResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return null;
  }
  const top = (parsed as { blockdevices?: unknown } | null)?.blockdevices;
  if (!Array.isArray(top)) return null;

  const found: UsbDrive[] = [];
  let unmounted = 0;
  const seen = new Set<string>();

  const walk = (nodes: unknown, parentRemovable: boolean) => {
    if (!Array.isArray(nodes)) return;
    for (const raw of nodes) {
      if (!raw || typeof raw !== 'object') continue;
      const node = raw as LsblkNode;
      const type = text(node.type);
      if (type === 'loop' || type === 'rom') continue;
      const removable =
        parentRemovable || flag(node.rm) || flag(node.hotplug) || text(node.tran) === 'usb';

      // 'crypt' is an unlocked encrypted stick: the filesystem sits one level down.
      if (removable && (type === 'disk' || type === 'part' || type === 'crypt')) {
        const mount = mountOf(node);
        if (mount && !isSystemMount(mount)) {
          if (!seen.has(mount)) {
            seen.add(mount);
            const label = text(node.label);
            found.push({
              root: mount,
              letter: '',
              label,
              freeBytes: bytes(node.fsavail),
              totalBytes: bytes(node.fssize) ?? bytes(node.size),
              display: label || path.posix.basename(mount) || mount,
            });
          }
        } else if (!mount && text(node.fstype)) {
          unmounted += 1;
        }
      }
      walk(node.children, removable);
    }
  };
  walk(top, false);

  // Two sticks both labelled 'USB DISK' must still be told apart in the chooser.
  const counts = new Map<string, number>();
  for (const d of found) counts.set(d.display, (counts.get(d.display) ?? 0) + 1);
  for (const d of found) {
    if ((counts.get(d.display) ?? 0) > 1) d.display = `${d.display} (${d.root})`;
  }

  return { drives: found, unmounted };
}

// ------------------------------------------------------------ Windows answers

/** One row of Win32_LogicalDisk, however it was asked for. */
export interface LogicalDiskRow {
  DeviceID?: string;
  VolumeName?: string;
  FreeSpace?: number | string | null;
  Size?: number | string | null;
}

/**
 * The Windows 7 query. Windows 7 ships PowerShell 2.0, which has neither
 * `Get-CimInstance` nor `ConvertTo-Json` (both 3.0), so the modern query failed
 * on the owner's PC and every pendrive backup said "could not check". This one
 * uses only 2.0 commands and prints one `DeviceID|VolumeName|FreeSpace|Size`
 * line per removable drive.
 */
export const PS2_LOGICAL_DISK_SCRIPT =
  'Get-WmiObject -Class Win32_LogicalDisk -Filter "DriveType=2" | ' +
  'ForEach-Object { [string]$_.DeviceID + "|" + [string]$_.VolumeName + "|" + [string]$_.FreeSpace + "|" + [string]$_.Size }';

/** Read {@link PS2_LOGICAL_DISK_SCRIPT} output. Lines that are not drives are skipped. */
export function parseLogicalDiskLines(stdout: string): LogicalDiskRow[] {
  const rows: LogicalDiskRow[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const parts = line.trim().split('|');
    if (parts.length < 4 || !/^[A-Za-z]:$/.test(parts[0].trim())) continue;
    rows.push({
      DeviceID: parts[0].trim(),
      VolumeName: parts[1].trim(),
      FreeSpace: parts[2].trim() || null,
      Size: parts[3].trim() || null,
    });
  }
  return rows;
}

/**
 * `wmic logicaldisk where drivetype=2 get DeviceID,FreeSpace,Size,VolumeName
 * /format:csv` — the last resort when PowerShell will not run at all. Windows 7
 * always has wmic (it is newer Windows 11 builds that drop it). Columns come
 * back as `Node,DeviceID,FreeSpace,Size,VolumeName`, read by header name.
 */
export const WMIC_LOGICAL_DISK_ARGS = [
  'logicaldisk',
  'where',
  'drivetype=2',
  'get',
  'DeviceID,FreeSpace,Size,VolumeName',
  '/format:csv',
];

export function parseWmicCsv(stdout: string): LogicalDiskRow[] {
  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.replace(/\r/g, '').trim())
    .filter(Boolean);
  const headerAt = lines.findIndex((l) => /(^|,)DeviceID(,|$)/i.test(l));
  if (headerAt < 0) return [];
  const header = lines[headerAt].split(',').map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const rows: LogicalDiskRow[] = [];
  for (const line of lines.slice(headerAt + 1)) {
    const cells = line.split(',');
    const id = (cells[col('DeviceID')] ?? '').trim();
    if (!/^[A-Za-z]:$/.test(id)) continue;
    rows.push({
      DeviceID: id,
      VolumeName: (cells[col('VolumeName')] ?? '').trim(),
      FreeSpace: (cells[col('FreeSpace')] ?? '').trim() || null,
      Size: (cells[col('Size')] ?? '').trim() || null,
    });
  }
  return rows;
}
