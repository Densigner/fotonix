import React from "react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { API_URL } from "../../config/environment";

export default function AffiliateDashboardclick({ affiliateCode }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!affiliateCode) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${API_URL}/api/affiliates/stats?code=${encodeURIComponent(affiliateCode)}`, {
      headers: { 'x-affiliate-code': affiliateCode }
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        return body;
      })
      .then((d) => setData(d))
      .catch((e) => {
        setError(e);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [affiliateCode]);

  const money = (cents) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "GBP" }).format((cents || 0) / 100);

  if (loading) return <div className="p-8 text-slate-300">Loading...</div>;
  if (error) return <div className="p-8 text-red-400">Error loading stats: {(error && error.message) || String(error)}</div>;
  if (!affiliateCode) return <div className="p-8 text-red-400">No affiliate code found for this account.</div>;
  if (!data) return <div className="p-8 text-red-400">No stats available.</div>;

  const clicks = data.clicks || 0;
  const conversions = data.conversions || 0;
  const conversionRate = clicks ? (conversions / clicks) * 100 : 0;
  const timeseries = Array.isArray(data.timeseries) ? data.timeseries : [];

  return (
    <div className="p-8 max-w-7xl mx-auto text-slate-100 space-y-10">
      {/* === KPI Cards === */}
      <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Clicks", value: clicks },
          { label: "Conversions", value: conversions },
          { label: "Conversion Rate", value: `${conversionRate.toFixed(1)}%` },
          { label: "Pending Commission", value: money(data.pendingCommissionCents) },
        ].map((m, i) => (
          <motion.div
            key={i}
            className="bg-gradient-to-br from-[#1a1029] to-[#0e0918] p-4 rounded-2xl shadow-lg border border-purple-800/40"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="text-sm text-slate-400">{m.label}</div>
            <div className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-purple-500 bg-clip-text text-transparent">
              {m.value}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* === Line Chart === */}
      <div className="bg-[#0e0a16]/80 p-6 rounded-2xl shadow-md">
        <h3 className="text-lg font-semibold text-pink-400 mb-3">Clicks (by day)</h3>
        {timeseries.length === 0 ? (
          <div className="text-slate-400 text-sm py-8 text-center">No click activity yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeseries}>
              <XAxis dataKey="date" stroke="#aaa" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="clicks" stroke="#ec4899" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
