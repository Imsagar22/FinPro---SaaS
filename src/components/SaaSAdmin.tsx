import React, { useState, useEffect, useMemo } from 'react';
import { Users, LayoutGrid, TrendingUp, IndianRupee, ShieldCheck, Mail, Calendar, Search, ArrowRight, UserPlus, BarChart3, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { calculateLoanOverdueInfo } from '../lib/loanUtils';
import type { Loan, Transaction, AppUser } from '../types';

interface SaaSAdminProps {
  currentUser: AppUser | null;
}

interface UserMetrics extends AppUser {
  loanCount: number;
  totalVolume: number;
  totalInterestEarned: number;
  overdueCount: number;
}

export default function SaaSAdmin({ currentUser }: SaaSAdminProps) {
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // 1. Fetch All Users
    const unsubUsers = onSnapshot(query(collection(db, 'users'), orderBy('email')), (snapshot) => {
      setAllUsers(snapshot.docs.map(d => d.data() as AppUser));
      setLoading(false);
    });

    // 2. Fetch All Loans (Global)
    const unsubLoans = onSnapshot(collection(db, 'loans'), (snapshot) => {
      setAllLoans(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Loan)));
    });

    // 3. Fetch All Transactions (Global)
    const unsubTx = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      setAllTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    });

    return () => {
      unsubUsers();
      unsubLoans();
      unsubTx();
    };
  }, []);

  const userMetrics = useMemo<UserMetrics[]>(() => {
    return allUsers.map(u => {
      const uLoans = allLoans.filter(l => l.userId === u.id);
      const uTransactions = allTransactions.filter(t => t.userId === u.id);
      
      let overdueCount = 0;
      uLoans.forEach(loan => {
        overdueCount += calculateLoanOverdueInfo(loan, uTransactions).overdueCount;
      });

      return {
        ...u,
        loanCount: uLoans.length,
        totalVolume: uLoans.reduce((acc, l) => acc + l.initialPrincipal, 0),
        totalInterestEarned: uTransactions
          .filter(t => t.type === 'interest')
          .reduce((acc, t) => acc + t.amount, 0),
        overdueCount
      };
    });
  }, [allUsers, allLoans, allTransactions]);

  const filteredUsers = userMetrics.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const globalStats = useMemo(() => {
    const totalCapital = allLoans.reduce((acc, l) => acc + l.initialPrincipal, 0);
    const totalInterest = allTransactions.filter(t => t.type === 'interest').reduce((acc, t) => acc + t.amount, 0);
    return {
      totalUsers: allUsers.length,
      totalCapital,
      totalInterest,
      avgPortfolio: allUsers.length > 0 ? totalCapital / allUsers.length : 0
    };
  }, [allUsers, allLoans, allTransactions]);

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4 text-natural-muted italic">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
          <ShieldCheck className="w-8 h-8 opacity-20" />
        </motion.div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Decrypting Sovereign Ledger...</span>
      </div>
    );
  }

  const cards = [
    { label: 'Platform Tenants', value: globalStats.totalUsers, icon: Users, sub: 'Registered Entities' },
    { label: 'Global Exposure', value: `₹${globalStats.totalCapital.toLocaleString('en-IN')}`, icon: IndianRupee, sub: 'Cumulative Principal' },
    { label: 'Network Revenue', value: `₹${globalStats.totalInterest.toLocaleString('en-IN')}`, icon: TrendingUp, sub: 'Total Interest Settled' },
    { label: 'ARP (Avg. Portfolio)', value: `₹${Math.round(globalStats.avgPortfolio).toLocaleString('en-IN')}`, icon: BarChart3, sub: 'Per Active Instance' },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-serif text-natural-ink italic">Admin Command Center</h1>
          <p className="text-natural-muted text-sm mt-1 italic">Inter-tenant intelligence & sovereign user management</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="hidden md:flex flex-col items-end">
             <span className="text-[10px] font-bold text-natural-accent uppercase tracking-widest">SaaS Supervisor</span>
             <span className="text-[11px] text-natural-muted italic font-serif">{currentUser?.email}</span>
           </div>
           <div className="w-10 h-10 rounded-full bg-natural-accent text-white flex items-center justify-center font-bold">
              {currentUser?.name[0]}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="p-6 bg-white border border-natural-border rounded-xl shadow-sm hover:border-natural-accent/30 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-natural-sidebar text-natural-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                <card.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-natural-muted uppercase tracking-widest">{card.label}</p>
                <p className="text-xl font-serif text-natural-accent font-bold mt-0.5">{card.value}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-natural-border/30 text-[10px] text-natural-muted italic">
              {card.sub}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white border border-natural-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="px-8 py-6 border-b border-natural-border bg-natural-sidebar/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
             <h2 className="text-sm font-serif font-bold italic text-natural-ink">Registered SaaS Tenants</h2>
             <p className="text-[10px] text-natural-muted font-bold uppercase tracking-widest mt-0.5">Instance Catalog</p>
           </div>
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-natural-muted" />
              <input 
                type="text" 
                placeholder="Search Tenants..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-natural-border rounded-lg text-xs font-sans focus:border-natural-accent outline-none w-full md:w-64"
              />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-[13px]">
            <thead>
              <tr className="bg-natural-sidebar/20 text-natural-muted text-[11px] font-bold uppercase tracking-wider border-b border-natural-border">
                <th className="px-8 py-5">Tenant Identity</th>
                <th className="px-8 py-5 text-center">Enrolled</th>
                <th className="px-8 py-5 text-center">Assets / Risk</th>
                <th className="px-8 py-5 text-right">Yield Performance</th>
                <th className="px-8 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-natural-border/50">
              {filteredUsers.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-natural-sidebar/10 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-natural-sidebar border border-natural-border flex items-center justify-center text-[10px] font-bold text-natural-accent uppercase">
                        {tenant.name.substring(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-natural-ink">{tenant.name}</div>
                        <div className="text-[10px] text-natural-muted lowercase font-medium flex items-center gap-1">
                          <Mail className="w-2.5 h-2.5" />
                          {tenant.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <div className="text-[11px] text-natural-ink font-medium">
                      {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : 'Historical'}
                    </div>
                    <div className="text-[9px] text-natural-muted uppercase font-bold tracking-tighter">
                      {tenant.createdAt ? new Date(tenant.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Bootstrapped'}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <div className="font-mono font-bold text-natural-ink text-sm">{tenant.loanCount}</div>
                    {tenant.overdueCount > 0 && (
                      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-natural-error/10 text-natural-error rounded text-[9px] font-bold uppercase ring-1 ring-natural-error/20 mt-1">
                        <AlertCircle className="w-2.5 h-2.5" />
                        {tenant.overdueCount} Overdue
                      </div>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="font-mono font-bold text-natural-accent">₹{tenant.totalVolume.toLocaleString('en-IN')}</div>
                      <div className="text-[10px] font-bold text-natural-success uppercase tracking-tighter flex items-center gap-1">
                         <TrendingUp className="w-2.5 h-2.5" />
                         ₹{tenant.totalInterestEarned.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                     <button className="p-2 text-natural-muted hover:text-natural-accent opacity-0 group-hover:opacity-100 transition-all">
                        <ArrowRight className="w-4 h-4" />
                     </button>
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
