import { Home, Landmark, Calculator, Receipt, User, LogOut, Plus, ChevronRight, TrendingUp, AlertCircle, History, DollarSign, ShieldCheck, X } from 'lucide-react';
import type { AppUser } from '../types';
import { getRoleColor } from '../lib/permissions';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  appUser: AppUser | null;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, appUser, onLogout, isOpen, onClose }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'loans', label: 'Loan Portfolio', icon: Landmark },
    { id: 'recalculate', label: 'Customer Ledgers', icon: Calculator },
    { id: 'history', label: 'Audit Log', icon: History },
  ];

  if (appUser?.role === 'ADMIN') {
    menuItems.push({ id: 'saas-admin', label: 'SaaS Admin', icon: ShieldCheck });
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-natural-ink/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <div className={`
        w-64 h-screen bg-natural-sidebar border-r border-natural-border flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-8">
          <div className="flex items-center justify-between mb-12">
            <span className="text-3xl font-serif italic font-bold tracking-tight text-natural-accent">FinPro.</span>
            <button onClick={onClose} className="lg:hidden p-2 text-natural-muted">
              <X className="w-5 h-5" />
            </button>
          </div>

        <nav className="space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium ${
                activeTab === item.id
                  ? 'bg-white text-natural-accent border border-natural-border shadow-sm'
                  : 'text-natural-muted hover:text-natural-ink hover:bg-white/50'
              }`}
            >
              <item.icon className="w-4 h-4 opacity-70" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-8 border-t border-natural-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-white border border-natural-border flex items-center justify-center overflow-hidden shrink-0">
             {appUser?.avatar ? (
               <img src={appUser.avatar} alt="avatar" />
             ) : (
               <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${appUser?.email || 'anon'}`} alt="avatar" />
             )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className={`text-[8px] font-bold uppercase tracking-[0.2em] px-1.5 py-0.5 rounded border self-start mb-0.5 ${getRoleColor(appUser?.role || 'VIEWER')}`}>
              {appUser?.role}
            </div>
            <span className="text-sm font-serif italic text-natural-ink truncate">{appUser?.name.split(' ')[0]}</span>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-natural-muted hover:text-natural-error transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit System</span>
        </button>
      </div>
    </div>
    </>
  );
}
