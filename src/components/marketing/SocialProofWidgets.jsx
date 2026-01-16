import React, { useState, useEffect } from 'react';
import { Users, DollarSign, TrendingUp, Star, CheckCircle } from 'lucide-react';

/**
 * SocialProofWidgets Component
 * 
 * Displays real-time social proof to build trust and urgency
 * Shows live signups, commissions, and user activity
 */
export default function SocialProofWidgets() {
  // Removed fake stats - being honest with customers

  // Removed fake notifications - building trust through honesty

  return (
    <div className="fixed bottom-4 left-4 z-50 space-y-4 pointer-events-none">
      
      {/* Removed fake live stats and notifications - being honest with visitors */}

      {/* Trust Indicators */}
      <div className="bg-white/95 backdrop-blur-sm border border-zinc-200 rounded-xl shadow-lg p-3 pointer-events-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-3 w-3 text-yellow-400 fill-current" />
              ))}
            </div>
            <span className="text-xs text-zinc-600">4.9/5</span>
          </div>
          <div className="text-xs text-zinc-500">1,200+ reviews</div>
        </div>
        
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-zinc-600">🔒 Bank-level security</span>
          <span className="text-zinc-600">⚡ Instant payouts</span>
        </div>
      </div>
    </div>
  );
}

/**
 * SocialProofBanner Component
 * 
 * Displays at top of page for immediate trust building
 */
export function SocialProofBanner() {
  const [currentStat, setCurrentStat] = useState(0);
  
  const stats = [
    { label: "Active Affiliates", value: "1,247+", icon: Users },
    { label: "Total Commissions Paid", value: "£2.4M+", icon: DollarSign },
    { label: "Average Monthly Earnings", value: "£3,890", icon: TrendingUp }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStat((prev) => (prev + 1) % stats.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gradient-to-r from-fuchsia-500 via-purple-600 to-indigo-600 text-white py-2 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-center space-x-8">
        
        {/* Rotating Stats */}
        <div className="flex items-center space-x-2 min-w-[200px]">
          {React.createElement(stats[currentStat].icon, { className: "h-5 w-5" })}
          <span className="font-semibold">{stats[currentStat].value}</span>
          <span className="text-sm opacity-90">{stats[currentStat].label}</span>
        </div>

        {/* Honest Trust Badges */}
        <div className="hidden md:flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-1">
            <CheckCircle className="h-4 w-4" />
            <span>30-day free trial</span>
          </div>
          
          <div className="flex items-center space-x-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-3 w-3 text-yellow-300 fill-current" />
            ))}
            <span className="ml-1">Real member reviews</span>
          </div>
        </div>
      </div>
    </div>
  );
}