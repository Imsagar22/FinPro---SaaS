import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, RotateCw, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { analyzeLoan } from '../services/aiService';
import type { Loan, Transaction } from '../types';

interface AssetIntelligenceProps {
  loan: Loan;
  transactions: Transaction[];
}

export default function AssetIntelligence({ loan, transactions }: AssetIntelligenceProps) {
  const [data, setData] = useState<{ score: number, insight: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateInsight = async () => {
    setIsLoading(true);
    try {
      const result = await analyzeLoan(loan, transactions);
      setData(result);
    } catch (err) {
      setData({ score: 0, insight: 'System overload. Please re-trigger intelligence sequence.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    generateInsight();
  }, [loan.id, transactions.length]);

  return (
    <div className="bg-natural-sidebar p-5 rounded-xl border border-natural-border shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-natural-accent" />
          <h3 className="text-xs font-bold text-natural-ink uppercase tracking-widest">Repayment Consistency</h3>
        </div>
        <button 
          onClick={generateInsight}
          disabled={isLoading}
          className="p-1.5 hover:bg-natural-accent/5 rounded-full text-natural-muted hover:text-natural-accent transition-all disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-6 flex flex-col items-center justify-center gap-2"
          >
            <div className="flex gap-1">
               {[0, 1, 2].map(i => (
                 <motion.div 
                   key={i}
                   animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                   transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                   className="w-1 h-1 bg-natural-accent rounded-full"
                 />
               ))}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-5"
          >
            <div className="relative flex-shrink-0 w-16 h-16 flex items-center justify-center">
               <svg className="w-full h-full transform -rotate-90">
                 <circle
                   cx="32"
                   cy="32"
                   r="28"
                   stroke="currentColor"
                   strokeWidth="4"
                   fill="transparent"
                   className="text-natural-border"
                 />
                 <motion.circle
                   cx="32"
                   cy="32"
                   r="28"
                   stroke="currentColor"
                   strokeWidth="4"
                   fill="transparent"
                   strokeDasharray={175.9}
                   initial={{ strokeDashoffset: 175.9 }}
                   animate={{ strokeDashoffset: 175.9 * (1 - (data?.score || 0) / 100) }}
                   transition={{ duration: 1.5, ease: "easeOut" }}
                   className="text-natural-accent"
                 />
               </svg>
               <span className="absolute text-xs font-mono font-bold text-natural-accent">
                 {data?.score || 0}
               </span>
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-natural-ink italic leading-relaxed font-serif">
                {data?.insight || 'Analyzing patterns...'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
