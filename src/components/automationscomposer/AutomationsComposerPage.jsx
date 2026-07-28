import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ArrowLeft, Home, Palette, Save, Settings, Eye, Code, Smartphone, Monitor, Tablet, Mail } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import Header from '../shared/Header';
import AutomationsEditor from './AutomationsEditor';
import { getAutomationEmailTemplate } from '../../services/email-automation/EmailTemplates';

export default function AutomationsComposerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};
  const { 
    template = null, 
    templates = [], 
    tenant = null, 
    intent = null,
    campaignType = null,
    emailType = null,
    emailName = null,
    campaignName = null
  } = state;
  
  // Load automation email template if we're editing one
  const [automationTemplate, setAutomationTemplate] = useState(null);
  
  useEffect(() => {
    if (campaignType && emailType) {
      const loadedTemplate = getAutomationEmailTemplate(campaignType, emailType);
      if (loadedTemplate) {
        setAutomationTemplate(loadedTemplate);
      }
    }
  }, [campaignType, emailType]);
  
  // Theme state for the composer page
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('fotonix-composer-theme');
    return saved ? JSON.parse(saved) : true;
  });

  // Handle navigation functions for header
  const handleNavigate = (page) => {
    if (page === 'home') {
      navigate('/');
    } else {
      // Use hash navigation for other pages
      window.location.hash = page;
      navigate('/');
    }
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  const sendCampaignRef = useRef(null);

  // Provide a simple onClose that navigates back to dashboard
  const handleClose = () => {
    navigate(-1);
  };

  // Handle search functionality
  const handleSearch = (query) => {
    console.log('Search query:', query);
    // Implement search functionality if needed
  };

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('fotonix-composer-theme', JSON.stringify(newTheme));
  };

  // Breadcrumb navigation
  const getBreadcrumbText = () => {
    if (campaignType && emailName) return `${campaignName} → ${emailName}`;
    if (intent === 'new-campaign') return 'Creating New Campaign';
    if (intent === 'new-template') return 'Creating New Template';
    if (template) return `Editing: ${template.name}`;
    return 'Mail Composer';
  };

  const getPageTitle = () => {
    if (campaignType && emailName) return `✏️ ${emailName}`;
    if (intent === 'new-campaign') return '📧 New Email Campaign';
    if (intent === 'new-template') return '📄 New Email Template';
    if (template) return `✏️ Edit: ${template.name}`;
    return '🎨 Automation Template Editor';
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDarkMode 
        ? 'bg-gradient-to-br from-[#0a0b14] via-[#0f1019] to-[#1a1b2e]' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      {/* Header Integration */}
      <Header 
        currentPage="mailbuilder-composer" 
        onNavigate={handleNavigate}
        onLogoClick={handleLogoClick}
        onSearch={handleSearch}
        searchResults={[]}
        onProductSelect={() => {}}
      />
      
      {/* Composer Navigation Bar */}
      <div className={`sticky top-16 z-40 border-b backdrop-blur-sm transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-neutral-950/80 border-white/10' 
          : 'bg-white/80 border-gray-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Left: Navigation & Breadcrumb */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleClose}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  isDarkMode
                    ? 'text-slate-300 hover:text-white hover:bg-white/10'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
              <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                <span>/</span>
              </div>
              <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-gray-700'}`}>
                {getBreadcrumbText()}
              </div>
            </div>

            {/* Center: Page Title */}
            <div className="flex items-center gap-2">
              <h1 className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                {getPageTitle()}
              </h1>
            </div>

            {/* Right: Theme Toggle & Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition-colors duration-200 ${
                  isDarkMode
                    ? 'text-slate-300 hover:text-white hover:bg-white/10'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
              >
                <Palette className="w-5 h-5" />
              </button>
              
              <div className={`w-px h-6 ${isDarkMode ? 'bg-slate-700' : 'bg-gray-300'}`} />
              
              <button
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  isDarkMode
                    ? 'text-slate-300 hover:text-white hover:bg-white/10'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              
              <button
                onClick={() => sendCampaignRef.current && sendCampaignRef.current()}
                className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 text-white rounded-lg text-sm font-semibold hover:brightness-110 active:brightness-95 transition-all shadow-lg shadow-pink-500/25"
              >
                <Save className="w-4 h-4" />
                {intent === 'new-template' ? 'Save Template' : 'Send Campaign'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Composer Content */}
      <div className={`transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-gradient-to-b from-[#0a0b14] to-[#0f1019]' 
          : 'bg-gradient-to-b from-gray-50 to-white'
      }`}>
        {/* Subtle pattern overlay for texture */}
        <div 
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: isDarkMode 
              ? 'radial-gradient(circle at 25% 25%, #a855f7 0%, transparent 50%), radial-gradient(circle at 75% 75%, #ec4899 0%, transparent 50%)'
              : 'radial-gradient(circle at 25% 25%, #a855f7 0%, transparent 70%), radial-gradient(circle at 75% 75%, #ec4899 0%, transparent 70%)'
          }}
        />
        
        {/* Enhanced container with better spacing and styling */}
        <div className={`relative min-h-[calc(100vh-8rem)] rounded-t-2xl border-t transition-colors duration-300 ${
          isDarkMode 
            ? 'bg-[#071021]/95 border-slate-800/50 backdrop-blur-sm' 
            : 'bg-white/95 border-gray-200/50 backdrop-blur-sm'
        }`}>
          {/* Gradient border effect */}
          <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${
            isDarkMode
              ? 'from-transparent via-purple-500/50 to-transparent'
              : 'from-transparent via-purple-400/30 to-transparent'
          }`} />
          
          {/* ActualEditor with enhanced styling context */}
          <div className={`p-6 transition-colors duration-300 overflow-hidden ${
            isDarkMode ? 'text-slate-100' : 'text-gray-900'
          }`}>
            <div className="max-w-full overflow-x-auto">
              <AutomationsEditor
                onClose={handleClose}
                onSend={(templateId) => navigate(`/mailbuilder/send/${templateId}`)}
                sendCampaignRef={sendCampaignRef}
                templates={templates}
                tenants={tenant ? [tenant] : []}
                currentUser={{ email: getAuth().currentUser?.email || 'you@example.com', tenantId: tenant?.id }}
                initialTemplate={automationTemplate || template}
                intent={campaignType && emailType ? 'automation-email' : intent}
                campaignContext={campaignType && emailType ? {
                  campaignType,
                  emailType,
                  emailName,
                  campaignName
                } : null}
                theme={isDarkMode ? 'dark' : 'light'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer with consistent branding */}
      <footer className={`border-t py-4 text-center text-sm transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-neutral-950/80 border-white/10 text-slate-400' 
          : 'bg-white/80 border-gray-200 text-gray-600'
      }`}>
        <div className="max-w-7xl mx-auto px-4">
          <p>
            © {new Date().getFullYear()} Fotonix • 
            <span className="ml-1 bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent font-semibold">
              Automation Template Editor
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}
