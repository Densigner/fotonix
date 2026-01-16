import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader, AlertCircle, ExternalLink } from 'lucide-react';

/**
 * FunnelViewer - Public facing funnel page
 * 
 * Routes: /funnel/:companySlug/:funnelSlug
 * Also supports subdomain access: funnelslug.companyslug.fotonix.co.uk
 * 
 * This component loads and renders the published funnel content
 */
export default function FunnelViewer() {
  const { companySlug, funnelSlug } = useParams();
  const [funnel, setFunnel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadFunnel();
  }, [companySlug, funnelSlug]);

  async function loadFunnel() {
    try {
      setLoading(true);
      setError(null);

      // Try to load funnel from API/Firebase
      // For now, we'll use mock data based on the slug
      // In production, this would fetch from your database

      // Simulated API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock funnel data - replace with actual API call
      const mockFunnel = {
        id: `${companySlug}-${funnelSlug}`,
        name: funnelSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        companyName: companySlug.charAt(0).toUpperCase() + companySlug.slice(1),
        domain: `${funnelSlug}.${companySlug}.fotonix.co.uk`,
        status: 'active',
        pages: [
          {
            id: 'landing',
            type: 'landing',
            title: 'Welcome',
            content: {
              headline: 'Your Amazing Offer Awaits',
              subheadline: 'Join thousands of satisfied customers',
              ctaText: 'Get Started Now',
              ctaLink: '#signup'
            }
          }
        ],
        theme: {
          primaryColor: '#6366f1',
          backgroundColor: '#f8fafc',
          textColor: '#1e293b'
        }
      };

      setFunnel(mockFunnel);
    } catch (err) {
      console.error('Error loading funnel:', err);
      setError('Funnel not found');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading funnel...</p>
        </div>
      </div>
    );
  }

  if (error || !funnel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-md mx-4">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Funnel Not Found</h2>
          <p className="text-slate-600 mb-4">
            The funnel at <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">{funnelSlug}.{companySlug}.fotonix.co.uk</span> doesn't exist or has been removed.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  // Render the funnel landing page
  const landingPage = funnel.pages?.find(p => p.type === 'landing') || funnel.pages?.[0];

  return (
    <div className="min-h-screen" style={{ backgroundColor: funnel.theme?.backgroundColor || '#f8fafc' }}>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="font-bold text-xl" style={{ color: funnel.theme?.primaryColor || '#6366f1' }}>
            {funnel.companyName}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            {funnel.domain}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center">
          {/* Headline */}
          <h1 
            className="text-4xl md:text-6xl font-bold mb-6"
            style={{ color: funnel.theme?.textColor || '#1e293b' }}
          >
            {landingPage?.content?.headline || funnel.name}
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
            {landingPage?.content?.subheadline || 'Welcome to our exclusive offer'}
          </p>

          {/* CTA Button */}
          <button
            className="px-8 py-4 text-lg font-semibold text-white rounded-xl shadow-lg hover:shadow-xl transition transform hover:-translate-y-0.5"
            style={{ backgroundColor: funnel.theme?.primaryColor || '#6366f1' }}
            onClick={() => {
              // Handle CTA click - could open signup modal, redirect, etc.
              alert('CTA clicked! In a real funnel, this would lead to your signup/checkout page.');
            }}
          >
            {landingPage?.content?.ctaText || 'Get Started'}
          </button>

          {/* Trust indicators */}
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-slate-500">
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Free trial available</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>

        {/* Placeholder for more funnel content */}
        <div className="mt-16 bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-slate-400 mb-4">
            <div className="w-16 h-16 mx-auto bg-slate-100 rounded-xl flex items-center justify-center text-2xl mb-4">
              🚀
            </div>
            <p className="font-medium">Funnel Content Area</p>
            <p className="text-sm">
              This is where your funnel pages, forms, videos, and other content will appear.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/50 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-sm text-slate-500">
          <p>Powered by <a href="https://fotonix.co.uk" className="text-indigo-600 hover:underline">Fotonix</a></p>
          <p className="mt-2 text-xs">
            {funnel.domain}
          </p>
        </div>
      </footer>
    </div>
  );
}
