import { Loan, Transaction } from '../types';

/**
 * Standardized key for identifying a specific payment cycle.
 */
export function getCycleKey(date: Date, frequency: 'weekly' | 'monthly'): string {
  const y = date.getFullYear();
  if (frequency === 'monthly') {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  } else {
    // Get ISO week number
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }
}

export function isLoanOverdue(loan: Loan, transactions: Transaction[]): boolean {
  return calculateLoanOverdueInfo(loan, transactions).isOverdue;
}

export interface OverdueInfo {
  isOverdue: boolean;
  overdueCount: number;
  pendingInterest: number;
  missedInstallments: { cycleKey: string; amount: number; dueDate: string }[];
}

export function calculateLoanOverdueInfo(loan: Loan, transactions: Transaction[]): OverdueInfo {
  const info: OverdueInfo = {
    isOverdue: false,
    overdueCount: 0,
    pendingInterest: 0,
    missedInstallments: []
  };

  if (loan.status !== 'active') return info;

  const startDate = new Date(loan.startDate);
  const now = new Date();
  
  const frequency = loan.paymentFrequency || 'monthly';
  let cyclesPassed = 0;

  if (frequency === 'monthly') {
    cyclesPassed = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
    if (now.getDate() < startDate.getDate()) {
      cyclesPassed--;
    }
  } else {
    // Weekly
    const diffTime = Math.max(0, now.getTime() - startDate.getTime());
    cyclesPassed = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
  }

  for (let i = 1; i <= cyclesPassed; i++) {
    let checkDate: Date;
    if (frequency === 'monthly') {
      checkDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, startDate.getDate());
    } else {
      checkDate = new Date(startDate.getTime() + (i * 7 * 24 * 60 * 60 * 1000));
    }
    
    const cycleKey = getCycleKey(checkDate, frequency);
    
    const isPaid = transactions.some(
      t => t.loanId === loan.id && t.type === 'interest' && t.cycleKey === cycleKey
    );
    
    if (!isPaid) {
      info.isOverdue = true;
      info.overdueCount++;
      // Interest is calculated based on current principal for the overdue installments 
      // (Simple calculation based on cycle)
      const interestAmt = (loan.currentPrincipal * (loan.interestRate / 100));
      info.pendingInterest += interestAmt;
      
      info.missedInstallments.push({
        cycleKey,
        amount: interestAmt,
        dueDate: checkDate.toISOString()
      });
    }
  }

  return info;
}
