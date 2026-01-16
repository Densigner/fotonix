import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  FileText, 
  X, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Loader2
} from 'lucide-react';

const AffiliateCreator = ({ onClose, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    paypalEmail: '',
    paypalMe: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: '', message: '' });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      // Basic info validation
      if (!formData.displayName.trim()) {
        newErrors.displayName = 'Display name is required';
      }
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    if (step === 2) {
      // PayPal validation (at least one method required)
      if (!formData.paypalEmail.trim() && !formData.paypalMe.trim()) {
        newErrors.paypal = 'Please provide either PayPal email or PayPal.me username';
      }
      if (formData.paypalEmail && !/\S+@\S+\.\S+/.test(formData.paypalEmail)) {
        newErrors.paypalEmail = 'Please enter a valid PayPal email address';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  // Generate affiliate code based on name and email
  const generateAffiliateCode = (name, email) => {
    if (!name || !email) return '';
    
    const namePart = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 8);
    const emailPart = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').slice(-3);
    const randomSuffix = Math.floor(Math.random() * 100);
    
    return `${namePart}${emailPart}${randomSuffix}`.slice(0, 12);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep(currentStep)) {
      return;
    }

    setSaving(true);
    setNotice({ type: '', message: '' });

    try {
      // Generate unique affiliate code
      const affiliateCode = generateAffiliateCode(formData.displayName, formData.email);

      // Clean PayPal.me username
      const cleanPaypalMe = formData.paypalMe 
        ? formData.paypalMe.replace(/^https?:\/\/(www\.)?paypal\.me\//i, '')
        : '';

      const affiliateData = {
        affiliateCode,
        displayName: formData.displayName.trim(),
        email: formData.email.trim().toLowerCase(),
        paypalEmail: formData.paypalEmail.trim().toLowerCase() || null,
        paypalMe: cleanPaypalMe || null,
        defaultCommissionRate: 0, // No default rate, set per product
        notes: formData.notes.trim(),
        status: 'active'
      };

      // Call API to create affiliate
      const response = await fetch('/api/member/affiliates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-member-uid': 'current-member-id'
        },
        body: JSON.stringify(affiliateData)
      });

      if (response.ok) {
        const result = await response.json();
        setNotice({
          type: 'success',
          message: `Affiliate "${affiliateData.displayName}" created successfully with code: ${affiliateCode}`
        });

        // Reset form
        setTimeout(() => {
          setFormData({
            displayName: '',
            email: '',
            paypalEmail: '',
            paypalMe: '',
            notes: ''
          });
          setCurrentStep(1);
          onSuccess?.(result);
        }, 1500);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create affiliate');
      }
    } catch (error) {
      console.error('Failed to create affiliate:', error);
      setNotice({
        type: 'error',
        message: error.message || 'Failed to create affiliate. Please try again.'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <User className="h-8 w-8 text-pink-500" />
            <h2 className="text-2xl font-bold text-gray-900">Add New Affiliate</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className={`flex items-center ${currentStep >= 1 ? 'text-pink-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= 1 ? 'bg-pink-100' : 'bg-gray-100'
              }`}>
                1
              </div>
              <span className="ml-2 text-sm font-medium">Basic Info</span>
            </div>
            <div className={`h-1 flex-1 mx-4 ${currentStep >= 2 ? 'bg-pink-200' : 'bg-gray-200'} rounded`} />
            <div className={`flex items-center ${currentStep >= 2 ? 'text-pink-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= 2 ? 'bg-pink-100' : 'bg-gray-100'
              }`}>
                2
              </div>
              <span className="ml-2 text-sm font-medium">PayPal</span>
            </div>
            <div className={`h-1 flex-1 mx-4 ${currentStep >= 3 ? 'bg-pink-200' : 'bg-gray-200'} rounded`} />
            <div className={`flex items-center ${currentStep >= 3 ? 'text-pink-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= 3 ? 'bg-pink-100' : 'bg-gray-100'
              }`}>
                3
              </div>
              <span className="ml-2 text-sm font-medium">Notes</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-pink-500" />
                <h3 className="text-lg font-semibold">Basic Information</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Affiliate Display Name
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  placeholder="e.g., Sarah Johnson"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
                    errors.displayName ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.displayName && (
                  <p className="text-red-600 text-sm mt-1">{errors.displayName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="sarah@example.com"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.email && (
                  <p className="text-red-600 text-sm mt-1">{errors.email}</p>
                )}
              </div>

              {formData.displayName && formData.email && (
                <div className="bg-pink-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Generated Affiliate Code:</h4>
                  <div className="text-lg font-mono font-bold text-pink-600">
                    {generateAffiliateCode(formData.displayName, formData.email)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: PayPal Information */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <ExternalLink className="w-5 h-5 text-pink-500" />
                <h3 className="text-lg font-semibold">PayPal Payment Details</h3>
              </div>

              {errors.paypal && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-600 text-sm">{errors.paypal}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PayPal Email Address
                </label>
                <input
                  type="email"
                  value={formData.paypalEmail}
                  onChange={(e) => handleInputChange('paypalEmail', e.target.value)}
                  placeholder="sarah@paypal.com"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
                    errors.paypalEmail ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.paypalEmail && (
                  <p className="text-red-600 text-sm mt-1">{errors.paypalEmail}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  The email address associated with their PayPal account
                </p>
              </div>

              <div className="text-center text-gray-500 text-sm font-medium">OR</div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PayPal.me Username
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 text-sm text-gray-500 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg">
                    paypal.me/
                  </span>
                  <input
                    type="text"
                    value={formData.paypalMe}
                    onChange={(e) => handleInputChange('paypalMe', e.target.value)}
                    placeholder="sarahjohnson"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Their PayPal.me username (without the full URL)
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Notes */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-pink-500" />
                <h3 className="text-lg font-semibold">Affiliate Profile</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  About This Affiliate
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="e.g., Phlebotomy YouTuber, 50k subs, focuses on home improvements and plant care. Met at trade show 2024."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Describe what they do, their niche, audience size, how you found them, etc.
                </p>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Preview:</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div><span className="font-medium">Name:</span> {formData.displayName}</div>
                  <div><span className="font-medium">Code:</span> {generateAffiliateCode(formData.displayName, formData.email)}</div>
                  <div><span className="font-medium">Email:</span> {formData.email}</div>
                  {formData.paypalEmail && (
                    <div><span className="font-medium">PayPal Email:</span> {formData.paypalEmail}</div>
                  )}
                  {formData.paypalMe && (
                    <div><span className="font-medium">PayPal.me:</span> paypal.me/{formData.paypalMe.replace(/^https?:\/\/(www\.)?paypal\.me\//i, '')}</div>
                  )}
                  <div><span className="font-medium">Commission:</span> Set per product</div>
                </div>
              </div>
            </div>
          )}

          {/* Notice */}
          {notice.message && (
            <div className={`p-4 rounded-lg ${
              notice.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center space-x-2">
                {notice.type === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                <p className={`text-sm ${notice.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                  {notice.message}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between pt-6">
            <div>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              
              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-lg hover:from-pink-600 hover:to-violet-600 transition-all"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-lg hover:from-pink-600 hover:to-violet-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{saving ? 'Creating...' : 'Create Affiliate'}</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AffiliateCreator;