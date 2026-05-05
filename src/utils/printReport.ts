import type { PurchaseOrder, SalesRow } from '../types';
import { toDailySales } from '../store';

export function printInventoryReport(salesData: SalesRow[], pos: PurchaseOrder[]) {
  const allItems = pos.flatMap(po => po.items);

  const rows = salesData.map(row => {
    const daily = toDailySales(row);
    const daysOfStock = daily > 0 ? Math.floor(row.currentStock / daily) : 999;
    const inPipeline = allItems
      .filter(i => i.sku === row.sku)
      .reduce((s, i) => s + i.statusBreakdown.production + i.statusBreakdown.ready + i.statusBreakdown.transit, 0);
    return { ...row, daily: Math.round(daily), daysOfStock, inPipeline };
  });

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <title>דוח מלאי — KALPACK STORAGE</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; color: #1a1a1a; direction: rtl; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f0f0f0; padding: 10px 12px; text-align: right; font-weight: 600; border-bottom: 2px solid #ddd; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; }
    tr:hover { background: #fafafa; }
    .critical { color: #dc2626; font-weight: bold; }
    .warning { color: #d97706; font-weight: bold; }
    .ok { color: #16a34a; }
    .footer { margin-top: 24px; font-size: 11px; color: #999; text-align: center; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>📊 דוח מלאי — KALPACK STORAGE</h1>
  <p class="subtitle">תאריך: ${new Date().toLocaleDateString('he-IL')} • ${rows.length} מוצרים</p>
  <table>
    <thead>
      <tr>
        <th>מק״ט</th>
        <th>שם מוצר</th>
        <th>מלאי נוכחי</th>
        <th>מכירה יומית</th>
        <th>ימי מלאי</th>
        <th>בצנרת</th>
        <th>סטטוס</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td><strong>${r.sku}</strong></td>
          <td>${r.name}</td>
          <td>${r.currentStock.toLocaleString()}</td>
          <td>${r.daily}</td>
          <td class="${r.daysOfStock <= 7 ? 'critical' : r.daysOfStock <= 30 ? 'warning' : 'ok'}">${r.daysOfStock}</td>
          <td>${r.inPipeline.toLocaleString()}</td>
          <td class="${r.daysOfStock <= 7 ? 'critical' : r.daysOfStock <= 30 ? 'warning' : 'ok'}">
            ${r.daysOfStock <= 7 ? '🔴 קריטי' : r.daysOfStock <= 30 ? '🟡 אזהרה' : '🟢 תקין'}
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <p class="footer">הופק אוטומטית על ידי KALPACK STORAGE • ${new Date().toLocaleString('he-IL')}</p>
  <script>window.print();</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

export function printPOReport(pos: PurchaseOrder[]) {
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <title>דוח הזמנות רכש — KALPACK STORAGE</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; color: #1a1a1a; direction: rtl; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
    .po-card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .po-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .po-number { font-size: 18px; font-weight: bold; }
    .po-supplier { color: #666; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f8f8f8; padding: 8px 10px; text-align: right; font-weight: 600; border-bottom: 1px solid #ddd; }
    td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; }
    .status-bar { display: flex; gap: 8px; font-size: 11px; margin-top: 2px; }
    .status-bar span { padding: 2px 6px; border-radius: 4px; }
    .footer { margin-top: 24px; font-size: 11px; color: #999; text-align: center; }
    @media print { body { padding: 20px; } .po-card { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <h1>📋 דוח הזמנות רכש — KALPACK STORAGE</h1>
  <p class="subtitle">תאריך: ${new Date().toLocaleDateString('he-IL')} • ${pos.length} הזמנות</p>
  ${pos.map(po => `
    <div class="po-card">
      <div class="po-header">
        <div>
          <div class="po-number">${po.poNumber}</div>
          <div class="po-supplier">${po.supplier} • ${po.date}</div>
        </div>
        <div style="text-align:left">
          <div style="font-weight:bold">$${po.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toLocaleString()}</div>
          <div style="color:#666;font-size:12px">${po.items.length} פריטים</div>
        </div>
      </div>
      <table>
        <thead><tr><th>מק״ט</th><th>תיאור</th><th>כמות</th><th>מחיר</th><th>בייצור</th><th>מוכן</th><th>בים</th><th>נכנס</th></tr></thead>
        <tbody>
          ${po.items.map(item => `
            <tr>
              <td><strong>${item.sku}</strong></td>
              <td>${item.description}</td>
              <td>${item.quantity.toLocaleString()}</td>
              <td>$${item.unitPrice}</td>
              <td style="color:#8b5cf6">${item.statusBreakdown.production}</td>
              <td style="color:#0ea5e9">${item.statusBreakdown.ready}</td>
              <td style="color:#f59e0b">${item.statusBreakdown.transit}</td>
              <td style="color:#10b981">${item.statusBreakdown.received}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${po.notes ? `<p style="margin-top:8px;font-size:12px;color:#666">הערות: ${po.notes}</p>` : ''}
    </div>
  `).join('')}
  <p class="footer">הופק אוטומטית על ידי KALPACK STORAGE • ${new Date().toLocaleString('he-IL')}</p>
  <script>window.print();</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
