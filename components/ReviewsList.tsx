// @ts-nocheck
import React, { useMemo, useState } from 'react';
import ReviewItem, { Review } from './ReviewItem';

type SortKey = 'most-helpful' | 'highest' | 'lowest' | 'newest' | 'oldest';

function stableSort<T>(arr: T[], cmp: (a: T, b: T) => number) {
  return [...arr].map((v, i) => ({ v, i })).sort((a, b) => {
    const r = cmp(a.v, b.v); return r === 0 ? a.i - b.i : r;
  }).map(x => x.v);
}

export default function ReviewsList({ reviews }: { reviews: Review[] }) {
  const [sortKey, setSortKey] = useState('most-helpful' as SortKey);

  const sorted = useMemo(() => {
    switch (sortKey) {
      case 'highest': return stableSort(reviews, (a, b) => b.rating - a.rating);
      case 'lowest': return stableSort(reviews, (a, b) => a.rating - b.rating);
      case 'newest': return stableSort(reviews, (a, b) => Date.parse(b.date) - Date.parse(a.date));
      case 'oldest': return stableSort(reviews, (a, b) => Date.parse(a.date) - Date.parse(b.date));
      case 'most-helpful':
      default:
        return stableSort(reviews, (a, b) => ( (b.helpfulUp || 0) - (b.helpfulDown || 0) ) - ( (a.helpfulUp || 0) - (a.helpfulDown || 0) ));
    }
  }, [reviews, sortKey]);

  return (
    <section className="p-4 rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-800/50 shadow-2xl/20">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg text-white">Reviews</h3>
  <select value={sortKey} onChange={(e: any) => setSortKey(e.target.value as SortKey)} className="text-black text-sm rounded px-2 py-1">
          <option value="most-helpful">Most helpful</option>
          <option value="highest">Highest rated</option>
          <option value="lowest">Lowest rated</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>

      <ul className="divide-y divide-white/10">
  {sorted.map((r: Review) => <ReviewItem key={r.id} review={r} />)}
      </ul>
    </section>
  );
}
