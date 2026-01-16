import React, { useState } from "react";
import { VideoAnalyzer } from "../ShortReview";
import Header from "../components/shared/Header";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../components/shared/ui/card";
import { Button } from "../components/shared/ui/button";
import { Separator } from "../components/shared/ui/separator";

export default function ShortReviewPage() {
  const [result, setResult] = useState(null);

  return (
    <div>
  <Header currentPage="shortreview" onNavigate={(page) => { try { window.location.hash = page; } catch(e) { /* ignore */ } }} />
      <div className="p-8 max-w-5xl mx-auto text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-400 to-purple-500 bg-clip-text text-transparent">
          🎬 Short Review (AI)
        </h1>
        <Button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-xl shadow-md"
        >
          Upload New Video
        </Button>
      </div>

      {/* Video Upload */}
      <div className="rounded-2xl border border-slate-700 bg-[#0e0a16]/80 p-6 shadow-lg backdrop-blur-md">
        <VideoAnalyzer onComplete={setResult} />
      </div>

      {/* AI Results */}
      {result && (
        <motion.div
          className="mt-10 space-y-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Summary */}
          <Card className="bg-gradient-to-br from-[#1a1029] to-[#0e0918] border border-purple-800/50 shadow-2xl rounded-2xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-pink-300">
                ✨ AI Review Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 mb-4">
                Below is your AI video feedback with timestamped insights and improvement suggestions.
              </p>

              <div className="space-y-5">
                {result.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-[#1b112c]/70 rounded-xl border border-purple-900/40 hover:border-pink-500/60 transition-all"
                  >
                    <div className="text-xs text-slate-400 mb-1">
                      ⏱ {item.startSec}s → {item.endSec}s
                    </div>
                    <div className="font-medium text-pink-400 mb-1">
                      ⚠️ {item.issue}
                    </div>
                    <div className="text-slate-300 text-sm leading-relaxed">
                      💡 {item.suggestion}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Resources */}
          {result.educationalResources?.length > 0 && (
            <Card className="bg-gradient-to-br from-[#150e23] to-[#0d0917] border border-purple-800/40 shadow-xl rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-purple-300">
                  📘 Educational Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.educationalResources.map((res, i) => (
                  <a
                    key={i}
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg bg-[#1b112c]/70 border border-purple-900/40 hover:bg-purple-900/30 transition"
                  >
                    <div className="text-sm text-pink-400 underline">{res.topic}</div>
                    <div className="text-xs text-slate-400 truncate">{res.url}</div>
                  </a>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Next Steps */}
          {result.nextSteps?.length > 0 && (
            <Card className="bg-gradient-to-br from-[#1a1029] to-[#0e0918] border border-purple-900/50 rounded-2xl shadow-md">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-purple-300">
                  🧭 Next Steps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1 text-slate-300 text-sm">
                  {result.nextSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Separator className="bg-purple-800/40" />
          <div className="text-xs text-slate-500 text-center">
            Model: {result.meta?.model ?? "gpt-5-mini"} · Duration: {" "}
            {result.meta?.duration ?? "—"}s · Attempts Left: {" "}
            {result.meta?.attemptsLeft ?? "?"}
          </div>
        </motion.div>
      )}
      </div>
    </div>
  );
}
