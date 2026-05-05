import type { PurchaseOrder, Container, CatalogProduct, SalesRow, AIAlert } from './types';

// --- Mock Catalog Products ---
export const MOCK_CATALOG: CatalogProduct[] = [
  { id: 'cat-1', sku: 'LED-5050-WW', name: 'רצועת LED לבן חם 5050', color: 'לבן חם', category: 'תאורת LED', cbm: 0.02, technicalDetails: '5050 SMD, 60 LED/m, 12V, IP65', supplier: 'Shenzhen Bright Electronics', unitPrice: 2.40, currency: 'USD', estimatedProductionDays: 25, estimatedShippingDays: 60, quantity: 0 },
  { id: 'cat-2', sku: 'LED-2835-CW', name: 'רצועת LED לבן קר 2835', color: 'לבן קר', category: 'תאורת LED', cbm: 0.015, technicalDetails: '2835 SMD, 120 LED/m, 24V, IP20', supplier: 'Shenzhen Bright Electronics', unitPrice: 1.80, currency: 'USD', estimatedProductionDays: 28, estimatedShippingDays: 60, quantity: 0 },
  { id: 'cat-3', sku: 'DRV-24V-150W', name: 'ספק כוח 24V 150W', color: 'שחור', category: 'ספקי כוח', cbm: 0.008, technicalDetails: 'Mean Well HLG-150H-24, IP67', supplier: 'Shenzhen Bright Electronics', unitPrice: 12.50, currency: 'USD', estimatedProductionDays: 20, estimatedShippingDays: 60, quantity: 0 },
  { id: 'cat-4', sku: 'LED-5050-RGB', name: 'רצועת LED RGB 5050', color: 'RGB', category: 'תאורת LED', cbm: 0.025, technicalDetails: '5050 RGB SMD, 30 LED/m, 12V, IP65', supplier: 'Shenzhen Bright Electronics', unitPrice: 3.20, currency: 'USD', estimatedProductionDays: 30, estimatedShippingDays: 60, quantity: 0 },
  { id: 'cat-5', sku: 'CTRL-WIFI-01', name: 'בקר WiFi חכם', color: 'לבן', category: 'בקרים', cbm: 0.003, technicalDetails: 'ESP32, 4 ערוצים, 2.4GHz WiFi', supplier: 'Shenzhen Bright Electronics', unitPrice: 8.90, currency: 'USD', estimatedProductionDays: 26, estimatedShippingDays: 60, quantity: 0 },
  { id: 'cat-6', sku: 'DRV-12V-100W', name: 'ספק כוח 12V 100W', color: 'שחור', category: 'ספקי כוח', cbm: 0.006, technicalDetails: 'Mean Well LPV-100-12, IP67', supplier: 'Guangzhou Power Systems', unitPrice: 9.20, currency: 'USD', estimatedProductionDays: 19, estimatedShippingDays: 60, quantity: 0 },
];

// --- Mock POs ---
export const MOCK_POS: PurchaseOrder[] = [
  {
    id: 'po-1', poNumber: 'PO-2024-001', supplier: 'Shenzhen Bright Electronics', date: '2024-12-15', notes: 'הזמנה ראשונה Q1',
    items: [
      { id: 'li-1', sku: 'LED-5050-WW', description: 'רצועת LED לבן חם 5050', color: 'לבן חם', category: 'תאורת LED', cbm: 0.02, technicalDetails: '5050 SMD, 60 LED/m, 12V, IP65', quantity: 5000, unitPrice: 2.40, currency: 'USD', statusBreakdown: { production: 1000, ready: 1500, transit: 1500, received: 1000 }, createdAt: '2024-12-15', statusTransitions: [{ from: 'production', to: 'ready', date: '2025-01-10' }, { from: 'ready', to: 'transit', date: '2025-01-20' }, { from: 'transit', to: 'received', date: '2025-02-15' }], estimatedProductionDays: 25, estimatedShippingDays: 60, shippingCostPerUnit: 1.14, jobNumber: 'JOB-SH-2025-042', estimatedArrival: '2025-03-20', prepaidAmount: 3000, prepaidDate: '2024-12-20', prepaidNote: 'מקדמה 25%' },
      { id: 'li-2', sku: 'LED-2835-CW', description: 'רצועת LED לבן קר 2835', color: 'לבן קר', category: 'תאורת LED', cbm: 0.015, technicalDetails: '2835 SMD, 120 LED/m, 24V, IP20', quantity: 3000, unitPrice: 1.80, currency: 'USD', statusBreakdown: { production: 500, ready: 1000, transit: 1000, received: 500 }, createdAt: '2024-12-15', statusTransitions: [{ from: 'production', to: 'ready', date: '2025-01-12' }, { from: 'ready', to: 'transit', date: '2025-01-22' }], estimatedProductionDays: 28, estimatedShippingDays: 60, shippingCostPerUnit: 1.14, jobNumber: 'JOB-SH-2025-042', estimatedArrival: '2025-03-20', prepaidAmount: 0, prepaidDate: '', prepaidNote: '' },
      { id: 'li-3', sku: 'DRV-24V-150W', description: 'ספק כוח 24V 150W', color: 'שחור', category: 'ספקי כוח', cbm: 0.008, technicalDetails: 'Mean Well HLG-150H-24, IP67', quantity: 800, unitPrice: 12.50, currency: 'USD', statusBreakdown: { production: 0, ready: 300, transit: 300, received: 200 }, createdAt: '2024-12-15', statusTransitions: [{ from: 'production', to: 'ready', date: '2025-01-08' }, { from: 'ready', to: 'transit', date: '2025-01-20' }, { from: 'transit', to: 'received', date: '2025-02-14' }], estimatedProductionDays: 20, estimatedShippingDays: 60, shippingCostPerUnit: 1.14, jobNumber: '', estimatedArrival: '', prepaidAmount: 0, prepaidDate: '', prepaidNote: '' },
    ],
  },
  {
    id: 'po-2', poNumber: 'PO-2024-002', supplier: 'Shenzhen Bright Electronics', date: '2025-01-10', notes: 'השלמת מלאי דחופה',
    items: [
      { id: 'li-4', sku: 'LED-5050-RGB', description: 'רצועת LED RGB 5050', color: 'RGB', category: 'תאורת LED', cbm: 0.025, technicalDetails: '5050 RGB SMD, 30 LED/m, 12V, IP65', quantity: 2000, unitPrice: 3.20, currency: 'USD', statusBreakdown: { production: 2000, ready: 0, transit: 0, received: 0 }, createdAt: '2025-01-10', statusTransitions: [], estimatedProductionDays: 30, estimatedShippingDays: 60, shippingCostPerUnit: 0, jobNumber: '', estimatedArrival: '', prepaidAmount: 0, prepaidDate: '', prepaidNote: '' },
      { id: 'li-5', sku: 'CTRL-WIFI-01', description: 'בקר WiFi חכם', color: 'לבן', category: 'בקרים', cbm: 0.003, technicalDetails: 'ESP32, 4 ערוצים, 2.4GHz WiFi', quantity: 1500, unitPrice: 8.90, currency: 'USD', statusBreakdown: { production: 500, ready: 1000, transit: 0, received: 0 }, createdAt: '2025-01-10', statusTransitions: [{ from: 'production', to: 'ready', date: '2025-02-05' }], estimatedProductionDays: 26, estimatedShippingDays: 60, shippingCostPerUnit: 0, jobNumber: '', estimatedArrival: '', prepaidAmount: 1000, prepaidDate: '2025-01-12', prepaidNote: 'העברה בנקאית' },
    ],
  },
  {
    id: 'po-3', poNumber: 'PO-2025-003', supplier: 'Guangzhou Power Systems', date: '2025-02-01', notes: '',
    items: [
      { id: 'li-6', sku: 'DRV-12V-100W', description: 'ספק כוח 12V 100W', color: 'שחור', category: 'ספקי כוח', cbm: 0.006, technicalDetails: 'Mean Well LPV-100-12, IP67', quantity: 600, unitPrice: 9.20, currency: 'USD', statusBreakdown: { production: 200, ready: 400, transit: 0, received: 0 }, createdAt: '2025-02-01', statusTransitions: [{ from: 'production', to: 'ready', date: '2025-02-20' }], estimatedProductionDays: 19, estimatedShippingDays: 60, shippingCostPerUnit: 0, jobNumber: '', estimatedArrival: '', prepaidAmount: 0, prepaidDate: '', prepaidNote: '' },
    ],
  },
];

export const MOCK_CONTAINERS: Container[] = [
  { id: 'cnt-1', containerNumber: 'MSCU-2025-0142', supplier: 'Shenzhen Bright Electronics', shippingCost: 3200, departureDate: '2025-01-22', arrivalDate: '2025-02-18', status: 'arrived', items: [{ poId: 'po-1', lineItemId: 'li-1', quantity: 1500 }, { poId: 'po-1', lineItemId: 'li-2', quantity: 1000 }, { poId: 'po-1', lineItemId: 'li-3', quantity: 300 }] },
  { id: 'cnt-2', containerNumber: 'COSU-2025-0298', supplier: 'Shenzhen Bright Electronics', shippingCost: 2800, departureDate: '2025-03-01', arrivalDate: '', status: 'loading', items: [{ poId: 'po-2', lineItemId: 'li-5', quantity: 1000 }] },
];

export const MOCK_SALES: SalesRow[] = [
  { sku: 'LED-5050-WW', name: 'רצועת LED לבן חם 5050', salesAmount: 310, salesPeriod: 'week', currentStock: 1200 },
  { sku: 'LED-2835-CW', name: 'רצועת LED לבן קר 2835', salesAmount: 196, salesPeriod: 'week', currentStock: 800 },
  { sku: 'DRV-24V-150W', name: 'ספק כוח 24V 150W', salesAmount: 56, salesPeriod: 'week', currentStock: 350 },
  { sku: 'LED-5050-RGB', name: 'רצועת LED RGB 5050', salesAmount: 245, salesPeriod: 'week', currentStock: 150 },
  { sku: 'CTRL-WIFI-01', name: 'בקר WiFi חכם', salesAmount: 105, salesPeriod: 'week', currentStock: 420 },
  { sku: 'DRV-12V-100W', name: 'ספק כוח 12V 100W', salesAmount: 42, salesPeriod: 'week', currentStock: 180 },
];

/** Convert any sales period to daily rate */
export function toDailySales(row: SalesRow): number {
  switch (row.salesPeriod) {
    case 'day': return row.salesAmount;
    case 'week': return row.salesAmount / 7;
    case 'month': return row.salesAmount / 30;
  }
}

export function generateAlerts(salesData: SalesRow[], pos: PurchaseOrder[], safetyDays = 30): AIAlert[] {
  const alerts: AIAlert[] = [];

  for (const product of salesData) {
    const dailySales = toDailySales(product);
    if (dailySales <= 0) continue;

    let estProductionDays = 30;
    let estShippingDays = 60;
    for (const po of pos) {
      for (const item of po.items) {
        if (item.sku === product.sku) {
          estProductionDays = item.estimatedProductionDays;
          estShippingDays = item.estimatedShippingDays;
          break;
        }
      }
    }

    const totalLeadDays = estProductionDays + estShippingDays;

    let inProduction = 0, inReady = 0, inTransit = 0;
    for (const po of pos) {
      for (const item of po.items) {
        if (item.sku === product.sku) {
          inProduction += item.statusBreakdown.production;
          inReady += item.statusBreakdown.ready;
          inTransit += item.statusBreakdown.transit;
        }
      }
    }

    const daysOfStock = Math.floor(product.currentStock / dailySales);
    const effectiveIncoming = inTransit + inReady + inProduction;
    const alertThresholdDays = estShippingDays;

    if (daysOfStock <= 7) {
      const neededQty = Math.ceil(dailySales * (totalLeadDays + safetyDays));
      alerts.push({
        id: `alert-${product.sku}-critical`, severity: 'red',
        title: `מלאי קריטי: ${product.name}`,
        message: `נותרו ${daysOfStock} ימי מלאי (${product.currentStock} יח׳). מכירה יומית: ${Math.round(dailySales)} יח׳. זמן אספקה: ${totalLeadDays} ימים (ייצור ${estProductionDays} + הפלגה ${estShippingDays}). ${effectiveIncoming > 0 ? `${effectiveIncoming} יח׳ בצנרת. ` : ''}יש להזמין ${neededQty} יח׳ מיידית.`,
        sku: product.sku, actionLabel: 'הזמן עכשיו', daysUntilStockout: daysOfStock, recommendedQty: neededQty,
      });
    } else if (daysOfStock <= alertThresholdDays) {
      const neededQty = Math.ceil(dailySales * (totalLeadDays + safetyDays)) - effectiveIncoming;
      alerts.push({
        id: `alert-${product.sku}-warning`, severity: 'yellow',
        title: `יש להזמין: ${product.name}`,
        message: `${daysOfStock} ימי מלאי, זמן אספקה ${totalLeadDays} ימים. ${effectiveIncoming > 0 ? `${effectiveIncoming} יח׳ בצנרת (ייצור: ${inProduction}, מוכן: ${inReady}, בים: ${inTransit}). ` : ''}מומלץ להזמין ${Math.max(0, neededQty)} יח׳.`,
        sku: product.sku, actionLabel: 'צור הזמנה', daysUntilStockout: daysOfStock, recommendedQty: Math.max(0, neededQty),
      });
    } else {
      alerts.push({
        id: `alert-${product.sku}-ok`, severity: 'green',
        title: `מלאי תקין: ${product.name}`,
        message: `${daysOfStock} ימי מלאי. ${effectiveIncoming > 0 ? `${effectiveIncoming} יח׳ בצנרת.` : ''} אין צורך בפעולה כרגע.`,
        sku: product.sku, daysUntilStockout: daysOfStock,
      });
    }
  }

  return alerts.sort((a, b) => {
    const order = { red: 0, yellow: 1, green: 2 };
    return order[a.severity] - order[b.severity];
  });
}
