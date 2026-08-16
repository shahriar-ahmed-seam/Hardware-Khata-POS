import { create } from 'zustand';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast';

/**
 * BACKUP & CLOUD SAVING (renderer store)
 *
 * Thin client over the `backup.*` channels. There is intentionally NO local
 * state that duplicates the configuration: every field shown on the Backup
 * screen is read back from the backend after each write, so what the owner sees
 * is what is actually stored. A backup screen that optimistically claims success
 * is worse than no screen at all.
 *
 * "Cloud" here means the snapshot folder is one the owner's own OneDrive /
 * Google Drive / Dropbox client already syncs. The app itself makes no outbound
 * network request, stores no third-party credentials, and works with no
 * internet — see backend/services/backup.ts for the full reasoning.
 */

export interface BackupConfig {
  folder: string;
  /** Where "Save as PDF" writes the owner's copy of an invoice. */
  pdfFolder: string;
  auto: 'off' | 'daily' | 'on-shift-close';
  keep: number;
  cloudFolder: boolean;
  cloudLabel?: string;
  lastBackupAt?: string;
  lastBackupPath?: string;
  lastBackupBytes?: number;
  lastError?: string;
  /** Last snapshot copied to a pendrive — tracked separately from the folder backup. */
  lastUsbBackupAt?: string;
  lastUsbBackupPath?: string;
  lastUsbLabel?: string;
}

/** A plugged-in removable drive (pendrive, SD card, portable disk). */
export interface UsbDrive {
  root: string;
  letter: string;
  label: string;
  freeBytes: number | null;
  totalBytes: number | null;
  display: string;
}

export interface UsbBackupResult {
  ok: boolean;
  error?: string;
  /**
   * 'unavailable' means the app could NOT ask Windows which drives are removable
   * (PowerShell blocked by policy, for instance) — which is a different fact from
   * "no pendrive is plugged in". The UI offers the pick-the-folder-yourself route
   * in that case instead of telling the owner there is no stick.
   */
  detection?: 'ok' | 'unavailable';
  /** Present when several drives are connected and the owner must choose. */
  drives?: UsbDrive[];
  /** True when the owner closed the folder picker without choosing. */
  cancelled?: boolean;
  name?: string;
  path?: string;
  at?: string;
  bytes?: number;
  driveLabel?: string;
}

/** What `backup.usbDrives` returns: the list PLUS whether we could look at all. */
export interface UsbProbe {
  drives: UsbDrive[];
  detection: 'ok' | 'unavailable';
  detail?: string;
}

export interface SnapshotInfo {
  name: string;
  path: string;
  at: string;
  bytes: number;
}

export interface BackupStatus {
  config: BackupConfig;
  snapshots: SnapshotInfo[];
  folderReady: boolean;
  liveBytes: number | null;
}

export interface FolderOption {
  id: string;
  label: string;
  path: string;
  cloud: boolean;
}

/** One archived invoice PDF sitting next to the database. */
export interface ArchivedInvoice {
  name: string;
  path: string;
  bytes: number;
  at: string;
}

export type ExportKind =
  | 'sales'
  | 'purchases'
  | 'products'
  | 'customers'
  | 'suppliers'
  | 'stock';

const EMPTY_CONFIG: BackupConfig = {
  folder: '',
  pdfFolder: '',
  auto: 'daily',
  keep: 14,
  cloudFolder: false,
};

interface State {
  config: BackupConfig;
  snapshots: SnapshotInfo[];
  folderReady: boolean;
  liveBytes: number | null;
  /** Folders we could write to on this machine (local + detected cloud roots). */
  folderOptions: FolderOption[];
  loading: boolean;
  /** True while a snapshot / export / restore is in flight. */
  busy: boolean;

  hydrate: () => Promise<void>;
  loadFolderOptions: () => Promise<void>;
  configure: (patch: Partial<BackupConfig>) => Promise<void>;
  setFolder: (folder: string) => Promise<void>;
  chooseFolder: () => Promise<void>;
  reveal: () => Promise<void>;
  /** Invoice-PDF folder (separate setting from the snapshot folder). */
  setPdfFolder: (folder: string) => Promise<void>;
  choosePdfFolder: () => Promise<void>;
  revealPdfFolder: () => Promise<void>;
  /** Archived invoice PDFs, newest first. */
  invoicePdfs: ArchivedInvoice[];
  loadInvoicePdfs: () => Promise<void>;
  openInvoicePdf: (file: string) => Promise<void>;
  runNow: () => Promise<boolean>;
  restore: (file?: string) => Promise<void>;
  exportCsv: (kind: ExportKind) => Promise<void>;
  /**
   * Removable drives currently plugged in, PLUS whether detection worked at all.
   * An empty list with `detection: 'unavailable'` means we could not ask Windows —
   * never report that as "no pendrive found".
   */
  listUsbDrives: () => Promise<UsbProbe>;
  /**
   * Write one verified snapshot into a folder the owner picks in a native dialog.
   * The way out when removable-drive detection is blocked on their PC. Like the
   * pendrive path (and unlike `run`), it does not repoint the configured backup
   * folder and does not prune anything already in the chosen folder.
   */
  backupToFolder: () => Promise<UsbBackupResult>;
  /**
   * Copy a verified snapshot onto a pendrive. Pass `drive` (a root like 'E:\\')
   * to target a specific one; omit it when only one is connected. Returns the
   * raw result so the caller can show the drive chooser when several are found.
   */
  backupToUsb: (drive?: string) => Promise<UsbBackupResult>;
}

function message(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export const useBackup = create<State>((set, get) => ({
  config: { ...EMPTY_CONFIG },
  snapshots: [],
  folderReady: false,
  liveBytes: null,
  folderOptions: [],
  invoicePdfs: [],
  loading: false,
  busy: false,

  hydrate: async () => {
    set({ loading: true });
    try {
      const s = await api<BackupStatus>('backup.status', {});
      set({
        config: s.config,
        snapshots: s.snapshots,
        folderReady: s.folderReady,
        liveBytes: s.liveBytes,
        loading: false,
      });
    } catch (e: unknown) {
      set({ loading: false });
      toast.error(message(e, 'Failed to read backup settings'));
    }
  },

  loadFolderOptions: async () => {
    try {
      set({ folderOptions: await api<FolderOption[]>('backup.folderOptions', {}) });
    } catch {
      // Non-fatal: the owner can still type/pick a folder with the browse button.
      set({ folderOptions: [] });
    }
  },

  listUsbDrives: async () => {
    try {
      return await api<UsbProbe>('backup.usbDrives', {});
    } catch (e: unknown) {
      toast.error(message(e, 'Could not check for a pendrive'));
      // A failed channel call is also "we could not look", not "there is none".
      return { drives: [], detection: 'unavailable' as const };
    }
  },

  backupToFolder: async () => {
    set({ busy: true });
    try {
      const res = await api<UsbBackupResult>('backup.toFolder', {});
      if (res.ok) await get().hydrate();
      return res;
    } catch (e: unknown) {
      return { ok: false, error: message(e, 'Could not save the copy') };
    } finally {
      set({ busy: false });
    }
  },

  backupToUsb: async (drive) => {
    set({ busy: true });
    try {
      const res = await api<UsbBackupResult>('backup.toUsb', { drive });
      // Re-read the config so `lastUsbBackupAt` on screen is what is stored,
      // not what we hoped happened.
      if (res.ok) await get().hydrate();
      return res;
    } catch (e: unknown) {
      return { ok: false, error: message(e, 'Pendrive backup failed') };
    } finally {
      set({ busy: false });
    }
  },

  configure: async (patch) => {
    try {
      await api('backup.configure', patch);
    } catch (e: unknown) {
      toast.error(message(e, 'Failed to save backup settings'));
    }
    await get().hydrate();
  },

  setFolder: async (folder) => {
    try {
      await api('backup.setFolder', { folder });
      toast.success('Backup folder updated');
    } catch (e: unknown) {
      toast.error(message(e, 'Failed to set the backup folder'));
    }
    await get().hydrate();
  },

  chooseFolder: async () => {
    try {
      const res = await api<{ cancelled: boolean }>('backup.chooseFolder', {});
      if (!res.cancelled) toast.success('Backup folder updated');
    } catch (e: unknown) {
      toast.error(message(e, 'Could not open the folder picker'));
    }
    await get().hydrate();
  },

  reveal: async () => {
    try {
      const res = await api<{ ok: boolean; error?: string }>('backup.reveal', {});
      if (!res.ok && res.error) toast.error(res.error);
    } catch (e: unknown) {
      toast.error(message(e, 'Could not open the backup folder'));
    }
  },

  setPdfFolder: async (folder) => {
    try {
      await api('backup.setPdfFolder', { folder });
      toast.success('PDF folder updated');
    } catch (e: unknown) {
      toast.error(message(e, 'Failed to set the PDF folder'));
    }
    await get().hydrate();
  },

  choosePdfFolder: async () => {
    try {
      const res = await api<{ cancelled: boolean }>('backup.chooseFolder', { target: 'pdf' });
      if (!res.cancelled) toast.success('PDF folder updated');
    } catch (e: unknown) {
      toast.error(message(e, 'Could not open the folder picker'));
    }
    await get().hydrate();
  },

  revealPdfFolder: async () => {
    try {
      const res = await api<{ ok: boolean; error?: string }>('backup.revealPdfFolder', {});
      if (!res.ok && res.error) toast.error(res.error);
    } catch (e: unknown) {
      toast.error(message(e, 'Could not open the PDF folder'));
    }
  },

  loadInvoicePdfs: async () => {
    try {
      set({ invoicePdfs: await api<ArchivedInvoice[]>('invoice.listPdfs', { limit: 200 }) });
    } catch {
      // Non-fatal: the archive list is informational.
      set({ invoicePdfs: [] });
    }
  },

  openInvoicePdf: async (file) => {
    try {
      const res = await api<{ ok: boolean; error?: string }>('invoice.openPdf', { file });
      if (!res.ok && res.error) toast.error(res.error);
    } catch (e: unknown) {
      toast.error(message(e, 'Could not open the PDF'));
    }
  },

  runNow: async () => {
    set({ busy: true });
    try {
      const res = await api<{ name: string; bytes: number }>('backup.run', {});
      toast.success(`Backup saved: ${res.name}`);
      set({ busy: false });
      await get().hydrate();
      return true;
    } catch (e: unknown) {
      set({ busy: false });
      toast.error(message(e, 'Backup failed'));
      await get().hydrate();
      return false;
    }
  },

  restore: async (file) => {
    set({ busy: true });
    try {
      // On success the main process relaunches the app, so this promise may
      // never resolve — that is expected, not an error.
      const res = await api<{ ok?: boolean; cancelled?: boolean; error?: string }>(
        'backup.restore',
        { file },
      );
      set({ busy: false });
      if (res.cancelled) return;
      if (res.ok === false && res.error) toast.error(res.error);
    } catch (e: unknown) {
      set({ busy: false });
      toast.error(message(e, 'Restore failed'));
    }
  },

  exportCsv: async (kind) => {
    set({ busy: true });
    try {
      const res = await api<{ path: string; rows: number }>('backup.export', { kind });
      toast.success(`Exported ${res.rows} rows to ${res.path}`);
    } catch (e: unknown) {
      toast.error(message(e, 'Export failed'));
    }
    set({ busy: false });
  },
}));
