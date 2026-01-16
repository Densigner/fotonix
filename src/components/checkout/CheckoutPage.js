import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, 
  User, 
  MapPin, 
  CreditCard, 
  CheckCircle2, 
  Lock, 
  Truck, 
  Mail,
  Phone,
  Building2,
  Home,
  Calendar,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Package,
  Percent,
  X,
  Tag,
  Gift
} from 'lucide-react';
import BumperProductWidget from './BumperProductWidget';

/**
 * BRILLIANT FRICTIONLESS CHECKOUT PAGE
 * 
 * Features:
 * - 3-step progress flow: Contact Info → Shipping → Payment
 * - Real-time validation with helpful error messages
 * - Guest checkout + optional account creation
 * - Smart address validation
 * - Order summary with discount codes
 * - Trust badges and security indicators
 * - Mobile-optimized design
 * - Smooth animations and transitions
 * - PayPal integration ready
 * - Save info for future purchases
 */

export default function CheckoutPage({ 
  cartItems: initialCartItems = [],
  onOrderComplete,
  onBack,
  user = null 
}) {
  // Cart management with bumper products
  const [cartItems, setCartItems] = useState(initialCartItems);
  const [addedBumperIds, setAddedBumperIds] = useState([]);

  // Update cart when initial items change
  useEffect(() => {
    setCartItems(initialCartItems);
  }, [initialCartItems]);

  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);

  // Form data
  const [contactInfo, setContactInfo] = useState({
    email: user?.email || '',
    phone: '',
    createAccount: false,
    password: '',
    marketingOptIn: false
  });

  const [shippingInfo, setShippingInfo] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    company: '',
    address1: '',
    address2: '',
    city: '',
    county: '',
    postcode: '',
    country: 'United Kingdom',
    saveAddress: true
  });

  const [billingInfo, setBillingInfo] = useState({
    sameAsShipping: true,
    firstName: '',
    lastName: '',
    address1: '',
    address2: '',
    city: '',
    county: '',
    postcode: '',
    country: 'United Kingdom'
  });

  const [paymentMethod, setPaymentMethod] = useState('paypal'); // 'paypal' | 'card'
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [showDiscountInput, setShowDiscountInput] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(true);

  // Calculate order totals
  const orderTotals = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = appliedDiscount ? (subtotal * appliedDiscount.percentage / 100) : 0;
    const subtotalAfterDiscount = subtotal - discount;
    const shipping = subtotalAfterDiscount > 50 ? 0 : 4.99; // Free shipping over £50
    const tax = subtotalAfterDiscount * 0.20; // 20% VAT
    const total = subtotalAfterDiscount + shipping + tax;

    return {
      subtotal,
      discount,
      subtotalAfterDiscount,
      shipping,
      tax,
      total,
      itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0)
    };
  }, [cartItems, appliedDiscount]);

  // Email validation
  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  // Phone validation (UK format)
  const validatePhone = (phone) => {
    const re = /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$/;
    return re.test(phone.replace(/\s/g, ''));
  };

  // Postcode validation (UK format)
  const validatePostcode = (postcode) => {
    const re = /^[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}$/i;
    return re.test(postcode);
  };

  // Validate current step
  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!contactInfo.email) {
        newErrors.email = 'Email is required';
      } else if (!validateEmail(contactInfo.email)) {
        newErrors.email = 'Please enter a valid email address';
      }

      if (!contactInfo.phone) {
        newErrors.phone = 'Phone number is required';
      } else if (!validatePhone(contactInfo.phone)) {
        newErrors.phone = 'Please enter a valid UK phone number';
      }

      if (contactInfo.createAccount && !contactInfo.password) {
        newErrors.password = 'Password is required to create an account';
      } else if (contactInfo.createAccount && contactInfo.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }
    }

    if (step === 2) {
      if (!shippingInfo.firstName) newErrors.firstName = 'First name is required';
      if (!shippingInfo.lastName) newErrors.lastName = 'Last name is required';
      if (!shippingInfo.address1) newErrors.address1 = 'Address is required';
      if (!shippingInfo.city) newErrors.city = 'City is required';
      if (!shippingInfo.postcode) {
        newErrors.postcode = 'Postcode is required';
      } else if (!validatePostcode(shippingInfo.postcode)) {
        newErrors.postcode = 'Please enter a valid UK postcode';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle field blur
  const handleBlur = (field) => {
    setTouched({ ...touched, [field]: true });
  };

  // Move to next step
  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep]);
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Move to previous step
  const handlePrevStep = () => {
    setCurrentStep(currentStep - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Apply discount code
  const handleApplyDiscount = () => {
    // Mock discount validation - replace with real API call
    const validCodes = {
      'WELCOME10': { percentage: 10, description: 'Welcome discount' },
      'SAVE20': { percentage: 20, description: 'Special offer' },
      'FREESHIP': { percentage: 0, description: 'Free shipping', freeShipping: true }
    };

    const code = discountCode.toUpperCase();
    if (validCodes[code]) {
      setAppliedDiscount({ code, ...validCodes[code] });
      setShowDiscountInput(false);
      setDiscountCode('');
    } else {
      setErrors({ ...errors, discountCode: 'Invalid discount code' });
    }
  };

  // Handle adding bumper product to cart
  const handleAddBumper = (bumperItem) => {
    setCartItems(prev => [...prev, bumperItem]);
    setAddedBumperIds(prev => [...prev, bumperItem.id]);
  };

  // Complete order
  const handleCompleteOrder = async () => {
    if (!validateStep(2)) return;

    setIsProcessing(true);

    // Mock order processing - replace with real API call
    await new Promise(resolve => setTimeout(resolve, 2000));

    const orderData = {
      contactInfo,
      shippingInfo,
      billingInfo: billingInfo.sameAsShipping ? shippingInfo : billingInfo,
      items: cartItems,
      totals: orderTotals,
      discount: appliedDiscount,
      paymentMethod,
      timestamp: new Date().toISOString()
    };

    setIsProcessing(false);
    setCurrentStep(4); // Success step
    
    if (onOrderComplete) {
      onOrderComplete(orderData);
    }
  };

  // Steps configuration
  const steps = [
    { number: 1, title: 'Contact Info', icon: Mail },
    { number: 2, title: 'Shipping', icon: Truck },
    { number: 3, title: 'Payment', icon: CreditCard }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to cart</span>
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Secure Checkout</h1>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Lock className="h-4 w-4" />
                <span>256-bit SSL encrypted</span>
              </div>
            </div>
            
            <button
              onClick={() => setShowOrderSummary(!showOrderSummary)}
              className="lg:hidden flex items-center gap-2 text-purple-600 font-medium"
            >
              <ShoppingBag className="h-5 w-5" />
              <span>£{orderTotals.total.toFixed(2)}</span>
            </button>
          </div>
        </div>

        {/* Progress Steps */}
        {currentStep < 4 && (
          <div className="mb-8">
            <div className="flex items-center justify-between max-w-2xl mx-auto">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === step.number;
                const isCompleted = completedSteps.includes(step.number);

                return (
                  <React.Fragment key={step.number}>
                    <div className="flex flex-col items-center">
                      <motion.div
                        className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                          isCompleted
                            ? 'bg-green-500 border-green-500 text-white'
                            : isActive
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'bg-white border-slate-300 text-slate-400'
                        }`}
                        animate={{
                          scale: isActive ? 1.1 : 1
                        }}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </motion.div>
                      <span className={`mt-2 text-xs font-medium ${
                        isActive ? 'text-purple-600' : 'text-slate-500'
                      }`}>
                        {step.title}
                      </span>
                    </div>
                    
                    {index < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-4 transition-colors ${
                        completedSteps.includes(step.number) ? 'bg-green-500' : 'bg-slate-200'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {/* Step 1: Contact Information */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white rounded-2xl shadow-lg p-6 sm:p-8"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Contact Information</h2>
                      <p className="text-sm text-slate-600">We'll send your order confirmation here</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Email Address *
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                          type="email"
                          value={contactInfo.email}
                          onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                          onBlur={() => handleBlur('email')}
                          placeholder="you@example.com"
                          className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl outline-none transition-all ${
                            touched.email && errors.email
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-slate-200 focus:border-purple-400'
                          }`}
                        />
                      </div>
                      {touched.email && errors.email && (
                        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {errors.email}
                        </p>
                      )}
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Phone Number *
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                          type="tel"
                          value={contactInfo.phone}
                          onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                          onBlur={() => handleBlur('phone')}
                          placeholder="07xxx xxxxxx"
                          className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl outline-none transition-all ${
                            touched.phone && errors.phone
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-slate-200 focus:border-purple-400'
                          }`}
                        />
                      </div>
                      {touched.phone && errors.phone && (
                        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {errors.phone}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-500">For delivery updates and order support</p>
                    </div>

                    {/* Create Account */}
                    {!user && (
                      <div className="space-y-3 pt-4 border-t border-slate-200">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={contactInfo.createAccount}
                            onChange={(e) => setContactInfo({ ...contactInfo, createAccount: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-sm font-medium text-slate-700">Create an account for faster checkout next time</span>
                        </label>

                        {contactInfo.createAccount && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                              <input
                                type="password"
                                value={contactInfo.password}
                                onChange={(e) => setContactInfo({ ...contactInfo, password: e.target.value })}
                                onBlur={() => handleBlur('password')}
                                placeholder="Create a password (min 8 characters)"
                                className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl outline-none transition-all ${
                                  touched.password && errors.password
                                    ? 'border-red-300 focus:border-red-500'
                                    : 'border-slate-200 focus:border-purple-400'
                                }`}
                              />
                            </div>
                            {touched.password && errors.password && (
                              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                <AlertCircle className="h-4 w-4" />
                                {errors.password}
                              </p>
                            )}
                          </motion.div>
                        )}
                      </div>
                    )}

                    {/* Marketing Opt-in */}
                    <div className="pt-4 border-t border-slate-200">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={contactInfo.marketingOptIn}
                          onChange={(e) => setContactInfo({ ...contactInfo, marketingOptIn: e.target.checked })}
                          className="w-4 h-4 mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-slate-700">Keep me updated on offers and promotions</span>
                          <p className="text-xs text-slate-500 mt-1">Get exclusive deals and be first to know about new products</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={handleNextStep}
                    className="w-full mt-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    Continue to Shipping
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </motion.div>
              )}

              {/* Bumper Products - Show after step 1 */}
              {currentStep > 1 && currentStep < 4 && (
                <BumperProductWidget 
                  cartItems={cartItems}
                  onAddBumper={handleAddBumper}
                  addedBumperIds={addedBumperIds}
                  className="mb-6"
                />
              )}

              {/* Step 2: Shipping Information */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white rounded-2xl shadow-lg p-6 sm:p-8"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Shipping Address</h2>
                      <p className="text-sm text-slate-600">Where should we deliver your order?</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Name Fields */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          First Name *
                        </label>
                        <input
                          type="text"
                          value={shippingInfo.firstName}
                          onChange={(e) => setShippingInfo({ ...shippingInfo, firstName: e.target.value })}
                          onBlur={() => handleBlur('firstName')}
                          placeholder="John"
                          className={`w-full px-4 py-3 border-2 rounded-xl outline-none transition-all ${
                            touched.firstName && errors.firstName
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-slate-200 focus:border-purple-400'
                          }`}
                        />
                        {touched.firstName && errors.firstName && (
                          <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          value={shippingInfo.lastName}
                          onChange={(e) => setShippingInfo({ ...shippingInfo, lastName: e.target.value })}
                          onBlur={() => handleBlur('lastName')}
                          placeholder="Doe"
                          className={`w-full px-4 py-3 border-2 rounded-xl outline-none transition-all ${
                            touched.lastName && errors.lastName
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-slate-200 focus:border-purple-400'
                          }`}
                        />
                        {touched.lastName && errors.lastName && (
                          <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                        )}
                      </div>
                    </div>

                    {/* Company (Optional) */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Company <span className="text-slate-400">(Optional)</span>
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                          type="text"
                          value={shippingInfo.company}
                          onChange={(e) => setShippingInfo({ ...shippingInfo, company: e.target.value })}
                          placeholder="Your company name"
                          className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-purple-400 transition-all"
                        />
                      </div>
                    </div>

                    {/* Address Line 1 */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Address Line 1 *
                      </label>
                      <div className="relative">
                        <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                          type="text"
                          value={shippingInfo.address1}
                          onChange={(e) => setShippingInfo({ ...shippingInfo, address1: e.target.value })}
                          onBlur={() => handleBlur('address1')}
                          placeholder="123 Main Street"
                          className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl outline-none transition-all ${
                            touched.address1 && errors.address1
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-slate-200 focus:border-purple-400'
                          }`}
                        />
                      </div>
                      {touched.address1 && errors.address1 && (
                        <p className="mt-1 text-sm text-red-600">{errors.address1}</p>
                      )}
                    </div>

                    {/* Address Line 2 */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Address Line 2 <span className="text-slate-400">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={shippingInfo.address2}
                        onChange={(e) => setShippingInfo({ ...shippingInfo, address2: e.target.value })}
                        placeholder="Apartment, suite, etc."
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-purple-400 transition-all"
                      />
                    </div>

                    {/* City and County */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          City *
                        </label>
                        <input
                          type="text"
                          value={shippingInfo.city}
                          onChange={(e) => setShippingInfo({ ...shippingInfo, city: e.target.value })}
                          onBlur={() => handleBlur('city')}
                          placeholder="London"
                          className={`w-full px-4 py-3 border-2 rounded-xl outline-none transition-all ${
                            touched.city && errors.city
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-slate-200 focus:border-purple-400'
                          }`}
                        />
                        {touched.city && errors.city && (
                          <p className="mt-1 text-sm text-red-600">{errors.city}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          County <span className="text-slate-400">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={shippingInfo.county}
                          onChange={(e) => setShippingInfo({ ...shippingInfo, county: e.target.value })}
                          placeholder="Greater London"
                          className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-purple-400 transition-all"
                        />
                      </div>
                    </div>

                    {/* Postcode */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Postcode *
                      </label>
                      <input
                        type="text"
                        value={shippingInfo.postcode}
                        onChange={(e) => setShippingInfo({ ...shippingInfo, postcode: e.target.value.toUpperCase() })}
                        onBlur={() => handleBlur('postcode')}
                        placeholder="SW1A 1AA"
                        className={`w-full px-4 py-3 border-2 rounded-xl outline-none transition-all ${
                          touched.postcode && errors.postcode
                            ? 'border-red-300 focus:border-red-500'
                            : 'border-slate-200 focus:border-purple-400'
                        }`}
                      />
                      {touched.postcode && errors.postcode && (
                        <p className="mt-1 text-sm text-red-600">{errors.postcode}</p>
                      )}
                    </div>

                    {/* Save Address */}
                    {user && (
                      <div className="pt-4 border-t border-slate-200">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={shippingInfo.saveAddress}
                            onChange={(e) => setShippingInfo({ ...shippingInfo, saveAddress: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-sm font-medium text-slate-700">Save this address for future orders</span>
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 mt-6">
                    <button
                      onClick={handlePrevStep}
                      className="flex-1 py-4 border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="h-5 w-5" />
                      Back
                    </button>
                    <button
                      onClick={handleNextStep}
                      className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      Continue to Payment
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Payment */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white rounded-2xl shadow-lg p-6 sm:p-8"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Payment Method</h2>
                      <p className="text-sm text-slate-600">Choose how you'd like to pay</p>
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div className="space-y-4 mb-6">
                    {/* PayPal */}
                    <label className="block cursor-pointer">
                      <div className={`p-4 border-2 rounded-xl transition-all ${
                        paymentMethod === 'paypal' 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              checked={paymentMethod === 'paypal'}
                              onChange={() => setPaymentMethod('paypal')}
                              className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                            />
                            <div>
                              <div className="font-semibold text-slate-900">PayPal</div>
                              <div className="text-xs text-slate-500">Fast and secure payment</div>
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-blue-600">PayPal</div>
                        </div>
                      </div>
                    </label>

                    {/* Card Payment */}
                    <label className="block cursor-pointer">
                      <div className={`p-4 border-2 rounded-xl transition-all ${
                        paymentMethod === 'card' 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              checked={paymentMethod === 'card'}
                              onChange={() => setPaymentMethod('card')}
                              className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                            />
                            <div>
                              <div className="font-semibold text-slate-900">Credit / Debit Card</div>
                              <div className="text-xs text-slate-500">Visa, Mastercard, Amex</div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <div className="w-8 h-6 bg-blue-600 rounded"></div>
                            <div className="w-8 h-6 bg-red-600 rounded"></div>
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Trust Badges */}
                  <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 rounded-xl">
                    <div className="flex flex-col items-center text-center">
                      <Lock className="h-6 w-6 text-green-600 mb-1" />
                      <span className="text-xs font-medium text-slate-700">Secure</span>
                      <span className="text-xs text-slate-500">256-bit SSL</span>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <Truck className="h-6 w-6 text-blue-600 mb-1" />
                      <span className="text-xs font-medium text-slate-700">Fast Delivery</span>
                      <span className="text-xs text-slate-500">2-4 days</span>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <CheckCircle2 className="h-6 w-6 text-purple-600 mb-1" />
                      <span className="text-xs font-medium text-slate-700">Money Back</span>
                      <span className="text-xs text-slate-500">30-day guarantee</span>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={handlePrevStep}
                      className="flex-1 py-4 border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="h-5 w-5" />
                      Back
                    </button>
                    <button
                      onClick={handleCompleteOrder}
                      disabled={isProcessing}
                      className="flex-1 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Lock className="h-5 w-5" />
                          Complete Order - £{orderTotals.total.toFixed(2)}
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 text-center mt-4">
                    By completing this order, you agree to our Terms of Service and Privacy Policy
                  </p>
                </motion.div>
              )}

              {/* Step 4: Success */}
              {currentStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
                  >
                    <CheckCircle2 className="h-10 w-10 text-green-600" />
                  </motion.div>

                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Order Confirmed!</h2>
                  <p className="text-slate-600 mb-6">
                    Thank you for your order. We've sent a confirmation email to <br />
                    <span className="font-semibold text-purple-600">{contactInfo.email}</span>
                  </p>

                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 mb-6">
                    <div className="text-sm text-slate-600 mb-2">Order Number</div>
                    <div className="text-2xl font-bold text-slate-900 mb-4">#ORD-{Date.now()}</div>
                    
                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Shipping to</div>
                        <div className="text-sm font-medium text-slate-900">
                          {shippingInfo.firstName} {shippingInfo.lastName}
                        </div>
                        <div className="text-xs text-slate-600">
                          {shippingInfo.address1}, {shippingInfo.city}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Estimated Delivery</div>
                        <div className="text-sm font-medium text-slate-900">
                          {new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short'
                          })}
                        </div>
                        <div className="text-xs text-slate-600">2-4 business days</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => window.location.href = '/'}
                      className="flex-1 py-3 border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all"
                    >
                      Continue Shopping
                    </button>
                    <button
                      onClick={() => window.location.href = '/orders'}
                      className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                    >
                      View Order Details
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className={`bg-white rounded-2xl shadow-lg p-6 sticky top-8 ${
              showOrderSummary ? 'block' : 'hidden lg:block'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900">Order Summary</h3>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <ShoppingBag className="h-4 w-4" />
                  <span>{orderTotals.itemCount} items</span>
                </div>
              </div>

              {/* Cart Items */}
              <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
                {cartItems.map((item, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center relative">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Package className="h-6 w-6 text-slate-400" />
                      )}
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-purple-600 text-white text-xs rounded-full flex items-center justify-center font-semibold">
                        {item.quantity}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-slate-900 truncate">{item.name}</h4>
                      {item.variant && (
                        <p className="text-xs text-slate-500">{item.variant}</p>
                      )}
                      <p className="text-sm font-semibold text-slate-900 mt-1">
                        £{(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Discount Code */}
              <div className="mb-6 pb-6 border-b border-slate-200">
                {!appliedDiscount ? (
                  showDiscountInput ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            value={discountCode}
                            onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                            placeholder="DISCOUNT CODE"
                            className="w-full pl-10 pr-3 py-2 border-2 border-slate-200 rounded-lg outline-none focus:border-purple-400 text-sm"
                          />
                        </div>
                        <button
                          onClick={handleApplyDiscount}
                          className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors text-sm"
                        >
                          Apply
                        </button>
                      </div>
                      {errors.discountCode && (
                        <p className="text-xs text-red-600">{errors.discountCode}</p>
                      )}
                      <button
                        onClick={() => {
                          setShowDiscountInput(false);
                          setDiscountCode('');
                          setErrors({ ...errors, discountCode: null });
                        }}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDiscountInput(true)}
                      className="flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700"
                    >
                      <Percent className="h-4 w-4" />
                      Add discount code
                    </button>
                  )
                ) : (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-green-600" />
                      <div>
                        <div className="text-sm font-semibold text-green-900">{appliedDiscount.code}</div>
                        <div className="text-xs text-green-700">{appliedDiscount.description}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setAppliedDiscount(null)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-3 mb-6 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>£{orderTotals.subtotal.toFixed(2)}</span>
                </div>
                
                {appliedDiscount && orderTotals.discount > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>Discount ({appliedDiscount.percentage}%)</span>
                    <span>-£{orderTotals.discount.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-slate-600">
                  <span>Shipping</span>
                  <span>
                    {orderTotals.shipping === 0 ? (
                      <span className="text-green-600 font-medium">FREE</span>
                    ) : (
                      `£${orderTotals.shipping.toFixed(2)}`
                    )}
                  </span>
                </div>
                
                <div className="flex justify-between text-slate-600">
                  <span>VAT (20%)</span>
                  <span>£{orderTotals.tax.toFixed(2)}</span>
                </div>
                
                <div className="pt-3 border-t-2 border-slate-200 flex justify-between text-lg font-bold text-slate-900">
                  <span>Total</span>
                  <span>£{orderTotals.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Free Shipping Banner */}
              {orderTotals.subtotalAfterDiscount < 50 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <span className="font-semibold">
                      Add £{(50 - orderTotals.subtotalAfterDiscount).toFixed(2)} more
                    </span>
                    {' '}for FREE shipping! 🎉
                  </p>
                  <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${(orderTotals.subtotalAfterDiscount / 50) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
