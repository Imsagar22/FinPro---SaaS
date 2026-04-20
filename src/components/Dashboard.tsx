import { IndianRupee, TrendingUp, AlertCircle, Calendar, ChevronRight, EyeOff, Receipt, Plus } from 'lucide-react';
import React, { useState } from 'react';
import { motion } from 'motion/react';
import type { Loan, Transaction, DashboardStats, AppUser } from '../types';
import { hasPermission } from '../lib/permissions';
import NewLoanModal from './NewLoanModal';
import AIAnalyst from './AIAnalyst';

interface DashboardProps {
  stats: DashboardStats;
  activeLoans: Loan[];
  transactions: Transaction[];
  appUser: AppUser | null;
  onLoanClick: (loan: Loan) => void;
  onAddLoan: (data: Omit<Loan, 'id' | 'userId' | 'currentPrincipal' | 'status'>) => Promise<void>;
  onStatsClick?: (label: string) => void;
}

export default function Dashboard({ stats, activeLoans, transactions, appUser, onLoanClick, onAddLoan, onStatsClick }: DashboardProps) {
  const [showModal, setShowModal] = useState(false);
  const isPrivileged = hasPermission(appUser, 'MANAGE_LOANS'); // Using MANAGE_LOANS for sensitive stats (Admin/Manager)

  const sortedLoans = [...activeLoans].sort((a, b) => 
    new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  const cards = [
    { 
      label: 'Total Capital Out', 
      value: !isPrivileged ? 'RESTRICTED' : stats.totalCapitalOut, 
      icon: IndianRupee, 
      color: 'natural-success', 
      trend: `${activeLoans.length} Active Accounts` 
    },
    { 
      label: 'Total Interest Earned', 
      value: !isPrivileged ? 'RESTRICTED' : stats.totalInterestEarned, 
      icon: TrendingUp, 
      color: 'natural-accent', 
      trend: 'Lifetime Profit' 
    },
    { 
      label: 'Overdue Alerts', 
      value: stats.overdueCount, 
      icon: AlertCircle, 
      color: stats.overdueCount > 0 ? 'natural-error' : 'natural-muted', 
      trend: 'Needs Attention' 
    },
    { 
      label: 'Pending Interest', 
      value: !isPrivileged ? 'RESTRICTED' : stats.totalPendingInterest, 
      icon: Receipt, 
      color: stats.totalPendingInterest > 0 ? 'natural-accent' : 'natural-muted', 
      trend: 'Receivable Dues' 
    },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="header-info">
          <h1 className="text-3xl font-serif text-natural-ink italic">Portfolio Overview</h1>
          <p className="text-natural-muted text-sm mt-1 italic">Interest recalculation engine active &bull; Logic: Declining Balance</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 px-4 py-2 bg-natural-sidebar border border-natural-border rounded-lg text-xs font-bold uppercase tracking-widest text-natural-accent w-full sm:w-auto justify-center">
             <Calendar className="w-4 h-4" />
             <span>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          </div>
          {isPrivileged && (
            <button
              onClick={() => setShowModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-natural-accent text-white px-6 py-2.5 rounded-lg font-bold hover:opacity-90 transition-all shadow-lg shadow-natural-accent/10 uppercase text-[10px] tracking-widest"
            >
              <Plus className="w-4 h-4" />
              <span>New Application</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={onStatsClick ? { scale: 1.02, y: -4 } : {}}
            whileTap={onStatsClick ? { scale: 0.98 } : {}}
            transition={{ delay: idx * 0.1 }}
            onClick={() => onStatsClick?.(card.label)}
            className={`p-6 bg-white border rounded-xl shadow-sm transition-all relative group/card ${onStatsClick ? 'cursor-pointer hover:shadow-lg hover:border-natural-accent/30' : ''} ${card.label === 'Overdue Alerts' && stats.overdueCount > 0 ? 'border-natural-error/30 bg-natural-error/[0.01]' : 'border-natural-border'}`}
          >
            {onStatsClick && (
              <div className="absolute top-4 right-4 opacity-0 group-hover/card:opacity-100 transition-opacity">
                <ChevronRight className={`w-3 h-3 ${card.label === 'Overdue Alerts' && stats.overdueCount > 0 ? 'text-natural-error' : 'text-natural-accent'}`} />
              </div>
            )}
            <div className="flex flex-col gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-natural-sidebar text-natural-accent border border-natural-border/50`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-natural-muted">{card.label}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-2xl font-serif text-natural-accent">
                    {card.value === 'RESTRICTED' ? (
                      <span className="flex items-center gap-2 text-natural-muted/40 italic text-base font-sans">
                        <EyeOff className="w-4 h-4" />
                        Confidential
                      </span>
                    ) : (
                      card.label === 'Overdue Alerts' ? String(card.value).padStart(2, '0') : `₹${(card.value as number).toLocaleString('en-IN')}`
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className={`mt-4 pt-4 border-t border-natural-border/30 flex items-center justify-between text-[11px] font-medium ${card.label === 'Overdue Alerts' && stats.overdueCount > 0 ? 'text-natural-error' : 'text-natural-muted'}`}>
              <span className="italic">{card.trend}</span>
              {card.label === 'Total Capital Out' && <span className="text-natural-success font-bold">+12% vs LY</span>}
            </div>
          </motion.div>
        ))}
      </div>

      <AIAnalyst 
        loans={activeLoans} 
        transactions={transactions} 
        stats={stats} 
      />

      <div className="content-box bg-white border border-natural-border rounded-xl flex flex-col overflow-hidden shadow-sm">
        <div className="box-header px-6 py-4 border-b border-natural-border bg-natural-sidebar/30 flex justify-between items-center">
          <h2 className="box-title text-sm font-serif font-bold italic text-natural-ink">Active Borrower Assets</h2>
          <div className="px-2 py-0.5 bg-natural-sidebar text-natural-accent border border-natural-border rounded text-[10px] font-bold uppercase tracking-widest">
            {activeLoans.length} accounts / Current Exposure
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-[13px]">
            <thead>
              <tr className="bg-natural-sidebar/20 text-natural-muted text-[11px] font-bold uppercase tracking-wider border-b border-natural-border">
                <th className="px-6 py-4">Borrower Entity</th>
                <th className="hidden md:table-cell px-6 py-4">Principal Base</th>
                <th className="px-6 py-4 text-right md:text-left">Current Bal.</th>
                <th className="hidden sm:table-cell px-6 py-4 text-center">APY Context</th>
                <th className="px-6 py-4 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-natural-border/50">
              {sortedLoans.length === 0 ? (
                <tr>
                   <td colSpan={5} className="px-6 py-12 text-center text-natural-muted italic">No active loans found. System ready for disbursement.</td>
                </tr>
              ) : sortedLoans.map((loan) => (
                <tr key={loan.id} className="hover:bg-natural-sidebar/10 transition-colors cursor-pointer group" onClick={() => onLoanClick(loan)}>
                  <td className="px-6 py-4">
                    <div className="font-bold text-natural-ink">{loan.name}</div>
                    <div className="text-[10px] text-natural-muted font-medium italic">Original: ₹{loan.initialPrincipal.toLocaleString('en-IN')}</div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 font-mono text-xs text-natural-muted">₹{loan.initialPrincipal.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-right md:text-left">
                    <div className="font-bold text-natural-accent font-mono text-sm">₹{loan.currentPrincipal.toLocaleString('en-IN')}</div>
                    <div className="hidden md:block w-32 h-1 bg-natural-border/50 rounded-full mt-1.5 overflow-hidden mx-auto md:mx-0">
                       <div 
                        className="h-full bg-natural-success rounded-full transition-all duration-1000" 
                        style={{ width: `${Math.min(100, (loan.currentPrincipal / loan.initialPrincipal) * 100)}%` }}
                       ></div>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4 text-center">
                    <span className="px-2 py-0.5 bg-natural-success/10 text-natural-success border border-natural-success/20 rounded font-bold">{loan.interestRate}%</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-natural-muted group-hover:text-natural-accent transition-colors">
                       <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <NewLoanModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        onAddLoan={onAddLoan} 
      />
    </div>
  );
}
