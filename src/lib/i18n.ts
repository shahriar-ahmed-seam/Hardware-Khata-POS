// Lightweight i18n. Backend will replace with real translation files.
// Usage: const { t } = useT(); t('common.save')

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Lang = 'en' | 'bn';

type Dict = Record<string, string>;

const en: Dict = {
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.search': 'Search',
  'common.add': 'Add',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.print': 'Print',
  'common.export': 'Export',
  'common.import': 'Import',
  'common.filters': 'Filters',
  'common.total': 'Total',
  'common.paid': 'Paid',
  'common.due': 'Due',
  'common.status': 'Status',
  'common.actions': 'Actions',
  'titlebar.search.placeholder':
    'Search products, invoices, customers…  (Ctrl+K)  try #invoice:INV-001 or #product:cement',
  'titlebar.shift.open': 'Shift Open',
  'titlebar.synced': 'Synced',
  'titlebar.offline': 'Offline',
  'sidebar.shortcutsHint': 'F1 shortcuts · F2 search',
  'nav.dashboard': 'Dashboard',
  'nav.pos': 'POS',
  'nav.sales': 'Sales',
  'nav.purchases': 'Purchases',
  'nav.products': 'Products',
  'nav.stock': 'Stock',
  'nav.contacts': 'Contacts',
  'nav.expenses': 'Expenses',
  'nav.cashRegister': 'Cash Register',
  'nav.reports': 'Reports',
  'nav.sms': 'SMS',
  'nav.settings': 'Settings',
};

const bn: Dict = {
  'common.save': 'সংরক্ষণ',
  'common.cancel': 'বাতিল',
  'common.search': 'খুঁজুন',
  'common.add': 'যোগ করুন',
  'common.edit': 'সম্পাদনা',
  'common.delete': 'মুছুন',
  'common.print': 'প্রিন্ট',
  'common.export': 'এক্সপোর্ট',
  'common.import': 'ইম্পোর্ট',
  'common.filters': 'ফিল্টার',
  'common.total': 'মোট',
  'common.paid': 'পরিশোধিত',
  'common.due': 'বাকি',
  'common.status': 'অবস্থা',
  'common.actions': 'কার্যাবলী',
  'titlebar.search.placeholder':
    'পণ্য, ইনভয়েস, গ্রাহক খুঁজুন…  (Ctrl+K)  উদাহরণ: #invoice:INV-001 বা #product:সিমেন্ট',
  'titlebar.shift.open': 'শিফট খোলা',
  'titlebar.synced': 'সিঙ্ক হয়েছে',
  'titlebar.offline': 'অফলাইন',
  'sidebar.shortcutsHint': 'F1 শর্টকাট · F2 খুঁজুন',
  'nav.dashboard': 'ড্যাশবোর্ড',
  'nav.pos': 'পিওএস',
  'nav.sales': 'বিক্রয়',
  'nav.purchases': 'ক্রয়',
  'nav.products': 'পণ্য',
  'nav.stock': 'স্টক',
  'nav.contacts': 'কন্ট্যাক্ট',
  'nav.expenses': 'খরচ',
  'nav.cashRegister': 'ক্যাশ রেজিস্টার',
  'nav.reports': 'রিপোর্ট',
  'nav.sms': 'এসএমএস',
  'nav.settings': 'সেটিংস',
};

const dictionaries: Record<Lang, Dict> = { en, bn };

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const useLang = create<LangState>()(
  persist(
    (set) => ({
      lang: 'en',
      setLang: (lang) => {
        document.documentElement.lang = lang;
        set({ lang });
      },
    }),
    { name: 'pos-lang' },
  ),
);

export function t(key: string, lang?: Lang): string {
  const l = lang ?? useLang.getState().lang;
  return dictionaries[l]?.[key] ?? dictionaries.en[key] ?? key;
}

export function useT() {
  const lang = useLang((s) => s.lang);
  return {
    lang,
    t: (key: string) => t(key, lang),
  };
}
