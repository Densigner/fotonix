import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User, Package, Palette, ChevronRight, Home, Settings, MapPin, Mail, Phone, Check, Loader2 } from 'lucide-react';
import AccountPage from './Account';

/**
 * CustomerDashboard Component
 * 
 * Main dashboard for customers with 3 sections:
 * 1. Account Settings (address, contact info)
 * 2. My Orders
 * 3. Light Pattern Designs (the existing Account page content)
 */
export default function CustomerDashboard() {
  const { currentUser, userProfile, isLoading } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard'); // 'dashboard', 'settings', 'orders', 'patterns'
  
  // Account settings form state
  const [formData, setFormData] = useState({
    firstName: userProfile?.firstName || '',
    lastName: userProfile?.lastName || '',
    email: currentUser?.email || '',
    phone: userProfile?.phone || '',
    address: userProfile?.address || '',
    city: userProfile?.city || '',
    postcode: userProfile?.postcode || '',
    country: userProfile?.country || 'United Kingdom'
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Redirect to login if not authenticated
  if (!isLoading && !currentUser) {
    window.location.hash = 'login';
    return null;
  }

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    // Here you would save to Firebase/backend
    console.log('Saving settings:', formData);
    
    // Simulate save delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  // Dashboard Cards
  const DashboardCard = ({ icon: Icon, title, description, onClick, gradient }) => (
    <button
      onClick={onClick}
      className="w-full text-left group"
    >
      <div className={`relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${gradient}`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mb-4">
            <Icon className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
          <p className="text-white/80 text-sm mb-4">{description}</p>
          <div className="flex items-center text-white/90 text-sm font-medium group-hover:translate-x-1 transition-transform">
            Open <ChevronRight className="w-4 h-4 ml-1" />
          </div>
        </div>
      </div>
    </button>
  );

  // Main Dashboard View
  if (activeSection === 'dashboard') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center mb-4">
              <User className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome back{currentUser?.displayName ? `, ${currentUser.displayName.split(' ')[0]}` : ''}!
            </h1>
            <p className="text-neutral-400">
              {currentUser?.email}
            </p>
          </div>

          {/* Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DashboardCard
              icon={Settings}
              title="Account Settings"
              description="Manage your saved addresses, contact details, and preferences"
              onClick={() => setActiveSection('settings')}
              gradient="bg-gradient-to-br from-blue-500 to-cyan-600"
            />
            
            <DashboardCard
              icon={Package}
              title="My Orders"
              description="Track your orders, view history, and manage deliveries"
              onClick={() => window.location.href = '/my-orders'}
              gradient="bg-gradient-to-br from-green-500 to-emerald-600"
            />
            
            <DashboardCard
              icon={Palette}
              title="Light Patterns"
              description="Create, save, and manage your custom LED light patterns"
              onClick={() => setActiveSection('patterns')}
              gradient="bg-gradient-to-br from-pink-500 to-violet-600"
            />
          </div>

          {/* Quick Stats */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-neutral-800/50 rounded-xl p-4 text-center border border-neutral-700">
              <div className="text-2xl font-bold text-white">0</div>
              <div className="text-sm text-neutral-400">Active Orders</div>
            </div>
            <div className="bg-neutral-800/50 rounded-xl p-4 text-center border border-neutral-700">
              <div className="text-2xl font-bold text-white">0</div>
              <div className="text-sm text-neutral-400">Saved Patterns</div>
            </div>
            <div className="bg-neutral-800/50 rounded-xl p-4 text-center border border-neutral-700">
              <div className="text-2xl font-bold text-white">0</div>
              <div className="text-sm text-neutral-400">Downloads</div>
            </div>
            <div className="bg-neutral-800/50 rounded-xl p-4 text-center border border-neutral-700">
              <div className="text-2xl font-bold text-pink-400">Free</div>
              <div className="text-sm text-neutral-400">Account Tier</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Account Settings View
  if (activeSection === 'settings') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => setActiveSection('dashboard')}
            className="flex items-center text-neutral-400 hover:text-white mb-6 transition-colors"
          >
            <ChevronRight className="w-5 h-5 rotate-180 mr-1" />
            Back to Dashboard
          </button>

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
              <Settings className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Account Settings</h1>
              <p className="text-neutral-400">Manage your personal information and addresses</p>
            </div>
          </div>

          {/* Success Message */}
          {saveSuccess && (
            <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400 text-center">
              Settings saved successfully!
            </div>
          )}

          {/* Settings Form */}
          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* Personal Info Section */}
            <div className="bg-neutral-800/50 rounded-2xl p-6 border border-neutral-700">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                Personal Information
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
                    placeholder="Smith"
                  />
                </div>
              </div>
            </div>

            {/* Contact Section */}
            <div className="bg-neutral-800/50 rounded-2xl p-6 border border-neutral-700">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-400" />
                Contact Details
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full px-4 py-3 bg-neutral-900/50 border border-neutral-700 rounded-xl text-neutral-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-neutral-500 mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
                    placeholder="+44 7123 456789"
                  />
                </div>
              </div>
            </div>

            {/* Address Section */}
            <div className="bg-neutral-800/50 rounded-2xl p-6 border border-neutral-700">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-400" />
                Shipping Address
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
                    placeholder="123 Main Street"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-neutral-400 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
                      placeholder="London"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-400 mb-1">Postcode</label>
                    <input
                      type="text"
                      value={formData.postcode}
                      onChange={(e) => setFormData({...formData, postcode: e.target.value})}
                      className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
                      placeholder="SW1A 1AA"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Country</label>
                  <select
                    value={formData.country}
                    onChange={(e) => setFormData({...formData, country: e.target.value})}
                    className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Ireland">Ireland</option>
                    <option value="France">France</option>
                    <option value="Germany">Germany</option>
                    <option value="Spain">Spain</option>
                    <option value="Italy">Italy</option>
                    <option value="Netherlands">Netherlands</option>
                    <option value="United States">United States</option>
                    <option value="Canada">Canada</option>
                    <option value="Australia">Australia</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={isSaving}
              className={`w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                saveSuccess 
                  ? 'bg-green-500 text-white' 
                  : isSaving
                    ? 'bg-neutral-600 text-neutral-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-5 h-5" />
                  Saved Successfully!
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Light Patterns View (original Account page)
  if (activeSection === 'patterns') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950">
        {/* Back Button */}
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <button
            onClick={() => setActiveSection('dashboard')}
            className="flex items-center text-neutral-400 hover:text-white mb-4 transition-colors"
          >
            <ChevronRight className="w-5 h-5 rotate-180 mr-1" />
            Back to Dashboard
          </button>
        </div>
        
        {/* Original Account Page Content */}
        <AccountPage />
      </div>
    );
  }

  return null;
}
