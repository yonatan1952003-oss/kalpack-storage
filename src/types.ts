export type Status = 'production' | 'ready' | 'transit' | 'received';

export const STATUS_LABELS: Record<Status, string> = {
  production: 'בייצור',
  ready: 'מוכן',
  transit: 'בים',
  received: 'נכנס למלאי',
};

export const STATUS_COLORS: Record<Status, string> = {
  production: 'var(--status-production)',
  ready: 'var(--status-ready)',
  transit: 'var(--status-transit)',
  received: 'var(--status-received)',
};

export const STATUS_ORDER: Status[] = ['production', 'ready', 'transit', 'received'];

// Master product catalog — imported from Excel or created manually
export interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  color: string;
  category: string;
  cbm: number;
  technicalDetails: string;
  supplier: string;
  unitPrice: number;
  currency: string;
  estimatedProductionDays: number;
  estimatedShippingDays: number;
  quantity: number;
}

export interface POLineItem {
  id: string;
  sku: string;
  description: string;
  color: string;
  category: string;
  cbm: number;
  technicalDetails: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  statusBreakdown: Record<Status, number>;
  containerId?: string;
  createdAt: string;
  statusTransitions: { from: Status; to: Status; date: string }[];
  estimatedProductionDays: number;
  estimatedShippingDays: number;
  shippingCostPerUnit: number;
  // Transit / shipping details
  jobNumber: string;
  estimatedArrival: string;
  // Prepayment tracking
  prepaidAmount: number;
  prepaidDate: string;
  prepaidNote: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  date: string;
  items: POLineItem[];
  notes: string;
  executionDate?: string;
}

export interface ContainerItem {
  poId: string;
  lineItemId: string;
  quantity: number;
  /** Snapshot of item data at the time of container creation/arrival.
   * Required for arrived containers (line items may be removed from POs after arrival). */
  snapshot?: {
    poNumber: string;
    supplier: string;
    sku: string;
    description: string;
    color: string;
    category: string;
    cbm: number;
    unitPrice: number;
    currency: string;
    shippingCostPerUnit: number;
  };
}

export type ContainerType = '20FT' | '40FT' | '40HC';

/** Standard usable volume per container type (CBM). Slightly conservative
 * vs nominal capacity to leave room for packing inefficiency. */
export const CONTAINER_VOLUMES: Record<ContainerType, { label: string; volume: number }> = {
  '20FT': { label: '20FT Standard', volume: 28 },
  '40FT': { label: '40FT Standard', volume: 58 },
  '40HC': { label: '40HC High Cube', volume: 68 },
};

export interface Container {
  id: string;
  containerNumber: string;
  supplier: string;
  shippingCost: number;
  departureDate: string;
  arrivalDate: string;
  status: 'loading' | 'in-transit' | 'arrived';
  items: ContainerItem[];
  /** Container type for capacity validation. */
  containerType?: ContainerType;
  /** ISO date when the container was archived (moved to arrivedContainers). */
  archivedAt?: string;
}

export interface ProductTemplate {
  id: string;
  supplier: string;
  sku: string;
  description: string;
  color: string;
  category: string;
  cbm: number;
  technicalDetails: string;
  unitPrice: number;
  currency: string;
  estimatedProductionDays: number;
  estimatedShippingDays: number;
}

export type SalesPeriod = 'day' | 'week' | 'month';

export interface SalesRow {
  sku: string;
  name: string;
  salesAmount: number;
  salesPeriod: SalesPeriod;
  currentStock: number;
}

export interface AIAlert {
  id: string;
  severity: 'red' | 'yellow' | 'green';
  title: string;
  message: string;
  sku: string;
  actionLabel?: string;
  daysUntilStockout?: number;
  recommendedQty?: number;
}

export type TabId = 'dashboard' | 'po' | 'containers' | 'arrivedContainers' | 'leadtimes' | 'ai' | 'data' | 'suppliers' | 'analytics' | 'graphs' | 'settings';

export interface Filters {
  supplier: string;
  color: string;
  category: string;
  status: Status | '';
  search: string;
}

// Supplier management
export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  currency: string;
  paymentTerms: string;
  notes: string;
  rating: number; // 1-5
  createdAt: string;
}

// Audit log
export interface AuditEntry {
  id: string;
  timestamp: string;
  action: 'create' | 'update' | 'delete' | 'import' | 'export' | 'status_change';
  entity: 'po' | 'container' | 'catalog' | 'sales' | 'supplier' | 'settings';
  entityId: string;
  description: string;
  user: string;
}

// Theme
export type Theme = 'dark' | 'light';
