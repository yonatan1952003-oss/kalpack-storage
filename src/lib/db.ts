import { supabase } from './supabase';
import type { CatalogProduct, SalesRow } from '../types';

/** Raw row shape from public.inventory */
export interface InventoryRow {
  id: number;
  sku: string | null;
  product_name: string;
  profit_quantity: number | null;
  category: string | null;
  price: number | null;
  technical_info: string | null;
  in_stock: boolean | null;
  barcode: string | null;
  delivery_type: string | null;
}

const INVENTORY_COLUMNS =
  'id, sku, product_name, profit_quantity, category, price, technical_info, in_stock, barcode, delivery_type';

/** Map a Supabase inventory row → app CatalogProduct */
export function rowToCatalog(row: InventoryRow): CatalogProduct {
  return {
    id: String(row.id),
    sku: row.sku ?? '',
    name: row.product_name ?? '',
    color: '',
    category: row.category ?? '',
    cbm: 0,
    technicalDetails: row.technical_info ?? '',
    supplier: '',
    unitPrice: row.price != null ? Number(row.price) : 0,
    currency: 'USD',
    estimatedProductionDays: 30,
    estimatedShippingDays: 60,
    quantity: row.profit_quantity ?? 0,
  };
}

/** Map a Supabase inventory row → app SalesRow (current stock view) */
export function rowToSales(row: InventoryRow): SalesRow {
  return {
    sku: row.sku ?? '',
    name: row.product_name ?? '',
    salesAmount: 0,
    salesPeriod: 'week',
    currentStock: row.profit_quantity ?? 0,
  };
}

/** Fetch all inventory rows */
export async function fetchInventory(): Promise<InventoryRow[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select(INVENTORY_COLUMNS)
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as InventoryRow[];
}

/** Insert a new inventory row from a CatalogProduct */
export async function insertInventoryFromCatalog(p: CatalogProduct): Promise<InventoryRow> {
  const payload = {
    sku: p.sku || null,
    product_name: p.name,
    category: p.category || null,
    price: p.unitPrice || null,
    technical_info: p.technicalDetails || null,
  };
  const { data, error } = await supabase
    .from('inventory')
    .insert(payload)
    .select(INVENTORY_COLUMNS)
    .single();
  if (error) throw error;
  return data as InventoryRow;
}

/** Update an inventory row from a CatalogProduct (id is the supabase pk as string) */
export async function updateInventoryFromCatalog(p: CatalogProduct): Promise<InventoryRow> {
  const id = Number(p.id);
  if (!Number.isFinite(id)) throw new Error(`Invalid inventory id: ${p.id}`);
  const payload = {
    sku: p.sku || null,
    product_name: p.name,
    category: p.category || null,
    price: p.unitPrice || null,
    technical_info: p.technicalDetails || null,
  };
  const { data, error } = await supabase
    .from('inventory')
    .update(payload)
    .eq('id', id)
    .select(INVENTORY_COLUMNS)
    .single();
  if (error) throw error;
  return data as InventoryRow;
}

/** Update only the stock quantity for a row identified by SKU */
export async function updateInventoryStockBySku(sku: string, qty: number): Promise<void> {
  const { error } = await supabase
    .from('inventory')
    .update({ profit_quantity: qty })
    .eq('sku', sku);
  if (error) throw error;
}

/** Delete an inventory row by app id (string form of bigint pk) */
export async function deleteInventoryById(id: string): Promise<void> {
  const numId = Number(id);
  if (!Number.isFinite(numId)) throw new Error(`Invalid inventory id: ${id}`);
  const { error } = await supabase.from('inventory').delete().eq('id', numId);
  if (error) throw error;
}
