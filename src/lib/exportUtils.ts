import * as XLSX from 'xlsx';
import { MonthlyEntry, UserProfile } from '../types';

export function exportPlanToExcel(profile: UserProfile, entries: MonthlyEntry[]) {
  const data = entries.map(entry => ({
    Month: entry.month,
    Year: entry.year,
    'Planned Salary': entry.plannedSalary,
    'Planned Uber': entry.plannedUber,
    'Actual Salary': entry.actualSalary,
    'Actual Uber': entry.actualUber,
    'Total Income': entry.actualSalary + entry.actualUber,
    'Expenses Count': entry.expenses?.length || 0,
    'Total Expenses': entry.expenses?.reduce((sum, e) => sum + e.amount, 0) || 0,
    Savings: (entry.actualSalary + entry.actualUber) - (entry.expenses?.reduce((sum, e) => sum + e.amount, 0) || 0),
    'Notes': entry.notes
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Savings Plan');

  // Summary Sheet
  const summary = [
    ['User Name', profile.userName],
    ['Start Date', profile.startDate],
    ['End Date', profile.endDate],
    ['Target Cash', profile.targetCash],
    ['Target Gold', profile.targetGold],
    ['Emergency Fund', profile.emergencyFund],
    ['Gold Price used', profile.goldPrice]
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Profile Summary');

  XLSX.writeFile(workbook, `Eanany_Savings_Plan_${profile.userName}.xlsx`);
}
