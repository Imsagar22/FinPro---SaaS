export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  TENANT_ADMIN = 'TENANT_ADMIN',
  STANDARD_USER = 'STANDARD_USER'
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  createdAt?: string; // ISO String
}

export interface Loan {
  id: string;
  name: string;
  initialPrincipal: number;
  currentPrincipal: number;
  interestRate: number;
  paymentFrequency: 'weekly' | 'monthly';
  startDate: string; // ISO String
  userId: string;
  status: 'active' | 'closed';
}

export interface Transaction {
  id: string;
  loanId: string;
  type: 'interest' | 'principal';
  amount: number;
  date: string; // ISO String
  userId: string;
  cycleKey?: string; // e.g., "2024-W12" for week or "2024-03" for month
}

export interface DashboardStats {
  totalCapitalOut: number;
  totalInterestEarned: number;
  overdueCount: number;
  totalPendingInterest: number;
}
