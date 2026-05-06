/**
 * Purchase Order / Container service
 * ----------------------------------
 * Talks to the normalized Supabase schema:
 *   purchase_orders  ←─  purchase_order_line_items
 *                    └─  container_line_items  ──→  containers
 *                                                    │
 *                                          (status='arrived' trigger)
 *                                                    ↓
 *                    └─  arrived_container_line_items ──→ arrived_containers
 *
 * Frontend should NOT manually move rows between containers and arrived_containers.
 * Just call markContainerArrived(id) and the database trigger handles archival.
 */
import { supabase } from './supabase';
import type { PurchaseOrder, POLineItem, Container, ContainerItem, Status } from '../types';

/* ─── Row shapes (match the DB columns) ─── */

interface PORow {
  id: string;
  po_number: string;
  supplier: string;
  po_date: string;
  execution_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface POLineItemRow {
  id: string;
  purchase_order_id: string;
  sku: string;
  description: string;
  color: string;
  category: string;
  cbm: number;
  technical_details: string;
  quantity: number;
  unit_price: number;
  currency: string;
  status_breakdown: Record<Status, number>;
  status_transitions: { from: Status; to: Status; date: string }[];
  estimated_production_days: number;
  estimated_shipping_days: number;
  shipping_cost_per_unit: number;
  job_number: string;
  estimated_arrival: string | null;
  prepaid_amount: number;
  prepaid_date: string | null;
  prepaid_note: string;
  created_at: string;
}

interface ContainerRow {
  id: string;
  container_number: string;
  supplier: string;
  shipping_cost: number;
  departure_date: string | null;
  arrival_date: string | null;
  status: Container['status'];
  container_type: '20FT' | '40FT' | '40HC' | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ContainerLineItemRow {
  id: string;
  container_id: string;
  purchase_order_id: string | null;
  line_item_id: string | null;
  quantity: number;
  snapshot: ContainerItem['snapshot'] | Record<string, never>;
}

interface ArrivedContainerRow extends Omit<ContainerRow, 'archived_at'> {
  archived_at: string;
  container_id: string | null;
}

interface ArrivedContainerLineItemRow extends Omit<ContainerLineItemRow, 'container_id'> {
  arrived_container_id: string;
  archived_at: string;
}

/** Aggregated payload returned by get_purchase_order_full RPC. */
export interface PurchaseOrderFull {
  purchase_order: PORow;
  line_items: POLineItemRow[];
  active_containers: (ContainerRow & { line_items: ContainerLineItemRow[] })[];
  arrived_containers: (ArrivedContainerRow & { line_items: ArrivedContainerLineItemRow[] })[];
}

/* ─── Mappers: DB row ↔ frontend type ─── */

function rowToLineItem(r: POLineItemRow): POLineItem {
  return {
    id: r.id,
    sku: r.sku,
    description: r.description,
    color: r.color,
    category: r.category,
    cbm: Number(r.cbm),
    technicalDetails: r.technical_details,
    quantity: r.quantity,
    unitPrice: Number(r.unit_price),
    currency: r.currency,
    statusBreakdown: r.status_breakdown,
    createdAt: r.created_at.slice(0, 10),
    statusTransitions: r.status_transitions,
    estimatedProductionDays: r.estimated_production_days,
    estimatedShippingDays: r.estimated_shipping_days,
    shippingCostPerUnit: Number(r.shipping_cost_per_unit),
    jobNumber: r.job_number,
    estimatedArrival: r.estimated_arrival ?? '',
    prepaidAmount: Number(r.prepaid_amount),
    prepaidDate: r.prepaid_date ?? '',
    prepaidNote: r.prepaid_note,
  };
}

function lineItemToInsert(li: POLineItem, poId: string) {
  return {
    id: li.id,
    purchase_order_id: poId,
    sku: li.sku,
    description: li.description,
    color: li.color,
    category: li.category,
    cbm: li.cbm,
    technical_details: li.technicalDetails,
    quantity: li.quantity,
    unit_price: li.unitPrice,
    currency: li.currency,
    status_breakdown: li.statusBreakdown,
    status_transitions: li.statusTransitions,
    estimated_production_days: li.estimatedProductionDays,
    estimated_shipping_days: li.estimatedShippingDays,
    shipping_cost_per_unit: li.shippingCostPerUnit,
    job_number: li.jobNumber,
    estimated_arrival: li.estimatedArrival || null,
    prepaid_amount: li.prepaidAmount,
    prepaid_date: li.prepaidDate || null,
    prepaid_note: li.prepaidNote,
  };
}

function rowToPO(po: PORow, items: POLineItemRow[]): PurchaseOrder {
  return {
    id: po.id,
    poNumber: po.po_number,
    supplier: po.supplier,
    date: po.po_date,
    executionDate: po.execution_date ?? undefined,
    notes: po.notes,
    items: items.map(rowToLineItem),
  };
}

function rowToContainer(c: ContainerRow | ArrivedContainerRow, items: (ContainerLineItemRow | ArrivedContainerLineItemRow)[]): Container {
  return {
    id: c.id,
    containerNumber: c.container_number,
    supplier: c.supplier,
    shippingCost: Number(c.shipping_cost),
    departureDate: c.departure_date ?? '',
    arrivalDate: c.arrival_date ?? '',
    status: c.status,
    items: items.map(it => ({
      poId: it.purchase_order_id ?? '',
      lineItemId: it.line_item_id ?? '',
      quantity: it.quantity,
      snapshot: it.snapshot && Object.keys(it.snapshot).length > 0 ? (it.snapshot as ContainerItem['snapshot']) : undefined,
    })),
    archivedAt: c.archived_at ?? undefined,
  };
}

/* ─── Purchase orders ─── */

/** List all POs with their line items, newest first. */
export async function listPOs(): Promise<PurchaseOrder[]> {
  const { data: pos, error } = await supabase
    .from('purchase_orders')
    .select('*, purchase_order_line_items(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (pos ?? []).map((row: PORow & { purchase_order_line_items: POLineItemRow[] }) =>
    rowToPO(row, row.purchase_order_line_items ?? [])
  );
}

/**
 * Get a single PO with its line items + every container (active and arrived)
 * that carries any of those line items. Backed by the get_purchase_order_full
 * RPC, which performs the joins server-side.
 */
export async function fetchPOFull(poId: string): Promise<PurchaseOrderFull | null> {
  const { data, error } = await supabase.rpc('get_purchase_order_full', { po_id: poId });
  if (error) throw error;
  if (!data || (data as PurchaseOrderFull).purchase_order == null) return null;
  return data as PurchaseOrderFull;
}

/** Create a PO with its line items in a single round-trip (RPC could be added later for strict atomicity). */
export async function createPO(po: PurchaseOrder): Promise<PurchaseOrder> {
  const { data: poRow, error: poErr } = await supabase
    .from('purchase_orders')
    .insert({
      id: po.id,
      po_number: po.poNumber,
      supplier: po.supplier,
      po_date: po.date,
      execution_date: po.executionDate || null,
      notes: po.notes,
    })
    .select()
    .single();
  if (poErr) throw poErr;

  if (po.items.length > 0) {
    const { error: liErr } = await supabase
      .from('purchase_order_line_items')
      .insert(po.items.map(li => lineItemToInsert(li, (poRow as PORow).id)));
    if (liErr) throw liErr;
  }

  const fresh = await fetchPOFull((poRow as PORow).id);
  if (!fresh) throw new Error('Created PO but failed to refetch');
  return rowToPO(fresh.purchase_order, fresh.line_items);
}

/**
 * Replace a PO and its line items. Strategy: delete-then-insert items so the
 * client can hand a full snapshot without computing a diff. Acceptable while
 * line item counts stay small (typical PO has < 50 items).
 */
export async function updatePO(po: PurchaseOrder): Promise<PurchaseOrder> {
  const { error: poErr } = await supabase
    .from('purchase_orders')
    .update({
      po_number: po.poNumber,
      supplier: po.supplier,
      po_date: po.date,
      execution_date: po.executionDate || null,
      notes: po.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', po.id);
  if (poErr) throw poErr;

  const { error: delErr } = await supabase
    .from('purchase_order_line_items')
    .delete()
    .eq('purchase_order_id', po.id);
  if (delErr) throw delErr;

  if (po.items.length > 0) {
    const { error: insErr } = await supabase
      .from('purchase_order_line_items')
      .insert(po.items.map(li => lineItemToInsert(li, po.id)));
    if (insErr) throw insErr;
  }

  const fresh = await fetchPOFull(po.id);
  if (!fresh) throw new Error('Updated PO but failed to refetch');
  return rowToPO(fresh.purchase_order, fresh.line_items);
}

/** Delete a PO. CASCADE removes its line items; container_line_items get SET NULL. */
export async function deletePO(poId: string): Promise<void> {
  const { error } = await supabase.from('purchase_orders').delete().eq('id', poId);
  if (error) throw error;
}

/* ─── Containers ─── */

/** List active (non-arrived) containers + their line items. */
export async function listContainers(): Promise<Container[]> {
  const { data, error } = await supabase
    .from('containers')
    .select('*, container_line_items(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c: ContainerRow & { container_line_items: ContainerLineItemRow[] }) =>
    rowToContainer(c, c.container_line_items ?? [])
  );
}

/** List archived/arrived containers + their snapshotted line items. */
export async function listArrivedContainers(): Promise<Container[]> {
  const { data, error } = await supabase
    .from('arrived_containers')
    .select('*, arrived_container_line_items(*)')
    .order('archived_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c: ArrivedContainerRow & { arrived_container_line_items: ArrivedContainerLineItemRow[] }) =>
    rowToContainer(c, c.arrived_container_line_items ?? [])
  );
}

/** Create a container with its line items. */
export async function createContainer(c: Container): Promise<Container> {
  const { data: row, error: cErr } = await supabase
    .from('containers')
    .insert({
      id: c.id,
      container_number: c.containerNumber,
      supplier: c.supplier,
      shipping_cost: c.shippingCost,
      departure_date: c.departureDate || null,
      arrival_date: c.arrivalDate || null,
      status: c.status,
    })
    .select()
    .single();
  if (cErr) throw cErr;

  if (c.items.length > 0) {
    const { error: liErr } = await supabase.from('container_line_items').insert(
      c.items.map(it => ({
        container_id: (row as ContainerRow).id,
        purchase_order_id: it.poId || null,
        line_item_id: it.lineItemId || null,
        quantity: it.quantity,
        snapshot: it.snapshot ?? {},
      }))
    );
    if (liErr) throw liErr;
  }

  return rowToContainer(row as ContainerRow, []);
}

/**
 * Mark a container as arrived. The DB trigger handles archival:
 *   - Inserts a snapshot row into arrived_containers
 *   - Copies all line items into arrived_container_line_items
 *   - Deletes the source container (CASCADE removes container_line_items)
 *
 * After this call, the container disappears from listContainers() and shows
 * up in listArrivedContainers().
 */
export async function markContainerArrived(containerId: string): Promise<void> {
  const { error } = await supabase
    .from('containers')
    .update({ status: 'arrived', arrival_date: new Date().toISOString().slice(0, 10) })
    .eq('id', containerId);
  if (error) throw error;
}

/** Update non-archival fields on a container (status, dates, etc.). */
export async function updateContainer(c: Container): Promise<void> {
  const { error } = await supabase
    .from('containers')
    .update({
      container_number: c.containerNumber,
      supplier: c.supplier,
      shipping_cost: c.shippingCost,
      departure_date: c.departureDate || null,
      arrival_date: c.arrivalDate || null,
      status: c.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', c.id);
  if (error) throw error;
}

/** Delete an active container. CASCADE removes its line items. */
export async function deleteContainer(containerId: string): Promise<void> {
  const { error } = await supabase.from('containers').delete().eq('id', containerId);
  if (error) throw error;
}
