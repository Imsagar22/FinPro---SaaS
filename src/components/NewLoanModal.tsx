import React, { useState } from 'react';
import { Plus, User, IndianRupee, Percent, Calendar, X } from 'lucide-react';
import type { Loan } from '../types';

interface NewLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLoan: (data: Omit<Loan, 'id' | 'userId' | 'currentPrincipal' | 'status'>) => Promise<void>;
}

export default function NewLoanModal({ isOpen, onClose, onAddLoan }: NewLoanModalProps) {
  const [name, setName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAddLoan({
        name,
        initialPrincipal: parseFloat(principal),
        interestRate: parseFloat(rate),
        paymentFrequency: frequency,
        startDate: new Date(startDate).toISOString(),
      });
      onClose();
      // Reset form
      setName('');
      setPrincipal('');
      setRate('');
      setFrequency('monthly');
      setStartDate(new Date().toISOString().split('T')[0]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-natural-ink/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-natural-border overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="px-6 sm:px-10 py-6 sm:py-8 border-b border-natural-border bg-natural-sidebar/30 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif text-natural-ink italic">New Asset Application</h2>
            <p className="text-[9px] sm:text-xs text-natural-muted mt-1 uppercase font-bold tracking-widest">Origination Engine Alpha</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-natural-border/30 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-natural-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-6 sm:space-y-8">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-natural-muted uppercase tracking-widest pl-1">Borrower Identity</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-natural-muted opacity-50" />
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-natural-sidebar/30 border border-natural-border rounded-lg py-4 pl-12 pr-4 focus:ring-2 focus:ring-natural-accent/10 focus:border-natural-accent outline-none transition-all text-sm"
                placeholder="Full Entity Name"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-natural-muted uppercase tracking-widest pl-1">Principal Base</label>
              <div className="relative">
                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-natural-muted opacity-50" />
                <input
                  required
                  type="number"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  className="w-full bg-natural-sidebar/30 border border-natural-border rounded-lg py-4 pl-12 pr-4 focus:ring-2 focus:ring-natural-accent/10 focus:border-natural-accent outline-none transition-all font-mono text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-natural-muted uppercase tracking-widest pl-1">Interest %</label>
              <div className="relative">
                <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-natural-muted opacity-50" />
                <input
                  required
                  type="number"
                  step="0.1"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="w-full bg-natural-sidebar/30 border border-natural-border rounded-lg py-4 pl-12 pr-4 focus:ring-2 focus:ring-natural-accent/10 focus:border-natural-accent outline-none transition-all font-mono text-sm"
                  placeholder="0.0"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-natural-muted uppercase tracking-widest pl-1">Payment Frequency</label>
            <div className="flex bg-natural-sidebar/30 border border-natural-border rounded-lg p-1">
              <button
                type="button"
                onClick={() => setFrequency('weekly')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-[0.15em] rounded-md transition-all ${frequency === 'weekly' ? 'bg-white text-natural-accent shadow-sm' : 'text-natural-muted/60 hover:text-natural-ink'}`}
              >
                Weekly
              </button>
              <button
                type="button"
                onClick={() => setFrequency('monthly')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-[0.15em] rounded-md transition-all ${frequency === 'monthly' ? 'bg-white text-natural-accent shadow-sm' : 'text-natural-muted/60 hover:text-natural-ink'}`}
              >
                Monthly
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-natural-muted uppercase tracking-widest pl-1">Activation Date</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-natural-muted opacity-50" />
              <input
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-natural-sidebar/30 border border-natural-border rounded-lg py-4 pl-12 pr-4 focus:ring-2 focus:ring-natural-accent/10 focus:border-natural-accent outline-none transition-all text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 px-8 py-4 sm:py-5 rounded-lg font-bold text-natural-muted hover:bg-natural-sidebar transition-colors uppercase text-[10px] tracking-widest"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:flex-1 bg-natural-accent text-white px-8 py-4 sm:py-5 rounded-lg font-bold hover:opacity-90 transition-all shadow-xl shadow-natural-accent/20 disabled:opacity-50 uppercase text-[10px] tracking-widest"
            >
              {isSubmitting ? 'Originating...' : 'Open Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
