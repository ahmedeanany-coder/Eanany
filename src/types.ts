export interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  category: string;
}

export interface GoldTransaction {
  id: string;
  date: string;
  weight: number;
  pricePerUnit: number;
  notes?: string;
}

export interface MonthlyEntry {
  id: string; // year-month
  year: number;
  month: string;
  plannedSalary: number;
  plannedUber: number;
  actualSalary: number;
  actualUber: number;
  expenses: ExpenseItem[];
  notes: string;
  order: number;
  cumulativeCash?: number;
  goldWeight?: number;
  goldValue?: number;
  cumulativePlanned?: number;
  expenseChartData?: { name: string; value: number }[];
  isNow?: boolean;
}

export interface UserProfile {
  goldPrice: number;
  targetCash: number;
  targetGold: number;
  userName: string;
  emergencyFund: number;
  dailyBalance: number;
  startDate: string;
  endDate: string;
  savingsTarget?: number;
  masterPassword?: string;
  goldLogs?: GoldTransaction[];
}
