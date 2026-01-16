import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Simple Tailwind-themed Recharts bar chart for link channels
export default function LinkChannelChart({ data = [] }) {
  // data expected: [{ channel: 'email', clicks: '42', unique_visitors: '10' }, ...]
  const normalized = (data || []).map(d => ({ channel: d.channel || 'unknown', clicks: Number(d.clicks || 0), unique: Number(d.unique_visitors || 0) }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Clicks by channel</h3>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={normalized} margin={{ top: 10, right: 12, left: -12, bottom: 6 }}>
            <XAxis dataKey="channel" tick={{ fill: '#374151' }} />
            <YAxis tick={{ fill: '#374151' }} />
            <Tooltip formatter={(value, name) => [value, name === 'clicks' ? 'Clicks' : 'Unique']} />
            <Bar dataKey="clicks" fill="#6D28D9" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
