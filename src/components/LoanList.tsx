import { Plus, User, IndianRupee, Percent, Calendar, Briefcase, Search, Filter, MoreHorizontal, ArrowUpRight, ShieldAlert, AlertCircle } from 'lucide-react';
import React, { useState } from 'react';
import type { Loan, AppUser, Transaction } from '../types';
import { isLoanOverdue } from '../lib/loanUtils';
import NewLoanModal from './NewLoanModal';

interface LoanListProps {
  loans: Loan[];
  transactions: Transaction[];
  appUser: AppUser | null;
  onAddLoan: (data: Omit<Loan, 'id' | 'userId' | 'currentPrincipal' | 'status'>) => Promise<void>;
  onLoanClick: (loan: Loan) => void;
}

export default function LoanList({ loans, transactions, appUser, onAddLoan, onLoanClick }: LoanListProps) {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'month' | 'year' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  const filteredLoans = loans.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    
    let matchesDate = true;
    const loanDate = new Date(l.startDate);
    const now = new Date();
    
    if (dateFilter === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(now.getMonth() - 1);
      matchesDate = loanDate >= oneMonthAgo;
    } else if (dateFilter === 'year') {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      matchesDate = loanDate >= oneYearAgo;
    } else if (dateFilter === 'custom') {
      if (customStartDate) {
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && loanDate >= start;
      }
      if (customEndDate) {
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && loanDate <= end;
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-serif text-natural-ink italic">Loan Portfolio</h1>
          <p className="text-natural-muted text-sm mt-1 italic">Manage and track individual asset performance.</p>
        </div>
          <button
            onClick={() => setShowModal(true)}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-natural-accent text-white px-8 py-4 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-natural-accent/10 uppercase text-[10px] tracking-widest"
          >
            <Plus className="w-4 h-4" />
            <span>New Application</span>
          </button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex-1 bg-white border border-natural-border rounded-xl px-4 flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-4 transition-all overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-natural-accent/10">
          <div className="flex items-center gap-4 flex-1 py-1 md:py-0">
            <Search className="w-4 h-4 text-natural-muted shrink-0" />
            <input 
              type="text"
              placeholder="Search by borrower entity..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-4 bg-transparent text-sm focus:outline-none text-natural-ink placeholder:italic placeholder:text-natural-muted/50"
            />
          </div>
          
          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-natural-border py-3 md:py-0 md:pl-5">
            <div className="flex items-center gap-2 text-natural-muted min-w-fit">
               <Filter className="w-4 h-4" />
               <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent text-[10px] font-bold uppercase tracking-widest focus:outline-none cursor-pointer pr-4"
               >
                 <option value="all">Status: All</option>
                 <option value="active">Status: Active</option>
                 <option value="closed">Status: Closed</option>
               </select>
            </div>
            <div className="flex items-center gap-2 border-l border-natural-border pl-4 md:pl-5 text-natural-muted min-w-fit">
               <Calendar className="w-4 h-4" />
               <select 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="bg-transparent text-[10px] font-bold uppercase tracking-widest focus:outline-none cursor-pointer pr-4"
               >
                 <option value="all">Date: All Time</option>
                 <option value="month">Date: Last Month</option>
                 <option value="year">Date: Last Year</option>
                 <option value="custom">Date: Custom Range</option>
               </select>
            </div>
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div className="flex items-center gap-4 bg-natural-sidebar/30 p-4 rounded-xl border border-natural-border animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3 flex-1 lg:flex-none">
              <span className="text-[10px] font-bold text-natural-muted uppercase tracking-widest">From</span>
              <input 
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-natural-border rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-natural-accent/10"
              />
            </div>
            <div className="flex items-center gap-3 flex-1 lg:flex-none">
              <span className="text-[10px] font-bold text-natural-muted uppercase tracking-widest">To</span>
              <input 
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-natural-border rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-natural-accent/10"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button 
                onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                className="text-[10px] font-bold text-natural-error uppercase tracking-widest hover:underline ml-auto"
              >
                Clear Range
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredLoans.map((loan) => (
          <div
            key={loan.id}
            onClick={() => onLoanClick(loan)}
            className={`group bg-white border border-natural-border rounded-xl p-8 hover:border-natural-accent hover:shadow-xl hover:shadow-natural-accent/5 transition-all cursor-pointer relative overflow-hidden flex flex-col h-full ${loan.status === 'closed' ? 'opacity-70 grayscale-[0.2]' : ''}`}
          >
            <div className="relative">
              <div className="flex justify-between items-start mb-8">
                <div className="p-3 bg-natural-sidebar rounded-lg text-natural-accent border border-natural-border transition-colors">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-current ${loan.status === 'active' ? 'bg-natural-success/5 text-natural-success border-natural-success/20' : 'bg-natural-sidebar text-natural-muted border-natural-border'}`}>
                  {loan.status}
                </div>
              </div>

              <h3 className="text-xl font-serif font-bold italic text-natural-ink group-hover:text-natural-accent transition-colors flex items-center gap-2">
                {loan.name}
                {isLoanOverdue(loan, transactions) && (
                  <AlertCircle className="w-4 h-4 text-natural-error animate-pulse" />
                )}
              </h3>
              <p className="text-[10px] text-natural-muted font-bold uppercase tracking-widest mt-1">Issued {new Date(loan.startDate).toLocaleDateString()}</p>

              <div className="mt-8 space-y-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] text-natural-muted font-bold uppercase tracking-widest">Outstanding Base</span>
                  <span className="text-xl font-bold text-natural-accent font-mono">₹{loan.currentPrincipal.toLocaleString('en-IN')}</span>
                </div>
                <div className="w-full h-1 bg-natural-sidebar rounded-full overflow-hidden border border-natural-border/20">
                   <div 
                    className="h-full bg-natural-success rounded-full transition-all duration-1000"
                    style={{ width: `${(loan.currentPrincipal / loan.initialPrincipal) * 100}%` }}
                   ></div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-natural-border flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-natural-success font-bold text-sm bg-natural-success/5 px-2 py-1 rounded border border-natural-success/10">
                  <Percent className="w-3.5 h-3.5" />
                  <span>{loan.interestRate} / {loan.paymentFrequency === 'weekly' ? 'WK' : 'MO'}</span>
                </div>
                <div className="flex items-center gap-1 text-natural-muted text-[10px] font-bold uppercase tracking-widest group-hover:text-natural-accent transition-colors">
                  Analyze
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <NewLoanModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        onAddLoan={onAddLoan} 
      />
    </div>
  );
}
