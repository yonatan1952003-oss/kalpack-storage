import * as XLSX from 'xlsx';

/** Download Excel file using Blob — works in VSCode webview and real browsers */
export function downloadExcel(wb: XLSX.WorkBook, filename: string) {
  const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  // Convert workbook to array buffer, then Blob
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbOut], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}
