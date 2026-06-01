import type { DB } from '../db/connection.ts';
import { tx } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { recordMovement, stockOnHand } from './stock.ts';
import { logActivity } from './activity.ts';

/**
 * Catalog CRUD: products, categories, brands. Keeps the FTS index in sync and
 * records an opening-stock movement when a product is created with initial stock.
 */

export interface ProductInput {
  id?: string;
  sku: string;
  barcode?: string;
  name: string;
  categoryId?: string;
  brandId?: string;
  unit?: string;
  cost?: number;
  price?: number;
  wholesalePrice?: number;
  contractorPrice?: number;
  reorderLevel?: number;
  taxPct?: number;
  warrantyId?: string | null;
  imageUrl?: string;
  description?: string;
  manageStock?: boolean;
  allowNegativeSale?: boolean;
  allowDiscount?: boolean;
  showInPOS?: boolean;
  notForSale?: boolean;
  // creation-only: seed opening stock at a branch
  openingStock?: number;
  branchId?: string;
  userId?: string;
}

function syncProductFts(db: DB, productId: string) {
  db.prepare('DELETE FROM fts_products WHERE product_id = ?').run(productId);
  const p = db.prepare('SELECT name, sku, barcode FROM products WHERE id = ?').get(productId) as
    | { name: string; sku: string; barcode: string | null }
    | undefined;
  if (p) {
    db.prepare('INSERT INTO fts_products (product_id, name, sku, barcode) VALUES (?,?,?,?)').run(
      productId,
      p.name,
      p.sku,
      p.barcode ?? '',
    );
  }
}

export function createProduct(db: DB, input: ProductInput) {
  return tx(db, () => {
    const id = input.id ?? newId('p');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO products (id, sku, barcode, name, category_id, brand_id, unit, cost, price,
         wholesale_price, contractor_price, reorder_level, tax_pct, warranty_id, image_url, description,
         manage_stock, allow_negative_sale, allow_discount, show_in_pos, not_for_sale, created_at, updated_at)
       VALUES (@id, @sku, @barcode, @name, @categoryId, @brandId, @unit, @cost, @price,
         @wholesale, @contractor, @reorder, @tax, @warrantyId, @imageUrl, @description,
         @manageStock, @allowNeg, @allowDisc, @showInPos, @notForSale, @now, @now)`,
    ).run({
      id,
      sku: input.sku,
      barcode: input.barcode ?? null,
      name: input.name,
      categoryId: input.categoryId ?? null,
      brandId: input.brandId ?? null,
      unit: input.unit ?? 'pc',
      cost: input.cost ?? 0,
      price: input.price ?? 0,
      wholesale: input.wholesalePrice ?? null,
      contractor: input.contractorPrice ?? null,
      reorder: input.reorderLevel ?? 0,
      tax: input.taxPct ?? 0,
      warrantyId: input.warrantyId ?? null,
      imageUrl: input.imageUrl ?? null,
      description: input.description ?? null,
      manageStock: input.manageStock === false ? 0 : 1,
      allowNeg: input.allowNegativeSale ? 1 : 0,
      allowDisc: input.allowDiscount === false ? 0 : 1,
      showInPos: input.showInPOS === false ? 0 : 1,
      notForSale: input.notForSale ? 1 : 0,
      now,
    });
    syncProductFts(db, id);

    if (input.openingStock && input.openingStock !== 0 && input.branchId) {
      recordMovement(db, {
        productId: id,
        branchId: input.branchId,
        reason: 'opening_stock',
        qty: input.openingStock,
        unit: input.unit ?? 'pc',
        unitCost: input.cost ?? 0,
        refType: 'opening',
        note: 'opening stock (product create)',
        userId: input.userId,
        at: now,
      });
    }

    logActivity(db, {
      by: input.userId,
      branchId: input.branchId,
      action: 'created',
      entity: 'product',
      entityId: id,
      entityRef: input.sku,
      message: `New product: ${input.name}`,
      at: now,
    });
    return { id };
  });
}

export function updateProduct(db: DB, id: string, patch: Partial<ProductInput>) {
  return tx(db, () => {
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!existing) throw new Error('Product not found');
    const now = new Date().toISOString();

    // Map camelCase patch keys to columns; only set provided keys.
    const colMap: Record<string, string> = {
      sku: 'sku',
      barcode: 'barcode',
      name: 'name',
      categoryId: 'category_id',
      brandId: 'brand_id',
      unit: 'unit',
      cost: 'cost',
      price: 'price',
      wholesalePrice: 'wholesale_price',
      contractorPrice: 'contractor_price',
      reorderLevel: 'reorder_level',
      taxPct: 'tax_pct',
      warrantyId: 'warranty_id',
      imageUrl: 'image_url',
      description: 'description',
    };
    const boolMap: Record<string, string> = {
      manageStock: 'manage_stock',
      allowNegativeSale: 'allow_negative_sale',
      allowDiscount: 'allow_discount',
      showInPOS: 'show_in_pos',
      notForSale: 'not_for_sale',
    };
    const sets: string[] = [];
    const params: Record<string, unknown> = { id, now };
    for (const [k, col] of Object.entries(colMap)) {
      if (k in patch) {
        sets.push(`${col} = @${k}`);
        params[k] = (patch as Record<string, unknown>)[k] ?? null;
      }
    }
    for (const [k, col] of Object.entries(boolMap)) {
      if (k in patch) {
        sets.push(`${col} = @${k}`);
        params[k] = (patch as Record<string, unknown>)[k] ? 1 : 0;
      }
    }
    sets.push('updated_at = @now');
    db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = @id`).run(params);

    if ('name' in patch || 'sku' in patch || 'barcode' in patch) syncProductFts(db, id);

    logActivity(db, {
      action: 'edited',
      entity: 'product',
      entityId: id,
      message: `Updated product`,
      at: now,
    });
    return { id };
  });
}

export function deleteProduct(db: DB, id: string) {
  return tx(db, () => {
    // Guard: don't delete a product referenced by any historical document — keeps
    // audit history intact. Suggest "not for sale" instead for retired products.
    const refs = [
      ['sale_lines', 'sales history'],
      ['purchase_lines', 'purchase history'],
      ['sell_return_lines', 'sell-return history'],
      ['purchase_return_lines', 'purchase-return history'],
      ['stock_transfer_lines', 'transfer history'],
      ['stock_adjustment_lines', 'adjustment history'],
    ] as const;
    for (const [table, label] of refs) {
      const c = db.prepare(`SELECT COUNT(*) c FROM ${table} WHERE product_id = ?`).get(id) as { c: number };
      if (c.c > 0) {
        throw new Error(`Cannot delete: product has ${label}. Mark it "not for sale" instead.`);
      }
    }
    const hasStock = stockOnHand(db, id);
    if (Math.abs(hasStock) > 0.001) {
      throw new Error('Cannot delete: product still has stock. Adjust stock to zero first.');
    }
    db.prepare('DELETE FROM stock_movements WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM fts_products WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return { id };
  });
}

// ---------- Categories ----------
export function createCategory(db: DB, input: { name: string; emoji?: string; parentId?: string }) {
  const id = newId('cat');
  db.prepare('INSERT INTO categories (id, name, emoji, parent_id) VALUES (?,?,?,?)').run(
    id,
    input.name,
    input.emoji ?? null,
    input.parentId ?? null,
  );
  return { id };
}
export function updateCategory(db: DB, id: string, patch: { name?: string; emoji?: string; parentId?: string | null }) {
  const cur = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as
    | { name: string; emoji: string | null; parent_id: string | null }
    | undefined;
  if (!cur) throw new Error('Category not found');
  db.prepare('UPDATE categories SET name = ?, emoji = ?, parent_id = ? WHERE id = ?').run(
    patch.name ?? cur.name,
    patch.emoji ?? cur.emoji,
    patch.parentId === undefined ? cur.parent_id : patch.parentId,
    id,
  );
  return { id };
}
export function deleteCategory(db: DB, id: string) {
  // detach children + clear product refs (don't cascade-delete products)
  db.prepare('UPDATE categories SET parent_id = NULL WHERE parent_id = ?').run(id);
  db.prepare('UPDATE products SET category_id = NULL WHERE category_id = ?').run(id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return { id };
}

// ---------- Brands ----------
export function createBrand(db: DB, input: { name: string }) {
  const id = newId('b');
  db.prepare('INSERT INTO brands (id, name) VALUES (?,?)').run(id, input.name);
  return { id };
}
export function updateBrand(db: DB, id: string, patch: { name?: string }) {
  const cur = db.prepare('SELECT name FROM brands WHERE id = ?').get(id) as { name: string } | undefined;
  if (!cur) throw new Error('Brand not found');
  db.prepare('UPDATE brands SET name = ? WHERE id = ?').run(patch.name ?? cur.name, id);
  return { id };
}
export function deleteBrand(db: DB, id: string) {
  db.prepare('UPDATE products SET brand_id = NULL WHERE brand_id = ?').run(id);
  db.prepare('DELETE FROM brands WHERE id = ?').run(id);
  return { id };
}

// ---------- Units ----------
export function createUnit(
  db: DB,
  input: { name: string; short: string; type?: string; toBaseFactor?: number },
) {
  const id = newId('u');
  db.prepare('INSERT INTO units (id, name, short, type, to_base_factor) VALUES (?,?,?,?,?)').run(
    id,
    input.name,
    input.short,
    input.type ?? 'count',
    input.toBaseFactor ?? 1,
  );
  return { id };
}
export function updateUnit(
  db: DB,
  id: string,
  patch: { name?: string; short?: string; type?: string; toBaseFactor?: number },
) {
  const cur = db.prepare('SELECT * FROM units WHERE id = ?').get(id) as
    | { name: string; short: string; type: string; to_base_factor: number }
    | undefined;
  if (!cur) throw new Error('Unit not found');
  db.prepare('UPDATE units SET name = ?, short = ?, type = ?, to_base_factor = ? WHERE id = ?').run(
    patch.name ?? cur.name,
    patch.short ?? cur.short,
    patch.type ?? cur.type,
    patch.toBaseFactor === undefined ? cur.to_base_factor : patch.toBaseFactor,
    id,
  );
  return { id };
}
export function deleteUnit(db: DB, id: string) {
  const cur = db.prepare('SELECT short FROM units WHERE id = ?').get(id) as
    | { short: string }
    | undefined;
  if (!cur) throw new Error('Unit not found');
  const used = db.prepare('SELECT COUNT(*) c FROM products WHERE unit = ?').get(cur.short) as {
    c: number;
  };
  if (used.c > 0) {
    throw new Error(`Cannot delete: ${used.c} product(s) use the "${cur.short}" unit.`);
  }
  db.prepare('DELETE FROM units WHERE id = ?').run(id);
  return { id };
}

// ---------- Warranties ----------
export interface WarrantyInput {
  name: string;
  durationMonths?: number;
  description?: string;
}

export function createWarranty(db: DB, input: WarrantyInput) {
  const id = newId('w');
  db.prepare(
    'INSERT INTO warranties (id, name, duration_months, description) VALUES (?,?,?,?)',
  ).run(id, input.name, input.durationMonths ?? 0, input.description ?? null);
  return { id };
}

export function updateWarranty(
  db: DB,
  id: string,
  patch: { name?: string; durationMonths?: number; description?: string | null },
) {
  const cur = db.prepare('SELECT * FROM warranties WHERE id = ?').get(id) as
    | { name: string; duration_months: number; description: string | null }
    | undefined;
  if (!cur) throw new Error('Warranty not found');
  db.prepare(
    'UPDATE warranties SET name = ?, duration_months = ?, description = ? WHERE id = ?',
  ).run(
    patch.name ?? cur.name,
    patch.durationMonths === undefined ? cur.duration_months : patch.durationMonths,
    patch.description === undefined ? cur.description : patch.description,
    id,
  );
  return { id };
}

export function deleteWarranty(db: DB, id: string) {
  return tx(db, () => {
    // Guard: detach any products referencing this warranty (don't cascade-delete
    // products). Mirrors the category delete-detach pattern.
    db.prepare('UPDATE products SET warranty_id = NULL WHERE warranty_id = ?').run(id);
    db.prepare('DELETE FROM warranties WHERE id = ?').run(id);
    return { id };
  });
}

// ---------- Selling Price Groups ----------
export interface PriceGroupInput {
  name: string;
  isDefault?: boolean;
  notes?: string;
  defaultCreditLimit?: number;
  defaultDiscountPct?: number;
  taxExempt?: boolean;
}

export function createPriceGroup(db: DB, input: PriceGroupInput) {
  return tx(db, () => {
    const id = newId('pg');
    // If this group is the new default, clear is_default on all others first.
    if (input.isDefault) {
      db.prepare('UPDATE price_groups SET is_default = 0').run();
    }
    db.prepare(
      `INSERT INTO price_groups
         (id, name, is_default, notes, default_credit_limit, default_discount_pct, tax_exempt)
       VALUES (@id, @name, @isDefault, @notes, @creditLimit, @discountPct, @taxExempt)`,
    ).run({
      id,
      name: input.name,
      isDefault: input.isDefault ? 1 : 0,
      notes: input.notes ?? null,
      creditLimit: input.defaultCreditLimit ?? null,
      discountPct: input.defaultDiscountPct ?? null,
      taxExempt: input.taxExempt ? 1 : 0,
    });
    return { id };
  });
}

export function updatePriceGroup(
  db: DB,
  id: string,
  patch: {
    name?: string;
    isDefault?: boolean;
    notes?: string | null;
    defaultCreditLimit?: number | null;
    defaultDiscountPct?: number | null;
    taxExempt?: boolean;
  },
) {
  return tx(db, () => {
    const cur = db.prepare('SELECT * FROM price_groups WHERE id = ?').get(id) as
      | {
          name: string;
          is_default: number;
          notes: string | null;
          default_credit_limit: number | null;
          default_discount_pct: number | null;
          tax_exempt: number;
        }
      | undefined;
    if (!cur) throw new Error('Price group not found');

    // If this update marks the group default, clear is_default on every other group.
    if (patch.isDefault) {
      db.prepare('UPDATE price_groups SET is_default = 0 WHERE id != ?').run(id);
    }

    db.prepare(
      `UPDATE price_groups SET
         name = @name,
         is_default = @isDefault,
         notes = @notes,
         default_credit_limit = @creditLimit,
         default_discount_pct = @discountPct,
         tax_exempt = @taxExempt
       WHERE id = @id`,
    ).run({
      id,
      name: patch.name ?? cur.name,
      isDefault: patch.isDefault === undefined ? cur.is_default : patch.isDefault ? 1 : 0,
      notes: patch.notes === undefined ? cur.notes : patch.notes,
      creditLimit:
        patch.defaultCreditLimit === undefined ? cur.default_credit_limit : patch.defaultCreditLimit,
      discountPct:
        patch.defaultDiscountPct === undefined ? cur.default_discount_pct : patch.defaultDiscountPct,
      taxExempt: patch.taxExempt === undefined ? cur.tax_exempt : patch.taxExempt ? 1 : 0,
    });
    return { id };
  });
}

export function deletePriceGroup(db: DB, id: string) {
  return tx(db, () => {
    const cur = db.prepare('SELECT name, is_default FROM price_groups WHERE id = ?').get(id) as
      | { name: string; is_default: number }
      | undefined;
    if (!cur) throw new Error('Price group not found');

    // Never delete the default group.
    if (cur.is_default) {
      throw new Error('Cannot delete the default price group.');
    }

    // Customers store their group as the NAME string (customers.price_group).
    // Block deletion when any customer references this group's name — the safe,
    // explicit choice (vs silently re-pointing customers to another group).
    const used = db.prepare('SELECT COUNT(*) c FROM customers WHERE price_group = ?').get(cur.name) as {
      c: number;
    };
    if (used.c > 0) {
      throw new Error(
        `Cannot delete: ${used.c} customer(s) belong to the "${cur.name}" group. Reassign them first.`,
      );
    }

    db.prepare('DELETE FROM price_groups WHERE id = ?').run(id);
    return { id };
  });
}
