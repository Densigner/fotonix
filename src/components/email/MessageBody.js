import React from 'react';
import DOMPurify from 'dompurify';

export default function MessageBody({ html, text }) {
  if (html) {
    const clean = DOMPurify.sanitize(html);
    return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: clean }} />;
  }
  if (text) return <pre className="whitespace-pre-wrap text-sm">{text}</pre>;
  return <div className="text-sm text-slate-500">No content.</div>;
}
