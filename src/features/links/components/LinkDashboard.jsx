import React, { useState, useMemo } from 'react';
import { 
  Copy, 
  Edit3, 
  Trash2, 
  BarChart3, 
  ExternalLink, 
  Plus, 
  Search,
  Filter,
  Download,
  Eye,
  EyeOff,
  TrendingUp,
  Calendar,
  Users,
  Package
} from 'lucide-react';
import { useLinks } from '../hooks/useLinks';
import linkService, { linkUtils } from '../services/linkService';

const LinkDashboard = ({ 
  userType = 'member',
  userId,
  affiliateCode,
  onCreateLink,
  className = '',
  ...props 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [selectedLinks, setSelectedLinks] = useState([]);
  const [showAnalytics, setShowAnalytics] = useState(null);
  const [copyStatus, setCopyStatus] = useState({});

  const {
    links,
    loading,
    error,
    totalPages,
    currentPage,
    totalLinks,
    refreshLinks,
    updateLink,
    deleteLink,
    nextPage,
    prevPage
  } = useLinks({
    userType,
    userId,
    affiliateCode,
    searchTerm,
    statusFilter,
    sortBy,
    pageSize: 12
  });

  // Filter and process links for display
  const displayLinks = useMemo(() => {
    if (!links) return [];
    
    return links.filter(link => {
      if (statusFilter === 'all') return true;
      return link.status === statusFilter;
    });
  }, [links, statusFilter]);

  // Handle link copying with feedback
  const handleCopyLink = async (slug) => {
    const result = await linkUtils.copyToClipboard(slug);
    
    setCopyStatus(prev => ({
      ...prev,
      [slug]: result.success ? 'copied' : 'error'
    }));
    
    setTimeout(() => {
      setCopyStatus(prev => ({
        ...prev,
        [slug]: null
      }));
    }, 2000);
  };

  // Handle bulk operations
  const handleBulkStatusUpdate = async (status) => {
    try {
      await linkService.bulkUpdateLinks(selectedLinks, { status });
      setSelectedLinks([]);
      refreshLinks();
    } catch (error) {
      console.error('Bulk update failed:', error);
    }
  };

  // Handle individual link operations
  const handleToggleStatus = async (linkId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    await updateLink(linkId, { status: newStatus });
  };

  const handleDeleteLink = async (linkId) => {
    if (window.confirm('Are you sure you want to delete this link? This action cannot be undone.')) {
      await deleteLink(linkId);
    }
  };

  // Render permissions-based content
  const canCreateLinks = ['member', 'admin'].includes(userType);
  const canEditAllLinks = userType === 'admin';
  const canViewAnalytics = ['member', 'admin'].includes(userType);

  if (loading && !links) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
        <span className="ml-3 text-gray-600">Loading links...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-red-500 mr-2">⚠️</div>
          <div>
            <h3 className="text-red-800 font-medium">Error Loading Links</h3>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button 
              onClick={refreshLinks}
              className="mt-2 text-sm bg-red-100 hover:bg-red-200 px-3 py-1 rounded"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} {...props}>
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-violet-600 bg-clip-text text-transparent">
            {userType === 'member' ? 'My Affiliate Links' : 
             userType === 'affiliate' ? 'My Links' : 'All Links'}
          </h2>
          <p className="text-gray-600 mt-1">
            {totalLinks} {totalLinks === 1 ? 'link' : 'links'} total
          </p>
        </div>
        
        {canCreateLinks && (
          <button
            onClick={onCreateLink}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-lg hover:from-pink-600 hover:to-violet-600 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Link
          </button>
        )}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search links..."
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
            <option value="expired">Expired</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          >
            <option value="date">Date Created</option>
            <option value="title">Title</option>
            <option value="clicks">Clicks</option>
            <option value="conversions">Conversions</option>
            <option value="earnings">Earnings</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedLinks.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-blue-800">
              {selectedLinks.length} link{selectedLinks.length === 1 ? '' : 's'} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkStatusUpdate('active')}
                className="px-3 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200"
              >
                Activate
              </button>
              <button
                onClick={() => handleBulkStatusUpdate('paused')}
                className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
              >
                Pause
              </button>
              <button
                onClick={() => setSelectedLinks([])}
                className="px-3 py-1 bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Links Grid/List */}
      {displayLinks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No links found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm 
              ? "Try adjusting your search or filters"
              : "Create your first affiliate link to get started"
            }
          </p>
          {canCreateLinks && (
            <button
              onClick={onCreateLink}
              className="inline-flex items-center px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Link
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayLinks.map((link) => (
            <div 
              key={link.id}
              className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200"
            >
              {/* Link Header */}
              <div className="p-4 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedLinks.includes(link.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLinks(prev => [...prev, link.id]);
                          } else {
                            setSelectedLinks(prev => prev.filter(id => id !== link.id));
                          }
                        }}
                        className="rounded border-gray-300 text-pink-500 focus:ring-pink-500"
                      />
                      <h3 className="font-medium text-gray-900 truncate" title={link.title}>
                        {link.title}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {window.location.origin}/l/{link.slug}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1 ml-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      link.status === 'active' ? 'bg-green-100 text-green-800' :
                      link.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {link.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Link Stats */}
              <div className="p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-semibold text-gray-900">{link.clicks || 0}</div>
                    <div className="text-xs text-gray-600">Clicks</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">{link.conversions || 0}</div>
                    <div className="text-xs text-gray-600">Sales</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-green-600">
                      {linkUtils.formatCurrency(link.earnings || 0)}
                    </div>
                    <div className="text-xs text-gray-600">Earnings</div>
                  </div>
                </div>

                {/* Conversion Rate */}
                {link.clicks > 0 && (
                  <div className="mt-3 text-center">
                    <div className="text-sm text-gray-600">
                      {linkUtils.calculateConversionRate(link.conversions || 0, link.clicks).toFixed(1)}% conversion rate
                    </div>
                  </div>
                )}
              </div>

              {/* Link Actions */}
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopyLink(link.slug)}
                      className={`p-2 rounded-lg transition-colors ${
                        copyStatus[link.slug] === 'copied' 
                          ? 'bg-green-100 text-green-600'
                          : copyStatus[link.slug] === 'error'
                          ? 'bg-red-100 text-red-600' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title="Copy link"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    
                    {canViewAnalytics && (
                      <button
                        onClick={() => setShowAnalytics(showAnalytics === link.id ? null : link.id)}
                        className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                        title="View analytics"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleStatus(link.id, link.status)}
                      className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                      title={link.status === 'active' ? 'Pause link' : 'Activate link'}
                    >
                      {link.status === 'active' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    
                    {(canEditAllLinks || link.userId === userId) && (
                      <button
                        onClick={() => handleDeleteLink(link.id)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                        title="Delete link"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-lg border">
          <div className="text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={prevPage}
              disabled={currentPage <= 1}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={nextPage}
              disabled={currentPage >= totalPages}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LinkDashboard;