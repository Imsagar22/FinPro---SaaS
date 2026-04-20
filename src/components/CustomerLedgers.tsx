import React, { useState, useMemo } from 'react';
import { Landmark, ArrowUpRight, ArrowDownRight, IndianRupee, PieChart, MoreHorizontal, ChevronRight, Calculator, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import type { Loan, Transaction, AppUser } from '../types';

interface CustomerLedgersProps {
  loans: Loan[];
  transactions: Transaction[];
  appUser: AppUser | null;
  onLoanClick: (loan: Loan) => void;
}

export default function CustomerLedgers({ loans, transactions, appUser, onLoanClick }: CustomerLedgersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const canViewLedgers = true;

  const customerAggregates = useMemo(() => {
    return loans.map((loan) => {
      const loanTx = transactions.filter(tx => tx.loanId === loan.id);
      const totalPrincipalRepaid = loanTx
        .filter(tx => tx.type === 'principal')
        .reduce((sum, tx) => sum + tx.amount, 0);
      const totalInterestSettled = loanTx
        .filter(tx => tx.type === 'interest')
        .reduce((sum, tx) => sum + tx.amount, 0);
      return {
        ...loan,
        totalPrincipalRepaid,
        totalInterestSettled,
        repaymentPercentage: (totalPrincipalRepaid / loan.initialPrincipal) * 100
      };
    }).filter(customer => customer.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [loans, transactions, searchTerm]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-natural-ink">Customer Account Ledgers</h1>
          <p className="text-natural-muted text-sm mt-1 italic">Consolidated reporting on all client asset accounts.</p>
        </div>
        {!canViewLedgers ? null : (
          <div className="flex items-center gap-3 bg-white border border-natural-border rounded-xl px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-natural-accent/10 transition-all w-full md:min-w-[300px] md:w-auto">
            <IndianRupee className="w-4 h-4 text-natural-muted shrink-0" />
            <input 
              type="text"
              placeholder="Search account name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-sm focus:outline-none text-natural-ink placeholder:italic placeholder:text-natural-muted/50"
            />
          </div>
        )}
      </div>

      {!canViewLedgers ? (
        <div className="h-auto md:h-[400px] flex items-center justify-center bg-white border border-natural-border rounded-2xl shadow-sm p-10">
           <div className="max-w-xs text-center space-y-4">
              <div className="w-16 h-16 bg-natural-error/10 text-natural-error rounded-full flex items-center justify-center mx-auto border border-natural-error/20">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-serif text-natural-ink italic">Access Restricted</h2>
              <p className="text-sm text-natural-muted font-bold uppercase tracking-widest bg-natural-sidebar py-2 rounded">Clearance Level Insufficient</p>
              <p className="text-xs text-natural-muted italic leading-relaxed font-serif">You do not have the required administrative credentials to view high-priority customer ledgers.</p>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {customerAggregates.length === 0 ? (
            <div className="py-24 text-center bg-white border border-natural-border rounded-2xl">
               <Calculator className="w-12 h-12 text-natural-border mx-auto mb-4" />
               <p className="text-natural-muted italic font-serif">Asset repository shows no active client ledgers.</p>
            </div>
          ) : customerAggregates.map((customer, idx) => (
            <motion.div
              key={customer.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onLoanClick(customer)}
              className="group flex flex-col lg:flex-row bg-white border border-natural-border rounded-2xl hover:border-natural-accent hover:shadow-xl hover:shadow-natural-accent/5 transition-all p-8 cursor-pointer relative overflow-hidden"
            >
              <div className="flex-1 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                  <div className="p-3 bg-natural-sidebar text-natural-accent rounded-xl border border-natural-border transition-colors self-start">
                    <Landmark className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-serif text-natural-ink italic font-bold group-hover:text-natural-accent transition-colors">{customer.name}</h3>
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${customer.status === 'active' ? 'bg-natural-success/10 text-natural-success border-natural-success/20' : 'bg-natural-error/10 text-natural-error border-natural-error/20'}`}>
                        {customer.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-natural-muted font-bold uppercase tracking-widest">Origin: {new Date(customer.startDate).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                  <div>
                    <span className="text-[10px] font-bold text-natural-muted uppercase tracking-widest">Initial Asset Value</span>
                    <p className="font-mono text-lg font-bold text-natural-ink mt-1">₹{customer.initialPrincipal.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-natural-muted uppercase tracking-widest">Currently At Peak</span>
                    <p className="font-mono text-lg font-bold text-natural-accent mt-1">₹{customer.currentPrincipal.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                <div className="max-w-md mt-6">
                  <div className="flex justify-between text-[13px] font-medium text-natural-muted mb-2 italic">
                    <span>Repayment Strategy Status</span>
                    <span>{customer.repaymentPercentage.toFixed(1)}% Completed</span>
                  </div>
                  <div className="w-full h-1.5 bg-natural-sidebar rounded-full overflow-hidden border border-natural-border">
                    <div 
                      className="h-full bg-natural-success rounded-full transition-all duration-1000"
                      style={{ width: `${customer.repaymentPercentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="mt-8 lg:mt-0 lg:pl-10 lg:border-l border-natural-border flex flex-col justify-center space-y-6 lg:min-w-[280px]">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-natural-muted uppercase tracking-widest">Principal Returned</span>
                    <div className="flex items-center gap-2 text-natural-success font-bold font-mono">
                      <ArrowDownRight className="w-4 h-4" />
                      <span>₹{customer.totalPrincipalRepaid.toLocaleString('en-IN')}</span>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-natural-muted uppercase tracking-widest">Interest Accrued & Settled</span>
                    <div className="flex items-center gap-2 text-natural-accent font-bold font-mono">
                      <PieChart className="w-4 h-4" />
                      <span>₹{customer.totalInterestSettled.toLocaleString('en-IN')}</span>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-natural-muted uppercase tracking-widest">Growth Premium</span>
                    <div className="flex items-center gap-2 text-natural-accent font-bold">
                      <span>{customer.interestRate}% {customer.paymentFrequency === 'weekly' ? 'Weekly' : 'Monthly'}</span>
                    </div>
                </div>
                
                <div className="flex items-center justify-end gap-2 text-natural-muted text-[10px] font-bold uppercase tracking-widest group-hover:text-natural-accent transition-colors pt-2">
                    Full Ledger Detail
                    <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
