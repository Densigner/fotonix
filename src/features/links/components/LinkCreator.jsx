import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Link as LinkIcon, 
  CheckCircle2, 
  X, 
  Package,
  User,
  Percent,
  Hash,
  Loader2
} from 'lucide-react';
import linkService, { linkUtils } from '../services/linkService';

const LinkCreator = ({ 
  userType = 'member', 
  onLinkCreated,
  onClose,
  className = '',
  ...props 
}) => {
  // Form state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);
  const [customCommission, setCustomCommission] = useState('');
  const [linkSlug, setLinkSlug] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  
  // Search state
  const [productQuery, setProductQuery] = useState('');
  const [affiliateQuery, setAffiliateQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [affiliateResults, setAffiliateResults] = useState([]);
  
  // UI state
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: '', message: '' });
  const [slugValidating, setSlugValidating] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(null);

  // Auto-generate slug when product and affiliate are selected
  useEffect(() => {
    if (selectedProduct && selectedAffiliate && !linkSlug) {
      const generated = linkUtils.generateSlug(
        `${selectedProduct.title} ${selectedAffiliate.displayName || selectedAffiliate.affiliateCode}`,
        'link'
      );
      setLinkSlug(generated);
    }
  }, [selectedProduct, selectedAffiliate, linkSlug]);

  // Auto-generate title when product is selected
  useEffect(() => {
    if (selectedProduct && !linkTitle) {
      setLinkTitle(`${selectedProduct.title} - Affiliate Link`);
    }
  }, [selectedProduct, linkTitle]);

  // Validate slug availability
  useEffect(() => {
    if (!linkSlug || linkSlug.length < 3) {
      setSlugAvailable(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSlugValidating(true);
      try {
        const available = await linkService.validateSlug(linkSlug);
        setSlugAvailable(available);
      } catch (error) {
        console.log('Slug validation not available');
        setSlugAvailable(true); // Assume available if validation fails
      } finally {
        setSlugValidating(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [linkSlug]);

  // Search for products
  useEffect(() => {
    if (!productQuery.trim()) {
      setProductResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await linkService.searchProducts(productQuery, userType);
        setProductResults(results);
      } catch (error) {
        console.error('Product search failed:', error);
        setProductResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [productQuery, userType]);

  // Search for affiliates (only for members - search their personal network)
  useEffect(() => {
    if (userType !== 'member' || !affiliateQuery.trim()) {
      setAffiliateResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        // Search member's personal affiliates instead of global database
        const response = await fetch(`/api/member/affiliates/search?q=${encodeURIComponent(affiliateQuery)}`, {
          headers: {
            'x-member-uid': 'current-member-id'
          }
        });
        if (response.ok) {
          const results = await response.json();
          setAffiliateResults(results);
        } else {
          setAffiliateResults([]);
        }
      } catch (error) {
        console.error('Affiliate search failed:', error);
        setAffiliateResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [affiliateQuery, userType]);

  // Calculate effective commission rate
  const effectiveCommission = useMemo(() => {
    if (customCommission && !isNaN(Number(customCommission))) {
      return Number(customCommission);
    }
    if (selectedProduct && selectedProduct.commissionRate) {
      return selectedProduct.commissionRate * 100;
    }
    return 0;
  }, [customCommission, selectedProduct]);

  // Form validation
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1:
        return selectedProduct !== null;
      case 2:
        // For members: require affiliate AND commission rate
        if (userType === 'member') {
          return selectedAffiliate !== null && effectiveCommission > 0;
        }
        return true;
      case 3:
        return linkSlug && linkTitle && slugAvailable !== false;
      default:
        return false;
    }
  }, [currentStep, selectedProduct, selectedAffiliate, linkSlug, linkTitle, slugAvailable, userType, effectiveCommission]);

  const handleCreateLink = async () => {
    // Validate form
    const linkData = {
      productId: selectedProduct.id,
      affiliateId: userType === 'member' ? selectedAffiliate?.id : null,
      slug: linkSlug,
      title: linkTitle,
      commissionRate: effectiveCommission / 100
    };

    const validation = linkUtils.validateLinkData(linkData);
    if (!validation.isValid) {
      setNotice({
        type: 'error',
        message: validation.errors.join(', ')
      });
      return;
    }

    try {
      setSaving(true);
      const newLink = await linkService.createLink(linkData, userType);
      
      setNotice({
        type: 'success',
        message: 'Link created successfully!'
      });

      if (onLinkCreated) {
        onLinkCreated(newLink);
      }

      // Reset form or close
      setTimeout(() => {
        if (onClose) {
          onClose();
        } else {
          resetForm();
        }
      }, 1500);

    } catch (error) {
      setNotice({
        type: 'error',
        message: error.message || 'Failed to create link'
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedProduct(null);
    setSelectedAffiliate(null);
    setCustomCommission('');
    setLinkSlug('');
    setLinkTitle('');
    setCurrentStep(1);
    setNotice({ type: '', message: '' });
  };

  const nextStep = () => {
    if (canProceed && currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className={`max-w-2xl mx-auto ${className}`} {...props}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-violet-600 bg-clip-text text-transparent">
            Create New Link
          </h2>
          <p className="text-gray-600 mt-1">
            {userType === 'member' 
              ? 'Link a product with an affiliate partner' 
              : 'Create a new affiliate link for promotion'
            }
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Progress Steps */}
      <div className="flex items-center mb-8">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step <= currentStep 
                ? 'bg-gradient-to-r from-pink-500 to-violet-500 text-white' 
                : 'bg-gray-200 text-gray-500'
            }`}>
              {step < currentStep ? <CheckCircle2 className="w-4 h-4" /> : step}
            </div>
            {step < 3 && (
              <div className={`w-16 h-0.5 mx-2 ${
                step < currentStep ? 'bg-gradient-to-r from-pink-500 to-violet-500' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        {/* Step 1: Select Product */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-pink-500" />
              <h3 className="text-lg font-semibold">Select Product</h3>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search for products..."
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            {selectedProduct && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-green-900">{selectedProduct.title}</h4>
                    <p className="text-sm text-green-700">
                      SKU: {selectedProduct.sku} • Price: {linkUtils.formatCurrency(selectedProduct.price)}
                    </p>
                    <p className="text-sm text-green-700">
                      Default commission: {linkUtils.formatCommissionRate(selectedProduct.commissionRate || 0)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="text-green-600 hover:text-green-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {productResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {productResults.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product);
                      setProductQuery('');
                      setProductResults([]);
                    }}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-pink-300 hover:bg-pink-50 transition-colors"
                  >
                    <div className="font-medium">{product.title}</div>
                    <div className="text-sm text-gray-600">
                      SKU: {product.sku} • {linkUtils.formatCurrency(product.price)} • 
                      {linkUtils.formatCommissionRate(product.commissionRate || 0)} commission
                    </div>
                  </button>
                ))}
              </div>
            )}

            {loading && productQuery && (
              <div className="text-center py-4">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-pink-500" />
                <p className="text-sm text-gray-600 mt-2">Searching products...</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Affiliate (Members only) */}
        {currentStep === 2 && userType === 'member' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-pink-500" />
              <h3 className="text-lg font-semibold">Select Affiliate</h3>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search affiliates by name or code..."
                value={affiliateQuery}
                onChange={(e) => setAffiliateQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            {selectedAffiliate && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-green-900">
                      {selectedAffiliate.displayName || selectedAffiliate.affiliateCode}
                    </h4>
                    <p className="text-sm text-green-700">
                      Code: {selectedAffiliate.affiliateCode}
                      {selectedAffiliate.paypalEmail && ` • PayPal: ${selectedAffiliate.paypalEmail}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedAffiliate(null)}
                    className="text-green-600 hover:text-green-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {affiliateResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {affiliateResults.map((affiliate) => (
                  <button
                    key={affiliate.id}
                    onClick={() => {
                      setSelectedAffiliate(affiliate);
                      setAffiliateQuery('');
                      setAffiliateResults([]);
                    }}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-pink-300 hover:bg-pink-50 transition-colors"
                  >
                    <div className="font-medium">
                      {affiliate.displayName || affiliate.affiliateCode}
                    </div>
                    <div className="text-sm text-gray-600">
                      Code: {affiliate.affiliateCode}
                      {affiliate.paypalEmail && ` • ${affiliate.paypalEmail}`}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {loading && affiliateQuery && (
              <div className="text-center py-4">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-pink-500" />
                <p className="text-sm text-gray-600 mt-2">Searching affiliates...</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Skip for non-members */}
        {currentStep === 2 && userType !== 'member' && (
          <div className="text-center py-8">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Affiliate Selection</h3>
            <p className="text-gray-600">
              As an affiliate, links will be automatically associated with your account.
            </p>
          </div>
        )}

        {/* Step 3: Configure Link */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <LinkIcon className="w-5 h-5 text-pink-500" />
              <h3 className="text-lg font-semibold">Configure Link</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link Title
                </label>
                <input
                  type="text"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Enter a descriptive title..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commission Rate (%)
                  {selectedAffiliate && <span className="text-red-500 ml-1">*</span>}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={customCommission}
                    onChange={(e) => setCustomCommission(e.target.value)}
                    placeholder={selectedAffiliate ? "Enter commission rate..." : "Optional"}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent pr-10 ${
                      selectedAffiliate && effectiveCommission === 0 ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                </div>
                {selectedAffiliate && effectiveCommission === 0 && (
                  <p className="text-red-600 text-sm mt-1">
                    Commission rate is required when selecting an affiliate
                  </p>
                )}
                {selectedAffiliate && effectiveCommission > 0 && (
                  <p className="text-green-600 text-sm mt-1">
                    {selectedAffiliate.displayName} will receive {effectiveCommission}% commission
                  </p>
                )}
                {!selectedAffiliate && (
                  <p className="text-gray-500 text-sm mt-1">
                    Select an affiliate above to set commission rate
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Link Slug
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={linkSlug}
                  onChange={(e) => setLinkSlug(linkUtils.generateSlug(e.target.value))}
                  placeholder="enter-custom-slug"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent pr-10"
                />
                <Hash className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Link will be: {window.location.origin}/l/{linkSlug || 'your-slug'}
              </p>
              
              {slugValidating && (
                <p className="text-xs text-blue-600 mt-1">Checking availability...</p>
              )}
              {slugAvailable === false && (
                <p className="text-xs text-red-600 mt-1">This slug is already taken</p>
              )}
              {slugAvailable === true && linkSlug && (
                <p className="text-xs text-green-600 mt-1">Slug is available</p>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Link Summary</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <p><span className="font-medium">Product:</span> {selectedProduct?.title}</p>
                {userType === 'member' && selectedAffiliate && (
                  <p><span className="font-medium">Affiliate:</span> {selectedAffiliate.displayName || selectedAffiliate.affiliateCode}</p>
                )}
                <p><span className="font-medium">Commission:</span> {effectiveCommission.toFixed(1)}%</p>
                <p><span className="font-medium">Link:</span> {window.location.origin}/l/{linkSlug || 'your-slug'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notice */}
      {notice.message && (
        <div className={`p-4 rounded-lg mb-6 ${
          notice.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {notice.message}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>

        <div className="flex items-center gap-3">
          {currentStep < 3 ? (
            <button
              onClick={nextStep}
              disabled={!canProceed}
              className="px-6 py-2 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-lg hover:from-pink-600 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleCreateLink}
              disabled={!canProceed || saving}
              className="px-6 py-2 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-lg hover:from-pink-600 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <LinkIcon className="w-4 h-4" />
                  Create Link
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkCreator;