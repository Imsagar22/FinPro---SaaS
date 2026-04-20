import React, { useState, useEffect, useMemo, Component, ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, increment, deleteDoc, writeBatch } from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from './lib/firebase';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import LoanList from './components/LoanList';
import LoanDetail from './components/LoanDetail';
import CustomerLedgers from './components/CustomerLedgers';
import AuditLog from './components/AuditLog';
import SaaSAdmin from './components/SaaSAdmin';
import type { Loan, Transaction, DashboardStats, AppUser, UserRole } from './types';
import { TrendingUp, LogIn, Loader2, XCircle, ShieldCheck, Menu, X, AlertCircle } from 'lucide-react';
import { hasPermission } from './lib/permissions';
import { isLoanOverdue, calculateLoanOverdueInfo } from './lib/loanUtils';
import { getDoc, setDoc } from 'firebase/firestore';

// 0. Error Boundary
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    // Determine the user-facing message immediately and store only the string
    let message = "An unexpected error occurred.";
    try {
      // Prioritize explicit error messages from our SDK or handlers
      const rawMsg = error?.message || (typeof error === 'string' ? error : null);
      
      if (rawMsg && rawMsg.startsWith('{') && rawMsg.endsWith('}')) {
        try {
          const parsed = JSON.parse(rawMsg);
          message = parsed.error || rawMsg;
        } catch (parseErr) {
          message = rawMsg;
        }
      } else if (rawMsg) {
        message = rawMsg;
      } else {
        // Fallback to a safe string representation
        message = String(error).substring(0, 500);
      }
    } catch (e) {
      message = "A critical system fault occurred. Please refresh.";
    }
    return { hasError: true, message };
  }

  componentDidCatch(error: any, _errorInfo: any) {
    // Aggressively extract only the message string to prevent environment serialization crashes
    const safeMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : 'Internal Object Fault');
    console.error(`[SYSTEM_FAULT_CAPTURE] ${safeMessage.substring(0, 500)}`);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full flex items-center justify-center bg-natural-bg p-8 text-natural-ink">
          <div className="max-w-md w-full bg-white border border-natural-error/20 p-8 rounded-2xl shadow-xl shadow-natural-error/5 text-center space-y-6">
            <div className="w-16 h-16 bg-natural-error/10 text-natural-error rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-serif italic text-natural-ink">System Fault Detected</h2>
              <p className="text-sm text-natural-muted mt-2">{this.state.message}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-natural-accent text-white py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-natural-accent/90 transition-colors"
            >
              Attempt System Recovery
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [auditInitialFilter, setAuditInitialFilter] = useState<{ inArrearsOnly: boolean }>({ inArrearsOnly: false });
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (u) {
        // Fetch or create app user profile
        const userRef = doc(db, 'users', u.uid);
        try {
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            setAppUser(userDoc.data() as AppUser);
          } else {
            // Bootstrap first admin or default viewer
            const isFirstAdmin = u.email === 'sagarmailstop@gmail.com';
            const newUser: AppUser = {
              id: u.uid,
              name: u.displayName || 'Anonymous User',
              email: u.email || '',
              role: isFirstAdmin ? 'ADMIN' : 'VIEWER',
              avatar: u.photoURL || undefined,
              createdAt: new Date().toISOString()
            };
            await setDoc(userRef, newUser);
            setAppUser(newUser);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`Error fetching user profile: ${errMsg}`);
        }
      } else {
        setAppUser(null);
      }
      
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // 2. Data Listeners
  useEffect(() => {
    if (!user) return;

    const loansQuery = query(collection(db, 'loans'), where('userId', '==', user.uid));
    const txQuery = query(collection(db, 'transactions'), where('userId', '==', user.uid));

    const unsubLoans = onSnapshot(loansQuery, (snapshot) => {
      setLoans(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Loan)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'loans'));

    const unsubTx = onSnapshot(txQuery, (snapshot) => {
      setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));

    return () => {
      unsubLoans();
      unsubTx();
    };
  }, [user]);

  // 3. Computed Stats
  const stats = useMemo<DashboardStats>(() => {
    const totalCapitalOut = loans
      .filter(l => l.status === 'active')
      .reduce((acc, l) => acc + l.currentPrincipal, 0);
    const totalInterestEarned = transactions
      .filter(t => t.type === 'interest')
      .reduce((acc, t) => acc + t.amount, 0);

    // Calculate overdue alerts for active loans only
    let overdueCount = 0;
    let totalPendingInterest = 0;
    
    loans.forEach(loan => {
      const info = calculateLoanOverdueInfo(loan, transactions);
      overdueCount += info.overdueCount;
      totalPendingInterest += info.pendingInterest;
    });

    return { totalCapitalOut, totalInterestEarned, overdueCount, totalPendingInterest };
  }, [loans, transactions]);

  // 4. Actions
  const handleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error(`Login failed: ${errMsg}`);
      
      if (errMsg.includes('popup-closed-by-user')) {
        setAuthError('Sign-in window was closed before completion.');
      } else if (errMsg.includes('auth/unauthorized-domain')) {
        setAuthError('This domain is not authorized in Firebase Console. Please add ' + window.location.hostname + ' to Authorized Domains.');
      } else if (errMsg.includes('auth/popup-blocked')) {
        setAuthError('Login popup was blocked by your browser. Please allow popups.');
      } else {
        setAuthError(`Authentication issue: ${errMsg}. Try opening in a new tab.`);
      }
    }
  };

  const handleLogout = () => signOut(auth);

  const addLoan = async (data: Omit<Loan, 'id' | 'userId' | 'currentPrincipal' | 'status'>) => {
    if (!user) return;
    const path = 'loans';
    try {
      await addDoc(collection(db, path), {
        ...data,
        currentPrincipal: data.initialPrincipal,
        userId: user.uid,
        status: 'active'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const recordTransaction = async (data: Omit<Transaction, 'id' | 'userId'>) => {
    if (!user) return;
    const txPath = 'transactions';

    try {
      const batch = writeBatch(db);
      
      // Clean data for Firestore: ensure optional fields like 'cycleKey' are only included if they have values
      const txData: any = {
        loanId: data.loanId,
        type: data.type,
        amount: data.amount,
        date: data.date,
        userId: user.uid,
      };
      
      if (data.cycleKey) {
        txData.cycleKey = data.cycleKey;
      }

      // 1. Record the transaction
      const txRef = doc(collection(db, 'transactions'));
      batch.set(txRef, txData);

      // 2. If principal, update the loan's current balance
      if (data.type === 'principal') {
        const loanRef = doc(db, 'loans', data.loanId);
        batch.update(loanRef, {
          currentPrincipal: increment(-data.amount)
        });
        
        // Optimistic update for local state to provide immediate UI feedback
        if (selectedLoan?.id === data.loanId) {
          setSelectedLoan(prev => prev ? ({ ...prev, currentPrincipal: prev.currentPrincipal - data.amount }) : null);
        }
      }

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, txPath);
    }
  };

  const updateTransaction = async (txId: string, oldAmount: number, newAmount: number, type: 'interest' | 'principal', loanId: string) => {
    if (!user) return;
    const path = `transactions/${txId}`;
    try {
      const batch = writeBatch(db);

      // 1. Update the transaction amount
      const txRef = doc(db, 'transactions', txId);
      batch.update(txRef, { amount: newAmount });

      // 2. If principal, adjust loan balance by the difference
      if (type === 'principal') {
        const diff = newAmount - oldAmount;
        const loanRef = doc(db, 'loans', loanId);
        batch.update(loanRef, {
          currentPrincipal: increment(-diff)
        });

        // Update local state if selected
        if (selectedLoan?.id === loanId) {
          setSelectedLoan(prev => prev ? ({ ...prev, currentPrincipal: prev.currentPrincipal - diff }) : null);
        }
      }

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const deleteTransaction = async (tx: Transaction) => {
    if (!user) return;
    const path = `transactions/${tx.id}`;
    try {
      const batch = writeBatch(db);

      // 1. If principal, refund the balance
      if (tx.type === 'principal') {
        const loanRef = doc(db, 'loans', tx.loanId);
        batch.update(loanRef, {
          currentPrincipal: increment(tx.amount)
        });

        // Update local state if selected
        if (selectedLoan?.id === tx.loanId) {
          setSelectedLoan(prev => prev ? ({ ...prev, currentPrincipal: prev.currentPrincipal + tx.amount }) : null);
        }
      }

      // 2. Delete the doc
      const txRef = doc(db, 'transactions', tx.id);
      batch.delete(txRef);

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const toggleLoanStatus = async (loanId: string, currentStatus: 'active' | 'closed') => {
    if (!user) return;
    const path = `loans/${loanId}`;
    const newStatus = currentStatus === 'active' ? 'closed' : 'active';
    try {
      const loanRef = doc(db, 'loans', loanId);
      await updateDoc(loanRef, { status: newStatus });
      
      // Update local state if selected
      if (selectedLoan?.id === loanId) {
        setSelectedLoan(prev => prev ? ({ ...prev, status: newStatus }) : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const updateInterestRate = async (loanId: string, newRate: number) => {
    if (!user) return;
    const path = `loans/${loanId}`;
    try {
      const loanRef = doc(db, 'loans', loanId);
      await updateDoc(loanRef, { interestRate: newRate });
      
      // Update local state if selected
      if (selectedLoan?.id === loanId) {
        setSelectedLoan(prev => prev ? ({ ...prev, interestRate: newRate }) : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteLoan = async (loanId: string) => {
    if (!user) return;
    const path = `loans/${loanId}`;
    try {
      const batch = writeBatch(db);
      
      // 1. Delete associated transactions
      const txsToDelete = transactions.filter(t => t.loanId === loanId);
      txsToDelete.forEach(tx => {
        batch.delete(doc(db, 'transactions', tx.id));
      });
      
      // 2. Delete the loan
      batch.delete(doc(db, 'loans', loanId));
      
      await batch.commit();
      setSelectedLoan(null); // Return to list after deletion
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-natural-bg gap-6">
        <Loader2 className="w-10 h-10 text-natural-accent animate-spin" />
        <p className="text-xs font-bold text-natural-muted uppercase tracking-widest">Initializing Asset Engine...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex bg-natural-bg">
        <div className="hidden lg:flex flex-1 bg-natural-accent items-center justify-center p-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')] opacity-10"></div>
          <div className="max-w-md space-y-8 relative z-10">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-12 shadow-2xl shadow-natural-accent/20">
               <TrendingUp className="text-natural-accent w-10 h-10" />
            </div>
            <h1 className="text-6xl font-serif text-white leading-[1.1] font-bold">Dynamic Debt Governance.</h1>
            <p className="text-natural-sidebar/80 text-xl leading-relaxed italic border-l-2 border-natural-sidebar/30 pl-6">
              Sophisticated interest recalculation for modern portfolio management across declining balances.
            </p>
            <div className="flex gap-3 pt-6">
               {[1,2,3].map(i => <div key={i} className="w-8 h-1 bg-white/20 rounded-full" />)}
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-sm space-y-12">
            <div className="lg:hidden flex items-center gap-2 mb-12">
              <span className="text-3xl font-serif italic font-bold tracking-tight text-natural-accent">FinPro.</span>
            </div>
            <div>
              <h2 className="text-4xl font-serif italic text-natural-ink">System Access</h2>
              <p className="text-natural-muted mt-3 text-sm">Sign in to manage your secured asset portfolio.</p>
            </div>
            <div className="space-y-4">
              {authError && (
                <div className="p-4 bg-natural-error/10 border border-natural-error/20 rounded-xl flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
                   <AlertCircle className="w-4 h-4 text-natural-error shrink-0 mt-0.5" />
                   <p className="text-[11px] text-natural-error font-medium leading-relaxed italic">
                     {authError}
                   </p>
                </div>
              )}
              <button
                onClick={handleLogin}
                className="w-full flex items-center justify-center gap-4 bg-white border border-natural-border py-5 px-6 rounded-xl hover:bg-natural-sidebar/30 transition-all font-bold text-natural-accent shadow-sm uppercase text-[10px] tracking-widest"
              >
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5 grayscale opacity-70" alt="google" />
                Sign in with Identity Provider
              </button>
              <div className="flex items-center gap-4 py-2">
                <div className="flex-1 h-px bg-natural-border"></div>
                <span className="text-[10px] font-bold text-natural-muted uppercase tracking-widest">Secured</span>
                <div className="flex-1 h-px bg-natural-border"></div>
              </div>
            </div>
            <p className="text-center text-[10px] text-natural-muted font-bold uppercase tracking-widest leading-loose">
              Access Restricted to Authorized<br />Investment Managers Only
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-natural-bg flex flex-col lg:flex-row">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-natural-border sticky top-0 z-30">
          <span className="text-2xl font-serif italic font-bold text-natural-accent">FinPro.</span>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-natural-accent hover:bg-natural-sidebar rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setSelectedLoan(null);
            setAuditInitialFilter({ inArrearsOnly: false });
            setIsSidebarOpen(false);
          }} 
          appUser={appUser} 
          onLogout={handleLogout}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        
        <main className="flex-1 lg:ml-64 p-4 md:p-10 max-w-7xl mx-auto w-full transition-all duration-300">
          {selectedLoan ? (
            <LoanDetail 
              loan={selectedLoan} 
              transactions={transactions.filter(t => t.loanId === selectedLoan.id)}
              appUser={appUser}
              onBack={() => setSelectedLoan(null)}
              onRecordTransaction={recordTransaction}
              onUpdateTransaction={updateTransaction}
              onDeleteTransaction={deleteTransaction}
              onToggleStatus={toggleLoanStatus}
              onUpdateInterestRate={updateInterestRate}
              onDeleteLoan={deleteLoan}
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard 
                  stats={stats} 
                  activeLoans={loans.filter(l => l.status === 'active')} 
                  transactions={transactions}
                  appUser={appUser}
                  onLoanClick={setSelectedLoan} 
                  onAddLoan={addLoan}
                  onStatsClick={(label) => {
                    if (label === 'Overdue Alerts') {
                      setAuditInitialFilter({ inArrearsOnly: true });
                      setActiveTab('history');
                    } else if (label === 'Pending Interest') {
                      setAuditInitialFilter({ inArrearsOnly: true });
                      setActiveTab('history');
                    }
                  }}
                />
              )}
              {activeTab === 'loans' && (
                <LoanList 
                  loans={loans} 
                  transactions={transactions}
                  appUser={appUser}
                  onAddLoan={addLoan} 
                  onLoanClick={setSelectedLoan} 
                />
              )}
              {activeTab === 'recalculate' && (
                <CustomerLedgers 
                  loans={loans} 
                  transactions={transactions} 
                  appUser={appUser}
                  onLoanClick={setSelectedLoan} 
                />
              )}
              {activeTab === 'history' && (
                <AuditLog 
                  transactions={transactions} 
                  loans={loans} 
                  appUser={appUser}
                  initialInArrearsOnly={auditInitialFilter.inArrearsOnly}
                />
              )}
              {activeTab === 'saas-admin' && appUser?.role === 'ADMIN' && (
                <SaaSAdmin currentUser={appUser} />
              )}
            </>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}
