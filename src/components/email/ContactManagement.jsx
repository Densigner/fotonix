import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Upload, 
  Download, 
  UserPlus, 
  Filter, 
  MoreHorizontal,
  Trash2,
  Mail,
  Star,
  Clock,
  Users,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react';
import { API_URL } from '../../config/environment';

// Contact Management Interface Component
export default function ContactManagement({ memberUid, isDarkMode = true }) {
  // State management
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showImportCSV, setShowImportCSV] = useState(false);
  const [segments, setSegments] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    vip: 0,
    highEngagement: 0
  });

  // Import state
  const [importFile, setImportFile] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [importResults, setImportResults] = useState(null);

  // Fetch contacts with pagination and filters
  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: 25,
        search: searchTerm,
        segment: selectedSegment
      });

      const response = await fetch(`${API_URL}/api/contacts?${params}`, {
        headers: {
          'x-member-uid': memberUid
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }

      const data = await response.json();
      setContacts(data.contacts);
      setTotalPages(data.pagination.pages);
      
      // Update stats
      setStats({
        total: data.pagination.total,
        active: data.contacts.filter(c => !c.is_blocked).length,
        vip: data.contacts.filter(c => c.is_vip).length,
        highEngagement: data.contacts.filter(c => c.engagement_score >= 0.7).length
      });

      if (data.syncedLeads > 0) {
        console.log(`Synced ${data.syncedLeads} new leads to contacts`);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [memberUid, currentPage, searchTerm, selectedSegment]);

  // Fetch segments
  const fetchSegments = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/contacts/segments`, {
        headers: {
          'x-member-uid': memberUid
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSegments(data);
      }
    } catch (err) {
      console.error('Failed to fetch segments:', err);
    }
  }, [memberUid]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchContacts();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Add new contact
  const handleAddContact = async (contactData) => {
    try {
      const response = await fetch(`${API_URL}/api/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-member-uid': memberUid
        },
        body: JSON.stringify(contactData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add contact');
      }

      setShowAddContact(false);
      fetchContacts();
      alert('Contact added successfully!');
    } catch (err) {
      alert(`Error adding contact: ${err.message}`);
    }
  };

  // Import CSV
  const handleImportCSV = async () => {
    if (!importFile) return;

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      setImportProgress('Uploading...');
      
      const response = await fetch(`${API_URL}/api/contacts/import-csv`, {
        method: 'POST',
        headers: {
          'x-member-uid': memberUid
        },
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      setImportResults(result);
      setImportProgress('Completed');
      fetchContacts();
      
    } catch (err) {
      setImportProgress(`Error: ${err.message}`);
    }
  };

  // Delete contact (GDPR compliant)
  const handleDeleteContact = async (contactId, email) => {
    // eslint-disable-next-line no-restricted-globals
      // eslint-disable-next-line no-restricted-globals
      if (window.confirm(`Are you sure you want to permanently delete ${email}? This action cannot be undone and will add them to the suppression list.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/contacts/${contactId}`, {
        method: 'DELETE',
        headers: {
          'x-member-uid': memberUid
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete contact');
      }

      fetchContacts();
      alert('Contact permanently removed and added to suppression list');
    } catch (err) {
      alert(`Error deleting contact: ${err.message}`);
    }
  };

  // Select/deselect contacts
  const toggleContactSelection = (contactId) => {
    const newSelection = new Set(selectedContacts);
    if (newSelection.has(contactId)) {
      newSelection.delete(contactId);
    } else {
      newSelection.add(contactId);
    }
    setSelectedContacts(newSelection);
  };

  // Bulk operations
  const handleBulkDelete = async () => {
    if (selectedContacts.size === 0) return;
    
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Permanently delete ${selectedContacts.size} contacts? This action cannot be undone.`)) {
      return;
    }

    const promises = Array.from(selectedContacts).map(contactId => {
      const contact = contacts.find(c => c.id === contactId);
      return fetch(`${API_URL}/api/contacts/${contactId}`, {
        method: 'DELETE',
        headers: { 'x-member-uid': memberUid }
      });
    });

    try {
      await Promise.all(promises);
      setSelectedContacts(new Set());
      fetchContacts();
      alert('Selected contacts permanently removed');
    } catch (err) {
      alert('Error deleting contacts');
    }
  };

  const containerClass = `min-h-screen transition-colors duration-300 ${
    isDarkMode ? 'bg-slate-900 text-white' : 'bg-gray-50 text-gray-900'
  }`;

  const cardClass = `rounded-lg border transition-colors duration-300 ${
    isDarkMode 
      ? 'bg-slate-800 border-slate-700' 
      : 'bg-white border-gray-200'
  }`;

  if (loading && contacts.length === 0) {
    return (
      <div className={containerClass}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
            <p>Loading contacts...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Contact Management</h1>
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
            Manage your email subscribers and audience segments
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>Total Contacts</p>
                <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>Active</p>
                <p className="text-2xl font-bold text-green-500">{stats.active.toLocaleString()}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>VIP Members</p>
                <p className="text-2xl font-bold text-yellow-500">{stats.vip.toLocaleString()}</p>
              </div>
              <Star className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          
          <div className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>High Engagement</p>
                <p className="text-2xl font-bold text-pink-500">{stats.highEngagement.toLocaleString()}</p>
              </div>
              <Mail className="w-8 h-8 text-pink-500" />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className={`${cardClass} p-4 mb-6`}>
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-10 pr-4 py-2 w-full sm:w-80 rounded border transition-colors ${
                    isDarkMode 
                      ? 'bg-slate-700 border-slate-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
              
              <select
                value={selectedSegment}
                onChange={(e) => {
                  setSelectedSegment(e.target.value);
                  setCurrentPage(1);
                }}
                className={`px-3 py-2 rounded border transition-colors ${
                  isDarkMode 
                    ? 'bg-slate-700 border-slate-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="all">All Contacts</option>
                <option value="vip">VIP Members</option>
                <option value="high_engagement">High Engagement</option>
                <option value="low_engagement">Low Engagement</option>
                {segments.map(segment => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name} ({segment.contact_count})
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {selectedContacts.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete ({selectedContacts.size})
                </button>
              )}
              
              <button
                onClick={() => setShowImportCSV(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import CSV
              </button>
              
              <button
                onClick={() => setShowAddContact(true)}
                className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Add Contact
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Contacts Table */}
        <div className={`${cardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${isDarkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedContacts.size === contacts.length && contacts.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedContacts(new Set(contacts.map(c => c.id)));
                        } else {
                          setSelectedContacts(new Set());
                        }
                      }}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Contact</th>
                  <th className="px-4 py-3 text-left font-medium">Engagement</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Added</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr 
                    key={contact.id} 
                    className={`border-t transition-colors ${
                      isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedContacts.has(contact.id)}
                        onChange={() => toggleContactSelection(contact.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                          {(contact.first_name?.[0] || contact.email[0]).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">
                            {contact.first_name} {contact.last_name}
                            {contact.is_vip && <Star className="inline w-4 h-4 text-yellow-500 ml-2" />}
                          </div>
                          <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                            {contact.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-pink-500 to-purple-600 h-2 rounded-full"
                            style={{ width: `${(contact.engagement_score * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {Math.round(contact.engagement_score * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {contact.is_blocked ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Blocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                        {new Date(contact.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDeleteContact(contact.id, contact.email)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Permanently delete contact"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {contacts.length === 0 && !loading && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className={`text-lg font-medium ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                  No contacts found
                </p>
                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  {searchTerm ? 'Try adjusting your search terms' : 'Add your first contact to get started'}
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={`px-4 py-3 border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Add Contact Modal */}
        {showAddContact && (
          <AddContactModal
            onClose={() => setShowAddContact(false)}
            onAdd={handleAddContact}
            isDarkMode={isDarkMode}
          />
        )}

        {/* Import CSV Modal */}
        {showImportCSV && (
          <ImportCSVModal
            onClose={() => {
              setShowImportCSV(false);
              setImportFile(null);
              setImportProgress(null);
              setImportResults(null);
            }}
            onImport={handleImportCSV}
            file={importFile}
            setFile={setImportFile}
            progress={importProgress}
            results={importResults}
            isDarkMode={isDarkMode}
          />
        )}
      </div>
    </div>
  );
}

// Add Contact Modal Component
function AddContactModal({ onClose, onAdd, isDarkMode }) {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    isVip: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(formData);
  };

  const modalClass = `fixed inset-0 z-50 flex items-center justify-center p-4 ${
    isDarkMode ? 'bg-black/50' : 'bg-gray-900/50'
  }`;

  const cardClass = `w-full max-w-md rounded-lg shadow-xl transition-colors ${
    isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'
  }`;

  return (
    <div className={modalClass}>
      <div className={cardClass}>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Add New Contact</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className={`w-full px-3 py-2 border rounded-md ${
                  isDarkMode 
                    ? 'bg-slate-700 border-slate-600' 
                    : 'bg-white border-gray-300'
                }`}
                placeholder="contact@example.com"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-md ${
                    isDarkMode 
                      ? 'bg-slate-700 border-slate-600' 
                      : 'bg-white border-gray-300'
                  }`}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-md ${
                    isDarkMode 
                      ? 'bg-slate-700 border-slate-600' 
                      : 'bg-white border-gray-300'
                  }`}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isVip"
                checked={formData.isVip}
                onChange={(e) => setFormData({...formData, isVip: e.target.checked})}
                className="rounded"
              />
              <label htmlFor="isVip" className="text-sm">
                Mark as VIP member
              </label>
            </div>
            
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className={`flex-1 px-4 py-2 border rounded-md transition-colors ${
                  isDarkMode 
                    ? 'border-slate-600 hover:bg-slate-700' 
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors"
              >
                Add Contact
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Import CSV Modal Component
function ImportCSVModal({ onClose, onImport, file, setFile, progress, results, isDarkMode }) {
  const modalClass = `fixed inset-0 z-50 flex items-center justify-center p-4 ${
    isDarkMode ? 'bg-black/50' : 'bg-gray-900/50'
  }`;

  const cardClass = `w-full max-w-lg rounded-lg shadow-xl transition-colors ${
    isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'
  }`;

  return (
    <div className={modalClass}>
      <div className={cardClass}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Import Contacts from CSV</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {!results ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Choose CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files[0])}
                  className={`w-full px-3 py-2 border rounded-md ${
                    isDarkMode 
                      ? 'bg-slate-700 border-slate-600' 
                      : 'bg-white border-gray-300'
                  }`}
                />
                {file && (
                  <p className="text-sm text-gray-500 mt-1">
                    Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
              
              <div className={`p-3 rounded border ${
                isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-gray-50 border-gray-200'
              }`}>
                <h4 className="font-medium text-sm mb-2">CSV Format Requirements:</h4>
                <ul className="text-xs space-y-1 text-gray-600">
                  <li>• Required: <code>email</code> column</li>
                  <li>• Optional: <code>first_name</code>, <code>last_name</code></li>
                  <li>• Alternative column names: <code>Email</code>, <code>First Name</code>, etc.</li>
                  <li>• Maximum file size: 5MB</li>
                </ul>
              </div>
              
              {progress && (
                <div className="text-center py-4">
                  <div className="text-sm text-gray-600">{progress}</div>
                  {progress === 'Uploading...' && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div className="bg-pink-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className={`flex-1 px-4 py-2 border rounded-md transition-colors ${
                    isDarkMode 
                      ? 'border-slate-600 hover:bg-slate-700' 
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={onImport}
                  disabled={!file || progress}
                  className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import CSV
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">Import Complete!</h3>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Imported:</span>
                  <span className="font-semibold text-green-600">{results.imported}</span>
                </div>
                <div className="flex justify-between">
                  <span>Skipped (duplicates):</span>
                  <span className="font-semibold text-yellow-600">{results.skipped}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total processed:</span>
                  <span className="font-semibold">{results.total}</span>
                </div>
              </div>
              
              {results.errors && results.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-sm mb-2 text-red-600">Errors:</h4>
                  <div className="max-h-32 overflow-y-auto text-xs bg-red-50 border border-red-200 rounded p-2">
                    {results.errors.map((error, index) => (
                      <div key={index} className="text-red-700">{error}</div>
                    ))}
                  </div>
                </div>
              )}
              
              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}