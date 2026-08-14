# Hardware Khata POS - Release Package

## Version 0.1.0

### 🎉 Package Created Successfully

**Installer Location:** `release/Hardware Shop POS Setup 0.1.0.exe`  
**Installer Size:** 83.7 MB  
**Platform:** Windows x64  
**Build Date:** June 4, 2026

---

## 📦 What's Included

- **Complete Hardware Shop POS System**
  - Offline-first Electron desktop application
  - SQLite database with full data persistence
  - All core modules fully functional and tested (860 checks passed)

- **Core Features:**
  - Point of Sale with real-time inventory updates
  - Purchase Management (with/without stock)
  - Stock Management with transfer operations
  - Customer & Supplier Management
  - Cash Flow tracking with shift management
  - Expense Management
  - Returns (Sales & Purchase)
  - Comprehensive Reports (Sales, Purchase, Stock, Cash, Customer, Profit)
  - Multi-user authentication with roles
  - Backup & Cloud saving — verified database snapshots, retention, restore and CSV export

---

## 🚀 Installation

1. **Run the Installer:**
   - Double-click `Hardware Shop POS Setup 0.1.0.exe`
   - Follow the setup wizard
   - Choose installation directory
   - Desktop shortcut will be created

2. **First Launch:**
   - The app will create a fresh database on first run
   - Default admin user will be seeded
   - Sample master data can be generated using the seed script

3. **Default Credentials:**
   - Check the backend seed scripts for default login credentials

---

## 📊 System Status

### ✅ Fully Implemented & Tested
- **Frontend:** All pages, forms, and UI components wired to real database
- **Backend:** 19 service modules with complete CRUD operations
- **Database:** Schema with 28 tables, FTS indexes, proper constraints
- **Verification:** 860 checks across 146 registered channels (all green)
- **Data Flow:** No mock data in production paths (sell→stock→cash→reports)

### 📝 Deferred / Post-MVP (Non-blocking)

The three deferrals listed in earlier releases are now **closed**: AddSale/AddPurchase pickers
run on real master data, Shipments has its own table + service + channels, and Warranties &
Price Groups have real backend CRUD. There is no mock data path anywhere in the app.

What genuinely remains is external or explicitly post-MVP:
- **SMS gateway:** needs a Bangladeshi provider account (frontend is done)
- **Hosted multi-device sync:** off-machine safety is covered by Backup & Cloud; live
  row-level sync between machines would need a hosted account + conflict resolution
- **Thermal/ESC-POS printing** and cash-drawer kick
- **Multi-branch context:** writes currently assume the single default branch

None of these affect core business operations.

---

## 🔧 Technical Details

### Stack
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js services with better-sqlite3
- **Desktop:** Electron 31 with IPC bridge
- **State:** Zustand + React Query

### Database
- **Engine:** SQLite 3 (better-sqlite3)
- **Location:** User data directory (persistent)
- **Size:** Starts ~50KB, grows with transactions
- **Backup:** Built in — `Settings → Backup & Cloud` takes a verified `VACUUM INTO` snapshot
  (`pos-backup-YYYYMMDD-HHMMSS.sqlite3`), keeps the newest N (default 14), and can restore one.
  Point the folder at a OneDrive / Google Drive / Dropbox folder the machine already syncs and
  the copy leaves the shop; the app itself makes no network request and needs no account.

### Performance
- Offline-first architecture (no network required)
- Instant search with FTS5 full-text indexing
- Transaction-based data integrity
- Optimistic UI updates

---

## 📖 Documentation

Full project documentation is available in the `docs/` folder:
- **00-OVERVIEW.md** - Project architecture and structure
- **01-FRONTEND.md** - Frontend implementation details
- **02-BACKEND.md** - Backend services and database schema
- **03-WHATS-LEFT.md** - Known deferrals and future work
- **04-AGENT-HANDOFF.md** - Agent context for future development
- **05-CONTEXT-AND-HISTORY.md** - Project history and decisions
- **06-E2E-AND-SMOKE-TEST.md** - Testing strategy

---

## 🐛 Known Issues

None at this time. All 860 verification checks are passing.

---

## 📞 Support

For issues, questions, or contributions:
- **GitHub:** https://github.com/shahriar-ahmed-seam/Hardware-Khata-POS
- **Issues:** https://github.com/shahriar-ahmed-seam/Hardware-Khata-POS/issues

---

## 🔄 Building from Source

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package Windows installer
npm run build:win
```

---

## 📜 License

See LICENSE file in the project root.

---

**Built with ❤️ for Hardware Shop owners**
