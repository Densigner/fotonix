import React, { useState, useEffect, useRef } from 'react';
import { ref, get, query, orderByChild, startAt, endAt, limitToFirst } from 'firebase/database';
import { db } from '../email/MailBuilder/firebase/init';
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Loader, 
  Database,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  X,
  Calendar,
  Hash,
  FileText,
  Zap,
  ArrowUpDown,
  Eye,
  EyeOff,
  Info,
  ExternalLink
} from 'lucide-react';

const DeadRedSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [results, setResults] = useState([]);
  const [allData, setAllData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [selectedFields, setSelectedFields] = useState(['all']);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'
  const [stats, setStats] = useState({ total: 0, fields: {} });
  const [showInfo, setShowInfo] = useState(false);
  
  const searchInputRef = useRef(null);
  const filterRef = useRef(null);

  // Load all data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-search as user types (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm || allData) {
        performSearch();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, searchField, sortBy, allData]);

  const loadAllData = async () => {
    try {
      setInitialLoading(true);
      setError(null);
      
      const deadredRef = ref(db, 'deadred');
      const snapshot = await get(deadredRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        setAllData(data);
        
        // Calculate statistics
        const dataArray = Object.entries(data).map(([key, value]) => ({ id: key, ...value }));
        const fields = {};
        
        dataArray.forEach(item => {
          Object.keys(item).forEach(key => {
            if (key !== 'id') {
              fields[key] = (fields[key] || 0) + 1;
            }
          });
        });
        
        setStats({
          total: dataArray.length,
          fields
        });
        
        setResults(dataArray);
      } else {
        setAllData({});
        setResults([]);
        setStats({ total: 0, fields: {} });
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data from Firebase. Please check your connection.');
    } finally {
      setInitialLoading(false);
    }
  };

  const performSearch = () => {
    if (!allData) return;

    setLoading(true);
    
    try {
      let dataArray = Object.entries(allData).map(([key, value]) => ({ 
        id: key, 
        ...value 
      }));

      // Filter by search term
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        
        dataArray = dataArray.filter(item => {
          if (searchField === 'all') {
            // Search in all fields
            return Object.entries(item).some(([key, value]) => {
              if (key === 'id') return false;
              const strValue = String(value).toLowerCase();
              return strValue.includes(lowerSearch);
            });
          } else {
            // Search in specific field
            const fieldValue = String(item[searchField] || '').toLowerCase();
            return fieldValue.includes(lowerSearch);
          }
        });
      }

      // Sort results
      dataArray = sortResults(dataArray);

      setResults(dataArray);
    } catch (err) {
      console.error('Search error:', err);
      setError('An error occurred during search');
    } finally {
      setLoading(false);
    }
  };

  const sortResults = (data) => {
    const sorted = [...data];
    
    switch (sortBy) {
      case 'recent':
        return sorted.reverse();
      case 'oldest':
        return sorted;
      case 'az':
        return sorted.sort((a, b) => {
          const aStr = JSON.stringify(a).toLowerCase();
          const bStr = JSON.stringify(b).toLowerCase();
          return aStr.localeCompare(bStr);
        });
      case 'za':
        return sorted.sort((a, b) => {
          const aStr = JSON.stringify(a).toLowerCase();
          const bStr = JSON.stringify(b).toLowerCase();
          return bStr.localeCompare(aStr);
        });
      default:
        return sorted;
    }
  };

  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const exportToJSON = () => {
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `deadred-export-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getFieldIcon = (fieldName) => {
    const name = fieldName.toLowerCase();
    if (name.includes('date') || name.includes('time')) return <Calendar className="h-4 w-4" />;
    if (name.includes('id') || name.includes('key')) return <Hash className="h-4 w-4" />;
    if (name.includes('status') || name.includes('active')) return <Zap className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const highlightMatch = (text, search) => {
    if (!search || !text) return text;
    
    const strText = String(text);
    const parts = strText.split(new RegExp(`(${search})`, 'gi'));
    
    return parts.map((part, i) => 
      part.toLowerCase() === search.toLowerCase() ? (
        <span key={i} className="bg-yellow-200 dark:bg-yellow-700 text-gray-900 dark:text-white px-1 rounded">
          {part}
        </span>
      ) : part
    );
  };

  const formatTimestamp = (value) => {
    // Handle Unix timestamps (seconds since epoch)
    const timestamp = typeof value === 'number' ? value : parseInt(value, 10);
    if (isNaN(timestamp)) return value;
    
    // Unix timestamps are in seconds, JS Date expects milliseconds
    const date = new Date(timestamp * 1000);
    
    // Check if it's a valid date
    if (isNaN(date.getTime())) return value;
    
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Friendly labels for specific field values
  const friendlyLabels = {
    'no_mod_activity_found_in_lookback': 'No visible moderator engagement in the sub for 60 days based on public activity data'
  };

  // Friendly column header names for table view
  const friendlyFieldNames = {
    'id': 'Subreddit',
    'ok': 'Available',
    'ts': 'Scanned Date',
    'from': 'Source',
    'note': 'Details',
    'inactivity_reason': 'Inactivity Reason',
    'scanned_at_utc': 'Scanned At',
    'subscribers': 'Subscribers',
    'created_utc': 'Created',
    'name': 'Name',
    'subreddit': 'Subreddit',
    'status': 'Status'
  };

  const getFieldDisplayName = (field) => {
    return friendlyFieldNames[field] || field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const renderValue = (value, fieldName = '') => {
    if (value === null || value === undefined) return <span className="text-gray-400 italic">null</span>;
    if (typeof value === 'boolean') return value ? <span className="text-green-600">true</span> : <span className="text-red-600">false</span>;
    
    // Format timestamp fields
    const lowerFieldName = fieldName.toLowerCase();
    if (typeof value === 'number' && (lowerFieldName.includes('_utc') || lowerFieldName.includes('_at') || lowerFieldName.includes('timestamp') || lowerFieldName.includes('created') || lowerFieldName.includes('date'))) {
      return <span className="text-blue-600">{formatTimestamp(value)}</span>;
    }
    
    if (typeof value === 'number') return <span className="text-blue-600">{value.toLocaleString()}</span>;
    if (typeof value === 'object') return <span className="text-purple-600">{JSON.stringify(value, null, 2)}</span>;
    
    // Check for friendly label replacements
    const strValue = String(value);
    if (friendlyLabels[strValue]) {
      return <span className="text-orange-600 dark:text-orange-400">{friendlyLabels[strValue]}</span>;
    }
    
    return highlightMatch(value, searchTerm);
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="relative">
            <Database className="h-20 w-20 text-indigo-600 dark:text-indigo-400 mx-auto mb-4 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader className="h-10 w-10 text-indigo-600 dark:text-indigo-400 animate-spin" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Loading Modless Subreddits</h2>
          <p className="text-gray-600 dark:text-gray-400">Fetching subreddit data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-slate-700 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Database className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
                <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Modless Subs Finder
                  </h1>
                  <button
                    onClick={() => setShowInfo(!showInfo)}
                    className={`p-2 rounded-full transition-all duration-200 ${showInfo ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600' : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500'}`}
                    title="Learn about subreddit takeovers"
                  >
                    <Info className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Discover subreddits without active moderators
                </p>
              </div>
            </div>
            
            {/* Info Panel */}
            {showInfo && (
              <div className="mt-4 p-5 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-3 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Why Take Over a Modless Subreddit?
                </h3>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-indigo-800 dark:text-indigo-200">Benefits:</h4>
                    <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1.5">
                      <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Instant access to an established community</li>
                      <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Built-in subscriber base ready for your content</li>
                      <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Existing SEO value and search rankings</li>
                      <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Perfect for niche marketing and brand building</li>
                      <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Drive traffic to your products or services</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-indigo-800 dark:text-indigo-200">How to Request a Takeover:</h4>
                    <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-1.5">
                      <li className="flex items-start gap-2"><span className="text-indigo-500 font-semibold">1.</span> Find a subreddit from this list that matches your niche</li>
                      <li className="flex items-start gap-2"><span className="text-indigo-500 font-semibold">2.</span> Visit <a href="https://www.reddit.com/r/redditrequest" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline">r/redditrequest</a></li>
                      <li className="flex items-start gap-2"><span className="text-indigo-500 font-semibold">3.</span> Submit a request following their posting format</li>
                      <li className="flex items-start gap-2"><span className="text-indigo-500 font-semibold">4.</span> Include your plans to revive and moderate the community</li>
                      <li className="flex items-start gap-2"><span className="text-indigo-500 font-semibold">5.</span> Wait ~30 days for Reddit admins to review</li>
                    </ol>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <ExternalLink className="h-4 w-4" />
                  <a href="https://www.reddit.com/r/redditrequest/wiki/top_mod_removal" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline">
                    Read Reddit's official guidelines for subreddit requests
                  </a>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <button
                onClick={loadAllData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm hover:shadow"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              
              <button
                onClick={exportToJSON}
                disabled={results.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white shadow-lg">
              <div className="text-sm opacity-90 mb-1">Total Records</div>
              <div className="text-3xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
              <div className="text-sm opacity-90 mb-1">Search Results</div>
              <div className="text-3xl font-bold">{results.length}</div>
            </div>
            <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-4 text-white shadow-lg">
              <div className="text-sm opacity-90 mb-1">Unique Fields</div>
              <div className="text-3xl font-bold">{Object.keys(stats.fields).length}</div>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
              <div className="text-sm opacity-90 mb-1">Match Rate</div>
              <div className="text-3xl font-bold">
                {stats.total > 0 ? Math.round((results.length / stats.total) * 100) : 0}%
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search across all fields..."
                className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm text-lg"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="flex gap-3">
              {/* Filter Dropdown */}
              <div ref={filterRef} className="relative">
                <button
                  onClick={() => setFilterOpen(!filterOpen)}
                  className="flex items-center gap-2 px-4 py-4 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm whitespace-nowrap"
                >
                  <Filter className="h-5 w-5" />
                  <span className="hidden sm:inline">Filters</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
                </button>

                {filterOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-slate-700">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Search Field</h3>
                      <select
                        value={searchField}
                        onChange={(e) => setSearchField(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="all">All Fields</option>
                        {Object.keys(stats.fields).map(field => (
                          <option key={field} value={field}>{getFieldDisplayName(field)} ({stats.fields[field]})</option>
                        ))}
                      </select>
                    </div>

                    <div className="p-4 border-b border-gray-200 dark:border-slate-700">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Sort By</h3>
                      <div className="space-y-2">
                        {[
                          { value: 'recent', label: 'Most Recent' },
                          { value: 'oldest', label: 'Oldest First' },
                          { value: 'az', label: 'A → Z' },
                          { value: 'za', label: 'Z → A' }
                        ].map(option => (
                          <label key={option.value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors">
                            <input
                              type="radio"
                              name="sort"
                              value={option.value}
                              checked={sortBy === option.value}
                              onChange={(e) => setSortBy(e.target.value)}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">View Mode</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setViewMode('card')}
                          className={`flex-1 px-3 py-2 rounded-lg transition-all ${
                            viewMode === 'card'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          Cards
                        </button>
                        <button
                          onClick={() => setViewMode('table')}
                          className={`flex-1 px-3 py-2 rounded-lg transition-all ${
                            viewMode === 'table'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          Table
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* View Toggle */}
              <button
                onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
                className="flex items-center gap-2 px-4 py-4 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm"
                title={viewMode === 'card' ? 'Switch to Table View' : 'Switch to Card View'}
              >
                {viewMode === 'card' ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
            <X className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-300">Error</h3>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader className="h-8 w-8 text-indigo-600 animate-spin" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">Searching...</span>
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="text-center py-16">
            <Database className="h-20 w-20 text-gray-400 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {searchTerm ? 'No results found' : 'No data available'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm 
                ? 'Try adjusting your search terms or filters' 
                : 'The deadred node is empty or doesn\'t exist'}
            </p>
          </div>
        )}

        {!loading && results.length > 0 && viewMode === 'card' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((item) => {
              const isExpanded = expandedItems.has(item.id);
              const fields = Object.entries(item).filter(([key]) => key !== 'id');
              
              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 dark:border-slate-700 group"
                >
                  {/* Card Header */}
                  <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        <span className="font-mono text-sm opacity-90">Subreddit</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(item.id, item.id)}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        title="Copy subreddit name"
                      >
                        {copiedId === item.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <div className="font-mono text-sm bg-white/10 px-3 py-2 rounded-lg break-all">
                      r/{item.id}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4">
                    <div className="space-y-3">
                      {fields.slice(0, isExpanded ? fields.length : 3).map(([key, value]) => (
                        <div key={key} className="group/field">
                          <div className="flex items-start gap-2">
                            <div className="mt-1 text-gray-400">
                              {getFieldIcon(key)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                                {getFieldDisplayName(key)}
                              </div>
                              <div className="text-sm text-gray-900 dark:text-gray-100 break-words">
                                {renderValue(value, key)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {fields.length > 3 && (
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Show Less
                          </>
                        ) : (
                          <>
                            <ChevronRight className="h-4 w-4" />
                            Show {fields.length - 3} More Fields
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && results.length > 0 && viewMode === 'table' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-slate-900 z-10">
                      Subreddit
                    </th>
                    {Object.keys(stats.fields).map(field => (
                      <th key={field} className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          {getFieldIcon(field)}
                          {getFieldDisplayName(field)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {results.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-slate-800 group-hover:bg-gray-50 dark:group-hover:bg-slate-700/50 z-10">
                        <div className="flex items-center gap-2">
                          <a 
                            href={`https://reddit.com/r/${item.id}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="truncate max-w-[200px] text-indigo-600 dark:text-indigo-400 hover:underline" 
                            title={`Visit r/${item.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            r/{item.id}
                          </a>
                          <button
                            onClick={() => copyToClipboard(item.id, `${item.id}-table`)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded transition-all"
                          >
                            {copiedId === `${item.id}-table` ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </td>
                      {Object.keys(stats.fields).map(field => (
                        <td key={field} className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                          <div className="max-w-xs truncate" title={String(item[field] || '')}>
                            {renderValue(item[field], field)}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeadRedSearch;
