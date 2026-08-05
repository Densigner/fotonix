import React, { useCallback, useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import { apiCall, API_URL } from "../../../config/environment";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { v4 as uuidv4 } from "uuid";
import {
  Plus,
  Settings2,
  Trash2,
  Laptop,
  Smartphone,
  Tablet,
  Eye,
  LayoutTemplate,
  Copy,
  Save,
  Undo2,
  Redo2,
  Edit3,
  Sparkles,
  Image as ImageIcon,
  Mail,
  ArrowUpRight,
  GripVertical,
  Store,
  Users,
  Heart,
  Star,
  ShoppingBag,
  Instagram,
  ChevronLeft,
  ChevronRight,
  Lock,
  Facebook,
  Twitter,
  Youtube,
  Globe,
  CheckCircle2,
  Shield,
  Truck,
  RotateCcw,
  Headphones,
  Award,
  BadgeCheck,
  Zap,
  ChevronDown,
  ExternalLink,
  X,
  Phone,
  Clock,
  MapPin,
} from "lucide-react";

// Firebase integration
import { storage } from '../../../firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

/******************************************
 * COLOR THEME SYSTEM
 *****************************************/

// Predefined Color Themes
const COLOR_THEMES = {
  default: {
    name: "Default Blue",
    primary: "#4f46e5", // indigo-600
    secondary: "#06b6d4", // cyan-500
    accent: "#10b981", // emerald-500
    background: "#ffffff",
    surface: "#f8fafc", // slate-50
    text: "#1e293b", // slate-800
    textMuted: "#64748b", // slate-500
    gradient: "from-indigo-500 to-cyan-500",
    preview: ["#4f46e5", "#06b6d4", "#10b981"]
  },
  sunset: {
    name: "Sunset Orange",
    primary: "#ea580c", // orange-600
    secondary: "#dc2626", // red-600
    accent: "#facc15", // yellow-400
    background: "#ffffff",
    surface: "#fef7ed", // orange-50
    text: "#1c1917", // stone-900
    textMuted: "#78716c", // stone-500
    gradient: "from-orange-500 to-red-500",
    preview: ["#ea580c", "#dc2626", "#facc15"]
  },
  forest: {
    name: "Forest Green",
    primary: "#059669", // emerald-600
    secondary: "#065f46", // emerald-800
    accent: "#84cc16", // lime-500
    background: "#ffffff",
    surface: "#ecfdf5", // emerald-50
    text: "#064e3b", // emerald-900
    textMuted: "#6b7280", // gray-500
    gradient: "from-emerald-600 to-lime-500",
    preview: ["#059669", "#065f46", "#84cc16"]
  },
  royal: {
    name: "Royal Purple",
    primary: "#7c3aed", // violet-600
    secondary: "#a855f7", // purple-500
    accent: "#ec4899", // pink-500
    background: "#ffffff",
    surface: "#faf5ff", // violet-50
    text: "#581c87", // violet-900
    textMuted: "#6b7280", // gray-500
    gradient: "from-violet-600 to-pink-500",
    preview: ["#7c3aed", "#a855f7", "#ec4899"]
  },
  ocean: {
    name: "Ocean Blue",
    primary: "#0284c7", // sky-600
    secondary: "#0369a1", // sky-700
    accent: "#06b6d4", // cyan-500
    background: "#ffffff",
    surface: "#f0f9ff", // sky-50
    text: "#0c4a6e", // sky-900
    textMuted: "#64748b", // slate-500
    gradient: "from-sky-600 to-cyan-500",
    preview: ["#0284c7", "#0369a1", "#06b6d4"]
  },
  rose: {
    name: "Rose Gold",
    primary: "#e11d48", // rose-600
    secondary: "#be185d", // pink-700
    accent: "#f59e0b", // amber-500
    background: "#ffffff",
    surface: "#fff1f2", // rose-50
    text: "#881337", // rose-900
    textMuted: "#6b7280", // gray-500
    gradient: "from-rose-500 to-amber-500",
    preview: ["#e11d48", "#be185d", "#f59e0b"]
  },
  monochrome: {
    name: "Monochrome",
    primary: "#374151", // gray-700
    secondary: "#1f2937", // gray-800
    accent: "#6b7280", // gray-500
    background: "#ffffff",
    surface: "#f9fafb", // gray-50
    text: "#111827", // gray-900
    textMuted: "#6b7280", // gray-500
    gradient: "from-gray-700 to-gray-500",
    preview: ["#374151", "#1f2937", "#6b7280"]
  },
  custom: {
    name: "Custom Theme",
    primary: "#4f46e5",
    secondary: "#06b6d4",
    accent: "#10b981",
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#1e293b",
    textMuted: "#64748b",
    gradient: "from-indigo-500 to-cyan-500",
    preview: ["#4f46e5", "#06b6d4", "#10b981"]
  }
};

// Color utility functions
/*
const getThemeStyles = (theme, opacity = 1) => {
  if (!theme) theme = COLOR_THEMES.default;
  
  return {
    primary: `rgba(${hexToRgb(theme.primary)}, ${opacity})`,
    secondary: `rgba(${hexToRgb(theme.secondary)}, ${opacity})`,
    accent: `rgba(${hexToRgb(theme.accent)}, ${opacity})`,
    background: theme.background,
    surface: theme.surface,
    text: theme.text,
    textMuted: theme.textMuted,
    gradient: theme.gradient,
    
    // CSS Custom Properties
    cssVars: {
      '--theme-primary': theme.primary,
      '--theme-secondary': theme.secondary,
      '--theme-accent': theme.accent,
      '--theme-background': theme.background,
      '--theme-surface': theme.surface,
      '--theme-text': theme.text,
      '--theme-text-muted': theme.textMuted,
    }
  };
};
*/

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '79, 70, 229'; // fallback indigo
};

/*
const getThemeClasses = (theme, element = 'button') => {
  if (!theme) theme = COLOR_THEMES.default;
  
  const styles = {
    button: {
      primary: `text-white border-0`,
      secondary: `text-white border-0`,
      accent: `text-white border-0`,
      background: `bg-gradient-to-r ${theme.gradient}`,
      hover: `hover:opacity-90`,
    },
    badge: {
      primary: `text-white border-0`,
      background: `bg-gradient-to-r ${theme.gradient}`,
    },
    card: {
      background: `bg-white`,
      border: `border-gray-200`,
      surface: `bg-gray-50`,
    },
    text: {
      primary: `text-gray-900`,
      secondary: `text-gray-600`,
      muted: `text-gray-500`,
    }
  };
  
  return styles[element] || styles.button;
};
*/

// Minimal UI components (inline fallbacks)
const Input = ({ value, onChange, placeholder, className, ...rest }) => (
  <input value={value} onChange={onChange} placeholder={placeholder} className={className || 'w-full rounded-md border border-gray-200 px-2 py-1'} {...rest} />
);
const Label = ({ children, className }) => <label className={className || 'block text-xs font-semibold text-gray-600'}>{children}</label>;
const Switch = ({ checked, onCheckedChange }) => (
  <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange && onCheckedChange(e.target.checked)} />
);
const Textarea = ({ value, onChange, className, ...rest }) => <textarea value={value} onChange={onChange} className={className || 'w-full rounded-md border p-2'} {...rest} />;
const Slider = ({ value, onValueChange, min = 0, max = 100 }) => (
  <input type="range" min={min} max={max} value={Array.isArray(value) ? value[0] : value} onChange={(e) => onValueChange && onValueChange([Number(e.target.value)])} />
);

const Button = ({ children, variant = "default", size = "default", className = "", onClick, disabled, asChild, ...rest }) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90 bg-indigo-600 text-white hover:bg-indigo-700",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 bg-red-600 text-white hover:bg-red-700",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground border-gray-300 hover:bg-gray-50",
    ghost: "hover:bg-accent hover:text-accent-foreground hover:bg-gray-100",
  };
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
  };
  
  const classes = `${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`;
  
  if (asChild) {
    return React.cloneElement(children, { className: classes, ...rest });
  }
  
  return (
    <button className={classes} onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  );
};

const Card = ({ children, className = "" }) => (
  <div className={`rounded-lg border bg-card text-card-foreground shadow-sm bg-white border-gray-200 ${className}`}>
    {children}
  </div>
);

const CardContent = ({ children, className = "" }) => <div className={`p-6 ${className}`}>{children}</div>;
const CardHeader = ({ children, className = "" }) => <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>;
const CardTitle = ({ children, className = "" }) => <h3 className={`text-2xl font-semibold leading-none tracking-tight ${className}`}>{children}</h3>;
const Separator = () => <div className="shrink-0 bg-border h-[1px] w-full bg-gray-200" />;
const ScrollArea = ({ children, className }) => <div className={className} style={{ maxHeight: '60vh', overflow: 'auto' }}>{children}</div>;
const Badge = ({ children, className = "" }) => <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-gray-100 text-gray-900 ${className}`}>{children}</span>;

const Tooltip = ({ children }) => <span>{children}</span>;
const TooltipProvider = ({ children }) => <>{children}</>;
const TooltipTrigger = ({ children }) => <span>{children}</span>;
const TooltipContent = ({ children }) => <div>{children}</div>;

/*****************************************
 * StoreBuilder – Store-focused block editor
 * - Drag‑and‑drop store blocks (hero, products, social links)
 * - Live responsive preview 
 * - Firebase image upload
 * - PostgreSQL configuration storage
 * - Store handle management
 *****************************************/

// Trust Badge Icon Component
const TrustBadgeIcon = ({ type, className = "h-6 w-6 text-indigo-600" }) => {
  const icons = {
    shield: Shield,
    truck: Truck,
    return: RotateCcw,
    support: Headphones,
    warranty: Award,
    verified: BadgeCheck,
  };
  
  const IconComponent = icons[type] || Shield;
  return <IconComponent className={className} />;
};

// Conversion Insights Data
const CONVERSION_INSIGHTS = {
  storeHero: {
    conversionLift: "35-65%",
    placement: "Above the fold",
    psychologyPrinciple: "First Impression & Brand Authority",
    insights: [
      "Hero sections above the fold see 73% higher engagement rates",
      "Clear value proposition in hero increases conversions by 42%",
      "Professional hero images build trust and reduce bounce rate by 28%",
      "Strong headlines capture attention within 3 seconds of page load"
    ],
    bestPractices: [
      "Place most important information above 600px fold line",
      "Use high-quality, relevant imagery that supports your message",
      "Keep headlines under 10 words for maximum impact",
      "Include clear call-to-action button with contrasting colors"
    ],
    conversionFactors: {
      "Visual Appeal": "45%",
      "Clear Messaging": "35%", 
      "Trust Building": "20%"
    }
  },
  productGrid: {
    conversionLift: "25-40%",
    placement: "Above/Below the fold",
    psychologyPrinciple: "Choice Architecture & Social Proof",
    insights: [
      "Product grids with 3-4 items per row optimize decision-making",
      "Real product data increases purchase intent by 67%",
      "Price visibility upfront reduces cart abandonment by 31%",
      "Sale badges create urgency and boost click-through by 23%"
    ],
    bestPractices: [
      "Show 6-12 products maximum to avoid choice overload",
      "Use consistent image sizing and high-quality photos",
      "Display prices prominently with sale indicators",
      "Include quick 'Add to Cart' or 'View Details' buttons"
    ],
    conversionFactors: {
      "Product Visibility": "40%",
      "Pricing Clarity": "35%",
      "Choice Architecture": "25%"
    }
  },
  socialProof: {
    conversionLift: "15-35%",
    placement: "Bottom corner (floating)",
    psychologyPrinciple: "Social Proof & FOMO",
    insights: [
      "Live activity notifications increase conversions by 27%",
      "Recent purchase alerts create urgency and social validation",
      "Location-based social proof builds geographic trust",
      "Real-time activity reduces perceived risk by 34%"
    ],
    bestPractices: [
      "Position in bottom-left corner for maximum visibility without obstruction",
      "Show recent, believable activity (not overwhelming frequency)",
      "Include customer locations for geographic social proof",
      "Use subtle animations to catch peripheral attention"
    ],
    conversionFactors: {
      "Social Validation": "45%",
      "Urgency Creation": "30%",
      "Trust Building": "25%"
    }
  },
  reviewShowcase: {
    conversionLift: "45-70%",
    placement: "Above the fold (high impact zone)",
    psychologyPrinciple: "Social Proof & Trust Authority",
    insights: [
      "Reviews increase conversion rates by up to 270% for high-consideration purchases",
      "Star ratings provide immediate trust signals and credibility",
      "Verified reviews build 73% more trust than unverified testimonials",
      "Review integration with Endorsed.review adds third-party validation"
    ],
    bestPractices: [
      "Display 3-5 recent reviews for optimal trust without overwhelming",
      "Show star ratings prominently with overall score",
      "Include reviewer names and locations for authenticity",
      "Link to full review platform for transparency"
    ],
    conversionFactors: {
      "Trust Building": "50%",
      "Social Validation": "30%",
      "Risk Reduction": "20%"
    }
  },
  trustBadges: {
    conversionLift: "20-40%",
    placement: "Above the fold & checkout areas",
    psychologyPrinciple: "Risk Reduction & Security Assurance",
    insights: [
      "Security badges reduce checkout abandonment by 42%",
      "Trust indicators are most effective when placed near CTAs",
      "Multiple trust signals compound to create stronger confidence",
      "Shipping and return guarantees address top purchase concerns"
    ],
    bestPractices: [
      "Place security badges near payment information",
      "Use recognizable trust symbols (SSL, guarantees, support)",
      "Don't overcrowd - 4-6 badges maximum for credibility",
      "Position prominently but not overwhelmingly"
    ],
    conversionFactors: {
      "Security Assurance": "40%",
      "Risk Reduction": "35%",
      "Professional Credibility": "25%"
    }
  },
  customerStats: {
    conversionLift: "18-30%",
    placement: "Above the fold or social proof section",
    psychologyPrinciple: "Social Proof Through Numbers",
    insights: [
      "Large customer numbers create bandwagon effect",
      "High satisfaction percentages build confidence",
      "Geographic reach (countries served) implies reliability",
      "Specific numbers appear more credible than rounded figures"
    ],
    bestPractices: [
      "Use realistic, verifiable numbers",
      "Update statistics regularly to maintain accuracy",
      "Choose metrics that matter most to your audience",
      "Animate numbers on scroll for engagement"
    ],
    conversionFactors: {
      "Social Validation": "45%",
      "Scale Impression": "35%",
      "Credibility": "20%"
    }
  },
  faqSection: {
    conversionLift: "12-25%",
    placement: "Below the fold (pre-purchase)",
    psychologyPrinciple: "Objection Handling & Risk Reduction",
    insights: [
      "FAQs reduce support tickets by 60% and build pre-purchase confidence",
      "Addressing common concerns prevents cart abandonment",
      "Transparent policies build trust and reduce purchase anxiety",
      "Well-structured FAQs improve SEO and organic discovery"
    ],
    bestPractices: [
      "Address top 5-8 most common customer concerns",
      "Use clear, jargon-free language",
      "Include information about shipping, returns, and support",
      "Update based on actual customer questions"
    ],
    conversionFactors: {
      "Objection Handling": "50%",
      "Trust Building": "30%",
      "Information Clarity": "20%"
    }
  },
  urgencyBanner: {
    conversionLift: "40-85%",
    placement: "Top of page (sticky) or above CTA",
    psychologyPrinciple: "Scarcity & Loss Aversion",
    insights: [
      "Countdown timers can increase conversions by up to 332%",
      "Stock level indicators create immediate scarcity perception",
      "Time-sensitive offers trigger loss aversion psychology",
      "Urgency above the fold catches immediate attention"
    ],
    bestPractices: [
      "Use realistic timeframes that create urgency without skepticism",
      "Position prominently without blocking important content",
      "Combine time scarcity with stock scarcity for maximum effect",
      "Ensure offers are genuine to maintain trust"
    ],
    conversionFactors: {
      "Urgency Creation": "50%",
      "Loss Aversion": "30%",
      "Scarcity Psychology": "20%"
    }
  },
  chatbot: {
    conversionLift: "25-45%",
    placement: "Bottom right (floating, non-intrusive)",
    psychologyPrinciple: "Immediate Support & Personalization",
    insights: [
      "Live chat increases conversions by 40% through immediate assistance",
      "AI chatbots provide 24/7 support reducing purchase hesitation",
      "Personalized product recommendations increase average order value",
      "Instant answers to questions reduce cart abandonment"
    ],
    bestPractices: [
      "Position prominently but not obtrusively",
      "Program with store-specific knowledge and product details",
      "Offer proactive help during high-intent moments",
      "Maintain friendly, helpful tone matching your brand"
    ],
    conversionFactors: {
      "Immediate Support": "45%",
      "Personalization": "30%",
      "Convenience": "25%"
    }
  }
};

// Conversion Insights Tooltip Component (DISABLED - using Inspector panel instead)
const ConversionInsight_DISABLED = ({ blockType, children }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState('bottom');
  const tooltipRef = useRef(null);
  const insight = CONVERSION_INSIGHTS[blockType];
  
  if (!insight) return children;
  
  const handleMouseEnter = (e) => {
    setShowTooltip(true);
    
    // Calculate position to prevent going off screen
    const rect = e.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Check if tooltip would go off bottom of screen
    if (rect.bottom + 400 > viewportHeight) {
      setTooltipPosition('top');
    } else {
      setTooltipPosition('bottom');
    }
  };
  
  return (
    <div 
      className="relative inline-block w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      
      {showTooltip && (
        <div className={`absolute ${tooltipPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-1/2 transform -translate-x-1/2 z-50 w-80`}
             style={{ 
               left: '50%', 
               transform: `translateX(${tooltipPosition === 'right' ? '-10%' : tooltipPosition === 'left' ? '-90%' : '-50%'})`,
               maxWidth: '90vw'
             }}>
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-4 relative" ref={tooltipRef}>
            {/* Speech bubble arrow */}
            <div className={`absolute ${tooltipPosition === 'top' ? 'top-full' : '-top-2'} left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-l border-t border-gray-200 ${tooltipPosition === 'top' ? 'rotate-[-135deg]' : 'rotate-45'}`}></div>
            
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-gray-800">Conversion Insight</span>
              </div>
              <div className="text-lg font-bold text-green-600">+{insight.conversionLift}</div>
            </div>
            
            {/* Psychology Principle */}
            <div className="mb-3">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Psychology</div>
              <div className="text-sm font-medium text-indigo-700">{insight.psychologyPrinciple}</div>
            </div>
            
            {/* Placement */}
            <div className="mb-3">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Optimal Placement</div>
              <div className="text-sm text-gray-700">{insight.placement}</div>
            </div>
            
            {/* Top Insight */}
            <div className="mb-3">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Key Insight</div>
              <div className="text-sm text-gray-700 italic">"{insight.insights[0]}"</div>
            </div>
            
            {/* Conversion Factors */}
            <div className="space-y-2">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Impact Factors</div>
              {Object.entries(insight.conversionFactors).map(([factor, percentage]) => (
                <div key={factor} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">{factor}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: percentage }}
                      ></div>
                    </div>
                    <span className="text-xs font-medium text-gray-700">{percentage}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Theme-aware components
const ThemedButton = ({ theme, variant = 'primary', children, className = '', ...props }) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 hover:scale-105';
  
  let variantClasses = '';
  if (variant === 'primary') {
    variantClasses = 'text-white shadow-lg';
  } else if (variant === 'secondary') {
    variantClasses = 'text-white shadow-md';
  } else if (variant === 'outline') {
    variantClasses = 'border-2 bg-transparent hover:text-white';
  }
  
  const style = {
    background: variant === 'outline' ? 'transparent' : `linear-gradient(135deg, ${theme?.primary || '#4f46e5'}, ${theme?.secondary || '#06b6d4'})`,
    borderColor: variant === 'outline' ? (theme?.primary || '#4f46e5') : 'transparent',
    color: variant === 'outline' ? (theme?.primary || '#4f46e5') : 'white',
  };
  
  return (
    <button 
      className={`${baseClasses} ${variantClasses} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </button>
  );
};

const ThemedBadge = ({ theme, children, className = '', ...props }) => {
  const style = {
    background: `linear-gradient(135deg, ${theme?.primary || '#4f46e5'}, ${theme?.accent || '#10b981'})`,
    color: 'white',
  };
  
  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={style}
      {...props}
    >
      {children}
    </span>
  );
};

const ThemedGradient = ({ theme, className = '', children, ...props }) => {
  const style = {
    background: `linear-gradient(135deg, ${theme?.primary || '#4f46e5'}, ${theme?.secondary || '#06b6d4'})`,
  };
  
  return (
    <div 
      className={className}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
};

// ----- Store Block Registry ----- //
const STORE_BLOCKS = {
  storeHero: {
    name: "Store Hero",
    icon: Store,
    defaults: () => ({
      headline: "Welcome to my store",
      subhead: "Discover amazing products curated just for you",
      backgroundImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop",
      showLogo: true,
      logoText: "My Store",
      overlay: true,
      ctaText: "Shop Now",
      ctaLink: "#products",
      textColor: "white",
    }),
    render: ({ data, onChange, editable, theme }) => (
      <section className="relative overflow-hidden rounded-2xl border border-gray-200 h-96">
        {/* Background Image */}
        <img src={data.backgroundImage} alt="Store Hero" className="absolute inset-0 w-full h-full object-cover" />
        {data.overlay && <div className="absolute inset-0 bg-black/50" />}
        
        {/* Content */}
        <div className={`relative z-10 flex flex-col items-center justify-center h-full text-center px-8 ${data.textColor === 'white' ? 'text-white' : 'text-gray-900'}`}>
          {data.showLogo && (
            <h1
              contentEditable={editable}
              suppressContentEditableWarning={true}
              onBlur={(e) => onChange && onChange({ logoText: e.target.textContent })}
              className="text-2xl font-bold mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded px-2"
            >
              {data.logoText}
            </h1>
          )}
          
          <h2
            contentEditable={editable}
            suppressContentEditableWarning={true}
            onBlur={(e) => onChange && onChange({ headline: e.target.textContent })}
            className="text-4xl md:text-5xl font-bold mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded px-2"
          >
            {data.headline}
          </h2>
          
          <p
            contentEditable={editable}
            suppressContentEditableWarning={true}
            onBlur={(e) => onChange && onChange({ subhead: e.target.textContent })}
            className="text-lg md:text-xl mb-6 max-w-2xl focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-2"
          >
            {data.subhead}
          </p>
          
          <ThemedButton theme={theme} className="px-6 py-3 text-white">
            <a href={data.ctaLink}>{data.ctaText}</a>
          </ThemedButton>
        </div>
        
        {editable && (
          <UploadImage onUploaded={(url) => onChange && onChange({ backgroundImage: url })} />
        )}
      </section>
    ),
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <Field label="Store Name">
          <Input value={data.logoText} onChange={e => onChange({ logoText: e.target.value })} />
        </Field>
        <Field label="Headline">
          <Input value={data.headline} onChange={e => onChange({ headline: e.target.value })} />
        </Field>
        <Field label="Description">
          <Textarea value={data.subhead} onChange={e => onChange({ subhead: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CTA Text">
            <Input value={data.ctaText} onChange={e => onChange({ ctaText: e.target.value })} />
          </Field>
          <Field label="CTA Link">
            <Input value={data.ctaLink} onChange={e => onChange({ ctaLink: e.target.value })} />
          </Field>
        </div>
        <Field label="Background Image">
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input 
                value={data.backgroundImage} 
                onChange={e => onChange({ backgroundImage: e.target.value })} 
                placeholder="Enter image URL or upload image below"
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <UploadImageButton onUploaded={(url) => onChange({ backgroundImage: url })} />
              <span className="text-xs text-gray-500">Choose from your computer</span>
            </div>
          </div>
        </Field>
        <ToggleField label="Show Logo" checked={data.showLogo} onCheckedChange={(v) => onChange({ showLogo: v })} />
        <ToggleField label="Dark Overlay" checked={data.overlay} onCheckedChange={(v) => onChange({ overlay: v })} />
        <Field label="Text Color">
          <div className="flex gap-2">
            <Button size="sm" variant={data.textColor === "white" ? "default" : "outline"} onClick={() => onChange({ textColor: "white" })}>
              White
            </Button>
            <Button size="sm" variant={data.textColor === "dark" ? "default" : "outline"} onClick={() => onChange({ textColor: "dark" })}>
              Dark
            </Button>
          </div>
        </Field>
      </div>
    )
  },
  
  productGrid: {
    name: "Product Grid",
    icon: ShoppingBag,
    defaults: () => ({
      title: "Featured Products",
      description: "Check out our most popular items",
      layout: "grid", // grid, carousel, list
      columns: 3,
      showPrices: true,
      showDescription: true,
      productIds: [], // Will be populated from store's product selection
      products: [], // Actual product data loaded from API
    }),
    render: ({ data, onChange, editable, currentUserId }) => (
      <ProductGridRenderer 
        data={data} 
        onChange={onChange} 
        editable={editable} 
        currentUserId={currentUserId}
      />
    ),
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <Field label="Section Title">
          <Input value={data.title} onChange={e => onChange({ title: e.target.value })} />
        </Field>
        <Field label="Description">
          <Textarea value={data.description} onChange={e => onChange({ description: e.target.value })} />
        </Field>
        <Field label="Layout">
          <div className="flex gap-2">
            {["grid", "carousel", "list"].map(style => (
              <Button key={style} size="sm" variant={data.layout === style ? "default" : "outline"} onClick={() => onChange({ layout: style })}>
                {style}
              </Button>
            ))}
          </div>
        </Field>
        <Field label="Columns">
          <Slider value={[data.columns]} min={2} max={4} step={1} onValueChange={(v) => onChange({ columns: v[0] })} />
          <div className="text-xs text-gray-600 mt-1">{data.columns} columns</div>
        </Field>
        <ToggleField label="Show Prices" checked={data.showPrices} onCheckedChange={(v) => onChange({ showPrices: v })} />
        <ToggleField label="Show Descriptions" checked={data.showDescription} onCheckedChange={(v) => onChange({ showDescription: v })} />
        <Separator />
        <div className="space-y-3">
          <Label>Product Selection</Label>
          <p className="text-xs text-gray-600">
            Select which products to display in this grid. Products are loaded from your account.
          </p>
          {data.products && data.products.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {data.products.map((product) => (
                <div key={product.id} className="flex items-center space-x-2 p-2 border rounded">
                  <input
                    type="checkbox"
                    checked={data.productIds.includes(product.id)}
                    onChange={(e) => {
                      const productIds = e.target.checked 
                        ? [...data.productIds, product.id]
                        : data.productIds.filter(id => id !== product.id);
                      onChange({ productIds });
                    }}
                    className="rounded"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{product.title}</div>
                    <div className="text-xs text-gray-600">
                      £{typeof product.price === 'number' ? product.price.toFixed(2) : (product.priceCents / 100).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <ShoppingBag className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-600">No products found. Create some products first.</p>
              <Button size="sm" className="mt-2" onClick={() => window.location.href = '/#affiliate-add-product'}>
                Create Products
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  },
  
  socialLinks: {
    name: "Social Links",
    icon: Heart,
    defaults: () => ({
      title: "Follow Me",
      description: "Stay connected and get updates",
      style: "buttons", // buttons, icons, minimal
      links: [
        { id: uuidv4(), platform: "instagram", url: "", label: "Instagram" },
        { id: uuidv4(), platform: "facebook", url: "", label: "Facebook" },
        { id: uuidv4(), platform: "twitter", url: "", label: "Twitter" },
      ],
      alignment: "center",
    }),
    render: ({ data }) => (
      <section className="rounded-2xl border border-gray-200 bg-white p-8">
        <div className={`${data.alignment === "center" ? "text-center" : "text-left"} mb-6`}>
          <h3 className="text-xl font-bold mb-2">{data.title}</h3>
          <p className="text-gray-600">{data.description}</p>
        </div>
        
        <div className={`flex gap-4 ${data.alignment === "center" ? "justify-center" : "justify-start"}`}>
          {data.links.map((link) => (
            <a
              key={link.id}
              href={link.url || "#"}
              className={`inline-flex items-center gap-2 ${
                data.style === "buttons" 
                  ? "bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg" 
                  : data.style === "icons"
                  ? "bg-indigo-100 hover:bg-indigo-200 p-3 rounded-full"
                  : "text-indigo-600 hover:text-indigo-800"
              } transition-colors`}
            >
              <SocialIcon platform={link.platform} />
              {data.style === "buttons" && <span>{link.label}</span>}
            </a>
          ))}
        </div>
      </section>
    ),
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <Field label="Section Title">
          <Input value={data.title} onChange={e => onChange({ title: e.target.value })} />
        </Field>
        <Field label="Description">
          <Input value={data.description} onChange={e => onChange({ description: e.target.value })} />
        </Field>
        <Field label="Style">
          <div className="flex gap-2">
            {["buttons", "icons", "minimal"].map(style => (
              <Button key={style} size="sm" variant={data.style === style ? "default" : "outline"} onClick={() => onChange({ style })}>
                {style}
              </Button>
            ))}
          </div>
        </Field>
        <Field label="Alignment">
          <div className="flex gap-2">
            {["left", "center"].map(align => (
              <Button key={align} size="sm" variant={data.alignment === align ? "default" : "outline"} onClick={() => onChange({ alignment: align })}>
                {align}
              </Button>
            ))}
          </div>
        </Field>
        <Separator />
        <div className="space-y-3">
          {data.links.map((link, idx) => (
            <div key={link.id} className="p-3 rounded-lg border space-y-2">
              <Field label={`Link ${idx + 1} Platform`}>
                <select 
                  value={link.platform} 
                  onChange={e => {
                    const links = [...data.links];
                    links[idx] = { ...link, platform: e.target.value };
                    onChange({ links });
                  }}
                  className="w-full rounded-md border border-gray-200 px-2 py-1"
                >
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="twitter">Twitter</option>
                  <option value="youtube">YouTube</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="website">Website</option>
                </select>
              </Field>
              <Field label="URL">
                <Input 
                  value={link.url} 
                  onChange={e => {
                    const links = [...data.links];
                    links[idx] = { ...link, url: e.target.value };
                    onChange({ links });
                  }}
                  placeholder="https://..."
                />
              </Field>
              <Field label="Label">
                <Input 
                  value={link.label} 
                  onChange={e => {
                    const links = [...data.links];
                    links[idx] = { ...link, label: e.target.value };
                    onChange({ links });
                  }}
                />
              </Field>
              <div className="flex justify-between">
                <Button size="sm" variant="outline" onClick={() => {
                  const links = [...data.links];
                  links.splice(idx + 1, 0, { id: uuidv4(), platform: "instagram", url: "", label: "New Link" });
                  onChange({ links });
                }}>
                  Add Below
                </Button>
                <Button size="sm" variant="destructive" onClick={() => {
                  const links = data.links.filter((_, i) => i !== idx);
                  onChange({ links });
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },
  
  testimonials: {
    name: "Testimonials",
    icon: Users,
    defaults: () => ({
      title: "What Customers Say",
      description: "Don't just take our word for it",
      layout: "slider", // slider, grid
      testimonials: [
        { id: uuidv4(), name: "Sarah Johnson", text: "Amazing products and fantastic service!", rating: 5, avatar: "" },
        { id: uuidv4(), name: "Mike Chen", text: "High quality items that exceed expectations.", rating: 5, avatar: "" },
        { id: uuidv4(), name: "Emma Wilson", text: "Fast shipping and beautifully packaged.", rating: 5, avatar: "" },
      ],
    }),
    render: ({ data, onChange, editable }) => (
      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-8">
        <div className="text-center mb-8">
          <h3
            contentEditable={editable}
            suppressContentEditableWarning={true}
            onBlur={(e) => onChange && onChange({ title: e.target.textContent })}
            className="text-2xl font-bold mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded px-2"
          >
            {data.title}
          </h3>
          <p
            contentEditable={editable}
            suppressContentEditableWarning={true}
            onBlur={(e) => onChange && onChange({ description: e.target.textContent })}
            className="text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-2"
          >
            {data.description}
          </p>
        </div>
        
        <div className={`grid gap-6 ${data.layout === "grid" ? "md:grid-cols-3" : "md:grid-cols-1"}`}>
          {data.testimonials.map((testimonial) => (
            <div key={testimonial.id} className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center gap-1 mb-3">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-700 mb-4">"{testimonial.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  {testimonial.avatar ? (
                    <img src={testimonial.avatar} alt={testimonial.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-gray-600">{testimonial.name.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <div className="font-medium">{testimonial.name}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    ),
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <Field label="Section Title">
          <Input value={data.title} onChange={e => onChange({ title: e.target.value })} />
        </Field>
        <Field label="Description">
          <Input value={data.description} onChange={e => onChange({ description: e.target.value })} />
        </Field>
        <Field label="Layout">
          <div className="flex gap-2">
            {["slider", "grid"].map(layout => (
              <Button key={layout} size="sm" variant={data.layout === layout ? "default" : "outline"} onClick={() => onChange({ layout })}>
                {layout}
              </Button>
            ))}
          </div>
        </Field>
        <Separator />
        <div className="space-y-3">
          {data.testimonials.map((testimonial, idx) => (
            <div key={testimonial.id} className="p-3 rounded-lg border space-y-2">
              <Field label={`Testimonial ${idx + 1} Name`}>
                <Input 
                  value={testimonial.name} 
                  onChange={e => {
                    const testimonials = [...data.testimonials];
                    testimonials[idx] = { ...testimonial, name: e.target.value };
                    onChange({ testimonials });
                  }}
                />
              </Field>
              <Field label="Text">
                <Textarea 
                  value={testimonial.text} 
                  onChange={e => {
                    const testimonials = [...data.testimonials];
                    testimonials[idx] = { ...testimonial, text: e.target.value };
                    onChange({ testimonials });
                  }}
                />
              </Field>
              <Field label="Rating">
                <Slider 
                  value={[testimonial.rating]} 
                  min={1} 
                  max={5} 
                  step={1} 
                  onValueChange={v => {
                    const testimonials = [...data.testimonials];
                    testimonials[idx] = { ...testimonial, rating: v[0] };
                    onChange({ testimonials });
                  }}
                />
                <div className="text-xs text-gray-600 mt-1">{testimonial.rating} stars</div>
              </Field>
              <div className="flex justify-between">
                <Button size="sm" variant="outline" onClick={() => {
                  const testimonials = [...data.testimonials];
                  testimonials.splice(idx + 1, 0, { 
                    id: uuidv4(), 
                    name: "New Customer", 
                    text: "Great experience!",
                    rating: 5,
                    avatar: ""
                  });
                  onChange({ testimonials });
                }}>
                  Add Below
                </Button>
                <Button size="sm" variant="destructive" onClick={() => {
                  const testimonials = data.testimonials.filter((_, i) => i !== idx);
                  onChange({ testimonials });
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },

  chatbot: {
    name: "AI Chatbot",
    icon: Users,
    defaults: () => ({
      title: "Need Help?",
      placeholder: "Ask me anything about our products...",
      botName: "Store Assistant",
      prompt: "You are a helpful store assistant for our mirror and lighting store. Recommend products based on customer needs like room size, style preferences, budget, and use case. Be friendly, knowledgeable, and focus on helping customers find the perfect mirror or lighting solution.",
      recommendedProducts: [], // Product IDs to recommend
      products: [], // Available products to choose from
      enableProductRecommendations: true,
      autoRecommendBestSellers: true,
      recommendationTriggers: ["what do you recommend", "best", "popular", "suggestion", "help me choose"],
      position: "bottom-right", // bottom-right, bottom-left, bottom-center
      theme: "modern", // modern, minimal, bubble
      enabled: true,
      // Contact & Policy Settings
      includeContactDetails: true,
      contactEmail: "",
      contactPhone: "",
      contactHours: "Mon-Fri 9am-5pm",
      includeRefundPolicy: true,
      refundPolicyText: "We offer a 30-day money-back guarantee on all products.",
      // FAQ Settings
      includeFAQ: true,
      faqItems: [
        { question: "What are your delivery times?", answer: "Standard delivery takes 3-5 business days." },
        { question: "Do you offer international shipping?", answer: "Yes, we ship worldwide. International delivery takes 7-14 business days." },
        { question: "How can I track my order?", answer: "Once shipped, you'll receive an email with tracking information." }
      ]
    }),
    render: ({ data, onChange, editable, currentUserId }) => {
      const InteractiveChatbot = () => {
        const [messages, setMessages] = useState([
          { type: 'bot', text: 'Hi! I\'m here to help you find the perfect products. What are you looking for today?', timestamp: Date.now() }
        ]);
        const [input, setInput] = useState('');
        const [isTyping, setIsTyping] = useState(false);
        const [products, setProducts] = useState([]);
        const messagesEndRef = useRef(null);

        // Sample products for demo
        const sampleProducts = [
          { id: 1, title: "LED Smart Mirror", price: 199.99, rating: 4.8, reviews: 847, image: "mirror", category: "bathroom" },
          { id: 2, title: "Vintage Round Mirror", price: 89.99, rating: 4.6, reviews: 432, image: "round", category: "decorative" },
          { id: 3, title: "Full Length Mirror", price: 149.99, rating: 4.7, reviews: 623, image: "full", category: "bedroom" },
          { id: 4, title: "Backlit Vanity Mirror", price: 259.99, rating: 4.9, reviews: 321, image: "vanity", category: "bathroom" }
        ];

        // Load products when component mounts
        useEffect(() => {
          if (currentUserId && data.enableProductRecommendations) {
            loadUserProducts();
          } else {
            setProducts(sampleProducts);
          }
        }, [currentUserId, data.enableProductRecommendations]);

        // Auto-scroll to bottom of chatbot container only
        useEffect(() => {
          if (messagesEndRef.current) {
            const container = messagesEndRef.current.closest('.overflow-y-auto');
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          }
        }, [messages]);

        const loadUserProducts = async () => {
          try {
            const response = await apiCall('/api/member/products', {
              method: 'GET',
              headers: { 'x-member-uid': currentUserId }
            });
            if (response.ok) {
              const data_response = await response.json();
              // Handle new API response format
              const userProducts = data_response.products || data_response;
              setProducts(userProducts.length > 0 ? userProducts : sampleProducts);
            } else {
              setProducts(sampleProducts);
            }
          } catch (error) {
            console.log('Using sample products for demo');
            setProducts(sampleProducts);
          }
        };

        const getBotResponse = (userMessage) => {
          const message = userMessage.toLowerCase();
          
          // Check for FAQ matches first (if enabled)
          if (data.includeFAQ && data.faqItems && data.faqItems.length > 0) {
            for (const faq of data.faqItems) {
              // Check if the user's message matches any FAQ question keywords
              const questionWords = faq.question.toLowerCase().split(/\s+/);
              const matchingWords = questionWords.filter(word => 
                word.length > 3 && message.includes(word)
              );
              if (matchingWords.length >= 2 || message.includes(faq.question.toLowerCase().slice(0, 20))) {
                return { text: faq.answer };
              }
            }
          }
          
          // Check for contact/support related queries
          if (data.includeContactDetails && (
            message.includes('contact') || 
            message.includes('email') || 
            message.includes('phone') || 
            message.includes('call') ||
            message.includes('reach') ||
            message.includes('support') ||
            message.includes('hours') ||
            message.includes('when are you open')
          )) {
            let contactInfo = "You can reach us through the following:";
            if (data.contactEmail) contactInfo += `\n📧 Email: ${data.contactEmail}`;
            if (data.contactPhone) contactInfo += `\n📞 Phone: ${data.contactPhone}`;
            if (data.contactHours) contactInfo += `\n🕐 Hours: ${data.contactHours}`;
            return { text: contactInfo || "Please check our contact page for more information." };
          }
          
          // Check for refund/return related queries
          if (data.includeRefundPolicy && (
            message.includes('refund') || 
            message.includes('return') || 
            message.includes('money back') ||
            message.includes('exchange') ||
            message.includes('cancel')
          )) {
            return { 
              text: data.refundPolicyText || "We have a customer-friendly return policy. Please contact our support team for specific details about returns and refunds."
            };
          }
          
          // Check for recommendation triggers
          const needsRecommendation = data.recommendationTriggers && data.recommendationTriggers.some(trigger => 
            message.includes(trigger.toLowerCase())
          );

          if (needsRecommendation || message.includes('mirror') || message.includes('bathroom') || message.includes('recommend')) {
            const relevantProduct = products && products.length > 0 ? products.find(p => 
              message.includes('bathroom') ? p.category === 'bathroom' :
              message.includes('round') ? p.category === 'decorative' :
              message.includes('bedroom') ? p.category === 'bedroom' : true
            ) || products[0] : null;

            return {
              text: `Great question! I'd recommend our ${relevantProduct?.title || 'LED Smart Mirror'}. It's perfect for what you're looking for and very popular with our customers.`,
              product: relevantProduct
            };
          }

          // General responses
          const responses = [
            "That's a great question! Our mirrors are designed with quality and style in mind.",
            "I'd be happy to help you with that! What specific features are you looking for?",
            "Excellent choice! Our products come with a 2-year warranty and free shipping.",
            "Let me help you find the perfect solution for your needs."
          ];

          return { text: responses[Math.floor(Math.random() * responses.length)] };
        };

        const handleSend = () => {
          if (!input.trim()) return;

          const userMessage = { type: 'user', text: input, timestamp: Date.now() };
          setMessages(prev => [...prev, userMessage]);
          setInput('');
          setIsTyping(true);

          // Simulate bot thinking time
          setTimeout(() => {
            const botResponse = getBotResponse(input);
            const botMessage = { 
              type: 'bot', 
              text: botResponse.text, 
              product: botResponse.product, 
              timestamp: Date.now() 
            };
            setMessages(prev => [...prev, botMessage]);
            setIsTyping(false);
          }, 1000 + Math.random() * 1000);
        };

        return (
          <section className="rounded-2xl border border-gray-200 bg-white p-8">
            <div className="text-center mb-6">
              <h3
                contentEditable={editable}
                suppressContentEditableWarning={true}
                onBlur={(e) => onChange && onChange({ title: e.target.textContent })}
                className="text-xl font-bold mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded px-2"
              >
                {data.title}
              </h3>
              <p className="text-gray-600 mb-4">AI-powered customer support chatbot</p>
            </div>
            
            {/* Interactive Chatbot */}
            <div className="max-w-md mx-auto">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-t-lg p-3 text-white">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Users className="h-4 w-4" />
                  </div>
                  <span className="font-medium">{data.botName}</span>
                  <div className="ml-auto w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 border-x border-gray-200 h-64 overflow-y-auto">
                {messages.map((message, idx) => (
                  <div key={idx} className={`mb-3 ${message.type === 'user' ? 'flex justify-end' : ''}`}>
                    <div className={`rounded-lg p-3 max-w-xs ${
                      message.type === 'user' 
                        ? 'bg-indigo-500 text-white' 
                        : 'bg-white shadow-sm'
                    }`}>
                      <p className="text-sm">{message.text}</p>
                      
                      {/* Product recommendation card */}
                      {message.product && data.enableProductRecommendations && (
                        <div className="border border-gray-200 rounded-lg p-2 mt-2 bg-gray-50">
                          <div className="flex gap-2">
                            <div className="w-12 h-12 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-gray-400" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-medium">{message.product.title}</p>
                              <p className="text-xs text-gray-600">£{message.product.price}</p>
                              <p className="text-xs text-green-600">⭐ {message.product.rating} ({message.product.reviews} reviews)</p>
                            </div>
                          </div>
                          <div className="mt-2">
                            <button 
                              className="w-full bg-indigo-100 text-indigo-700 text-xs py-1 rounded hover:bg-indigo-200 transition-colors"
                              onClick={() => alert('Product details would open here in live store!')}
                            >
                              View Product
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="mb-3">
                    <div className="bg-white rounded-lg p-3 shadow-sm max-w-xs">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <div className="bg-white border border-gray-200 rounded-b-lg p-3">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={data.placeholder}
                    className="flex-1 text-sm p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button 
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="bg-indigo-500 text-white px-3 py-2 rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
            
            {data.enabled && (
              <div className="mt-4 text-center">
                <Badge className="bg-green-100 text-green-800">Chatbot Active - Try typing a message!</Badge>
              </div>
            )}
          </section>
        );
      };

      return <InteractiveChatbot />;
    },
    inspector: ({ data, onChange }) => (
        <div className="space-y-4">
          <Field label="Section Title">
            <Input value={data.title} onChange={e => onChange({ title: e.target.value })} />
          </Field>
          <Field label="Bot Name">
            <Input value={data.botName} onChange={e => onChange({ botName: e.target.value })} />
          </Field>
          <Field label="Input Placeholder">
            <Input value={data.placeholder} onChange={e => onChange({ placeholder: e.target.value })} />
          </Field>
          <Field label="Bot Personality & Instructions">
            <Textarea 
              value={data.prompt} 
              onChange={e => onChange({ prompt: e.target.value })} 
              placeholder="Describe how you want the chatbot to behave and what products to focus on..."
              rows={4}
            />
          </Field>
          
          <Separator />
          
          <ToggleField 
            label="Enable Product Recommendations" 
            checked={data.enableProductRecommendations} 
            onCheckedChange={(v) => onChange({ enableProductRecommendations: v })} 
          />
          
          {data.enableProductRecommendations && (
            <>
              <ToggleField 
                label="Auto-Recommend Best Sellers" 
                checked={data.autoRecommendBestSellers} 
                onCheckedChange={(v) => onChange({ autoRecommendBestSellers: v })} 
              />
              
              <Field label="Product Recommendation Settings">
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-700 mb-2">
                      💡 The AI will automatically recommend your products when customers ask questions about mirrors, home decor, or request suggestions.
                    </p>
                    <p className="text-xs text-gray-600">
                      Product selection and management will be available when editing this chatbot in your live store.
                    </p>
                  </div>
                  
                  <Field label="Recommendation Triggers">
                    <Textarea 
                      value={data.recommendationTriggers.join(', ')} 
                      onChange={e => onChange({ 
                        recommendationTriggers: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      })}
                      placeholder="recommend, best, popular, suggest, which mirror, bathroom mirror"
                      rows={2}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Keywords that trigger product suggestions (comma-separated)
                    </div>
                  </Field>
                </div>
              </Field>
            </>
          )}
          
          <Separator />
          
          {/* Contact Details Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              📞 Contact Information
            </h4>
            <ToggleField 
              label="Allow bot to share contact details" 
              checked={data.includeContactDetails} 
              onCheckedChange={(v) => onChange({ includeContactDetails: v })} 
            />
            
            {data.includeContactDetails && (
              <div className="space-y-2 pl-4 border-l-2 border-gray-200">
                <Field label="Contact Email">
                  <Input 
                    value={data.contactEmail || ''} 
                    onChange={e => onChange({ contactEmail: e.target.value })} 
                    placeholder="support@yourstore.com"
                  />
                </Field>
                <Field label="Contact Phone">
                  <Input 
                    value={data.contactPhone || ''} 
                    onChange={e => onChange({ contactPhone: e.target.value })} 
                    placeholder="+44 20 1234 5678"
                  />
                </Field>
                <Field label="Business Hours">
                  <Input 
                    value={data.contactHours || ''} 
                    onChange={e => onChange({ contactHours: e.target.value })} 
                    placeholder="Mon-Fri 9am-5pm"
                  />
                </Field>
              </div>
            )}
          </div>
          
          <Separator />
          
          {/* Refund Policy Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              💰 Returns & Refund Policy
            </h4>
            <ToggleField 
              label="Allow bot to discuss refund policy" 
              checked={data.includeRefundPolicy} 
              onCheckedChange={(v) => onChange({ includeRefundPolicy: v })} 
            />
            
            {data.includeRefundPolicy && (
              <Field label="Refund Policy Summary">
                <Textarea 
                  value={data.refundPolicyText || ''} 
                  onChange={e => onChange({ refundPolicyText: e.target.value })} 
                  placeholder="We offer a 30-day money-back guarantee on all products. Items must be unused and in original packaging."
                  rows={3}
                />
                <div className="text-xs text-gray-500 mt-1">
                  The bot will use this when customers ask about returns or refunds
                </div>
              </Field>
            )}
          </div>
          
          <Separator />
          
          {/* FAQ Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              ❓ Frequently Asked Questions
            </h4>
            <ToggleField 
              label="Enable automated FAQ responses" 
              checked={data.includeFAQ} 
              onCheckedChange={(v) => onChange({ includeFAQ: v })} 
            />
            
            {data.includeFAQ && (
              <div className="space-y-3">
                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                  Add common questions and answers. The chatbot will automatically respond when customers ask similar questions.
                </div>
                
                {(data.faqItems || []).map((faq, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg space-y-2 border border-gray-200">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-medium text-gray-700">FAQ #{index + 1}</span>
                      <button 
                        onClick={() => {
                          const newFaqs = [...(data.faqItems || [])];
                          newFaqs.splice(index, 1);
                          onChange({ faqItems: newFaqs });
                        }}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                    <Input 
                      value={faq.question} 
                      onChange={e => {
                        const newFaqs = [...(data.faqItems || [])];
                        newFaqs[index] = { ...newFaqs[index], question: e.target.value };
                        onChange({ faqItems: newFaqs });
                      }}
                      placeholder="What is your question?"
                      className="text-sm"
                    />
                    <Textarea 
                      value={faq.answer} 
                      onChange={e => {
                        const newFaqs = [...(data.faqItems || [])];
                        newFaqs[index] = { ...newFaqs[index], answer: e.target.value };
                        onChange({ faqItems: newFaqs });
                      }}
                      placeholder="Answer to this question..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                ))}
                
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    const newFaqs = [...(data.faqItems || []), { question: '', answer: '' }];
                    onChange({ faqItems: newFaqs });
                  }}
                  className="w-full"
                >
                  + Add FAQ Item
                </Button>
              </div>
            )}
          </div>
          
          <Separator />
          
          <Field label="Position">
            <div className="flex gap-2">
              {["bottom-right", "bottom-left", "bottom-center"].map(pos => (
                <Button key={pos} size="sm" variant={data.position === pos ? "default" : "outline"} onClick={() => onChange({ position: pos })}>
                  {pos.replace('-', ' ')}
                </Button>
              ))}
            </div>
          </Field>
          <Field label="Theme">
            <div className="flex gap-2">
              {["modern", "minimal", "bubble"].map(theme => (
                <Button key={theme} size="sm" variant={data.theme === theme ? "default" : "outline"} onClick={() => onChange({ theme })}>
                  {theme}
                </Button>
              ))}
            </div>
          </Field>
          <ToggleField label="Enable Chatbot" checked={data.enabled} onCheckedChange={(v) => onChange({ enabled: v })} />
          
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              🤖 The AI chatbot will recommend your products when customers ask for suggestions, helping increase sales conversions.
            </p>
          </div>
        </div>
      )
  },

  // Real-time social proof notifications
  socialProof: {
    name: "Live Activity",
    icon: Sparkles,
    defaults: () => ({
      title: "Recent Activity",
      notifications: [
        { id: 1, type: "purchase", message: "Sarah from London just purchased Lumina Mirror", time: "2 minutes ago" },
        { id: 2, type: "signup", message: "Mike just joined our newsletter", time: "5 minutes ago" },
        { id: 3, type: "review", message: "Emma left a ⭐⭐⭐⭐⭐ review", time: "8 minutes ago" },
      ],
      position: "bottom-left",
      animationSpeed: 5000,
      showCustomerLocations: true,
      enabled: true,
    }),
    render: ({ data, onChange, editable }) => (
      <section className="rounded-2xl border border-gray-200 bg-white p-8">
        <div className="text-center mb-6">
          <h3
            contentEditable={editable}
            suppressContentEditableWarning={true}
            onBlur={(e) => onChange && onChange({ title: e.target.textContent })}
            className="text-xl font-bold mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded px-2"
          >
            {data.title}
          </h3>
          <p className="text-gray-600 mb-4">Build trust with real-time activity notifications</p>
        </div>
        
        <div className="space-y-3 max-w-sm mx-auto">
          {data.notifications.slice(0, 3).map((notification) => (
            <div key={notification.id} className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  {notification.type === 'purchase' && <ShoppingBag className="h-4 w-4 text-white" />}
                  {notification.type === 'signup' && <Mail className="h-4 w-4 text-white" />}
                  {notification.type === 'review' && <Star className="h-4 w-4 text-white" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{notification.message}</p>
                  <p className="text-xs text-gray-600 mt-1">{notification.time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {data.enabled && (
          <div className="mt-4 text-center">
            <Badge className="bg-green-100 text-green-800">Live Activity Enabled</Badge>
          </div>
        )}
      </section>
    ),
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <Field label="Section Title">
          <Input value={data.title} onChange={e => onChange({ title: e.target.value })} />
        </Field>
        <Field label="Position">
          <div className="grid grid-cols-2 gap-2">
            {["bottom-left", "bottom-right", "top-left", "top-right"].map(pos => (
              <Button key={pos} size="sm" variant={data.position === pos ? "default" : "outline"} onClick={() => onChange({ position: pos })}>
                {pos.replace('-', ' ')}
              </Button>
            ))}
          </div>
        </Field>
        <Field label="Animation Speed">
          <Slider 
            value={[data.animationSpeed]} 
            min={2000} 
            max={10000} 
            step={500} 
            onValueChange={v => onChange({ animationSpeed: v[0] })}
          />
          <div className="text-xs text-gray-600 mt-1">{data.animationSpeed / 1000}s between notifications</div>
        </Field>
        <ToggleField label="Show Customer Locations" checked={data.showCustomerLocations} onCheckedChange={(v) => onChange({ showCustomerLocations: v })} />
        <ToggleField label="Enable Live Activity" checked={data.enabled} onCheckedChange={(v) => onChange({ enabled: v })} />
      </div>
    )
  },

  // Review showcase with Endorsed.Review integration
  reviewShowcase: {
    name: "Review Showcase",
    icon: Star,
    defaults: () => ({
      title: "Verified Reviews",
      subtitle: "See what our customers say",
      endorsedReviewUrl: "https://endorsed.review/#/biz/fotonix",
      showEndorsedBadge: true,
      overallRating: 4.9,
      totalReviews: 1247,
      displayStyle: "cards", // cards, testimonials, compact
      featuredReviews: [
        { id: 1, name: "Sarah Johnson", rating: 5, text: "Amazing quality and fast delivery!", verified: true, location: "London, UK" },
        { id: 2, name: "Mike Chen", rating: 5, text: "Exceeded expectations. Great customer service!", verified: true, location: "Manchester, UK" },
        { id: 3, name: "Emma Wilson", rating: 5, text: "Perfect for my home office setup.", verified: true, location: "Birmingham, UK" },
      ],
    }),
    render: ({ data, onChange, editable }) => (
      <section className="rounded-2xl border border-gray-200 bg-white p-8">
        <div className="text-center mb-8">
          <h3
            contentEditable={editable}
            suppressContentEditableWarning={true}
            onBlur={(e) => onChange && onChange({ title: e.target.textContent })}
            className="text-2xl font-bold mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded px-2"
          >
            {data.title}
          </h3>
          <p
            contentEditable={editable}
            suppressContentEditableWarning={true}
            onBlur={(e) => onChange && onChange({ subtitle: e.target.textContent })}
            className="text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-2"
          >
            {data.subtitle}
          </p>
        </div>

        {/* Endorsed.Review Integration */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {data.showEndorsedBadge && (
            <a href={data.endorsedReviewUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src="/endorsed.svg" alt="Endorsed.Review" className="h-8" />
            </a>
          )}
          <div className="flex items-center gap-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`h-5 w-5 ${i < Math.floor(data.overallRating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
              ))}
            </div>
            <span className="font-bold text-lg">{data.overallRating}</span>
            <span className="text-gray-600">({data.totalReviews.toLocaleString()} reviews)</span>
          </div>
        </div>

        {/* Featured Reviews */}
        <div className="grid md:grid-cols-3 gap-6">
          {data.featuredReviews.map((review) => (
            <div key={review.id} className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center gap-1 mb-3">
                {[...Array(review.rating)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-700 mb-4">"{review.text}"</p>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{review.name}</div>
                  <div className="text-xs text-gray-600">{review.location}</div>
                </div>
                {review.verified && (
                  <Badge className="bg-green-100 text-green-800 text-xs">Verified</Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-6">
          <a 
            href={data.endorsedReviewUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            View all reviews →
          </a>
        </div>
      </section>
    ),
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <Field label="Section Title">
          <Input value={data.title} onChange={e => onChange({ title: e.target.value })} />
        </Field>
        <Field label="Subtitle">
          <Input value={data.subtitle} onChange={e => onChange({ subtitle: e.target.value })} />
        </Field>
        <Field label="Endorsed.Review URL">
          <Input value={data.endorsedReviewUrl} onChange={e => onChange({ endorsedReviewUrl: e.target.value })} placeholder="https://endorsed.review/biz/yourstore" />
        </Field>
        <Field label="Overall Rating">
          <Slider value={[data.overallRating]} min={1} max={5} step={0.1} onValueChange={v => onChange({ overallRating: v[0] })} />
          <div className="text-xs text-gray-600 mt-1">{data.overallRating.toFixed(1)} stars</div>
        </Field>
        <Field label="Total Reviews">
          <Input type="number" value={data.totalReviews} onChange={e => onChange({ totalReviews: parseInt(e.target.value) || 0 })} />
        </Field>
        <ToggleField label="Show Endorsed.Review Badge" checked={data.showEndorsedBadge} onCheckedChange={(v) => onChange({ showEndorsedBadge: v })} />
      </div>
    )
  },

  // Trust badges and security indicators
  trustBadges: {
    name: "Trust & Security",
    icon: CheckCircle2,
    defaults: () => ({
      title: "Shop with Confidence",
      layout: "grid", // grid, horizontal, vertical
      badges: [
        { id: 1, icon: "shield", title: "Secure Checkout", subtitle: "256-bit SSL encryption" },
        { id: 2, icon: "truck", title: "Fast Shipping", subtitle: "2-3 business days" },
        { id: 3, icon: "return", title: "30-Day Returns", subtitle: "Hassle-free returns" },
        { id: 4, icon: "support", title: "24/7 Support", subtitle: "Always here to help" },
        { id: 5, icon: "warranty", title: "12-Month Warranty", subtitle: "Quality guaranteed" },
        { id: 6, icon: "verified", title: "Verified Reviews", subtitle: "Real customer feedback" },
      ],
      showAsSection: true,
      compactMode: false,
    }),
    render: ({ data, onChange, editable }) => (
      <section className="rounded-2xl border border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-8">
        <div className="text-center mb-8">
          <h3
            contentEditable={editable}
            suppressContentEditableWarning={true}
            onBlur={(e) => onChange && onChange({ title: e.target.textContent })}
            className="text-2xl font-bold mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded px-2"
          >
            {data.title}
          </h3>
        </div>

        <div className={`grid ${data.layout === 'grid' ? 'md:grid-cols-3 lg:grid-cols-6' : data.layout === 'horizontal' ? 'grid-cols-2 md:grid-cols-6' : 'grid-cols-1'} gap-6`}>
          {data.badges.map((badge) => (
            <div key={badge.id} className="flex flex-col items-center text-center p-4 bg-white rounded-lg shadow-sm">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-3">
                <TrustBadgeIcon type={badge.icon} />
              </div>
              <h4 className="font-semibold text-sm mb-1">{badge.title}</h4>
              <p className="text-xs text-gray-600">{badge.subtitle}</p>
            </div>
          ))}
        </div>
      </section>
    ),
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <Field label="Section Title">
          <Input value={data.title} onChange={e => onChange({ title: e.target.value })} />
        </Field>
        <Field label="Layout">
          <div className="flex gap-2">
            {["grid", "horizontal", "vertical"].map(layout => (
              <Button key={layout} size="sm" variant={data.layout === layout ? "default" : "outline"} onClick={() => onChange({ layout })}>
                {layout}
              </Button>
            ))}
          </div>
        </Field>
        <ToggleField label="Compact Mode" checked={data.compactMode} onCheckedChange={(v) => onChange({ compactMode: v })} />
      </div>
    )
  },

  // Customer counter and statistics
  customerStats: {
    name: "Customer Stats",
    icon: Users,
    defaults: () => ({
      title: "Join Thousands of Happy Customers",
      stats: [
        { id: 1, number: 12500, label: "Happy Customers", suffix: "+" },
        { id: 2, number: 98, label: "Satisfaction Rate", suffix: "%" },
        { id: 3, number: 50, label: "Countries Served", suffix: "+" },
        { id: 4, number: 4.9, label: "Average Rating", suffix: "/5" },
      ],
      animateNumbers: true,
      layout: "horizontal", // horizontal, vertical, compact
    }),
    render: ({ data, onChange, editable }) => (
      <section className="rounded-2xl border border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50 p-8">
        <div className="text-center mb-8">
          <h3
            contentEditable={editable}
            suppressContentEditableWarning={true}
            onBlur={(e) => onChange && onChange({ title: e.target.textContent })}
            className="text-2xl font-bold mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded px-2"
          >
            {data.title}
          </h3>
        </div>

        <div className={`grid ${data.layout === 'horizontal' ? 'md:grid-cols-4' : data.layout === 'vertical' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1'} gap-8`}>
          {data.stats.map((stat) => (
            <div key={stat.id} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-green-600 mb-2">
                {stat.number.toLocaleString()}{stat.suffix}
              </div>
              <div className="text-gray-600 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>
    ),
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <Field label="Section Title">
          <Input value={data.title} onChange={e => onChange({ title: e.target.value })} />
        </Field>
        <Field label="Layout">
          <div className="flex gap-2">
            {["horizontal", "vertical", "compact"].map(layout => (
              <Button key={layout} size="sm" variant={data.layout === layout ? "default" : "outline"} onClick={() => onChange({ layout })}>
                {layout}
              </Button>
            ))}
          </div>
        </Field>
        <ToggleField label="Animate Numbers" checked={data.animateNumbers} onCheckedChange={(v) => onChange({ animateNumbers: v })} />
      </div>
    )
  },

  // FAQ section for trust building
  faqSection: {
    name: "FAQ Section",
    icon: ArrowUpRight,
    defaults: () => ({
      title: "Frequently Asked Questions",
      subtitle: "Everything you need to know",
      faqs: [
        { id: 1, question: "How long does shipping take?", answer: "We typically ship within 2-3 business days. Standard delivery takes 3-5 business days." },
        { id: 2, question: "What's your return policy?", answer: "We offer a 30-day hassle-free return policy. If you're not satisfied, we'll refund your purchase." },
        { id: 3, question: "Do you offer international shipping?", answer: "Yes, we ship to over 50 countries worldwide. Shipping costs vary by location." },
        { id: 4, question: "Is my payment information secure?", answer: "Absolutely. We use 256-bit SSL encryption and never store your payment details." },
        { id: 5, question: "Do you offer customer support?", answer: "Yes, our customer support team is available 24/7 via chat, email, or phone." },
      ],
      layout: "accordion", // accordion, grid, minimal
      defaultOpen: 0, // Which FAQ is open by default
    }),
    render: ({ data, onChange, editable }) => (
      <section className="rounded-2xl border border-gray-200 bg-white p-8">
        <div className="text-center mb-8">
          <h3
            contentEditable={editable}
            suppressContentEditableWarning={true}
            onBlur={(e) => onChange && onChange({ title: e.target.textContent })}
            className="text-2xl font-bold mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded px-2"
          >
            {data.title}
          </h3>
          <p
            contentEditable={editable}
            suppressContentEditableWarning={true}
            onBlur={(e) => onChange && onChange({ subtitle: e.target.textContent })}
            className="text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-2"
          >
            {data.subtitle}
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {data.faqs.map((faq, index) => (
            <div key={faq.id} className="border border-gray-200 rounded-lg">
              <button className="w-full px-6 py-4 text-left font-medium flex items-center justify-between hover:bg-gray-50">
                <span>{faq.question}</span>
                <Plus className="h-4 w-4 text-gray-400" />
              </button>
              {index === data.defaultOpen && (
                <div className="px-6 pb-4 text-gray-600">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    ),
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <Field label="Section Title">
          <Input value={data.title} onChange={e => onChange({ title: e.target.value })} />
        </Field>
        <Field label="Subtitle">
          <Input value={data.subtitle} onChange={e => onChange({ subtitle: e.target.value })} />
        </Field>
        <Field label="Layout">
          <div className="flex gap-2">
            {["accordion", "grid", "minimal"].map(layout => (
              <Button key={layout} size="sm" variant={data.layout === layout ? "default" : "outline"} onClick={() => onChange({ layout })}>
                {layout}
              </Button>
            ))}
          </div>
        </Field>
      </div>
    )
  },

  // Advanced urgency and scarcity system
  urgencyBanner: {
    name: "Urgency Banner",
    icon: ArrowUpRight,
    defaults: () => ({
      // Basic settings
      type: "countdown", // countdown, stock, promotion, flash_sale
      style: "banner", // banner, floating, sticky
      position: "top", // top, bottom (for sticky)
      enabled: true,
      
      // Countdown timer settings
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16), // 24 hours from now
      endTime: "23:59",
      timezone: "GMT",
      
      // Stock level settings
      totalStock: 100,
      currentStock: 12,
      showPercentage: true,
      lowStockThreshold: 20,
      
      // Messages for different states
      messages: {
        countdown: "⏰ Sale ends in {time} - Don't miss out!",
        stock: "🔥 Only {stock} left in stock - Order now!",
        promotion: "💥 Limited time offer - Free shipping on orders over £50!",
        flash_sale: "⚡ Flash Sale: 40% off everything for the next {time}!"
      },
      
      // Visual settings
      urgencyColor: "high", // high (red), medium (orange), low (yellow)
      showIcon: true,
      showProgress: true, // For stock levels
      animateNumbers: true,
      
      // Advanced settings
      hideWhenExpired: true,
      redirectOnExpire: false,
      redirectUrl: "",
    }),
    render: ({ data, onChange, editable, theme }) => {
      // Ensure messages object exists with fallbacks
      const defaultMessages = {
        countdown: "⏰ Sale ends in {time} - Don't miss out!",
        stock: "🔥 Only {stock} left in stock - Order now!",
        promotion: "💥 Limited time offer - Free shipping on orders over £50!",
        flash_sale: "⚡ Flash Sale: 40% off everything for the next {time}!"
      };
      
      // Merge with existing messages or use defaults
      const messages = { ...defaultMessages, ...(data.messages || {}) };
      
      // Ensure required fields exist with fallbacks
      const safeData = {
        type: data.type || 'promotion',
        endDate: data.endDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        endTime: data.endTime || '23:59',
        totalStock: data.totalStock || 100,
        currentStock: data.currentStock || 12,
        lowStockThreshold: data.lowStockThreshold || 20,
        urgencyColor: data.urgencyColor || 'high',
        showIcon: data.showIcon !== undefined ? data.showIcon : true,
        showProgress: data.showProgress !== undefined ? data.showProgress : true,
        showPercentage: data.showPercentage !== undefined ? data.showPercentage : true,
        animateNumbers: data.animateNumbers !== undefined ? data.animateNumbers : true,
        hideWhenExpired: data.hideWhenExpired !== undefined ? data.hideWhenExpired : true,
        ...data
      };
      
      // Calculate current values
      const now = new Date();
      const endDateTime = new Date(`${safeData.endDate}T${safeData.endTime}`);
      const timeLeft = Math.max(0, endDateTime - now);
      const expired = timeLeft <= 0;
      
      // Format time remaining
      const formatTime = (ms) => {
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));
        const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((ms % (1000 * 60)) / 1000);
        
        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
        return `${minutes}m ${seconds}s`;
      };
      
      // Get stock percentage
      const stockPercentage = ((safeData.totalStock - safeData.currentStock) / safeData.totalStock) * 100;
      const isLowStock = safeData.currentStock <= safeData.lowStockThreshold;
      
      // Generate message based on type
      let displayMessage = messages[safeData.type] || messages.promotion;
      if (safeData.type === 'countdown' || safeData.type === 'flash_sale') {
        displayMessage = displayMessage.replace('{time}', formatTime(timeLeft));
      } else if (safeData.type === 'stock') {
        displayMessage = displayMessage.replace('{stock}', safeData.currentStock);
      }
      
      // Don't render if expired and hideWhenExpired is true
      if (expired && safeData.hideWhenExpired && (safeData.type === 'countdown' || safeData.type === 'flash_sale')) {
        return null;
      }
      
      // Theme-based colors
      const getUrgencyColors = () => {
        const baseStyle = {
          background: `linear-gradient(135deg, ${theme?.primary || '#dc2626'}, ${theme?.secondary || '#ea580c'})`,
          color: 'white'
        };
        
        if (safeData.urgencyColor === 'high') {
          return {
            background: 'linear-gradient(135deg, #dc2626, #b91c1c)', // red
            color: 'white'
          };
        } else if (safeData.urgencyColor === 'medium') {
          return {
            background: 'linear-gradient(135deg, #ea580c, #c2410c)', // orange
            color: 'white'
          };
        } else if (safeData.urgencyColor === 'low') {
          return {
            background: 'linear-gradient(135deg, #eab308, #ca8a04)', // yellow
            color: 'white'
          };
        }
        
        return baseStyle;
      };
      
      const urgencyStyles = getUrgencyColors();
      
      return (
        <section className={`rounded-2xl border border-gray-200 overflow-hidden ${
          safeData.style === 'floating' ? 'shadow-2xl' : 
          safeData.style === 'sticky' ? 'sticky z-50' : ''
        } ${safeData.style === 'sticky' && safeData.position === 'top' ? 'top-0' : ''} ${
          safeData.style === 'sticky' && safeData.position === 'bottom' ? 'bottom-0' : ''
        }`}>
          
          {/* Main Banner */}
          <div className="relative" style={urgencyStyles}>
            {/* Animated background for extra urgency */}
            {(safeData.type === 'countdown' || safeData.type === 'flash_sale') && !expired && (
              <div className="absolute inset-0 opacity-20">
                <div className="animate-pulse bg-white/10 h-full"></div>
              </div>
            )}
            
            <div className="relative p-4 text-center">
              {/* Icon */}
              {safeData.showIcon && (
                <div className="inline-flex items-center justify-center mb-2">
                  {safeData.type === 'countdown' && <ArrowUpRight className="h-5 w-5 mr-2 animate-bounce" />}
                  {safeData.type === 'stock' && <ShoppingBag className="h-5 w-5 mr-2" />}
                  {safeData.type === 'flash_sale' && <Zap className="h-5 w-5 mr-2 animate-pulse" />}
                </div>
              )}
              
              {/* Main Message */}
              <div className="font-bold text-lg mb-2">
                {editable ? (
                  <input
                    type="text"
                    value={displayMessage}
                    onChange={(e) => onChange && onChange({ 
                      messages: { ...messages, [safeData.type]: e.target.value }
                    })}
                    className="bg-transparent border-none text-center w-full focus:outline-none focus:ring-2 focus:ring-white/30 rounded px-2"
                    style={{ color: 'inherit' }}
                  />
                ) : (
                  <span>{displayMessage}</span>
                )}
              </div>
              
              {/* Countdown Display */}
              {(safeData.type === 'countdown' || safeData.type === 'flash_sale') && !expired && (
                <div className="flex items-center justify-center gap-4 mb-2">
                  {formatTime(timeLeft).split(' ').map((segment, idx) => (
                    <div key={idx} className="bg-black/20 rounded-lg px-3 py-1">
                      <span className={`text-2xl font-mono font-bold ${safeData.animateNumbers ? 'animate-pulse' : ''}`}>
                        {segment}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Stock Progress Bar */}
              {safeData.type === 'stock' && safeData.showProgress && (
                <div className="max-w-xs mx-auto mb-2">
                  <div className="bg-black/20 rounded-full h-3 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${
                        isLowStock ? 'bg-red-400 animate-pulse' : 'bg-yellow-400'
                      }`}
                      style={{ width: `${Math.min(100, stockPercentage)}%` }}
                    />
                  </div>
                  {safeData.showPercentage && (
                    <div className="text-sm mt-1 opacity-90">
                      {Math.round(stockPercentage)}% sold
                    </div>
                  )}
                </div>
              )}
              
              {/* Expired State */}
              {expired && (safeData.type === 'countdown' || safeData.type === 'flash_sale') && !safeData.hideWhenExpired && (
                <div className="text-lg font-bold animate-pulse">
                  ⏰ This offer has expired
                </div>
              )}
            </div>
          </div>
          
          {/* Status Indicator for Editing */}
          {editable && safeData.enabled && (
            <div className="p-3 bg-gray-50 text-center">
              <ThemedBadge theme={theme}>
                {safeData.type === 'countdown' && !expired && `⏰ Ends ${endDateTime.toLocaleDateString()}`}
                {safeData.type === 'stock' && `📦 ${safeData.currentStock}/${safeData.totalStock} remaining`}
                {safeData.type === 'promotion' && '💥 Promotion Active'}
                {safeData.type === 'flash_sale' && !expired && '⚡ Flash Sale Active'}
                {expired && '⚠️ Expired'}
              </ThemedBadge>
            </div>
          )}
        </section>
      );
    },
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <Field label="Urgency Type">
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "countdown", label: "Countdown Timer", icon: "⏰" },
              { key: "stock", label: "Stock Levels", icon: "📦" },
              { key: "flash_sale", label: "Flash Sale", icon: "⚡" },
              { key: "promotion", label: "Promotion", icon: "💥" }
            ].map(({ key, label, icon }) => (
              <Button 
                key={key} 
                size="sm" 
                variant={data.type === key ? "default" : "outline"} 
                onClick={() => onChange({ type: key })}
                className="flex items-center gap-1"
              >
                <span>{icon}</span>
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
          </div>
        </Field>

        {/* Countdown Settings */}
        {(data.type === 'countdown' || data.type === 'flash_sale') && (
          <>
            <Field label="End Date & Time">
              <div className="space-y-2">
                <Input 
                  type="datetime-local" 
                  value={data.endDate + 'T' + data.endTime} 
                  onChange={(e) => {
                    const [date, time] = e.target.value.split('T');
                    onChange({ endDate: date, endTime: time });
                  }}
                />
                <select 
                  value={data.timezone} 
                  onChange={(e) => onChange({ timezone: e.target.value })}
                  className="w-full rounded-md border border-gray-200 px-2 py-1"
                >
                  <option value="GMT">GMT (London)</option>
                  <option value="EST">EST (New York)</option>
                  <option value="PST">PST (Los Angeles)</option>
                  <option value="CET">CET (Paris)</option>
                </select>
              </div>
            </Field>
            <ToggleField label="Hide when expired" checked={data.hideWhenExpired} onCheckedChange={(v) => onChange({ hideWhenExpired: v })} />
          </>
        )}

        {/* Stock Settings */}
        {data.type === 'stock' && (
          <>
            <Field label="Stock Levels">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Current Stock</Label>
                    <Input 
                      type="number" 
                      value={data.currentStock} 
                      onChange={(e) => onChange({ currentStock: parseInt(e.target.value) || 0 })} 
                      min="0"
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">Total Stock</Label>
                    <Input 
                      type="number" 
                      value={data.totalStock} 
                      onChange={(e) => onChange({ totalStock: parseInt(e.target.value) || 100 })} 
                      min="1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Low Stock Threshold</Label>
                  <Input 
                    type="number" 
                    value={data.lowStockThreshold} 
                    onChange={(e) => onChange({ lowStockThreshold: parseInt(e.target.value) || 10 })} 
                    min="1"
                  />
                </div>
              </div>
            </Field>
            <ToggleField label="Show Progress Bar" checked={data.showProgress} onCheckedChange={(v) => onChange({ showProgress: v })} />
            <ToggleField label="Show Percentage Sold" checked={data.showPercentage} onCheckedChange={(v) => onChange({ showPercentage: v })} />
          </>
        )}

        <Field label="Urgency Level">
          <div className="flex gap-2">
            {[
              { key: "high", label: "High", color: "bg-red-500" },
              { key: "medium", label: "Medium", color: "bg-orange-500" },
              { key: "low", label: "Low", color: "bg-yellow-500" }
            ].map(({ key, label, color }) => (
              <Button 
                key={key} 
                size="sm" 
                variant={data.urgencyColor === key ? "default" : "outline"} 
                onClick={() => onChange({ urgencyColor: key })}
                className="flex items-center gap-2"
              >
                <div className={`w-3 h-3 rounded-full ${color}`}></div>
                {label}
              </Button>
            ))}
          </div>
        </Field>

        <Field label="Display Style">
          <div className="flex gap-2">
            {["banner", "floating", "sticky"].map(style => (
              <Button key={style} size="sm" variant={data.style === style ? "default" : "outline"} onClick={() => onChange({ style })}>
                {style}
              </Button>
            ))}
          </div>
        </Field>

        {data.style === 'sticky' && (
          <Field label="Sticky Position">
            <div className="flex gap-2">
              {["top", "bottom"].map(pos => (
                <Button key={pos} size="sm" variant={data.position === pos ? "default" : "outline"} onClick={() => onChange({ position: pos })}>
                  {pos}
                </Button>
              ))}
            </div>
          </Field>
        )}

        <Field label="Custom Message">
          <Textarea 
            value={(data.messages && data.messages[data.type]) || ''} 
            onChange={(e) => onChange({ 
              messages: { 
                ...(data.messages || {}), 
                [data.type]: e.target.value 
              }
            })}
            placeholder="Use {time} for countdown, {stock} for stock levels"
            rows={2}
          />
          <div className="text-xs text-gray-500 mt-1">
            Variables: {data.type === 'countdown' || data.type === 'flash_sale' ? '{time}' : data.type === 'stock' ? '{stock}' : 'No variables available'}
          </div>
        </Field>

        <ToggleField label="Show Icon" checked={data.showIcon} onCheckedChange={(v) => onChange({ showIcon: v })} />
        <ToggleField label="Animate Numbers" checked={data.animateNumbers} onCheckedChange={(v) => onChange({ animateNumbers: v })} />
        <ToggleField label="Enable Banner" checked={data.enabled} onCheckedChange={(v) => onChange({ enabled: v })} />
      </div>
    )
  },

  // Featured Product - Large showcase block
  featuredProduct: {
    name: "Featured Product",
    icon: Star,
    defaults: () => ({
      // Product details
      productTitle: "Premium LED Smart Mirror",
      productSubtitle: "Transform Your Space with Intelligence",
      originalPrice: 299.99,
      salePrice: 199.99,
      currency: "£",
      productDescription: "Experience the future of mirrors with our smart LED technology. Features voice control, weather updates, and premium lighting that adapts to any environment.",
      
      // Images
      mainImage: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&auto=format&fit=crop",
      galleryImages: [
        "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&auto=format&fit=crop"
      ],
      
      // Reviews and social proof
      rating: 4.8,
      totalReviews: 2847,
      showReviews: true,
      featuredReviews: [
        { name: "Sarah M.", text: "Absolutely love this mirror! The smart features work flawlessly.", rating: 5, verified: true },
        { name: "David L.", text: "Quality is outstanding. Installation was easier than expected.", rating: 5, verified: true },
        { name: "Emma R.", text: "Perfect for my morning routine. The lighting is incredible.", rating: 5, verified: true }
      ],
      
      // Features and highlights
      keyFeatures: [
        "Voice-Activated Controls",
        "Anti-Fog Technology", 
        "Weather & News Updates",
        "Premium LED Lighting",
        "Easy Installation",
        "2-Year Warranty"
      ],
      showFeatures: true,
      
      // Badges and labels
      badges: [
        { text: "Best Seller", type: "success" },
        { text: "Limited Time", type: "warning" },
        { text: "Free Shipping", type: "info" }
      ],
      showBadges: true,
      
      // Call to action
      ctaText: "Add to Cart",
      ctaSecondary: "Buy Now",
      showQuantitySelector: true,
      showWishlist: true,
      
      // Layout options
      layout: "split", // split, stacked, minimal
      imagePosition: "left", // left, right
      showGallery: true,
      highlightDiscount: true,
      
      // Stock and urgency
      stockCount: 27,
      showStock: true,
      lowStockThreshold: 10,
      
      // Additional info
      sku: "SMART-MIRROR-001",
      showSku: false,
      freeShipping: true,
      shippingInfo: "Free shipping • 30-day returns • 2-year warranty"
    }),
    render: ({ data, onChange, editable, theme }) => {
      const InteractiveFeaturedProduct = () => {
        const [quantity, setQuantity] = useState(1);
        const [isWishlisted, setIsWishlisted] = useState(false);
        const [selectedImageIndex, setSelectedImageIndex] = useState(0);
        
        const discountPercent = data.originalPrice ? Math.round(((data.originalPrice - data.salePrice) / data.originalPrice) * 100) : 0;
        const isLowStock = data.stockCount <= data.lowStockThreshold;
        
        const allImages = [data.mainImage, ...(data.galleryImages || [])];
        const currentImage = allImages[selectedImageIndex] || data.mainImage;
        
        const handleQuantityChange = (change) => {
          setQuantity(prev => Math.max(1, Math.min(data.stockCount || 99, prev + change)));
        };
        
        return (
        <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          {/* Badges Row */}
          {data.showBadges && data.badges.length > 0 && (
            <div className="p-4 pb-0">
              <div className="flex flex-wrap gap-2">
                {data.badges.map((badge, idx) => (
                  <span key={idx} className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    badge.type === 'success' ? 'bg-green-100 text-green-800' :
                    badge.type === 'warning' ? 'bg-orange-100 text-orange-800' :
                    badge.type === 'info' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {badge.text}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          <div className={`p-8 ${
            data.layout === 'split' ? 'grid md:grid-cols-2 gap-12' : 
            data.layout === 'stacked' ? 'space-y-8' : 
            'max-w-4xl mx-auto'
          }`}>
            
            {/* Product Images */}
            <div className={`${data.layout === 'split' && data.imagePosition === 'right' ? 'md:order-2' : ''}`}>
              <div className="space-y-4">
                {/* Main Image */}
                <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden group relative">
                  <img 
                    src={currentImage} 
                    alt={data.productTitle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {data.highlightDiscount && discountPercent > 0 && (
                    <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                      -{discountPercent}%
                    </div>
                  )}
                  {editable && (
                    <UploadImage onUploaded={(url) => onChange && onChange({ mainImage: url })} />
                  )}
                </div>
                
                {/* Image Gallery */}
                {data.showGallery && data.galleryImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {allImages.slice(0, 4).map((img, idx) => (
                      <div 
                        key={idx}
                        className={`aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                          selectedImageIndex === idx 
                            ? 'border-indigo-500 ring-2 ring-indigo-200' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedImageIndex(idx)}
                      >
                        <img src={img} alt={idx === 0 ? "Main" : `Gallery ${idx}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Product Details */}
            <div className="space-y-6">
              {/* Title and Subtitle */}
              <div>
                <h1 
                  contentEditable={editable}
                  suppressContentEditableWarning={true}
                  onBlur={(e) => onChange && onChange({ productTitle: e.target.textContent })}
                  className="text-3xl font-bold text-gray-900 mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded px-2"
                >
                  {data.productTitle}
                </h1>
                <p 
                  contentEditable={editable}
                  suppressContentEditableWarning={true}
                  onBlur={(e) => onChange && onChange({ productSubtitle: e.target.textContent })}
                  className="text-xl text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-2"
                >
                  {data.productSubtitle}
                </p>
              </div>
              
              {/* Rating and Reviews */}
              {data.showReviews && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`h-5 w-5 ${
                        i < Math.floor(data.rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'
                      }`} />
                    ))}
                    <span className="ml-2 font-semibold">{data.rating}</span>
                  </div>
                  <span className="text-gray-600">({data.totalReviews.toLocaleString()} reviews)</span>
                </div>
              )}
              
              {/* Price */}
              <div className="space-y-2">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-gray-900">
                    {data.currency}{data.salePrice?.toFixed(2)}
                  </span>
                  {data.originalPrice && data.originalPrice > data.salePrice && (
                    <span className="text-xl text-gray-500 line-through">
                      {data.currency}{data.originalPrice.toFixed(2)}
                    </span>
                  )}
                  {discountPercent > 0 && (
                    <span className="text-green-600 font-semibold">
                      Save {data.currency}{(data.originalPrice - data.salePrice).toFixed(2)}
                    </span>
                  )}
                </div>
                {data.freeShipping && (
                  <p className="text-green-600 font-medium">✓ {data.shippingInfo}</p>
                )}
              </div>
              
              {/* Stock Status */}
              {data.showStock && (
                <div className="space-y-2">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                    isLowStock ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${isLowStock ? 'bg-orange-500' : 'bg-green-500'}`} />
                    {isLowStock ? `Only ${data.stockCount} left!` : `${data.stockCount} in stock`}
                  </div>
                </div>
              )}
              
              {/* Description */}
              <p 
                contentEditable={editable}
                suppressContentEditableWarning={true}
                onBlur={(e) => onChange && onChange({ productDescription: e.target.textContent })}
                className="text-gray-600 leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-2"
              >
                {data.productDescription}
              </p>
              
              {/* Key Features */}
              {data.showFeatures && data.keyFeatures.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Key Features:</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {data.keyFeatures.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Quantity and Actions */}
              <div className="space-y-4">
                {data.showQuantitySelector && (
                  <div className="flex items-center gap-4">
                    <label className="font-medium text-gray-900">Quantity:</label>
                    <div className="flex items-center border border-gray-300 rounded-lg">
                      <button 
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleQuantityChange(-1)}
                        disabled={quantity <= 1}
                      >
                        -
                      </button>
                      <span className="px-4 py-2 border-x border-gray-300 min-w-[3rem] text-center">{quantity}</span>
                      <button 
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleQuantityChange(1)}
                        disabled={quantity >= (data.stockCount || 99)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-3">
                  <ThemedButton 
                    theme={theme} 
                    className="flex-1 py-3 text-white font-semibold text-lg hover:opacity-90 transition-opacity"
                    onClick={() => alert(`Added ${quantity} x ${data.productTitle} to cart!\n\nTotal: ${data.currency}${(data.salePrice * quantity).toFixed(2)}\n\nIn a live store, this would integrate with your shopping cart system.`)}
                  >
                    {data.ctaText}
                  </ThemedButton>
                  {data.ctaSecondary && (
                    <Button 
                      variant="outline" 
                      className="flex-1 py-3 font-semibold text-lg hover:bg-gray-50 transition-colors"
                      onClick={() => alert(`Proceeding to checkout with ${data.productTitle}\n\nIn a live store, this would redirect to the checkout page.`)}
                    >
                      {data.ctaSecondary}
                    </Button>
                  )}
                  {data.showWishlist && (
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className={`p-3 transition-colors ${
                        isWishlisted 
                          ? 'bg-red-50 text-red-600 border-red-200' 
                          : 'hover:bg-red-50 hover:text-red-600'
                      }`}
                      onClick={() => {
                        setIsWishlisted(!isWishlisted);
                        alert(`${isWishlisted ? 'Removed from' : 'Added to'} wishlist!\n\nIn a live store, this would save to the customer's wishlist.`);
                      }}
                    >
                      <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-current' : ''}`} />
                    </Button>
                  )}
                </div>
              </div>
              
              {/* SKU */}
              {data.showSku && data.sku && (
                <p className="text-sm text-gray-500">SKU: {data.sku}</p>
              )}
            </div>
          </div>
          
          {/* Featured Reviews */}
          {data.showReviews && data.featuredReviews.length > 0 && (
            <div className="border-t border-gray-200 p-8">
              <h3 className="text-xl font-bold mb-6">What Customers Say</h3>
              <div className="grid md:grid-cols-3 gap-6">
                {data.featuredReviews.map((review, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-1 mb-2">
                      {[...Array(review.rating)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                      ))}
                    </div>
                    <p className="text-gray-700 text-sm mb-3">"{review.text}"</p>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{review.name}</span>
                      {review.verified && (
                        <Badge className="bg-green-100 text-green-800 text-xs">Verified</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
        );
      };
      
      return <InteractiveFeaturedProduct />;
    },
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <Field label="Product Title">
          <Input value={data.productTitle} onChange={e => onChange({ productTitle: e.target.value })} />
        </Field>
        <Field label="Product Subtitle">
          <Input value={data.productSubtitle} onChange={e => onChange({ productSubtitle: e.target.value })} />
        </Field>
        
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sale Price">
            <Input 
              type="number" 
              step="0.01"
              value={data.salePrice} 
              onChange={e => onChange({ salePrice: parseFloat(e.target.value) || 0 })} 
            />
          </Field>
          <Field label="Original Price">
            <Input 
              type="number" 
              step="0.01"
              value={data.originalPrice} 
              onChange={e => onChange({ originalPrice: parseFloat(e.target.value) || 0 })} 
            />
          </Field>
        </div>
        
        <Field label="Description">
          <Textarea 
            value={data.productDescription} 
            onChange={e => onChange({ productDescription: e.target.value })}
            rows={3}
          />
        </Field>
        
        <Field label="Main Product Image">
          <div className="space-y-2">
            <Input 
              value={data.mainImage} 
              onChange={e => onChange({ mainImage: e.target.value })}
              placeholder="Enter image URL"
            />
            <UploadImageButton onUploaded={(url) => onChange({ mainImage: url })} />
          </div>
        </Field>
        
        <Field label="Layout Style">
          <div className="flex gap-2">
            {["split", "stacked", "minimal"].map(layout => (
              <Button key={layout} size="sm" variant={data.layout === layout ? "default" : "outline"} onClick={() => onChange({ layout })}>
                {layout}
              </Button>
            ))}
          </div>
        </Field>
        
        {data.layout === 'split' && (
          <Field label="Image Position">
            <div className="flex gap-2">
              {["left", "right"].map(pos => (
                <Button key={pos} size="sm" variant={data.imagePosition === pos ? "default" : "outline"} onClick={() => onChange({ imagePosition: pos })}>
                  {pos}
                </Button>
              ))}
            </div>
          </Field>
        )}
        
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rating">
            <Slider 
              value={[data.rating]} 
              min={1} 
              max={5} 
              step={0.1} 
              onValueChange={v => onChange({ rating: v[0] })}
            />
            <div className="text-xs text-gray-600 mt-1">{data.rating} stars</div>
          </Field>
          <Field label="Total Reviews">
            <Input 
              type="number" 
              value={data.totalReviews} 
              onChange={e => onChange({ totalReviews: parseInt(e.target.value) || 0 })} 
            />
          </Field>
        </div>
        
        <Field label="Stock Count">
          <Input 
            type="number" 
            value={data.stockCount} 
            onChange={e => onChange({ stockCount: parseInt(e.target.value) || 0 })} 
          />
        </Field>
        
        <Field label="CTA Button Text">
          <Input value={data.ctaText} onChange={e => onChange({ ctaText: e.target.value })} />
        </Field>
        
        <Field label="Secondary CTA Text">
          <Input value={data.ctaSecondary} onChange={e => onChange({ ctaSecondary: e.target.value })} />
        </Field>
        
        <ToggleField label="Show Reviews" checked={data.showReviews} onCheckedChange={(v) => onChange({ showReviews: v })} />
        <ToggleField label="Show Features" checked={data.showFeatures} onCheckedChange={(v) => onChange({ showFeatures: v })} />
        <ToggleField label="Show Gallery" checked={data.showGallery} onCheckedChange={(v) => onChange({ showGallery: v })} />
        <ToggleField label="Show Stock Status" checked={data.showStock} onCheckedChange={(v) => onChange({ showStock: v })} />
        <ToggleField label="Show Quantity Selector" checked={data.showQuantitySelector} onCheckedChange={(v) => onChange({ showQuantitySelector: v })} />
        <ToggleField label="Show Wishlist Button" checked={data.showWishlist} onCheckedChange={(v) => onChange({ showWishlist: v })} />
        <ToggleField label="Highlight Discount" checked={data.highlightDiscount} onCheckedChange={(v) => onChange({ highlightDiscount: v })} />
        <ToggleField label="Show Badges" checked={data.showBadges} onCheckedChange={(v) => onChange({ showBadges: v })} />
      </div>
    )
  },
};

// ----- Product Grid Renderer Component ----- //
function ProductGridRenderer({ data, onChange, editable, currentUserId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const carouselRef = useRef(null);

  // Load user's products
  useEffect(() => {
    if (currentUserId) {
      loadUserProducts();
    } else {
      // No user ID, use mock data for preview
      const mockProducts = [
        { id: '1', title: 'Sample Product 1', price: 29.99, description: 'Beautiful product design', images: ['https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=400&fit=crop'] },
        { id: '2', title: 'Sample Product 2', price: 19.99, description: 'Premium quality item', images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop'] },
        { id: '3', title: 'Sample Product 3', price: 40.00, description: 'Luxury crafted piece', images: ['https://images.unsplash.com/photo-1586953208462-d35b1f4468bc?w=400&h=400&fit=crop'] },
      ];
      setProducts(mockProducts);
      if (data.productIds.length === 0) {
        onChange && onChange({ productIds: mockProducts.map(p => p.id), products: mockProducts });
      }
    }
  }, [currentUserId]);

  // State for showing setup notice
  const [productsNeedSetup, setProductsNeedSetup] = useState(false);

  async function loadUserProducts(retryCount = 0) {
    try {
      setLoading(true);
      const response = await apiCall('/api/member/products', {
        method: 'GET',
        headers: {
          'x-member-uid': currentUserId
        }
      });
      
      if (response.ok) {
        const data_response = await response.json();
        
        // Handle new API response format with needsSetup flag
        const userProducts = data_response.products || data_response;
        const needsSetup = data_response.needsSetup || false;
        
        setProductsNeedSetup(needsSetup);
        
        if (needsSetup) {
          console.log('📦 Products need setup - showing sample products');
        } else {
          console.log('✅ Loaded', userProducts.length, 'products from API');
        }
        
        setProducts(userProducts);
        
        // If no products are selected yet, auto-select first few products
        if (data.productIds.length === 0 && userProducts.length > 0) {
          const autoSelected = userProducts.slice(0, Math.min(6, userProducts.length)).map(p => p.id);
          onChange && onChange({ productIds: autoSelected, products: userProducts });
        }
      } else {
        throw new Error(`API responded with status ${response.status}`);
      }
    } catch (error) {
      console.error('Error loading products:', error);
      
      // Retry once if first attempt fails
      if (retryCount < 1) {
        console.log('🔄 Retrying product load...');
        setTimeout(() => loadUserProducts(retryCount + 1), 1000);
        return;
      }
      
      // Use mock data as fallback
      console.log('📦 Using mock products as fallback');
      setProductsNeedSetup(true);
      const mockProducts = [
        { 
          id: '1', 
          title: 'Fotonix Lumina Mirror', 
          price: 29.99, 
          priceCents: 2999,
          description: 'Beautiful LED mirror with customizable lighting', 
          images: ['https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=400&fit=crop'] 
        },
        { 
          id: '2', 
          title: 'Light Up Design Pro', 
          price: 19.99, 
          priceCents: 1999,
          description: 'Custom light-up creation with premium features', 
          images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop'] 
        },
        { 
          id: '3', 
          title: 'Custom Cut Mirror', 
          price: 40.00, 
          priceCents: 4000,
          description: 'Precisely cut mirror to your specifications', 
          images: ['https://images.unsplash.com/photo-1586953208462-d35b1f4468bc?w=400&h=400&fit=crop'] 
        },
        { 
          id: '4', 
          title: 'Premium LED Panel', 
          price: 35.99, 
          priceCents: 3599,
          description: 'High-quality LED lighting panel', 
          images: ['https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=400&fit=crop'] 
        },
        { 
          id: '5', 
          title: 'Smart Mirror Hub', 
          price: 59.99, 
          priceCents: 5999,
          description: 'Connected smart mirror with app control', 
          images: ['https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=400&fit=crop'] 
        },
        { 
          id: '6', 
          title: 'Designer Light Strip', 
          price: 24.99, 
          priceCents: 2499,
          description: 'Flexible LED strip for custom designs', 
          images: ['https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=400&fit=crop'] 
        }
      ];
      setProducts(mockProducts);
      if (data.productIds.length === 0) {
        onChange && onChange({ productIds: mockProducts.map(p => p.id), products: mockProducts });
      }
    } finally {
      setLoading(false);
    }
  }

  const selectedProducts = products.filter(p => data.productIds.includes(p.id));
  const displayProducts = selectedProducts.length > 0 ? selectedProducts : products.slice(0, 6);

  // Carousel navigation functions
  const nextSlide = () => {
    if (data.layout === 'carousel') {
      setCurrentSlide((prev) => (prev + 1) % Math.ceil(displayProducts.length / (data.columns || 3)));
    }
  };

  const prevSlide = () => {
    if (data.layout === 'carousel') {
      setCurrentSlide((prev) => (prev - 1 + Math.ceil(displayProducts.length / (data.columns || 3))) % Math.ceil(displayProducts.length / (data.columns || 3)));
    }
  };

  const renderProductCard = (product) => (
    <div key={product.id} className={`bg-gray-50 rounded-lg p-4 border hover:shadow-md transition-shadow ${data.layout === 'list' ? 'flex gap-4' : ''}`}>
      <div className={`bg-gray-200 rounded-lg overflow-hidden ${data.layout === 'list' ? 'w-24 h-24 flex-shrink-0' : 'aspect-square mb-3'}`}>
        {product.images && product.images[0] ? (
          <img 
            src={product.images[0]} 
            alt={product.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className={`text-gray-400 ${data.layout === 'list' ? 'h-8 w-8' : 'h-12 w-12'}`} />
          </div>
        )}
      </div>
      <div className={data.layout === 'list' ? 'flex-1' : ''}>
        <h4 className={`font-medium mb-1 line-clamp-2 ${data.layout === 'list' ? 'text-base' : ''}`}>{product.title}</h4>
        {data.showDescription && product.description && (
          <p className={`text-gray-600 mb-2 line-clamp-2 ${data.layout === 'list' ? 'text-sm' : 'text-sm'}`}>{product.description}</p>
        )}
        {data.showPrices && (
          <div className={`flex items-center ${data.layout === 'list' ? 'justify-start gap-4' : 'justify-between'}`}>
            <p className="font-bold text-indigo-600">
              £{typeof product.price === 'number' ? product.price.toFixed(2) : (product.priceCents / 100).toFixed(2)}
            </p>
            <Button size="sm" variant="outline">
              View
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-8">
      <div className="text-center mb-8">
        <h3
          contentEditable={editable}
          suppressContentEditableWarning={true}
          onBlur={(e) => onChange && onChange({ title: e.target.textContent })}
          className="text-2xl font-bold mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded px-2"
        >
          {data.title}
        </h3>
        <p
          contentEditable={editable}
          suppressContentEditableWarning={true}
          onBlur={(e) => onChange && onChange({ description: e.target.textContent })}
          className="text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-2"
        >
          {data.description}
        </p>
      </div>
      
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading your products...</p>
        </div>
      ) : (
        <>
          {/* Show notice if products need setup */}
          {productsNeedSetup && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-amber-800">Demo Products Shown</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    You haven't added any products yet. These are sample products to preview your store layout. 
                    Go to <strong>Products</strong> in the dashboard to add your own products.
                  </p>
                  <p className="text-xs text-amber-600 mt-2">
                    💡 You can change this section at any time after adding products.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {data.layout === 'carousel' ? (
            <div className="relative">
              <div className="overflow-hidden" ref={carouselRef}>
                <div 
                  className="flex transition-transform duration-300 ease-in-out"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {Array.from({ length: Math.ceil(displayProducts.length / (data.columns || 3)) }, (_, slideIndex) => (
                    <div key={slideIndex} className="w-full flex-shrink-0">
                      <div className={`grid gap-6 ${data.columns === 2 ? 'grid-cols-2' : data.columns === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                        {displayProducts
                          .slice(slideIndex * (data.columns || 3), (slideIndex + 1) * (data.columns || 3))
                          .map(renderProductCard)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {Math.ceil(displayProducts.length / (data.columns || 3)) > 1 && (
                <>
                  <button
                    onClick={prevSlide}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-white shadow-lg rounded-full p-2 hover:bg-gray-50 transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextSlide}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-white shadow-lg rounded-full p-2 hover:bg-gray-50 transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="flex justify-center mt-6 gap-2">
                    {Array.from({ length: Math.ceil(displayProducts.length / (data.columns || 3)) }, (_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentSlide(index)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          currentSlide === index ? 'bg-indigo-600' : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : data.layout === 'list' ? (
            <div className="space-y-4">
              {displayProducts.map(renderProductCard)}
            </div>
          ) : (
            <div className={`grid gap-6 ${data.columns === 2 ? 'md:grid-cols-2' : data.columns === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
              {displayProducts.map(renderProductCard)}
              
              {displayProducts.length === 0 && (
                <div className="col-span-full text-center py-8">
                  <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h4 className="font-medium text-gray-900 mb-2">No products yet</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Create some products first, then select which ones to display in your store.
                  </p>
                  <Button onClick={() => window.location.href = '/#affiliate-add-product'}>
                    Create Products
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ----- Utilities ----- //
const Field = ({ label, children }) => (
  <div className="space-y-1">
    <Label className="text-xs uppercase tracking-wider text-gray-600">{label}</Label>
    {children}
  </div>
);

const ToggleField = ({ label, checked, onCheckedChange }) => (
  <div className="flex items-center justify-between py-1">
    <Label className="text-xs uppercase tracking-wider text-gray-600">{label}</Label>
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
  </div>
);

// Social media icon component
const SocialIcon = ({ platform, size = 20 }) => {
  const icons = {
    instagram: <Instagram className={`h-${size/4} w-${size/4}`} />,
    facebook: <Facebook className={`h-${size/4} w-${size/4}`} />,
    twitter: <Twitter className={`h-${size/4} w-${size/4}`} />,
    youtube: <Youtube className={`h-${size/4} w-${size/4}`} />,
    linkedin: <Users className={`h-${size/4} w-${size/4}`} />,
    website: <Globe className={`h-${size/4} w-${size/4}`} />,
  };
  
  return icons[platform] || <Globe className={`h-${size/4} w-${size/4}`} />;
};

// ----- Sortable item wrapper ----- //
function SortableItem({ id, children, selected, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    cursor: 'grab'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border ${selected ? 'ring-2 ring-indigo-500' : ''} bg-white hover:bg-gray-50`}
      onMouseDown={onSelect}
      onTouchStart={onSelect}
      {...attributes}
    >
      <div
        {...listeners}
        className="absolute left-2 top-2 cursor-grab opacity-60 group-hover:opacity-100"
        title="Drag"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// Upload image component (Firebase integration)
function UploadImage({ onUploaded, accept = 'image/*', className }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      setUploading(true);
      const path = `store-images/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '')}`;
      const sRef = storageRef(storage, path);
      const task = uploadBytesResumable(sRef, file);
      await new Promise((res, rej) => {
        task.on('state_changed', null, (err) => rej(err), () => res());
      });
      const url = await getDownloadURL(task.snapshot.ref);
      if (onUploaded) onUploaded(url);
    } catch (err) {
      console.error('Upload failed', err);
      alert('Image upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = null;
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
      <button
        type="button"
        className={`absolute top-2 right-2 p-1.5 bg-white/80 rounded-md opacity-0 group-hover:opacity-100 transition ${className || ''}`}
        onClick={() => inputRef.current && inputRef.current.click()}
        title={uploading ? 'Uploading...' : 'Upload image'}
        disabled={uploading}
      >
        {uploading ? (
          <div className="animate-spin h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full" />
        ) : (
          <ImageIcon className="h-4 w-4 text-gray-700" />
        )}
      </button>
    </>
  );
}

// Upload image button component (for inspector panels)
function UploadImageButton({ onUploaded, accept = 'image/*', className = '' }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      setUploading(true);
      const path = `store-images/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '')}`;
      const sRef = storageRef(storage, path);
      const task = uploadBytesResumable(sRef, file);
      await new Promise((res, rej) => {
        task.on('state_changed', null, (err) => rej(err), () => res());
      });
      const url = await getDownloadURL(task.snapshot.ref);
      if (onUploaded) onUploaded(url);
      
      // Show success feedback
      setJustUploaded(true);
      setTimeout(() => setJustUploaded(false), 2000);
    } catch (err) {
      console.error('Upload failed', err);
      alert('Image upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = null;
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`flex items-center gap-2 ${className} ${justUploaded ? 'bg-green-50 border-green-300 text-green-700' : ''}`}
        onClick={() => inputRef.current && inputRef.current.click()}
        disabled={uploading}
      >
        {uploading ? (
          <>
            <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full" />
            <span>Uploading...</span>
          </>
        ) : justUploaded ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            <span>Uploaded!</span>
          </>
        ) : (
          <>
            <ImageIcon className="h-4 w-4" />
            <span>Upload Image</span>
          </>
        )}
      </Button>
    </>
  );
}

// ----- Main Store Builder Component ----- //
export default function StoreBuilder({ currentUserId, siteOrigin = "https://example.com" }) {
  const [device, setDevice] = useState('desktop');
  const [blocks, setBlocks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editMode, setEditMode] = useState(true);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  
  // Store loading states
  const [isLoadingStore, setIsLoadingStore] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictData, setConflictData] = useState(null);
  
  // Store configuration - initialize from localStorage if available
  const [storeConfig, setStoreConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('store.config');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading store config from localStorage:', error);
    }
    return {
      handle: "",
      displayName: "",
      description: "",
      isPublished: false,
      seoTitle: "",
      seoDescription: "",
      brandColor: "#4f46e5",
      logo: "",
      favicon: "",
      returnsPolicy: {
        enabled: false,
        returnWindow: "30",
        conditionRequired: "unused",
        refundMethod: "original",
        returnShipping: "customer",
        exchangeOffered: true,
        customText: "",
      },
      // Contact details for buyer-seller communication
      contactDetails: {
        email: "",           // Selected from business emails
        emailId: null,       // Business email ID from database
        phone: "",           // Business phone number
        showPhone: false,    // Whether to display phone publicly
        businessHours: "",   // e.g., "Mon-Fri 9am-5pm"
        address: "",         // Business address (optional)
        showAddress: false,  // Whether to display address publicly
      },
    };
  });
  
  // Store Settings Modal
  const [showStoreSettings, setShowStoreSettings] = useState(false);
  
  // Store Onboarding Modal - shows on first visit when no store exists
  const [showStoreOnboarding, setShowStoreOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [memberProfile, setMemberProfile] = useState(null); // Store name from signup
  const [businessEmails, setBusinessEmails] = useState([]); // Business emails from signup
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  
  // Handle validation and publishing state
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);
  const [handleError, setHandleError] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isHandleLocked, setIsHandleLocked] = useState(false);
  
  // Theme configuration
  const [selectedTheme, setSelectedTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('store.theme');
      return saved ? JSON.parse(saved).selectedTheme : 'default';
    } catch {
      return 'default';
    }
  });
  const [customTheme, setCustomTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('store.theme');
      return saved ? JSON.parse(saved).customTheme || COLOR_THEMES.custom : COLOR_THEMES.custom;
    } catch {
      return COLOR_THEMES.custom;
    }
  });
  const [showThemePicker, setShowThemePicker] = useState(false);
  
  // Revenue Boosting Tools
  const [showRevenueTools, setShowRevenueTools] = useState(false);
  const [selectedRevenueTools, setSelectedRevenueTools] = useState([]);
  
  // Preview mode
  const [previewMode, setPreviewMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState('desktop'); // desktop, tablet, mobile
  
  // Layout Review mode
  const [showReview, setShowReview] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  
  const currentTheme = selectedTheme === 'custom' ? customTheme : COLOR_THEMES[selectedTheme];
  
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // success, error, null

  // AI Layout Review Analysis
  const analyzeStoreLayout = () => {
    setReviewLoading(true);
    
    // Analyze current store structure
    const analysis = {
      overall: { score: 0, issues: [], strengths: [], recommendations: [] },
      conversion: { score: 0, factors: [], missing: [] },
      ux: { score: 0, issues: [], improvements: [] },
      performance: { score: 0, optimizations: [] },
      sections: []
    };
    
    // Analyze block sequence and positioning
    const blockTypes = blocks.map(block => block.type);
    const blockSequence = blocks.map((block, index) => ({ type: block.type, position: index, data: block.data }));
    
    // Debug logging
    console.log('Analyzing blocks:', blockTypes);
    
    // 1. CONVERSION FLOW ANALYSIS
    let conversionScore = 100;
    const hasHero = blockTypes.includes('storeHero');
    const hasProduct = blockTypes.includes('productGrid');
    const hasTestimonials = blockTypes.includes('testimonials');
    const hasReviews = blockTypes.includes('reviewShowcase');
    const hasUrgency = blockTypes.includes('urgencyBanner');
    const hasSocialProof = blockTypes.includes('socialProof');
    const hasCTA = blockTypes.some(type => ['storeHero', 'productGrid', 'ctaSection'].includes(type));
    
    // Hero section analysis
    if (hasHero) {
      const heroBlock = blocks.find(b => b.type === 'storeHero');
      const heroPosition = blockTypes.indexOf('storeHero');
      
      if (heroPosition === 0) {
        analysis.conversion.factors.push("✓ Hero section positioned at top - excellent for first impressions");
      } else {
        analysis.conversion.factors.push("⚠️ Hero section not at top - consider moving up for better impact");
        conversionScore -= 15;
      }
      
      if (heroBlock?.data?.ctaText) {
        analysis.conversion.factors.push("✓ Hero has clear call-to-action");
      } else {
        analysis.conversion.factors.push("❌ Hero missing call-to-action button");
        conversionScore -= 20;
      }
    } else {
      analysis.conversion.missing.push("❌ No hero section - critical for conversions (+35% boost)");
      conversionScore -= 30;
    }
    
    // Product showcase analysis
    if (hasProduct) {
      const productPosition = blockTypes.indexOf('productGrid');
      if (productPosition <= 2) {
        analysis.conversion.factors.push("✓ Product grid in prime position (above the fold)");
      } else {
        analysis.conversion.factors.push("⚠️ Product grid too low - move higher for better visibility");
        conversionScore -= 10;
      }
    } else {
      analysis.conversion.missing.push("❌ No product grid - essential for showcasing your products");
      conversionScore -= 25;
    }
    
    // Social proof analysis
    const socialProofScore = (hasTestimonials ? 15 : 0) + (hasReviews ? 20 : 0) + (hasSocialProof ? 25 : 0);
    if (socialProofScore >= 25) {
      analysis.conversion.factors.push("✓ Excellent social proof elements present");
    } else if (socialProofScore >= 15) {
      analysis.conversion.factors.push("⚠️ Good social proof, but could add more elements for maximum impact");
      conversionScore -= 10;
    } else {
      analysis.conversion.missing.push("❌ Insufficient social proof - add social proof notifications (+27% conversion)");
      conversionScore -= 20;
    }
    
    // Urgency analysis
    if (hasUrgency) {
      analysis.conversion.factors.push("✓ Urgency elements create FOMO and drive action");
    } else {
      analysis.conversion.missing.push("⚠️ No urgency elements - consider adding for +15% conversion boost");
      conversionScore -= 10;
    }
    
    // 2. USER EXPERIENCE ANALYSIS
    let uxScore = 100;
    
    // Block count analysis
    if (blocks.length < 3) {
      analysis.ux.issues.push("❌ Too few sections - store appears incomplete");
      uxScore -= 20;
    } else if (blocks.length > 8) {
      analysis.ux.issues.push("⚠️ Many sections - consider if all are necessary (reduces cognitive load)");
      uxScore -= 10;
    } else {
      analysis.ux.improvements.push("✓ Good section count for user engagement");
    }
    
    // Calculate overall scores
    analysis.conversion.score = Math.max(0, Math.min(100, conversionScore));
    analysis.ux.score = Math.max(0, Math.min(100, uxScore));
    analysis.performance.score = 85; // Base performance score
    analysis.overall.score = Math.round((analysis.conversion.score + analysis.ux.score + analysis.performance.score) / 3);
    
    // Overall recommendations
    if (analysis.overall.score >= 85) {
      analysis.overall.strengths.push("🎉 Excellent store layout with strong conversion potential");
      analysis.overall.recommendations.push("Fine-tune individual sections for maximum impact");
    } else if (analysis.overall.score >= 70) {
      analysis.overall.strengths.push("✅ Solid foundation with good conversion elements");
      analysis.overall.recommendations.push("Address key issues to boost conversion rate by 15-25%");
    } else {
      analysis.overall.recommendations.push("🔧 Significant improvements needed for optimal performance");
      analysis.overall.recommendations.push("Focus on conversion fundamentals: Hero → Product → Social Proof → CTA");
    }
    
    // Section-by-section analysis
    blocks.forEach((block, index) => {
      const insight = CONVERSION_INSIGHTS[block.type];
      const sectionAnalysis = {
        position: index + 1,
        type: block.type,
        name: STORE_BLOCKS[block.type]?.name || block.type,
        score: 85,
        feedback: [],
        suggestions: []
      };
      
      if (insight) {
        sectionAnalysis.feedback.push(`Conversion impact: ${insight.conversionLift}`);
        sectionAnalysis.suggestions.push(insight.psychologyPrinciple);
      }
      
      analysis.sections.push(sectionAnalysis);
    });
    
    // Simulate AI processing time
    setTimeout(() => {
      setReviewData(analysis);
      setReviewLoading(false);
      setShowReview(true);
    }, 1500);
  };

  // Close theme picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showThemePicker && !event.target.closest('.theme-picker-container')) {
        setShowThemePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showThemePicker]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor)
  );

  // Auto-save blocks to localStorage and database
  useEffect(() => {
    if (blocks.length > 0 && !isLoadingStore) {
      localStorage.setItem('store.blocks', JSON.stringify(blocks));
      // Auto-save to database if user has currentUserId and store has a handle
      if (currentUserId && storeConfig.handle) {
        debouncedSaveToDatabase();
      }
    }
  }, [blocks]);

  // Auto-save store config
  useEffect(() => {
    localStorage.setItem('store.config', JSON.stringify(storeConfig));
    // Auto-save to database if user has currentUserId and store has a handle
    if (currentUserId && storeConfig.handle && !isLoadingStore) {
      debouncedSaveToDatabase();
    }
  }, [storeConfig]);

  // Auto-save theme config
  useEffect(() => {
    localStorage.setItem('store.theme', JSON.stringify({ selectedTheme, customTheme }));
    // Auto-save to database if user has currentUserId and store has a handle
    if (currentUserId && storeConfig.handle && !isLoadingStore) {
      debouncedSaveToDatabase();
    }
  }, [selectedTheme, customTheme]);

  // Load store from database on mount
  useEffect(() => {
    if (currentUserId) {
      loadStoreFromDatabase();
    } else {
      // No user ID, load from localStorage only
      loadFromLocalStorageOnly();
    }
  }, [currentUserId]);

  async function loadStoreFromDatabase() {
    try {
      setIsLoadingStore(true);
      setLoadError(null);

      const response = await fetch(`${API_URL}/api/stores/user/${currentUserId}/current`);
      
      if (response.ok) {
        const { store } = await response.json();
        
        if (store) {
          // Store found in database
          const databaseData = {
            blocks: store.blocks || [],
            config: {
              handle: store.handle || "",
              displayName: store.display_name || "",
              description: store.description || "",
              isPublished: store.is_published || false,
              seoTitle: store.seo_title || "",
              seoDescription: store.seo_description || "",
              brandColor: store.brand_color || "#4f46e5",
              logo: store.logo || "",
              favicon: store.favicon || "",
              returnsPolicy: store.returns_policy || {
                enabled: false,
                returnWindow: "30",
                conditionRequired: "unused",
                refundMethod: "original",
                returnShipping: "customer",
                exchangeOffered: true,
                customText: "",
              },
            },
            theme: store.theme || { selectedTheme: 'default', customTheme: null }
          };

          // Check if returns policy is configured - if not, force onboarding
          const returnsPolicyConfigured = store.returns_policy?.enabled === true;
          
          if (!returnsPolicyConfigured) {
            console.log('Store found but returns policy not configured - showing onboarding');
            // Apply the store data first (so their existing work isn't lost)
            applyStoreData(databaseData);
            // Then show onboarding at step 2 (returns policy step)
            setOnboardingStep(2);
            setShowStoreOnboarding(true);
            setIsLoadingStore(false);
            return;
          }

          // Check localStorage for conflicts
          const localStorageData = getLocalStorageData();
          
          if (hasConflict(databaseData, localStorageData)) {
            // Show conflict resolution modal
            setConflictData({ database: databaseData, localStorage: localStorageData });
            setShowConflictModal(true);
          } else {
            // No conflict, use database data
            applyStoreData(databaseData);
          }
        } else {
          // No store in database - check if they have localStorage data
          const localData = getLocalStorageData();
          const hasLocalData = localData.config.handle || localData.config.displayName || localData.blocks.length > 0;
          
          if (hasLocalData) {
            // They have local data, use it
            console.log('No store found in database, using localStorage');
            loadFromLocalStorageOnly();
          } else {
            // Brand new user - fetch member profile to get store name from signup
            console.log('No store found, fetching member profile...');
            try {
              const profileResponse = await fetch(`${API_URL}/api/member/profile`, {
                headers: { 'x-member-uid': currentUserId }
              });
              if (profileResponse.ok) {
                const { profile } = await profileResponse.json();
                if (profile) {
                  setMemberProfile(profile);
                  // Pre-populate the store config with the store name from signup
                  const storeHandle = profile.storeName?.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || '';
                  setStoreConfig(prev => ({
                    ...prev,
                    displayName: profile.storeName || '',
                    handle: storeHandle,
                  }));
                  console.log('Pre-populated store name from signup:', profile.storeName);
                }
              }
            } catch (e) {
              console.error('Failed to fetch member profile:', e);
            }
            
            // Fetch business emails created during signup
            try {
              setIsLoadingEmails(true);
              const emailsResponse = await fetch(`${API_URL}/api/member/business-emails/${currentUserId}`);
              if (emailsResponse.ok) {
                const emails = await emailsResponse.json();
                setBusinessEmails(emails || []);
                console.log('Loaded business emails:', emails?.length || 0);
                
                // Pre-select the support email as default contact
                const supportEmail = emails?.find(e => e.type === 'support');
                if (supportEmail) {
                  setStoreConfig(prev => ({
                    ...prev,
                    contactDetails: {
                      ...prev.contactDetails,
                      email: supportEmail.email,
                      emailId: supportEmail.id,
                    }
                  }));
                }
              }
            } catch (e) {
              console.error('Failed to fetch business emails:', e);
            } finally {
              setIsLoadingEmails(false);
            }
            
            // Show onboarding
            setShowStoreOnboarding(true);
            setIsLoadingStore(false);
          }
        }
      } else {
        console.error('Failed to fetch store from database');
        loadFromLocalStorageOnly();
      }
    } catch (error) {
      console.error('Error loading store from database:', error);
      setLoadError('Failed to load store data');
      loadFromLocalStorageOnly();
    } finally {
      setIsLoadingStore(false);
    }
  }

  function loadFromLocalStorageOnly() {
    const localData = getLocalStorageData();
    applyStoreData(localData);
    
    // Check if returns policy is configured - if not, force onboarding
    const returnsPolicyConfigured = localData.config.returnsPolicy?.enabled === true;
    if (!returnsPolicyConfigured) {
      console.log('localStorage loaded but returns policy not configured - showing onboarding');
      setOnboardingStep(2); // Go straight to returns policy step
      setShowStoreOnboarding(true);
    }
    
    setIsLoadingStore(false);
  }

  function getLocalStorageData() {
    try {
      const blocksData = localStorage.getItem('store.blocks');
      const configData = localStorage.getItem('store.config');
      const themeData = localStorage.getItem('store.theme');

      const defaultReturnsPolicy = {
        enabled: false,
        returnWindow: "30",
        conditionRequired: "unused",
        refundMethod: "original",
        returnShipping: "customer",
        exchangeOffered: true,
        customText: "",
      };

      return {
        blocks: blocksData ? JSON.parse(blocksData) : loadInitialBlocks(),
        config: configData ? {
          ...JSON.parse(configData),
          returnsPolicy: JSON.parse(configData).returnsPolicy || defaultReturnsPolicy
        } : {
          handle: "",
          displayName: "",
          description: "",
          isPublished: false,
          seoTitle: "",
          seoDescription: "",
          brandColor: "#4f46e5",
          logo: "",
          favicon: "",
          returnsPolicy: defaultReturnsPolicy,
        },
        theme: themeData ? JSON.parse(themeData) : { selectedTheme: 'default', customTheme: COLOR_THEMES.custom }
      };
    } catch (error) {
      console.error('Error parsing localStorage data:', error);
      return {
        blocks: loadInitialBlocks(),
        config: {
          handle: "",
          displayName: "",
          description: "",
          isPublished: false,
          seoTitle: "",
          seoDescription: "",
          brandColor: "#4f46e5",
          logo: "",
          favicon: "",
          returnsPolicy: {
            enabled: false,
            returnWindow: "30",
            conditionRequired: "unused",
            refundMethod: "original",
            returnShipping: "customer",
            exchangeOffered: true,
            customText: "",
          },
        },
        theme: { selectedTheme: 'default', customTheme: COLOR_THEMES.custom }
      };
    }
  }

  function hasConflict(databaseData, localStorageData) {
    // Check if there are meaningful differences
    const dbBlocks = JSON.stringify(databaseData.blocks);
    const localBlocks = JSON.stringify(localStorageData.blocks);
    
    const dbConfig = JSON.stringify(databaseData.config);
    const localConfig = JSON.stringify(localStorageData.config);
    
    return dbBlocks !== localBlocks || dbConfig !== localConfig;
  }

  function applyStoreData(data) {
    setBlocks(data.blocks);
    setStoreConfig(data.config);
    setSelectedTheme(data.theme.selectedTheme);
    if (data.theme.customTheme) {
      setCustomTheme(data.theme.customTheme);
    }
    
    // Lock handle if it's already been set and saved (published or has been saved before)
    if (data.config.handle && (data.config.isPublished || data.config.handle.trim() !== '')) {
      setIsHandleLocked(true);
    }
    
    // Sync to localStorage
    localStorage.setItem('store.blocks', JSON.stringify(data.blocks));
    localStorage.setItem('store.config', JSON.stringify(data.config));
    localStorage.setItem('store.theme', JSON.stringify(data.theme));
  }

  // Debounced auto-save to database
  const debouncedSaveToDatabase = useCallback(
    debounce(async () => {
      // Only auto-save if handle is set and user is logged in
      if (!currentUserId || !storeConfig.handle || storeConfig.handle.trim() === '') {
        return;
      }
      
      try {
        await fetch(`${API_URL}/api/stores`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            userId: currentUserId,
            handle: storeConfig.handle,
            displayName: storeConfig.displayName,
            description: storeConfig.description,
            blocks: blocks,
            isPublished: storeConfig.isPublished,
            theme: {
              selectedTheme,
              customTheme: selectedTheme === 'custom' ? customTheme : null,
            },
          }),
        });
        console.log('🔄 Auto-saved to database');
      } catch (error) {
        console.error('Auto-save to database failed:', error);
      }
    }, 2000), // Wait 2 seconds after last change
    [currentUserId, storeConfig, blocks, selectedTheme, customTheme]
  );

  // Simple debounce utility
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  const pushHistory = useCallback((next) => {
    setHistory((h) => [...h, blocks]);
    setFuture([]);
    setBlocks(next);
  }, [blocks]);

  function loadInitialBlocks() {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('store.blocks') : null;
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
    return [
      makeBlock('storeHero'),
      makeBlock('productGrid'),
      makeBlock('socialLinks'),
      makeBlock('testimonials'),
      makeBlock('chatbot'),
      makeBlock('socialProof'),
    ];
  }

  function makeBlock(type) {
    const def = STORE_BLOCKS[type];
    return { id: uuidv4(), type, data: def.defaults() };
  }

  // Drag handlers
  const [activeId, setActiveId] = useState(null);
  const activeBlock = blocks.find(b => b.id === activeId);

  function handleDragStart(event) { setActiveId(event.active.id); }
  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex(b => b.id === active.id);
    const newIndex = blocks.findIndex(b => b.id === over.id);
    pushHistory(arrayMove(blocks, oldIndex, newIndex));
  }

  function updateBlock(id, patch) {
    pushHistory(blocks.map(b => b.id === id ? { ...b, data: { ...b.data, ...patch } } : b));
  }

  function duplicate(id) {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx < 0) return;
    const copy = { ...blocks[idx], id: uuidv4(), data: JSON.parse(JSON.stringify(blocks[idx].data)) };
    pushHistory([...blocks.slice(0, idx + 1), copy, ...blocks.slice(idx + 1)]);
  }

  function remove(id) {
    pushHistory(blocks.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function addBlock(type) {
    pushHistory([...blocks, makeBlock(type)]);
  }

  function doUndo() {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setFuture([blocks, ...future]);
    setBlocks(prev);
  }

  function doRedo() {
    if (!future.length) return;
    const next = future[0];
    setFuture(future.slice(1));
    setHistory([...history, blocks]);
    setBlocks(next);
  }

  // Save store to database
  async function saveStore() {
    if (!storeConfig.handle.trim()) {
      alert('Please enter a store handle');
      return;
    }
    
    setSaving(true);
    setSaveStatus(null);
    
    try {
      const response = await fetch(`${API_URL}/api/stores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: currentUserId,
          handle: storeConfig.handle,
          displayName: storeConfig.displayName,
          description: storeConfig.description,
          blocks: blocks,
          isPublished: storeConfig.isPublished,
          returnsPolicy: storeConfig.returnsPolicy, // Include returns policy
          theme: {
            selectedTheme,
            customTheme: selectedTheme === 'custom' ? customTheme : null,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save store');
      }
      
      // Lock the handle once it's been saved to database
      if (storeConfig.handle && storeConfig.handle.trim() !== '') {
        setIsHandleLocked(true);
      }
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  // Check if handle is available
  async function checkHandleAvailability(handle) {
    if (!handle.trim()) {
      setHandleError('Store handle is required');
      return false;
    }
    
    setIsCheckingHandle(true);
    setHandleError('');
    
    try {
      const response = await fetch(`${API_URL}/api/stores/check-handle?handle=${encodeURIComponent(handle)}`);
      const data = await response.json();
      
      if (!data.available) {
        setHandleError('This store handle is already taken. Please choose another.');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Handle check error:', error);
      setHandleError('Unable to check handle availability. Please try again.');
      return false;
    } finally {
      setIsCheckingHandle(false);
    }
  }

  // Publish store (one-time action)
  async function publishStore() {
    if (!storeConfig.handle.trim()) {
      setHandleError('Please enter a store handle before publishing');
      return;
    }

    // Check returns policy is configured
    if (!storeConfig.returnsPolicy?.enabled) {
      setHandleError('Please configure your Returns Policy in settings before publishing. This is required by law for online stores.');
      return;
    }

    if (storeConfig.isPublished) {
      return; // Already published
    }

    setIsPublishing(true);
    
    // First check if handle is available
    const isAvailable = await checkHandleAvailability(storeConfig.handle);
    
    if (!isAvailable) {
      setIsPublishing(false);
      return;
    }

    // Save store with published status
    try {
      const response = await fetch(`${API_URL}/api/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          handle: storeConfig.handle,
          displayName: storeConfig.displayName,
          description: storeConfig.description,
          theme: storeConfig.theme,
          logo: storeConfig.logo,
          blocks: blocks,
          isPublished: true, // Force published state
          returnsPolicy: storeConfig.returnsPolicy, // Include returns policy
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setStoreConfig(prev => ({ ...prev, isPublished: true }));
        // Lock the handle once store is published
        setIsHandleLocked(true);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(null), 3000);
        
        // Force re-render by clearing any errors
        setHandleError('');
        
        console.log('Store published successfully:', result); // Debug log
      } else {
        const errorData = await response.text();
        console.error('Publish failed:', response.status, errorData);
        throw new Error(`Failed to publish store: ${response.status} - ${errorData}`);
      }
    } catch (error) {
      console.error('Publish error:', error);
      setHandleError('Failed to publish store. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  }

  const containerWidth = device === 'desktop' ? '100%' : device === 'tablet' ? '768px' : '380px';

  // Loading state
  if (isLoadingStore) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-3 border-indigo-600 border-t-transparent rounded-full mx-auto mb-6" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading Your Store</h2>
          <p className="text-gray-600">Syncing your store data...</p>
        </div>
      </div>
    );
  }

  // Conflict Resolution Modal
  if (showConflictModal && conflictData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Store Data Conflict Detected</h2>
            <p className="text-gray-600">
              We found different versions of your store. Choose which version to use:
            </p>
          </div>
          
          <div className="p-6 grid md:grid-cols-2 gap-6">
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3 text-indigo-600">📱 Local Version (This Device)</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Handle:</strong> {conflictData.localStorage.config.handle || 'Not set'}</p>
                <p><strong>Display Name:</strong> {conflictData.localStorage.config.displayName || 'Not set'}</p>
                <p><strong>Blocks:</strong> {conflictData.localStorage.blocks.length} sections</p>
                <p><strong>Published:</strong> {conflictData.localStorage.config.isPublished ? 'Yes' : 'No'}</p>
              </div>
              <button
                onClick={() => {
                  applyStoreData(conflictData.localStorage);
                  setShowConflictModal(false);
                }}
                className="mt-4 w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Use Local Version
              </button>
            </div>
            
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3 text-green-600">☁️ Database Version (Published)</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Handle:</strong> {conflictData.database.config.handle || 'Not set'}</p>
                <p><strong>Display Name:</strong> {conflictData.database.config.displayName || 'Not set'}</p>
                <p><strong>Blocks:</strong> {conflictData.database.blocks.length} sections</p>
                <p><strong>Published:</strong> {conflictData.database.config.isPublished ? 'Yes' : 'No'}</p>
              </div>
              <button
                onClick={() => {
                  applyStoreData(conflictData.database);
                  setShowConflictModal(false);
                }}
                className="mt-4 w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
              >
                Use Database Version (Recommended)
              </button>
            </div>
          </div>
          
          <div className="p-6 border-t bg-gray-50">
            <p className="text-sm text-gray-600 mb-4">
              <strong>Recommendation:</strong> Choose the Database Version if you've published your store, as it contains your live configuration.
            </p>
            <button
              onClick={() => setShowConflictModal(false)}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Cancel (Keep Loading)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Preview Mode
  if (previewMode) {
    return (
      <TooltipProvider>
        <div className="min-h-screen bg-gradient-to-b from-white to-gray-100">
          <div className="w-full px-0 py-5">
            {/* Preview Header */}
            <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/80 border-b border-gray-200 shadow-sm">
              <div className="max-w-[1400px] mx-auto h-14 px-4 md:px-6 flex items-center justify-between gap-4">
                {/* Left Section */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewMode(false)}
                    className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50"
                  >
                    <ArrowUpRight className="h-4 w-4 rotate-180" />
                    <span className="text-sm font-medium">Back</span>
                  </Button>
                  
                  <div className="h-5 w-px bg-gray-300"></div>
                  
                  <span className="text-sm md:text-base font-semibold tracking-tight text-gray-800 flex items-center gap-1">
                    <Eye className="h-5 w-5" />
                    <span>Store Preview</span>
                  </span>
                  
                  <div className="hidden sm:flex items-center gap-2 ml-4">
                    <div className="text-sm text-gray-600">
                      {storeConfig.displayName || storeConfig.handle || 'Untitled Store'}
                    </div>
                  </div>
                </div>

                {/* Preview Device Controls - New Large Design */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">View:</span>
                  <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-xl p-2 shadow-sm">
                    {[
                      { key: "desktop", Icon: Laptop, label: "Desktop" },
                      { key: "tablet", Icon: Tablet, label: "Tablet" },
                      { key: "mobile", Icon: Smartphone, label: "Mobile" },
                    ].map(({ key, Icon, label }) => (
                      <button
                        key={key}
                        onClick={() => setPreviewDevice(key)}
                        className={`
                          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all min-w-[100px] justify-center
                          ${previewDevice === key 
                            ? "bg-indigo-600 text-white shadow-md transform scale-105" 
                            : "text-black hover:bg-gray-100 hover:text-black"
                          }
                        `}
                        style={{ minHeight: '40px' }}
                      >
                        <Icon className={`h-5 w-5 flex-shrink-0 ${previewDevice === key ? "text-white" : "text-black"}`} />
                        <span className="font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPreviewMode(false);
                      setShowStoreSettings(true);
                    }}
                    className="flex items-center gap-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-medium"
                  >
                    <Settings2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Settings</span>
                  </Button>
                  
                  <Button
                    variant="default"
                    onClick={() => setPreviewMode(false)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm border-0"
                  >
                    <Edit3 className="h-4 w-4" />
                    <span className="hidden sm:inline">Back to Builder</span>
                  </Button>
                  
                  <Button onClick={saveStore} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {saving ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Store
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </header>

            <StorePreview 
              blocks={blocks} 
              theme={currentTheme} 
              device={previewDevice}
              storeConfig={storeConfig}
              setPreviewDevice={setPreviewDevice}
            />
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-100">
        <div className="w-full px-0 py-5">
          {/* Store Builder Header */}
          <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/80 border-b border-gray-200 shadow-sm">
            <div className="max-w-[1400px] mx-auto h-14 px-4 md:px-6 flex items-center justify-between gap-4">
              {/* Left Section */}
              <div className="flex items-center gap-3">
                <span className="text-sm md:text-base font-semibold tracking-tight text-gray-800 flex items-center gap-1">
                  <Store className="h-5 w-5" />
                  <span>Store Builder</span>
                </span>
                
                <div className="hidden sm:flex items-center gap-2 ml-4">
                  <Input
                    placeholder="Store handle (e.g. mystore)"
                    value={storeConfig.handle}
                    onChange={(e) => setStoreConfig(prev => ({ ...prev, handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                    className="w-40"
                  />
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowStoreSettings(true)}
                    className="flex items-center gap-2"
                  >
                    <Settings2 className="h-4 w-4" />
                    <span>Settings</span>
                  </Button>
                  
                  <Button
                    variant={editMode ? "default" : "outline"}
                    size="icon"
                    onClick={() => setEditMode(!editMode)}
                    className="transition-all hover:scale-105"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Device Controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-white/70 backdrop-blur-md border border-gray-200 rounded-xl px-2 py-1.5">
                  {[
                    { key: "desktop", Icon: Laptop, label: "Desktop" },
                    { key: "tablet", Icon: Tablet, label: "Tablet" },
                    { key: "mobile", Icon: Smartphone, label: "Mobile" },
                  ].map(({ key, Icon, label }) => (
                    <button
                      key={key}
                      onClick={() => setDevice(key)}
                      className={`
                        flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-all
                        ${device === key 
                          ? "bg-indigo-600 text-white shadow-sm" 
                          : "text-black hover:bg-gray-100 hover:text-black"
                        }
                      `}
                    >
                      <Icon className={`h-4 w-4 ${device === key ? "text-white" : "text-black"}`} />
                      <span className="hidden md:inline text-xs">{label}</span>
                    </button>
                  ))}
                </div>
                
                {/* Preview & Review Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={previewMode ? "default" : "outline"}
                    onClick={() => setPreviewMode(!previewMode)}
                    className="flex items-center gap-2 px-3"
                  >
                    <Eye className="h-4 w-4" />
                    <span className="hidden sm:inline">{previewMode ? "Edit" : "Preview"}</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={analyzeStoreLayout}
                    disabled={reviewLoading || blocks.length === 0}
                    className={`flex items-center gap-2 px-3 py-3 relative ${
                      blocks.length > 0 && !reviewLoading 
                        ? "bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-700 border-purple-200 shadow-sm" 
                        : "bg-gray-50 text-gray-400 border-gray-200"
                    }`}
                  >
                    {reviewLoading ? (
                      <div className="animate-spin h-4 w-4 border-2 border-purple-600 border-t-transparent rounded-full" />
                    ) : (
                      <Sparkles className={`h-4 w-4 ${blocks.length > 0 ? "animate-pulse" : ""}`} />
                    )}
                    <span className="hidden sm:inline">
                      {reviewLoading ? "Analyzing..." : blocks.length === 0 ? "Add Blocks" : "AI Review"}
                    </span>
                    {blocks.length > 0 && !reviewLoading && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full animate-ping"></div>
                    )}
                  </Button>
                </div>
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-600">
                  {saveStatus === 'success' && <span className="text-green-600">✓ Saved</span>}
                  {saveStatus === 'error' && <span className="text-red-600">✗ Error</span>}
                </div>
                
                {/* Theme Picker Button */}
                <div className="relative theme-picker-container">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowThemePicker(!showThemePicker)}
                    className="flex items-center gap-2 px-3"
                  >
                    <div className="flex items-center gap-1">
                      {currentTheme.preview.map((color, idx) => (
                        <div key={idx} className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                    <span className="hidden sm:inline">Theme</span>
                  </Button>
                  
                  {/* Revenue Boosting Tools Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRevenueTools(true)}
                    className="ml-2 flex items-center gap-2 px-3 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 text-purple-700 border-purple-200"
                  >
                    <Zap className="h-4 w-4" />
                    <span className="hidden sm:inline">Revenue Tools</span>
                  </Button>
                  
                  {/* Theme Picker Dropdown */}
                  {showThemePicker && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                      <div className="p-4">
                        <h3 className="font-semibold mb-3">Choose Color Theme</h3>
                        
                        {/* Predefined Themes */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {Object.entries(COLOR_THEMES).filter(([key]) => key !== 'custom').map(([key, theme]) => (
                            <button
                              key={key}
                              onClick={() => {
                                setSelectedTheme(key);
                                setShowThemePicker(false);
                              }}
                              className={`p-3 rounded-lg border-2 text-left hover:border-indigo-300 transition-colors ${
                                selectedTheme === key ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                {theme.preview.map((color, idx) => (
                                  <div key={idx} className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                                ))}
                              </div>
                              <div className="text-sm font-medium">{theme.name}</div>
                            </button>
                          ))}
                        </div>
                        
                        {/* Custom Theme Section */}
                        <div className="border-t pt-4">
                          <button
                            onClick={() => setSelectedTheme('custom')}
                            className={`w-full p-3 rounded-lg border-2 text-left hover:border-indigo-300 transition-colors ${
                              selectedTheme === 'custom' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              {customTheme.preview.map((color, idx) => (
                                <div key={idx} className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                              ))}
                            </div>
                            <div className="text-sm font-medium">Custom Theme</div>
                          </button>
                          
                          {selectedTheme === 'custom' && (
                            <div className="mt-3 space-y-3">
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-xs">Primary</Label>
                                  <input
                                    type="color"
                                    value={customTheme.primary}
                                    onChange={(e) => setCustomTheme(prev => ({ 
                                      ...prev, 
                                      primary: e.target.value,
                                      preview: [e.target.value, prev.secondary, prev.accent]
                                    }))}
                                    className="w-full h-8 rounded border"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Secondary</Label>
                                  <input
                                    type="color"
                                    value={customTheme.secondary}
                                    onChange={(e) => setCustomTheme(prev => ({ 
                                      ...prev, 
                                      secondary: e.target.value,
                                      preview: [prev.primary, e.target.value, prev.accent]
                                    }))}
                                    className="w-full h-8 rounded border"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Accent</Label>
                                  <input
                                    type="color"
                                    value={customTheme.accent}
                                    onChange={(e) => setCustomTheme(prev => ({ 
                                      ...prev, 
                                      accent: e.target.value,
                                      preview: [prev.primary, prev.secondary, e.target.value]
                                    }))}
                                    className="w-full h-8 rounded border"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Close Button */}
                        <div className="mt-4 pt-3 border-t">
                          <Button
                            onClick={() => setShowThemePicker(false)}
                            className="w-full"
                            size="sm"
                          >
                            Apply Theme
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <Button onClick={saveStore} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3">
                  {saving ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Store
                    </>
                  )}
                </Button>
              </div>
            </div>
          </header>

          <div className="pt-4">
            {/* Editor Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-4">
              {/* Left Panel: Blocks or Inspector */}
              <Card className="h-[calc(100vh-180px)] overflow-hidden">
                <CardHeader className="pb-2 flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {selectedId ? <Settings2 className="h-4 w-4" /> : <LayoutTemplate className="h-4 w-4" />}
                    {selectedId ? 'Inspector' : 'Store Blocks'}
                  </CardTitle>
                  {selectedId && (
                    <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)} className="text-sm">
                      Show Blocks
                    </Button>
                  )}
                </CardHeader>
                <Separator />
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-240px)] p-3">
                    {selectedId ? (
                      <div className="p-4">
                        <Inspector 
                          block={blocks.find(b => b.id === selectedId)} 
                          onChange={(patch) => updateBlock(selectedId, patch)} 
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 p-1">
                        {Object.entries(STORE_BLOCKS).map(([key, def]) => {
                          const insight = CONVERSION_INSIGHTS[key];
                          return (
                            <button
                              key={key}
                              className="w-full group rounded-xl border border-gray-200 p-4 hover:bg-gray-50 hover:border-indigo-300 text-left transition relative"
                              onClick={() => addBlock(key)}
                            >
                              {/* Header Row */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                                    <def.icon className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <span className="text-sm font-semibold text-gray-900">{def.name}</span>
                                    {insight && (
                                      <p className="text-xs text-gray-500">📍 {insight.placement}</p>
                                    )}
                                  </div>
                                </div>
                                {insight && (
                                  <div className="flex flex-col items-end">
                                    <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-full">
                                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                      <span className="text-xs font-bold text-green-600">+{insight.conversionLift}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {/* Description */}
                              <p className="text-sm text-gray-600 mb-3">
                                {insight ? insight.psychologyPrinciple : `Add ${def.name} to your store`}
                              </p>
                              
                              {/* Insights Preview */}
                              {insight && insight.insights && (
                                <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                                  <p className="text-xs text-gray-700">
                                    💡 {insight.insights[0]}
                                  </p>
                                </div>
                              )}
                              
                              {/* Conversion Factors */}
                              {insight && insight.conversionFactors && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {Object.entries(insight.conversionFactors).slice(0, 3).map(([factor, percent]) => (
                                    <span key={factor} className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full">
                                      {factor}: {percent}
                                    </span>
                                  ))}
                                </div>
                              )}
                              
                              {/* Add Button */}
                              <div className="flex items-center justify-end pt-2 border-t border-gray-100">
                                <span className="inline-flex items-center text-sm font-medium text-indigo-600 group-hover:text-indigo-700">
                                  Add to Store <Plus className="h-4 w-4 ml-1" />
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Right Panel: Canvas */}
              <Card className="relative h-[calc(100vh-180px)] overflow-hidden">
                <CardContent className="p-0 h-full">
                  <div className="relative flex items-start h-full overflow-auto bg-white">
                    <div className="relative w-full h-full overflow-y-auto" style={{ width: containerWidth }}>
                      <div className="min-h-full bg-white border border-gray-200">
                        <div className="p-6 space-y-6">
                          <DndContext
                            sensors={sensors}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            collisionDetection={closestCenter}
                          >
                            <SortableContext
                              items={blocks.map(b => b.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {blocks.map((block) => (
                                <SortableItem
                                  key={block.id}
                                  id={block.id}
                                  selected={selectedId === block.id}
                                  onSelect={() => setSelectedId(block.id)}
                                >
                                  <BlockRenderer
                                    block={block}
                                    editable={editMode}
                                    onChange={(patch) => updateBlock(block.id, patch)}
                                    currentUserId={currentUserId}
                                    theme={currentTheme}
                                  />
                                  <div className="mt-3 flex items-center justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => duplicate(block.id)}
                                    >
                                      <Copy className="h-4 w-4 mr-1" />
                                      Duplicate
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => remove(block.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-1" />
                                      Remove
                                    </Button>
                                  </div>
                                </SortableItem>
                              ))}

                              {blocks.length === 0 && (
                                <div className="text-center text-gray-500 py-20">
                                  <Store className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                  <p>Add store blocks from the left to start building your store.</p>
                                </div>
                              )}
                            </SortableContext>

                            <DragOverlay>
                              {activeBlock ? (
                                <div className="rounded-xl border bg-white p-4 shadow-xl opacity-90">
                                  <BlockRenderer
                                    block={activeBlock}
                                    editable={editMode}
                                    onChange={(patch) => updateBlock(activeBlock.id, patch)}
                                    currentUserId={currentUserId}
                                    theme={currentTheme}
                                  />
                                </div>
                              ) : null}
                            </DragOverlay>
                          </DndContext>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Store Settings Modal */}
      {showStoreSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings2 className="h-6 w-6" />
                  <div>
                    <h2 className="text-xl font-bold">Store Settings</h2>
                    <p className="text-indigo-100 text-sm">Configure your store details and branding</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowStoreSettings(false)}
                  className="text-white hover:bg-white/20"
                >
                  ✕
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-6">
                {/* Store Identity Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Store className="h-5 w-5" />
                    Store Identity
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Store Name</label>
                      <Input
                        placeholder="My Awesome Store"
                        value={storeConfig.displayName}
                        onChange={(e) => setStoreConfig(prev => ({ ...prev, displayName: e.target.value }))}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500">The public name of your store</p>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        Store Handle
                        {(isHandleLocked || storeConfig.isPublished) && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                            <Lock className="h-3 w-3" />
                            Locked
                          </span>
                        )}
                      </label>
                      <div className="relative">
                        <Input
                          placeholder="mystore"
                          value={storeConfig.handle}
                          onChange={(e) => {
                            if (!isHandleLocked && !storeConfig.isPublished) {
                              const newHandle = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                              setStoreConfig(prev => ({ ...prev, handle: newHandle }));
                              setHandleError(''); // Clear error when typing
                            }
                          }}
                          disabled={isHandleLocked || storeConfig.isPublished}
                          className={`w-full ${(isHandleLocked || storeConfig.isPublished) ? 'bg-gray-100 cursor-not-allowed' : ''} ${handleError ? 'border-red-300' : ''} ${(isHandleLocked || storeConfig.isPublished) ? 'pr-10' : ''}`}
                        />
                        {(isHandleLocked || storeConfig.isPublished) && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <Lock className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        {isCheckingHandle && !(isHandleLocked || storeConfig.isPublished) && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full" />
                          </div>
                        )}
                      </div>
                      {handleError && (
                        <p className="text-xs text-red-600">{handleError}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        fotonix.co.uk/store/<span className="font-mono">{storeConfig.handle || 'handle'}</span>
                        {storeConfig.isPublished && (
                          <span className="ml-2 text-green-600 font-medium">✓ Published</span>
                        )}
                        {isHandleLocked && !storeConfig.isPublished && (
                          <span className="ml-2 text-orange-600 font-medium">🔒 Locked</span>
                        )}
                      </p>
                      {(isHandleLocked || storeConfig.isPublished) && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-xs text-amber-800 font-medium mb-1">
                            🔒 Store Handle Locked
                          </p>
                          <p className="text-xs text-amber-700">
                            Your store handle cannot be changed once it's been saved to prevent broken links and maintain consistency. 
                            Visitors who bookmarked your store will always be able to find it at this address.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Store Description</label>
                    <textarea
                      placeholder="Describe what your store offers..."
                      value={storeConfig.description}
                      onChange={(e) => setStoreConfig(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg resize-none h-20 text-sm"
                    />
                    <p className="text-xs text-gray-500">Brief description for search engines and social sharing</p>
                  </div>
                </div>

                {/* SEO Settings Section */}
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    SEO Settings
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">SEO Title</label>
                      <Input
                        placeholder={storeConfig.displayName || "Your Store Title"}
                        value={storeConfig.seoTitle}
                        onChange={(e) => setStoreConfig(prev => ({ ...prev, seoTitle: e.target.value }))}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500">
                        {storeConfig.seoTitle.length}/60 characters • Appears in search results and browser tabs
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">SEO Description</label>
                      <textarea
                        placeholder={storeConfig.description || "Write a compelling description for search engines..."}
                        value={storeConfig.seoDescription}
                        onChange={(e) => setStoreConfig(prev => ({ ...prev, seoDescription: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg resize-none h-20 text-sm"
                      />
                      <p className="text-xs text-gray-500">
                        {storeConfig.seoDescription.length}/160 characters • Appears in search results
                      </p>
                    </div>
                  </div>
                </div>

                {/* Returns Policy Section - REQUIRED */}
                <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <RotateCcw className="h-5 w-5" />
                      Returns Policy
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Required</span>
                    </h3>
                    {storeConfig.returnsPolicy?.enabled && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Configured
                      </span>
                    )}
                  </div>
                  
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <strong>⚠️ Required:</strong> All stores must display a returns policy. 
                      Configure your policy below to build customer trust and set clear expectations.
                    </p>
                  </div>

                  {/* Enable Policy Toggle */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">Enable Returns Policy</h4>
                      <p className="text-sm text-gray-600">Display returns policy on your store</p>
                    </div>
                    <button
                      onClick={() => setStoreConfig(prev => ({
                        ...prev,
                        returnsPolicy: {
                          ...prev.returnsPolicy,
                          enabled: !prev.returnsPolicy?.enabled,
                          // Set defaults when enabling
                          returnWindow: prev.returnsPolicy?.returnWindow || "30",
                          conditionRequired: prev.returnsPolicy?.conditionRequired || "unused",
                          refundMethod: prev.returnsPolicy?.refundMethod || "original",
                          returnShipping: prev.returnsPolicy?.returnShipping || "customer",
                          exchangeOffered: prev.returnsPolicy?.exchangeOffered !== false,
                        }
                      }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        storeConfig.returnsPolicy?.enabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          storeConfig.returnsPolicy?.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {storeConfig.returnsPolicy?.enabled && (
                    <div className="space-y-4 p-4 bg-white border border-gray-200 rounded-lg">
                      {/* Return Window */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Return Window (Days)</label>
                        <select
                          value={storeConfig.returnsPolicy?.returnWindow || "30"}
                          onChange={(e) => setStoreConfig(prev => ({
                            ...prev,
                            returnsPolicy: { ...prev.returnsPolicy, returnWindow: e.target.value }
                          }))}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="14">14 days</option>
                          <option value="30">30 days (Recommended)</option>
                          <option value="60">60 days</option>
                          <option value="90">90 days</option>
                        </select>
                        <p className="text-xs text-gray-500">How long customers have to return items</p>
                      </div>

                      {/* Item Condition */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Item Condition Required</label>
                        <select
                          value={storeConfig.returnsPolicy?.conditionRequired || "unused"}
                          onChange={(e) => setStoreConfig(prev => ({
                            ...prev,
                            returnsPolicy: { ...prev.returnsPolicy, conditionRequired: e.target.value }
                          }))}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="unused">Unused with original packaging</option>
                          <option value="unopened">Unopened/Sealed only</option>
                          <option value="any">Any condition (generous policy)</option>
                        </select>
                      </div>

                      {/* Refund Method */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Refund Method</label>
                        <select
                          value={storeConfig.returnsPolicy?.refundMethod || "original"}
                          onChange={(e) => setStoreConfig(prev => ({
                            ...prev,
                            returnsPolicy: { ...prev.returnsPolicy, refundMethod: e.target.value }
                          }))}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="original">Original payment method</option>
                          <option value="store_credit">Store credit only</option>
                          <option value="choice">Customer's choice</option>
                        </select>
                      </div>

                      {/* Return Shipping */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Return Shipping Paid By</label>
                        <select
                          value={storeConfig.returnsPolicy?.returnShipping || "customer"}
                          onChange={(e) => setStoreConfig(prev => ({
                            ...prev,
                            returnsPolicy: { ...prev.returnsPolicy, returnShipping: e.target.value }
                          }))}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="customer">Customer pays return shipping</option>
                          <option value="seller">Free returns (you pay)</option>
                          <option value="faulty_only">Free returns for faulty items only</option>
                        </select>
                      </div>

                      {/* Exchange Option */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">Offer Exchanges</h4>
                          <p className="text-xs text-gray-600">Allow customers to exchange for different items</p>
                        </div>
                        <button
                          onClick={() => setStoreConfig(prev => ({
                            ...prev,
                            returnsPolicy: { ...prev.returnsPolicy, exchangeOffered: !prev.returnsPolicy?.exchangeOffered }
                          }))}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            storeConfig.returnsPolicy?.exchangeOffered ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                              storeConfig.returnsPolicy?.exchangeOffered ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Custom Additional Text */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Additional Policy Notes (Optional)</label>
                        <textarea
                          placeholder="Any additional terms or exceptions..."
                          value={storeConfig.returnsPolicy?.customText || ""}
                          onChange={(e) => setStoreConfig(prev => ({
                            ...prev,
                            returnsPolicy: { ...prev.returnsPolicy, customText: e.target.value }
                          }))}
                          className="w-full p-3 border border-gray-300 rounded-lg resize-none h-16 text-sm"
                        />
                      </div>

                      {/* Generated Policy Preview */}
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          Generated Policy Preview
                        </h4>
                        <div className="text-sm text-blue-800 space-y-2">
                          <p><strong>Returns:</strong> We accept returns within {storeConfig.returnsPolicy?.returnWindow || "30"} days of purchase.</p>
                          <p><strong>Condition:</strong> Items must be {
                            storeConfig.returnsPolicy?.conditionRequired === "unused" ? "unused and in original packaging" :
                            storeConfig.returnsPolicy?.conditionRequired === "unopened" ? "unopened and sealed" :
                            "in any condition"
                          }.</p>
                          <p><strong>Refunds:</strong> Refunds will be issued to {
                            storeConfig.returnsPolicy?.refundMethod === "original" ? "your original payment method" :
                            storeConfig.returnsPolicy?.refundMethod === "store_credit" ? "store credit" :
                            "your preferred method"
                          }.</p>
                          <p><strong>Shipping:</strong> {
                            storeConfig.returnsPolicy?.returnShipping === "customer" ? "Return shipping costs are the responsibility of the customer" :
                            storeConfig.returnsPolicy?.returnShipping === "seller" ? "We provide free return shipping" :
                            "Free return shipping is provided for faulty items"
                          }.</p>
                          {storeConfig.returnsPolicy?.exchangeOffered && (
                            <p><strong>Exchanges:</strong> We offer exchanges for different sizes or items of equal value.</p>
                          )}
                          {storeConfig.returnsPolicy?.customText && (
                            <p><strong>Additional:</strong> {storeConfig.returnsPolicy.customText}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Branding Section */}
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Branding
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Brand Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={storeConfig.brandColor}
                          onChange={(e) => setStoreConfig(prev => ({ ...prev, brandColor: e.target.value }))}
                          className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                        />
                        <Input
                          value={storeConfig.brandColor}
                          onChange={(e) => setStoreConfig(prev => ({ ...prev, brandColor: e.target.value }))}
                          className="flex-1 font-mono text-sm"
                        />
                      </div>
                      <p className="text-xs text-gray-500">Primary color for buttons and accents</p>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Logo URL</label>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="https://example.com/logo.png or upload image below"
                            value={storeConfig.logo}
                            onChange={(e) => setStoreConfig(prev => ({ ...prev, logo: e.target.value }))}
                            className="flex-1"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <UploadImageButton 
                            onUploaded={(url) => setStoreConfig(prev => ({ ...prev, logo: url }))} 
                            className="flex-shrink-0"
                          />
                          <span className="text-xs text-gray-500">Choose from your computer</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">Optional logo image - enter URL or upload from your computer</p>
                    </div>
                  </div>
                </div>

                {/* Publishing Section */}
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Publishing
                  </h3>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">Publish Store</h4>
                          <span 
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              storeConfig.isPublished 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {storeConfig.isPublished ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {storeConfig.isPublished 
                            ? 'Your store is live and accessible to visitors' 
                            : 'Publish your store to make it accessible to visitors'
                          }
                        </p>
                      </div>
                      
                      {!storeConfig.isPublished ? (
                        <Button
                          onClick={publishStore}
                          disabled={isPublishing || !storeConfig.handle.trim()}
                          className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                        >
                          {isPublishing ? (
                            <>
                              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                              Publishing...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Publish Store
                            </>
                          )}
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="font-medium">Published</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {storeConfig.isPublished && storeConfig.handle && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">
                        🎉 Your store is live at: <span className="font-mono font-medium">fotonix.co.uk/store/{storeConfig.handle}</span>
                      </p>
                    </div>
                  )}
                  
                  {/* Important Warning */}
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-sm font-bold">!</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-amber-800 mb-2">⚠️ Important: Store Name Cannot Be Changed After Saving</h4>
                        <div className="text-sm text-amber-700 space-y-2">
                          <p><strong>Once you save your store, the store name and handle become permanent.</strong></p>
                          <p>You can edit your store content later, but these cannot be changed:</p>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            <li><strong>Store Name:</strong> "{storeConfig.displayName || 'Your Store Name'}"</li>
                            <li><strong>Store Handle:</strong> fotonix.co.uk/store/<span className="font-mono font-semibold">{storeConfig.handle || 'yourhandle'}</span></li>
                          </ul>
                          <p className="font-medium pt-2 text-amber-800">
                            ✅ <strong>You CAN change later:</strong> Store content, blocks, products, images, and branding
                          </p>
                          <p className="font-medium text-red-700">
                            ❌ <strong>You CANNOT change later:</strong> Store name and URL handle
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-600">
                  Changes are saved automatically
                </div>
                {/* Reset button for stuck stores - only show if not published */}
                {!storeConfig.isPublished && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm('⚠️ This will clear your local store data and start fresh. Are you sure?')) {
                        localStorage.removeItem('store.blocks');
                        localStorage.removeItem('store.config');
                        localStorage.removeItem('store.theme');
                        setShowStoreSettings(false);
                        setShowStoreOnboarding(true);
                        setOnboardingStep(1);
                        setStoreConfig({
                          handle: "",
                          displayName: "",
                          description: "",
                          isPublished: false,
                          seoTitle: "",
                          seoDescription: "",
                          brandColor: "#4f46e5",
                          logo: "",
                          favicon: "",
                          returnsPolicy: {
                            enabled: false,
                            returnWindow: "30",
                            conditionRequired: "unused",
                            refundMethod: "original",
                            returnShipping: "customer",
                            exchangeOffered: true,
                            customText: "",
                          },
                        });
                        setIsHandleLocked(false);
                      }
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Reset Store
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowStoreSettings(false)}
                >
                  Close
                </Button>
                {storeConfig.handle && (
                  <Button
                    onClick={() => {
                      if (storeConfig.handle) {
                        window.open(`/store/${storeConfig.handle}`, '_blank');
                      }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Store
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Store Onboarding Modal */}
      {showStoreOnboarding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
              <div className="flex items-center gap-3">
                <Store className="h-8 w-8" />
                <div>
                  <h2 className="text-2xl font-bold">Create Your Store</h2>
                  <p className="text-indigo-100 text-sm">Let's set up your store in a few steps</p>
                </div>
              </div>
              {/* Progress indicator - 5 steps now */}
              <div className="flex items-center gap-2 mt-4">
                {[1, 2, 3, 4, 5].map(step => (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      onboardingStep >= step 
                        ? 'bg-white text-indigo-600' 
                        : 'bg-indigo-500 text-white'
                    }`}>
                      {onboardingStep > step ? '✓' : step}
                    </div>
                    {step < 5 && <div className={`w-6 h-1 rounded ${onboardingStep > step ? 'bg-white' : 'bg-indigo-500'}`} />}
                  </div>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Step 1: Store Identity */}
              {onboardingStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Store className="h-5 w-5 text-indigo-600" />
                      Store Identity
                    </h3>
                    
                    {/* Show that store name was set during signup */}
                    {memberProfile?.storeName && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                        <p className="text-sm text-green-800">
                          <strong>✓ Store name set during signup:</strong> {memberProfile.storeName}
                        </p>
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Store Name *</label>
                        <Input
                          placeholder="My Awesome Store"
                          value={storeConfig.displayName}
                          onChange={(e) => setStoreConfig(prev => ({ ...prev, displayName: e.target.value }))}
                          className={`w-full ${memberProfile?.storeName ? 'bg-gray-50' : ''}`}
                          readOnly={!!memberProfile?.storeName}
                        />
                        <p className="text-xs text-gray-500">
                          {memberProfile?.storeName 
                            ? 'This name was set during your signup'
                            : 'This is the public name that customers will see'}
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Store Handle (URL) *</label>
                        <div className="relative">
                          <Input
                            placeholder="mystore"
                            value={storeConfig.handle}
                            onChange={(e) => {
                              const newHandle = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                              setStoreConfig(prev => ({ ...prev, handle: newHandle }));
                              setHandleError('');
                            }}
                            className={`w-full ${handleError ? 'border-red-300' : ''}`}
                          />
                          {isCheckingHandle && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full" />
                            </div>
                          )}
                        </div>
                        {handleError && <p className="text-xs text-red-600">{handleError}</p>}
                        <p className="text-xs text-gray-500">
                          Your store will be at: fotonix.co.uk/store/<span className="font-mono font-medium">{storeConfig.handle || 'yourhandle'}</span>
                        </p>
                        
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mt-3">
                          <p className="text-xs text-amber-800">
                            <strong>⚠️ Important:</strong> Your store handle cannot be changed after saving. Choose carefully!
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Store Description</label>
                        <textarea
                          placeholder="Tell customers what your store offers..."
                          value={storeConfig.description}
                          onChange={(e) => setStoreConfig(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full p-3 border border-gray-300 rounded-lg resize-none h-20 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Returns Policy */}
              {onboardingStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <RotateCcw className="h-5 w-5 text-indigo-600" />
                      Returns Policy
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Required</span>
                    </h3>
                    
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                      <p className="text-sm text-amber-800">
                        <strong>⚠️ Required:</strong> All stores must have a returns policy to build customer trust.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Return Window */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Return Window</label>
                        <select
                          value={storeConfig.returnsPolicy?.returnWindow || "30"}
                          onChange={(e) => setStoreConfig(prev => ({
                            ...prev,
                            returnsPolicy: { ...prev.returnsPolicy, enabled: true, returnWindow: e.target.value }
                          }))}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="14">14 days</option>
                          <option value="30">30 days (Recommended)</option>
                          <option value="60">60 days</option>
                          <option value="90">90 days</option>
                        </select>
                      </div>

                      {/* Item Condition */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Item Condition Required</label>
                        <select
                          value={storeConfig.returnsPolicy?.conditionRequired || "unused"}
                          onChange={(e) => setStoreConfig(prev => ({
                            ...prev,
                            returnsPolicy: { ...prev.returnsPolicy, enabled: true, conditionRequired: e.target.value }
                          }))}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="unused">Unused with original packaging</option>
                          <option value="unopened">Unopened/Sealed only</option>
                          <option value="any">Any condition</option>
                        </select>
                      </div>

                      {/* Refund Method */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Refund Method</label>
                        <select
                          value={storeConfig.returnsPolicy?.refundMethod || "original"}
                          onChange={(e) => setStoreConfig(prev => ({
                            ...prev,
                            returnsPolicy: { ...prev.returnsPolicy, enabled: true, refundMethod: e.target.value }
                          }))}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="original">Original payment method</option>
                          <option value="store_credit">Store credit only</option>
                          <option value="choice">Customer's choice</option>
                        </select>
                      </div>

                      {/* Return Shipping */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Return Shipping Paid By</label>
                        <select
                          value={storeConfig.returnsPolicy?.returnShipping || "customer"}
                          onChange={(e) => setStoreConfig(prev => ({
                            ...prev,
                            returnsPolicy: { ...prev.returnsPolicy, enabled: true, returnShipping: e.target.value }
                          }))}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="customer">Customer pays return shipping</option>
                          <option value="seller">Free returns (you pay)</option>
                          <option value="faulty_only">Free returns for faulty items only</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Contact Details */}
              {onboardingStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Phone className="h-5 w-5 text-indigo-600" />
                      Contact Details
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Customer Trust</span>
                    </h3>
                    
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                      <p className="text-sm text-blue-800">
                        <strong>📞 Build trust:</strong> Customers are more likely to purchase when they can contact you.
                        These details will appear on your store's contact page.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Contact Email */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Contact Email *</label>
                        {isLoadingEmails ? (
                          <div className="p-3 border border-gray-200 rounded-lg flex items-center gap-2">
                            <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full" />
                            <span className="text-sm text-gray-500">Loading your business emails...</span>
                          </div>
                        ) : businessEmails.length > 0 ? (
                          <>
                            <select
                              value={storeConfig.contactDetails?.emailId || ""}
                              onChange={(e) => {
                                const selectedEmail = businessEmails.find(em => em.id === parseInt(e.target.value));
                                setStoreConfig(prev => ({
                                  ...prev,
                                  contactDetails: { 
                                    ...prev.contactDetails, 
                                    email: selectedEmail?.email || '',
                                    emailId: selectedEmail?.id || null
                                  }
                                }));
                              }}
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                            >
                              <option value="">Select a business email...</option>
                              {businessEmails.map(email => (
                                <option key={email.id} value={email.id}>
                                  {email.email} ({email.type})
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500">
                              These emails were created during your signup. Select which one customers should contact.
                            </p>
                          </>
                        ) : (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-sm text-amber-800">
                              No business emails found. You can enter a contact email manually.
                            </p>
                            <Input
                              type="email"
                              placeholder="contact@yourbusiness.com"
                              value={storeConfig.contactDetails?.email || ""}
                              onChange={(e) => setStoreConfig(prev => ({
                                ...prev,
                                contactDetails: { ...prev.contactDetails, email: e.target.value }
                              }))}
                              className="w-full mt-2"
                            />
                          </div>
                        )}
                      </div>

                      {/* Phone Number */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Phone Number (Optional)</label>
                        <Input
                          type="tel"
                          placeholder="+44 7123 456789"
                          value={storeConfig.contactDetails?.phone || ""}
                          onChange={(e) => setStoreConfig(prev => ({
                            ...prev,
                            contactDetails: { ...prev.contactDetails, phone: e.target.value }
                          }))}
                          className="w-full"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="showPhone"
                            checked={storeConfig.contactDetails?.showPhone || false}
                            onChange={(e) => setStoreConfig(prev => ({
                              ...prev,
                              contactDetails: { ...prev.contactDetails, showPhone: e.target.checked }
                            }))}
                            className="rounded border-gray-300"
                          />
                          <label htmlFor="showPhone" className="text-xs text-gray-600">
                            Display phone number publicly on store
                          </label>
                        </div>
                      </div>

                      {/* Business Hours */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Business Hours (Optional)</label>
                        <Input
                          type="text"
                          placeholder="Mon-Fri 9am-5pm, Sat 10am-2pm"
                          value={storeConfig.contactDetails?.businessHours || ""}
                          onChange={(e) => setStoreConfig(prev => ({
                            ...prev,
                            contactDetails: { ...prev.contactDetails, businessHours: e.target.value }
                          }))}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500">
                          Let customers know when they can expect a response.
                        </p>
                      </div>

                      {/* Business Address */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Business Address (Optional)</label>
                        <textarea
                          placeholder="123 High Street, London, SW1A 1AA"
                          value={storeConfig.contactDetails?.address || ""}
                          onChange={(e) => setStoreConfig(prev => ({
                            ...prev,
                            contactDetails: { ...prev.contactDetails, address: e.target.value }
                          }))}
                          className="w-full p-3 border border-gray-300 rounded-lg resize-none h-16 text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="showAddress"
                            checked={storeConfig.contactDetails?.showAddress || false}
                            onChange={(e) => setStoreConfig(prev => ({
                              ...prev,
                              contactDetails: { ...prev.contactDetails, showAddress: e.target.checked }
                            }))}
                            className="rounded border-gray-300"
                          />
                          <label htmlFor="showAddress" className="text-xs text-gray-600">
                            Display address publicly on store
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Email Automation */}
              {onboardingStep === 4 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Mail className="h-5 w-5 text-indigo-600" />
                      Email Automation
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Revenue Booster</span>
                    </h3>
                    
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg mb-4">
                      <p className="text-sm text-purple-800">
                        <strong>🚀 Boost your sales:</strong> Enable automated email sequences to recover abandoned carts, 
                        follow up after purchases, and bring back inactive customers.
                      </p>
                    </div>

                    {/* Select All Option */}
                    <div 
                      onClick={() => {
                        const allTools = ['post-purchase-journey', 'win-back', 'abandoned-cart', 'one-click-upsells', 'anniversary-emails'];
                        const allSelected = allTools.every(t => selectedRevenueTools.includes(t));
                        if (allSelected) {
                          setSelectedRevenueTools([]);
                        } else {
                          setSelectedRevenueTools(allTools);
                        }
                      }}
                      className={`cursor-pointer p-4 rounded-lg border-2 transition-all mb-3 ${
                        ['post-purchase-journey', 'win-back', 'abandoned-cart', 'one-click-upsells', 'anniversary-emails'].every(t => selectedRevenueTools.includes(t))
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-300 hover:border-green-400 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          ['post-purchase-journey', 'win-back', 'abandoned-cart', 'one-click-upsells', 'anniversary-emails'].every(t => selectedRevenueTools.includes(t))
                            ? 'border-green-500 bg-green-500'
                            : 'border-gray-400'
                        }`}>
                          {['post-purchase-journey', 'win-back', 'abandoned-cart', 'one-click-upsells', 'anniversary-emails'].every(t => selectedRevenueTools.includes(t)) && (
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">✅ Select All Automations</h4>
                          <p className="text-sm text-gray-600">Enable all email automation campaigns (recommended)</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {/* Post-Purchase Journey */}
                      <div 
                        onClick={() => setSelectedRevenueTools(prev => 
                          prev.includes('post-purchase-journey') 
                            ? prev.filter(id => id !== 'post-purchase-journey')
                            : [...prev, 'post-purchase-journey']
                        )}
                        className={`cursor-pointer p-3 rounded-lg border-2 transition-all ${
                          selectedRevenueTools.includes('post-purchase-journey')
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selectedRevenueTools.includes('post-purchase-journey')
                              ? 'border-purple-500 bg-purple-500'
                              : 'border-gray-300'
                          }`}>
                            {selectedRevenueTools.includes('post-purchase-journey') && (
                              <CheckCircle2 className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">🎉 Post-Purchase Journey</h4>
                            <p className="text-xs text-gray-500">Thank You → Usage Guide → Add-on → Review Request → VIP Discount</p>
                          </div>
                        </div>
                      </div>

                      {/* Win-Back Campaigns */}
                      <div 
                        onClick={() => setSelectedRevenueTools(prev => 
                          prev.includes('win-back') 
                            ? prev.filter(id => id !== 'win-back')
                            : [...prev, 'win-back']
                        )}
                        className={`cursor-pointer p-3 rounded-lg border-2 transition-all ${
                          selectedRevenueTools.includes('win-back')
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selectedRevenueTools.includes('win-back')
                              ? 'border-purple-500 bg-purple-500'
                              : 'border-gray-300'
                          }`}>
                            {selectedRevenueTools.includes('win-back') && (
                              <CheckCircle2 className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">💜 Win-Back Campaigns</h4>
                            <p className="text-xs text-gray-500">We Miss You (30d) → Product Suggestion (60d) → Personalized Offer (90d)</p>
                          </div>
                        </div>
                      </div>

                      {/* Abandoned Cart Recovery */}
                      <div 
                        onClick={() => setSelectedRevenueTools(prev => 
                          prev.includes('abandoned-cart') 
                            ? prev.filter(id => id !== 'abandoned-cart')
                            : [...prev, 'abandoned-cart']
                        )}
                        className={`cursor-pointer p-3 rounded-lg border-2 transition-all ${
                          selectedRevenueTools.includes('abandoned-cart')
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selectedRevenueTools.includes('abandoned-cart')
                              ? 'border-purple-500 bg-purple-500'
                              : 'border-gray-300'
                          }`}>
                            {selectedRevenueTools.includes('abandoned-cart') && (
                              <CheckCircle2 className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">🛒 Abandoned Cart Recovery</h4>
                            <p className="text-xs text-gray-500">Cart Reminder (1h) → Need Help? (24h) → Discount Offer (3d)</p>
                          </div>
                        </div>
                      </div>

                      {/* One-Click Upsells */}
                      <div 
                        onClick={() => setSelectedRevenueTools(prev => 
                          prev.includes('one-click-upsells') 
                            ? prev.filter(id => id !== 'one-click-upsells')
                            : [...prev, 'one-click-upsells']
                        )}
                        className={`cursor-pointer p-3 rounded-lg border-2 transition-all ${
                          selectedRevenueTools.includes('one-click-upsells')
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selectedRevenueTools.includes('one-click-upsells')
                              ? 'border-purple-500 bg-purple-500'
                              : 'border-gray-300'
                          }`}>
                            {selectedRevenueTools.includes('one-click-upsells') && (
                              <CheckCircle2 className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">⚡ One-Click Upsells</h4>
                            <p className="text-xs text-gray-500">Deluxe Upgrade (1h) → Accessory Offer (24h) → Also Bought (3d)</p>
                          </div>
                        </div>
                      </div>

                      {/* Anniversary Emails */}
                      <div 
                        onClick={() => setSelectedRevenueTools(prev => 
                          prev.includes('anniversary-emails') 
                            ? prev.filter(id => id !== 'anniversary-emails')
                            : [...prev, 'anniversary-emails']
                        )}
                        className={`cursor-pointer p-3 rounded-lg border-2 transition-all ${
                          selectedRevenueTools.includes('anniversary-emails')
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selectedRevenueTools.includes('anniversary-emails')
                              ? 'border-purple-500 bg-purple-500'
                              : 'border-gray-300'
                          }`}>
                            {selectedRevenueTools.includes('anniversary-emails') && (
                              <CheckCircle2 className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">🎂 Anniversary Emails</h4>
                            <p className="text-xs text-gray-500">Anniversary Reminder → Upgrade Offer → Matching Products (1 year)</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 mt-4">
                      You can configure timing and customize templates later in your Email Automation dashboard.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 5: Review & Create */}
              {onboardingStep === 5 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      Review Your Store
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Store Name:</span>
                          <span className="font-medium">{storeConfig.displayName || 'Not set'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Store URL:</span>
                          <span className="font-mono text-sm">fotonix.co.uk/store/{storeConfig.handle || 'not-set'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Returns Policy:</span>
                          <span className="font-medium text-green-600">✓ Configured</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Contact Email:</span>
                          <span className="font-medium text-blue-600">
                            {storeConfig.contactDetails?.email || '○ Not set'}
                          </span>
                        </div>
                        {storeConfig.contactDetails?.phone && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Phone:</span>
                            <span className="font-medium">{storeConfig.contactDetails.phone}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600">Email Automation:</span>
                          <span className="font-medium text-purple-600">
                            {selectedRevenueTools.length > 0 
                              ? `✓ ${selectedRevenueTools.length} automation${selectedRevenueTools.length > 1 ? 's' : ''} enabled`
                              : '○ None selected'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h4 className="font-medium text-green-800 mb-2">🎉 You're ready to build!</h4>
                        <p className="text-sm text-green-700">
                          After clicking "Create Store", you'll be taken to the drag-and-drop store builder 
                          where you can add products, customize your layout, and publish your store.
                        </p>
                      </div>

                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-800">
                          <strong>Remember:</strong> Your store name and URL cannot be changed after creation.
                          You can always edit your store content, products, and design later.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  if (onboardingStep > 1) {
                    setOnboardingStep(onboardingStep - 1);
                  } else {
                    // Go back to members dashboard
                    window.location.href = '/#member-dashboard';
                  }
                }}
              >
                {onboardingStep > 1 ? 'Back' : 'Cancel'}
              </Button>
              
              <Button
                onClick={() => {
                  if (onboardingStep < 5) {
                    // Validate current step
                    if (onboardingStep === 1) {
                      if (!storeConfig.displayName.trim() || !storeConfig.handle.trim()) {
                        alert('Please fill in both store name and handle');
                        return;
                      }
                    }
                    if (onboardingStep === 3) {
                      // Contact details - email is required
                      if (!storeConfig.contactDetails?.email) {
                        alert('Please select or enter a contact email');
                        return;
                      }
                    }
                    setOnboardingStep(onboardingStep + 1);
                  } else {
                    // Final step (step 5) - create store
                    setStoreConfig(prev => ({
                      ...prev,
                      returnsPolicy: {
                        ...prev.returnsPolicy,
                        enabled: true
                      }
                    }));
                    // Clear any old localStorage data
                    localStorage.removeItem('store.blocks');
                    localStorage.removeItem('store.config');
                    localStorage.removeItem('store.theme');
                    // Close onboarding and load builder
                    setShowStoreOnboarding(false);
                    setBlocks(loadInitialBlocks());
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={
                  (onboardingStep === 1 && (!storeConfig.displayName.trim() || !storeConfig.handle.trim())) ||
                  (onboardingStep === 2 && !storeConfig.returnsPolicy?.returnWindow) ||
                  (onboardingStep === 3 && !storeConfig.contactDetails?.email)
                }
              >
                {onboardingStep < 5 ? 'Continue' : 'Create Store'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Layout Review Modal */}
      {showReview && reviewData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-6 w-6" />
                  <div>
                    <h2 className="text-xl font-bold">AI Store Review</h2>
                    <p className="text-purple-100 text-sm">Intelligent layout analysis & recommendations</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReview(false)}
                  className="text-white hover:bg-white/20"
                >
                  ✕
                </Button>
              </div>
              
              {/* Overall Score */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{reviewData.overall.score}%</div>
                    <div className="text-sm text-purple-100">Overall Score</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold">{reviewData.conversion.score}%</div>
                      <div className="text-xs text-purple-100">Conversion</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{reviewData.ux.score}%</div>
                      <div className="text-xs text-purple-100">UX</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{reviewData.performance.score}%</div>
                      <div className="text-xs text-purple-100">Performance</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Analysis */}
                <div className="space-y-6">
                  {/* Conversion Analysis */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5" />
                      Conversion Analysis ({reviewData.conversion.score}%)
                    </h3>
                    <div className="space-y-2">
                      {reviewData.conversion.factors.map((factor, idx) => (
                        <div key={idx} className="text-sm text-green-700">{factor}</div>
                      ))}
                      {reviewData.conversion.missing.map((missing, idx) => (
                        <div key={idx} className="text-sm text-red-600">{missing}</div>
                      ))}
                    </div>
                  </div>

                  {/* UX Analysis */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      User Experience ({reviewData.ux.score}%)
                    </h3>
                    <div className="space-y-2">
                      {reviewData.ux.improvements.map((improvement, idx) => (
                        <div key={idx} className="text-sm text-blue-700">{improvement}</div>
                      ))}
                      {reviewData.ux.issues.map((issue, idx) => (
                        <div key={idx} className="text-sm text-red-600">{issue}</div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column - Recommendations */}
                <div className="space-y-6">
                  {/* Key Recommendations */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Key Recommendations
                    </h3>
                    <div className="space-y-2">
                      {reviewData.overall.recommendations.map((rec, idx) => (
                        <div key={idx} className="text-sm text-yellow-700 bg-yellow-100 p-2 rounded">{rec}</div>
                      ))}
                      {reviewData.overall.strengths.map((strength, idx) => (
                        <div key={idx} className="text-sm text-green-700 bg-green-100 p-2 rounded">{strength}</div>
                      ))}
                    </div>
                  </div>

                  {/* Section-by-Section */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <LayoutTemplate className="h-5 w-5" />
                      Section Analysis
                    </h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {reviewData.sections.map((section, idx) => (
                        <div key={idx} className="bg-white p-3 rounded border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">#{section.position} {section.name}</span>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">{section.score}%</span>
                          </div>
                          {section.feedback.map((fb, fbIdx) => (
                            <div key={fbIdx} className="text-xs text-gray-600">{fb}</div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Analysis powered by conversion optimization AI
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowReview(false)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    analyzeStoreLayout();
                  }}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Re-analyze
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Revenue Boosting Tools Modal */}
      {showRevenueTools && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Zap className="h-6 w-6" />
                    Revenue Boosting Tools
                  </h2>
                  <p className="text-purple-100 text-sm mt-1">
                    Automated email campaigns that increase sales & retention
                  </p>
                </div>
                <button
                  onClick={() => setShowRevenueTools(false)}
                  className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="space-y-4">
                {/* Revenue Tool Options */}
                {[
                  {
                    id: 'post-purchase-journey',
                    title: '🟣 Post-Purchase Email Journeys',
                    subtitle: 'Auto-generated after each sale',
                    description: 'Trigger after each sale: Thank you email, Usage guide/instructions, Recommended add-on, Request a review, VIP discount for next purchase.',
                    impact: 'Dramatically increases repeat orders',
                    steps: ['Thank you email', 'Usage guide/instructions', 'Recommended add-on', 'Request a review', 'VIP discount']
                  },
                  {
                    id: 'win-back',
                    title: '🟣 Win-Back Campaigns',
                    subtitle: 'Automatic emails when customers go quiet',
                    description: 'Automatic emails sent when customers go quiet: 30-day "We miss you", 60-day product suggestion, 90-day personalised offer.',
                    impact: 'Extremely effective for retention',
                    steps: ['30-day "We miss you"', '60-day product suggestion', '90-day personalised offer']
                  },
                  {
                    id: 'abandoned-cart',
                    title: '🟣 Abandoned Cart Emails',
                    subtitle: 'Recover lost sales automatically',
                    description: 'When a customer leaves: Reminder email, "Need help?" follow-up, Small discount on 3rd attempt.',
                    impact: 'Instant extra revenue from abandoned carts',
                    steps: ['Reminder email', '"Need help?" follow-up', 'Small discount on 3rd attempt']
                  },
                  {
                    id: 'one-click-upsell',
                    title: '🟣 One-Click Upsell Emails',
                    subtitle: 'Increase order value post-purchase',
                    description: 'After purchase send: "Upgrade to the deluxe version", "Add this accessory at 20% off", "Customers also bought..."',
                    impact: 'Increases AOV (Average Order Value) massively',
                    steps: ['Deluxe upgrade offer', '20% off accessory', 'Customers also bought']
                  },
                  {
                    id: 'personalized-recommendations',
                    title: '🟣 Personalised Recommendation Emails',
                    subtitle: 'AI-based product suggestions',
                    description: 'AI-based product suggestions using: Customer\'s past purchases, Seen/added-to-cart items, Matching colours/styles.',
                    impact: 'High repeat conversion rates',
                    steps: ['Past purchase analysis', 'Browsing history', 'Style matching']
                  },
                  {
                    id: 'follow-up-after-use',
                    title: '🟣 Automated Follow-Up After Product Use',
                    subtitle: 'Build long-term relationships',
                    description: 'For example: 7 days: "How\'s it going?", 14 days: "Send us a picture & get 10% off", 30 days: "Want a matching piece?"',
                    impact: 'Creates feedback loop = long-term retention',
                    steps: ['7-day check-in', '14-day photo incentive', '30-day cross-sell']
                  },
                  {
                    id: 'anniversary-emails',
                    title: '🟣 Anniversary / Memory Lane Emails',
                    subtitle: 'Powerful reactivation strategy',
                    description: 'Your system can send: "This time last year you bought this...", "Here\'s an upgraded version of your design", "Want a matching LED/acrylic piece?"',
                    impact: 'Perfect for personalised reactivation',
                    steps: ['Anniversary reminder', 'Upgrade offer', 'Matching products']
                  }
                ].map((tool) => (
                  <div
                    key={tool.id}
                    onClick={() => {
                      setSelectedRevenueTools(prev => 
                        prev.includes(tool.id) 
                          ? prev.filter(id => id !== tool.id)
                          : [...prev, tool.id]
                      );
                    }}
                    className={`
                      cursor-pointer rounded-xl border-2 p-5 transition-all hover:shadow-lg
                      ${selectedRevenueTools.includes(tool.id)
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                      }
                    `}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`
                        mt-1 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition
                        ${selectedRevenueTools.includes(tool.id)
                          ? 'border-purple-500 bg-purple-500'
                          : 'border-gray-300'
                        }
                      `}>
                        {selectedRevenueTools.includes(tool.id) && (
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        )}
                      </div>

                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-900 mb-1">
                          {tool.title}
                        </h3>
                        <p className="text-sm text-purple-600 font-medium mb-2">
                          {tool.subtitle}
                        </p>
                        <p className="text-sm text-gray-700 mb-3">
                          {tool.description}
                        </p>
                        
                        {/* Steps */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {tool.steps.map((step, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full"
                            >
                              {step}
                            </span>
                          ))}
                        </div>

                        {/* Impact */}
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-semibold text-green-600">Impact:</span>
                          <span className="text-green-700">{tool.impact}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {selectedRevenueTools.length > 0 ? (
                  <span className="font-semibold text-purple-600">
                    ✓ {selectedRevenueTools.length} tool{selectedRevenueTools.length > 1 ? 's' : ''} selected
                  </span>
                ) : (
                  <span>Select the tools you want to activate</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowRevenueTools(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    // Save selected tools to store config
                    setStoreConfig(prev => ({
                      ...prev,
                      revenueTools: selectedRevenueTools
                    }));
                    setShowRevenueTools(false);
                    setSaveStatus('success');
                    setTimeout(() => setSaveStatus(null), 3000);
                  }}
                  disabled={selectedRevenueTools.length === 0}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Activate {selectedRevenueTools.length > 0 && `(${selectedRevenueTools.length})`}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </TooltipProvider>
  );
}

// Block renderer component
function BlockRenderer({ block, editable = false, onChange, currentUserId, theme, isPreview = false }) {
  const def = STORE_BLOCKS[block.type];
  if (!def) return <div className="text-red-500">Unknown block: {block.type}</div>;
  
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
      >
        {def.render({ data: block.data, onChange, editable, currentUserId, theme, isPreview })}
      </motion.div>
    </AnimatePresence>
  );
}

// Preview Component
function StorePreview({ blocks, theme, device, storeConfig, setPreviewDevice }) {
  const getDeviceClasses = () => {
    switch (device) {
      case 'mobile':
        return 'max-w-sm mx-auto';
      case 'tablet':
        return 'max-w-2xl mx-auto';
      default:
        return 'max-w-6xl mx-auto';
    }
  };

  const getDeviceStyles = () => {
    switch (device) {
      case 'mobile':
        return { width: '375px', minHeight: '667px' };
      case 'tablet':
        return { width: '768px', minHeight: '1024px' };
      default:
        return { width: '100%', minHeight: '100vh' };
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Preview Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Store Preview</h2>
          <p className="text-gray-600">
            {storeConfig.displayName || 'Your Store'} • {device === 'desktop' ? 'Desktop' : device === 'tablet' ? 'Tablet' : 'Mobile'} View
          </p>
          {storeConfig.handle && (
            <p className="text-sm text-gray-500 mt-1">
              Live URL: <span className="font-mono bg-gray-200 px-2 py-1 rounded">
                yoursite.com/store/{storeConfig.handle}
              </span>
            </p>
          )}
        </div>

        {/* Device Frame */}
        <div className="flex justify-center">
          <div 
            className={`bg-white rounded-lg shadow-2xl overflow-hidden ${device === 'desktop' ? 'w-full max-w-none' : getDeviceClasses()}`}
            style={device === 'desktop' ? { width: '100%', minHeight: '100vh' } : getDeviceStyles()}
          >
            {/* Mobile/Tablet Frame */}
            {device !== 'desktop' && (
              <div className="bg-gray-800 px-4 py-2 flex items-center justify-center">
                <div className="w-2 h-2 bg-gray-600 rounded-full mx-1"></div>
                <div className="flex-1 text-center">
                  <div className="bg-gray-700 rounded-full h-1 w-16 mx-auto"></div>
                </div>
                <div className="w-2 h-2 bg-gray-600 rounded-full mx-1"></div>
              </div>
            )}

            {/* Store Content */}
            <div className="bg-white" style={{ ...theme?.cssVars }}>
              {/* Realistic Store Header */}
              <div className="bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between max-w-6xl mx-auto">
                  <div className="flex items-center gap-3">
                    {storeConfig.logo ? (
                      <img src={storeConfig.logo} alt={storeConfig.displayName} className="h-8 w-auto" />
                    ) : (
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Store className="h-5 w-5 text-white" />
                      </div>
                    )}
                    <div>
                      <h1 className="font-bold text-lg text-gray-900">
                        {storeConfig.displayName || storeConfig.handle || 'Your Store'}
                      </h1>
                      {storeConfig.description && (
                        <p className="text-sm text-gray-600">{storeConfig.description}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span>Live Preview Mode</span>
                      </div>
                    </div>
                    {device === 'desktop' && (
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center">
                          <span className="text-xs">🛒</span>
                        </div>
                        <span className="text-sm text-gray-600">Cart (0)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {blocks.length === 0 ? (
                <div className="py-20 text-center text-gray-500">
                  <Store className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium mb-2">No blocks added yet</h3>
                  <p>Add some blocks to see your store preview</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {blocks.map((block, index) => (
                    <div key={block.id} className="w-full relative">
                      <BlockRenderer
                        block={block}
                        editable={false} // No text editing in preview
                        onChange={() => {}} // No data changes in preview  
                        currentUserId="preview-user-123" // Enable product loading for demo
                        theme={theme}
                        isPreview={true} // New prop to indicate this is preview mode
                      />
                      
                      {/* Preview Mode Indicator for Interactive Elements */}
                      {(block.type === 'chatbot' || block.type === 'featuredProduct') && (
                        <div className="absolute top-4 right-4 z-10">
                          <div className="bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-full font-medium shadow-lg flex items-center gap-1">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            INTERACTIVE
                          </div>
                        </div>
                      )}
                      
                      {/* Block Position Indicator */}
                      {device === 'desktop' && (
                        <div className="absolute top-2 left-2 z-10">
                          <div className="bg-black/70 text-white text-xs px-2 py-1 rounded font-mono">
                            #{index + 1}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile/Tablet Footer */}
            {device !== 'desktop' && (
              <div className="bg-gray-800 h-6"></div>
            )}
          </div>
        </div>

        {/* Preview Controls */}
        <div className="flex flex-col sm:flex-row justify-center items-center mt-8 gap-4">
          {/* Device Controls */}
          <div className="flex items-center gap-3 bg-white rounded-xl px-6 py-3 shadow-lg border border-gray-100">
            <span className="text-sm text-gray-700 font-semibold">View as:</span>
            <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-1">
              {[
                { key: "desktop", Icon: Laptop, label: "Desktop", desc: "1200px+" },
                { key: "tablet", Icon: Tablet, label: "Tablet", desc: "768px" },
                { key: "mobile", Icon: Smartphone, label: "Mobile", desc: "375px" },
              ].map(({ key, Icon, label, desc }) => (
                <button
                  key={key}
                  onClick={() => setPreviewDevice && setPreviewDevice(key)}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 min-w-[100px]
                    ${device === key 
                      ? "bg-white text-indigo-700 shadow-md ring-2 ring-indigo-200" 
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                    }
                  `}
                  title={`Preview at ${desc} width`}
                >
                  <Icon className={`h-4 w-4 ${device === key ? "text-indigo-700" : "text-gray-600"}`} />
                  <div className="text-left">
                    <div className="font-medium">{label}</div>
                    <div className="text-xs opacity-70">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Action Controls */}
          <div className="flex items-center gap-3 bg-white rounded-xl px-6 py-3 shadow-lg border border-gray-100">
            <span className="text-sm text-gray-700 font-semibold">Actions:</span>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline"
                className={`flex items-center gap-2 ${!storeConfig.isPublished ? 'opacity-60' : ''}`}
                title={!storeConfig.isPublished ? 'Publish your store first to share it' : 'Share your published store'}
                onClick={() => {
                  if (!storeConfig.handle) {
                    alert('To view your live store, you need to save it with a unique handle first.\n\n📝 How to set up your store handle:\n\n1. Click the "Settings" button in the top toolbar (left side)\n2. Scroll down to find the "Store Handle" field\n3. Enter a unique name for your store (e.g., "my-awesome-store")\n4. Click "Save Store Configuration" to save your settings\n5. Then return here and click "Live Store" to view your published store\n\n💡 Your store handle will be part of your store\'s web address: fotonix.co.uk/store/your-handle');
                    return;
                  }
                  
                  if (!storeConfig.isPublished) {
                    alert('🚀 Store Not Published Yet!\n\nYour store needs to be published before it can be viewed publicly.\n\n📝 How to publish your store:\n\n1. Make sure your store handle is set (already done ✓)\n2. Click the "Publish Store" button in the top toolbar\n3. Your store will be made live and accessible to visitors\n4. Then you can use "Live Store" to view it\n\n💡 Publishing makes your store available at: fotonix.co.uk/store/' + storeConfig.handle + '\n\n⚠️ Once published, your store handle cannot be changed to maintain consistent links.');
                    return;
                  }
                  
                  const url = `/store/${storeConfig.handle}`;
                  window.open(url, '_blank');
                }}
              >
                <ExternalLink className="h-4 w-4" />
                <span>Live Store</span>
              </Button>
              
              <Button 
                size="sm" 
                variant="outline"
                className={`flex items-center gap-2 ${!storeConfig.isPublished ? 'opacity-60' : ''}`}
                title={!storeConfig.isPublished ? 'Publish your store first to view it live' : 'View your published store'}
                onClick={() => {
                  if (!storeConfig.handle) {
                    alert('Please set up your store handle first before sharing.');
                    return;
                  }
                  
                  if (!storeConfig.isPublished) {
                    alert('📤 Store Not Published!\n\nYour store needs to be published before you can share it with others.\n\n🚀 Click "Publish Store" to make your store live and shareable!');
                    return;
                  }
                  
                  const shareText = `Check out my store: ${storeConfig.displayName || 'My Store'}`;
                  const shareUrl = `https://fotonix.co.uk/store/${storeConfig.handle}`;
                  
                  if (navigator.share) {
                    navigator.share({ title: shareText, url: shareUrl });
                  } else {
                    navigator.clipboard.writeText(shareUrl);
                    alert('Store URL copied to clipboard!\n\n📋 ' + shareUrl);
                  }
                }}
              >
                <div className="h-4 w-4 flex items-center justify-center">📱</div>
                <span>Share</span>
              </Button>
            </div>
          </div>
          
          {/* Stats Preview */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl px-6 py-3 shadow-lg border border-emerald-100">
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-emerald-700 font-semibold">Interactive</span>
              </div>
              <div className="w-px h-4 bg-gray-300"></div>
              <div className="text-gray-600">
                <span className="font-semibold">{blocks.length}</span> blocks
              </div>
              <div className="w-px h-4 bg-gray-300"></div>
              <div className="text-gray-600">
                <span className="font-semibold">{device}</span> view
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inspector component
function Inspector({ block, onChange }) {
  if (!block) return null;
  const def = STORE_BLOCKS[block.type];
  const insight = CONVERSION_INSIGHTS[block.type];
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{def.name}</h4>
        <Badge className="uppercase">{block.type}</Badge>
      </div>
      
      {/* Conversion Insights Panel */}
      {insight && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-5 mb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-base font-semibold text-green-800">Conversion Impact</span>
            </div>
            <div className="text-2xl font-bold text-green-600">+{insight.conversionLift}</div>
          </div>
          
          <div className="space-y-5">
            {/* Psychology Principle */}
            <div className="bg-white/60 rounded-lg p-4">
              <div className="text-sm text-green-600 font-semibold uppercase tracking-wide mb-3">Psychology Principle</div>
              <div className="text-base text-green-800 leading-relaxed font-medium">{insight.psychologyPrinciple}</div>
            </div>
            
            {/* Placement & Key Insight in a column */}
            <div className="space-y-4">
              <div className="bg-white/60 rounded-lg p-4">
                <div className="text-sm text-green-600 font-semibold uppercase tracking-wide mb-3">Optimal Placement</div>
                <div className="text-base text-green-800 leading-relaxed">📍 {insight.placement}</div>
              </div>
              
              <div className="bg-white/60 rounded-lg p-4">
                <div className="text-sm text-green-600 font-semibold uppercase tracking-wide mb-3">Key Research Insight</div>
                <div className="text-base text-green-800 italic leading-relaxed">"{insight.insights[0]}"</div>
              </div>
            </div>
            
            {/* Impact Breakdown - Vertical Layout */}
            <div className="bg-white/60 rounded-lg p-4">
              <div className="text-sm text-green-600 font-semibold uppercase tracking-wide mb-4">Conversion Impact Factors</div>
              <div className="space-y-4">
                {Object.entries(insight.conversionFactors).map(([factor, percentage]) => (
                  <div key={factor} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-base text-green-700 font-medium">{factor}</span>
                      <span className="text-base font-bold text-green-700">{percentage}</span>
                    </div>
                    <div className="w-full bg-green-200 rounded-full h-3">
                      <div 
                        className="bg-green-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: percentage }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Best Practices Expandable */}
            <details className="group bg-white/60 rounded-lg">
              <summary className="p-4 text-sm text-green-600 font-semibold uppercase tracking-wide cursor-pointer hover:text-green-700 flex items-center justify-between">
                <span>Best Practices & Tips</span>
                <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-4 pb-4 pt-1">
                <div className="space-y-3">
                  {insight.bestPractices.map((practice, idx) => (
                    <div key={idx} className="text-base text-green-700 flex items-start gap-3 p-3 bg-green-100/50 rounded-lg">
                      <span className="text-green-500 mt-1 font-bold text-lg">•</span>
                      <span className="leading-relaxed">{practice}</span>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          </div>
        </div>
      )}
      
      {def.inspector({ data: block.data, onChange })}
    </div>
  );
}