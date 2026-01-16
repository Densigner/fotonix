import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Mail, 
  ExternalLink,
  DollarSign,
  Eye,
  EyeOff,
  Copy,
  Filter,
  Download,
  TrendingUp,
  Calendar
} from 'lucide-react';
import AffiliateCreator from './AffiliateCreator';

const AffiliateManager = ({ 
  memberUserId,
  onSelectAffiliate,
  className = '',
  ...props 
}) => {
  const [affiliates, setAffiliates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreator, setShowCreator] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState(null);
  
  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_desc');

  // Copy feedback
  const [copyStatus, setCopyStatus] = useState({});

  // Load affiliates
  useEffect(() => {
    loadAffiliates();
  }, [memberUserId]);

  const loadAffiliates = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/member/affiliates${memberUserId ? `?memberId=${memberUserId}` : ''}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-member-uid': memberUserId || 'current-member-id'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load affiliates: ${response.status}`);
      }

      const data = await response.json();
      setAffiliates(Array.isArray(data) ? data : []);

    } catch (error) {
      console.error('Failed to load affiliates:', error);
      setError(error.message);
      // Show mock data for development
      setAffiliates([
        {
          id: 1,
          affiliateCode: 'SARAH123',
          displayName: 'Sarah Johnson',
          email: 'sarah@example.com',
          paypalEmail: 'sarah.paypal@example.com',
          paypalMe: 'sarahjohnson',
          defaultCommissionRate: 0.12,
          status: 'active',
          createdAt: '2024-01-15T10:30:00Z',
          notes: 'Instagram influencer, 15k followers',
          totalEarnings: 2840.50,
          totalSales: 28,
          lastSale: '2024-10-28T15:20:00Z'
        },
        {
          id: 2,
          affiliateCode: 'MIKE456',
          displayName: 'Mike Chen',
          email: 'mike@example.com',
          paypalEmail: 'mike.payments@gmail.com',
          paypalMe: '',
          defaultCommissionRate: 0.10,
          status: 'active',
          createdAt: '2024-02-01T14:15:00Z',
          notes: 'YouTube reviewer, tech channel',
          totalEarnings: 1650.75,
          totalSales: 19,
          lastSale: '2024-10-25T09:45:00Z'
        },
        {
          id: 3,
          affiliateCode: 'EMMA789',
          displayName: 'Emma Davis',
          email: 'emma@example.com',
          paypalEmail: '',
          paypalMe: 'emmadavis',
          defaultCommissionRate: 0.15,
          status: 'paused',
          createdAt: '2024-03-10T11:00:00Z',
          notes: 'Fashion blogger, seasonal promotions',
          totalEarnings: 890.25,
          totalSales: 12,
          lastSale: '2024-09-15T16:30:00Z'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort affiliates
  const filteredAffiliates = useMemo(() => {
    let filtered = affiliates.filter(affiliate => {
      // Status filter
      if (statusFilter !== 'all' && affiliate.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          affiliate.displayName.toLowerCase().includes(term) ||
          affiliate.email.toLowerCase().includes(term) ||
          affiliate.affiliateCode.toLowerCase().includes(term) ||
          (affiliate.notes && affiliate.notes.toLowerCase().includes(term))
        );
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.displayName.localeCompare(b.displayName);
        case 'name_desc':
          return b.displayName.localeCompare(a.displayName);
        case 'earnings_desc':
          return (b.totalEarnings || 0) - (a.totalEarnings || 0);
        case 'earnings_asc':
          return (a.totalEarnings || 0) - (b.totalEarnings || 0);
        case 'sales_desc':
          return (b.totalSales || 0) - (a.totalSales || 0);
        case 'sales_asc':
          return (a.totalSales || 0) - (b.totalSales || 0);
        case 'created_desc':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'created_asc':
          return new Date(a.createdAt) - new Date(b.createdAt);
        default:
          return 0;
      }
    });

    return filtered;
  }, [affiliates, searchTerm, statusFilter, sortBy]);

  // Handle affiliate actions
  const handleToggleStatus = async (affiliateId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    
    try {
      const response = await fetch(`/api/member/affiliates/${affiliateId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-member-uid': memberUserId || 'current-member-id'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        setAffiliates(prev => 
          prev.map(affiliate => 
            affiliate.id === affiliateId 
              ? { ...affiliate, status: newStatus }
              : affiliate
          )
        );
      }
    } catch (error) {
      console.error('Failed to toggle affiliate status:', error);
    }
  };

  const handleDeleteAffiliate = async (affiliateId, affiliateName) => {
    if (!window.confirm(`Are you sure you want to delete "${affiliateName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/member/affiliates/${affiliateId}`, {
        method: 'DELETE',
        headers: {
          'x-member-uid': memberUserId || 'current-member-id'
        }
      });

      if (response.ok) {
        setAffiliates(prev => prev.filter(affiliate => affiliate.id !== affiliateId));
      }
    } catch (error) {
      console.error('Failed to delete affiliate:', error);
    }
  };

  const handleCopy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(prev => ({ ...prev, [key]: 'copied' }));
      setTimeout(() => {
        setCopyStatus(prev => ({ ...prev, [key]: null }));
      }, 2000);
    } catch (error) {
      setCopyStatus(prev => ({ ...prev, [key]: 'error' }));
      setTimeout(() => {
        setCopyStatus(prev => ({ ...prev, [key]: null }));
      }, 2000);
    }
  };

  const handleAffiliateCreated = (newAffiliate) => {
    setAffiliates(prev => [newAffiliate, ...prev]);
    setShowCreator(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  if (showCreator) {
    return (
      <AffiliateCreator
        memberUserId={memberUserId}
        onAffiliateCreated={handleAffiliateCreated}
        onClose={() => setShowCreator(false)}
        className={className}
        {...props}
      />
    );
  }

  return (
    <div className={`space-y-6 ${className}`} {...props}>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-violet-600 bg-clip-text text-transparent">
            My Affiliates
          </h2>
          <p className="text-gray-600 mt-1">
            Manage your affiliate network and track their performance
          </p>
        </div>
        
        <button
          onClick={() => setShowCreator(true)}
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-lg hover:from-pink-600 hover:to-violet-600 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Affiliate
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search affiliates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          >
            <option value="created_desc">Newest First</option>
            <option value="created_asc">Oldest First</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
            <option value="earnings_desc">Highest Earnings</option>
            <option value="earnings_asc">Lowest Earnings</option>
            <option value="sales_desc">Most Sales</option>
            <option value="sales_asc">Fewest Sales</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
          <span className="ml-3 text-gray-600">Loading affiliates...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-500 mr-2">⚠️</div>
            <div>
              <h3 className="text-red-800 font-medium">Error Loading Affiliates</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
              <button 
                onClick={loadAffiliates}
                className="mt-2 text-sm bg-red-100 hover:bg-red-200 px-3 py-1 rounded"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Affiliates List */}
      {!loading && !error && (
        <>
          {filteredAffiliates.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No affiliates found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? "Try adjusting your search or filters"
                  : "Start building your affiliate network by adding your first affiliate"
                }
              </p>
              <button
                onClick={() => setShowCreator(true)}
                className="inline-flex items-center px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Affiliate
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredAffiliates.map((affiliate) => (
                <div 
                  key={affiliate.id}
                  className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200"
                >
                  {/* Affiliate Header */}
                  <div className="p-4 border-b">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 truncate">
                            {affiliate.displayName}
                          </h3>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            affiliate.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {affiliate.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                          {affiliate.affiliateCode} • {affiliate.email}
                        </p>
                        {affiliate.notes && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {affiliate.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Performance Stats */}
                  <div className="p-4">
                    <div className="grid grid-cols-3 gap-4 text-center mb-4">
                      <div>
                        <div className="text-lg font-semibold text-green-600">
                          {formatCurrency(affiliate.totalEarnings)}
                        </div>
                        <div className="text-xs text-gray-600">Total Earnings</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-gray-900">
                          {affiliate.totalSales || 0}
                        </div>
                        <div className="text-xs text-gray-600">Sales</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-blue-600">
                          {(affiliate.defaultCommissionRate * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-600">Commission</div>
                      </div>
                    </div>

                    {/* PayPal Info */}
                    <div className="space-y-2 mb-4">
                      {affiliate.paypalEmail && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">PayPal Email:</span>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-900 truncate max-w-32">
                              {affiliate.paypalEmail}
                            </span>
                            <button
                              onClick={() => handleCopy(affiliate.paypalEmail, `email-${affiliate.id}`)}
                              className={`p-1 rounded transition-colors ${
                                copyStatus[`email-${affiliate.id}`] === 'copied' 
                                  ? 'text-green-600' 
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {affiliate.paypalMe && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">PayPal.me:</span>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-900 truncate max-w-32">
                              paypal.me/{affiliate.paypalMe}
                            </span>
                            <button
                              onClick={() => handleCopy(`https://paypal.me/${affiliate.paypalMe}`, `paypalme-${affiliate.id}`)}
                              className={`p-1 rounded transition-colors ${
                                copyStatus[`paypalme-${affiliate.id}`] === 'copied' 
                                  ? 'text-green-600' 
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-4 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleStatus(affiliate.id, affiliate.status)}
                          className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                          title={affiliate.status === 'active' ? 'Pause affiliate' : 'Activate affiliate'}
                        >
                          {affiliate.status === 'active' ? 
                            <EyeOff className="w-4 h-4" /> : 
                            <Eye className="w-4 h-4" />
                          }
                        </button>
                        
                        <button
                          onClick={() => setEditingAffiliate(affiliate)}
                          className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                          title="Edit affiliate"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => handleDeleteAffiliate(affiliate.id, affiliate.displayName)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                          title="Delete affiliate"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {onSelectAffiliate && (
                        <button
                          onClick={() => onSelectAffiliate(affiliate)}
                          className="px-3 py-1 bg-pink-500 text-white text-sm rounded-lg hover:bg-pink-600 transition-colors"
                        >
                          Select
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary Stats */}
          {filteredAffiliates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white rounded-lg border p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {filteredAffiliates.length}
                </div>
                <div className="text-sm text-gray-600">Total Affiliates</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(
                    filteredAffiliates.reduce((sum, aff) => sum + (aff.totalEarnings || 0), 0)
                  )}
                </div>
                <div className="text-sm text-gray-600">Total Paid</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {filteredAffiliates.reduce((sum, aff) => sum + (aff.totalSales || 0), 0)}
                </div>
                <div className="text-sm text-gray-600">Total Sales</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {filteredAffiliates.filter(aff => aff.status === 'active').length}
                </div>
                <div className="text-sm text-gray-600">Active Now</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AffiliateManager;