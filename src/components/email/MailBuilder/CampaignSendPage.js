import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { db } from '../../../firebase';
import { ref as dbRef, get, update } from 'firebase/database';
import { API_URL } from '../../../config/environment';

/**
 * Campaign Send Page
 * 
 * Final stage for sending email campaigns
 * - Load template from Firebase Realtime Database
 * - Configure send settings (from email, recipients, schedule)
 * - Show preview
 * - Send campaign via VPS SMTP
 * - Track sends and responses
 */
export default function CampaignSendPage() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const user = auth.currentUser;

  // Template data
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Business emails for from address - get from navigation state or template
  const [businessEmails, setBusinessEmails] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(true);

  // Recipient audience selection (matching ActualEditor pattern)
  const [selectedAudience, setSelectedAudience] = useState('all'); // all | segment | tag
  const [audienceInfo, setAudienceInfo] = useState('All subscribers');
  const [segments, setSegments] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [selectedTagId, setSelectedTagId] = useState(null);
  
  // Stored recipients from database
  const [storedRecipients, setStoredRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(true);

  // Campaign configuration
  const [config, setConfig] = useState({
    fromEmail: '',
    fromName: '',
    replyTo: '',
    subject: '',
    preheader: '',
    recipients: [],
    recipientList: '', // textarea input
    scheduleType: 'now', // 'now' or 'scheduled'
    scheduledFor: '',
    
    // Tracking
    trackOpens: true,
    trackClicks: true,
    
    // Testing
    testRecipient: '',
  });

  // Send state
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0, failed: 0 });
  const [sendComplete, setSendComplete] = useState(false);

  // Initialize business emails from navigation state immediately
  useEffect(() => {
    console.log('=== CAMPAIGN SEND PAGE INIT ===');
    console.log('location.state:', location.state);
    console.log('location.state?.businessEmails:', location.state?.businessEmails);
    console.log('Is array?', Array.isArray(location.state?.businessEmails));
    
    if (location.state?.businessEmails && Array.isArray(location.state.businessEmails)) {
      console.log('Raw business emails from nav state:', location.state.businessEmails);
      
      // Normalize the field names
      const normalized = location.state.businessEmails.map(email => ({
        email_address: email.email || email.email_address,
        email_type: email.type || email.email_type,
        display_name: email.displayName || email.display_name,
        id: email.id,
        description: email.description
      }));
      
      console.log('Setting normalized business emails to state:', normalized);
      setBusinessEmails(normalized);
      setLoadingEmails(false);
      
      // Auto-select first noreply email
      const noreplyEmail = normalized.find(e => e.email_type === 'noreply');
      if (noreplyEmail) {
        console.log('Auto-selecting noreply email:', noreplyEmail);
        setConfig(prev => ({
          ...prev,
          fromEmail: noreplyEmail.email_address,
          fromName: noreplyEmail.display_name,
          replyTo: normalized.find(e => e.email_type === 'support')?.email_address || ''
        }));
      }
    } else {
      console.log('NO BUSINESS EMAILS IN NAVIGATION STATE!');
      setLoadingEmails(false);
    }
  }, []);

  // Load segments and tags from localStorage (matching ActualEditor)
  useEffect(() => {
    if (!user) return;
    const segmentsKey = `mailbuilder.segments:${user.uid}`;
    const tagsKey = `mailbuilder.tags:${user.uid}`;
    
    try {
      const segmentsRaw = localStorage.getItem(segmentsKey);
      if (segmentsRaw) setSegments(JSON.parse(segmentsRaw) || []);
      
      const tagsRaw = localStorage.getItem(tagsKey);
      if (tagsRaw) setTags(JSON.parse(tagsRaw) || []);
    } catch (e) {
      console.error('Failed to load segments/tags:', e);
    }
  }, [user]);

  // Load stored recipients from database
  useEffect(() => {
    if (!user) return;
    
    const loadRecipients = async () => {
      try {
        // Try to fetch from contacts/subscribers endpoint
        const response = await fetch(`${API_URL}/api/contacts`, {
          headers: {
            'x-member-uid': user.uid
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const emails = data.contacts || data.subscribers || [];
          setStoredRecipients(emails);
          
          // Update audience info with actual count
          if (selectedAudience === 'all') {
            setAudienceInfo(`${emails.length} subscribers`);
          }
        } else {
          // If contacts endpoint fails, provide demo contacts data
          console.log('Contacts endpoint failed, using demo contacts');
          const demoContacts = [
            { email: 'demo@fotonix.co.uk' },
            { email: 'subscriber@example.com' },
            { email: 'customer@company.com' },
            { email: 'user@test.org' }
          ];
          setStoredRecipients(demoContacts);
          if (selectedAudience === 'all') {
            setAudienceInfo(`${demoContacts.length} subscribers`);
          }
        }
        setLoadingRecipients(false);
      } catch (err) {
        console.error('Failed to load recipients:', err);
        // Fallback to demo data
        const demoContacts = [
          { email: 'demo@fotonix.co.uk' },
          { email: 'subscriber@example.com' },
          { email: 'customer@company.com' },
          { email: 'user@test.org' }
        ];
        setStoredRecipients(demoContacts);
        if (selectedAudience === 'all') {
          setAudienceInfo(`${demoContacts.length} subscribers`);
        }
        setLoadingRecipients(false);
      }
    };
    
    loadRecipients();
  }, [user, selectedAudience]);
  
  // Auto-populate recipients when stored recipients are loaded
  useEffect(() => {
    if (storedRecipients.length > 0 && !config.recipientList?.trim()) {
      const emailList = storedRecipients.map(r => r.email).join('\n');
      setConfig(prev => ({
        ...prev,
        recipientList: emailList
      }));
      console.log('Auto-populated recipients from stored contacts:', emailList);
    }
  }, [storedRecipients, config.recipientList]);
  
  // Debug send button state
  useEffect(() => {
    const canSend = !sending && config.fromEmail && config.subject && config.recipientList?.trim() && parseRecipients(config.recipientList).length > 0;
    console.log('Send button state:', {
      sending,
      fromEmail: config.fromEmail,
      subject: config.subject,
      recipientList: config.recipientList?.trim(),
      parsedRecipients: parseRecipients(config.recipientList).length,
      canSend
    });
  }, [sending, config.fromEmail, config.subject, config.recipientList]);
  const [sendResults, setSendResults] = useState(null);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);

  // Load template from Firebase
  useEffect(() => {
    if (!user || !templateId) {
      setError('Invalid template or user not logged in');
      setLoading(false);
      return;
    }

    const loadTemplate = async () => {
      try {
        const templateRef = dbRef(db, `templates/${user.uid}/${templateId}`);
        const snapshot = await get(templateRef);
        
        if (!snapshot.exists()) {
          throw new Error('Template not found');
        }

        const data = snapshot.val();
        setTemplate(data);
        
        // Initialize config with stored campaign data (subject and preheader from composer)
        if (data.campaign) {
          console.log('=== CAMPAIGN SEND PAGE LOAD ===');
          console.log('Template data:', data);
          console.log('Campaign data found:', data.campaign);
          console.log('Campaign subject:', data.campaign.subject);
          console.log('Campaign preheader:', data.campaign.preheader);
          
          // Try to get subject from campaign data, fallback to localStorage
          let finalSubject = data.campaign.subject || '';
          let finalPreheader = data.campaign.preheader || '';
          
          // Fallback to localStorage if no subject in campaign data
          if (!finalSubject) {
            try {
              const savedData = localStorage.getItem('fotonix.composer.state');
              if (savedData) {
                const parsed = JSON.parse(savedData);
                finalSubject = parsed.subject || '';
                if (!finalPreheader) finalPreheader = parsed.previewText || '';
                console.log('Fallback to localStorage:', { subject: finalSubject, previewText: finalPreheader });
              }
            } catch (e) {
              console.warn('Failed to parse localStorage composer data:', e);
            }
          }
          
          setConfig(prev => ({
            ...prev,
            subject: finalSubject,
            preheader: finalPreheader
          }));
          
          // Set audience info from campaign data
          if (data.campaign.selectedAudience) {
            setSelectedAudience(data.campaign.selectedAudience);
            setAudienceInfo(data.campaign.audienceInfo || 'All subscribers');
          }
          
          console.log('Updated config with campaign data:', {
            subject: finalSubject,
            preheader: finalPreheader,
            audience: data.campaign.selectedAudience,
            audienceInfo: data.campaign.audienceInfo
          });
        } else {
          console.log('=== NO CAMPAIGN DATA FOUND - TRYING LOCALSTORAGE ===');
          console.log('Template data keys:', Object.keys(data));
          
          // If no campaign data, try localStorage as fallback
          try {
            const savedData = localStorage.getItem('fotonix.composer.state');
            if (savedData) {
              const parsed = JSON.parse(savedData);
              setConfig(prev => ({
                ...prev,
                subject: parsed.subject || '',
                preheader: parsed.previewText || ''
              }));
              console.log('Loaded from localStorage:', { subject: parsed.subject, previewText: parsed.previewText });
            }
          } catch (e) {
            console.warn('Failed to parse localStorage composer data:', e);
          }
        }
        
        // Auto-populate recipients from stored contacts if available
        if (storedRecipients.length > 0) {
          const emailList = storedRecipients.map(r => r.email).join('\n');
          setConfig(prev => ({
            ...prev,
            recipientList: emailList
          }));
          console.log('Auto-populated recipients from template load:', emailList);
        }
        
        // Use business emails from template if not already loaded
        if (data.businessEmails && data.businessEmails.length > 0 && businessEmails.length === 0) {
          setBusinessEmails(data.businessEmails);
          setLoadingEmails(false);
          
          // Auto-select apolo.nazi@fotonix.co.uk if available, otherwise first noreply email
          const apoloEmail = data.businessEmails.find(e => e.email_address === 'apolo.nazi@fotonix.co.uk');
          const noreplyEmail = data.businessEmails.find(e => e.email_type === 'noreply');
          const selectedEmail = apoloEmail || noreplyEmail;
          
          if (selectedEmail && !config.fromEmail) {
            setConfig(prev => ({
              ...prev,
              fromEmail: selectedEmail.email_address,
              fromName: selectedEmail.email_address === 'apolo.nazi@fotonix.co.uk' ? 'the' : (selectedEmail.display_name || 'Fotonix'),
              replyTo: data.businessEmails.find(e => e.email_type === 'support')?.email_address || selectedEmail.email_address
            }));
            console.log('Auto-selected from email:', {
              email: selectedEmail.email_address,
              fromName: selectedEmail.email_address === 'apolo.nazi@fotonix.co.uk' ? 'the' : selectedEmail.display_name
            });
          }
        }
        
        // Pre-fill config from template (only if not already set from campaign data)
        setConfig(prev => ({
          ...prev,
          subject: prev.subject || data.campaign?.subject || data.subject || data.title || '',
          fromEmail: data.campaign?.fromEmail || prev.fromEmail,
          fromName: data.campaign?.fromName || prev.fromName,
          replyTo: data.campaign?.replyTo || prev.replyTo,
        }));
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading template:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadTemplate();
  }, [user, templateId]);

  // Load business emails from API only if not already available
  useEffect(() => {
    if (!user || businessEmails.length > 0) {
      setLoadingEmails(false);
      return;
    }

    const loadBusinessEmails = async () => {
      try {
        const response = await fetch(`${API_URL}/api/member/business-emails/${user.uid}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to load business emails');
        }

        const data = await response.json();
        console.log('Business emails API response:', data);
        
        // API returns flat array of individual email objects
        let emails = [];
        if (Array.isArray(data)) {
          emails = data.map(emailObj => ({
            email_address: emailObj.email,
            email_type: emailObj.type,
            display_name: emailObj.displayName,
            description: emailObj.description,
            id: emailObj.id
          }));
        }
        
        console.log('Parsed business emails:', emails);
        setBusinessEmails(emails);

        // Auto-select first noreply email
        const noreplyEmail = emails.find(e => e.email_type === 'noreply');
        if (noreplyEmail && !config.fromEmail) {
          setConfig(prev => ({
            ...prev,
            fromEmail: noreplyEmail.email_address || noreplyEmail.email,
            fromName: noreplyEmail.display_name || 'Fotonix',
            replyTo: emails.find(e => e.email_type === 'support')?.email_address || emails.find(e => e.email_type === 'support')?.email || noreplyEmail.email_address || noreplyEmail.email
          }));
        }        setLoadingEmails(false);
      } catch (err) {
        console.error('Error loading business emails:', err);
        setLoadingEmails(false);
      }
    };

    loadBusinessEmails();
  }, [user]);

  // Parse recipients from textarea
  const parseRecipients = (text) => {
    if (!text) return [];
    
    // Split by newlines and commas, filter empty
    const emails = text
      .split(/[\n,]/)
      .map(e => e.trim())
      .filter(e => e && e.includes('@'));
    
    // Validate emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emails.filter(e => emailRegex.test(e));
  };

  // Send test email
  const sendTestEmail = async () => {
    if (!config.testRecipient) {
      alert('Please enter a test recipient email');
      return;
    }

    try {
      setSending(true);
      
      const response = await fetch(`${API_URL}/api/email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': '1',
        },
        credentials: 'include',
        body: JSON.stringify({
          to: config.testRecipient,
          from: config.fromEmail,
          subject: `[TEST] ${config.subject}`,
          html: template.html,
          text: template.html.replace(/<[^>]*>/g, ''), // Strip HTML
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send test email');
      }

      const result = await response.json();
      alert(`Test email sent successfully to ${config.testRecipient}!\nMessage ID: ${result.messageId}`);
      
    } catch (err) {
      console.error('Error sending test:', err);
      alert(`Failed to send test email: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  // Send campaign
  const sendCampaign = async () => {
    // Validation
    if (!config.fromEmail) {
      alert('Please select a from email address');
      return;
    }

    if (!config.subject) {
      alert('Please enter an email subject');
      return;
    }

    const recipients = parseRecipients(config.recipientList);
    if (recipients.length === 0) {
      alert('Please enter at least one recipient email address');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to send this campaign to ${recipients.length} recipient(s)?`
    );

    if (!confirmed) return;

    try {
      console.log('=== SENDING CAMPAIGN ===');
      console.log('Config:', config);
      console.log('Recipients:', recipients);
      console.log('Template ID:', templateId);

      setSending(true);
      setSendProgress({ sent: 0, total: recipients.length, failed: 0 });

      // Update template with campaign config (preserve existing campaign data)
      const templateRef = dbRef(db, `templates/${user.uid}/${templateId}`);
      
      // Get current template data to preserve existing campaign properties
      const currentSnapshot = await get(templateRef);
      const currentData = currentSnapshot.val() || {};
      const existingCampaign = currentData.campaign || {};
      
      await update(templateRef, {
        campaign: {
          ...existingCampaign,
          fromEmail: config.fromEmail,
          fromName: config.fromName,
          replyTo: config.replyTo,
          subject: config.subject,
          sentAt: new Date().toISOString(),
          recipientCount: recipients.length
        },
        status: 'sending',
      });

      // Send via bulk email API
      const response = await fetch(`${API_URL}/api/email/send-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': '1',
        },
        credentials: 'include',
        body: JSON.stringify({
          recipients: recipients,
          subject: config.subject,
          html: template.html,
          text: template.html.replace(/<[^>]*>/g, ''),
          campaignId: templateId,
          fromEmail: config.fromEmail,
          fromName: config.fromName,
          replyTo: config.replyTo,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send campaign');
      }

      const results = await response.json();
      
      // Update progress
      const sent = results.results?.filter(r => r.status === 'sent').length || 0;
      const failed = results.results?.filter(r => r.status === 'failed').length || 0;
      
      setSendProgress({ sent, total: recipients.length, failed });
      setSendResults(results);
      setSendComplete(true);

      // Update template status
      const finalSnapshot = await get(templateRef);
      const finalData = finalSnapshot.val() || {};
      const finalCampaign = finalData.campaign || {};
      
      await update(templateRef, {
        status: 'sent',
        campaign: {
          ...finalCampaign,
          sentCount: sent,
          failedCount: failed,
        }
      });

      alert(`Campaign sent successfully!\n\nSent: ${sent}\nFailed: ${failed}`);

    } catch (err) {
      console.error('Error sending campaign:', err);
      alert(`Failed to send campaign: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-red-800 font-semibold text-xl mb-2">Error Loading Campaign</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => navigate('/mailbuilder')}
            className="mt-4 btn btn-secondary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/mailbuilder')}
                className="text-slate-600 hover:text-slate-900"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {config.subject || template?.title || 'Untitled Campaign'}
                </h1>
                <p className="text-sm text-slate-500">Send Campaign - Stage 4</p>
              </div>
            </div>

            {/* Progress Indicator */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 opacity-40">
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-semibold text-sm">1</div>
                <span className="text-slate-600 text-sm">Setup</span>
              </div>
              <div className="w-12 h-px bg-slate-300 mx-1"></div>
              <div className="flex items-center gap-2 opacity-40">
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-semibold text-sm">2</div>
                <span className="text-slate-600 text-sm">Design</span>
              </div>
              <div className="w-12 h-px bg-slate-300 mx-1"></div>
              <div className="flex items-center gap-2 opacity-40">
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-semibold text-sm">3</div>
                <span className="text-slate-600 text-sm">Content</span>
              </div>
              <div className="w-12 h-px bg-slate-300 mx-1"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold text-sm">4</div>
                <span className="font-medium text-slate-900 text-sm">Send</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* From Settings */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">From Settings</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    From Email <span className="text-red-500">*</span>
                  </label>
                  {loadingEmails ? (
                    <p className="text-sm text-slate-500">Loading business emails...</p>
                  ) : businessEmails.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-800">
                        No business emails found ({businessEmails.length} emails). 
                        Debug: loadingEmails={String(loadingEmails)}, 
                        hasNavState={String(!!location.state?.businessEmails)},
                        hasTemplateEmails={String(!!template?.businessEmails)}
                      </p>
                      <button 
                        onClick={() => {
                          console.log('DEBUG businessEmails:', businessEmails);
                          console.log('DEBUG template:', template);
                          console.log('DEBUG location.state:', location.state);
                        }}
                        className="mt-2 text-xs underline"
                      >
                        Show console debug
                      </button>
                    </div>
                  ) : (
                    <select
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={config.fromEmail}
                      onChange={(e) => {
                        const emailAddress = e.target.value;
                        const selected = businessEmails.find(be => 
                          (be.email_address || be.email) === emailAddress
                        );
                        setConfig(prev => ({
                          ...prev,
                          fromEmail: emailAddress,
                          fromName: selected?.display_name || prev.fromName,
                        }));
                      }}
                    >
                      <option value="">Select from email...</option>
                      {businessEmails.map((email, idx) => {
                        const emailAddr = email.email_address || email.email;
                        const emailType = email.email_type || email.type;
                        return (
                          <option key={idx} value={emailAddr}>
                            {email.display_name} &lt;{emailAddr}&gt; ({emailType})
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    From Name
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    value={config.fromName}
                    onChange={(e) => setConfig(prev => ({ ...prev, fromName: e.target.value }))}
                    placeholder="Your Business Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Reply To Email
                  </label>
                  {businessEmails.length > 0 ? (
                    <select
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={config.replyTo}
                      onChange={(e) => setConfig(prev => ({ ...prev, replyTo: e.target.value }))}
                    >
                      <option value="">Use from email as reply-to</option>
                      {businessEmails
                        .filter(email => (email.email_type || email.type) !== 'noreply')
                        .map((email, idx) => {
                          const emailAddr = email.email_address || email.email;
                          const emailType = email.email_type || email.type;
                          return (
                            <option key={idx} value={emailAddr}>
                              {email.display_name} &lt;{emailAddr}&gt; ({emailType})
                            </option>
                          );
                        })}
                    </select>
                  ) : (
                    <input
                      type="email"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={config.replyTo}
                      onChange={(e) => setConfig(prev => ({ ...prev, replyTo: e.target.value }))}
                      placeholder="support@yourdomain.com"
                    />
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    Where replies will be sent (defaults to from email if empty)
                  </p>
                </div>
              </div>
            </div>

            {/* Email Content */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Email Content</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Subject Line <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    value={config.subject}
                    onChange={(e) => setConfig(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Your amazing subject line"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Preheader Text <span className="text-slate-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    value={config.preheader}
                    onChange={(e) => setConfig(prev => ({ ...prev, preheader: e.target.value }))}
                    placeholder="Preview text that appears after subject"
                    maxLength={150}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {config.preheader.length}/150 characters
                  </p>
                </div>
              </div>
            </div>

            {/* Recipients */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Recipients</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email Addresses <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                    rows={8}
                    value={config.recipientList}
                    onChange={(e) => setConfig(prev => ({ ...prev, recipientList: e.target.value }))}
                    placeholder="Enter email addresses (one per line or comma-separated)&#10;example@email.com&#10;another@email.com"
                  />
                  <p className="text-sm text-slate-600 mt-2">
                    <span className="font-semibold">
                      {parseRecipients(config.recipientList).length}
                    </span> valid recipient(s)
                  </p>
                </div>

                {parseRecipients(config.recipientList).length > 0 && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-600 mb-2">Preview:</p>
                    <div className="flex flex-wrap gap-2">
                      {parseRecipients(config.recipientList).slice(0, 10).map((email, i) => (
                        <span key={i} className="inline-block bg-white border border-slate-200 rounded px-2 py-1 text-xs">
                          {email}
                        </span>
                      ))}
                      {parseRecipients(config.recipientList).length > 10 && (
                        <span className="inline-block bg-slate-200 rounded px-2 py-1 text-xs">
                          +{parseRecipients(config.recipientList).length - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tracking Options */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Tracking & Analytics</h2>
              
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={config.trackOpens}
                    onChange={(e) => setConfig(prev => ({ ...prev, trackOpens: e.target.checked }))}
                  />
                  <div>
                    <p className="font-medium text-slate-900">Track Email Opens</p>
                    <p className="text-sm text-slate-500">Know when recipients open your email</p>
                  </div>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={config.trackClicks}
                    onChange={(e) => setConfig(prev => ({ ...prev, trackClicks: e.target.checked }))}
                  />
                  <div>
                    <p className="font-medium text-slate-900">Track Link Clicks</p>
                    <p className="text-sm text-slate-500">See which links recipients click</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Schedule */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Schedule</h2>
              
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="schedule"
                    checked={config.scheduleType === 'now'}
                    onChange={() => setConfig(prev => ({ ...prev, scheduleType: 'now' }))}
                  />
                  <div>
                    <p className="font-medium text-slate-900">Send Now</p>
                    <p className="text-sm text-slate-500">Send immediately after clicking send</p>
                  </div>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="schedule"
                    checked={config.scheduleType === 'scheduled'}
                    onChange={() => setConfig(prev => ({ ...prev, scheduleType: 'scheduled' }))}
                  />
                  <div>
                    <p className="font-medium text-slate-900">Schedule for Later</p>
                  </div>
                </label>

                {config.scheduleType === 'scheduled' && (
                  <div className="ml-8 mt-2">
                    <input
                      type="datetime-local"
                      className="rounded-lg border border-slate-300 px-3 py-2"
                      value={config.scheduledFor}
                      onChange={(e) => setConfig(prev => ({ ...prev, scheduledFor: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Send Test */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-3">Send Test Email</h3>
              <p className="text-sm text-slate-600 mb-4">
                Send a test to yourself before sending to all recipients
              </p>
              
              <div className="space-y-3">
                <input
                  type="email"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="your@email.com"
                  value={config.testRecipient}
                  onChange={(e) => setConfig(prev => ({ ...prev, testRecipient: e.target.value }))}
                />
                
                <button
                  onClick={sendTestEmail}
                  disabled={sending || !config.testRecipient || !config.fromEmail}
                  className="w-full btn btn-secondary"
                >
                  {sending ? 'Sending...' : 'Send Test'}
                </button>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-3">Preview</h3>
              <button
                onClick={() => setShowPreview(true)}
                className="w-full btn btn-secondary"
              >
                Preview Email
              </button>
            </div>

            {/* Campaign Stats */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-3">Campaign Summary</h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Recipients:</span>
                  <span className="font-semibold">
                    {loadingRecipients ? '...' :
                     selectedAudience === 'all' ? storedRecipients.length :
                     selectedAudience === 'segment' && selectedSegmentId ? 
                       segments.find(s => s.id === selectedSegmentId)?.count || 0 :
                     selectedAudience === 'tag' && selectedTagId ?
                       tags.find(t => t.id === selectedTagId)?.count || 0 :
                     selectedAudience === 'custom' ?
                       parseRecipients(config.recipientList).length : 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">From:</span>
                  <span className="font-semibold text-xs">{config.fromEmail || 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">From Name:</span>
                  <span className="font-semibold text-xs">{config.fromName || 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Tracking:</span>
                  <span className="font-semibold">
                    {config.trackOpens && config.trackClicks ? 'Full' : 
                     config.trackOpens ? 'Opens' : 
                     config.trackClicks ? 'Clicks' : 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* Send Button */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border-2 border-indigo-200 p-6">
              <button
                onClick={sendCampaign}
                disabled={sending || !config.fromEmail || !config.subject || !config.recipientList?.trim() || parseRecipients(config.recipientList).length === 0}
                className="w-full btn btn-primary text-lg py-3"
              >
                {sending ? 'Sending Campaign...' : '🚀 Send Campaign Now'}
              </button>
              
              {sending && (
                <div className="mt-4">
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-sm font-medium text-slate-900 mb-2">
                      Sending Progress
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-600 font-semibold">{sendProgress.sent}</span>
                      <span className="text-slate-400">/</span>
                      <span className="text-slate-600">{sendProgress.total}</span>
                      {sendProgress.failed > 0 && (
                        <>
                          <span className="text-slate-400">•</span>
                          <span className="text-red-600">{sendProgress.failed} failed</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {sendComplete && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-green-800">
                    ✅ Campaign Sent Successfully!
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {sendProgress.sent} of {sendProgress.total} emails sent
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowPreview(false)}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-semibold text-lg">Email Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">From:</span> {config.fromName} &lt;{config.fromEmail}&gt;</p>
                <p><span className="font-medium">Subject:</span> {config.subject}</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              <iframe
                srcDoc={template?.html}
                className="w-full h-full min-h-[600px] border border-slate-200 rounded"
                title="Email Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
