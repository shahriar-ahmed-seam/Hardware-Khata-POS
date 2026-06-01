// Mock data for hardware shop POS

export type Category = { id: string; name: string; icon?: string; emoji?: string };
export type Brand = { id: string; name: string };
export type Unit = { id: string; name: string; short: string };

export type Product = {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  categoryId: string;
  brandId: string;
  unit: string; // base/default unit short code
  availableUnits?: string[]; // alternates: pc, box, dozen, hali, kg, m, ft, L, bag
  unitConversions?: { unit: string; factor: number }[]; // e.g. { unit:'dz', factor:12 } means 1 dz = 12 base units
  cost: number;
  price: number; // SPR — base selling price reference
  wholesalePrice?: number;
  contractorPrice?: number;
  stock: number;
  reorderLevel: number;
  image?: string;
  variations?: { name: string; price: number; stock: number }[];
  tax?: number; // % (default 0)
  description?: string;
  warrantyId?: string | null;
  // Settings
  manageStock?: boolean;        // default true
  allowNegativeSale?: boolean;  // default false
  allowDiscount?: boolean;      // default true
  showInPOS?: boolean;          // default true
  notForSale?: boolean;         // purchase-only items
  // Audit
  createdAt?: string;
  updatedAt?: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  altPhone?: string;
  email?: string;
  address?: string;
  group: 'Retail' | 'Wholesale' | 'Contractor';
  due: number;
  totalPurchase: number;
  totalPaid?: number;
  joined: string;
  creditLimit?: number; // 0 / undefined => no credit allowed
  dob?: string; // ISO date for birthday widget later
  openingBalance?: number;
  tags?: string[];
  notes?: string;
  lastSaleAt?: string;
};

export type Supplier = {
  id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  altPhone?: string;
  email?: string;
  address?: string;
  company?: string;
  taxId?: string;
  bankAccount?: string;
  leadTimeDays?: number;
  paymentTerms?: 'Cash' | 'Net7' | 'Net15' | 'Net30' | 'Net60';
  due: number;
  totalPurchase: number;
  totalPaid?: number;
  openingBalance?: number;
  tags?: string[];
  notes?: string;
  lastPurchaseAt?: string;
};

export type Sale = {
  id: string;
  invoiceNo: string;
  date: string;
  customerId: string;
  customerName: string;
  items: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  due: number;
  status: 'paid' | 'partial' | 'due';
  paymentMethod: 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Bank' | 'Credit' | 'Mixed';
  user: string;
};

export const categories: Category[] = [
  { id: 'c1', name: 'Hand Tools',         emoji: '🔨' },
  { id: 'c2', name: 'Power Tools',        emoji: '🪚' },
  { id: 'c3', name: 'Plumbing',           emoji: '🚰' },
  { id: 'c4', name: 'Electrical',         emoji: '💡' },
  { id: 'c5', name: 'Paint & Finish',     emoji: '🎨' },
  { id: 'c6', name: 'Fasteners',          emoji: '🔩' },
  { id: 'c7', name: 'Building Material',  emoji: '🧱' },
  { id: 'c8', name: 'Safety',             emoji: '⛑️' },
];

export const brands: Brand[] = [
  { id: 'b1', name: 'Bosch' },
  { id: 'b2', name: 'Makita' },
  { id: 'b3', name: 'Stanley' },
  { id: 'b4', name: 'RFL' },
  { id: 'b5', name: 'Berger' },
  { id: 'b6', name: 'BSRM' },
  { id: 'b7', name: 'Walton' },
  { id: 'b8', name: 'Generic' },
];

export const units: Unit[] = [
  { id: 'u1', name: 'Pieces',  short: 'pc' },
  { id: 'u2', name: 'Box',     short: 'box' },
  { id: 'u3', name: 'Dozen',   short: 'dz' },
  { id: 'u4', name: 'Hali',    short: 'hali' },
  { id: 'u5', name: 'Kilogram', short: 'kg' },
  { id: 'u6', name: 'Meter',   short: 'm' },
  { id: 'u7', name: 'Foot',    short: 'ft' },
  { id: 'u8', name: 'Liter',   short: 'L' },
  { id: 'u9', name: 'Bag',     short: 'bag' },
];

export const products: Product[] = [
  {
    id: 'p1',
    sku: 'HT-CLW-16',
    barcode: '8801001000017',
    name: 'Claw Hammer 16oz',
    categoryId: 'c1',
    brandId: 'b3',
    unit: 'pc',
    availableUnits: ['pc', 'dz', 'hali', 'box'],
    cost: 380,
    price: 520,
    wholesalePrice: 470,
    contractorPrice: 490,
    stock: 42,
    reorderLevel: 10,
    tax: 0,
  },
  {
    id: 'p2',
    sku: 'PT-DRL-13',
    barcode: '8801001000024',
    name: 'Cordless Drill 13mm',
    categoryId: 'c2',
    brandId: 'b1',
    unit: 'pc',
    availableUnits: ['pc', 'box'],
    cost: 6800,
    price: 8500,
    wholesalePrice: 7900,
    contractorPrice: 8100,
    stock: 8,
    reorderLevel: 5,
    tax: 0,
  },
  {
    id: 'p3',
    sku: 'PT-GRD-100',
    barcode: '8801001000031',
    name: 'Angle Grinder 4"',
    categoryId: 'c2',
    brandId: 'b2',
    unit: 'pc',
    availableUnits: ['pc', 'box'],
    cost: 4200,
    price: 5400,
    stock: 14,
    reorderLevel: 5,
  },
  {
    id: 'p4',
    sku: 'PL-PIPE-PVC-1',
    barcode: '8801001000048',
    name: 'PVC Pipe 1" x 20ft',
    categoryId: 'c3',
    brandId: 'b4',
    unit: 'pc',
    availableUnits: ['pc', 'ft', 'm'],
    cost: 320,
    price: 420,
    wholesalePrice: 380,
    stock: 120,
    reorderLevel: 30,
  },
  {
    id: 'p5',
    sku: 'EL-WIRE-25',
    barcode: '8801001000055',
    name: 'Copper Wire 2.5mm² (100yd)',
    categoryId: 'c4',
    brandId: 'b7',
    unit: 'box',
    availableUnits: ['box', 'm', 'ft'],
    cost: 4800,
    price: 6200,
    stock: 22,
    reorderLevel: 6,
  },
  // Paint split into separate SKUs (variations as separate products per your call)
  {
    id: 'p6a',
    sku: 'PN-WHITE-1L',
    barcode: '8801001000060',
    name: 'Weather Coat White 1L',
    categoryId: 'c5',
    brandId: 'b5',
    unit: 'pc',
    availableUnits: ['pc', 'box'],
    cost: 480,
    price: 620,
    stock: 50,
    reorderLevel: 10,
  },
  {
    id: 'p6b',
    sku: 'PN-WHITE-4L',
    barcode: '8801001000062',
    name: 'Weather Coat White 4L',
    categoryId: 'c5',
    brandId: 'b5',
    unit: 'pc',
    availableUnits: ['pc', 'box'],
    cost: 1750,
    price: 2200,
    stock: 36,
    reorderLevel: 8,
  },
  {
    id: 'p6c',
    sku: 'PN-WHITE-20L',
    barcode: '8801001000063',
    name: 'Weather Coat White 20L',
    categoryId: 'c5',
    brandId: 'b5',
    unit: 'pc',
    availableUnits: ['pc'],
    cost: 8200,
    price: 9800,
    stock: 6,
    reorderLevel: 2,
  },
  {
    id: 'p7',
    sku: 'FS-NAIL-2.5',
    barcode: '8801001000079',
    name: 'Iron Nail 2.5"',
    categoryId: 'c6',
    brandId: 'b8',
    unit: 'kg',
    availableUnits: ['kg', 'box'],
    cost: 110,
    price: 145,
    stock: 240,
    reorderLevel: 50,
  },
  {
    id: 'p8',
    sku: 'BM-CMNT-OPC',
    barcode: '8801001000086',
    name: 'Cement OPC 50kg',
    categoryId: 'c7',
    brandId: 'b8',
    unit: 'bag',
    availableUnits: ['bag'],
    cost: 480,
    price: 540,
    wholesalePrice: 520,
    contractorPrice: 525,
    stock: 320,
    reorderLevel: 80,
  },
  {
    id: 'p9',
    sku: 'BM-RBR-12',
    barcode: '8801001000093',
    name: 'MS Rebar 12mm',
    categoryId: 'c7',
    brandId: 'b6',
    unit: 'kg',
    availableUnits: ['kg', 'm', 'ft'],
    cost: 92,
    price: 102,
    wholesalePrice: 98,
    contractorPrice: 99,
    stock: 1850,
    reorderLevel: 400,
  },
  {
    id: 'p10',
    sku: 'SF-HLM',
    barcode: '8801001000109',
    name: 'Safety Helmet',
    categoryId: 'c8',
    brandId: 'b3',
    unit: 'pc',
    availableUnits: ['pc', 'dz', 'hali'],
    cost: 240,
    price: 340,
    stock: 4,
    reorderLevel: 10,
  },
  {
    id: 'p11',
    sku: 'HT-WRENCH-12',
    barcode: '8801001000116',
    name: 'Adjustable Wrench 12"',
    categoryId: 'c1',
    brandId: 'b3',
    unit: 'pc',
    availableUnits: ['pc', 'dz', 'hali'],
    cost: 480,
    price: 680,
    stock: 26,
    reorderLevel: 6,
  },
  {
    id: 'p12',
    sku: 'EL-BULB-LED9',
    barcode: '8801001000123',
    name: 'LED Bulb 9W',
    categoryId: 'c4',
    brandId: 'b7',
    unit: 'pc',
    availableUnits: ['pc', 'dz', 'hali', 'box'],
    cost: 95,
    price: 140,
    stock: 180,
    reorderLevel: 30,
  },
  {
    id: 'p13',
    sku: 'FS-SCRW-1.5',
    barcode: '8801001000130',
    name: 'Wood Screw 1.5" (100pc)',
    categoryId: 'c6',
    brandId: 'b8',
    unit: 'box',
    availableUnits: ['box'],
    cost: 130,
    price: 185,
    stock: 88,
    reorderLevel: 20,
  },
  {
    id: 'p14',
    sku: 'PT-SAW-CIRC',
    barcode: '8801001000147',
    name: 'Circular Saw 7.25"',
    categoryId: 'c2',
    brandId: 'b2',
    unit: 'pc',
    availableUnits: ['pc'],
    cost: 9200,
    price: 11500,
    stock: 0,
    reorderLevel: 4,
  },
  {
    id: 'p15',
    sku: 'PL-TAP-MX',
    barcode: '8801001000154',
    name: 'Bathroom Mixer Tap',
    categoryId: 'c3',
    brandId: 'b4',
    unit: 'pc',
    availableUnits: ['pc', 'box'],
    cost: 1450,
    price: 1950,
    stock: 18,
    reorderLevel: 5,
  },
  {
    id: 'p16',
    sku: 'PN-PRMR-4L',
    barcode: '8801001000161',
    name: 'Wall Primer 4L',
    categoryId: 'c5',
    brandId: 'b5',
    unit: 'pc',
    availableUnits: ['pc', 'box'],
    cost: 980,
    price: 1280,
    stock: 24,
    reorderLevel: 6,
  },
];

export const customers: Customer[] = [
  {
    id: 'cu1',
    name: 'Walk-in Customer',
    phone: '-',
    group: 'Retail',
    due: 0,
    totalPurchase: 0,
    joined: '2024-01-01',
  },
  {
    id: 'cu2',
    name: 'Rahim Construction',
    phone: '01711-220011',
    email: 'rahim@construction.bd',
    address: 'Mirpur 10, Dhaka',
    group: 'Contractor',
    due: 28500,
    totalPurchase: 1250000,
    totalPaid: 1221500,
    joined: '2023-03-12',
    creditLimit: 500000,
    tags: ['VIP', 'B2B'],
    lastSaleAt: '2026-05-26T11:42:00',
  },
  {
    id: 'cu3',
    name: 'Karim Bhai',
    phone: '01911-882200',
    group: 'Retail',
    due: 0,
    totalPurchase: 18450,
    joined: '2024-06-22',
  },
  {
    id: 'cu4',
    name: 'New Era Builders',
    phone: '01511-330077',
    address: 'Uttara, Dhaka',
    group: 'Wholesale',
    due: 142000,
    totalPurchase: 4200000,
    joined: '2022-09-08',
    creditLimit: 200000, // OVER limit on purpose to demo warning
  },
  {
    id: 'cu5',
    name: 'Salma Akter',
    phone: '01811-995544',
    group: 'Retail',
    due: 1250,
    totalPurchase: 6800,
    joined: '2025-02-14',
  },
  {
    id: 'cu6',
    name: 'Hasan Electric',
    phone: '01611-447788',
    group: 'Wholesale',
    due: 8400,
    totalPurchase: 320000,
    joined: '2024-08-19',
  },
];

export const suppliers: Supplier[] = [
  {
    id: 's1',
    name: 'BSRM Steels Ltd',
    contactPerson: 'Md. Anwar Hossain',
    phone: '02-9889600',
    company: 'BSRM',
    address: 'Chittagong, Bangladesh',
    paymentTerms: 'Net30',
    leadTimeDays: 5,
    due: 0,
    totalPurchase: 8400000,
  },
  {
    id: 's2',
    name: 'Berger Paints BD',
    contactPerson: 'Salim Mia',
    phone: '02-8836400',
    address: 'Tejgaon, Dhaka',
    paymentTerms: 'Net15',
    leadTimeDays: 3,
    due: 12000,
    totalPurchase: 1850000,
  },
  {
    id: 's3',
    name: 'RFL Plastics',
    contactPerson: 'Rana Ahmed',
    phone: '02-7791234',
    paymentTerms: 'Cash',
    leadTimeDays: 2,
    due: 0,
    totalPurchase: 920000,
  },
  {
    id: 's4',
    name: 'Bosch BD Distributor',
    contactPerson: 'Tariq Aziz',
    phone: '01711-000001',
    paymentTerms: 'Net30',
    leadTimeDays: 7,
    due: 84000,
    totalPurchase: 1200000,
  },
];

export const recentSales: Sale[] = [
  {
    id: 'sl1',
    invoiceNo: 'INV-2026-0451',
    date: '2026-05-26T11:42:00',
    customerId: 'cu2',
    customerName: 'Rahim Construction',
    items: 8,
    subtotal: 18450,
    discount: 450,
    tax: 900,
    total: 18900,
    paid: 10000,
    due: 8900,
    status: 'partial',
    paymentMethod: 'Mixed',
    user: 'Seam',
  },
  {
    id: 'sl2',
    invoiceNo: 'INV-2026-0450',
    date: '2026-05-26T11:18:00',
    customerId: 'cu3',
    customerName: 'Karim Bhai',
    items: 3,
    subtotal: 1240,
    discount: 0,
    tax: 62,
    total: 1302,
    paid: 1302,
    due: 0,
    status: 'paid',
    paymentMethod: 'Cash',
    user: 'Seam',
  },
  {
    id: 'sl3',
    invoiceNo: 'INV-2026-0449',
    date: '2026-05-26T10:54:00',
    customerId: 'cu4',
    customerName: 'New Era Builders',
    items: 24,
    subtotal: 84200,
    discount: 1200,
    tax: 4150,
    total: 87150,
    paid: 50000,
    due: 37150,
    status: 'partial',
    paymentMethod: 'Bank',
    user: 'Faruq',
  },
  {
    id: 'sl4',
    invoiceNo: 'INV-2026-0448',
    date: '2026-05-26T10:31:00',
    customerId: 'cu1',
    customerName: 'Walk-in Customer',
    items: 2,
    subtotal: 685,
    discount: 0,
    tax: 0,
    total: 685,
    paid: 685,
    due: 0,
    status: 'paid',
    paymentMethod: 'bKash',
    user: 'Seam',
  },
  {
    id: 'sl5',
    invoiceNo: 'INV-2026-0447',
    date: '2026-05-26T10:08:00',
    customerId: 'cu5',
    customerName: 'Salma Akter',
    items: 1,
    subtotal: 1280,
    discount: 0,
    tax: 64,
    total: 1344,
    paid: 0,
    due: 1344,
    status: 'due',
    paymentMethod: 'Credit',
    user: 'Seam',
  },
  {
    id: 'sl6',
    invoiceNo: 'INV-2026-0446',
    date: '2026-05-26T09:42:00',
    customerId: 'cu6',
    customerName: 'Hasan Electric',
    items: 6,
    subtotal: 24600,
    discount: 600,
    tax: 1200,
    total: 25200,
    paid: 25200,
    due: 0,
    status: 'paid',
    paymentMethod: 'Card',
    user: 'Seam',
  },
];

export const todayStats = {
  sales: 134420,
  transactions: 47,
  itemsSold: 312,
  newCustomers: 3,
  topItems: [
    { name: 'Cement OPC 50kg', qty: 84, total: 45360 },
    { name: 'MS Rebar 12mm', qty: 620, total: 63240 },
    { name: 'PVC Pipe 1" x 20ft', qty: 28, total: 11760 },
    { name: 'LED Bulb 9W', qty: 42, total: 5880 },
  ],
  hourly: [
    { hour: '9 AM', sales: 4200 },
    { hour: '10 AM', sales: 12800 },
    { hour: '11 AM', sales: 22400 },
    { hour: '12 PM', sales: 18600 },
    { hour: '1 PM', sales: 8400 },
    { hour: '2 PM', sales: 14200 },
    { hour: '3 PM', sales: 21800 },
    { hour: '4 PM', sales: 19400 },
    { hour: '5 PM', sales: 12620 },
  ],
};

export const lowStock = products.filter((p) => p.stock <= p.reorderLevel);

export function brandName(id: string) {
  return brands.find((b) => b.id === id)?.name ?? '—';
}
export function categoryName(id: string) {
  return categories.find((c) => c.id === id)?.name ?? '—';
}


// ---------- Extra mock data for richer dashboard widgets ----------

export const dashboardMock = {
  todayProfit: {
    revenue: 134420,
    cogs: 92840,
    grossProfit: 41580,
    expenses: 11400,
    netProfit: 30180,
    marginPct: 22.5,
    deltaVsYesterday: 14.2,
  },
  todayProfitDetail: {
    // Left column
    openingStockByPurchase: 1359751.6,
    openingStockBySale: 1326510.5,
    totalPurchaseExclTaxDisc: 0,
    totalStockAdjustment: 0,
    totalExpense: 11400,
    totalPurchaseShipping: 0,
    totalTransferShipping: 0,
    totalSellDiscount: 1650,
    totalCustomerReward: 0,
    totalSellReturn: 1344,
    // Right column
    closingStockByPurchase: 1369751.6,
    closingStockBySale: 1376510.5,
    totalSalesExclTaxDisc: 134420,
    totalSellShipping: 0,
    totalStockRecovered: 0,
    totalPurchaseReturn: 0,
    totalPurchaseDiscount: 0,
    totalSellRoundOff: 0,
  },
  cashInDrawer: 84200 + 5000 - 14200, // opening + in - out (matches CashRegister)
  customerDuesTotal: customers.reduce((s, c) => s + c.due, 0),
  supplierDuesTotal: suppliers.reduce((s, c) => s + c.due, 0),
  outOfStockCount: products.filter((p) => p.stock === 0).length,
  todayExpenses: 11400,
  todayPurchases: 184500,
  returnsToday: 1,

  salesTrend7d: [
    { day: 'Tue', sales: 98400 },
    { day: 'Wed', sales: 112300 },
    { day: 'Thu', sales: 88200 },
    { day: 'Fri', sales: 76500 },
    { day: 'Sat', sales: 142000 },
    { day: 'Sun', sales: 121600 },
    { day: 'Mon', sales: 134420 },
  ],

  monthlyCompare: [
    { month: 'Dec', sales: 2840000, purchases: 1650000, expenses: 380000 },
    { month: 'Jan', sales: 3120000, purchases: 1840000, expenses: 410000 },
    { month: 'Feb', sales: 2960000, purchases: 1720000, expenses: 395000 },
    { month: 'Mar', sales: 3280000, purchases: 1980000, expenses: 420000 },
    { month: 'Apr', sales: 3540000, purchases: 2100000, expenses: 445000 },
    { month: 'May', sales: 3680000, purchases: 2240000, expenses: 460000 },
  ],

  topCustomers: [
    { name: 'New Era Builders', total: 4200000, orders: 142 },
    { name: 'Rahim Construction', total: 1250000, orders: 86 },
    { name: 'Hasan Electric', total: 320000, orders: 41 },
    { name: 'Karim Bhai', total: 18450, orders: 12 },
    { name: 'Salma Akter', total: 6800, orders: 4 },
  ],

  recentPurchases: [
    { ref: 'PO-2026-0042', supplier: 'BSRM Steels Ltd', total: 425000, date: '2026-05-25' },
    { ref: 'PO-2026-0041', supplier: 'Berger Paints BD', total: 84500, date: '2026-05-23' },
    { ref: 'PO-2026-0040', supplier: 'Bosch BD', total: 124000, date: '2026-05-20' },
  ],

  expenseBreakdown: [
    { name: 'Rent', value: 45000 },
    { name: 'Salary', value: 86000 },
    { name: 'Utilities', value: 12400 },
    { name: 'Transport', value: 8600 },
    { name: 'Misc', value: 4200 },
  ],

  paymentMethodBreakdown: [
    { name: 'Cash', value: 58200 },
    { name: 'bKash', value: 24800 },
    { name: 'Nagad', value: 9400 },
    { name: 'Card', value: 18200 },
    { name: 'Bank', value: 19000 },
    { name: 'Credit', value: 4820 },
  ],

  activityFeed: [
    { id: 'a1', time: '11:42', type: 'sale', text: 'INV-2026-0451 created · Rahim Construction · ৳18,900' },
    { id: 'a2', time: '11:40', type: 'stock', text: 'Low stock: Safety Helmet (4 pc)' },
    { id: 'a3', time: '11:18', type: 'sale', text: 'INV-2026-0450 created · Karim Bhai · ৳1,302' },
    { id: 'a4', time: '11:02', type: 'payment', text: 'Payment received · New Era Builders · ৳50,000' },
    { id: 'a5', time: '10:50', type: 'expense', text: 'Expense added · Petty cash transport · ৳3,200' },
    { id: 'a6', time: '10:31', type: 'sale', text: 'INV-2026-0448 created · Walk-in · ৳685' },
    { id: 'a7', time: '10:14', type: 'purchase', text: 'PO-2026-0042 received · BSRM · ৳425,000' },
    { id: 'a8', time: '09:00', type: 'shift', text: 'Shift #1234 opened by Seam · Opening cash ৳5,000' },
  ],

  birthdays: [
    { name: 'Karim Bhai', phone: '01911-882200', when: 'Today' },
    { name: 'Rahim Uddin', phone: '01711-220011', when: 'Tomorrow' },
    { name: 'Salma Akter', phone: '01811-995544', when: 'In 3 days' },
  ],
};
