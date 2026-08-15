/**
 * English → Bangla UI dictionary.
 *
 * Keys are the EXACT English text rendered in the UI (trimmed, whitespace
 * collapsed). The runtime translator (`src/lib/bn/translate.ts`) does an
 * exact-match lookup, so shop DATA (product names, customer names, invoice
 * numbers) never matches and is always left untouched.
 *
 * Adding a translation = adding one line here. No component edits needed.
 */
export const BN: Record<string, string> = {
  // ---------------------------------------------------------------- navigation
  Dashboard: 'ড্যাশবোর্ড',
  POS: 'বিক্রয় কাউন্টার',
  Sales: 'বিক্রয়',
  Purchases: 'ক্রয়',
  Products: 'পণ্য',
  Stock: 'স্টক',
  Contacts: 'খাতা',
  Expenses: 'খরচ',
  'Cash Register': 'ক্যাশ বাক্স',
  Reports: 'হিসাব',
  SMS: 'এসএমএস',
  Settings: 'সেটিংস',
  'More & Settings': 'আরও ও সেটিংস',
  More: 'আরও',

  'All Sales': 'সব বিক্রয়',
  'New Sale': 'নতুন বিক্রয়',
  Drafts: 'খসড়া',
  Quotations: 'দরপত্র',
  'Sell Returns': 'বিক্রয় ফেরত',
  Shipments: 'ডেলিভারি',
  'All Purchases': 'সব ক্রয়',
  'Add Purchase': 'ক্রয় যোগ করুন',
  'New Purchase': 'নতুন ক্রয়',
  'Purchase Returns': 'ক্রয় ফেরত',
  'All Products': 'সব পণ্য',
  Categories: 'ক্যাটাগরি',
  'Expense Categories': 'খরচের ক্যাটাগরি',
  Brands: 'ব্র্যান্ড',
  Units: 'একক',
  Variations: 'ভ্যারিয়েশন',
  'Bulk Price Update': 'একসাথে দাম পরিবর্তন',
  'Bulk price update': 'একসাথে দাম পরিবর্তন',
  'Price Groups': 'দামের গ্রুপ',
  'Barcode Print': 'বারকোড প্রিন্ট',
  Warranties: 'ওয়ারেন্টি',
  'Stock Report': 'স্টক রিপোর্ট',
  'Stock Alerts': 'স্টক সতর্কতা',
  Transfers: 'স্থানান্তর',
  'Stock Transfers': 'স্টক স্থানান্তর',
  'Damage / Adjustment': 'ক্ষতি / সমন্বয়',
  Adjustments: 'সমন্বয়',
  Customers: 'গ্রাহক',
  Suppliers: 'সরবরাহকারী',
  'Customer Groups': 'গ্রাহক গ্রুপ',
  'Customer Dues': 'গ্রাহকের বাকি',
  'Supplier Dues': 'সরবরাহকারীর বাকি',
  'All Expenses': 'সব খরচ',
  'Open / Close Shift': 'শিফট খোলা / বন্ধ',
  'Register Report': 'ক্যাশ রিপোর্ট',

  // ---------------------------------------------------------------- titlebar
  Offline: 'অফলাইন',
  Online: 'অনলাইন',
  'Shift Open': 'শিফট খোলা',
  'No active shift': 'কোনো শিফট খোলা নেই',
  'Open Cash Register': 'ক্যাশ বাক্স খুলুন',
  'Manage users': 'ব্যবহারকারী ব্যবস্থাপনা',
  'Lock screen': 'স্ক্রিন লক',
  'Sign out': 'সাইন আউট',
  'Signed out': 'সাইন আউট হয়েছে',
  'Signed in': 'সাইন ইন হয়েছে',
  'Light mode': 'আলো মোড',
  'Dark mode': 'অন্ধকার মোড',
  'Switch to Bangla': 'বাংলায় পরিবর্তন করুন',
  'Compact density': 'ঘন বিন্যাস',
  'Comfortable density': 'আরামদায়ক বিন্যাস',
  Guest: 'অতিথি',
  User: 'ব্যবহারকারী',
  Users: 'ব্যবহারকারী',
  Admin: 'অ্যাডমিন',
  Cashier: 'ক্যাশিয়ার',
  Manager: 'ম্যানেজার',

  // ---------------------------------------------------------------- common verbs
  Save: 'সংরক্ষণ',
  'Save Changes': 'পরিবর্তন সংরক্ষণ',
  'Save changes': 'পরিবর্তন সংরক্ষণ',
  Saved: 'সংরক্ষিত হয়েছে',
  Cancel: 'বাতিল',
  Delete: 'মুছুন',
  Edit: 'সম্পাদনা',
  'Quick edit': 'দ্রুত সম্পাদনা',
  Add: 'যোগ করুন',
  'Add new': 'নতুন যোগ করুন',
  Create: 'তৈরি করুন',
  Update: 'হালনাগাদ',
  Remove: 'সরান',
  Close: 'বন্ধ',
  Back: 'ফিরে যান',
  'Back to list': 'তালিকায় ফিরুন',
  Next: 'পরবর্তী',
  Previous: 'পূর্ববর্তী',
  Done: 'সম্পন্ন',
  Confirm: 'নিশ্চিত করুন',
  Apply: 'প্রয়োগ করুন',
  Reset: 'রিসেট',
  Clear: 'মুছে ফেলুন',
  'Clear all': 'সব মুছুন',
  Retry: 'আবার চেষ্টা করুন',
  Print: 'প্রিন্ট',
  Export: 'এক্সপোর্ট',
  Import: 'ইম্পোর্ট',
  'Import another': 'আরেকটি ইম্পোর্ট',
  Search: 'খুঁজুন',
  Filters: 'ফিল্টার',
  View: 'দেখুন',
  Preview: 'প্রিভিউ',
  Duplicate: 'অনুলিপি',
  Send: 'পাঠান',
  Sent: 'পাঠানো হয়েছে',
  Receive: 'গ্রহণ করুন',
  Received: 'গৃহীত',
  Pay: 'পরিশোধ',
  Refund: 'ফেরত',
  Void: 'বাতিল',
  Loading: 'লোড হচ্ছে',
  'Loading…': 'লোড হচ্ছে…',
  'Set default': 'ডিফল্ট করুন',
  Default: 'ডিফল্ট',
  Custom: 'কাস্টম',
  Manual: 'ম্যানুয়াল',
  Automatic: 'স্বয়ংক্রিয়',
  Actions: 'কার্যক্রম',
  Options: 'অপশন',
  Summary: 'সারসংক্ষেপ',
  Details: 'বিবরণ',
  Change: 'পরিবর্তন',
  Select: 'নির্বাচন করুন',
  Choose: 'বেছে নিন',
  Yes: 'হ্যাঁ',
  No: 'না',
  OK: 'ঠিক আছে',
  Error: 'ত্রুটি',
  Failed: 'ব্যর্থ',
  Warning: 'সতর্কতা',
  Success: 'সফল',
  Note: 'নোট',
  Notes: 'নোট',
  Optional: 'ঐচ্ছিক',
  Required: 'আবশ্যক',

  // ---------------------------------------------------------------- table / fields
  Date: 'তারিখ',
  Time: 'সময়',
  Status: 'অবস্থা',
  Total: 'মোট',
  Subtotal: 'উপমোট',
  Paid: 'পরিশোধিত',
  Due: 'বাকি',
  Amount: 'পরিমাণ',
  Qty: 'পরিমাণ',
  Quantity: 'পরিমাণ',
  Price: 'দাম',
  Cost: 'ক্রয়মূল্য',
  Discount: 'ছাড়',
  Tax: 'ভ্যাট',
  Shipping: 'পরিবহন',
  Name: 'নাম',
  'Full name': 'পুরো নাম',
  Phone: 'ফোন',
  'Alternate phone': 'বিকল্প ফোন',
  Email: 'ইমেইল',
  Address: 'ঠিকানা',
  Reference: 'রেফারেন্স',
  Ref: 'রেফ',
  Invoice: 'ইনভয়েস',
  Product: 'পণ্য',
  Item: 'আইটেম',
  Items: 'আইটেম',
  Lines: 'লাইন',
  Customer: 'গ্রাহক',
  Supplier: 'সরবরাহকারী',
  Branch: 'শাখা',
  Branches: 'শাখা',
  Category: 'ক্যাটাগরি',
  Brand: 'ব্র্যান্ড',
  Unit: 'একক',
  SKU: 'এসকেইউ',
  Barcode: 'বারকোড',
  Description: 'বিবরণ',
  Image: 'ছবি',
  Type: 'ধরন',
  Method: 'মাধ্যম',
  Reason: 'কারণ',
  Group: 'গ্রুপ',
  Tags: 'ট্যাগ',
  Company: 'প্রতিষ্ঠান',
  Shop: 'দোকান',
  Count: 'সংখ্যা',
  Margin: 'মুনাফার হার',
  Profit: 'লাভ',
  Revenue: 'আয়',
  Expected: 'প্রত্যাশিত',
  Counted: 'গণনা করা',
  Opening: 'প্রারম্ভিক',
  Closing: 'সমাপনী',
  Payable: 'প্রদেয়',
  Outstanding: 'অপরিশোধিত',
  Payment: 'পরিশোধ',
  Transactions: 'লেনদেন',
  Balance: 'ব্যালেন্স',
  'Credit Limit': 'বাকির সীমা',
  Terms: 'শর্তাবলী',
  People: 'মানুষ',
  Other: 'অন্যান্য',
  'Contact person': 'যোগাযোগের ব্যক্তি',
  Username: 'ইউজারনেম',
  Password: 'পাসওয়ার্ড',
  PIN: 'পিন',
  'Base unit': 'মূল একক',
  Reorder: 'পুনরায় অর্ডার',
  'Reorder level': 'পুনঃঅর্ডার সীমা',
  'Opening stock': 'প্রারম্ভিক স্টক',
  'Total Value': 'মোট মূল্য',
  'Net value': 'নিট মূল্য',
  'Disc %': 'ছাড় %',
  'Tax %': 'ভ্যাট %',
  'Order discount': 'অর্ডারে ছাড়',
  'Order Discount': 'অর্ডারে ছাড়',
  'Other charges': 'অন্যান্য চার্জ',
  'Payment method': 'পরিশোধের মাধ্যম',
  'Currency symbol': 'মুদ্রার প্রতীক',
  'Default language': 'ডিফল্ট ভাষা',

  // ---------------------------------------------------------------- payment methods
  Cash: 'নগদ',
  Card: 'কার্ড',
  Bank: 'ব্যাংক',
  Cheque: 'চেক',
  Credit: 'বাকি',
  Debit: 'ডেবিট',
  'Bank transfer': 'ব্যাংক ট্রান্সফার',
  'Cash refund': 'নগদ ফেরত',
  'Cash In': 'নগদ জমা',
  'Cash Out': 'নগদ উত্তোলন',
  'Cash in / out': 'নগদ জমা / উত্তোলন',
  'Cash in Drawer': 'বাক্সে নগদ',
  'All methods': 'সব মাধ্যম',
  Mixed: 'মিশ্র',
  Partial: 'আংশিক',
  'Full due': 'সম্পূর্ণ বাকি',

  // ---------------------------------------------------------------- statuses
  Active: 'সক্রিয়',
  Inactive: 'নিষ্ক্রিয়',
  Draft: 'খসড়া',
  Quotation: 'দরপত্র',
  Sale: 'বিক্রয়',
  Purchase: 'ক্রয়',
  Expense: 'খরচ',
  Final: 'চূড়ান্ত',
  Pending: 'অপেক্ষমাণ',
  Completed: 'সম্পন্ন',
  Cancelled: 'বাতিল',
  Delivered: 'পৌঁছে দেওয়া হয়েছে',
  Queued: 'অপেক্ষমাণ',
  Suspended: 'স্থগিত',
  Closed: 'বন্ধ',
  Opened: 'খোলা হয়েছে',
  Expired: 'মেয়াদ শেষ',
  Ready: 'প্রস্তুত',
  Low: 'কম',
  'Low Stock': 'কম স্টক',
  'Out of Stock': 'স্টক নেই',
  'In Stock': 'স্টক আছে',
  Damaged: 'ক্ষতিগ্রস্ত',
  Defective: 'ত্রুটিপূর্ণ',
  'Wrong item': 'ভুল পণ্য',
  'Customer changed mind': 'গ্রাহক মত পরিবর্তন করেছেন',
  'Needs review': 'পর্যালোচনা প্রয়োজন',
  Connected: 'সংযুক্ত',
  'Not connected': 'সংযুক্ত নয়',
  Never: 'কখনো নয়',
  None: 'কিছুই নয়',
  All: 'সব',
  'All categories': 'সব ক্যাটাগরি',
  'All Categories': 'সব ক্যাটাগরি',
  'All brands': 'সব ব্র্যান্ড',
  'All Brands': 'সব ব্র্যান্ড',
  'All branches': 'সব শাখা',
  'All status': 'সব অবস্থা',
  'All users': 'সব ব্যবহারকারী',

  // ---------------------------------------------------------------- date ranges
  Today: 'আজ',
  Yesterday: 'গতকাল',
  'This week': 'এই সপ্তাহ',
  'This month': 'এই মাস',
  'Last month': 'গত মাস',
  'This year': 'এই বছর',
  Daily: 'দৈনিক',
  Weekly: 'সাপ্তাহিক',
  Monthly: 'মাসিক',
  Yearly: 'বার্ষিক',
  From: 'থেকে',
  To: 'পর্যন্ত',

  // ---------------------------------------------------------------- POS
  'Walk-in Customer': 'সাধারণ গ্রাহক',
  'Pick customer': 'গ্রাহক নির্বাচন করুন',
  'Search product or SKU…': 'পণ্য বা এসকেইউ খুঁজুন…',
  'Search product…': 'পণ্য খুঁজুন…',
  'Search above to add items.': 'আইটেম যোগ করতে উপরে খুঁজুন।',
  'No products match.': 'কোনো পণ্য মেলেনি।',
  'Save as Draft': 'খসড়া হিসেবে সংরক্ষণ',
  'Save as Quotation': 'দরপত্র হিসেবে সংরক্ষণ',
  'Hold cart': 'কার্ট ধরে রাখুন',
  'Reprint last receipt': 'শেষ রসিদ আবার প্রিন্ট',
  'Focus product search': 'পণ্য খোঁজায় যান',
  'Apply order discount': 'অর্ডারে ছাড় দিন',
  'Apply cart-level discount': 'কার্টে ছাড় দিন',
  'Keyboard Shortcuts': 'কীবোর্ড শর্টকাট',
  'Customize columns': 'কলাম সাজান',
  'Customize Columns': 'কলাম সাজান',
  'Show, hide, and reorder columns': 'কলাম দেখান, লুকান ও সাজান',
  'Grid view': 'গ্রিড ভিউ',
  Receipt: 'রসিদ',
  'Save Payment': 'পরিশোধ সংরক্ষণ',
  'Add Payment': 'পরিশোধ যোগ করুন',
  'Receive payment': 'টাকা গ্রহণ',
  'Receive Payment': 'টাকা গ্রহণ',
  'Payment received': 'টাকা গৃহীত হয়েছে',
  'Convert to Sale': 'বিক্রয়ে রূপান্তর',
  'Create Return': 'ফেরত তৈরি করুন',
  'Create sale': 'বিক্রয় তৈরি করুন',
  'Create product': 'পণ্য তৈরি করুন',
  'Create purchase': 'ক্রয় তৈরি করুন',
  'Create expense': 'খরচ তৈরি করুন',

  // ---------------------------------------------------------------- cash register
  'Open Shift': 'শিফট খুলুন',
  'Close Shift': 'শিফট বন্ধ করুন',
  'Close shift': 'শিফট বন্ধ করুন',
  Shift: 'শিফট',
  'Current shift summary': 'বর্তমান শিফটের সারসংক্ষেপ',
  'Opening balance (৳)': 'প্রারম্ভিক ব্যালেন্স (৳)',
  'Carried as next float': 'পরবর্তী শিফটে স্থানান্তরিত',
  'Go to Cash Register': 'ক্যাশ বাক্সে যান',

  // ---------------------------------------------------------------- reports
  'Profit / Loss': 'লাভ / ক্ষতি',
  'Profit / Loss Report': 'লাভ / ক্ষতি রিপোর্ট',
  'Gross Profit': 'মোট লাভ',
  'Net Profit': 'নিট লাভ',
  "Today's Profit": 'আজকের লাভ',
  'Cost of goods sold (COGS)': 'বিক্রীত পণ্যের ক্রয়মূল্য',
  'Closing stock': 'সমাপনী স্টক',
  'Sell returns': 'বিক্রয় ফেরত',
  'Purchase returns': 'ক্রয় ফেরত',
  'Total sales (excl. tax & disc.)': 'মোট বিক্রয় (ভ্যাট ও ছাড় ছাড়া)',
  'Total Purchase': 'মোট ক্রয়',
  'Total Paid': 'মোট পরিশোধিত',
  'Items Report': 'পণ্য রিপোর্ট',
  'Tax Report': 'ভ্যাট রিপোর্ট',
  'Product Sell Report': 'পণ্য বিক্রয় রিপোর্ট',
  'Product Purchase Report': 'পণ্য ক্রয় রিপোর্ট',
  'Sell Payment Report': 'বিক্রয় পরিশোধ রিপোর্ট',
  'Purchase Payment Report': 'ক্রয় পরিশোধ রিপোর্ট',
  'Customer Group Report': 'গ্রাহক গ্রুপ রিপোর্ট',
  'Sales Rep Report': 'বিক্রয় প্রতিনিধি রিপোর্ট',
  'Expense Breakdown': 'খরচের বিশ্লেষণ',
  'Activity Log': 'কার্যক্রমের লগ',
  'Activity Feed': 'কার্যক্রম',
  'Trending Products': 'জনপ্রিয় পণ্য',
  'Best sellers today': 'আজকের সর্বাধিক বিক্রীত',
  'By total revenue': 'মোট আয় অনুসারে',
  'Current stock + value': 'বর্তমান স্টক ও মূল্য',
  'No data in this range.': 'এই সময়সীমায় কোনো তথ্য নেই।',
  'Export reports': 'রিপোর্ট এক্সপোর্ট',
  'Customers with Due': 'বাকিসহ গ্রাহক',
  'Items at or below reorder': 'পুনঃঅর্ডার সীমায় বা নিচে',

  // ---------------------------------------------------------------- settings
  'Business Info': 'ব্যবসার তথ্য',
  'Business Location': 'ব্যবসার ঠিকানা',
  'Edit business info': 'ব্যবসার তথ্য সম্পাদনা',
  'Currency & Tax': 'মুদ্রা ও ভ্যাট',
  'Tax Rates': 'ভ্যাটের হার',
  'Invoice Schemes': 'ইনভয়েস নম্বর পদ্ধতি',
  'Receipt Printers': 'রসিদ প্রিন্টার',
  'Receipt Template': 'রসিদের নমুনা',
  'Barcode Settings': 'বারকোড সেটিংস',
  'POS Preferences': 'বিক্রয় কাউন্টার পছন্দ',
  'Theme & Appearance': 'থিম ও চেহারা',
  'Roles & Permissions': 'ভূমিকা ও অনুমতি',
  'What each role can do': 'প্রতিটি ভূমিকা কী করতে পারে',
  'Sales Commission Agents': 'বিক্রয় কমিশন এজেন্ট',
  'Backup & Sync': 'ব্যাকআপ ও সিঙ্ক',
  'Backup / restore': 'ব্যাকআপ / পুনরুদ্ধার',
  Preferences: 'পছন্দ',
  Appearance: 'চেহারা',
  Light: 'আলো',
  Dark: 'অন্ধকার',
  System: 'সিস্টেম',
  English: 'ইংরেজি',
  Bangla: 'বাংলা',
  'Add Branch': 'শাখা যোগ করুন',
  'Add User': 'ব্যবহারকারী যোগ করুন',
  'Add Role': 'ভূমিকা যোগ করুন',
  'Add Rate': 'হার যোগ করুন',
  'Add Unit': 'একক যোগ করুন',
  'Add Category': 'ক্যাটাগরি যোগ করুন',
  'Add Group': 'গ্রুপ যোগ করুন',
  'Add Customer': 'গ্রাহক যোগ করুন',
  'Add Supplier': 'সরবরাহকারী যোগ করুন',
  'Add Product': 'পণ্য যোগ করুন',
  'New Product': 'নতুন পণ্য',
  'Add Expense': 'খরচ যোগ করুন',
  'Add Printer': 'প্রিন্টার যোগ করুন',
  'Add Warranty': 'ওয়ারেন্টি যোগ করুন',
  'Add Agent': 'এজেন্ট যোগ করুন',
  'Add and manage shop branches': 'দোকানের শাখা যোগ ও পরিচালনা',
  'Add to inventory': 'ইনভেন্টরিতে যোগ করুন',

  // ---------------------------------------------------------------- toasts
  'Save failed': 'সংরক্ষণ ব্যর্থ',
  'Delete failed': 'মুছে ফেলা ব্যর্থ',
  'Add failed': 'যোগ করা ব্যর্থ',
  'Login failed': 'সাইন ইন ব্যর্থ',
  'Duplicate failed': 'অনুলিপি ব্যর্থ',
  'Incorrect PIN': 'ভুল পিন',
  'Account is not active': 'অ্যাকাউন্ট সক্রিয় নয়',
  'Product saved': 'পণ্য সংরক্ষিত হয়েছে',
  'Brand added': 'ব্র্যান্ড যোগ হয়েছে',
  'Brand deleted': 'ব্র্যান্ড মুছে ফেলা হয়েছে',
  'Brand renamed': 'ব্র্যান্ডের নাম পরিবর্তিত',
  'Category deleted': 'ক্যাটাগরি মুছে ফেলা হয়েছে',
  'Business info saved': 'ব্যবসার তথ্য সংরক্ষিত',
  'Appearance saved': 'চেহারা সংরক্ষিত',
  'Appearance reset to defaults': 'চেহারা ডিফল্টে ফেরানো হয়েছে',
  'Barcode settings saved': 'বারকোড সেটিংস সংরক্ষিত',
  'Cash register settings saved': 'ক্যাশ বাক্সের সেটিংস সংরক্ষিত',
  'Gateway settings saved': 'গেটওয়ে সেটিংস সংরক্ষিত',
  'Deleted draft': 'খসড়া মুছে ফেলা হয়েছে',
  'Cannot delete default': 'ডিফল্ট মুছে ফেলা যাবে না',
  'Cannot delete the default branch': 'ডিফল্ট শাখা মুছে ফেলা যাবে না',
  'Cannot delete the default tax rate': 'ডিফল্ট ভ্যাটের হার মুছে ফেলা যাবে না',
  'Cannot delete the owner account': 'মালিকের অ্যাকাউন্ট মুছে ফেলা যাবে না',
  'Couldn’t load — backend error. Check connection and retry.':
    'লোড করা যায়নি — সার্ভারে ত্রুটি। সংযোগ দেখে আবার চেষ্টা করুন।',
  'Delete sale?': 'বিক্রয়টি মুছে ফেলবেন?',
  'Delete product': 'পণ্য মুছুন',
  'Delete expense': 'খরচ মুছুন',
  'Edit product': 'পণ্য সম্পাদনা',
  'Edit sale': 'বিক্রয় সম্পাদনা',
  'Edit purchase': 'ক্রয় সম্পাদনা',
  'Edit Customer': 'গ্রাহক সম্পাদনা',
  'Edit Supplier': 'সরবরাহকারী সম্পাদনা',
  'Failed to save': 'সংরক্ষণ ব্যর্থ',
  'Failed to load sales': 'বিক্রয় লোড করা যায়নি',
  'Failed to load purchases': 'ক্রয় লোড করা যায়নি',
  'Failed to load customers': 'গ্রাহক লোড করা যায়নি',
  'Failed to load suppliers': 'সরবরাহকারী লোড করা যায়নি',
  'Failed to load products': 'পণ্য লোড করা যায়নি',
  'Failed to load expenses': 'খরচ লোড করা যায়নি',
  'Failed to load dashboard': 'ড্যাশবোর্ড লোড করা যায়নি',
  'Failed to load settings': 'সেটিংস লোড করা যায়নি',
  'Failed to load branches': 'শাখা লোড করা যায়নি',
  'Failed to load users': 'ব্যবহারকারী লোড করা যায়নি',
  'Failed to load cash register': 'ক্যাশ বাক্স লোড করা যায়নি',
  'Failed to load stock operations': 'স্টক কার্যক্রম লোড করা যায়নি',
  'Failed to record sale': 'বিক্রয় সংরক্ষণ করা যায়নি',
  'Failed to record payment': 'পরিশোধ সংরক্ষণ করা যায়নি',
  'Failed to record cash movement': 'নগদ লেনদেন সংরক্ষণ করা যায়নি',
  'Failed to save sale': 'বিক্রয় সংরক্ষণ ব্যর্থ',
  'Failed to save purchase': 'ক্রয় সংরক্ষণ ব্যর্থ',
  'Failed to save customer': 'গ্রাহক সংরক্ষণ ব্যর্থ',
  'Failed to save supplier': 'সরবরাহকারী সংরক্ষণ ব্যর্থ',
  'Failed to save expense': 'খরচ সংরক্ষণ ব্যর্থ',
  'Failed to save return': 'ফেরত সংরক্ষণ ব্যর্থ',
  'Failed to save transfer': 'স্থানান্তর সংরক্ষণ ব্যর্থ',
  'Failed to save adjustment': 'সমন্বয় সংরক্ষণ ব্যর্থ',
  'Failed to close shift': 'শিফট বন্ধ করা যায়নি',
  'Failed to void sale': 'বিক্রয় বাতিল করা যায়নি',
  'Failed to delete sale': 'বিক্রয় মুছে ফেলা যায়নি',
  'Failed to delete product': 'পণ্য মুছে ফেলা যায়নি',
  'Failed to delete customer': 'গ্রাহক মুছে ফেলা যায়নি',
  'Failed to delete supplier': 'সরবরাহকারী মুছে ফেলা যায়নি',
  'Failed to delete expense': 'খরচ মুছে ফেলা যায়নি',
  'Failed to pay supplier': 'সরবরাহকারীকে পরিশোধ করা যায়নি',
  'Failed to receive transfer': 'স্থানান্তর গ্রহণ করা যায়নি',

  // ---------------------------------------------------------------- import / csv
  'Click to choose a CSV file': 'একটি CSV ফাইল বেছে নিতে ক্লিক করুন',
  'Click to upload': 'আপলোড করতে ক্লিক করুন',
  'Download template': 'নমুনা ফাইল ডাউনলোড',
  'CSV format': 'CSV ফরম্যাট',
  'CSV format (one row per line item)': 'CSV ফরম্যাট (প্রতি লাইনে একটি আইটেম)',
  'Import Sales': 'বিক্রয় ইম্পোর্ট',
  'Import Purchases': 'ক্রয় ইম্পোর্ট',
  'Import Products': 'পণ্য ইম্পোর্ট',
  'Import Customers': 'গ্রাহক ইম্পোর্ট',
  'Import Suppliers': 'সরবরাহকারী ইম্পোর্ট',
  'Import Expenses': 'খরচ ইম্পোর্ট',
  'Import Opening Stock': 'প্রারম্ভিক স্টক ইম্পোর্ট',
  'Data & Import': 'তথ্য ও ইম্পোর্ট',

  // ---------------------------------------------------------------- SMS
  'Send SMS': 'এসএমএস পাঠান',
  'Buy SMS': 'এসএমএস কিনুন',
  Message: 'বার্তা',
  Gateway: 'গেটওয়ে',
  'Gateway not connected': 'গেটওয়ে সংযুক্ত নয়',
  'Gateway not configured': 'গেটওয়ে সেট করা নেই',
  'Gateway is offline.': 'গেটওয়ে অফলাইন।',
  'Due reminder': 'বাকির স্মরণিকা',
  'Birthday wish': 'জন্মদিনের শুভেচ্ছা',
  'Birthday List': 'জন্মদিনের তালিকা',
  Templates: 'নমুনা',
  'Add Template': 'নমুনা যোগ করুন',
  History: 'ইতিহাস',
  Campaigns: 'প্রচার',

  // ---------------------------------------------------------------- expenses
  Rent: 'ভাড়া',
  Salary: 'বেতন',
  Utilities: 'ইউটিলিটি',
  Transport: 'পরিবহন',
  Bills: 'বিল',
  'Petty cash': 'খুচরা খরচ',
  Misc: 'বিবিধ',

  // ---------------------------------------------------------------- price tiers
  Retail: 'খুচরা',
  Wholesale: 'পাইকারি',
  Contractor: 'ঠিকাদার',
  Contractors: 'ঠিকাদার',
  Generic: 'সাধারণ',

  // ---------------------------------------------------------------- units
  Pieces: 'পিস',
  Piece: 'পিস',
  Bag: 'বস্তা',
  Box: 'বাক্স',
  Dozen: 'ডজন',
  Foot: 'ফুট',
  Kg: 'কেজি',
  Litre: 'লিটার',

  // ---------------------------------------------------------------- empty / misc
  'No results': 'কোনো ফলাফল নেই',
  'No results found': 'কোনো ফলাফল পাওয়া যায়নি',
  'Nothing here yet': 'এখানে এখনো কিছু নেই',
  'Go to Dashboard': 'ড্যাশবোর্ডে যান',
  'Go to POS': 'বিক্রয় কাউন্টারে যান',
  'Go to Sales': 'বিক্রয়ে যান',
  'Go to Purchases': 'ক্রয়ে যান',
  'Go to Products': 'পণ্যে যান',
  'Go to Customers': 'গ্রাহকে যান',
  'Go to Expenses': 'খরচে যান',
  'Go to Reports': 'হিসাবে যান',
  Navigate: 'চলাচল',
  Operations: 'কার্যক্রম',
  Quick: 'দ্রুত',
  Snapshot: 'ঝলক',
  'Built for the shop floor': 'দোকানের জন্য তৈরি',
  'Offline ready': 'অফলাইনে চলে',
};

/**
 * Second pass: sign-in, lock screen and the first-run wizard. These render
 * OUTSIDE the app shell, so they need their own coverage.
 */
Object.assign(BN, {
  'Sign in': 'সাইন ইন',
  'Sign In': 'সাইন ইন',
  'Choose your account and enter your PIN.': 'আপনার অ্যাকাউন্ট বেছে নিয়ে পিন দিন।',
  'Forgot PIN / password?': 'পিন / পাসওয়ার্ড ভুলে গেছেন?',
  Password: 'পাসওয়ার্ড',
  PIN: 'পিন',
  Locked: 'লক করা',
  Unlocked: 'আনলক হয়েছে',
  'Screen locked': 'স্ক্রিন লক করা',
  'Point of Sale': 'বিক্রয় কেন্দ্র',
  'Switch user': 'ব্যবহারকারী পরিবর্তন',
  'Shop Owner': 'দোকানের মালিক',
  Welcome: 'স্বাগতম',
  'Finish setup': 'সেটআপ সম্পন্ন করুন',
  'Setup complete — welcome!': 'সেটআপ সম্পন্ন — স্বাগতম!',
  'Setup failed — please try again.': 'সেটআপ ব্যর্থ — আবার চেষ্টা করুন।',
  'Main Branch': 'প্রধান শাখা',
  Printer: 'প্রিন্টার',
  'Counter Printer': 'কাউন্টার প্রিন্টার',
  Cloud: 'ক্লাউড',
  Tagline: 'স্লোগান',

  // Search overlay
  'Smart filters — type to narrow search': 'স্মার্ট ফিল্টার — খুঁজতে লিখুন',
  'Searching…': 'খোঁজা হচ্ছে…',
  navigate: 'চলাচল',
  open: 'খুলুন',
  close: 'বন্ধ',
  Try: 'চেষ্টা করুন',
  filter: 'ফিল্টার',

  // Sidebar / shell
  'Expand menu': 'মেনু খুলুন',
  'Collapse menu': 'মেনু গুটান',
  'Data & Import': 'তথ্য ও ইম্পোর্ট',
  'Bring existing shop records in from a spreadsheet. Every importer shows a downloadable template first.':
    'স্প্রেডশিট থেকে দোকানের পুরোনো তথ্য নিয়ে আসুন। প্রতিটি ইম্পোর্টে আগে নমুনা ফাইল ডাউনলোড করা যায়।',
  'Add your catalogue in bulk from a spreadsheet': 'স্প্রেডশিট থেকে একসাথে পণ্যতালিকা যোগ করুন',
  'Set starting quantities for every product': 'প্রতিটি পণ্যের প্রারম্ভিক পরিমাণ দিন',
  'Bring in your customer list with dues': 'বাকিসহ গ্রাহকের তালিকা নিয়ে আসুন',
  'Bring in your supplier list with balances': 'ব্যালেন্সসহ সরবরাহকারীর তালিকা নিয়ে আসুন',
  'Load past invoices, one row per line item': 'পুরোনো ইনভয়েস আনুন, প্রতি লাইনে একটি আইটেম',
  'Load past purchase bills from a supplier': 'সরবরাহকারীর পুরোনো ক্রয় বিল আনুন',
  'Load recorded shop expenses in bulk': 'দোকানের খরচ একসাথে আনুন',
});

/**
 * Third pass: every page title and subtitle in the app (PageHeader / section
 * headings), plus the toolbar and card copy that sits alongside them. These are
 * the most-read strings in the product, so they are covered exhaustively.
 */
Object.assign(BN, {
  // ---- page + section titles ----
  'Basic Information': 'মূল তথ্য',
  Basic: 'মূল',
  Identity: 'পরিচিতি',
  Pricing: 'দাম নির্ধারণ',
  'Tags & notes': 'ট্যাগ ও নোট',
  'Credit & Balances': 'বাকি ও ব্যালেন্স',
  'Trade & finance': 'ব্যবসা ও আর্থিক',
  'Tax & Legal': 'ভ্যাট ও আইনি',
  'Locale & Currency': 'ভাষা ও মুদ্রা',
  'Currency & tax': 'মুদ্রা ও ভ্যাট',
  'Shop details': 'দোকানের বিবরণ',
  'Admin account': 'অ্যাডমিন অ্যাকাউন্ট',
  'Your branch': 'আপনার শাখা',
  'Goods Received Note': 'পণ্য গ্রহণ রসিদ',
  'Held / Parked Carts': 'ধরে রাখা কার্ট',
  'Receipt Preview': 'রসিদের প্রিভিউ',
  'Selling Price Groups': 'বিক্রয় দামের গ্রুপ',
  'Stock Adjustment Report': 'স্টক সমন্বয় রিপোর্ট',
  'Stock Adjustments': 'স্টক সমন্বয়',
  'Stock Alert Report': 'স্টক সতর্কতা রিপোর্ট',
  'Stock Transfers Report': 'স্টক স্থানান্তর রিপোর্ট',
  'Customer / Supplier Report': 'গ্রাহক / সরবরাহকারী রিপোর্ট',
  'SMS Gateway': 'এসএমএস গেটওয়ে',
  'SMS Groups': 'এসএমএস গ্রুপ',
  'SMS History': 'এসএমএস ইতিহাস',
  'SMS Templates': 'এসএমএস নমুনা',
  'Stock Adjustment': 'স্টক সমন্বয়',
  'New Stock Adjustment': 'নতুন স্টক সমন্বয়',
  'New Stock Transfer': 'নতুন স্টক স্থানান্তর',
  'Add new category': 'নতুন ক্যাটাগরি যোগ করুন',
  'Add new supplier': 'নতুন সরবরাহকারী যোগ করুন',
  'Edit Role': 'ভূমিকা সম্পাদনা',
  'Delete role': 'ভূমিকা মুছুন',
  'Not Found': 'পাওয়া যায়নি',
  'Pay Bill': 'বিল পরিশোধ',
  'Pay supplier': 'সরবরাহকারীকে পরিশোধ',
  'Supply Payment': 'সরবরাহ পরিশোধ',
  'Select Customer': 'গ্রাহক নির্বাচন করুন',
  'Message details': 'বার্তার বিবরণ',

  // ---- subtitles / helper copy ----
  "Your shop's name and contact info": 'আপনার দোকানের নাম ও যোগাযোগের তথ্য',
  'The shop location you operate from': 'যে ঠিকানা থেকে আপনি ব্যবসা করেন',
  'The owner account with full access': 'সম্পূর্ণ অ্যাক্সেসসহ মালিকের অ্যাকাউন্ট',
  'Shop identity, currency, locale': 'দোকানের পরিচিতি, মুদ্রা, ভাষা',
  'Configure your shop, devices, and preferences': 'দোকান, ডিভাইস ও পছন্দ সাজান',
  'How money and VAT are handled': 'টাকা ও ভ্যাট কীভাবে হিসাব হয়',
  'All values in BDT': 'সব মূল্য টাকায়',
  'Insights into sales, stock, money, and people':
    'বিক্রয়, স্টক, টাকা ও মানুষের বিশ্লেষণ',
  'Net profit calculation across the selected period':
    'নির্বাচিত সময়ের নিট লাভের হিসাব',
  'Detailed profit breakdown for the current day': 'আজকের লাভের বিস্তারিত বিশ্লেষণ',
  'Final and voided sales': 'চূড়ান্ত ও বাতিল বিক্রয়',
  'Goods received from suppliers': 'সরবরাহকারীর কাছ থেকে গৃহীত পণ্য',
  'Move stock between branches': 'শাখার মধ্যে স্টক স্থানান্তর',
  'Damage / theft / sample / recount': 'ক্ষতি / চুরি / নমুনা / পুনর্গণনা',
  'One-off drawer adjustment': 'এককালীন ক্যাশ সমন্বয়',
  'History of all shifts': 'সব শিফটের ইতিহাস',
  'Variance handling and shift defaults': 'গরমিল ব্যবস্থাপনা ও শিফটের ডিফল্ট',
  'Settle outstanding supplier dues': 'সরবরাহকারীর বাকি পরিশোধ করুন',
  'Log a payment out': 'একটি পরিশোধ লিপিবদ্ধ করুন',
  'Top up credit balance': 'ক্রেডিট ব্যালেন্স যোগ করুন',
  'Sales VAT collected, purchase VAT paid, and net position':
    'আদায়কৃত বিক্রয় ভ্যাট, প্রদত্ত ক্রয় ভ্যাট ও নিট অবস্থা',
  'Sales VAT — by tax rate': 'বিক্রয় ভ্যাট — হার অনুসারে',
  'Purchase VAT — by tax rate': 'ক্রয় ভ্যাট — হার অনুসারে',
  'Send messages, manage templates, and track delivery':
    'বার্তা পাঠান, নমুনা সাজান ও ডেলিভারি দেখুন',
  'Single, group, or template-based messages': 'একক, গ্রুপ বা নমুনাভিত্তিক বার্তা',
  'Configure your BD SMS provider, sender ID, and test connection':
    'আপনার এসএমএস প্রোভাইডার, সেন্ডার আইডি সেট করুন ও সংযোগ পরীক্ষা করুন',
  'Send reminder SMS': 'স্মরণিকা এসএমএস পাঠান',
  'Configure what appears on printed receipts': 'ছাপানো রসিদে কী থাকবে তা সাজান',
  'Thermal printer profiles · test print': 'থার্মাল প্রিন্টার প্রোফাইল · পরীক্ষামূলক প্রিন্ট',
  'Defaults for the Barcode Print page': 'বারকোড প্রিন্ট পাতার ডিফল্ট',
  'Defaults applied at the checkout screen': 'চেকআউট স্ক্রিনে প্রযোজ্য ডিফল্ট',
  'Customize the F-keys and combos used on POS':
    'বিক্রয় কাউন্টারের এফ-কী ও শর্টকাট সাজান',
  'Mode, accent color, density, and font size': 'মোড, রঙ, ঘনত্ব ও লেখার আকার',
  'Local backup, cloud sync, and data export': 'স্থানীয় ব্যাকআপ, ক্লাউড সিঙ্ক ও ডেটা এক্সপোর্ট',
  'Numbering format per document type': 'প্রতিটি নথির ধরন অনুযায়ী নম্বর বিন্যাস',
  'VAT and other rates · used in Products / Sales / Purchases':
    'ভ্যাট ও অন্যান্য হার · পণ্য / বিক্রয় / ক্রয়ে ব্যবহৃত',
  'Add and manage shop branches': 'দোকানের শাখা যোগ ও পরিচালনা',
  'Cashiers, managers, admin accounts': 'ক্যাশিয়ার, ম্যানেজার, অ্যাডমিন অ্যাকাউন্ট',
  'Optional · track commissions on sales by field staff':
    'ঐচ্ছিক · মাঠকর্মীর বিক্রয়ে কমিশন হিসাব',
  'Optional — set up a thermal printer': 'ঐচ্ছিক — একটি থার্মাল প্রিন্টার সেট করুন',
  'Optional — sync and back up online': 'ঐচ্ছিক — অনলাইনে সিঙ্ক ও ব্যাকআপ',
  'Optional · 1 photo': 'ঐচ্ছিক · ১টি ছবি',
  'Optional · printed on detail view': 'ঐচ্ছিক · বিবরণে ছাপা হয়',
  'Optional parent for subcategories': 'উপ-ক্যাটাগরির জন্য ঐচ্ছিক মূল ক্যাটাগরি',
  'Base unit + alternates with conversions': 'মূল একক ও রূপান্তরসহ বিকল্প একক',
  'Behaviour in catalogue & POS': 'পণ্যতালিকা ও বিক্রয় কাউন্টারে আচরণ',
  'Allow selling beyond stock': 'স্টকের বেশি বিক্রয়ের অনুমতি',
  'Show out-of-stock products': 'স্টক নেই এমন পণ্য দেখান',
  'Set first-time stock and unit cost per branch':
    'প্রতিটি শাখার প্রারম্ভিক স্টক ও একক ক্রয়মূল্য দিন',
  'Per branch · for first-time setup, use Opening Stock import':
    'শাখা অনুযায়ী · প্রথমবারের জন্য প্রারম্ভিক স্টক ইম্পোর্ট ব্যবহার করুন',
  'Form-based entry · use POS for fast counter sales':
    'ফর্মে এন্ট্রি · দ্রুত বিক্রয়ের জন্য বিক্রয় কাউন্টার ব্যবহার করুন',
  'Pick products → set copies → print labels':
    'পণ্য বাছুন → কপি সংখ্যা দিন → লেবেল প্রিন্ট করুন',
  'Filter → select → apply': 'ফিল্টার → নির্বাচন → প্রয়োগ',
  'Create and select for this purchase': 'এই ক্রয়ের জন্য তৈরি ও নির্বাচন করুন',
  'Create Purchase from selected': 'নির্বাচিত থেকে ক্রয় তৈরি করুন',
  'Same as Selling Price Groups · used for default pricing, credit, discount':
    'বিক্রয় দামের গ্রুপের অনুরূপ · ডিফল্ট দাম, বাকি ও ছাড়ে ব্যবহৃত',
  'Speed up your counter': 'আপনার কাউন্টার দ্রুত করুন',
  'Drag to resize · double-click to reset': 'টেনে আকার বদলান · রিসেট করতে ডাবল-ক্লিক',
  'This screen is part of the planned design.': 'এই স্ক্রিনটি পরিকল্পিত ডিজাইনের অংশ।',
  "Use 'Open full editor' for more sections": 'আরও অংশের জন্য পূর্ণ এডিটর খুলুন',
  'Variations (skipped — use separate SKUs)': 'ভ্যারিয়েশন (বাদ — আলাদা এসকেইউ ব্যবহার করুন)',

  // ---- import subtitles ----
  'Bulk import via CSV': 'CSV দিয়ে একসাথে ইম্পোর্ট',
  'Bulk-add customers via CSV': 'CSV দিয়ে একসাথে গ্রাহক যোগ করুন',
  'Bulk-add suppliers via CSV': 'CSV দিয়ে একসাথে সরবরাহকারী যোগ করুন',
  'Bulk-import expenses via CSV': 'CSV দিয়ে একসাথে খরচ ইম্পোর্ট',
  'Bulk-import GRNs via CSV': 'CSV দিয়ে একসাথে পণ্য গ্রহণ রসিদ ইম্পোর্ট',
  'Bulk-import past invoices via CSV': 'CSV দিয়ে একসাথে পুরোনো ইনভয়েস ইম্পোর্ট',
  'Download the template': 'নমুনা ফাইল ডাউনলোড করুন',
  'Fill in your products': 'আপনার পণ্য পূরণ করুন',
  'Upload the file': 'ফাইল আপলোড করুন',
  'Review and import': 'যাচাই করে ইম্পোর্ট করুন',

  // ---- buttons / small actions ----
  'More actions': 'আরও কার্যক্রম',
  'Open full editor': 'পূর্ণ এডিটর খুলুন',
  'Open ledger': 'খাতা খুলুন',
  'Open profile': 'প্রোফাইল খুলুন',
  'Set as default': 'ডিফল্ট হিসেবে সেট করুন',
  'Edit name / description': 'নাম / বিবরণ সম্পাদনা',
  'Clear cart': 'কার্ট খালি করুন',
  'Create return': 'ফেরত তৈরি করুন',
  'Print delivery slip': 'ডেলিভারি স্লিপ প্রিন্ট',
  'Customize dashboard': 'ড্যাশবোর্ড সাজান',
  'Remove from dashboard': 'ড্যাশবোর্ড থেকে সরান',
  'Focus and clear for next scan': 'পরের স্ক্যানের জন্য প্রস্তুত করুন',
  'No icon': 'আইকন নেই',
  'Cloud backup': 'ক্লাউড ব্যাকআপ',
  'Receipt printer': 'রসিদ প্রিন্টার',
  'PIN set': 'পিন সেট হয়েছে',
  Refresh: 'রিফ্রেশ',
  Rename: 'নাম বদলান',
  Copy: 'কপি',
  Discard: 'বাতিল করুন',
  Open: 'খুলুন',
  Increase: 'বাড়ান',
  Decrease: 'কমান',
  'Move up': 'উপরে নিন',
  'Move down': 'নিচে নিন',
  'Move left': 'বাঁয়ে নিন',
  'Move right': 'ডানে নিন',
  Grid: 'গ্রিড',
  Table: 'টেবিল',
  'Table view': 'টেবিল ভিউ',
  'List view': 'তালিকা ভিউ',

  // ---- POS shortcut labels ----
  'Held carts (F5)': 'ধরে রাখা কার্ট (F5)',
  'Hold (F9)': 'ধরে রাখুন (F9)',
  'New cart (F10)': 'নতুন কার্ট (F10)',
  'Pick customer (F3)': 'গ্রাহক বাছুন (F3)',
  'F3 from POS': 'বিক্রয় কাউন্টারে F3',
  'F5 to open · Enter resumes the highlighted cart':
    'খুলতে F5 · নির্বাচিত কার্টে ফিরতে Enter',
});

/**
 * Fourth pass: the dashboard (KPI labels + descriptions, widget titles and
 * subtitles, every widget empty state) and the new server-side pagination.
 * These are the first things the owner sees on launch, so coverage here is
 * exhaustive.
 */
Object.assign(BN, {
  // ---- KPI labels ----
  "Today's Sales": 'আজকের বিক্রয়',
  "Today's Expenses": 'আজকের খরচ',
  "Today's Purchases": 'আজকের ক্রয়',
  Transactions: 'লেনদেন',
  'Items Sold': 'বিক্রীত পণ্য',
  'New Customers': 'নতুন গ্রাহক',
  'Returns Today': 'আজকের ফেরত',
  'Out of Stock': 'স্টক নেই',

  // ---- KPI descriptions ----
  'Revenue today': 'আজকের আয়',
  'Sales − COGS − expenses': 'বিক্রয় − ক্রয়মূল্য − খরচ',
  'Number of invoices today': 'আজকের ইনভয়েস সংখ্যা',
  'Units sold today': 'আজ বিক্রীত একক',
  'Customers registered today': 'আজ নিবন্ধিত গ্রাহক',
  'Live cash from current shift': 'বর্তমান শিফটের নগদ',
  'Total outstanding from customers': 'গ্রাহকদের কাছে মোট বাকি',
  'Total payable to suppliers': 'সরবরাহকারীদের মোট প্রদেয়',
  'Items with zero stock': 'শূন্য স্টকের পণ্য',
  'Expenses logged today': 'আজ লিপিবদ্ধ খরচ',
  'Goods received today': 'আজ গৃহীত পণ্য',
  'Sell returns today': 'আজকের বিক্রয় ফেরত',
  'vs yesterday': 'গতকালের তুলনায়',

  // ---- widget titles ----
  'Hourly Sales': 'ঘণ্টাভিত্তিক বিক্রয়',
  'Sales Trend (7 days)': 'বিক্রয়ের ধারা (৭ দিন)',
  'Sales vs Purchases vs Expenses': 'বিক্রয় বনাম ক্রয় বনাম খরচ',
  'Profit / Loss Summary': 'লাভ / ক্ষতির সারসংক্ষেপ',
  'Top Selling Products': 'সর্বাধিক বিক্রীত পণ্য',
  'Top Customers': 'শীর্ষ গ্রাহক',
  'Recent Sales': 'সাম্প্রতিক বিক্রয়',
  'Recent Purchases': 'সাম্প্রতিক ক্রয়',
  'Payment Methods': 'পরিশোধের মাধ্যম',

  // ---- widget descriptions ----
  "Today's sales by hour": 'আজকের বিক্রয়, ঘণ্টা অনুযায়ী',
  'Last 7 days revenue line': 'শেষ ৭ দিনের আয়',
  'Monthly comparison': 'মাসিক তুলনা',
  'Today P/L breakdown': 'আজকের লাভ / ক্ষতির বিশ্লেষণ',
  'Last invoices': 'সাম্প্রতিক ইনভয়েস',
  'Last GRNs': 'সাম্প্রতিক পণ্য গ্রহণ',
  'Top outstanding receivables': 'সর্বোচ্চ আদায়যোগ্য বাকি',
  'Top outstanding payables': 'সর্বোচ্চ প্রদেয় বাকি',
  'Latest events': 'সাম্প্রতিক কার্যক্রম',

  // ---- widget footer links ----
  'P/L Report': 'লাভ / ক্ষতি রিপোর্ট',
  Collect: 'আদায় করুন',
  Manage: 'পরিচালনা',
  'Open Register': 'ক্যাশ বাক্স খুলুন',
  'Send wish': 'শুভেচ্ছা পাঠান',

  // ---- widget empty states ----
  'No data yet.': 'এখনো কোনো তথ্য নেই।',
  'No sales yet.': 'এখনো কোনো বিক্রয় নেই।',
  'No customers yet.': 'এখনো কোনো গ্রাহক নেই।',
  'No purchases yet.': 'এখনো কোনো ক্রয় নেই।',
  'No activity yet.': 'এখনো কোনো কার্যক্রম নেই।',
  'All items well stocked.': 'সব পণ্যের স্টক পর্যাপ্ত।',
  'No outstanding dues.': 'কোনো বাকি নেই।',
  'No outstanding payables.': 'কোনো প্রদেয় নেই।',
  'No upcoming birthdays.': 'আসন্ন কোনো জন্মদিন নেই।',
  'No open shift': 'কোনো শিফট খোলা নেই',
  'No payments yet': 'এখনো কোনো পরিশোধ নেই',

  // ---- widget inline labels ----
  COGS: 'ক্রয়মূল্য',
  units: 'একক',
  orders: 'অর্ডার',
  'reorder at': 'পুনঃঅর্ডার সীমা',
  Opened: 'খোলা হয়েছে',
  by: 'দ্বারা',

  // ---- pagination ----
  Rows: 'সারি',
  Page: 'পাতা',
  of: 'এর',
  Previous: 'পূর্ববর্তী',
  Next: 'পরবর্তী',
  'First page': 'প্রথম পাতা',
  'Previous page': 'পূর্ববর্তী পাতা',
  'Next page': 'পরবর্তী পাতা',
  'Last page': 'শেষ পাতা',
  sales: 'বিক্রয়',
  purchases: 'ক্রয়',
  drafts: 'খসড়া',
  quotations: 'দরপত্র',
  rows: 'সারি',

  // ---- page-scoped totals + the new list-page copy ----
  'Totals for this page only. Use Reports for full-range figures.':
    'শুধু এই পাতার মোট। পূর্ণ সময়ের হিসাবের জন্য "হিসাব" দেখুন।',
  'Paid / Partial / Due filter this page': 'পরিশোধিত / আংশিক / বাকি — শুধু এই পাতায়',
  'Sales (this page)': 'বিক্রয় (এই পাতা)',
  'Revenue (this page)': 'আয় (এই পাতা)',
  'Paid (this page)': 'পরিশোধিত (এই পাতা)',
  'Due (this page)': 'বাকি (এই পাতা)',
  'Tax (this page)': 'ভ্যাট (এই পাতা)',
  'Discount (this page)': 'ছাড় (এই পাতা)',
  'Purchases (this page)': 'ক্রয় (এই পাতা)',
  'Total Value (this page)': 'মোট মূল্য (এই পাতা)',
  'Payable (this page)': 'প্রদেয় (এই পাতা)',
  'Loading sale…': 'বিক্রয় লোড হচ্ছে…',
  'Sale not found.': 'বিক্রয় পাওয়া যায়নি।',
  'All dates': 'সব তারিখ',
  'All customers': 'সব গ্রাহক',
  'All suppliers': 'সব সরবরাহকারী',
  'All groups': 'সব গ্রুপ',
  'All tags': 'সব ট্যাগ',
  'All types': 'সব ধরন',
  'All statuses': 'সব অবস্থা',
  'All stock': 'সব স্টক',
  'No sales match these filters.': 'এই ফিল্টারে কোনো বিক্রয় মেলেনি।',
  'No purchases match.': 'কোনো ক্রয় মেলেনি।',
  'No drafts saved.': 'কোনো খসড়া সংরক্ষিত নেই।',
  'No quotations.': 'কোনো দরপত্র নেই।',
  'No customers match these filters.': 'এই ফিল্টারে কোনো গ্রাহক মেলেনি।',
  'No suppliers match.': 'কোনো সরবরাহকারী মেলেনি।',
  'No held carts.': 'ধরে রাখা কোনো কার্ট নেই।',
  'Loading customers…': 'গ্রাহক লোড হচ্ছে…',
  'Loading products…': 'পণ্য লোড হচ্ছে…',
  'No products in the catalog yet.': 'পণ্যতালিকায় এখনো কোনো পণ্য নেই।',
  'No products match this search or filter.': 'এই খোঁজ বা ফিল্টারে কোনো পণ্য মেলেনি।',
});

/**
 * Fifth pass: the cash register area — Open / Close Shift modals, the X/Z shift
 * report, the drawer movement table and the Register Report list. Kept together
 * because the vocabulary (গরমিল / বাক্সে নগদ / শিফট) has to stay consistent
 * between the modal, the printed report and the settings page that configures it.
 */
Object.assign(BN, {
  // ---- open / close shift ----
  'Opening cash': 'প্রারম্ভিক নগদ',
  'Opening cash (৳)': 'প্রারম্ভিক নগদ (৳)',
  'Opening balance': 'প্রারম্ভিক ব্যালেন্স',
  'Count what you place in the drawer to start the shift.':
    'শিফট শুরু করতে বাক্সে যত টাকা রাখছেন তা গুনে লিখুন।',
  'Optional context': 'ঐচ্ছিক বিবরণ',
  'Optional · context for this shift': 'ঐচ্ছিক · এই শিফটের বিবরণ',
  'Count physical cash': 'হাতে থাকা নগদ গুনুন',
  'Expected in drawer': 'বাক্সে থাকা উচিত',
  'Expected in drawer right now': 'এখন বাক্সে থাকা উচিত',
  Variance: 'গরমিল',
  'Variance check': 'গরমিল যাচাই',
  'Variance thresholds (BDT)': 'গরমিলের সীমা (টাকা)',
  'Variance thresholds, default float': 'গরমিলের সীমা, ডিফল্ট প্রারম্ভিক নগদ',
  'Perfectly balanced.': 'হিসাব একেবারে মিলে গেছে।',
  'Within tolerance. Note is optional.': 'সহনীয় সীমার মধ্যে। নোট ঐচ্ছিক।',
  'Within range': 'সীমার মধ্যে',
  'Required: explain the variance (e.g. found ৳500 short, will recheck pickup)':
    'আবশ্যক: গরমিলের কারণ লিখুন (যেমন ৳৫০০ কম পাওয়া গেছে, আবার মিলিয়ে দেখা হবে)',
  'Optional: any handover notes for next shift':
    'ঐচ্ছিক: পরের শিফটের জন্য কোনো নোট',
  "Carry over as next shift's opening (৳)":
    'পরের শিফটের প্রারম্ভিক হিসেবে রেখে দিন (৳)',
  'To bank deposit': 'ব্যাংকে জমা',
  'Close & Lock': 'বন্ধ করে লক করুন',
  'Closing now': 'বন্ধ করা হচ্ছে',
  'Closing the shift is final. A Z-Report will be generated and the drawer will be ready for a new shift.':
    'শিফট বন্ধ করা চূড়ান্ত। একটি জেড-রিপোর্ট তৈরি হবে এবং ক্যাশ বাক্স নতুন শিফটের জন্য প্রস্তুত হবে।',
  Sub: 'উপমোট',

  // ---- shift report / movements ----
  Duration: 'সময়কাল',
  'Final report · locked': 'চূড়ান্ত রিপোর্ট · লক করা',
  'Interim snapshot · shift remains open': 'অন্তর্বর্তী ঝলক · শিফট এখনো খোলা',
  'Movement breakdown': 'লেনদেনের বিশ্লেষণ',
  'No movements yet.': 'এখনো কোনো লেনদেন নেই।',
  'No movements yet. Activity from POS, payments and expenses will show here.':
    'এখনো কোনো লেনদেন নেই। বিক্রয় কাউন্টার, পরিশোধ ও খরচের কার্যক্রম এখানে দেখা যাবে।',
  'Recent movements': 'সাম্প্রতিক লেনদেন',
  'Recent activity': 'সাম্প্রতিক কার্যক্রম',
  'How shifts work': 'শিফট কীভাবে কাজ করে',
  'Open a shift to start recording cash sales, payments, and expenses.':
    'নগদ বিক্রয়, পরিশোধ ও খরচ লিপিবদ্ধ করতে একটি শিফট খুলুন।',
  'Open POS': 'বিক্রয় কাউন্টার খুলুন',
  'Open shift': 'শিফট খুলুন',
  'Quick actions': 'দ্রুত কাজ',
  'Quick Actions': 'দ্রুত কাজ',
  'X-Report': 'এক্স-রিপোর্ট',
  'View Z-Report': 'জেড-রিপোর্ট দেখুন',
  By: 'করেছেন',

  // ---- movement type labels ----
  'Cash sale': 'নগদ বিক্রয়',
  'Bank deposit': 'ব্যাংকে জমা',
  'Float top-up': 'বাক্সে টাকা যোগ',
  'Manual cash in': 'হাতে নগদ জমা',
  'Manual cash out': 'হাতে নগদ উত্তোলন',
  'Paid supplier': 'সরবরাহকারীকে পরিশোধ',
  'Personal use': 'ব্যক্তিগত খরচ',

  // ---- register report list ----
  'All time': 'সব সময়',
  'Last 7 days': 'শেষ ৭ দিন',
  'Last 30 days': 'শেষ ৩০ দিন',
  'No shifts match.': 'কোনো শিফট মেলেনি।',
  'Search shift #, opener, closer, branch…':
    'শিফট নম্বর, খোলা/বন্ধকারী, শাখা খুঁজুন…',

  // ---- cash register settings ----
  'Shift defaults': 'শিফটের ডিফল্ট',
  Authorization: 'অনুমোদন',
  'Warn at (≥)': 'সতর্ক করুন (≥)',
  'Block at (≥)': 'আটকে দিন (≥)',
  Blocked: 'আটকে গেছে',
  'Default carried float at open': 'শিফট খোলার সময় ডিফল্ট প্রারম্ভিক নগদ',
  'Pre-fill the Open Shift modal with this amount. Cashier can override.':
    'শিফট খোলার সময় এই টাকাটি আগেই বসে থাকবে। ক্যাশিয়ার বদলাতে পারবেন।',
  'Require manager PIN on variance over block':
    'সীমার বেশি গরমিল হলে ম্যানেজারের পিন লাগবে',
  'Cashier cannot close a shift with variance ≥ block threshold without a manager PIN.':
    'ম্যানেজারের পিন ছাড়া ক্যাশিয়ার আটকানোর সীমার সমান বা বেশি গরমিল নিয়ে শিফট বন্ধ করতে পারবেন না।',
  'What cashiers will see': 'ক্যাশিয়ার যা দেখবেন',
  'Shift closes silently.': 'শিফট চুপচাপ বন্ধ হয়ে যাবে।',
  'Yellow notice on Z-Report. Cashier can still close.':
    'জেড-রিপোর্টে হলুদ সতর্কতা আসবে। ক্যাশিয়ার তবুও বন্ধ করতে পারবেন।',
  'Manager PIN required (if enabled). Locked otherwise.':
    'ম্যানেজারের পিন লাগবে (চালু থাকলে)। নয়তো আটকে থাকবে।',
  'Variance is the difference between expected drawer and counted cash on shift close. Below warn → silent. Between warn and block → yellow warning, can still close. Above block → red, requires manager PIN if enabled.':
    'শিফট বন্ধের সময় বাক্সে থাকা উচিত এমন টাকা ও গুনে পাওয়া টাকার পার্থক্যই গরমিল। সতর্কতার নিচে → কিছু হবে না। সতর্কতা ও আটকানোর সীমার মাঝে → হলুদ সতর্কতা, তবুও বন্ধ করা যাবে। আটকানোর সীমার উপরে → লাল, চালু থাকলে ম্যানেজারের পিন লাগবে।',
});

/**
 * Sixth pass: contacts — customer / supplier forms, the ledger and statement
 * views, dues ageing, and the two payment modals (receive from customer, pay a
 * supplier bill). "বাকি" is reserved for money the customer owes us and
 * "প্রদেয়" for money we owe a supplier, matching the earlier passes.
 */
Object.assign(BN, {
  // ---- customer / supplier form ----
  'New customer': 'নতুন গ্রাহক',
  'New supplier': 'নতুন সরবরাহকারী',
  'New trade contact': 'নতুন ব্যবসায়িক যোগাযোগ',
  'Add a new contact': 'নতুন যোগাযোগ যোগ করুন',
  'Save Customer': 'গ্রাহক সংরক্ষণ',
  'Save Supplier': 'সরবরাহকারী সংরক্ষণ',
  'Primary phone': 'প্রধান ফোন',
  'Date of birth': 'জন্মতারিখ',
  'Credit limit (৳)': 'বাকির সীমা (৳)',
  'Cap on outstanding due': 'সর্বোচ্চ কত বাকি রাখা যাবে',
  'No phone yet': 'এখনো ফোন নম্বর নেই',
  'No company': 'কোনো প্রতিষ্ঠান নেই',
  'Internal notes…': 'নিজের নোট…',
  'Internal notes (saved automatically)…': 'নিজের নোট (নিজে থেকেই সংরক্ষিত হয়)…',
  'Internal notes about this customer (saved automatically)…':
    'এই গ্রাহক সম্পর্কে নিজের নোট (নিজে থেকেই সংরক্ষিত হয়)…',
  'Type and Enter (e.g. VIP, Regular)': 'লিখে Enter চাপুন (যেমন VIP, Regular)',
  'Use when migrating from another system':
    'অন্য সফটওয়্যার থেকে তথ্য আনার সময় ব্যবহার করুন',
  'Bank account': 'ব্যাংক অ্যাকাউন্ট',
  'Bank Account': 'ব্যাংক অ্যাকাউন্ট',
  'Lead time': 'পণ্য আসার সময়',
  'Lead time (days)': 'পণ্য আসার সময় (দিন)',
  'Payment terms': 'পরিশোধের শর্ত',
  'Pay Term': 'পরিশোধের শর্ত',
  'Tax ID (BIN/TIN)': 'ভ্যাট আইডি (BIN/TIN)',
  'Tax ID:': 'ভ্যাট আইডি:',
  'Supplier name': 'সরবরাহকারীর নাম',
  'Migration balance owed to this supplier':
    'এই সরবরাহকারীকে আগে থেকেই যত টাকা দিতে হবে',
  'Positive = you owe this supplier (e.g. existing dues)':
    'ধনাত্মক = আপনি এই সরবরাহকারীকে টাকা দেবেন (যেমন পুরোনো বাকি)',
  'Add New Supplier': 'নতুন সরবরাহকারী যোগ করুন',
  'Save & Select': 'সংরক্ষণ করে বেছে নিন',
  'e.g. RFL Plastics': 'যেমন RFL Plastics',
  'Phone is the de-dupe key. If a supplier with this phone exists, the existing record will be selected instead.':
    'ফোন নম্বর দিয়েই মিল খোঁজা হয়। এই নম্বরের সরবরাহকারী আগে থেকে থাকলে সেই পুরোনো তথ্যই বেছে নেওয়া হবে।',

  // ---- customer / supplier detail ----
  'Outstanding Due': 'অপরিশোধিত বাকি',
  'Outstanding due': 'অপরিশোধিত বাকি',
  'Outstanding Payable': 'অপরিশোধিত প্রদেয়',
  'Current Due': 'বর্তমান বাকি',
  'Total Due': 'মোট বাকি',
  'Current balance': 'বর্তমান ব্যালেন্স',
  'Credit balance': 'ক্রেডিট ব্যালেন্স',
  'Advance Balance': 'অগ্রিম ব্যালেন্স',
  'over limit!': 'সীমা ছাড়িয়ে গেছে!',
  'Over limit': 'সীমার বেশি',
  'Over Limit': 'সীমার বেশি',
  'Over credit limit': 'বাকির সীমার বেশি',
  'Has Due': 'বাকি আছে',
  'No Due': 'বাকি নেই',
  'No dues': 'বাকি নেই',
  'Print Statement': 'হিসাব প্রিন্ট',
  'Sales History': 'বিক্রয়ের ইতিহাস',
  'No ledger entries yet.': 'খাতায় এখনো কোনো এন্ট্রি নেই।',
  'No sales for this customer yet.': 'এই গ্রাহকের এখনো কোনো বিক্রয় নেই।',
  'No returns for this customer.': 'এই গ্রাহকের কোনো ফেরত নেই।',
  'No purchases from this supplier yet.': 'এই সরবরাহকারীর কাছ থেকে এখনো কোনো ক্রয় নেই।',
  'Pay Supplier': 'সরবরাহকারীকে পরিশোধ',
  Contact: 'যোগাযোগ',
  DOB: 'জন্মতারিখ',
  Joined: 'যোগ হয়েছে',
  'Last Sale': 'শেষ বিক্রয়',
  'Last Purchase': 'শেষ ক্রয়',

  // ---- receive payment / pay bill ----
  Receiving: 'গ্রহণ করা হচ্ছে',
  Paying: 'পরিশোধ করা হচ্ছে',
  'Full payable': 'সম্পূর্ণ প্রদেয়',
  Half: 'অর্ধেক',
  'Reference / TxID': 'রেফারেন্স / TxID',
  'Auto-allocate (oldest first)': 'নিজে থেকেই বসান (পুরোনো আগে)',
  'Pick invoices manually': 'ইনভয়েস নিজে বেছে নিন',
  'Pick bills manually': 'বিল নিজে বেছে নিন',
  'Choose how much to apply per invoice': 'প্রতিটি ইনভয়েসে কত বসবে বেছে নিন',
  'Choose how much per bill': 'প্রতিটি বিলে কত বসবে বেছে নিন',
  'Will apply to': 'যেখানে বসবে',
  'No outstanding invoices. Payment will be applied as advance.':
    'কোনো বাকি ইনভয়েস নেই। টাকাটি অগ্রিম হিসেবে জমা হবে।',
  'No outstanding bills. Payment will be recorded as advance.':
    'কোনো বাকি বিল নেই। টাকাটি অগ্রিম হিসেবে লিপিবদ্ধ হবে।',
  'Select supplier…': 'সরবরাহকারী বেছে নিন…',
  'Paid on': 'পরিশোধের তারিখ',
  'Payment Method': 'পরিশোধের মাধ্যম',
  'Payment reference / TxID': 'পরিশোধের রেফারেন্স / TxID',

  // ---- customer dues ----
  Age: 'বয়স',
  Filter: 'ফিল্টার',
  Limit: 'সীমা',
  'Oldest invoice': 'সবচেয়ে পুরোনো ইনভয়েস',
  '0–30 days': '০–৩০ দিন',
  '30–60 days': '৩০–৬০ দিন',
  '60–90 days': '৬০–৯০ দিন',
  '90+ days': '৯০+ দিন',
  'Send Reminder': 'স্মরণিকা পাঠান',
  'Send Reminder to All Selected': 'নির্বাচিত সবাইকে স্মরণিকা পাঠান',
  'No customer dues match these filters.': 'এই ফিল্টারে কোনো গ্রাহকের বাকি মেলেনি।',

  // ---- contact list search / empty ----
  'Search name or phone…': 'নাম বা ফোন খুঁজুন…',
  'Search name / phone…': 'নাম / ফোন খুঁজুন…',
  'Search name, phone, email…': 'নাম, ফোন, ইমেইল খুঁজুন…',
  'Search name, company, phone…': 'নাম, প্রতিষ্ঠান, ফোন খুঁজুন…',
  'Search customers…': 'গ্রাহক খুঁজুন…',
  'Search customer name or phone…': 'গ্রাহকের নাম বা ফোন খুঁজুন…',
  'No customers match.': 'কোনো গ্রাহক মেলেনি।',
});

/**
 * Seventh pass: the POS screen — cart panel and line rows, product panel,
 * customer picker, held carts, the payment modal (single / split / credit) and
 * the printed receipt. Key caps (F2, Esc, Enter, Ctrl) stay in English on
 * purpose: that is what is written on the keyboard in front of the cashier.
 */
Object.assign(BN, {
  // ---- cart ----
  Hold: 'ধরে রাখুন',
  Held: 'ধরে রাখা',
  'Held carts': 'ধরে রাখা কার্ট',
  'Held / parked carts': 'ধরে রাখা কার্ট',
  'Hold current cart': 'এই কার্ট ধরে রাখুন',
  'Park current cart': 'এই কার্ট সরিয়ে রাখুন',
  'New cart': 'নতুন কার্ট',
  'New cart tab': 'নতুন কার্ট ট্যাব',
  'Start a fresh cart tab': 'নতুন একটি কার্ট ট্যাব শুরু করুন',
  'Move cart to left': 'কার্ট বাঁয়ে নিন',
  'Move cart to right': 'কার্ট ডানে নিন',
  Suspend: 'স্থগিত করুন',
  Resume: 'আবার শুরু করুন',
  'Multi-Pay': 'একাধিক মাধ্যমে পরিশোধ',
  'Total Payable': 'মোট প্রদেয়',
  'Order charges': 'অর্ডারের চার্জ',
  'Line discount': 'লাইনে ছাড়',
  'Line discounts': 'লাইনে ছাড়',
  'Line Discounts': 'লাইনে ছাড়',
  'Line Total': 'লাইনের মোট',
  'Line tax': 'লাইনের ভ্যাট',
  'Line discount as flat amount': 'লাইনে ছাড় সরাসরি টাকায়',
  'Line discount as percent': 'লাইনে ছাড় শতাংশে',
  'Adds % to SPR for unit price': 'একক দামের জন্য বিক্রয় দামের উপর % যোগ করে',
  'Markup %': 'লাভের হার %',
  'Override line price': 'লাইনের দাম বদলান',
  'Scan or pick a product to start': 'শুরু করতে পণ্য স্ক্যান করুন বা বেছে নিন',
  'Press F2 to focus search': 'খোঁজায় যেতে F2 চাপুন',
  'Scanner ready · or press F2 to search': 'স্ক্যানার প্রস্তুত · বা খুঁজতে F2 চাপুন',
  'Name / SKU / barcode (F2)': 'নাম / এসকেইউ / বারকোড (F2)',
  Scan: 'স্ক্যান',
  List: 'তালিকা',
  'OOS shown': 'স্টক নেই এমন পণ্যও দেখানো হচ্ছে',
  'OOS hidden': 'স্টক নেই এমন পণ্য লুকানো',
  'Walk-in': 'সাধারণ গ্রাহক',
  'Walk-in or contractor': 'সাধারণ গ্রাহক বা ঠিকাদার',
  'No open shift — cash not tracked in a drawer. Open a shift from Cash Register.':
    'কোনো শিফট খোলা নেই — নগদের হিসাব বাক্সে রাখা হচ্ছে না। ক্যাশ বাক্স থেকে একটি শিফট খুলুন।',

  // ---- customer picker ----
  'Add new customer': 'নতুন গ্রাহক যোগ করুন',
  'Search by label or customer…': 'লেবেল বা গ্রাহক দিয়ে খুঁজুন…',
  'Pick customers': 'গ্রাহক বেছে নিন',

  // ---- payment modal ----
  Single: 'একটি মাধ্যম',
  'Split Payment': 'ভাগ করে পরিশোধ',
  'Add payment': 'পরিশোধ যোগ করুন',
  'Add Payment Line': 'পরিশোধের লাইন যোগ করুন',
  'Confirm Payment': 'পরিশোধ নিশ্চিত করুন',
  'Credit Sale': 'বাকিতে বিক্রয়',
  'Credit usage': 'বাকির ব্যবহার',
  'To Credit': 'বাকিতে',
  Exact: 'পুরো টাকা',
  'Tendered amount': 'যত টাকা দেওয়া হলো',
  'TxID / last 4 digits': 'TxID / শেষ ৪ সংখ্যা',
  'Visible payment methods': 'যে মাধ্যমগুলো দেখা যাবে',

  // ---- receipt ----
  'Invoice No.': 'ইনভয়েস নম্বর',
  'Mobile:': 'মোবাইল:',
  'Other Charge': 'অন্যান্য চার্জ',
  'Other Charge (৳)': 'অন্যান্য চার্জ (৳)',
  'Total quantity': 'মোট পরিমাণ',
  'Total qty': 'মোট পরিমাণ',
  'Unit Price': 'একক দাম',
  'Unit price': 'একক দাম',
  'Amount in words': 'কথায় টাকার পরিমাণ',
  'Thank you for your purchase': 'কেনাকাটার জন্য ধন্যবাদ',
  'Thank you for your purchase. · Software by Hardware POS':
    'কেনাকাটার জন্য ধন্যবাদ। · সফটওয়্যার: Hardware POS',
  'Returns within 7 days with receipt': 'রসিদ থাকলে ৭ দিনের মধ্যে ফেরত নেওয়া হয়',
  'Re-print': 'আবার প্রিন্ট',
  'Re-print Last': 'শেষটি আবার প্রিন্ট',
  'Print preview': 'প্রিন্ট প্রিভিউ',

  // ---- shortcuts overlay / settings ----
  Shortcuts: 'শর্টকাট',
  'Show this overlay': 'এই তালিকা দেখান',
  'Show shortcuts overlay': 'শর্টকাটের তালিকা দেখান',
  'Toggle the help overlay': 'সাহায্যের তালিকা দেখান / লুকান',
  'Close modal / clear focus': 'উইন্ডো বন্ধ / ফোকাস সরান',
  'Jump to the search box on POS': 'বিক্রয় কাউন্টারের খোঁজার ঘরে যান',
  'Open the Customer Picker': 'গ্রাহক বাছাই খুলুন',
  'Open the parked carts list': 'সরিয়ে রাখা কার্টের তালিকা খুলুন',
  'Open the Payment modal': 'পরিশোধের উইন্ডো খুলুন',
  'Pay (open payment)': 'পরিশোধ (পরিশোধ উইন্ডো খুলুন)',
  'Print the most recent invoice': 'সর্বশেষ ইনভয়েস প্রিন্ট করুন',
  'Re-print last receipt': 'শেষ রসিদ আবার প্রিন্ট',
  'Save as draft': 'খসড়া হিসেবে সংরক্ষণ',
  'Save as quotation': 'দরপত্র হিসেবে সংরক্ষণ',
  'Save as quotation document': 'দরপত্র নথি হিসেবে সংরক্ষণ',
  'Save current cart as draft': 'এই কার্টটি খসড়া হিসেবে সংরক্ষণ',
  'Press a key…': 'একটি কী চাপুন…',
  'Reset to defaults': 'ডিফল্টে ফেরান',
  'Reset all shortcuts to defaults?': 'সব শর্টকাট ডিফল্টে ফিরিয়ে দেবেন?',
  'Shortcuts saved': 'শর্টকাট সংরক্ষিত হয়েছে',
  'Shortcuts reset to defaults': 'শর্টকাট ডিফল্টে ফেরানো হয়েছে',
  'Click any row to record a new combo. Press the new key (modifiers + key) to capture it, then click':
    'নতুন শর্টকাট দিতে যেকোনো সারিতে ক্লিক করুন। নতুন কী (মডিফায়ার + কী) চাপুন, তারপর ক্লিক করুন',
  'to apply. Press Esc to cancel. If your new combo conflicts with another shortcut, the other binding will be cleared so you can re-bind it.':
    'প্রয়োগ করতে। বাতিল করতে Esc চাপুন। নতুন শর্টকাটটি অন্য কোনোটির সাথে মিলে গেলে সেটি মুছে যাবে, পরে আবার সেট করতে পারবেন।',
});

/**
 * Eighth pass: the catalogue — product form and list, bulk price update,
 * barcode print, and the master-data pages (categories, brands, units,
 * warranties, price groups, customer groups).
 */
Object.assign(BN, {
  // ---- product form ----
  'Create a new product in your catalogue': 'আপনার পণ্যতালিকায় নতুন পণ্য যোগ করুন',
  'Edit Product': 'পণ্য সম্পাদনা',
  'Save Product': 'পণ্য সংরক্ষণ',
  'Product name': 'পণ্যের নাম',
  'Product Name': 'পণ্যের নাম',
  'Select brand…': 'ব্র্যান্ড বেছে নিন…',
  'Select category…': 'ক্যাটাগরি বেছে নিন…',
  'Choose category…': 'ক্যাটাগরি বেছে নিন…',
  'Cost price': 'ক্রয়মূল্য',
  'Sell price': 'বিক্রয় দাম',
  'Sell Price': 'বিক্রয় দাম',
  'Sell price (SPR)': 'বিক্রয় দাম (SPR)',
  'Sell Price (SPR)': 'বিক্রয় দাম (SPR)',
  'Sell Price (Inc.)': 'বিক্রয় দাম (ভ্যাটসহ)',
  'Base selling price reference': 'মূল বিক্রয় দামের ভিত্তি',
  'Wholesale price': 'পাইকারি দাম',
  'Contractor price': 'ঠিকাদারি দাম',
  'Optional — used when cart price group is Wholesale':
    'ঐচ্ছিক — কার্টের দামের গ্রুপ পাইকারি হলে ব্যবহার হয়',
  'Optional — used when cart price group is Contractor':
    'ঐচ্ছিক — কার্টের দামের গ্রুপ ঠিকাদার হলে ব্যবহার হয়',
  'Profit margin': 'মুনাফার হার',
  'Margin %': 'মুনাফার হার %',
  'Avg margin': 'গড় মুনাফার হার',
  'Default 0; VAT applied at order level': 'ডিফল্ট ০; ভ্যাট অর্ডারের স্তরে বসে',
  'Alternate units & conversions': 'বিকল্প একক ও রূপান্তর',
  '+ Add unit…': '+ একক যোগ করুন…',
  'Track stock': 'স্টকের হিসাব রাখুন',
  'Subtract from stock when sold': 'বিক্রি হলে স্টক থেকে কমে যাবে',
  'Show in POS': 'বিক্রয় কাউন্টারে দেখান',
  'Visible in product picker': 'পণ্য বাছাইয়ে দেখা যাবে',
  'Not for sale': 'বিক্রয়ের জন্য নয়',
  'Purchase-only item (no POS sales)': 'শুধু ক্রয়ের পণ্য (কাউন্টারে বিক্রি হয় না)',
  'Allow discount': 'ছাড় দেওয়ার অনুমতি',
  'Cashier can discount this item': 'ক্যাশিয়ার এই পণ্যে ছাড় দিতে পারবেন',
  'Allow negative sale': 'স্টকের বেশি বিক্রয়ের অনুমতি',
  'Sell beyond available stock': 'স্টকে যা আছে তার বেশি বিক্রি করা যাবে',
  'Trigger Low Stock alert when stock ≤ this':
    'স্টক এর সমান বা কম হলে কম স্টকের সতর্কতা দেখান',
  'Notes about this product (specs, source, anything useful)…':
    'এই পণ্য সম্পর্কে নোট (মাপ, সোর্স, দরকারি যেকোনো কিছু)…',
  'PNG, JPG up to 1MB': 'PNG, JPG — সর্বোচ্চ ১MB',
  'PNG / SVG up to 1MB': 'PNG / SVG — সর্বোচ্চ ১MB',
  'This category placeholder will appear in lists when no image.':
    'ছবি না থাকলে তালিকায় এই ক্যাটাগরির ছবিটি দেখা যাবে।',
  'e.g. Claw Hammer 16oz': 'যেমন Claw Hammer 16oz',
  'IMEI / Serial': 'IMEI / সিরিয়াল',

  // ---- product list ----
  'Total Products': 'মোট পণ্য',
  'Stock Value (Cost)': 'স্টকের মূল্য (ক্রয়মূল্যে)',
  'Retail Value': 'খুচরা মূল্য',
  'Price range (৳)': 'দামের সীমা (৳)',
  'Search name, SKU, barcode…': 'নাম, এসকেইউ, বারকোড খুঁজুন…',
  'Search name, SKU, or barcode…': 'নাম, এসকেইউ বা বারকোড খুঁজুন…',
  'Search name or SKU…': 'নাম বা এসকেইউ খুঁজুন…',
  'Search product name, SKU, barcode…': 'পণ্যের নাম, এসকেইউ, বারকোড খুঁজুন…',
  'No products match these filters.': 'এই ফিল্টারে কোনো পণ্য মেলেনি।',
  'No products.': 'কোনো পণ্য নেই।',
  'No products selected.': 'কোনো পণ্য নির্বাচন করা হয়নি।',
  'Print Barcode': 'বারকোড প্রিন্ট',
  'Bulk Update': 'একসাথে হালনাগাদ',
  'Quick Edit': 'দ্রুত সম্পাদনা',
  'Product deleted': 'পণ্য মুছে ফেলা হয়েছে',
  'Product duplicated': 'পণ্যের অনুলিপি হয়েছে',
  'Add new product': 'নতুন পণ্য যোগ করুন',
  Prev: 'পূর্ববর্তী',
  In: 'আছে',
  Out: 'নেই',
  Min: 'সর্বনিম্ন',
  Max: 'সর্বোচ্চ',

  // ---- bulk price update ----
  Field: 'যে ঘরটি বদলাবে',
  Mode: 'ধরন',
  Direction: 'দিক',
  Percent: 'শতাংশ',
  'Percent (%)': 'শতাংশ (%)',
  'Flat (৳)': 'সরাসরি টাকায় (৳)',
  Rounding: 'রাউন্ডিং',
  'No rounding': 'রাউন্ডিং নেই',
  'Round up': 'উপরে রাউন্ড',
  'Round down': 'নিচে রাউন্ড',
  'Nearest taka': 'নিকটতম টাকায়',
  'Update settings': 'হালনাগাদের সেটিংস',
  'New value': 'নতুন মান',
  'Total change': 'মোট পরিবর্তন',
  'Clear selection': 'নির্বাচন বাতিল',
  Selected: 'নির্বাচিত',
  After: 'পরে',
  'Applying…': 'প্রয়োগ করা হচ্ছে…',

  // ---- barcode print ----
  'Label settings': 'লেবেলের সেটিংস',
  'Label sizes and printed fields': 'লেবেলের মাপ ও কী কী ছাপা হবে',
  'Default label size': 'ডিফল্ট লেবেলের মাপ',
  'Default copies per product': 'প্রতিটি পণ্যের ডিফল্ট কপি সংখ্যা',
  'Sample label': 'নমুনা লেবেল',
  'Show on label': 'লেবেলে দেখান',
  'Show name': 'নাম দেখান',
  'Show price': 'দাম দেখান',
  'Show SKU': 'এসকেইউ দেখান',
  'Code type': 'কোডের ধরন',
  'Code 128 (recommended)': 'Code 128 (পরামর্শকৃত)',
  '50 × 30 mm (single roll)': '৫০ × ৩০ মিমি (এক সারির রোল)',
  'A4 sheet (3 cols × 10 rows)': 'A4 কাগজ (৩ কলাম × ১০ সারি)',
  'A4 sheet (3 × 10 grid)': 'A4 কাগজ (৩ × ১০ গ্রিড)',
  'MRP (printed price)': 'এমআরপি (ছাপানো দাম)',
  'Real preview uses the codeType setting.': 'আসল প্রিভিউ কোডের ধরন অনুযায়ী হবে।',
  'Preview shows here once you add items.': 'আইটেম যোগ করলে এখানে প্রিভিউ দেখা যাবে।',
  Queue: 'তালিকা',
  Size: 'মাপ',
  Defaults: 'ডিফল্ট',

  // ---- categories / brands / units / warranties ----
  '— Top level —': '— সবচেয়ে উপরের স্তর —',
  'Parent category': 'মূল ক্যাটাগরি',
  'Icon (emoji)': 'আইকন (ইমোজি)',
  Icon: 'আইকন',
  'Optional. Leave empty for a top-level category.':
    'ঐচ্ছিক। উপরের স্তরের ক্যাটাগরি হলে খালি রাখুন।',
  'Edit Category': 'ক্যাটাগরি সম্পাদনা',
  'Category added': 'ক্যাটাগরি যোগ হয়েছে',
  'Category updated': 'ক্যাটাগরি হালনাগাদ হয়েছে',
  'Search categories…': 'ক্যাটাগরি খুঁজুন…',
  'No categories.': 'কোনো ক্যাটাগরি নেই।',
  'Add Brand': 'ব্র্যান্ড যোগ করুন',
  'Brand name': 'ব্র্যান্ডের নাম',
  'Delete this brand?': 'এই ব্র্যান্ডটি মুছে ফেলবেন?',
  'Search brands…': 'ব্র্যান্ড খুঁজুন…',
  'No brands match.': 'কোনো ব্র্যান্ড মেলেনি।',
  'Rename failed': 'নাম পরিবর্তন ব্যর্থ',
  'Edit Unit': 'একক সম্পাদনা',
  'Conversion to base': 'মূল এককে রূপান্তর',
  'For BD: 1 dozen = 12, 1 hali = 4, 1 ft = 0.3048 m. Set 1 if this is the base.':
    'বাংলাদেশে: ১ ডজন = ১২, ১ হালি = ৪, ১ ফুট = ০.৩০৪৮ মিটার। এটিই মূল একক হলে ১ দিন।',
  'Search units…': 'একক খুঁজুন…',
  'No units match.': 'কোনো একক মেলেনি।',
  'Unit added': 'একক যোগ হয়েছে',
  'Unit updated': 'একক হালনাগাদ হয়েছে',
  'Unit deleted': 'একক মুছে ফেলা হয়েছে',
  'Edit Warranty': 'ওয়ারেন্টি সম্পাদনা',
  'Duration (months)': 'সময়কাল (মাস)',
  "What's covered, exclusions, etc.": 'কী কী কভার হবে, কী বাদ থাকবে ইত্যাদি',
  'Search warranties…': 'ওয়ারেন্টি খুঁজুন…',
  'No warranties.': 'কোনো ওয়ারেন্টি নেই।',
  Warranty: 'ওয়ারেন্টি',

  // ---- price groups / customer groups ----
  'Add Price Group': 'দামের গ্রুপ যোগ করুন',
  'Edit Price Group': 'দামের গ্রুপ সম্পাদনা',
  'Add Customer Group': 'গ্রাহক গ্রুপ যোগ করুন',
  'Edit Customer Group': 'গ্রাহক গ্রুপ সম্পাদনা',
  'Edit Group': 'গ্রুপ সম্পাদনা',
  Groups: 'গ্রুপ',
  'Search groups…': 'গ্রুপ খুঁজুন…',
  'No groups.': 'কোনো গ্রুপ নেই।',
  'No groups yet.': 'এখনো কোনো গ্রুপ নেই।',
  'Mark as default group for new customers':
    'নতুন গ্রাহকের জন্য ডিফল্ট গ্রুপ করুন',
  'Cannot delete the default group.': 'ডিফল্ট গ্রুপ মুছে ফেলা যাবে না।',
  'Cannot delete the default price group.': 'ডিফল্ট দামের গ্রুপ মুছে ফেলা যাবে না।',
  'Default credit limit (৳)': 'ডিফল্ট বাকির সীমা (৳)',
  'Default credit:': 'ডিফল্ট বাকি:',
  'default discount': 'ডিফল্ট ছাড়',
  'Default discount %': 'ডিফল্ট ছাড় %',
  'Tax exempt': 'ভ্যাট মুক্ত',
  'Tax exempt (no VAT applied automatically)':
    'ভ্যাট মুক্ত (নিজে থেকে কোনো ভ্যাট বসবে না)',
  'VIP / Member / etc.': 'ভিআইপি / সদস্য / ইত্যাদি',
});

/**
 * Ninth pass: sales and purchases — the form-based Add Sale / Add Purchase
 * screens, sale and purchase detail drawers, the return modals (sell and
 * purchase side) and shipments.
 */
Object.assign(BN, {
  // ---- add purchase ----
  'Edit Purchase': 'ক্রয় সম্পাদনা',
  'Purchase Date': 'ক্রয়ের তারিখ',
  'Purchase Status': 'ক্রয়ের অবস্থা',
  'Purchase Qty': 'ক্রয়ের পরিমাণ',
  'Purchase Tax %': 'ক্রয়ের ভ্যাট %',
  'Reference No': 'রেফারেন্স নম্বর',
  'Ref No': 'রেফ নম্বর',
  'Auto-generated if blank': 'খালি রাখলে নিজে থেকেই তৈরি হবে',
  'Please Select': 'বেছে নিন',
  Ordered: 'অর্ডার করা হয়েছে',
  'In Transit': 'পথে আছে',
  'In transit': 'পথে আছে',
  'Discount Type': 'ছাড়ের ধরন',
  'Discount Amount': 'ছাড়ের পরিমাণ',
  'Unit Cost': 'একক ক্রয়মূল্য',
  'Unit cost': 'একক ক্রয়মূল্য',
  'Unit Cost (Before Disc)': 'একক ক্রয়মূল্য (ছাড়ের আগে)',
  'Unit Cost (Before Tax)': 'একক ক্রয়মূল্য (ভ্যাটের আগে)',
  'Net Total': 'নিট মোট',
  'Total items': 'মোট আইটেম',
  'Shipping Charge (৳)': 'পরিবহন চার্জ (৳)',
  'Shipping Details': 'পরিবহনের বিবরণ',
  'Courier, vehicle, driver…': 'কুরিয়ার, গাড়ি, চালক…',
  'Attach Document': 'নথি যোগ করুন',
  Browse: 'ফাইল বাছুন',
  'Browse…': 'ফাইল বাছুন…',
  'Max 5MB · pdf, csv, zip, doc, docx, jpeg, jpg, png':
    'সর্বোচ্চ ৫MB · pdf, csv, zip, doc, docx, jpeg, jpg, png',
  'Additional Notes': 'অতিরিক্ত নোট',
  'Anything to remember about this purchase…':
    'এই ক্রয় সম্পর্কে মনে রাখার মতো কিছু…',
  'Existing supplier payable:': 'এই সরবরাহকারীর আগের প্রদেয়:',
  'Save & Pay': 'সংরক্ষণ করে পরিশোধ',
  'Save Unpaid': 'পরিশোধ ছাড়াই সংরক্ষণ',
  'Enter product name / SKU / scan barcode / IMEI':
    'পণ্যের নাম / এসকেইউ লিখুন / বারকোড বা IMEI স্ক্যান করুন',
  'A saved purchase cannot be edited in place (it may have already affected stock and cash).':
    'সংরক্ষিত ক্রয় সরাসরি সম্পাদনা করা যায় না (এটি স্টক ও নগদে প্রভাব ফেলে থাকতে পারে)।',
  'Cancel it from the purchase detail, then add a new purchase.':
    'ক্রয়ের বিবরণ থেকে এটি বাতিল করে নতুন একটি ক্রয় যোগ করুন।',
  'Purchase saved, but could not open payment. Open it from the Purchases list.':
    'ক্রয় সংরক্ষিত হয়েছে, তবে পরিশোধের উইন্ডো খোলা যায়নি। ক্রয়ের তালিকা থেকে খুলুন।',
  'Reason for cancelling?': 'বাতিলের কারণ কী?',
  'Reference, supplier…': 'রেফারেন্স, সরবরাহকারী…',

  // ---- add sale ----
  'Edit Sale': 'বিক্রয় সম্পাদনা',
  'Save Sale': 'বিক্রয় সংরক্ষণ',
  'Add items': 'আইটেম যোগ করুন',
  'Add at least one item': 'অন্তত একটি আইটেম যোগ করুন',
  'Internal notes about this sale…': 'এই বিক্রয় সম্পর্কে নিজের নোট…',
  'New Draft': 'নতুন খসড়া',
  'New Quotation': 'নতুন দরপত্র',
  'Valid until': 'কার্যকর থাকবে',
  Created: 'তৈরি হয়েছে',
  'A finalized sale cannot be edited (it has already affected stock and cash).':
    'চূড়ান্ত বিক্রয় সম্পাদনা করা যায় না (এটি ইতিমধ্যেই স্টক ও নগদে প্রভাব ফেলেছে)।',
  'Void it from the sale detail, then create a new sale.':
    'বিক্রয়ের বিবরণ থেকে এটি বাতিল করে নতুন একটি বিক্রয় তৈরি করুন।',
  'Reason for voiding?': 'বাতিলের কারণ কী?',
  Voided: 'বাতিল করা হয়েছে',
  'Void sale': 'বিক্রয় বাতিল করুন',
  'Search invoice / customer…': 'ইনভয়েস / গ্রাহক খুঁজুন…',
  'Search reference / customer…': 'রেফারেন্স / গ্রাহক খুঁজুন…',
  'Invoice, customer…': 'ইনভয়েস, গ্রাহক…',

  // ---- detail drawers ----
  Payments: 'পরিশোধ',
  'Audit log': 'কার্যক্রমের লগ',
  'Open full page': 'পূর্ণ পাতা খুলুন',

  // ---- returns ----
  'New Return': 'নতুন ফেরত',
  'Save Return': 'ফেরত সংরক্ষণ',
  Return: 'ফেরত',
  Returns: 'ফেরত',
  'Return qty': 'ফেরতের পরিমাণ',
  'Sold qty': 'বিক্রীত পরিমাণ',
  'Bought qty': 'ক্রীত পরিমাণ',
  'Refund method': 'ফেরতের মাধ্যম',
  'Refund via': 'ফেরতের মাধ্যম',
  'Refund total:': 'মোট ফেরত:',
  'Refund from drawer': 'ক্যাশ বাক্স থেকে ফেরত',
  'Reduce customer due': 'গ্রাহকের বাকি কমান',
  'Reduce supplier due': 'সরবরাহকারীর প্রদেয় কমান',
  'Store Credit': 'দোকানের ক্রেডিট',
  'Future-use balance': 'পরে ব্যবহারের জন্য জমা',
  'Credit Adjust': 'বাকি সমন্বয়',
  'Credit adjust': 'বাকি সমন্বয়',
  'Cashback from supplier': 'সরবরাহকারীর কাছ থেকে নগদ ফেরত',
  'Bank reversal': 'ব্যাংকে ফেরত',
  'Bank transfer back': 'ব্যাংক ট্রান্সফারে ফেরত',
  'Reverse to card': 'কার্ডে ফেরত',
  'Reverse to bKash': 'bKash-এ ফেরত',
  'Reverse to Nagad': 'Nagad-এ ফেরত',
  'Warranty replacement': 'ওয়ারেন্টিতে বদল',
  'Short shipped': 'কম পাঠানো হয়েছে',
  'Pick items to return': 'ফেরত দেওয়ার আইটেম বেছে নিন',
  'Process return': 'ফেরত প্রক্রিয়া করুন',
  'Process purchase return': 'ক্রয় ফেরত প্রক্রিয়া করুন',
  'No returns recorded.': 'কোনো ফেরত লিপিবদ্ধ নেই।',
  'No purchase returns recorded.': 'কোনো ক্রয় ফেরত লিপিবদ্ধ নেই।',
  'Open the original sale and click "Create Return".':
    'মূল বিক্রয়টি খুলে "ফেরত তৈরি করুন" চাপুন।',
  Original: 'মূল',
  'Return #': 'ফেরত নম্বর',
  'Search ref / original / supplier…': 'রেফ / মূল / সরবরাহকারী খুঁজুন…',

  // ---- shipments ----
  'Create Shipment': 'ডেলিভারি তৈরি করুন',
  'Save Shipment': 'ডেলিভারি সংরক্ষণ',
  Shipment: 'ডেলিভারি',
  'Delivery address': 'ডেলিভারির ঠিকানা',
  'Driver / courier name': 'চালক / কুরিয়ারের নাম',
  'Driver / Vehicle': 'চালক / গাড়ি',
  'Vehicle no': 'গাড়ির নম্বর',
  'Tracking no (courier)': 'ট্র্যাকিং নম্বর (কুরিয়ার)',
  'Target delivery date': 'ডেলিভারির নির্ধারিত তারিখ',
  Target: 'নির্ধারিত',
  'Items breakdown, handling notes…': 'আইটেমের বিবরণ, হ্যান্ডলিং নোট…',
  'No shipments.': 'কোনো ডেলিভারি নেই।',
  'Search ref / invoice / customer…': 'রেফ / ইনভয়েস / গ্রাহক খুঁজুন…',
});

/**
 * Tenth pass: stock (report, alerts, transfers, adjustments) and expenses
 * (drawer, categories, list).
 */
Object.assign(BN, {
  // ---- stock report / valuation ----
  'Total Units': 'মোট একক',
  'Value @ Cost': 'মূল্য (ক্রয়মূল্যে)',
  'Value @ Retail': 'মূল্য (খুচরা দামে)',
  'Value @ cost': 'মূল্য (ক্রয়মূল্যে)',
  'Value @ retail': 'মূল্য (খুচরা দামে)',
  Value: 'মূল্য',
  'Total value': 'মোট মূল্য',
  'Last Received': 'শেষ গ্রহণ',
  'Last Sold': 'শেষ বিক্রয়',
  'In stock': 'স্টক আছে',
  'Out of stock': 'স্টক নেই',
  'Low stock': 'কম স্টক',

  // ---- stock alerts ----
  'Est. Cost': 'আনুমানিক খরচ',
  'Est. cost': 'আনুমানিক খরচ',
  'Estimated cost:': 'আনুমানিক খরচ:',
  'Estimated reorder spend': 'পুনরায় অর্ডারে আনুমানিক খরচ',
  'Suggest Qty': 'প্রস্তাবিত পরিমাণ',
  Suggest: 'প্রস্তাব',
  'No low-stock items.': 'কম স্টকের কোনো পণ্য নেই।',
  'No out-of-stock items.': 'স্টক নেই এমন কোনো পণ্য নেই।',
  'No items in this list.': 'এই তালিকায় কোনো পণ্য নেই।',
  'items at or below reorder level': 'পণ্য পুনঃঅর্ডার সীমায় বা তার নিচে',
  'need restock immediately': 'এখনই স্টক করা দরকার',
  'to bring all to 2× reorder level': 'সবগুলো পুনঃঅর্ডার সীমার ২ গুণে আনতে',
  'Open in Stock Module': 'স্টক অংশে খুলুন',

  // ---- transfers ----
  'New Transfer': 'নতুন স্থানান্তর',
  'Save Transfer': 'স্থানান্তর সংরক্ষণ',
  Transfer: 'স্থানান্তর',
  'From branch': 'যে শাখা থেকে',
  'To branch': 'যে শাখায়',
  'From → To': 'থেকে → পর্যন্ত',
  '→ To': '→ পর্যন্ত',
  'Pending (not dispatched yet)': 'অপেক্ষমাণ (এখনো পাঠানো হয়নি)',
  'In Transit (sent, awaiting receive)': 'পথে আছে (পাঠানো হয়েছে, গ্রহণের অপেক্ষা)',
  'Received (instant adjustment)': 'গৃহীত (সাথে সাথেই সমন্বয়)',
  'Reason / driver / vehicle / handover notes…':
    'কারণ / চালক / গাড়ি / হস্তান্তরের নোট…',
  'Mark Received': 'গৃহীত হিসেবে চিহ্নিত করুন',
  'Receive note': 'গ্রহণের নোট',
  '(creates auto-adjustment if not 0)': '(০ না হলে নিজে থেকেই সমন্বয় হবে)',
  Diff: 'পার্থক্য',
  'e.g. 1 pc damaged in transit': 'যেমন পথে ১ পিস নষ্ট হয়েছে',
  'No transfers match.': 'কোনো স্থানান্তর মেলেনি।',
  'Search ref / branch…': 'রেফ / শাখা খুঁজুন…',
  'Total lines': 'মোট লাইন',
  'Transfer cancel not yet supported with the database':
    'ডেটাবেসে স্থানান্তর বাতিল করার সুবিধা এখনো নেই',

  // ---- adjustments ----
  'New Adjustment': 'নতুন সমন্বয়',
  'Save Adjustment': 'সমন্বয় সংরক্ষণ',
  Adjustment: 'সমন্বয়',
  'Net Qty': 'নিট পরিমাণ',
  'Net qty': 'নিট পরিমাণ',
  'Net Value': 'নিট মূল্য',
  Impact: 'প্রভাব',
  Damage: 'ক্ষতি',
  Theft: 'চুরি',
  Recount: 'পুনর্গণনা',
  'Loss value': 'ক্ষতির মূল্য',
  'Found value': 'বেশি পাওয়ার মূল্য',
  'By type': 'ধরন অনুসারে',
  'No adjustments.': 'কোনো সমন্বয় নেই।',
  'Search ref / reason / item…': 'রেফ / কারণ / পণ্য খুঁজুন…',
  'Why this adjustment? (e.g. broken during forklift move)':
    'এই সমন্বয় কেন? (যেমন ফর্কলিফটে সরানোর সময় ভেঙে গেছে)',
  'Search above to add items. Use negative qty for damage/theft, positive for found stock.':
    'আইটেম যোগ করতে উপরে খুঁজুন। ক্ষতি/চুরির জন্য ঋণাত্মক এবং বেশি পাওয়া স্টকের জন্য ধনাত্মক পরিমাণ দিন।',

  // ---- expenses ----
  'Edit Expense': 'খরচ সম্পাদনা',
  'New Expense': 'নতুন খরচ',
  'Save Expense': 'খরচ সংরক্ষণ',
  'Amount (৳)': 'পরিমাণ (৳)',
  'What was this for?': 'কী জন্য খরচ হলো?',
  'Description / Note': 'বিবরণ / নোট',
  'Attach receipt': 'রসিদ যোগ করুন',
  Attached: 'যোগ করা হয়েছে',
  'Recurring expense': 'নিয়মিত খরচ',
  Recurring: 'নিয়মিত',
  Frequency: 'কত সময় পর পর',
  'End date (optional)': 'শেষ তারিখ (ঐচ্ছিক)',
  'Automatically create future copies (rent, salary…)':
    'ভবিষ্যতের খরচ নিজে থেকেই তৈরি হবে (ভাড়া, বেতন…)',
  'Delete this expense?': 'এই খরচটি মুছে ফেলবেন?',
  'Rent, salary, transport…': 'ভাড়া, বেতন, পরিবহন…',
  'New Expense Category': 'নতুন খরচের ক্যাটাগরি',
  'Edit Expense Category': 'খরচের ক্যাটাগরি সম্পাদনা',
  'Monthly budget (৳, optional)': 'মাসিক বাজেট (৳, ঐচ্ছিক)',
  'e.g. Internet': 'যেমন ইন্টারনেট',
  '· this month': '· এই মাসে',
  'No expenses match.': 'কোনো খরচ মেলেনি।',
  'Note, reference…': 'নোট, রেফারেন্স…',
  'Non-cash': 'নগদ ছাড়া',
  'Expenses today': 'আজকের খরচ',
  'Total Expense': 'মোট খরচ',
  'Total Expenses': 'মোট খরচ',
  'Total expenses': 'মোট খরচ',
});

/**
 * Eleventh pass: the Reports hub and every report page — profit & loss, tax,
 * items, product sell / purchase, payments, customer group, sales rep, stock
 * report / alerts / transfers / adjustments, contacts and the activity log.
 */
Object.assign(BN, {
  // ---- reports hub tiles ----
  Overview: 'সারসংক্ষেপ',
  'Revenue vs cost vs expenses': 'আয় বনাম ক্রয়মূল্য বনাম খরচ',
  'Sales VAT and purchase VAT': 'বিক্রয় ভ্যাট ও ক্রয় ভ্যাট',
  'Items sold per product': 'প্রতিটি পণ্যের বিক্রয়',
  'Items purchased per product': 'প্রতিটি পণ্যের ক্রয়',
  'Money collected per method': 'মাধ্যম অনুযায়ী আদায়',
  'Money paid per method': 'মাধ্যম অনুযায়ী পরিশোধ',
  'Sales per price group': 'দামের গ্রুপ অনুযায়ী বিক্রয়',
  'Commission agent breakdown': 'কমিশন এজেন্টের বিশ্লেষণ',
  'Commission tracking (optional)': 'কমিশনের হিসাব (ঐচ্ছিক)',
  'Catalog snapshot': 'পণ্যতালিকার ঝলক',
  'Low / out-of-stock items': 'কম স্টক / স্টক নেই এমন পণ্য',
  'Inter-branch movements': 'শাখার মধ্যে স্থানান্তর',
  'Damage, theft, sample, recount': 'ক্ষতি, চুরি, নমুনা, পুনর্গণনা',
  'Statements + ledgers': 'হিসাব ও খাতা',
  'Customer / Supplier': 'গ্রাহক / সরবরাহকারী',
  'Shifts history with X / Z reports': 'এক্স / জেড রিপোর্টসহ শিফটের ইতিহাস',
  'Who did what, when': 'কে কখন কী করেছেন',
  'Top movers vs prior period': 'আগের সময়ের তুলনায় সেরা পণ্য',
  'Stock Alert': 'স্টক সতর্কতা',
  'View detailed report': 'বিস্তারিত রিপোর্ট দেখুন',
  'Time range': 'সময়সীমা',
  'Custom range': 'নিজের সময়সীমা',
  'This Week': 'এই সপ্তাহ',
  'This Month': 'এই মাস',
  'Last Month': 'গত মাস',

  // ---- profit & loss ----
  'Money in': 'যা এসেছে',
  'Money out': 'যা গেছে',
  'money in': 'যা এসেছে',
  'money out': 'যা গেছে',
  'Gross profit': 'মোট লাভ',
  'Net profit': 'নিট লাভ',
  'Cost of goods sold': 'বিক্রীত পণ্যের ক্রয়মূল্য',
  'How net profit is calculated': 'নিট লাভ কীভাবে হিসাব হয়',
  'Opening stock (by purchase price)': 'প্রারম্ভিক স্টক (ক্রয়মূল্যে)',
  'Closing stock (by sell price)': 'সমাপনী স্টক (বিক্রয় দামে)',
  'Stock adjustments (loss)': 'স্টক সমন্বয় (ক্ষতি)',
  'Sell shipping recovered': 'বিক্রয়ে আদায় হওয়া পরিবহন চার্জ',
  'Tax breakdown': 'ভ্যাটের বিশ্লেষণ',
  'Sales VAT collected': 'আদায়কৃত বিক্রয় ভ্যাট',
  'Purchase VAT paid': 'প্রদত্ত ক্রয় ভ্যাট',
  'Net VAT payable': 'প্রদেয় নিট ভ্যাট',
  'Net VAT position': 'নিট ভ্যাটের অবস্থা',
  'Net VAT position over the period': 'এই সময়ের নিট ভ্যাটের অবস্থা',
  'No stock-valuation snapshot yet — excluded from the total':
    'স্টকের মূল্যায়নের কোনো ঝলক এখনো নেই — মোট হিসাবে ধরা হয়নি',

  // ---- tax report ----
  'Sales VAT': 'বিক্রয় ভ্যাট',
  'Purchase VAT': 'ক্রয় ভ্যাট',
  'Taxable amount': 'ভ্যাটযোগ্য পরিমাণ',
  'Owed to government': 'সরকারকে দিতে হবে',
  Refundable: 'ফেরতযোগ্য',
  Combined: 'একত্রে',
  'For VAT filing': 'ভ্যাট রিটার্নের জন্য',
  Rate: 'হার',

  // ---- items / product reports ----
  'Products sold': 'বিক্রীত পণ্য',
  'Products purchased': 'ক্রীত পণ্য',
  'Units sold': 'বিক্রীত একক',
  'Units purchased': 'ক্রীত একক',
  Invoices: 'ইনভয়েস',
  Spend: 'খরচ',
  Spent: 'খরচ হয়েছে',
  'Total spend': 'মোট খরচ',
  'Avg cost': 'গড় ক্রয়মূল্য',
  'Avg ticket': 'গড় বিলের পরিমাণ',
  'No sale': 'কোনো বিক্রয় নেই',
  Hidden: 'লুকানো',

  // ---- payment reports ----
  'No payments in this range.': 'এই সময়সীমায় কোনো পরিশোধ নেই।',
  'Search ref, supplier, reference…': 'রেফ, সরবরাহকারী, রেফারেন্স খুঁজুন…',
  'Search invoice, customer, reference…': 'ইনভয়েস, গ্রাহক, রেফারেন্স খুঁজুন…',

  // ---- customer group / sales rep ----
  Gross: 'মোট',
  Net: 'নিট',
  'Net sales': 'নিট বিক্রয়',
  Agent: 'এজেন্ট',
  'Add agents': 'এজেন্ট যোগ করুন',
  Commission: 'কমিশন',
  'Commission %': 'কমিশন %',
  'Commission earned': 'অর্জিত কমিশন',
  'Commission is calculated as': 'কমিশন হিসাব হয়',
  'net sales × commission %': 'নিট বিক্রয় × কমিশন %',
  'Pending payout': 'পরিশোধের অপেক্ষায়',
  'Sales count': 'বিক্রয়ের সংখ্যা',
  'Search agent…': 'এজেন্ট খুঁজুন…',
  '. Returns within the period reduce net sales. There is no payout ledger yet, so Paid shows \u0027—\u0027 and all earned commission is reported as pending.':
    '। এই সময়ের ফেরত নিট বিক্রয় কমিয়ে দেয়। পরিশোধের খাতা এখনো নেই, তাই "পরিশোধিত" ঘরে \u0027—\u0027 থাকে এবং অর্জিত সব কমিশন অপেক্ষমাণ হিসেবে দেখানো হয়।',

  // ---- contacts report ----
  'Sales #': 'বিক্রয় সংখ্যা',
  'Bills #': 'বিল সংখ্যা',
  Collected: 'আদায় হয়েছে',
  'Total sales': 'মোট বিক্রয়',
  'Total Sales': 'মোট বিক্রয়',

  // ---- stock reports ----
  'No adjustments in this range.': 'এই সময়সীমায় কোনো সমন্বয় নেই।',
  'No transfers in this range.': 'এই সময়সীমায় কোনো স্থানান্তর নেই।',

  // ---- activity log ----
  'All actions': 'সব কার্যক্রম',
  'All entities': 'সব বিষয়',
  'No activity matches your filters.': 'এই ফিল্টারে কোনো কার্যক্রম মেলেনি।',
  'Search message, ref, user…': 'বার্তা, রেফ, ব্যবহারকারী খুঁজুন…',

  // ---- report toolbar ----
  Excel: 'এক্সেল',
  PDF: 'পিডিএফ',
});

/**
 * Twelfth pass: Settings — the hub tiles plus business info, branches, users,
 * roles, tax rates, invoice schemes, printers, receipt template, barcode, POS
 * prefs, shortcuts, appearance and backup. Technical tokens (date formats,
 * encodings, timezones, provider names) are deliberately left in English.
 */
Object.assign(BN, {
  // ---- settings hub ----
  Application: 'অ্যাপ',
  Devices: 'ডিভাইস',
  Documents: 'নথি',
  'Shop name, logo, address, currency, fiscal year':
    'দোকানের নাম, লোগো, ঠিকানা, মুদ্রা, অর্থবছর',
  'VAT and other tax rates': 'ভ্যাট ও অন্যান্য করের হার',
  'Thermal printer setup, test print': 'থার্মাল প্রিন্টার সেটআপ, পরীক্ষামূলক প্রিন্ট',
  'Header, footer, fields shown on print': 'হেডার, ফুটার, প্রিন্টে যা দেখা যাবে',
  'Default markup, payment methods, big-button mode':
    'ডিফল্ট লাভের হার, পরিশোধের মাধ্যম, বড় বাটন মোড',
  'Customize F-keys and combos': 'এফ-কী ও শর্টকাট নিজের মতো সাজান',
  'Light/dark, accent color, density': 'আলো/অন্ধকার, রঙ, ঘনত্ব',
  'Local backup, cloud sync, restore': 'স্থানীয় ব্যাকআপ, ক্লাউড সিঙ্ক, পুনরুদ্ধার',
  Configure: 'সাজান',

  // ---- business info ----
  'Shop name': 'দোকানের নাম',
  Logo: 'লোগো',
  Website: 'ওয়েবসাইট',
  'VAT TIN': 'ভ্যাট টিআইএন',
  'BIN no.': 'বিআইএন নম্বর',
  'Trade License no.': 'ট্রেড লাইসেন্স নম্বর',
  'Used on receipts, invoice header, splash screen.':
    'রসিদ, ইনভয়েসের হেডার ও শুরুর স্ক্রিনে ব্যবহার হয়।',
  Timezone: 'সময় অঞ্চল',
  'Date format': 'তারিখের বিন্যাস',
  'Currency position': 'মুদ্রার প্রতীকের জায়গা',
  'Decimal places': 'দশমিকের ঘর',
  'Thousand separator': 'হাজারের বিভাজক',
  'Comma · 1,000': 'কমা · 1,000',
  'Dot · 1.000': 'ডট · 1.000',
  'Space · 1 000': 'ফাঁকা · 1 000',
  'None · 1000': 'কিছুই নয় · 1000',
  'Fiscal year starts': 'অর্থবছর শুরু',
  'Default branch': 'ডিফল্ট শাখা',
  'বাংলা (Bangla)': 'বাংলা',
  January: 'জানুয়ারি',
  February: 'ফেব্রুয়ারি',
  March: 'মার্চ',
  April: 'এপ্রিল',
  May: 'মে',
  June: 'জুন',
  'July (BD default)': 'জুলাই (বাংলাদেশে ডিফল্ট)',
  August: 'আগস্ট',
  September: 'সেপ্টেম্বর',
  October: 'অক্টোবর',
  November: 'নভেম্বর',
  December: 'ডিসেম্বর',

  // ---- branches ----
  'Edit Branch': 'শাখা সম্পাদনা',
  'Branch name': 'শাখার নাম',
  'Branch code': 'শাখার কোড',
  'Branch address': 'শাখার ঠিকানা',
  'Branch manager': 'শাখা ব্যবস্থাপক',
  'Active branch': 'সক্রিয় শাখা',
  'No branches.': 'কোনো শাখা নেই।',
  'Search name, code, manager…': 'নাম, কোড, ব্যবস্থাপক খুঁজুন…',

  // ---- users / roles ----
  'Edit User': 'ব্যবহারকারী সম্পাদনা',
  Role: 'ভূমিকা',
  'All roles': 'সব ভূমিকা',
  'Branches assigned': 'যে শাখাগুলো দেওয়া হয়েছে',
  'PIN (4-6 digits)': 'পিন (৪-৬ সংখ্যা)',
  'Last login': 'শেষ সাইন ইন',
  'Just now': 'এইমাত্র',
  Activate: 'সক্রিয় করুন',
  Deactivate: 'নিষ্ক্রিয় করুন',
  'Auto-lock': 'স্বয়ংক্রিয় লক',
  'Lock now': 'এখনই লক করুন',
  'Lock the screen after a period of inactivity. Unlock with your PIN.':
    'কিছুক্ষণ কাজ না করলে স্ক্রিন লক হয়ে যাবে। পিন দিয়ে খুলবেন।',
  'No users match your filters.': 'এই ফিল্টারে কোনো ব্যবহারকারী মেলেনি।',
  'Search name, username, phone, email…': 'নাম, ইউজারনেম, ফোন, ইমেইল খুঁজুন…',
  'e.g. rana': 'যেমন rana',
  'e.g. 1234': 'যেমন 1234',
  'Grant all': 'সব অনুমতি দিন',
  'Revoke all': 'সব অনুমতি সরান',
  'Select a role.': 'একটি ভূমিকা বেছে নিন।',
  'Full access — owner / shop manager': 'সম্পূর্ণ অ্যাক্সেস — মালিক / দোকান ব্যবস্থাপক',
  'Day-to-day operations, no destructive settings':
    'প্রতিদিনের কাজ, ঝুঁকিপূর্ণ সেটিংস নয়',
  'POS-focused: checkout, returns, basic customer lookup':
    'কাউন্টারভিত্তিক: বিক্রয়, ফেরত, গ্রাহক খোঁজা',
  'Receives stock, transfers, and adjusts inventory':
    'স্টক গ্রহণ, স্থানান্তর ও সমন্বয় করেন',
  'Stock Keeper': 'স্টক কিপার',

  // ---- permission labels ----
  'POS / Checkout': 'বিক্রয় কাউন্টার',
  'Open POS screen': 'বিক্রয় কাউন্টারের স্ক্রিন খুলুন',
  'Open shift': 'শিফট খুলুন',
  'View sales': 'বিক্রয় দেখুন',
  'View purchases': 'ক্রয় দেখুন',
  'View products': 'পণ্য দেখুন',
  'View stock': 'স্টক দেখুন',
  'View customers': 'গ্রাহক দেখুন',
  'View suppliers': 'সরবরাহকারী দেখুন',
  'View expenses': 'খরচ দেখুন',
  'View reports': 'হিসাব দেখুন',
  'Edit customers': 'গ্রাহক সম্পাদনা',
  'Edit suppliers': 'সরবরাহকারী সম্পাদনা',
  'Stock transfer': 'স্টক স্থানান্তর',
  'Stock adjustment': 'স্টক সমন্বয়',
  'Pay supplier bill': 'সরবরাহকারীর বিল পরিশোধ',
  'Manage roles': 'ভূমিকা ব্যবস্থাপনা',
  'Manage printers / devices': 'প্রিন্টার / ডিভাইস ব্যবস্থাপনা',
  'Import sales CSV': 'বিক্রয়ের CSV ইম্পোর্ট',

  // ---- tax rates ----
  'Add Tax Rate': 'ভ্যাটের হার যোগ করুন',
  'Edit Tax Rate': 'ভ্যাটের হার সম্পাদনা',
  'Percentage *': 'শতকরা হার *',
  Scope: 'যেখানে প্রযোজ্য',
  'Sales only': 'শুধু বিক্রয়ে',
  'Purchases only': 'শুধু ক্রয়ে',
  'Products only': 'শুধু পণ্যে',
  'Mark as default': 'ডিফল্ট করুন',
  'No tax rates.': 'কোনো ভ্যাটের হার নেই।',
  'No Tax': 'ভ্যাট নেই',
  'VAT %': 'ভ্যাট %',
  'VAT 5%': 'ভ্যাট ৫%',
  'VAT 15%': 'ভ্যাট ১৫%',

  // ---- invoice schemes ----
  'Add Scheme': 'পদ্ধতি যোগ করুন',
  'Add Invoice Scheme': 'ইনভয়েস পদ্ধতি যোগ করুন',
  'Edit Invoice Scheme': 'ইনভয়েস পদ্ধতি সম্পাদনা',
  'Document type': 'নথির ধরন',
  'Sale Invoice': 'বিক্রয় ইনভয়েস',
  'POS Receipt': 'কাউন্টারের রসিদ',
  Prefix: 'শুরুর অংশ',
  Separator: 'বিভাজক',
  'Start number': 'শুরুর নম্বর',
  'Counter padding': 'নম্বরের ঘর সংখ্যা',
  'Year format': 'সনের বিন্যাস',
  'No year': 'সন নেই',
  'Live preview': 'সরাসরি প্রিভিউ',
  'Manual numbers': 'নিজের হাতে দেওয়া নম্বর',
  'Manual numbers (optional)': 'নিজের হাতে দেওয়া নম্বর (ঐচ্ছিক)',
  'Cannot delete the default scheme for this document type':
    'এই ধরনের নথির ডিফল্ট পদ্ধতি মুছে ফেলা যাবে না',
  'Default Sale Invoice': 'ডিফল্ট বিক্রয় ইনভয়েস',
  'Default POS': 'ডিফল্ট কাউন্টার',
  'Default Purchase': 'ডিফল্ট ক্রয়',
  'Default Quotation': 'ডিফল্ট দরপত্র',
  'Default Draft': 'ডিফল্ট খসড়া',
  'Default Returns': 'ডিফল্ট ফেরত',
  'Default Shipment': 'ডিফল্ট ডেলিভারি',

  // ---- printers ----
  'Edit Printer': 'প্রিন্টার সম্পাদনা',
  'Printer name': 'প্রিন্টারের নাম',
  Model: 'মডেল',
  Connection: 'সংযোগ',
  'Network (IP)': 'নেটওয়ার্ক (আইপি)',
  Network: 'নেটওয়ার্ক',
  'IP address': 'আইপি ঠিকানা',
  'Port / device': 'পোর্ট / ডিভাইস',
  Paper: 'কাগজ',
  'Paper width': 'কাগজের চওড়া',
  'A4 / 210 mm': 'A4 / ২১০ মিমি',
  '50 mm': '৫০ মিমি',
  '58 mm': '৫৮ মিমি',
  '80 mm': '৮০ মিমি',
  Encoding: 'এনকোডিং',
  'UTF-8 (Bangla works)': 'UTF-8 (বাংলা চলে)',
  Any: 'যেকোনো',
  Test: 'পরীক্ষা',
  'Mark as default printer': 'ডিফল্ট প্রিন্টার করুন',
  'No printer configured. Add a printer profile to enable thermal printing.':
    'কোনো প্রিন্টার সেট করা নেই। থার্মাল প্রিন্ট চালু করতে একটি প্রিন্টার যোগ করুন।',
  'e.g. Epson TM-T82': 'যেমন Epson TM-T82',

  // ---- receipt template ----
  Header: 'হেডার',
  Footer: 'ফুটার',
  'Header text (one line per row)': 'হেডারের লেখা (প্রতি সারিতে এক লাইন)',
  'Footer text (one line per row)': 'ফুটারের লেখা (প্রতি সারিতে এক লাইন)',
  'Show on receipt': 'রসিদে দেখান',
  'Show shop logo': 'দোকানের লোগো দেখান',
  'Cashier name': 'ক্যাশিয়ারের নাম',
  'Customer phone': 'গ্রাহকের ফোন',
  'Customer address': 'গ্রাহকের ঠিকানা',
  'Barcode of invoice no': 'ইনভয়েস নম্বরের বারকোড',
  'QR code (invoice link)': 'কিউআর কোড (ইনভয়েসের লিংক)',
  'Receipt template saved': 'রসিদের নমুনা সংরক্ষিত',
  'The preview always uses the current shop info and settings. Sample data only.':
    'প্রিভিউতে সবসময় বর্তমান দোকানের তথ্য ও সেটিংস ব্যবহার হয়। শুধু নমুনা তথ্য।',
  Sample: 'নমুনা',

  // ---- POS prefs ----
  'Pricing defaults': 'দামের ডিফল্ট',
  'Default markup %': 'ডিফল্ট লাভের হার %',
  'Default order tax %': 'ডিফল্ট অর্ডার ভ্যাট %',
  'Markup / tax pre-fill on the POS hero screen':
    'বিক্রয় কাউন্টারে লাভের হার / ভ্যাট আগেই বসানো',
  'These pre-fill new cart lines and the order tax dropdown.':
    'নতুন কার্টের লাইন ও অর্ডার ভ্যাটের ঘরে এগুলো আগেই বসে যাবে।',
  'Default payment method': 'ডিফল্ট পরিশোধের মাধ্যম',
  'Payment modal pre-selected method and shown buttons':
    'পরিশোধের উইন্ডোতে আগে থেকে বাছা মাধ্যম ও যে বাটনগুলো দেখা যাবে',
  'Only methods toggled on appear in the Payment modal. The default method is always shown.':
    'যেগুলো চালু করা আছে শুধু সেগুলোই পরিশোধের উইন্ডোতে দেখা যাবে। ডিফল্ট মাধ্যমটি সবসময় থাকে।',
  Behavior: 'আচরণ',
  'Auto-print receipt on save': 'সংরক্ষণের সাথে সাথেই রসিদ প্রিন্ট',
  'Print as soon as payment completes, no extra click.':
    'পরিশোধ শেষ হলেই প্রিন্ট হবে, আলাদা ক্লিক লাগবে না।',
  'Reset customer on new cart': 'নতুন কার্টে গ্রাহক আবার শুরু থেকে',
  'Customer reset behavior between transactions':
    'দুই বিক্রয়ের মাঝে গ্রাহক কীভাবে বদলাবে',
  'Each new cart starts with Walk-in customer. Turn off to keep last customer.':
    'প্রতিটি নতুন কার্ট সাধারণ গ্রাহক দিয়ে শুরু হবে। বন্ধ করলে আগের গ্রাহক থেকে যাবে।',
  'Allow negative stock by default': 'ডিফল্টভাবে স্টকের বেশি বিক্রয়ের অনুমতি',
  'Negative stock guard at cart line level': 'কার্টের লাইনে স্টকের সীমা যাচাই',
  'Sell items even when stock is zero. Can be overridden per cart.':
    'স্টক শূন্য হলেও বিক্রি করা যাবে। প্রতিটি কার্টে আলাদা করে বদলানো যায়।',
  'Big-button mode': 'বড় বাটন মোড',
  'Larger product tiles and on-screen number pad. Good for touch screens.':
    'বড় পণ্যের ঘর ও স্ক্রিনে নম্বর প্যাড। টাচ স্ক্রিনের জন্য ভালো।',
  'What this affects': 'এটি কী কী বদলায়',
  'POS preferences saved': 'বিক্রয় কাউন্টারের পছন্দ সংরক্ষিত',

  // ---- appearance ----
  'Theme mode': 'থিম মোড',
  'Accent color': 'মূল রঙ',
  Density: 'ঘনত্ব',
  'Font size': 'লেখার আকার',
  Primary: 'প্রধান',
  Secondary: 'গৌণ',
  Outline: 'আউটলাইন',
  Blue: 'নীল',
  Teal: 'সবুজাভ নীল',
  Indigo: 'গাঢ় নীল',
  Violet: 'বেগুনি',
  Rose: 'গোলাপি',
  Amber: 'সোনালি',
  Sky: 'আকাশি',
  'Compact reduces row heights and paddings across lists. Useful on smaller screens.':
    'ঘন বিন্যাসে সারির উচ্চতা ও ফাঁকা জায়গা কমে যায়। ছোট স্ক্রিনে সুবিধা হয়।',
  'Applies to the whole app. Useful for older shop floors with larger displays.':
    'পুরো অ্যাপে প্রযোজ্য। বড় ডিসপ্লেওয়ালা পুরোনো দোকানের জন্য সুবিধা।',

  // ---- backup ----
  'Local backup': 'স্থানীয় ব্যাকআপ',
  'Local backup only': 'শুধু স্থানীয় ব্যাকআপ',
  'Backup now': 'এখনই ব্যাকআপ নিন',
  'Auto backup': 'স্বয়ংক্রিয় ব্যাকআপ',
  Off: 'বন্ধ',
  'On shift close': 'শিফট বন্ধের সময়',
  'Last local backup': 'শেষ স্থানীয় ব্যাকআপ',
  'Restore from file': 'ফাইল থেকে পুনরুদ্ধার',
  'Choose backup file…': 'ব্যাকআপ ফাইল বেছে নিন…',
  'Sync now': 'এখনই সিঙ্ক করুন',
  'Sync completed.': 'সিঙ্ক সম্পন্ন।',
  'Show sync history': 'সিঙ্কের ইতিহাস দেখান',
  'Signed in as': 'সাইন ইন করা আছে',
  Disconnect: 'সংযোগ বিচ্ছিন্ন',
  Provider: 'প্রোভাইডার',
  'Personal Google account': 'ব্যক্তিগত Google অ্যাকাউন্ট',
  'Self-hosted or cloud Postgres': 'নিজের সার্ভার বা ক্লাউড Postgres',
  'Data export': 'তথ্য এক্সপোর্ট',
  'Recommended:': 'পরামর্শ:',
  'A SQLite snapshot saved to your computer. Use this if you have no internet.':
    'আপনার কম্পিউটারে সংরক্ষিত একটি ডেটাবেস ফাইল। ইন্টারনেট না থাকলে এটিই ব্যবহার করুন।',
  'Mirror your shop data to the cloud across multiple devices.':
    'একাধিক ডিভাইসে দোকানের তথ্য ক্লাউডে রাখুন।',
  'Cloud sync is disabled. Pick a provider above to enable cross-device sync. You can still use Local backup without connecting a provider.':
    'ক্লাউড সিঙ্ক বন্ধ আছে। একাধিক ডিভাইসে সিঙ্ক করতে উপরে একটি প্রোভাইডার বেছে নিন। প্রোভাইডার ছাড়াও স্থানীয় ব্যাকআপ ব্যবহার করা যাবে।',
  'Connect a cloud provider first.': 'আগে একটি ক্লাউড প্রোভাইডার সংযুক্ত করুন।',
  'Download CSV exports for accounting, audits, or migration.':
    'হিসাবরক্ষণ, নিরীক্ষা বা তথ্য সরানোর জন্য CSV ডাউনলোড করুন।',
  'Need a full snapshot? Use the Local backup button — that captures everything in one file.':
    'পুরো তথ্যের ব্যাকআপ দরকার? স্থানীয় ব্যাকআপ বাটন ব্যবহার করুন — সব কিছু একটি ফাইলেই থাকবে।',
  'The shop will close for ~30s while restoring.':
    'পুনরুদ্ধারের সময় অ্যাপটি প্রায় ৩০ সেকেন্ড বন্ধ থাকবে।',
  'Pick a .pos-backup file (mock).': 'একটি .pos-backup ফাইল বেছে নিন।',
  'Local backup written to ~/Documents/HardwarePOS/backups/':
    'স্থানীয় ব্যাকআপ এখানে সংরক্ষিত হয়েছে: ~/Documents/HardwarePOS/backups/',
  '. Captures the day\u0027s data right after Z-Report.':
    '। জেড-রিপোর্টের পরপরই দিনের তথ্য সংরক্ষণ করে।',

  // ---- sales agents ----
  'Edit Agent': 'এজেন্ট সম্পাদনা',
  'No commission agents yet.': 'এখনো কোনো কমিশন এজেন্ট নেই।',
  'When to use this': 'কখন ব্যবহার করবেন',
});

/**
 * Thirteenth pass: the SMS module — hub, send, templates, groups, history,
 * gateway setup and credit top-up. Provider names (SSL Wireless, BulkSMSBD,
 * BanglaTrac, Zaman IT), API hostnames and encoding names stay in English.
 */
Object.assign(BN, {
  // ---- hub ----
  Sections: 'অংশ',
  'Messages sent': 'পাঠানো বার্তা',
  'Credit balance': 'ক্রেডিট ব্যালেন্স',
  'Gateway connected': 'গেটওয়ে সংযুক্ত',
  'Review history': 'ইতিহাস দেখুন',
  'Single, group, or template-based send': 'একক, গ্রুপ বা নমুনাভিত্তিক পাঠানো',
  'Reusable messages with variables': 'ভেরিয়েবলসহ বারবার ব্যবহারের বার্তা',
  'Customer segments for blast messaging': 'একসাথে বার্তা পাঠানোর গ্রাহক দল',
  'Sent, delivered, failed messages': 'পাঠানো, পৌঁছানো ও ব্যর্থ বার্তা',
  'BD provider setup, sender ID, test':
    'দেশীয় প্রোভাইডার সেটআপ, সেন্ডার আইডি, পরীক্ষা',
  "You can compose and queue messages, but they won't actually send until you connect a BD SMS provider (SSL Wireless, BulkSMSBD, Zaman IT, etc.) in Gateway settings.":
    'আপনি বার্তা লিখে জমা রাখতে পারবেন, তবে গেটওয়ে সেটিংসে একটি দেশীয় এসএমএস প্রোভাইডার (SSL Wireless, BulkSMSBD, Zaman IT ইত্যাদি) সংযুক্ত না করা পর্যন্ত সেগুলো আসলে যাবে না।',

  // ---- send SMS ----
  'Send to': 'কাকে পাঠাবেন',
  Recipient: 'প্রাপক',
  Recipients: 'প্রাপক',
  'Phone numbers': 'ফোন নম্বর',
  'Manual numbers': 'নিজের হাতে দেওয়া নম্বর',
  'Use a template…': 'একটি নমুনা ব্যবহার করুন…',
  'Create one': 'একটি তৈরি করুন',
  'Your message will appear here.': 'আপনার বার্তা এখানে দেখা যাবে।',
  'Send summary': 'পাঠানোর সারসংক্ষেপ',
  'After send': 'পাঠানোর পর',
  'Per message': 'প্রতি বার্তায়',
  'Total cost': 'মোট খরচ',
  Chars: 'অক্ষর',
  Parts: 'অংশ',
  'Buy more': 'আরও কিনুন',
  'Send anyway': 'তবুও পাঠান',
  'Delivery status updates in History.': 'পৌঁছানোর অবস্থা ইতিহাসে হালনাগাদ হয়।',
  'Gateway not connected. Messages will be marked failed.':
    'গেটওয়ে সংযুক্ত নয়। বার্তাগুলো ব্যর্থ হিসেবে চিহ্নিত হবে।',
  'Messages will be queued and shown as failed until you connect a provider. Continue anyway?':
    'প্রোভাইডার সংযুক্ত না করা পর্যন্ত বার্তাগুলো জমা থাকবে এবং ব্যর্থ দেখাবে। তবুও চালিয়ে যাবেন?',
  'Group / bulk send · variables personalized per recipient':
    'গ্রুপ / একসাথে পাঠানো · প্রতিটি প্রাপকের জন্য ভেরিয়েবল আলাদা বসে',
  'Bangla / Unicode characters detected — each part holds 70 chars instead of 160.':
    'বাংলা / ইউনিকোড অক্ষর পাওয়া গেছে — প্রতিটি অংশে ১৬০-এর বদলে ৭০ অক্ষর যাবে।',
  'BD format: 11 digits starting with': 'বাংলাদেশি বিন্যাস: ০১ দিয়ে শুরু ১১ সংখ্যা',
  '. Hyphens and spaces are stripped automatically.':
    '। হাইফেন ও ফাঁকা জায়গা নিজে থেকেই বাদ যায়।',
  'Insert:': 'বসান:',

  // ---- templates ----
  'Edit Template': 'নমুনা সম্পাদনা',
  Body: 'বার্তার লেখা',
  Language: 'ভাষা',
  Greeting: 'শুভেচ্ছা',
  Promotion: 'প্রচার',
  'Active (shown in template picker)': 'সক্রিয় (নমুনা বাছাইয়ে দেখা যাবে)',
  'Unicode (70/part)': 'ইউনিকোড (৭০/অংশ)',
  'GSM-7 (160/part)': 'GSM-7 (১৬০/অংশ)',
  'Template body copied': 'নমুনার লেখা কপি হয়েছে',
  'No templates match.': 'কোনো নমুনা মেলেনি।',
  'Search name or body…': 'নাম বা লেখা খুঁজুন…',
  'e.g. Thank you (Sale)': 'যেমন ধন্যবাদ (বিক্রয়)',
  'Thank you (Sale)': 'ধন্যবাদ (বিক্রয়)',

  // ---- groups ----
  'One per line or comma-separated': 'প্রতি লাইনে একটি, বা কমা দিয়ে আলাদা',
  'For numbers not in your customer list (e.g. a one-time promo blast).':
    'গ্রাহক তালিকায় নেই এমন নম্বরের জন্য (যেমন একবারের প্রচার বার্তা)।',
  'This removes the group but keeps the customers.':
    'এতে গ্রুপটি মুছে যাবে, গ্রাহকেরা থেকে যাবেন।',
  'All Retail Customers': 'সব খুচরা গ্রাহক',
  'Builders + tradesmen segment': 'নির্মাতা ও কারিগর দল',
  'Auto-built from customer group = Retail':
    'গ্রাহক গ্রুপ = খুচরা থেকে নিজে থেকেই তৈরি',
  'Eid promo': 'ঈদের প্রচার',

  // ---- history ----
  Action: 'কার্যক্রম',
  When: 'কখন',
  'Message resent': 'বার্তা আবার পাঠানো হয়েছে',
  'History cleared': 'ইতিহাস মুছে ফেলা হয়েছে',
  'Clear all SMS history?': 'এসএমএসের সব ইতিহাস মুছে ফেলবেন?',
  'This permanently removes all logged messages.':
    'এতে লিপিবদ্ধ সব বার্তা স্থায়ীভাবে মুছে যাবে।',
  'No messages match.': 'কোনো বার্তা মেলেনি।',
  'Search name, phone, message…': 'নাম, ফোন, বার্তা খুঁজুন…',

  // ---- gateway ----
  Credentials: 'পরিচয়ের তথ্য',
  'API key': 'এপিআই কী',
  'API URL': 'এপিআই ঠিকানা',
  'API user / Username': 'এপিআই ইউজার / ইউজারনেম',
  'Sender ID': 'সেন্ডার আইডি',
  'Sending defaults': 'পাঠানোর ডিফল্ট',
  'Unicode mode': 'ইউনিকোড মোড',
  'Auto (recommended)': 'স্বয়ংক্রিয় (পরামর্শকৃত)',
  'Always Unicode': 'সবসময় ইউনিকোড',
  'Never (GSM-7 only)': 'কখনো নয় (শুধু GSM-7)',
  'Max parts per message': 'প্রতি বার্তায় সর্বোচ্চ অংশ',
  'Block sends that would split into more than this many parts (cost guardrail).':
    'এর চেয়ে বেশি অংশে ভাগ হলে বার্তাটি পাঠানো আটকে দিন (খরচ বাঁচাতে)।',
  'Test connection': 'সংযোগ পরীক্ষা করুন',
  'Send test SMS': 'পরীক্ষামূলক এসএমএস পাঠান',
  'Test phone number': 'পরীক্ষার ফোন নম্বর',
  'Testing…': 'পরীক্ষা করা হচ্ছে…',
  'Auto-send triggers': 'স্বয়ংক্রিয় পাঠানোর নিয়ম',
  'Send thank-you SMS on sale': 'বিক্রয়ে ধন্যবাদ এসএমএস পাঠান',
  'Send confirmation on payment': 'পরিশোধে নিশ্চিতকরণ পাঠান',
  'Send weekly due reminder': 'সাপ্তাহিক বাকির স্মরণিকা পাঠান',
  'Send birthday wish': 'জন্মদিনের শুভেচ্ছা পাঠান',
  "Uses the default 'Thank you (Sale)' template.":
    'ডিফল্ট "ধন্যবাদ (বিক্রয়)" নমুনাটি ব্যবহার করে।',
  'When a payment is recorded against any sale.':
    'কোনো বিক্রয়ের বিপরীতে পরিশোধ লিপিবদ্ধ হলে।',
  'Every Monday morning to customers with outstanding due.':
    'প্রতি সোমবার সকালে বাকি থাকা গ্রাহকদের কাছে।',
  "Morning of customer's birthday, if dob is set.":
    'গ্রাহকের জন্মদিনের সকালে, জন্মতারিখ দেওয়া থাকলে।',
  'Mock mode — messages logged locally only':
    'পরীক্ষামূলক মোড — বার্তা শুধু এখানেই লিপিবদ্ধ হচ্ছে',
  'Bring-your-own provider': 'নিজের প্রোভাইডার ব্যবহার করুন',
  'BD provider tips': 'দেশীয় প্রোভাইডার নিয়ে পরামর্শ',
  'Most providers need pre-approved sender IDs (alphabetic, 3-11 chars)':
    'বেশিরভাগ প্রোভাইডারে আগে অনুমোদিত সেন্ডার আইডি লাগে (ইংরেজি অক্ষর, ৩-১১টি)',
  'Pre-approved alphabetic ID by your provider (BTRC requirement). Max 11 chars.':
    'আপনার প্রোভাইডারের অনুমোদিত ইংরেজি অক্ষরের আইডি (বিটিআরসির নিয়ম)। সর্বোচ্চ ১১ অক্ষর।',
  'BTRC may rate-limit promotional SMS during 9pm-9am':
    'রাত ৯টা থেকে সকাল ৯টার মধ্যে প্রচারমূলক এসএমএসে বিটিআরসি সীমা দিতে পারে',
  'Bangla messages cost the same but split at 70 chars (vs 160 GSM-7)':
    'বাংলা বার্তার খরচ একই, তবে ৭০ অক্ষরে ভাগ হয় (GSM-7-এ ১৬০)',
  'Numbers must be 11 digits starting with 01; auto-strip dashes/spaces':
    'নম্বর ০১ দিয়ে শুরু ১১ সংখ্যার হতে হবে; হাইফেন ও ফাঁকা জায়গা নিজে থেকেই বাদ যায়',
  'Stored encrypted in OS keychain by backend (never plaintext on disk).':
    'সিস্টেমের নিরাপদ কী-চেইনে এনক্রিপ্ট করে রাখা হয় (ডিস্কে খোলা অবস্থায় নয়)।',
  'Configure provider, API key and sender ID first.':
    'আগে প্রোভাইডার, এপিআই কী ও সেন্ডার আইডি সেট করুন।',
  'Gateway connection successful (mock).': 'গেটওয়ের সংযোগ সফল।',
  'e.g. HARDWAREPOS': 'যেমন HARDWAREPOS',
  'e.g. yourshop_api': 'যেমন yourshop_api',

  // ---- buy SMS ----
  'Choose a pack': 'একটি প্যাক বেছে নিন',
  'Or custom amount': 'অথবা নিজের মতো পরিমাণ',
  'Amount (BDT)': 'পরিমাণ (টাকা)',
  'Pack amount': 'প্যাকের দাম',
  'Bonus credit': 'বোনাস ক্রেডিট',
  'Total credit': 'মোট ক্রেডিট',
  'Order summary': 'অর্ডারের সারসংক্ষেপ',
  'Messages added': 'বার্তা যোগ হয়েছে',
  Purchased: 'কেনা হয়েছে',
  Popular: 'জনপ্রিয়',
  'Bonus credit applies to packs only. Custom top-ups don\u0027t get bonus.':
    'বোনাস ক্রেডিট শুধু প্যাকে পাওয়া যায়। নিজের মতো পরিমাণে বোনাস নেই।',
  'Credit added instantly to your balance after payment confirmation.':
    'পরিশোধ নিশ্চিত হওয়ার সাথে সাথেই ক্রেডিট আপনার ব্যালেন্সে যোগ হবে।',
});

/**
 * Fourteenth pass: sign-in / lock screen / first-run wizard, the CSV importers,
 * the dashboard customise panel and profit detail, the error boundary, and the
 * store-level toast messages that can surface from any screen.
 */
Object.assign(BN, {
  // ---- login / lock / wizard ----
  'Run your shop,': 'আপনার দোকান চালান,',
  'even offline.': 'ইন্টারনেট ছাড়াও।',
  'Fast checkout, stock control, dues tracking, and reports — built for the Bangladeshi hardware trade.':
    'দ্রুত বিক্রয়, স্টক নিয়ন্ত্রণ, বাকির হিসাব ও রিপোর্ট — বাংলাদেশের হার্ডওয়্যার ব্যবসার জন্য তৈরি।',
  '. If you are the owner and locked out, restore from a backup.':
    '। আপনি মালিক হয়ে আটকে গেলে ব্যাকআপ থেকে পুনরুদ্ধার করুন।',
  'e.g. seam': 'যেমন seam',
  'Enter your PIN to unlock · or sign out to switch user':
    'খুলতে পিন দিন · অথবা ব্যবহারকারী বদলাতে সাইন আউট করুন',
  'Welcome to Hardware POS': 'স্বাগতম',
  'Setup Wizard': 'সেটআপ সহায়িকা',
  'Get started': 'শুরু করুন',
  Continue: 'চালিয়ে যান',
  'All set!': 'সব প্রস্তুত!',
  'Setting up…': 'সেট করা হচ্ছে…',
  'Taking you into the app…': 'অ্যাপে নিয়ে যাওয়া হচ্ছে…',
  "Let's set up your shop in a few quick steps. You can change any of this later in Settings.":
    'কয়েকটি সহজ ধাপে আপনার দোকান সেট করে নিই। পরে সেটিংস থেকে যেকোনো কিছু বদলাতে পারবেন।',
  'You can add more branches later in Settings → Branches. This becomes your default.':
    'পরে সেটিংস → শাখা থেকে আরও শাখা যোগ করতে পারবেন। এটিই আপনার ডিফল্ট শাখা হবে।',
  "You'll use this PIN to sign in and unlock the screen.":
    'এই পিন দিয়েই সাইন ইন করবেন ও স্ক্রিন খুলবেন।',
  'Most BD hardware shops sell tax-inclusive — "No Tax" (0%) is a fine default.':
    'বাংলাদেশের বেশিরভাগ হার্ডওয়্যার দোকান দামের ভেতরেই ভ্যাট ধরে — "ভ্যাট নেই" (০%) রাখাই ভালো।',
  'Skip for now (set up later in Settings)': 'এখন বাদ দিন (পরে সেটিংসে সেট করবেন)',
  'Enable cloud backup': 'ক্লাউড ব্যাকআপ চালু করুন',
  'The app works fully offline. Cloud is optional and can be enabled any time.':
    'অ্যাপটি পুরোপুরি অফলাইনে চলে। ক্লাউড ঐচ্ছিক, যেকোনো সময় চালু করা যায়।',
  "Automatically back up to the cloud after each shift close. You'll connect your provider later in Settings → Backup & Sync.":
    'প্রতিটি শিফট বন্ধের পর নিজে থেকেই ক্লাউডে ব্যাকআপ হবে। প্রোভাইডার পরে সেটিংস → ব্যাকআপ ও সিঙ্ক থেকে সংযুক্ত করবেন।',
  'Default tax rate': 'ডিফল্ট ভ্যাটের হার',
  'Settings → Users': 'সেটিংস → ব্যবহারকারী',

  // ---- CSV importers ----
  Format: 'বিন্যাস',
  Row: 'সারি',
  Valid: 'ঠিক আছে',
  'Import complete': 'ইম্পোর্ট সম্পন্ন',
  'or drag and drop': 'অথবা টেনে এনে ছাড়ুন',
  'CSV up to 10MB.': 'CSV ফাইল সর্বোচ্চ ১০MB।',
  'Group rows by': 'সারি একত্র করুন এই ঘর দিয়ে',
  'One row per line item.': 'প্রতি লাইনে একটি আইটেম।',
  'One row per item. Same': 'প্রতি সারিতে একটি আইটেম। একই',
  'groups rows into one purchase.': 'দিলে সারিগুলো একটি ক্রয়ে একত্র হয়।',
  '— same invoice no means same sale.': '— একই ইনভয়েস নম্বর মানে একই বিক্রয়।',
  'Multi-row sale: same invoice = same row group':
    'একাধিক সারির বিক্রয়: একই ইনভয়েস = একই দল',
  'are required.': 'আবশ্যক।',
  '(e.g.': '(যেমন',
  'separated by': 'আলাদা করুন এই চিহ্ন দিয়ে',
  'format.': 'বিন্যাসে।',
  'must match an existing product.': 'তালিকায় থাকা কোনো পণ্যের সাথে মিলতে হবে।',
  'must match an existing product. Unknown SKUs cause errors.':
    'তালিকায় থাকা কোনো পণ্যের সাথে মিলতে হবে। অজানা এসকেইউ হলে ত্রুটি হবে।',
  'matches an existing customer; if not found, a customer is created with':
    'তালিকায় থাকা গ্রাহকের সাথে মেলানো হয়; না পেলে নতুন গ্রাহক তৈরি হয় এই তথ্য দিয়ে',
  'joins to existing supplier; if not found, created with':
    'তালিকায় থাকা সরবরাহকারীর সাথে মেলানো হয়; না পেলে নতুন তৈরি হয় এই তথ্য দিয়ে',
  'matches a top-level category by name; unknown ones are created.':
    'নাম দিয়ে উপরের স্তরের ক্যাটাগরির সাথে মেলানো হয়; না থাকলে নতুন তৈরি হয়।',
  'optional; if present, attached under the named parent.':
    'ঐচ্ছিক; দেওয়া থাকলে ওই মূল ক্যাটাগরির নিচে যোগ হয়।',
  'sets the initial outstanding due (positive = customer owes you).':
    'দিয়ে শুরুর বাকি ঠিক হয় (ধনাত্মক = গ্রাহক আপনাকে দেবেন)।',
  'sets initial payable (positive = you owe supplier).':
    'দিয়ে শুরুর প্রদেয় ঠিক হয় (ধনাত্মক = আপনি সরবরাহকারীকে দেবেন)।',
  'is the amount paid for that method on that invoice (repeat the same value across rows of one method, or split rows with different methods).':
    'ওই ইনভয়েসে ওই মাধ্যমে পরিশোধ করা টাকার পরিমাণ (একই মাধ্যমের সব সারিতে একই মান লিখুন, বা ভিন্ন মাধ্যমে আলাদা সারি করুন)।',
  '∈ Retail / Wholesale / Contractor / your custom group name.':
    '∈ Retail / Wholesale / Contractor / আপনার নিজের গ্রুপের নাম।',
  '∈ Cash / bKash / Nagad / Card / Bank / Cheque. Repeat rows with different methods to record split payments.':
    '∈ Cash / bKash / Nagad / Card / Bank / Cheque. ভাগ করে পরিশোধ দেখাতে ভিন্ন মাধ্যমে আলাদা সারি লিখুন।',
  '∈ Cash / bKash / Nagad / Card / Bank / Credit. Use repeated rows with different methods to record split payments.':
    '∈ Cash / bKash / Nagad / Card / Bank / Credit. ভাগ করে পরিশোধ দেখাতে ভিন্ন মাধ্যমে আলাদা সারি লিখুন।',
  'Backend de-dupes by phone — existing phone updates the row instead of duplicating.':
    'ফোন নম্বর দেখে মিল খোঁজা হয় — নম্বরটি আগে থেকে থাকলে নতুন সারি না বানিয়ে পুরোনোটিই হালনাগাদ হয়।',
  "Each row is one product. Categories and brands by name (we'll create new ones if missing).":
    'প্রতিটি সারি একটি পণ্য। ক্যাটাগরি ও ব্র্যান্ড নাম দিয়ে মেলানো হয় (না থাকলে নতুন তৈরি হবে)।',
  "Use the standard CSV format. Don't change column names.":
    'নির্দিষ্ট CSV বিন্যাসই ব্যবহার করুন। কলামের নাম বদলাবেন না।',
  'Preview detected rows; fix any errors; click Import.':
    'পাওয়া সারিগুলো দেখে নিন; ত্রুটি ঠিক করুন; তারপর ইম্পোর্ট চাপুন।',
  "Use products' base unit short code. Branch must match a Business Branch by name.":
    'পণ্যের মূল এককের সংক্ষিপ্ত কোড ব্যবহার করুন। শাখার নাম দোকানের শাখার সাথে মিলতে হবে।',
  'Round-trips with the export (same headers, same order).':
    'এক্সপোর্টের সাথে হুবহু মেলে (একই কলাম, একই ক্রম)।',
  'Round-trips with the export: same headers and ordering.':
    'এক্সপোর্টের সাথে হুবহু মেলে: একই কলাম ও একই ক্রম।',
  'Customers imported': 'গ্রাহক ইম্পোর্ট হয়েছে',
  'Suppliers imported': 'সরবরাহকারী ইম্পোর্ট হয়েছে',
  'Sales imported': 'বিক্রয় ইম্পোর্ট হয়েছে',
  'Purchases imported': 'ক্রয় ইম্পোর্ট হয়েছে',
  'Expenses imported': 'খরচ ইম্পোর্ট হয়েছে',
  'Stock imported': 'স্টক ইম্পোর্ট হয়েছে',

  // ---- dashboard extras ----
  Customize: 'সাজান',
  'Customize Dashboard': 'ড্যাশবোর্ড সাজান',
  'Edit layout': 'বিন্যাস সম্পাদনা',
  'Done editing': 'সম্পাদনা শেষ',
  KPIs: 'সূচক',
  Widgets: 'কার্ড',
  'Show, hide, and reorder cards': 'কার্ড দেখান, লুকান ও সাজান',
  'Show comparison deltas (+12% vs yesterday)':
    'তুলনার পরিবর্তন দেখান (গতকালের চেয়ে +১২%)',
  'Reorder is available in the dashboard itself — when "Customize" mode is on, use the up/down buttons on each card.':
    'সাজানোর কাজ ড্যাশবোর্ডেই করা যায় — "সাজান" মোড চালু থাকলে প্রতিটি কার্ডের উপরে/নিচের বাটন ব্যবহার করুন।',
  "Couldn't load dashboard data": 'ড্যাশবোর্ডের তথ্য লোড করা যায়নি',
  "The backend request failed, so live figures aren't available. Mock numbers are intentionally hidden so they can't be mistaken for real data.":
    'সার্ভারের অনুরোধ ব্যর্থ হয়েছে, তাই আসল হিসাব দেখানো যাচ্ছে না। নমুনা সংখ্যা ইচ্ছে করেই লুকানো হয়েছে যাতে সেগুলো আসল তথ্য বলে ভুল না হয়।',
  'View all': 'সব দেখুন',
  'Customers to wish': 'যাদের শুভেচ্ছা পাঠাবেন',
  'Donut by category': 'ক্যাটাগরি অনুযায়ী চিত্র',
  'Donut by tender': 'পরিশোধের মাধ্যম অনুযায়ী চিত্র',
  'Collect against dues': 'বাকির বিপরীতে আদায় করুন',
  'Goods received from supplier': 'সরবরাহকারীর কাছ থেকে পণ্য গ্রহণ',
  'New Customer': 'নতুন গ্রাহক',
  'Opening Stock': 'প্রারম্ভিক স্টক',
  'Total customer reward': 'গ্রাহকের মোট পুরস্কার',
  'Total purchase': 'মোট ক্রয়',
  'Total Purchase discount': 'ক্রয়ে মোট ছাড়',
  'Total Purchase Return': 'মোট ক্রয় ফেরত',
  'Total purchase shipping charge': 'ক্রয়ে মোট পরিবহন চার্জ',
  'Total Sell discount': 'বিক্রয়ে মোট ছাড়',
  'Total Sell Return': 'মোট বিক্রয় ফেরত',
  'Total sell round off': 'বিক্রয়ে মোট রাউন্ড অফ',
  'Total sell shipping charge': 'বিক্রয়ে মোট পরিবহন চার্জ',
  'Total transfer shipping charge': 'স্থানান্তরে মোট পরিবহন চার্জ',
  'Total Stock Adjustment': 'মোট স্টক সমন্বয়',
  'Total Stock Recovered': 'মোট উদ্ধার হওয়া স্টক',

  // ---- errors / toaster ----
  'Something went wrong': 'কিছু একটা ভুল হয়েছে',
  'Try again': 'আবার চেষ্টা করুন',
  'Reload app': 'অ্যাপ আবার চালু করুন',
  'Copy details': 'বিবরণ কপি করুন',
  Dismiss: 'সরিয়ে দিন',
  'Saving…': 'সংরক্ষণ করা হচ্ছে…',
  'This screen hit an unexpected error. Your data is safe. Try reloading the view; if it keeps happening, note what you were doing and report it.':
    'এই স্ক্রিনে অপ্রত্যাশিত একটি ত্রুটি হয়েছে। আপনার তথ্য নিরাপদ আছে। স্ক্রিনটি আবার লোড করে দেখুন; বারবার হলে আপনি কী করছিলেন তা লিখে জানান।',
  'Layout will be added in the next iteration. Approve the current screens first and I\u0027ll build this out.':
    'এই পাতার বিন্যাস পরের ধাপে যোগ হবে। আগে বর্তমান স্ক্রিনগুলো অনুমোদন করুন, তারপর এটি তৈরি হবে।',

  // ---- store-level toasts ----
  'Failed to add customer': 'গ্রাহক যোগ করা যায়নি',
  'Failed to update customer': 'গ্রাহক হালনাগাদ করা যায়নি',
  'Failed to update supplier': 'সরবরাহকারী হালনাগাদ করা যায়নি',
  'Failed to save branch': 'শাখা সংরক্ষণ ব্যর্থ',
  'Failed to update branch': 'শাখা হালনাগাদ করা যায়নি',
  'Failed to delete branch': 'শাখা মুছে ফেলা যায়নি',
  'Failed to set default branch': 'ডিফল্ট শাখা সেট করা যায়নি',
  'Failed to save brand': 'ব্র্যান্ড সংরক্ষণ ব্যর্থ',
  'Failed to update brand': 'ব্র্যান্ড হালনাগাদ করা যায়নি',
  'Failed to delete brand': 'ব্র্যান্ড মুছে ফেলা যায়নি',
  'Failed to load brands': 'ব্র্যান্ড লোড করা যায়নি',
  'Failed to save category': 'ক্যাটাগরি সংরক্ষণ ব্যর্থ',
  'Failed to update category': 'ক্যাটাগরি হালনাগাদ করা যায়নি',
  'Failed to delete category': 'ক্যাটাগরি মুছে ফেলা যায়নি',
  'Failed to load categories': 'ক্যাটাগরি লোড করা যায়নি',
  'Failed to load expense categories': 'খরচের ক্যাটাগরি লোড করা যায়নি',
  'Failed to save unit': 'একক সংরক্ষণ ব্যর্থ',
  'Failed to update unit': 'একক হালনাগাদ করা যায়নি',
  'Failed to delete unit': 'একক মুছে ফেলা যায়নি',
  'Failed to load units': 'একক লোড করা যায়নি',
  'Failed to save warranty': 'ওয়ারেন্টি সংরক্ষণ ব্যর্থ',
  'Failed to update warranty': 'ওয়ারেন্টি হালনাগাদ করা যায়নি',
  'Failed to delete warranty': 'ওয়ারেন্টি মুছে ফেলা যায়নি',
  'Failed to load warranties': 'ওয়ারেন্টি লোড করা যায়নি',
  'Failed to save price group': 'দামের গ্রুপ সংরক্ষণ ব্যর্থ',
  'Failed to update price group': 'দামের গ্রুপ হালনাগাদ করা যায়নি',
  'Failed to delete price group': 'দামের গ্রুপ মুছে ফেলা যায়নি',
  'Failed to load price groups': 'দামের গ্রুপ লোড করা যায়নি',
  'Failed to save tax rate': 'ভ্যাটের হার সংরক্ষণ ব্যর্থ',
  'Failed to update tax rate': 'ভ্যাটের হার হালনাগাদ করা যায়নি',
  'Failed to delete tax rate': 'ভ্যাটের হার মুছে ফেলা যায়নি',
  'Failed to save business info': 'ব্যবসার তথ্য সংরক্ষণ ব্যর্থ',
  'Failed to save user': 'ব্যবহারকারী সংরক্ষণ ব্যর্থ',
  'Failed to update user': 'ব্যবহারকারী হালনাগাদ করা যায়নি',
  'Failed to delete user': 'ব্যবহারকারী মুছে ফেলা যায়নি',
  'Failed to save role': 'ভূমিকা সংরক্ষণ ব্যর্থ',
  'Failed to update role': 'ভূমিকা হালনাগাদ করা যায়নি',
  'Failed to delete role': 'ভূমিকা মুছে ফেলা যায়নি',
  'Failed to update permissions': 'অনুমতি হালনাগাদ করা যায়নি',
  'Failed to save agent': 'এজেন্ট সংরক্ষণ ব্যর্থ',
  'Failed to update agent': 'এজেন্ট হালনাগাদ করা যায়নি',
  'Failed to delete agent': 'এজেন্ট মুছে ফেলা যায়নি',
  'Failed to save shipment': 'ডেলিভারি সংরক্ষণ ব্যর্থ',
  'Failed to update shipment': 'ডেলিভারি হালনাগাদ করা যায়নি',
  'Failed to load returns/shipments': 'ফেরত / ডেলিভারি লোড করা যায়নি',
  'Failed to cancel purchase': 'ক্রয় বাতিল করা যায়নি',
  'Failed to delete purchase': 'ক্রয় মুছে ফেলা যায়নি',
  'Failed to update expense': 'খরচ হালনাগাদ করা যায়নি',
  'Failed to void expense': 'খরচ বাতিল করা যায়নি',
});

/**
 * Fifteenth pass: the leftovers found by walking the pages again — per-page
 * total strips on the list screens, short column headers with a ৳ / ± marker,
 * and a handful of one-off badges and hints.
 */
Object.assign(BN, {
  // ---- page-scoped totals ----
  'Customers (this page)': 'গ্রাহক (এই পাতা)',
  'Suppliers (this page)': 'সরবরাহকারী (এই পাতা)',
  'Outstanding (this page)': 'অপরিশোধিত (এই পাতা)',
  'Total Paid (this page)': 'মোট পরিশোধিত (এই পাতা)',
  'Total Sales (this page)': 'মোট বিক্রয় (এই পাতা)',
  'Total Purchase (this page)': 'মোট ক্রয় (এই পাতা)',
  'Total (this page)': 'মোট (এই পাতা)',
  'Count (this page)': 'সংখ্যা (এই পাতা)',
  'Cash (this page)': 'নগদ (এই পাতা)',
  'Non-cash (this page)': 'নগদ ছাড়া (এই পাতা)',
  'Low Stock (this page)': 'কম স্টক (এই পাতা)',
  'Out of Stock (this page)': 'স্টক নেই (এই পাতা)',
  'Total Units (this page)': 'মোট একক (এই পাতা)',
  'Retail Value (this page)': 'খুচরা মূল্য (এই পাতা)',
  'Stock Value (Cost, this page)': 'স্টকের মূল্য (ক্রয়মূল্যে, এই পাতা)',
  'Value @ Cost (this page)': 'মূল্য ক্রয়মূল্যে (এই পাতা)',
  'Value @ Retail (this page)': 'মূল্য খুচরা দামে (এই পাতা)',
  'Due and tag filter this page': 'বাকি ও ট্যাগ — শুধু এই পাতায়',
  'Amount filters this page': 'পরিমাণের ফিল্টার — শুধু এই পাতায়',
  'Price filters this page': 'দামের ফিল্টার — শুধু এই পাতায়',
  'Low or out of stock on this page': 'এই পাতায় কম স্টক বা স্টক নেই',

  // ---- short column headers ----
  'Disc ৳': 'ছাড় ৳',
  'Other ৳': 'অন্যান্য ৳',
  'Ship ৳': 'পরিবহন ৳',
  'Shipping ৳': 'পরিবহন ৳',
  '± Qty': '± পরিমাণ',
  Short: 'সংক্ষিপ্ত',
  Updated: 'হালনাগাদ',

  // ---- bulk price update controls ----
  'Increase ↑': 'বাড়ান ↑',
  'Decrease ↓': 'কমান ↓',
  'Set =': 'বসান =',

  // ---- misc badges / hints ----
  New: 'নতুন',
  'Negative ✓': 'স্টকের বেশি ✓',
  'Negative ✗': 'স্টকের বেশি ✗',
  'Close menu': 'মেনু বন্ধ করুন',
  'filter ·': 'ফিল্টার ·',
  'cancel ·': 'বাতিল ·',
  Tomorrow: 'আগামীকাল',
  Synced: 'সিঙ্ক হয়েছে',
  'Search products, invoices, customers…': 'পণ্য, ইনভয়েস, গ্রাহক খুঁজুন…',
  'F1 shortcuts · F2 search': 'F1 শর্টকাট · F2 খুঁজুন',
  Unicode: 'ইউনিকোড',
  Bluetooth: 'ব্লুটুথ',
  'Custom HTTP': 'কাস্টম HTTP',
  'AWS S3 / Compatible': 'AWS S3 / সমমানের',
});

// ---------------------------------------------------------------------------
// Pager nouns, backup & cloud saving, and the remaining list-page copy.
// Appended as a new block — this file is append-only so existing translations
// are never reordered or lost.
// ---------------------------------------------------------------------------
Object.assign(BN, {
  // ---- pager nouns ----
  // The pager renders "1–50 of 120 <noun>" and "No <noun>", so the noun is its
  // own text node and needs a lowercase key. Values match the capitalised nav
  // entries above so the same word is used everywhere.
  returns: 'ফেরত',
  transfers: 'স্থানান্তর',
  adjustments: 'সমন্বয়',
  shipments: 'ডেলিভারি',
  customers: 'গ্রাহক',
  suppliers: 'সরবরাহকারী',
  expenses: 'খরচ',
  products: 'পণ্য',

  // ---- detail-page loading / not-found states ----
  'Loading customer…': 'গ্রাহক লোড হচ্ছে…',
  'Customer not found.': 'গ্রাহক পাওয়া যায়নি।',
  'Loading supplier…': 'সরবরাহকারী লোড হচ্ছে…',
  'Supplier not found.': 'সরবরাহকারী পাওয়া যায়নি।',
  'Loading customer dues…': 'গ্রাহকের বাকি লোড হচ্ছে…',
  'counting customers…': 'গ্রাহক গণনা হচ্ছে…',
  'loading totals…': 'মোট হিসাব লোড হচ্ছে…',

  // ---- customer group report scope note ----
  'Sales figures cover the selected date range. Customer counts and outstanding due are lifetime balances across all branches.':
    'বিক্রয়ের হিসাব নির্বাচিত সময়ের। গ্রাহক সংখ্যা ও বাকি হলো সব শাখার সর্বকালীন হিসাব।',

  // ---- Backup & Cloud ----
  'Backup & Cloud': 'ব্যাকআপ ও ক্লাউড',
  'Save a copy, restore, export CSV': 'কপি রাখুন, ফিরিয়ে আনুন, CSV রপ্তানি করুন',
  'Keep a safe copy of your shop data': 'আপনার দোকানের তথ্যের নিরাপদ কপি রাখুন',
  'Back up now': 'এখনই ব্যাকআপ নিন',
  'Backup folder': 'ব্যাকআপ ফোল্ডার',
  'Cloud synced': 'ক্লাউডে সিঙ্ক হচ্ছে',
  'This computer only': 'শুধু এই কম্পিউটারে',
  'A full copy of your shop database is saved here. Choose a folder that your OneDrive, Google Drive or Dropbox app syncs, and the copy is kept online too.':
    'আপনার দোকানের পুরো তথ্যভান্ডারের একটি কপি এখানে জমা হয়। OneDrive, Google Drive বা Dropbox যে ফোল্ডারটি সিঙ্ক করে সেটি বেছে নিলে কপিটি অনলাইনেও থাকবে।',
  'Current folder': 'বর্তমান ফোল্ডার',
  'Change folder…': 'ফোল্ডার বদলান…',
  'Open folder': 'ফোল্ডার খুলুন',
  'This folder cannot be written to.': 'এই ফোল্ডারে লেখা যাচ্ছে না।',
  'Cloud folders found on this computer': 'এই কম্পিউটারে পাওয়া ক্লাউড ফোল্ডার',
  'This app never sends your data over the internet by itself. It writes the backup file to the folder you choose; if that folder belongs to a cloud app you already installed, that app uploads it. No account or password is needed here.':
    'এই অ্যাপ নিজে থেকে কখনোই আপনার তথ্য ইন্টারনেটে পাঠায় না। এটি শুধু আপনার বেছে নেওয়া ফোল্ডারে ব্যাকআপ ফাইলটি লেখে; সেই ফোল্ডার যদি আগে থেকে ইনস্টল করা কোনো ক্লাউড অ্যাপের হয়, তবে সেই অ্যাপই ফাইলটি আপলোড করে। এখানে কোনো অ্যাকাউন্ট বা পাসওয়ার্ড লাগে না।',

  'Automatic backup': 'স্বয়ংক্রিয় ব্যাকআপ',
  'Only when you press Back up now': 'শুধু আপনি “এখনই ব্যাকআপ নিন” চাপলে',
  'Once a day, after 2 AM': 'দিনে একবার, রাত ২টার পর',
  'Right after the Z-Report': 'জেড-রিপোর্টের সাথে সাথেই',
  "Recommended: On shift close. It captures the day's takings right after the Z-Report.":
    'প্রস্তাবিত: শিফট বন্ধের সময়। এতে জেড-রিপোর্টের সাথে সাথেই দিনের আদায় জমা হয়ে যায়।',
  'How many backups to keep': 'কতটি ব্যাকআপ রাখা হবে',
  'Older backups are deleted automatically once this many newer ones exist.':
    'এতগুলো নতুন ব্যাকআপ হয়ে গেলে পুরোনোগুলো নিজে থেকেই মুছে যায়।',
  'Last backup': 'শেষ ব্যাকআপ',
  'Current database': 'বর্তমান তথ্যভান্ডার',
  'The last backup did not finish': 'শেষ ব্যাকআপটি সম্পূর্ণ হয়নি',

  'Saved backups': 'সংরক্ষিত ব্যাকআপ',
  'Newest first. Each file is a complete copy, checked after it was written.':
    'নতুনগুলো আগে। প্রতিটি ফাইল পুরো কপি, লেখার পরেই যাচাই করা হয়েছে।',
  'No backups yet. Press the Back up now button.':
    'এখনো কোনো ব্যাকআপ নেই। “এখনই ব্যাকআপ নিন” বোতামটি চাপুন।',
  Restore: 'ফিরিয়ে আনুন',
  'Restore from another file': 'অন্য ফাইল থেকে ফিরিয়ে আনুন',
  'Choose backup file…': 'ব্যাকআপ ফাইল বেছে নিন…',
  'Restoring replaces everything in the shop with the contents of that backup. You will be asked to confirm, a copy of the current data is saved first, and the app restarts.':
    'ফিরিয়ে আনলে দোকানের সব তথ্য সেই ব্যাকআপের তথ্যে বদলে যাবে। আপনাকে নিশ্চিত করতে বলা হবে, বর্তমান তথ্যের একটি কপি আগে জমা রাখা হবে, এবং অ্যাপটি আবার চালু হবে।',

  'CSV files for your accountant, saved into an exports folder next to your backups.':
    'আপনার হিসাবরক্ষকের জন্য CSV ফাইল, ব্যাকআপের পাশেই exports ফোল্ডারে জমা হয়।',
  'Need everything in one file? Use Back up now — that captures the whole database.':
    'সব একসাথে এক ফাইলে দরকার? “এখনই ব্যাকআপ নিন” ব্যবহার করুন — সেটি পুরো তথ্যভান্ডার নেয়।',

  // ---- first-run wizard: backup step ----
  Backup: 'ব্যাকআপ',
  'Save backups to a cloud folder': 'ক্লাউড ফোল্ডারে ব্যাকআপ রাখুন',
  'If OneDrive, Google Drive or Dropbox is installed on this computer, backups are saved into that folder so a copy is kept online. No account or password is needed here — your cloud app does the uploading.':
    'এই কম্পিউটারে OneDrive, Google Drive বা Dropbox ইনস্টল থাকলে ব্যাকআপ সেই ফোল্ডারে জমা হবে, ফলে একটি কপি অনলাইনেও থাকবে। এখানে কোনো অ্যাকাউন্ট বা পাসওয়ার্ড লাগে না — আপলোড আপনার ক্লাউড অ্যাপই করে।',
  'Either way a backup is taken now, and then automatically. Without a cloud folder the copy is saved to your Documents folder on this computer. You can change this any time in Settings → Backup & Cloud.':
    'যেভাবেই হোক এখনই একটি ব্যাকআপ নেওয়া হবে, এরপর নিজে থেকেই হবে। ক্লাউড ফোল্ডার না থাকলে কপিটি এই কম্পিউটারের Documents ফোল্ডারে জমা হবে। সেটিংস → ব্যাকআপ ও ক্লাউড থেকে যেকোনো সময় বদলাতে পারেন।',
  'Setup needs the desktop app': 'সেটআপের জন্য ডেস্কটপ অ্যাপ দরকার',
  'Open Hardware Khata POS on the shop computer to create your shop.':
    'আপনার দোকান তৈরি করতে দোকানের কম্পিউটারে হার্ডওয়্যার খাতা POS খুলুন।',
  'No cloud folder found on this computer': 'এই কম্পিউটারে কোনো ক্লাউড ফোল্ডার পাওয়া যায়নি',
  'Backups are saved to your Documents folder. You can point them at OneDrive or Google Drive later in Settings → Backup.':
    'ব্যাকআপ আপনার Documents ফোল্ডারে জমা হবে। পরে সেটিংস → ব্যাকআপ থেকে OneDrive বা Google Drive-এ পাঠাতে পারবেন।',
  'Could not take the first backup': 'প্রথম ব্যাকআপ নেওয়া যায়নি',
  'Check Settings → Backup.': 'সেটিংস → ব্যাকআপ দেখুন।',

  // ---- backup toasts ----
  'Backup folder updated': 'ব্যাকআপ ফোল্ডার হালনাগাদ হয়েছে',
  'Failed to read backup settings': 'ব্যাকআপ সেটিংস পড়া যায়নি',
  'Failed to save backup settings': 'ব্যাকআপ সেটিংস সংরক্ষণ করা যায়নি',
  'Failed to set the backup folder': 'ব্যাকআপ ফোল্ডার সেট করা যায়নি',
  'Could not open the folder picker': 'ফোল্ডার নির্বাচক খোলা যায়নি',
  'Could not open the backup folder': 'ব্যাকআপ ফোল্ডার খোলা যায়নি',
  'Backup failed': 'ব্যাকআপ ব্যর্থ হয়েছে',
  'Restore failed': 'ফিরিয়ে আনা ব্যর্থ হয়েছে',
  'Export failed': 'রপ্তানি ব্যর্থ হয়েছে',
});

// ---------------------------------------------------------------------------
// Quick price/stock update popup + the product form layout fixes.
// ---------------------------------------------------------------------------
Object.assign(BN, {
  // ---- Update Price & Stock popup ----
  'Update Price & Stock': 'দাম ও স্টক হালনাগাদ',
  'Update price & stock': 'দাম ও স্টক হালনাগাদ',
  Update: 'হালনাগাদ',
  'Selling price': 'বিক্রয় মূল্য',
  'Current price': 'বর্তমান দাম',
  'New price': 'নতুন দাম',
  'Price goes up by': 'দাম বাড়ছে',
  'Price goes down by': 'দাম কমছে',
  'Cost price': 'ক্রয়মূল্য',
  'Profit per unit': 'প্রতি এককে লাভ',
  'This price is below your cost. You would lose money on every sale.':
    'এই দাম আপনার ক্রয়মূল্যের চেয়ে কম। প্রতিটি বিক্রয়ে আপনার লোকসান হবে।',
  'Stock in shop': 'দোকানে স্টক',
  'System count': 'সিস্টেমের হিসাব',
  'Counted quantity': 'গুনে পাওয়া পরিমাণ',
  'Will add': 'যোগ হবে',
  'Will remove': 'বাদ যাবে',
  'No change': 'কোনো পরিবর্তন নেই',
  'Type what you counted on the shelf. The difference is saved as a stock correction, so your history stays correct.':
    'তাকে গুনে যা পেয়েছেন সেটিই লিখুন। পার্থক্যটি স্টক সংশোধন হিসেবে জমা থাকবে, তাই আপনার হিসাব ঠিক থাকবে।',
  'Stock is not tracked for this product, so there is no quantity to update.':
    'এই পণ্যের স্টক হিসাব রাখা হয় না, তাই হালনাগাদ করার কোনো পরিমাণ নেই।',
  // NOTE: bare 'Updated' is already taken by the products table column header,
  // so the toast uses its own unambiguous phrase instead of overriding it.
  'Product updated': 'পণ্য হালনাগাদ হয়েছে',
  'Could not save the change': 'পরিবর্তনটি সংরক্ষণ করা যায়নি',

  // ---- product row actions ----
  // 'Open full page' is already translated above — not repeated here.
  'Edit all details': 'সব তথ্য সম্পাদনা',

  // ---- product form: stock section ----
  'In stock now': 'এখন স্টকে আছে',
  'Counted from stock movements — not typed here':
    'স্টক চলাচল থেকে হিসাব করা — এখানে লেখা হয় না',
  'Opening quantity for this product': 'এই পণ্যের শুরুর পরিমাণ',
  'How many you have right now': 'এখন আপনার কাছে কতটি আছে',
  'To change it, use Update Price & Stock on the Products or Stock screen. That records a stock correction, so your history stays right.':
    'বদলাতে চাইলে পণ্য বা স্টক পাতায় “দাম ও স্টক হালনাগাদ” ব্যবহার করুন। এতে একটি স্টক সংশোধন জমা হয়, তাই আপনার হিসাব ঠিক থাকে।',
});

// ---------------------------------------------------------------------------
// POS screen rework: product picker filters, cart action bar, per-line
// discount drawer, and persisted-cart revalidation messages.
// Keys already present above (Filters, Brand, Discount, Held carts,
// Clear cart, Suspend, Multi-Pay, Pay, …) are deliberately NOT repeated.
// ---------------------------------------------------------------------------
Object.assign(BN, {
  // ---- product picker ----
  'Show finished items': 'শেষ হয়ে যাওয়া পণ্যও দেখান',
  'Keeps products with no stock left in the list.':
    'স্টক শেষ হয়ে যাওয়া পণ্যগুলোও তালিকায় থাকবে।',
  'Allow selling without stock': 'স্টক ছাড়াই বিক্রয়ের অনুমতি',
  'Lets you sell items the system shows as finished.':
    'সিস্টেমে শেষ দেখানো পণ্যও বিক্রয় করতে দেয়।',
  'No stock': 'স্টক নেই',
  'Showing the first 200 products only.': 'শুধু প্রথম ২০০টি পণ্য দেখানো হচ্ছে।',
  'products match right now.': 'টি পণ্য এখন মিলছে।',
  'Keep typing to narrow the search.': 'খোঁজ ছোট করতে আরও লিখুন।',

  // ---- cart action bar ----
  'Discounts & charges': 'ছাড় ও চার্জ',
  Applied: 'প্রয়োগ করা হয়েছে',
  'Swap panel side': 'পাশ বদল করুন',
  Markup: 'বাড়তি দাম',
  'Suspend (F9)': 'স্থগিত (F9)',
  'Multi-Pay — split across methods': 'একাধিক পেমেন্ট — ভাগ করে পরিশোধ',
  'Markup and discount': 'বাড়তি দাম ও ছাড়',
  'Pay (F8)': 'পরিশোধ (F8)',

  // ---- persisted cart restore ----
  'Opening the counter…': 'কাউন্টার খোলা হচ্ছে…',
  'A price changed since this cart was saved':
    'এই কার্ট সংরক্ষণের পর একটি দাম বদলেছে',
  'Some prices changed since this cart was saved':
    'এই কার্ট সংরক্ষণের পর কিছু দাম বদলেছে',
  'The cart now uses the current prices. Please check before taking payment.':
    'কার্টে এখন বর্তমান দাম বসানো হয়েছে। টাকা নেওয়ার আগে একবার দেখে নিন।',
  'Some items are no longer in the catalogue': 'কিছু পণ্য আর পণ্যতালিকায় নেই',
});

// ---------------------------------------------------------------------------
// Login / lock screen: account chooser states and explicit submit buttons.
// ('Sign in' is already translated above and is not repeated.)
// ---------------------------------------------------------------------------
Object.assign(BN, {
  'Loading accounts…': 'অ্যাকাউন্ট লোড হচ্ছে…',
  'No accounts found on this computer': 'এই কম্পিউটারে কোনো অ্যাকাউন্ট পাওয়া যায়নি',
  'If you set a password for your account, sign in with that. Otherwise restore a backup from Settings on a working copy.':
    'আপনার অ্যাকাউন্টে পাসওয়ার্ড দেওয়া থাকলে সেটি দিয়ে সাইন ইন করুন। না থাকলে চালু আছে এমন কপির সেটিংস থেকে ব্যাকআপ ফিরিয়ে আনুন।',
  'Use password instead': 'বদলে পাসওয়ার্ড ব্যবহার করুন',
  'Signing in…': 'সাইন ইন হচ্ছে…',
  'Enter your 4 to 6 digit PIN, then press Sign in.':
    'আপনার ৪ থেকে ৬ সংখ্যার পিন দিন, তারপর “সাইন ইন” চাপুন।',
  Unlock: 'আনলক করুন',
  'Unlocking…': 'আনলক হচ্ছে…',
  'Enter your 4 to 6 digit PIN · or sign out to switch user':
    'আপনার ৪ থেকে ৬ সংখ্যার পিন দিন · অথবা ব্যবহারকারী বদলাতে সাইন আউট করুন',
});

// ---------------------------------------------------------------------------
// Receipt template: the new date/branch and cashier controls, plus the
// clarified paper + footer help text.
// ---------------------------------------------------------------------------
Object.assign(BN, {
  'Served by': 'বিক্রয় করেছেন',
  'Preview size': 'প্রিভিউয়ের আকার',
  'Date and branch line at the top': 'উপরে তারিখ ও শাখার লাইন',
  'Served by (cashier name)': 'বিক্রয় করেছেন (ক্যাশিয়ারের নাম)',
  'This only changes the preview here. The width used when printing comes from your printer in Settings → Printers.':
    'এটি শুধু এখানের প্রিভিউ বদলায়। ছাপার সময় যে প্রস্থ ব্যবহার হয় তা সেটিংস → প্রিন্টার থেকে আসে।',
  'Leave this empty to print no footer at all.':
    'ফুটার একেবারেই ছাপতে না চাইলে এটি খালি রাখুন।',
});

// ---------------------------------------------------------------------------
// Purchase-price (buying price) history: the split Buying / Selling boxes in
// Update Price & Stock, the history popup, and the new product-list columns.
// ('Cost', 'Cost price', 'History', 'Close', 'Current price' already exist.)
// ---------------------------------------------------------------------------
Object.assign(BN, {
  // ---- buying price box ----
  'Buying price': 'ক্রয় মূল্য',
  'What you pay the supplier': 'সরবরাহকারীকে যা দেন',
  'Current buying price': 'বর্তমান ক্রয় মূল্য',
  'New buying price': 'নতুন ক্রয় মূল্য',
  'Set on': 'নির্ধারিত হয়েছে',
  'Buying price goes up by': 'ক্রয় মূল্য বাড়ছে',
  'Buying price goes down by': 'ক্রয় মূল্য কমছে',
  'Average buying price': 'গড় ক্রয় মূল্য',
  'Saving updates the average buying price.': 'সংরক্ষণ করলে গড় ক্রয় মূল্য হালনাগাদ হবে।',

  // ---- selling price box ----
  'What the customer pays': 'ক্রেতা যা দেন',
  'Current selling price': 'বর্তমান বিক্রয় মূল্য',
  'New selling price': 'নতুন বিক্রয় মূল্য',
  'This price is below your buying price. You would lose money on every sale.':
    'এই দাম আপনার ক্রয় মূল্যের চেয়ে কম। প্রতিটি বিক্রয়ে আপনার লোকসান হবে।',

  // ---- history popup ----
  'Buying price history': 'ক্রয় মূল্যের ইতিহাস',
  'Price history': 'দামের ইতিহাস',
  'Loading price history…': 'দামের ইতিহাস লোড হচ্ছে…',
  'No price changes recorded yet.': 'এখনো কোনো দাম পরিবর্তনের রেকর্ড নেই।',
  'Opening price': 'শুরুর দাম',
  Changed: 'পরিবর্তিত',

  // ---- product list columns ----
  'Buying Price': 'ক্রয় মূল্য',
  'Avg. Buying Price': 'গড় ক্রয় মূল্য',

  // ---- backend messages ----
  'Buying price must be zero or more': 'ক্রয় মূল্য শূন্য বা তার বেশি হতে হবে',
  'Opening buying price': 'শুরুর ক্রয় মূল্য',
});

// ---------------------------------------------------------------------------
// Invoice → PDF: the Save as PDF button, the PDF location setting, and the
// in-app archive list. ('Refresh', 'Saving…', 'Change folder…', 'Open folder'
// already exist and are not repeated.)
// ---------------------------------------------------------------------------
Object.assign(BN, {
  // ---- receipt popup ----
  'Save as PDF': 'পিডিএফ হিসেবে সংরক্ষণ',
  'Invoice saved as PDF': 'ইনভয়েস পিডিএফ হিসেবে সংরক্ষিত হয়েছে',
  'Could not save the PDF': 'পিডিএফ সংরক্ষণ করা যায়নি',
  'Some backup copies could not be written': 'কিছু ব্যাকআপ কপি লেখা যায়নি',
  'The PDF came out empty. Keep the receipt open and try again.':
    'পিডিএফ খালি এসেছে। রসিদটি খোলা রেখে আবার চেষ্টা করুন।',
  'No folder is set to save PDFs into.': 'পিডিএফ সংরক্ষণের জন্য কোনো ফোল্ডার নির্ধারিত নেই।',

  // ---- settings: PDF location ----
  'Invoice PDF location': 'ইনভয়েস পিডিএফের স্থান',
  'Where Save as PDF puts your copy of an invoice.':
    '“পিডিএফ হিসেবে সংরক্ষণ” চাপলে ইনভয়েসের কপি যেখানে যাবে।',
  'Current PDF folder': 'বর্তমান পিডিএফ ফোল্ডার',
  'PDF folder updated': 'পিডিএফ ফোল্ডার হালনাগাদ হয়েছে',
  'Failed to set the PDF folder': 'পিডিএফ ফোল্ডার সেট করা যায়নি',
  'Could not open the PDF folder': 'পিডিএফ ফোল্ডার খোলা যায়নি',
  'Could not open the PDF': 'পিডিএফ খোলা যায়নি',
  'Every invoice PDF is saved three times: here, next to your database, and in your backup folder. So an invoice is protected exactly like your shop data, and if your backup folder is cloud synced the invoice goes online with it.':
    'প্রতিটি ইনভয়েস পিডিএফ তিন জায়গায় জমা হয়: এখানে, আপনার তথ্যভান্ডারের পাশে, এবং ব্যাকআপ ফোল্ডারে। ফলে ইনভয়েস আপনার দোকানের তথ্যের মতোই সুরক্ষিত থাকে, আর ব্যাকআপ ফোল্ডার ক্লাউডে সিঙ্ক হলে ইনভয়েসও অনলাইনে চলে যায়।',

  // ---- archive list ----
  'Saved invoice PDFs': 'সংরক্ষিত ইনভয়েস পিডিএফ',
  'No invoice PDFs saved yet. Use Save as PDF on a receipt.':
    'এখনো কোনো ইনভয়েস পিডিএফ সংরক্ষিত হয়নি। রসিদে “পিডিএফ হিসেবে সংরক্ষণ” ব্যবহার করুন।',
  Open: 'খুলুন',
});

// ---------------------------------------------------------------------------
// APPEND-ONLY BLOCK — do not reorder or delete anything above.
//
// This pass covers:
//   · the buy / average-buy / sell strip on every POS cart line
//   · correcting a finalized invoice (Admin only)
//   · retiring a product that has already been traded (archive, not delete)
//   · the pendrive backup
//   · the in-app dialogs that replaced window.confirm / prompt / alert
//
// Keys already present elsewhere in this file are deliberately NOT repeated
// (Reason, OK, Cancel, Save, Delete, Never, Confirm, 'Buying price',
// 'Selling price', 'Void sale', 'Delete this brand?', …).
// ---------------------------------------------------------------------------
Object.assign(BN, {
  // ---- POS cart line: what it cost us vs what we sell it for ----
  'Avg. buying price': 'গড় ক্রয় মূল্য',

  // ---- in-app dialogs (replacing the native browser ones) ----
  'Keep it': 'রেখে দিন',
  'This cannot be undone.': 'এটি আর ফেরানো যাবে না।',
  'Update prices': 'দাম হালনাগাদ করুন',
  'Save anyway?': 'তবুও সংরক্ষণ করবেন?',
  'Cancel transfer': 'স্থানান্তর বাতিল করুন',
  'Cancel purchase': 'ক্রয় বাতিল করুন',
  'Cancelling reverses the stock it brought in and the cash it paid out.':
    'বাতিল করলে যে স্টক এসেছিল তা ফিরে যাবে এবং যে টাকা দেওয়া হয়েছিল তা ফেরত আসবে।',
  'Voiding returns the items to stock and reverses any cash taken.':
    'বাতিল করলে পণ্য স্টকে ফিরে যাবে এবং নেওয়া টাকা ফেরত হবে।',
  'Products in this group will revert to Retail.':
    'এই গ্রুপের পণ্যগুলো খুচরা দামে ফিরে যাবে।',
  'e.g. customer cancelled': 'যেমন: গ্রাহক বাতিল করেছেন',
  'e.g. wrong supplier': 'যেমন: ভুল সরবরাহকারী',
  'e.g. wrong quantity keyed at the counter': 'যেমন: কাউন্টারে ভুল পরিমাণ লেখা হয়েছে',

  // ---- returns ----
  'Pick the original sale, then click “Create Return”.':
    'আগের বিক্রয়টি বেছে নিন, তারপর “ফেরত তৈরি করুন” চাপুন।',

  // ---- correcting a finalized invoice ----
  'Save Correction': 'সংশোধন সংরক্ষণ',
  'Save correction': 'সংশোধন সংরক্ষণ করুন',
  'Only an admin can edit a sale': 'শুধু অ্যাডমিন বিক্রয় সম্পাদনা করতে পারেন',
  'Only an admin can edit a sale. Ask the owner to sign in.':
    'শুধু অ্যাডমিন বিক্রয় সম্পাদনা করতে পারেন। মালিককে সাইন ইন করতে বলুন।',
  'Ask the owner to sign in. This is deliberate: an edit rewrites money that has already been taken.':
    'মালিককে সাইন ইন করতে বলুন। এটি ইচ্ছাকৃত: সম্পাদনা করলে ইতিমধ্যে নেওয়া টাকার হিসাব বদলে যায়।',
  'This reverses the original stock and cash and re-applies the corrected amounts. The invoice number stays the same.':
    'এতে আগের স্টক ও টাকা ফিরিয়ে নিয়ে সংশোধিত হিসাব বসানো হবে। ইনভয়েস নম্বর একই থাকবে।',
  'Recorded against the invoice so the change is traceable.':
    'পরিবর্তনটি যাতে পরে খুঁজে পাওয়া যায়, তাই ইনভয়েসের সঙ্গে লিখে রাখা হয়।',
  'A saved purchase cannot be edited in place': 'সংরক্ষিত ক্রয় সরাসরি সম্পাদনা করা যায় না',
  'It may have already affected stock and cash. Cancel it from the purchase detail, then add a new purchase.':
    'এটি হয়তো স্টক ও নগদে প্রভাব ফেলেছে। ক্রয়ের বিবরণ থেকে বাতিল করুন, তারপর নতুন ক্রয় যোগ করুন।',

  // ---- retiring a product ----
  Archive: 'সংরক্ষণাগারে রাখুন',
  'Product archived': 'পণ্য সংরক্ষণাগারে রাখা হয়েছে',
  'Archive failed': 'সংরক্ষণাগারে রাখা যায়নি',
  'The product is removed from the catalogue. Sales history is never affected.':
    'পণ্যটি তালিকা থেকে সরে যাবে। বিক্রয়ের পুরোনো হিসাব কখনো বদলাবে না।',
  'Only an admin can delete a product': 'শুধু অ্যাডমিন পণ্য মুছতে পারেন',
  'Only an admin can remove products from the catalogue':
    'শুধু অ্যাডমিন তালিকা থেকে পণ্য সরাতে পারেন',
  'Only a manager or admin can retire a product':
    'শুধু ম্যানেজার বা অ্যাডমিন পণ্য বাতিল করতে পারেন',
  'Ask the owner to sign in, or mark the product “not for sale”.':
    'মালিককে সাইন ইন করতে বলুন, অথবা পণ্যটিকে “বিক্রয়ের জন্য নয়” হিসেবে চিহ্নিত করুন।',
  'Could not check what these products are used for':
    'এই পণ্যগুলো কোথায় ব্যবহৃত হয়েছে তা যাচাই করা যায়নি',
  'Could not check what this product is used for':
    'এই পণ্যটি কোথায় ব্যবহৃত হয়েছে তা যাচাই করা যায়নি',

  // ---- pendrive backup ----
  'Backup to Pendrive': 'পেনড্রাইভে ব্যাকআপ',
  'Saving to Pendrive…': 'পেনড্রাইভে সংরক্ষণ হচ্ছে…',
  'Which pendrive?': 'কোন পেনড্রাইভে?',
  'More than one removable drive is connected.': 'একাধিক অপসারণযোগ্য ড্রাইভ লাগানো আছে।',
  'You can unplug the pendrive now.': 'এখন পেনড্রাইভটি খুলে নিতে পারেন।',
  'No pendrive backup taken yet': 'এখনো পেনড্রাইভে কোনো ব্যাকআপ নেওয়া হয়নি',
  'Copy to a pendrive': 'পেনড্রাইভে কপি করুন',
  'Last pendrive backup': 'সর্বশেষ পেনড্রাইভ ব্যাকআপ',
  'Plug in a pendrive and press the button. The copy is checked before it counts as done, so you know it will open again. Take it home — that is the copy that survives a stolen or dead computer.':
    'একটি পেনড্রাইভ লাগিয়ে বোতামটি চাপুন। কপিটি সম্পন্ন গণ্য হওয়ার আগে যাচাই করা হয়, তাই আপনি নিশ্চিত থাকতে পারেন এটি আবার খুলবে। এটি বাড়িতে নিয়ে যান — কম্পিউটার চুরি হলে বা নষ্ট হলে এই কপিটিই টিকে থাকে।',
  'Could not check for a pendrive': 'পেনড্রাইভ খুঁজে দেখা যায়নি',
  'Pendrive backup failed': 'পেনড্রাইভ ব্যাকআপ ব্যর্থ হয়েছে',
  'No pendrive found. Plug one into a USB port, wait for Windows to recognise it, then try again.':
    'কোনো পেনড্রাইভ পাওয়া যায়নি। ইউএসবি পোর্টে একটি লাগান, উইন্ডোজ চিনে নেওয়া পর্যন্ত অপেক্ষা করুন, তারপর আবার চেষ্টা করুন।',
  'More than one drive is connected — choose which one.':
    'একাধিক ড্রাইভ লাগানো আছে — কোনটি তা বেছে নিন।',
  'That drive is no longer connected.': 'ওই ড্রাইভটি আর লাগানো নেই।',
});

// ---------------------------------------------------------------------------
// APPEND-ONLY BLOCK — Settings → Updates and Settings → Performance.
// ('Loading…', 'Never', 'Cancel' and friends already exist above.)
// ---------------------------------------------------------------------------
Object.assign(BN, {
  // ---- settings tiles ----
  Updates: 'হালনাগাদ',
  'Get the newest version of this app': 'এই অ্যাপের নতুন সংস্করণ নিন',
  Performance: 'কর্মক্ষমতা',
  'Settings for an older or slower computer': 'পুরোনো বা ধীর কম্পিউটারের জন্য সেটিংস',

  // ---- updates screen ----
  'Get the newest version without copying files between computers':
    'এক কম্পিউটার থেকে আরেক কম্পিউটারে ফাইল কপি না করেই নতুন সংস্করণ নিন',
  'Check for updates': 'হালনাগাদ খুঁজুন',
  'This app': 'এই অ্যাপ',
  'Up to date': 'সর্বশেষ সংস্করণ',
  'Update available': 'নতুন সংস্করণ এসেছে',
  'Ready to install': 'ইনস্টলের জন্য প্রস্তুত',
  'Not checked yet': 'এখনো দেখা হয়নি',
  'Updates only work in the installed app, not while running from source.':
    'হালনাগাদ কেবল ইনস্টল করা অ্যাপে কাজ করে, সোর্স থেকে চালালে নয়।',
  'Download update': 'হালনাগাদ ডাউনলোড করুন',
  'Restart and install': 'বন্ধ করে ইনস্টল করুন',
  'The app will close, install, and open again. Finish any sale on screen first.':
    'অ্যাপটি বন্ধ হবে, ইনস্টল হবে, তারপর আবার খুলবে। পর্দায় কোনো বিক্রয় থাকলে আগে শেষ করুন।',
  'Could not check for updates': 'হালনাগাদ খোঁজা যায়নি',
  'This is usually just the internet being down. You can also download the installer by hand.':
    'সাধারণত ইন্টারনেট বন্ধ থাকলেই এটি হয়। চাইলে ইনস্টলারটি নিজে ডাউনলোড করতে পারেন।',
  'Open downloads page': 'ডাউনলোড পাতা খুলুন',
  'Check automatically': 'নিজে থেকে খুঁজবে',
  'Looks for a new version a few seconds after the app opens. Nothing is ever downloaded or installed without you pressing the button.':
    'অ্যাপ খোলার কয়েক সেকেন্ড পর নতুন সংস্করণ আছে কিনা দেখে। আপনি বোতাম না চাপলে কিছুই ডাউনলোড বা ইনস্টল হয় না।',
  'This is the only thing in the app that uses the internet. It asks GitHub whether a newer version exists and sends nothing about your shop — no sales, no customers, no names. Turn it off and the app never connects to anything.':
    'অ্যাপের ভেতরে কেবল এই কাজটিই ইন্টারনেট ব্যবহার করে। এটি গিটহাবকে জিজ্ঞেস করে নতুন সংস্করণ আছে কিনা, আর আপনার দোকানের কোনো তথ্য পাঠায় না — বিক্রয় নয়, গ্রাহক নয়, নাম নয়। বন্ধ করে দিলে অ্যাপ কোথাও সংযোগ করে না।',
  'You are on the latest version': 'আপনি সর্বশেষ সংস্করণেই আছেন',
  'Download failed': 'ডাউনলোড ব্যর্থ হয়েছে',
  'Could not start the installer': 'ইনস্টলার চালু করা যায়নি',
  'Automatic update checks on': 'স্বয়ংক্রিয় হালনাগাদ খোঁজা চালু',
  'Automatic update checks off': 'স্বয়ংক্রিয় হালনাগাদ খোঁজা বন্ধ',
  'Could not save the setting': 'সেটিংটি সংরক্ষণ করা যায়নি',
  'Could not open the downloads page': 'ডাউনলোড পাতা খোলা যায়নি',

  // ---- performance screen ----
  'Turn off graphics acceleration': 'গ্রাফিক্স অ্যাক্সিলারেশন বন্ধ করুন',
  'Draws the screen using the processor instead of the graphics chip. On an older PC with old graphics drivers this is often smoother and more stable. Needs a restart.':
    'গ্রাফিক্স চিপের বদলে প্রসেসর দিয়ে পর্দা আঁকে। পুরোনো গ্রাফিক্স ড্রাইভারের পুরোনো পিসিতে এটি প্রায়ই বেশি মসৃণ ও স্থির হয়। আবার চালু করা লাগবে।',
  'Reduce animations': 'অ্যানিমেশন কমান',
  'Removes the fade and slide effects when menus and popups open. Less work for a slow machine on every click. Takes effect straight away.':
    'মেনু ও পপআপ খোলার সময়ের ফেড ও স্লাইড প্রভাব সরিয়ে দেয়। ধীর মেশিনে প্রতিটি ক্লিকে কম কাজ পড়ে। সঙ্গে সঙ্গে কাজ করে।',
  'Close the app and open it again to apply the graphics setting.':
    'গ্রাফিক্স সেটিংটি কাজ করাতে অ্যাপটি বন্ধ করে আবার খুলুন।',
  'Close and open the app for this to take effect':
    'এটি কার্যকর করতে অ্যাপটি বন্ধ করে আবার খুলুন',
  'Animations reduced': 'অ্যানিমেশন কমানো হয়েছে',
  'Animations restored': 'অ্যানিমেশন ফিরিয়ে আনা হয়েছে',
  'These two settings are stored per computer, not in your shop data, so the fast PC and the slow PC can be set differently.':
    'এই দুটি সেটিং প্রতিটি কম্পিউটারে আলাদাভাবে জমা থাকে, আপনার দোকানের তথ্যে নয় — তাই দ্রুত পিসি আর ধীর পিসিতে আলাদা রাখা যায়।',
  'If the slow PC still struggles, the next biggest win is closing other programs — a browser with many tabs open will take memory this app needs.':
    'ধীর পিসিতে এখনো সমস্যা হলে সবচেয়ে বড় উপকার হবে অন্য প্রোগ্রাম বন্ধ করা — অনেক ট্যাব খোলা ব্রাউজার এই অ্যাপের দরকারি মেমোরি নিয়ে নেয়।',
});

// ---------------------------------------------------------------------------
// APPEND-ONLY BLOCK — the titlebar "More & Settings" gear menu, and the honest
// "nothing published yet" state on the Updates screen.
// ---------------------------------------------------------------------------
Object.assign(BN, {
  // ---- gear menu tiles ----
  'More & Settings': 'আরও ও সেটিংস',
  'Sales, stock, profit and tax': 'বিক্রয়, স্টক, লাভ ও কর',
  'What the shop has spent': 'দোকানের খরচ',
  'Group your spending': 'খরচ ভাগ করে রাখুন',
  'Bring in lists from Excel': 'এক্সেল থেকে তালিকা আনুন',
  'Shop, users, printers, backup': 'দোকান, ব্যবহারকারী, প্রিন্টার, ব্যাকআপ',

  // ---- updates: reached the server, nothing newer ----
  'No update has been published yet': 'এখনো কোনো হালনাগাদ প্রকাশ করা হয়নি',
  'Your app reached the update server and it has nothing newer to offer. This is normal right after a fresh install — you already have the newest build.':
    'আপনার অ্যাপ হালনাগাদ সার্ভারে পৌঁছেছে, কিন্তু নতুন কিছু নেই। নতুন ইনস্টলের পরপর এটি স্বাভাবিক — আপনার কাছে সর্বশেষ সংস্করণই আছে।',
  'The computer could not reach the internet. Try again once it is back.':
    'কম্পিউটারটি ইন্টারনেটে পৌঁছাতে পারেনি। সংযোগ ফিরে এলে আবার চেষ্টা করুন।',
  'You can also download the installer by hand.':
    'চাইলে ইনস্টলারটি নিজে ডাউনলোড করতে পারেন।',
});

// ---------------------------------------------------------------------------
// APPEND-ONLY BLOCK — product photo / shop logo now stored with the shop data
// instead of as a window-scoped `blob:` handle that died on restart.
// ---------------------------------------------------------------------------
Object.assign(BN, {
  'Saving picture…': 'ছবি সংরক্ষণ হচ্ছে…',
  'PNG or JPG · saved with your data': 'পিএনজি বা জেপিজি · আপনার তথ্যের সঙ্গে জমা থাকে',
  'Could not use that picture': 'ছবিটি ব্যবহার করা যায়নি',
  'Please choose a picture file (PNG or JPG).':
    'একটি ছবির ফাইল বেছে নিন (পিএনজি বা জেপিজি)।',
  'That file could not be read as a picture.': 'ফাইলটি ছবি হিসেবে পড়া যায়নি।',
  'That picture appears to be empty.': 'ছবিটি খালি বলে মনে হচ্ছে।',
  'This computer could not process the picture.': 'এই কম্পিউটার ছবিটি প্রস্তুত করতে পারেনি।',
});

// ---------------------------------------------------------------------------
// APPEND-ONLY BLOCK — inline create (category / brand / product / customer),
// full-width purchase & sale forms, working print buttons, hidden voided rows,
// the editable POS selling price, and the dashboard's fixed shortcut grid +
// dues panel.
//
// Every key here is the COMPLETE rendered text of one element, because the
// translation layer swaps whole text nodes (see lib/bn/translate.ts).
// ---------------------------------------------------------------------------
Object.assign(BN, {
  // --- inline category / brand creation, from the product form
  'Add new category': 'নতুন ক্যাটাগরি যোগ করুন',
  'Add new brand': 'নতুন ব্র্যান্ড যোগ করুন',
  'Add New Category': 'নতুন ক্যাটাগরি',
  'Add New Brand': 'নতুন ব্র্যান্ড',
  'Created and selected for this product': 'তৈরি হয়ে এই পণ্যের জন্য নির্বাচিত হবে',
  'Category name': 'ক্যাটাগরির নাম',
  'Brand name': 'ব্র্যান্ডের নাম',
  'Optional — one emoji, shown in lists': 'ঐচ্ছিক — একটি ইমোজি, তালিকায় দেখাবে',
  'This is the same category list as Catalogue → Categories. Adding it here saves it for good.':
    'এটি ক্যাটালগ → ক্যাটাগরি-র একই তালিকা। এখানে যোগ করলে স্থায়ীভাবে জমা থাকে।',
  'This is the same brand list as Catalogue → Brands. Adding it here saves it for good.':
    'এটি ক্যাটালগ → ব্র্যান্ড-এর একই তালিকা। এখানে যোগ করলে স্থায়ীভাবে জমা থাকে।',

  // --- inline product creation, from a purchase or a sale
  'Add new product': 'নতুন পণ্য যোগ করুন',
  'Add New Product': 'নতুন পণ্য',
  'Save & Add': 'সংরক্ষণ ও যোগ',
  'Saved to your catalogue and added to this purchase. Stock arrives on the purchase line.':
    'আপনার ক্যাটালগে জমা হয়ে এই ক্রয়ে যোগ হবে। স্টক ক্রয়ের লাইন থেকেই আসবে।',
  'Saved to your catalogue and added to this sale.':
    'আপনার ক্যাটালগে জমা হয়ে এই বিক্রয়ে যোগ হবে।',
  'Comes in on this purchase — not typed here': 'এই ক্রয়েই আসছে — এখানে লেখার দরকার নেই',
  'Could not save the product': 'পণ্যটি সংরক্ষণ করা যায়নি',

  // --- purchase / sale form layout
  // ('Sell Price' and 'Line Total' are already translated in an earlier block.)
  'Net Cost': 'নিট দাম',
  'Remove line': 'লাইন মুছুন',

  // --- printing an existing invoice / purchase
  'Print invoice': 'চালান প্রিন্ট করুন',
  'Print goods received note': 'মাল প্রাপ্তির রসিদ প্রিন্ট করুন',
  'The original invoice, reprinted. Nothing about it changes.':
    'মূল চালানটিই আবার প্রিন্ট হচ্ছে। এতে কিছুই বদলায় না।',
  "File this against the supplier's own invoice.":
    'সরবরাহকারীর নিজের চালানের সঙ্গে এটি রাখুন।',
  // ('Goods Received Note' is already translated in an earlier block.)
  'Balance owed': 'বাকি পরিমাণ',
  'Received by': 'গ্রহণ করেছেন',
  'Supplier / driver': 'সরবরাহকারী / চালক',
  'Export all': 'সব রপ্তানি করুন',

  // --- hiding cancelled / voided documents
  'Show voided': 'বাতিলকৃত দেখান',
  'Voided shown': 'বাতিলকৃত দেখানো হচ্ছে',
  'Voided only': 'শুধু বাতিলকৃত',
  'Show cancelled': 'বাতিলকৃত দেখান',
  'Cancelled shown': 'বাতিলকৃত দেখানো হচ্ছে',

  // --- contacting a customer / supplier about an unpaid document
  'Copy number': 'নম্বর কপি করুন',
  Copied: 'কপি হয়েছে',
  'No phone on file': 'ফোন নম্বর নেই',
  'Could not copy the number': 'নম্বর কপি করা যায়নি',

  // --- POS: the selling price can be changed for one sale only
  "Price changed for this sale only — the product's price is unchanged.":
    'শুধু এই বিক্রয়ের জন্য দাম বদলানো হয়েছে — পণ্যের দাম বদলায়নি।',
  Undo: 'ফিরিয়ে নিন',

  // --- dashboard: fixed shortcut grid
  'Sell at the counter': 'কাউন্টারে বিক্রি',
  'Form-based invoice': 'ফর্মে চালান',
  'Goods received': 'মাল গ্রহণ',
  Breakdown: 'বিস্তারিত',
  'Add to catalogue': 'ক্যাটালগে যোগ',
  // ('Walk-in or contractor' is already translated in an earlier block.)
  'Rent, salary, transport': 'ভাড়া, বেতন, পরিবহন',
  'A copy you can take home': 'বাড়িতে নেওয়ার মতো একটি কপি',

  // --- dashboard: who owes us / who we owe
  'Customers who owe us': 'যাদের কাছে টাকা পাওনা',
  'Suppliers we owe': 'যাদের টাকা দিতে হবে',
  'Nobody owes you anything right now.': 'এখন কারও কাছে টাকা পাওনা নেই।',
  'You are square with every supplier.': 'কোনো সরবরাহকারীর টাকা বাকি নেই।',
  Collect: 'আদায় করুন',

  // --- dashboard: custom date range
  'Custom range': 'নিজের সময়সীমা',
  'The end date is before the start date.': 'শেষ তারিখ শুরুর তারিখের আগে পড়েছে।',
});

// ---------------------------------------------------------------------------
// APPEND-ONLY BLOCK — calendar/clock pickers on every date box, the buy/avg/sell
// reference prices on the sale and purchase forms, and the payment dialogs that
// now show what will still be owing after the payment.
// ---------------------------------------------------------------------------
Object.assign(BN, {
  // --- date & time pickers
  'Pick from a calendar': 'ক্যালেন্ডার থেকে বাছুন',
  'Set to right now': 'এখনকার সময় বসান',
  'Set to today': 'আজকের তারিখ বসান',

  // --- buy / average buy / sell reference prices
  Buy: 'ক্রয়',
  Avg: 'গড়',
  Sell: 'বিক্রয়',
  'Buy price': 'ক্রয় মূল্য',
  'Avg buy': 'গড় ক্রয়',

  // --- taking a payment against a due or partial document
  'Paid on': 'পরিশোধের তারিখ',
  'Already paid': 'ইতিমধ্যে পরিশোধিত',
  'This payment': 'এই পরিশোধ',
  'Still owing after this': 'এরপরও বাকি থাকবে',
  // ('Full due' is already translated in an earlier block.)
  Half: 'অর্ধেক',
});
