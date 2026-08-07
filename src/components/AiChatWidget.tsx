import React, { useState, useRef, useEffect } from 'react';
import { Transaction, DisplayCurrency } from '../types';
import { analyzeSpending, formatCurrency } from '../utils/financeUtils';
import { MessageSquare, Send, X, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';

interface AiChatWidgetProps {
  transactions: Transaction[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function AiChatWidget({
  transactions,
  displayCurrency,
  usdArsRate,
}: AiChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your AI financial assistant. Ask me anything about your spending, trends, or comparisons (e.g., "Where am I spending more?", "Am I spending more in restaurants than before?").',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const spending = analyzeSpending(transactions, displayCurrency, usdArsRate, 'ALL');
      const financialContext = {
        summary: {
          totalIncome: formatCurrency(spending.totalIncome, displayCurrency),
          totalExpenses: formatCurrency(spending.totalExpenses, displayCurrency),
          netSavings: formatCurrency(spending.netSavings, displayCurrency),
          savingsRate: `${spending.savingsRate.toFixed(1)}%`,
        },
        monthlyTrend: spending.monthlyTrend,
        topCategories: spending.topCategories.slice(0, 8),
        recentTransactions: transactions.slice(0, 15).map(t => ({
          date: t.date,
          title: t.title,
          category: t.category,
          amount: t.amount,
          currency: t.currency,
          type: t.type,
        })),
      };

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          financialContext,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get AI response');

      setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
    } catch (err: any) {
      setMessages([...newMessages, { role: 'assistant', content: `Sorry, I encountered an error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 bg-emerald-600 hover:bg-emerald-500 text-white p-3.5 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
        title="Ask AI Financial Assistant"
      >
        <MessageSquare className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full animate-ping" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-7rem)] bg-[#161b22] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#121620] border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100">AI Financial Assistant</h4>
                <p className="text-[10px] text-slate-400">Powered by Gemini</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex items-start space-x-2 ${m.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400'
                }`}>
                  {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div className={`max-w-[78%] p-3 rounded-xl text-xs leading-relaxed ${
                  m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#121620] border border-slate-800 text-slate-200 rounded-tl-none'
                }`}>
                  <div className="markdown-body">
                    <Markdown>{m.content}</Markdown>
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center space-x-2 text-slate-400 text-xs py-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-[#121620]/50 border-t border-slate-800/60 flex gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
            <button
              onClick={() => setInput("Where am I spending more?")}
              className="px-2.5 py-1 bg-[#1a2234] hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-700 whitespace-nowrap"
            >
              📊 Where am I spending more?
            </button>
            <button
              onClick={() => setInput("Am I spending more in restaurants than before?")}
              className="px-2.5 py-1 bg-[#1a2234] hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-700 whitespace-nowrap"
            >
              🍽️ Restaurant spending trend?
            </button>
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-3 bg-[#121620] border-t border-slate-800 flex items-center space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your finances..."
              className="flex-1 bg-[#161b22] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
      )}
    </>
  );
}
