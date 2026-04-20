import { ArrowLeft, Plus, History, Calculator, CheckCircle2, XCircle, Clock, Save, IndianRupee, Wallet, AlertCircle, Receipt, Edit2, Trash2, Check, X, ShieldAlert } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Loan, Transaction, AppUser } from '../types';
import { getCycleKey } from '../lib/loanUtils';
import AssetIntelligence from './AssetIntelligence';

interface LoanDetailProps {
  loan: Loan;
  transactions: Transaction[];
  appUser: AppUser | null;
  onBack: () => void;
  onRecordTransaction: (data: Omit<Transaction, 'id' | 'userId'>) => Promise<void>;
  onUpdateTransaction: (txId: string, oldAmount: number, newAmount: number, type: 'interest' | 'principal', loanId: string) => Promise<void>;
  onDeleteTransaction: (tx: Transaction) => Promise<void>;
  onToggleStatus: (loanId: string, currentStatus: 'active' | 'closed') => Promise<void>;
  onUpdateInterestRate: (loanId: string, newRate: number) => Promise<void>;
  onDeleteLoan: (loanId: string) => Promise<void>;
}

export default function LoanDetail({ 
  loan, 
  transactions, 
  appUser,
  onBack, 
  onRecordTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onToggleStatus,
  onUpdateInterestRate,
  onDeleteLoan
}: LoanDetailProps) {
  const [activeTab, setActiveTab] = useState<'ladder' | 'history'>('ladder');
  const [repayAmount, setRepayAmount] = useState('');
  const [repayType, setRepayType] = useState<'interest' | 'principal'>('interest');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Edit State
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);

  // Rate Edit State
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState(loan.interestRate.toString());
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);

  // Permissions (Simplified - Everyone can manage their own assets)
  const canUpdateRate = true;
  const canCloseLoan = true;
  const canRecordPayments = true;
  const canDeleteRecords = true;
  const canDeleteLoan = true;

  // Delete Loan State
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeletingLoan, setIsDeletingLoan] = useState(false);

  // Transaction Confirmation State
  const [isConfirmingTransaction, setIsConfirmingTransaction] = useState(false);

  // History Filter State
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'interest' | 'principal'>('all');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  const ladder = useMemo(() => {
    const rows = [];
    const startDate = new Date(loan.startDate);
    const now = new Date();
    const frequency = loan.paymentFrequency || 'monthly';
    
    // Calculate total cycles to show based on frequency
    let cyclesSinceStart = 0;
    if (frequency === 'monthly') {
      cyclesSinceStart = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
    } else {
      const diffTime = Math.max(0, now.getTime() - startDate.getTime());
      cyclesSinceStart = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
    }

    // Show cycles since inception + 8 cycles of projections (8 weeks or 8 months)
    const cyclesToShow = Math.max(cyclesSinceStart + 8, 8);

    for (let i = 1; i <= cyclesToShow; i++) {
      let dueDate: Date;
      if (frequency === 'monthly') {
        dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, startDate.getDate());
      } else {
        dueDate = new Date(startDate.getTime() + (i * 7 * 24 * 60 * 60 * 1000));
      }
      
      const cycleKey = getCycleKey(dueDate, frequency);
      const paidTransaction = transactions.find(t => t.type === 'interest' && t.cycleKey === cycleKey);
      
      const isPast = dueDate < new Date();
      const status = paidTransaction ? 'paid' : (isPast ? 'overdue' : 'pending');
      
      // Calculate effective principal at this point in time
      const principalRepaymentsBefore = transactions
        .filter(t => t.type === 'principal' && new Date(t.date) <= dueDate)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const principalAtThisTime = Math.max(loan.initialPrincipal - principalRepaymentsBefore, 0);
      const interestAmount = principalAtThisTime * (loan.interestRate / 100);

      rows.push({
        index: i,
        dueDate,
        amount: interestAmount,
        status,
        cycleKey,
        principalUsed: principalAtThisTime
      });
    }
    return rows;
  }, [loan, transactions]);

  const sortedTransactions = useMemo(() => {
    return [...transactions]
      .filter(tx => {
        const matchesType = historyTypeFilter === 'all' || tx.type === historyTypeFilter;
        
        const txDate = new Date(tx.date);
        const matchesStart = !historyStartDate || txDate >= new Date(historyStartDate);
        const matchesEnd = !historyEndDate || txDate <= new Date(historyEndDate + 'T23:59:59');

        return matchesType && matchesStart && matchesEnd;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, historyTypeFilter, historyStartDate, historyEndDate]);

  const nextInterest = useMemo(() => {
    return ladder.find(r => r.status !== 'paid');
  }, [ladder]);

  const totalOverdueInterest = useMemo(() => {
    return ladder
      .filter(row => row.status === 'overdue')
      .reduce((sum, row) => sum + row.amount, 0);
  }, [ladder]);

  const handleRateUpdate = async () => {
    const rate = parseFloat(tempRate);
    if (isNaN(rate) || rate < 0) return;
    
    setIsUpdatingRate(true);
    try {
      await onUpdateInterestRate(loan.id, rate);
      setIsEditingRate(false);
    } finally {
      setIsUpdatingRate(false);
    }
  };

  const handleTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayAmount || isSubmitting) return;
    
    const amt = parseFloat(repayAmount);
    if (isNaN(amt) || amt <= 0) return;

    setIsConfirmingTransaction(true);
  };

  const confirmTransaction = async () => {
    setIsSubmitting(true);
    try {
      await onRecordTransaction({
        loanId: loan.id,
        type: repayType,
        amount: parseFloat(repayAmount),
        date: new Date().toISOString(),
        cycleKey: repayType === 'interest' ? ladder.find(r => r.status !== 'paid')?.cycleKey : undefined
      });
      setRepayAmount('');
      setIsConfirmingTransaction(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setEditAmount(tx.amount.toString());
  };

  const handleSaveEdit = async (tx: Transaction) => {
    const newAmt = parseFloat(editAmount);
    if (isNaN(newAmt) || newAmt < 0) return;
    
    try {
      await onUpdateTransaction(tx.id, tx.amount, newAmt, tx.type, tx.loanId);
      setEditingTxId(null);
    } catch (err) {
      console.error(`Update failed: ${String(err)}`);
    }
  };

  const handleDelete = async (tx: Transaction) => {
    try {
      await onDeleteTransaction(tx);
      setDeletingTxId(null);
    } catch (err) {
      console.error(`Deletion failed: ${String(err)}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-natural-muted hover:text-natural-accent transition-colors py-2 text-xs font-bold uppercase tracking-widest"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Portfolio</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Loan Summary & Actions */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-8 bg-white border border-natural-border rounded-xl shadow-sm">
            <h2 className="text-2xl font-serif text-natural-ink italic">{loan.name}</h2>
            <p className="text-xs font-bold text-natural-muted uppercase tracking-widest mt-2">Current Debt Position</p>
            <div className="mt-4 flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-serif text-natural-accent font-normal">₹{loan.currentPrincipal.toLocaleString('en-IN')}</span>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${loan.status === 'active' ? 'bg-natural-success/10 text-natural-success border-natural-success/20' : 'bg-natural-error/10 text-natural-error border-natural-error/20'}`}>
                  {loan.status}
                </span>
              </div>
              {canCloseLoan && (
                <button 
                  onClick={() => onToggleStatus(loan.id, loan.status)}
                  className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded transition-all border ${loan.status === 'active' ? 'text-natural-error hover:bg-natural-error/5 border-natural-error/20' : 'text-natural-success hover:bg-natural-success/5 border-natural-success/20'}`}
                >
                  {loan.status === 'active' ? 'Close Account' : 'Reactivate'}
                </button>
              )}
            </div>
            
            <div className="mt-8 space-y-4">
              {totalOverdueInterest > 0 && (
                <div className="p-5 bg-natural-error/5 border border-natural-error/20 rounded-xl mb-4 animate-pulse">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-natural-error uppercase tracking-widest flex items-center gap-2">
                       <AlertCircle className="w-3 h-3" />
                       Total Overdue Interest
                    </span>
                    <span className="text-[10px] font-serif italic text-natural-error/70">Immediate Settlement Required</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-3xl font-mono font-bold text-natural-error">₹{totalOverdueInterest.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] font-bold text-natural-error/50 uppercase tracking-widest">
                       {ladder.filter(r => r.status === 'overdue').length} Cycles Missed
                    </span>
                  </div>
                </div>
              )}

              {nextInterest && (
                <div className="p-5 bg-natural-accent/5 border border-natural-accent/20 rounded-xl mb-6">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-natural-accent uppercase tracking-widest">Next Expected Interest</span>
                    <span className="text-[10px] font-serif italic text-natural-muted">Projected</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-3xl font-mono font-bold text-natural-accent">₹{nextInterest.amount.toLocaleString('en-IN')}</span>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-natural-muted uppercase tracking-widest leading-none">{nextInterest.monthKey} Cycle</div>
                      <div className="text-[11px] text-natural-muted italic mt-1 font-serif">Due {new Date(nextInterest.dueDate).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between text-sm py-3 border-b border-dotted border-natural-border">
                <span className="text-natural-muted">Initial Capital</span>
                <span className="font-bold text-natural-ink font-mono">₹{loan.initialPrincipal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm py-3 border-b border-dotted border-natural-border items-center">
                <span className="text-natural-muted">Interest Rate</span>
                <div className="flex items-center gap-3">
                  {isEditingRate ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        step="0.1"
                        value={tempRate}
                        onChange={(e) => setTempRate(e.target.value)}
                        className="w-16 bg-natural-sidebar/30 border border-natural-border rounded px-2 py-1 text-xs font-mono font-bold focus:border-natural-accent outline-none"
                      />
                      <button 
                        onClick={handleRateUpdate}
                        disabled={isUpdatingRate}
                        className="text-natural-success hover:bg-natural-success/10 p-1 rounded transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { setIsEditingRate(false); setTempRate(loan.interestRate.toString()); }}
                        className="text-natural-error hover:bg-natural-error/10 p-1 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-bold text-natural-accent font-mono">{loan.interestRate}% / {loan.paymentFrequency === 'weekly' ? 'week' : 'month'}</span>
                      {canUpdateRate && (
                        <button 
                          onClick={() => setIsEditingRate(true)}
                          className="text-natural-muted hover:text-natural-accent transition-colors p-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="flex justify-between text-sm py-3 border-b border-dotted border-natural-border">
                <span className="text-natural-muted">Disbursement</span>
                <span className="font-bold text-natural-ink">{new Date(loan.startDate).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="p-8 bg-natural-accent text-white rounded-xl shadow-xl shadow-natural-accent/10">
            <h3 className="text-lg font-serif italic mb-6 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-natural-sidebar/50" />
              Ledger Entry
            </h3>
            {canRecordPayments ? (
              <form onSubmit={handleTransaction} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-natural-sidebar/60 uppercase tracking-widest mb-1.5 pl-1">Payment Amount (₹)</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-natural-sidebar/40" />
                    <input
                      type="number"
                      step="0.01"
                      value={repayAmount}
                      onChange={(e) => setRepayAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-black/10 border border-white/10 rounded-lg py-4 pl-10 pr-4 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="flex bg-black/10 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setRepayType('interest')}
                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${repayType === 'interest' ? 'bg-white text-natural-accent shadow-sm' : 'text-white/50 hover:text-white'}`}
                  >
                    Interest
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepayType('principal')}
                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${repayType === 'principal' ? 'bg-white text-natural-accent shadow-sm' : 'text-white/50 hover:text-white'}`}
                  >
                    Principal
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || loan.status === 'closed'}
                  className="w-full bg-white text-natural-accent font-bold py-4 rounded-lg hover:bg-natural-sidebar transition-colors shadow-lg disabled:opacity-50 uppercase text-xs tracking-widest"
                >
                  {loan.status === 'closed' ? 'Account Closed' : (isSubmitting ? 'Posting...' : 'Commit Transaction')}
                </button>
                
                <p className="text-[11px] text-white/50 text-center italic">
                  * {repayType === 'principal' ? 'Principal reduction triggers immediate interest ladder adjustment.' : (
                    <>
                      Interest settlement clears the oldest unpaid installment
                      {nextInterest && (
                        <span className="text-white font-bold ml-1">
                          ({(() => {
                            const [y, mOrW] = (nextInterest?.cycleKey || '').split('-');
                            return mOrW.startsWith('W') ? `Week ${mOrW.substring(1)}, ${y}` : new Date(parseInt(y), parseInt(mOrW) - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                          })()})
                        </span>
                      )}
                      .
                    </>
                  )}
                </p>
              </form>
            ) : (
              <div className="p-8 border border-white/20 rounded-xl bg-black/10 text-center space-y-3">
                <ShieldAlert className="w-8 h-8 mx-auto text-white/30" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Restricted Access</p>
                <p className="text-xs text-white/70 italic font-serif">You do not have authorization to post transactions to this ledger.</p>
              </div>
            )}
          </div>

          {canDeleteLoan && (
            <div className="p-6 bg-natural-error/5 border border-natural-error/20 rounded-xl space-y-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-natural-error" />
                <h4 className="text-[10px] font-bold text-natural-error uppercase tracking-widest">Dangerous Operations</h4>
              </div>
              <p className="text-[11px] text-natural-error/70 italic leading-relaxed">
                Purging this portfolio will permanently remove all transaction history and principal state. This action is irreversible.
              </p>
              
              {!isConfirmingDelete ? (
                <button
                  onClick={() => setIsConfirmingDelete(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-natural-error/30 text-natural-error hover:bg-natural-error hover:text-white transition-all rounded-lg text-[10px] font-bold uppercase tracking-widest"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Purge Asset Portfolio
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2 animate-in fade-in zoom-in-95 duration-200">
                  <button
                    onClick={() => {
                      setIsDeletingLoan(true);
                      onDeleteLoan(loan.id);
                    }}
                    disabled={isDeletingLoan}
                    className="py-3 bg-natural-error text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-natural-error/90"
                  >
                    {isDeletingLoan ? 'Purging...' : 'Confirm Purge'}
                  </button>
                  <button
                    onClick={() => setIsConfirmingDelete(false)}
                    disabled={isDeletingLoan}
                    className="py-3 bg-natural-sidebar border border-natural-border text-natural-muted rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-natural-border"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          <AssetIntelligence loan={loan} transactions={transactions} />
        </div>

        {/* Right Column: Ladder / History Tabs */}
        <div className="lg:col-span-2 space-y-6">
          {totalOverdueInterest > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-natural-error/5 border border-natural-error/20 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6"
            >
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-natural-error text-white rounded-full flex items-center justify-center shadow-lg shadow-natural-error/20 animate-pulse">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-serif italic text-natural-error font-bold leading-tight">Arrears Profile Detected</h3>
                  <p className="text-[11px] text-natural-error/70 font-bold uppercase tracking-widest mt-0.5">Aggregated Liability across {ladder.filter(r => r.status === 'overdue').length} Missed cycles</p>
                </div>
              </div>
              <div className="flex items-baseline gap-4 text-right">
                <div className="text-right">
                  <div className="text-[10px] font-bold text-natural-error uppercase tracking-widest mb-1 opacity-50">Total Overdue Interest</div>
                  <div className="text-4xl font-mono font-bold text-natural-error tabular-nums">₹{totalOverdueInterest.toLocaleString('en-IN')}</div>
                </div>
              </div>
            </motion.div>
          )}

          <div className={`bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col h-full min-h-[600px] transition-all ${totalOverdueInterest > 0 ? 'border-natural-error/30 ring-4 ring-natural-error/[0.03]' : 'border-natural-border'}`}>
            <div className="flex border-b border-natural-border bg-natural-sidebar/10">
              <button
                onClick={() => setActiveTab('ladder')}
                className={`px-10 py-5 text-xs font-bold uppercase tracking-widest transition-all relative ${activeTab === 'ladder' ? 'text-natural-accent' : 'text-natural-muted hover:text-natural-ink'}`}
              >
                Interest Ladder
                {activeTab === 'ladder' && (
                  <motion.div layoutId="tab-detail" className="absolute bottom-0 left-0 right-0 h-0.5 bg-natural-accent" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-10 py-5 text-xs font-bold uppercase tracking-widest transition-all relative ${activeTab === 'history' ? 'text-natural-accent' : 'text-natural-muted hover:text-natural-ink'}`}
              >
                Audit Ledger
                {activeTab === 'history' && (
                  <motion.div layoutId="tab-detail" className="absolute bottom-0 left-0 right-0 h-0.5 bg-natural-accent" />
                )}
              </button>
            </div>

            <div className="flex-1 overflow-auto p-0">
              {activeTab === 'ladder' ? (
                <div>
                   <table className="w-full text-left font-sans text-[13px]">
                    <thead>
                      <tr className="bg-natural-sidebar/30 text-natural-muted text-[11px] font-bold uppercase tracking-widest border-b border-natural-border">
                        <th className="px-6 py-4">Installment</th>
                        <th className="px-6 py-4">Due Date</th>
                        <th className="hidden md:table-cell px-6 py-4">Principal Base</th>
                        <th className="px-6 py-4">Interest Dues</th>
                        <th className="px-6 py-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ladder.map((row) => (
                        <tr key={row.index} className={`border-b border-dotted border-natural-border hover:bg-natural-sidebar/5 transition-colors ${row.status === 'paid' ? 'opacity-60 grayscale-[0.5]' : ''} ${row.status === 'overdue' ? 'bg-natural-error/[0.02]' : ''}`}>
                          <td className="px-6 py-4 font-bold text-natural-muted">#{String(row.index).padStart(2, '0')}</td>
                          <td className="px-6 py-4 text-natural-ink font-medium">
                            {(() => {
                                const [y, mOrW] = row.cycleKey.split('-');
                                return mOrW.startsWith('W') ? `Week ${mOrW.substring(1)}, ${y}` : new Date(parseInt(y), parseInt(mOrW) - 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
                            })()}
                          </td>
                          <td className="hidden md:table-cell px-6 py-4 font-mono text-natural-muted">₹{(row as any).principalUsed?.toLocaleString('en-IN')}</td>
                          <td className="px-6 py-4 font-bold text-natural-accent font-mono">₹{row.amount.toLocaleString('en-IN')}</td>
                          <td className="px-6 py-4 text-right">
                             <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                               row.status === 'paid' ? 'bg-natural-sidebar text-natural-muted' :
                               row.status === 'overdue' ? 'bg-natural-error/10 text-natural-error' :
                               'bg-natural-success/10 text-natural-success'
                             }`}>
                                {row.status}
                             </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {totalOverdueInterest > 0 && (
                      <tfoot className="bg-natural-error/[0.03]">
                        <tr className="border-t-2 border-natural-error/20">
                          <td colSpan={3} className="px-6 py-4 text-[11px] font-bold text-natural-error uppercase tracking-widest">Aggregate Overdue Liability</td>
                          <td className="px-6 py-4 font-bold text-natural-error font-mono text-lg">₹{totalOverdueInterest.toLocaleString('en-IN')}</td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-[10px] font-bold text-natural-error uppercase tracking-widest">{ladder.filter(r => r.status === 'overdue').length} Installments</span>
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                  <div className="p-10 text-center">
                     <p className="text-xs text-natural-muted italic">
                       * Interest adjusted automatically following specific principal repayments.
                     </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  {/* Filters Header */}
                  <div className="flex flex-col md:flex-row items-center gap-4 px-8 py-6 bg-natural-sidebar/10 border-b border-natural-border">
                    <div className="flex bg-white border border-natural-border rounded-lg p-1 shadow-sm w-full md:w-auto">
                      {(['all', 'interest', 'principal'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setHistoryTypeFilter(type)}
                          className={`flex-1 md:flex-none px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${historyTypeFilter === type ? 'bg-natural-accent text-white shadow-sm' : 'text-natural-muted hover:text-natural-ink'}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white border border-natural-border rounded-lg px-3 py-2 shadow-sm w-full md:w-auto">
                      <Clock className="w-3.5 h-3.5 text-natural-muted" />
                      <input 
                        type="date"
                        value={historyStartDate}
                        onChange={(e) => setHistoryStartDate(e.target.value)}
                        className="bg-transparent text-[10px] font-bold uppercase text-natural-muted focus:outline-none w-full md:w-28"
                      />
                      <span className="text-natural-border text-[10px]">→</span>
                      <input 
                        type="date"
                        value={historyEndDate}
                        onChange={(e) => setHistoryEndDate(e.target.value)}
                        className="bg-transparent text-[10px] font-bold uppercase text-natural-muted focus:outline-none w-full md:w-28"
                      />
                    </div>

                    {(historyTypeFilter !== 'all' || historyStartDate || historyEndDate) && (
                      <button 
                        onClick={() => {
                          setHistoryTypeFilter('all');
                          setHistoryStartDate('');
                          setHistoryEndDate('');
                        }}
                        className="text-[10px] font-bold text-natural-error uppercase tracking-widest hover:underline md:ml-auto"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-natural-border flex-1">
                    {sortedTransactions.length === 0 ? (
                    <div className="py-24 text-center">
                      <History className="w-12 h-12 text-natural-border mx-auto mb-4" />
                      <p className="text-natural-muted italic font-serif">Historical archive empty for this asset.</p>
                    </div>
                  ) : (
                    sortedTransactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between px-8 py-5 hover:bg-natural-sidebar/5 transition-colors group">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-natural-ink">
                            {tx.type === 'principal' ? 'Principal Repayment' : (
                              <span>
                                Interest Settlement 
                                {(tx.cycleKey || (tx as any).month) && (
                                  <span className="ml-1 text-natural-accent font-serif italic text-xs capitalize">
                                    — {(() => {
                                      const key = tx.cycleKey || (tx as any).month;
                                      const [y, mOrW] = key.split('-');
                                      if (mOrW.startsWith('W')) {
                                        return `Week ${mOrW.substring(1)}, ${y}`;
                                      } else {
                                        return new Date(parseInt(y), parseInt(mOrW) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                                      }
                                    })()}
                                  </span>
                                )}
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-natural-muted italic">
                              Posted: {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            {(tx.cycleKey || (tx as any).month) && (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-natural-accent/5 border border-natural-accent/10">
                                <span className="w-1 h-1 rounded-full bg-natural-accent animate-pulse" />
                                <span className="text-[9px] font-bold text-natural-accent uppercase tracking-widest">
                                  Cycle: {(() => {
                                    const key = tx.cycleKey || (tx as any).month;
                                    const [y, mOrW] = key.split('-');
                                    if (mOrW.startsWith('W')) {
                                      return `W${mOrW.substring(1)}, ${y}`;
                                    } else {
                                      return new Date(parseInt(y), parseInt(mOrW) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                                    }
                                  })()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            {editingTxId === tx.id ? (
                               <div className="flex items-center gap-2">
                                 <input 
                                  type="number"
                                  value={editAmount}
                                  onChange={(e) => setEditAmount(e.target.value)}
                                  className="w-24 bg-natural-sidebar border border-natural-border rounded px-2 py-1 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-natural-accent"
                                 />
                                 <div className="flex gap-1">
                                    <button onClick={() => handleSaveEdit(tx)} className="p-1 text-natural-success hover:bg-natural-success/10 rounded transition-colors"><Check className="w-4 h-4" /></button>
                                    <button onClick={() => setEditingTxId(null)} className="p-1 text-natural-muted hover:bg-natural-sidebar rounded transition-colors"><X className="w-4 h-4" /></button>
                                 </div>
                               </div>
                            ) : deletingTxId === tx.id ? (
                               <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-2 duration-300">
                                 <span className="text-[10px] font-bold text-natural-error uppercase tracking-widest">Confirm Delete?</span>
                                 <div className="flex gap-1">
                                    <button onClick={() => handleDelete(tx)} className="p-1 text-natural-error hover:bg-natural-error/10 rounded transition-colors"><Check className="w-4 h-4" /></button>
                                    <button onClick={() => setDeletingTxId(null)} className="p-1 text-natural-muted hover:bg-natural-sidebar rounded transition-colors"><X className="w-4 h-4" /></button>
                                 </div>
                               </div>
                            ) : (
                              <>
                                <div className={`text-sm font-bold font-mono ${tx.type === 'principal' ? 'text-natural-success' : 'text-natural-accent'}`}>
                                  ₹{tx.amount.toLocaleString('en-IN')}
                                </div>
                              </>
                            )}
                          </div>

                          {canDeleteRecords && editingTxId !== tx.id && deletingTxId !== tx.id && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleStartEdit(tx)} className="p-2 text-natural-muted hover:text-natural-accent hover:bg-natural-sidebar rounded-lg transition-all">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setDeletingTxId(tx.id)} className="p-2 text-natural-muted hover:text-natural-error hover:bg-natural-error/5 rounded-lg transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isConfirmingTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsConfirmingTransaction(false)}
              className="absolute inset-0 bg-natural-ink/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-natural-border overflow-hidden"
            >
              <div className="p-8">
                <div className="w-12 h-12 bg-natural-accent/10 text-natural-accent rounded-full flex items-center justify-center mb-6">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                
                <h3 className="text-xl font-serif italic text-natural-ink">Confirm Transaction</h3>
                <p className="text-sm text-natural-muted mt-2 leading-relaxed">
                  You are about to post a <span className="font-bold text-natural-ink uppercase">{repayType}</span> repayment to the ledger for <span className="font-bold text-natural-ink">{loan.name}</span>.
                </p>

                <div className="mt-8 space-y-3 bg-natural-sidebar/30 p-5 rounded-xl border border-natural-border">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-natural-muted font-bold uppercase tracking-widest">Amount</span>
                    <span className="text-lg font-mono font-bold text-natural-ink">₹{parseFloat(repayAmount).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-3 border-t border-natural-border/50">
                    <span className="text-natural-muted font-bold uppercase tracking-widest">Entry Type</span>
                    <span className={`px-2 py-1 rounded font-bold uppercase tracking-tighter text-[9px] ${repayType === 'principal' ? 'bg-natural-success/10 text-natural-success' : 'bg-natural-accent/10 text-natural-accent'}`}>
                      {repayType === 'principal' ? 'Capital Reduction' : 'Interest Settlement'}
                    </span>
                  </div>
                  {repayType === 'interest' && nextInterest && (
                    <div className="flex justify-between items-center text-xs pt-3 border-t border-natural-border/50 leading-tight">
                      <span className="text-natural-muted font-bold uppercase tracking-widest">Allocated Cycle</span>
                      <span className="text-natural-ink font-serif italic text-right">
                        {(() => {
                          const [y, mOrW] = (nextInterest?.cycleKey || '').split('-');
                          if (mOrW.startsWith('W')) {
                            return `Week ${mOrW.substring(1)}, ${y}`;
                          } else {
                            return new Date(parseInt(y), parseInt(mOrW) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                          }
                        })()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-8 flex flex-col gap-3">
                  <button 
                    onClick={confirmTransaction}
                    disabled={isSubmitting}
                    className="w-full bg-natural-accent text-white py-4 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-natural-accent/90 transition-all shadow-lg shadow-natural-accent/10 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Posting to Ledger...' : 'Verify & Commit'}
                  </button>
                  <button 
                    onClick={() => setIsConfirmingTransaction(false)}
                    disabled={isSubmitting}
                    className="w-full bg-white text-natural-muted py-4 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-natural-sidebar transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              
              <div className="bg-natural-sidebar/10 px-8 py-3 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-natural-success animate-pulse" />
                <span className="text-[9px] font-bold text-natural-muted uppercase tracking-[0.2em]">Immutable Record will be created</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
