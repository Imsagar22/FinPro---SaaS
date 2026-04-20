import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, RotateCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { analyzePortfolio } from '../services/aiService';
import type { Loan, Transaction, DashboardStats } from '../types';

interface AIAnalystProps {
  loans: Loan[];
  transactions: Transaction[];
  stats: DashboardStats;
}

export default function AIAnalyst({ loans, transactions, stats }: AIAnalystProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsight = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await analyzePortfolio(loans, transactions, stats);
      setInsight(result);
    } catch (err) {
      setError('Intelligence engine timed out. Reconnecting...');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    generateInsight();
  }, [loans.length, stats.overdueCount]); // Re-run when core data changes

  return (
    <div className="bg-natural-sidebar/30 border border-natural-accent/20 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md hover:border-natural-accent/40">
      <div className="px-6 py-4 border-b border-natural-accent/10 flex items-center justify-between bg-white/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-natural-accent/10 rounded-lg text-natural-accent animate-pulse">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-serif font-bold italic text-natural-ink">Portfolio Intelligence</h2>
        </div>
        <button 
          onClick={generateInsight}
          disabled={isLoading}
          className="p-1.5 hover:bg-natural-accent/5 rounded-md text-natural-muted hover:text-natural-accent transition-colors disabled:opacity-50"
          title="Refresh Analysis"
        >
          <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-6 relative min-h-[140px]">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8 gap-4"
            >
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                    className="w-1.5 h-1.5 bg-natural-accent rounded-full"
                  />
                ))}
              </div>
              <p className="text-[10px] font-bold text-natural-muted uppercase tracking-widest animate-pulse italic">Synthesizing Asset Patterns...</p>
            </motion.div>
          ) : error ? (
            <motion.div 
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 text-natural-error py-4"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-xs italic font-medium">{error}</p>
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="prose prose-sm prose-natural max-w-none"
            >
              <div className="text-natural-ink text-[13px] leading-relaxed italic">
                <Markdown>{insight || 'Awaiting system synchronization...'}</Markdown>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="px-6 py-3 bg-natural-accent/[0.02] border-t border-natural-accent/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-3 h-3 text-natural-accent/60" />
          <span className="text-[9px] font-bold text-natural-muted uppercase tracking-widest">Model: Gemini 3 Flash Preview</span>
        </div>
        <span className="text-[9px] text-natural-muted italic">Context: L{loans.length} T{transactions.length}</span>
      </div>
    </div>
  );
}
