import React from 'react';

/**
 * TrustBar - A transparency/trust-building bar that displays contextual
 * YouTube channel links based on the current page/product section.
 * 
 * Replaces the promotional UrgencyBanner with honest, process-focused messaging.
 * Opens links in new tabs without disrupting user flow.
 */

// YouTube logo SVG component
function YouTubeLogo({ className }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      viewBox="0 0 24 24" 
      fill="none"
      aria-hidden="true"
    >
      <path 
        d="M23.5 6.2a3 3 0 0 0-2.12-2.12C19.7 3.5 12 3.5 12 3.5s-7.7 0-9.38.58A3 3 0 0 0 .5 6.2 31.7 31.7 0 0 0 0 12a31.7 31.7 0 0 0 .5 5.8 3 3 0 0 0 2.12 2.12C4.3 20.5 12 20.5 12 20.5s7.7 0 9.38-.58A3 3 0 0 0 23.5 17.8 31.7 31.7 0 0 0 24 12a31.7 31.7 0 0 0-.5-5.8z" 
        fill="#FF0000"
      />
      <path d="M10 15l5-3-5-3v6z" fill="#fff"/>
    </svg>
  );
}

// Configuration for different product contexts
const TRUST_CONTENT = {
  stencil: {
    message: 'See how we design and laser-cut stencils in our workshop',
    href: 'https://www.youtube.com/@StencilGenerator',
    ariaLabel: 'Watch our stencil creation process on YouTube'
  },
  neon: {
    message: 'Watch how our neon signs and acrylic pieces are made',
    href: 'https://www.youtube.com/@FotonixNeonWorks',
    ariaLabel: 'Watch our neon and acrylic manufacturing process on YouTube'
  },
  default: {
    message: 'See our workshop and how your products are made',
    href: 'https://www.youtube.com/@FotonixNeonWorks',
    ariaLabel: 'Watch our manufacturing process on YouTube'
  }
};

/**
 * Determines which content to show based on current URL/hash
 */
function getContentForRoute() {
  const hash = window.location.hash.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  const fullPath = pathname + hash;

  // Stencil-related pages
  if (
    fullPath.includes('stencil') ||
    fullPath.includes('stencil-generator') ||
    fullPath.includes('stencil-upload') ||
    hash.includes('stencil')
  ) {
    return TRUST_CONTENT.stencil;
  }

  // Neon, mirror, acrylic pages
  if (
    fullPath.includes('neon') ||
    fullPath.includes('mirror') ||
    fullPath.includes('acrylic') ||
    fullPath.includes('led') ||
    fullPath.includes('lamp') ||
    fullPath.includes('sign') ||
    hash.includes('neon') ||
    hash.includes('mirror') ||
    hash.includes('acrylic') ||
    hash.includes('product')
  ) {
    return TRUST_CONTENT.neon;
  }

  // Default fallback
  return TRUST_CONTENT.default;
}

export default function TrustBar() {
  const [content, setContent] = React.useState(getContentForRoute);

  // Update content when hash/route changes
  React.useEffect(() => {
    const handleRouteChange = () => {
      setContent(getContentForRoute());
    };

    // Listen for hash changes (common in SPA with hash routing)
    window.addEventListener('hashchange', handleRouteChange);
    
    // Also listen for popstate (browser back/forward)
    window.addEventListener('popstate', handleRouteChange);

    return () => {
      window.removeEventListener('hashchange', handleRouteChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  return (
    <div 
      className="w-full bg-gradient-to-r from-pink-600 via-fuchsia-600 to-violet-600 text-white"
      role="complementary"
      aria-label="Workshop transparency information"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5">
        <a
          href={content.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={content.ariaLabel}
          className="flex items-center justify-center gap-2.5 text-sm font-medium text-white hover:text-white/90 transition-colors group"
        >
          {/* YouTube logo */}
          <YouTubeLogo className="w-5 h-5 drop-shadow-sm" />
          
          <span className="font-semibold">{content.message}</span>
          
          {/* External link indicator */}
          <svg 
            className="w-3.5 h-3.5 text-white/70 group-hover:text-white transition-colors" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
}
