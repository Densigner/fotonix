import React from "react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

export default function AffiliateDashboardclick({ userId }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    fetch(`/api/affiliate/stats?user=${userId}`)
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
  }, [userId]);

  if (loading) return <div className="p-8 text-slate-300">Loading...</div>;
  if (error) return <div className="p-8 text-red-400">Error loading stats: {(error && error.message) || String(error)}</div>;
  if (!data || !data.summary) return <div className="p-8 text-red-400">No stats available.</div>;

  const { summary, daily, channels, top_links, referrers } = data;

  return (
    <div className="p-8 max-w-7xl mx-auto text-slate-100 space-y-10">
      {/* === KPI Cards === */}
      <motion.div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Clicks", value: summary.total_clicks },
          { label: "Visitors", value: summary.unique_visitors },
          { label: "Revenue", value: summary.revenue ? `$${summary.revenue}` : "—" }
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
        <h3 className="text-lg font-semibold text-pink-400 mb-3">Clicks (last 30 days)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={daily}>
            <XAxis dataKey="date" stroke="#aaa" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="clicks" stroke="#ec4899" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* === Channel Bar Chart === */}
      <div className="bg-[#0e0a16]/80 p-6 rounded-2xl shadow-md">
        <h3 className="text-lg font-semibold text-purple-400 mb-3">Channel Performance</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={channels}>
            <XAxis dataKey="channel" stroke="#aaa" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="clicks" fill="#ec4899" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* === Referrer Pie Chart === */}
      <div className="bg-[#0e0a16]/80 p-6 rounded-2xl shadow-md">
        <h3 className="text-lg font-semibold text-pink-400 mb-3">Referrer Sources</h3>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={referrers} dataKey="clicks" nameKey="domain" outerRadius={100} label>
              {referrers.map((_, i) => (
                <Cell key={i} fill={["#ec4899","#8b5cf6","#3b82f6","#10b981","#f59e0b","#f97316"][i % 6]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* === Top Links Table === */}
      <div className="bg-[#0e0a16]/80 p-6 rounded-2xl shadow-md overflow-x-auto">
        <h3 className="text-lg font-semibold text-purple-400 mb-3">Top Performing Links</h3>
        <table className="min-w-full text-sm">
          <thead className="text-slate-400 border-b border-slate-700">
            <tr>
              <th className="py-2 text-left">Title</th>
              <th>Channel</th>
              <th>Clicks</th>
              <th>Conversions</th>
              <th>CTR</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {top_links.map((l, i) => (
              <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="py-2">{l.title || l.slug}</td>
                  <td>{l.channel}</td>
                  <td>{l.clicks}</td>
                  <td>{new Date(l.created_at).toLocaleDateString()}</td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
