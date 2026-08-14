import type { DB } from '../db/connection.ts';

/**
 * Migration: Add default "Uncategorized" category and "No Brand" brand
 * Run this once on existing databases to support optional category/brand in products
 */

export function addDefaultCategoryAndBrand(db: DB) {
  // Check if defaults already exist
  const existingCat = db.prepare('SELECT id FROM categories WHERE id = ?').get('cat_none');
  const existingBrand = db.prepare('SELECT id FROM brands WHERE id = ?').get('b_none');

  if (!existingCat) {
    console.log('Adding default "Uncategorized" category...');
    db.prepare('INSERT INTO categories (id, name, emoji) VALUES (?, ?, ?)').run(
      'cat_none',
      'Uncategorized',
      '📦'
    );
  }

  if (!existingBrand) {
    console.log('Adding default "No Brand" brand...');
    db.prepare('INSERT INTO brands (id, name) VALUES (?, ?)').run('b_none', 'No Brand');
  }

  console.log('✓ Default category and brand are ready');
}
