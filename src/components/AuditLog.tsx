import React, { useState, useMemo } from 'react';
import type { Loan, Transaction, AppUser } from '../types';
import { hasPermission } from '../lib/permissions';
import { History, Search, Download, Filter, ArrowUpRight, ArrowDownRight, IndianRupee, ShieldAlert, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

import { isLoanOverdue, calculateLoanOverdueInfo } from '../lib/loanUtils';

interface AuditLogProps {
  transactions: Transaction[];
  loans: Loan[];
  appUser: AppUser | null;
  initialInArrearsOnly?: boolean;
}

export default function AuditLog({ transactions, loans, appUser, initialInArrearsOnly = false }: AuditLogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState<string>('all');
  const canExport = hasPermission(appUser, 'MANAGE_LOANS'); // Restricted action
  const [filterType, setFilterType] = useState<'all' | 'interest' | 'principal'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [inArrearsOnly, setInArrearsOnly] = useState(initialInArrearsOnly);
  const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'name' | 'amount' | 'type', direction: 'desc' | 'asc' }>({ 
    key: 'date', 
    direction: 'desc' 
  });

  // Sync prop to state for deep-linking
  React.useEffect(() => {
    setInArrearsOnly(initialInArrearsOnly);
  }, [initialInArrearsOnly]);

  const loanMap = useMemo(() => {
    return loans.reduce((acc, loan) => {
      acc[loan.id] = loan.name;
      return acc;
    }, {} as Record<string, string>);
  }, [loans]);

  const overdueLoanIds = useMemo(() => {
    const ids = new Set<string>();
    loans.forEach(loan => {
      if (isLoanOverdue(loan, transactions)) {
        ids.add(loan.id);
      }
    });
    return ids;
  }, [loans, transactions]);

  const filteredTransactions = useMemo(() => {
    // 1. Generate Virtual Transactions for Arrears
    const virtualArrears: any[] = [];
    loans.forEach(loan => {
      const info = calculateLoanOverdueInfo(loan, transactions);
      info.missedInstallments.forEach(mi => {
        virtualArrears.push({
          id: `virtual-${loan.id}-${mi.cycleKey}`,
          loanId: loan.id,
          type: 'interest',
          amount: mi.amount,
          date: mi.dueDate,
          cycleKey: mi.cycleKey,
          isVirtual: true,
          status: 'overdue'
        });
      });
    });

    const allRecords = [...transactions, ...virtualArrears];

    return allRecords
      .filter(tx => {
        const loanName = loanMap[tx.loanId] || 'Unknown';
        const matchesSearch = loanName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesLoan = selectedLoanId === 'all' || tx.loanId === selectedLoanId;
        const matchesType = filterType === 'all' || tx.type === filterType;
        
        const txDate = new Date(tx.date);
        
        // Normalize comparison dates to avoid timezone/hour drift
        const checkStartDate = startDate ? new Date(startDate + 'T00:00:00') : null;
        const checkEndDate = endDate ? new Date(endDate + 'T23:59:59') : null;

        const matchesStartDate = !checkStartDate || txDate >= checkStartDate;
        const matchesEndDate = !checkEndDate || txDate <= checkEndDate;

        // When arrears only is active:
        // - In regular mode, we show all TX for overdue loans
        // - In virtual mode, it might be cleaner to ONLY show the virtual (missed) entries?
        // Let's stick to showing all events for the overdue portfolio.
        const matchesArrears = !inArrearsOnly || overdueLoanIds.has(tx.loanId);

        return matchesSearch && matchesLoan && matchesType && matchesStartDate && matchesEndDate && matchesArrears;
      })
      .sort((a, b) => {
        let valA: any;
        let valB: any;

        switch (sortConfig.key) {
          case 'name':
            valA = (loanMap[a.loanId] || 'Deleted Asset').toLowerCase();
            valB = (loanMap[b.loanId] || 'Deleted Asset').toLowerCase();
            break;
          case 'amount':
            valA = a.amount;
            valB = b.amount;
            break;
          case 'type':
            valA = a.type;
            valB = b.type;
            break;
          default:
            valA = new Date(a.date).getTime();
            valB = new Date(b.date).getTime();
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [transactions, searchTerm, filterType, loanMap, startDate, endDate, sortConfig, inArrearsOnly, overdueLoanIds, selectedLoanId]);

  const toggleSort = (key: typeof sortConfig.key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const hasActiveFilters = searchTerm !== '' || selectedLoanId !== 'all' || filterType !== 'all' || startDate !== '' || endDate !== '';

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedLoanId('all');
    setFilterType('all');
    setStartDate('');
    setEndDate('');
    setInArrearsOnly(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <h1 className="text-3xl font-serif text-natural-ink italic">Audit Log</h1>
            {inArrearsOnly && (
              <div className="flex items-center gap-1.5 bg-natural-error/10 text-natural-error px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border border-natural-error/20 animate-in fade-in slide-in-from-left-2 self-start md:self-auto">
                <ShieldAlert className="w-3 h-3" />
                Arrears Audit Active
              </div>
            )}
          </div>
          <p className="text-natural-muted text-sm mt-1 italic">Immutable chronological record of all system events.</p>
        </div>
        {canExport && (
          <button className="w-full md:w-auto flex items-center justify-center gap-2 bg-white border border-natural-border text-natural-muted px-6 py-3 rounded-lg font-bold hover:bg-natural-sidebar transition-all uppercase text-[10px] tracking-widest shadow-sm">
            <Download className="w-4 h-4" />
            <span>Export Ledger</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-y-6 gap-x-4">
        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-natural-muted ml-1">Archive Search</label>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 bg-white border border-natural-border rounded-xl px-4 py-1 shadow-sm focus-within:ring-2 focus-within:ring-natural-accent/10 transition-all h-12">
              <Search className="w-4 h-4 text-natural-muted" />
              <input 
                type="text"
                placeholder="Search by customer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full py-3 bg-transparent text-sm focus:outline-none text-natural-ink placeholder:italic placeholder:text-natural-muted/50"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="text-natural-muted hover:text-natural-accent transition-colors"
                >
                  <History className="w-3.5 h-3.5 rotate-45" /> 
                </button>
              )}
            </div>
            <select
              value={selectedLoanId}
              onChange={(e) => setSelectedLoanId(e.target.value)}
              className="w-full h-12 px-4 bg-white border border-natural-border rounded-xl text-sm focus:ring-2 focus:ring-natural-accent/10 focus:outline-none text-natural-ink appearance-none cursor-pointer font-medium"
            >
              <option value="all">All Customer Assets</option>
              {loans.map(loan => (
                <option key={loan.id} value={loan.id}>{loan.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-natural-muted ml-1">Time Horizon</label>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 bg-white border border-natural-border rounded-xl px-3 py-1 shadow-sm h-12">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 bg-transparent text-[10px] font-bold uppercase text-natural-muted focus:outline-none"
              />
              <span className="text-natural-border text-[10px]">→</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 bg-transparent text-[10px] font-bold uppercase text-natural-muted focus:outline-none"
              />
            </div>
            <div className="flex gap-2 h-12 bg-white border border-natural-border rounded-xl p-1 shadow-sm">
              {[
                { label: 'Today', days: 0 },
                { label: 'Week', days: 7 },
                { label: 'Month', days: 30 },
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(end.getDate() - preset.days);
                    setEndDate(end.toISOString().split('T')[0]);
                    setStartDate(start.toISOString().split('T')[0]);
                  }}
                  className="flex-1 text-[8px] font-bold uppercase tracking-widest text-natural-muted hover:bg-natural-sidebar rounded-lg transition-all"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-natural-muted ml-1">Event Category</label>
          <div className="flex bg-white border border-natural-border rounded-xl p-1 shadow-sm h-12">
            {(['all', 'interest', 'principal'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`flex-1 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${filterType === type ? 'bg-natural-accent text-white shadow-sm' : 'text-natural-muted hover:text-natural-ink'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-natural-muted ml-1">Governance Sort</label>
          <div className="flex bg-white border border-natural-border rounded-xl px-3 py-1 shadow-sm items-center gap-2 h-12">
            <Filter className="w-3.5 h-3.5 text-natural-muted" />
            <select 
              value={sortConfig.key}
              onChange={(e) => setSortConfig(prev => ({ ...prev, key: e.target.value as any }))}
              className="flex-1 bg-transparent text-[10px] font-bold uppercase text-natural-muted focus:outline-none appearance-none cursor-pointer"
            >
              <option value="date">Execution Date</option>
              <option value="name">Customer Name</option>
              <option value="amount">Transaction Amount</option>
              <option value="type">Event Type</option>
            </select>
            <button 
              onClick={() => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'desc' ? 'asc' : 'desc' }))}
              className="text-natural-accent hover:text-natural-ink transition-colors p-1"
              title={sortConfig.direction === 'desc' ? 'Descending' : 'Ascending'}
            >
              {sortConfig.direction === 'desc' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4 rotate-180" />}
            </button>
          </div>
        </div>

        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-natural-muted ml-1">Asset Status</label>
          <div className="flex bg-white border border-natural-border rounded-xl p-1 shadow-sm h-12">
              <button
                onClick={() => setInArrearsOnly(!inArrearsOnly)}
                className={`flex-1 flex items-center justify-center gap-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${inArrearsOnly ? 'bg-natural-error text-white shadow-sm' : 'text-natural-muted hover:text-natural-error/70'}`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Arrears Portfolio Only</span>
              </button>
          </div>
        </div>

        <div className="md:col-span-4 space-y-2 flex flex-col justify-end">
          <button 
            onClick={hasActiveFilters || inArrearsOnly ? resetFilters : () => toggleSort('date')}
            className={`w-full flex items-center justify-center px-4 h-12 border rounded-xl text-[10px] font-bold uppercase tracking-widest gap-2 transition-all shadow-sm ${
              hasActiveFilters || inArrearsOnly
              ? 'bg-natural-error/10 border-natural-error/20 text-natural-error hover:bg-natural-error/20' 
              : 'bg-natural-sidebar border-natural-border text-natural-accent hover:bg-white'
            }`}
          >
            {hasActiveFilters || inArrearsOnly ? (
              <>
                <History className="w-4 h-4" />
                <span>Reset Parameters</span>
              </>
            ) : (
              <>
                <History className="w-4 h-4" />
                <span>Full System Archive</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white border border-natural-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-[13px]">
            <thead>
              <tr className="bg-natural-sidebar/30 text-natural-muted text-[11px] font-bold uppercase tracking-widest border-b border-natural-border">
                <th className="px-6 py-4 cursor-pointer hover:text-natural-accent group transition-colors" onClick={() => toggleSort('name')}>
                  <div className="flex items-center gap-2">
                    Event Context
                    <div className="flex flex-col">
                      {sortConfig.key === 'name' ? (
                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-natural-accent" /> : <ChevronDown className="w-3 h-3 text-natural-accent" />
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 text-natural-muted/30 group-hover:text-natural-accent/50" />
                      )}
                    </div>
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-natural-accent group transition-colors" onClick={() => toggleSort('type')}>
                  <div className="flex items-center gap-2">
                    Transaction Type
                    <div className="flex flex-col">
                      {sortConfig.key === 'type' ? (
                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-natural-accent" /> : <ChevronDown className="w-3 h-3 text-natural-accent" />
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 text-natural-muted/30 group-hover:text-natural-accent/50" />
                      )}
                    </div>
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-natural-accent group transition-colors" onClick={() => toggleSort('amount')}>
                  <div className="flex items-center gap-2">
                    Amount
                    <div className="flex flex-col">
                      {sortConfig.key === 'amount' ? (
                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-natural-accent" /> : <ChevronDown className="w-3 h-3 text-natural-accent" />
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 text-natural-muted/30 group-hover:text-natural-accent/50" />
                      )}
                    </div>
                  </div>
                </th>
                <th className="hidden sm:table-cell px-6 py-4 cursor-pointer hover:text-natural-accent group transition-colors" onClick={() => toggleSort('date')}>
                  <div className="flex items-center gap-2">
                    Execution Date
                    <div className="flex flex-col">
                      {sortConfig.key === 'date' ? (
                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-natural-accent" /> : <ChevronDown className="w-3 h-3 text-natural-accent" />
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 text-natural-muted/30 group-hover:text-natural-accent/50" />
                      )}
                    </div>
                  </div>
                </th>
                <th className="hidden md:table-cell px-6 py-4 text-right">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-natural-border/50">
              {filteredTransactions.length === 0 ? (
                <tr>
                   <td colSpan={5} className="px-6 py-24 text-center">
                      {inArrearsOnly ? (
                        <div className="max-w-sm mx-auto">
                          <ShieldAlert className="w-12 h-12 text-natural-error/30 mx-auto mb-4" />
                          <p className="text-natural-ink font-serif italic mb-1">Delinquent Assets Detected</p>
                          <p className="text-natural-muted text-[11px] leading-relaxed mb-6">
                            These accounts have missed payments, but no historical transactions have been recorded for them yet. 
                            Check the <span className="text-natural-accent font-bold">Interest Ladder</span> in Loan Details for cycle breakdowns.
                          </p>
                          <button 
                            onClick={() => setInArrearsOnly(false)}
                            className="text-[10px] font-bold uppercase tracking-widest text-natural-accent hover:underline"
                          >
                            View Full Archive Ledger
                          </button>
                        </div>
                      ) : (
                        <div className="max-w-sm mx-auto">
                          <History className="w-12 h-12 text-natural-border mx-auto mb-4" />
                          <p className="text-natural-muted italic font-serif mb-4">No archive entries match current filters.</p>
                          {hasActiveFilters && (
                            <button 
                              onClick={resetFilters}
                              className="text-[10px] font-bold uppercase tracking-widest text-natural-accent hover:underline"
                            >
                              Reset All Parameters
                            </button>
                          )}
                        </div>
                      )}
                   </td>
                </tr>
              ) : filteredTransactions.map((tx) => (
                <tr key={tx.id} className={`transition-colors ${(tx as any).isVirtual ? 'bg-natural-error/[0.02] border-l-2 border-natural-error hover:bg-natural-error/[0.04]' : 'hover:bg-natural-sidebar/5'}`}>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-bold text-natural-ink">{loanMap[tx.loanId] || 'Deleted Asset'}</div>
                        <div className="text-[10px] text-natural-muted font-bold tracking-widest uppercase mt-0.5">
                          {tx.type === 'interest' && tx.cycleKey ? (() => {
                            const [y, mOrW] = tx.cycleKey.split('-');
                            if (mOrW.startsWith('W')) {
                              return `Week ${mOrW.substring(1)}, ${y}`;
                            } else {
                              return new Date(parseInt(y), parseInt(mOrW) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                            }
                          })() : (tx.type === 'principal' ? 'Principal Reduction' : 'Asset Event')}
                        </div>
                      </div>
                      {(tx as any).isVirtual && (
                        <div className="bg-natural-error/10 text-natural-error px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter">
                          Missed Cycle
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${(tx as any).isVirtual ? 'text-natural-error' : (tx.type === 'principal' ? 'text-natural-success' : 'text-natural-accent')}`}>
                      {(tx as any).isVirtual ? <ShieldAlert className="w-3 h-3 animate-pulse" /> : (tx.type === 'principal' ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />)}
                      {(tx as any).isVirtual ? 'Delinquency Entry' : (tx.type === 'principal' ? 'Principal Repay' : 'Interest Settlement')}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className={`font-mono font-bold ${(tx as any).isVirtual ? 'text-natural-error/70' : 'text-natural-ink'}`}>
                       ₹{tx.amount.toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-6 py-5 text-natural-muted font-medium">
                    <div className="flex flex-col">
                      <span className={ (tx as any).isVirtual ? 'italic text-natural-error/60' : ''}>
                        {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {(tx as any).isVirtual && <span className="text-[9px] font-bold uppercase text-natural-error/40 mt-0.5">Payment Overdue</span>}
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-5 text-right">
                    {(tx as any).isVirtual ? (
                      <span className="text-[10px] font-mono text-natural-error/30 uppercase italic">UNSETTLED</span>
                    ) : (
                      <span className="text-[10px] font-mono text-natural-muted uppercase bg-natural-sidebar px-2 py-1 rounded">#{tx.id.slice(-6).toUpperCase()}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
