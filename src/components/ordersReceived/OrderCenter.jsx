import React, { useState, useEffect } from 'react';
import { ref as dbRef, onValue, update } from 'firebase/database';
import { db } from '../../firebase';
import JSZip from 'jszip';
import {
  Package,
  Download,
  MapPin,
  Phone,
  User,
  Calendar,
  Layers,
  FileText,
  CheckCircle2,
  Clock,
  Loader,
  Truck,
  Search,
  Filter,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Mail,
  ExternalLink,
  Palette,
  Copy,
  Check,
  AlertCircle,
  XCircle,
  Box
} from 'lucide-react';

const ORDER_STATUSES = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: Clock },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700 border-blue-300', icon: Loader },
  cutting: { label: 'Cutting', color: 'bg-purple-100 text-purple-700 border-purple-300', icon: Layers },
  shipped: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-700 border-indigo-300', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 border-red-300', icon: XCircle }
};

export default function OrderCenter() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [downloadingOrder, setDownloadingOrder] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [funMessage, setFunMessage] = useState(0);

  // Fun loading messages to keep users entertained
  const FUN_MESSAGES = [
    "Ensuring no inner shapes escape during cutting…",
    "Checking bridges so your stencil doesn't become confetti…",
    "Separating layers like a pro chef with a really sharp knife…",
    "Generating clean masks so painting actually feels satisfying…",
    "Balancing detail so the laser doesn't have an existential crisis…",
    "Teaching pixels to behave themselves…",
    "Negotiating with stubborn vector paths…",
    "Convincing the SVG that it really is beautiful…",
    "Making sure your stencil passes the vibe check…",
    "Giving each layer its own personality…",
    "Calculating the optimal coffee-to-laser ratio…",
    "Whispering sweet nothings to the cutting algorithm…",
    "Ensuring maximum paint satisfaction levels…",
    "Preparing vectors for their journey to your doorstep…",
    "Making art happen, one layer at a time…",
  ];

  // Rotate through fun messages while downloading
  useEffect(() => {
    if (downloadingOrder) {
      const interval = setInterval(() => {
        setFunMessage(prev => (prev + 1) % FUN_MESSAGES.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [downloadingOrder]);

  useEffect(() => {
    // Listen to madeOrders node in Firebase
    const ordersRef = dbRef(db, 'madeOrders');

    const unsubscribe = onValue(ordersRef, (snapshot) => {
      if (snapshot.exists()) {
        const ordersData = [];
        snapshot.forEach((childSnapshot) => {
          ordersData.push({
            id: childSnapshot.key,
            ...childSnapshot.val(),
            status: childSnapshot.val().status || 'pending'
          });
        });
        setOrders(ordersData);
      } else {
        setOrders([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatShortDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short'
    });
  };

  const downloadFile = async (url, fileName) => {
    try {
      // Use fetch with mode: 'cors' and get the SVG content
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error('Fetch failed');
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
      }, 100);
    } catch (error) {
      console.error('Download failed, trying proxy:', error);
      // Try through our server proxy to handle CORS
      try {
        const proxyUrl = `/api/download-proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(fileName)}`;
        const response = await fetch(proxyUrl);
        if (response.ok) {
          const blob = await response.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = fileName;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
          }, 100);
          return;
        }
      } catch (proxyError) {
        console.error('Proxy download also failed:', proxyError);
      }
      
      // Last resort: open in new tab (user can right-click save)
      alert('Direct download failed. The file will open in a new tab - right-click and choose "Save As" to download.');
      window.open(url, '_blank');
    }
  };

  // LightBurn layer colors - distinct colors that LightBurn recognizes as separate layers
  const LIGHTBURN_COLORS = [
    '#FF0000', // Red - Layer 0
    '#00FF00', // Green - Layer 1
    '#0000FF', // Blue - Layer 2
    '#FFFF00', // Yellow - Layer 3
    '#FF00FF', // Magenta - Layer 4
    '#00FFFF', // Cyan - Layer 5
    '#FF8000', // Orange - Layer 6
    '#8000FF', // Purple - Layer 7
    '#00FF80', // Spring Green - Layer 8
    '#FF0080', // Rose - Layer 9
    '#80FF00', // Lime - Layer 10
    '#0080FF', // Sky Blue - Layer 11
  ];

  // Function to assign a color to SVG content for LightBurn layer recognition
  const assignLayerColor = (svgContent, layerIndex) => {
    const color = LIGHTBURN_COLORS[layerIndex % LIGHTBURN_COLORS.length];
    
    let modifiedSvg = svgContent;
    
    // Replace stroke colors in attributes (but preserve fill="none" for cutlines)
    // Match stroke="..." attribute format
    modifiedSvg = modifiedSvg.replace(/stroke\s*=\s*["'](?!none)[^"']*["']/gi, `stroke="${color}"`);
    
    // Replace fill colors but NOT fill="none" (important for laser cutting paths)
    modifiedSvg = modifiedSvg.replace(/fill\s*=\s*["'](?!none)[^"']*["']/gi, `fill="${color}"`);
    
    // Handle inline styles: stroke:#000 or stroke:black etc (but not stroke:none)
    modifiedSvg = modifiedSvg.replace(/stroke\s*:\s*(?!none)[^;}"']+/gi, `stroke:${color}`);
    modifiedSvg = modifiedSvg.replace(/fill\s*:\s*(?!none)[^;}"']+/gi, `fill:${color}`);
    
    // If no stroke attribute exists at all, add it to shape elements
    // This ensures LightBurn sees the paths
    if (!modifiedSvg.includes('stroke=') && !modifiedSvg.includes('stroke:')) {
      // Add stroke to common SVG shape elements
      modifiedSvg = modifiedSvg.replace(/<path(?![^>]*stroke)/gi, `<path stroke="${color}" stroke-width="1"`);
      modifiedSvg = modifiedSvg.replace(/<rect(?![^>]*stroke)/gi, `<rect stroke="${color}" stroke-width="1"`);
      modifiedSvg = modifiedSvg.replace(/<circle(?![^>]*stroke)/gi, `<circle stroke="${color}" stroke-width="1"`);
      modifiedSvg = modifiedSvg.replace(/<ellipse(?![^>]*stroke)/gi, `<ellipse stroke="${color}" stroke-width="1"`);
      modifiedSvg = modifiedSvg.replace(/<polygon(?![^>]*stroke)/gi, `<polygon stroke="${color}" stroke-width="1"`);
      modifiedSvg = modifiedSvg.replace(/<polyline(?![^>]*stroke)/gi, `<polyline stroke="${color}" stroke-width="1"`);
      modifiedSvg = modifiedSvg.replace(/<line(?![^>]*stroke)/gi, `<line stroke="${color}" stroke-width="1"`);
    }
    
    return modifiedSvg;
  };

  const downloadAllSVGs = async (order) => {
    if (!order.stencilData?.storageUrls) {
      alert('No SVG files found for this order');
      return;
    }
    
    const svgLayers = order.stencilData.storageUrls.filter(layer => layer.svgUrl);
    if (svgLayers.length === 0) {
      alert('No SVG files found for this order');
      return;
    }

    // Set downloading state immediately
    setDownloadingOrder(order.id);
    setDownloadProgress({ current: 0, total: svgLayers.length });
    setFunMessage(0);
    
    // Track start time to ensure minimum display duration
    const startTime = Date.now();
    const MIN_DISPLAY_TIME = 2000; // Minimum 2 seconds to show overlay

    try {
      // Create a new ZIP file
      const zip = new JSZip();
      const orderName = order.shippingAddress?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'order';
      const folderName = `${orderName}_${order.id.substring(0, 8)}`;
      
      let successCount = 0;
      
      // Fetch all SVG files using proxy (to avoid CORS issues)
      for (let i = 0; i < svgLayers.length; i++) {
        const layer = svgLayers[i];
        const fileName = layer.svgFileName || `layer-${i + 1}.svg`;
        
        // Update progress
        setDownloadProgress({ current: i + 1, total: svgLayers.length });
        
        // Small delay between files to show progress animation
        await new Promise(resolve => setTimeout(resolve, 300));
        
        try {
          // Always use proxy to avoid CORS issues with Firebase Storage
          const proxyUrl = `/api/download-proxy?url=${encodeURIComponent(layer.svgUrl)}`;
          const response = await fetch(proxyUrl);
          
          if (response.ok) {
            let svgContent = await response.text();
            
            // Assign a unique color to this layer for LightBurn
            svgContent = assignLayerColor(svgContent, i);
            
            zip.file(fileName, svgContent);
            successCount++;
          } else {
            console.error(`Failed to fetch layer ${i + 1}: HTTP ${response.status}`);
          }
        } catch (error) {
          console.error(`Failed to fetch layer ${i + 1}:`, error);
        }
      }

      if (successCount === 0) {
        alert('Failed to download any SVG files. Please check your connection and try again.');
        setDownloadingOrder(null);
        setDownloadProgress({ current: 0, total: 0 });
        return;
      }

      // Generate the ZIP file and trigger download
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${folderName}_stencils.zip`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
      }, 100);
      
      // Ensure minimum display time for the overlay
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_DISPLAY_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_DISPLAY_TIME - elapsed));
      }
      
    } catch (error) {
      console.error('Failed to create ZIP:', error);
      alert('Failed to create ZIP file. Please try downloading files individually.');
    } finally {
      // Clear downloading state
      setDownloadingOrder(null);
      setDownloadProgress({ current: 0, total: 0 });
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    setUpdatingStatus(orderId);
    try {
      const orderRef = dbRef(db, `madeOrders/${orderId}`);
      await update(orderRef, { 
        status: newStatus,
        updatedAt: Date.now(),
        ...(newStatus === 'shipped' ? { shippedAt: Date.now() } : {}),
        ...(newStatus === 'delivered' ? { deliveredAt: Date.now() } : {})
      });
    } catch (error) {
      console.error('Failed to update order status:', error);
      alert('Failed to update order status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleOrderExpanded = (orderId) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  // Filter and sort orders
  const filteredOrders = orders
    .filter(order => {
      // Status filter
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesId = order.id.toLowerCase().includes(query);
        const matchesName = order.shippingAddress?.name?.toLowerCase().includes(query);
        const matchesEmail = order.shippingAddress?.email?.toLowerCase().includes(query);
        const matchesPostcode = order.shippingAddress?.postcode?.toLowerCase().includes(query);
        return matchesId || matchesName || matchesEmail || matchesPostcode;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return (b.createdAt || 0) - (a.createdAt || 0);
        case 'oldest':
          return (a.createdAt || 0) - (b.createdAt || 0);
        case 'price-high':
          return (b.stencilData?.pricing?.total || 0) - (a.stencilData?.pricing?.total || 0);
        case 'price-low':
          return (a.stencilData?.pricing?.total || 0) - (b.stencilData?.pricing?.total || 0);
        default:
          return 0;
      }
    });

  // Calculate stats
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing' || o.status === 'cutting').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    totalRevenue: orders.reduce((sum, o) => sum + (parseFloat(o.stencilData?.pricing?.total) || 0), 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader className="h-10 w-10 animate-spin text-fuchsia-600 mx-auto mb-3" />
          <p className="text-zinc-500">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Download Overlay */}
      {downloadingOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-md mx-4 shadow-2xl border border-zinc-200 dark:border-zinc-800">
            {/* Animated Icon */}
            <div className="relative w-24 h-24 mx-auto mb-6">
              {/* Outer spinning ring */}
              <div className="absolute inset-0 rounded-full border-4 border-fuchsia-200 dark:border-fuchsia-900"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-fuchsia-500 animate-spin"></div>
              {/* Inner pulsing circle */}
              <div className="absolute inset-3 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 animate-pulse flex items-center justify-center">
                <Layers className="h-8 w-8 text-white" />
              </div>
              {/* Orbiting dots */}
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s' }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-fuchsia-400 rounded-full"></div>
              </div>
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s', animationDelay: '1s' }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-purple-400 rounded-full"></div>
              </div>
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s', animationDelay: '2s' }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-pink-400 rounded-full"></div>
              </div>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-center text-zinc-900 dark:text-white mb-2">
              Preparing Your Stencils
            </h3>

            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-zinc-500 mb-2">
                <span>Processing layers...</span>
                <span className="font-medium text-fuchsia-600">
                  {downloadProgress.current}/{downloadProgress.total}
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500 h-full transition-all duration-500 ease-out relative"
                  style={{ width: `${downloadProgress.total > 0 ? (downloadProgress.current / downloadProgress.total) * 100 : 0}%` }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                </div>
              </div>
            </div>

            {/* Fun rotating message */}
            <div className="min-h-[48px] flex items-center justify-center">
              <p 
                key={funMessage} 
                className="text-sm text-zinc-600 dark:text-zinc-400 text-center italic animate-fadeIn"
              >
                "{FUN_MESSAGES[funMessage]}"
              </p>
            </div>

            {/* Layer colors preview */}
            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <p className="text-xs text-zinc-500 text-center mb-2">Assigning LightBurn colors:</p>
              <div className="flex justify-center gap-1">
                {LIGHTBURN_COLORS.slice(0, Math.min(downloadProgress.total, 8)).map((color, idx) => (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 border-white dark:border-zinc-800 shadow-sm transition-all duration-300 ${
                      idx < downloadProgress.current ? 'scale-100 opacity-100' : 'scale-75 opacity-40'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-5 w-5 text-zinc-500" />
            <span className="text-xs text-zinc-500 font-medium">Total Orders</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.total}</p>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-yellow-200 dark:border-yellow-900/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            <span className="text-xs text-yellow-600 font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-blue-200 dark:border-blue-900/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Loader className="h-5 w-5 text-blue-500" />
            <span className="text-xs text-blue-600 font-medium">Processing</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-indigo-200 dark:border-indigo-900/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="h-5 w-5 text-indigo-500" />
            <span className="text-xs text-indigo-600 font-medium">Shipped</span>
          </div>
          <p className="text-2xl font-bold text-indigo-600">{stats.shipped}</p>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-green-200 dark:border-green-900/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-xs text-green-600 font-medium">Delivered</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
        </div>
        
        <div className="bg-gradient-to-br from-fuchsia-500 to-purple-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-5 w-5 text-white/80" />
            <span className="text-xs text-white/80 font-medium">Revenue</span>
          </div>
          <p className="text-2xl font-bold">£{stats.totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order ID, name, or postcode..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
            />
          </div>
          
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-zinc-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-fuchsia-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="cutting">Cutting</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-fuchsia-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="price-high">Price: High to Low</option>
            <option value="price-low">Price: Low to High</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <Package className="h-16 w-16 text-zinc-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
            {searchQuery || statusFilter !== 'all' ? 'No Orders Found' : 'No Orders Yet'}
          </h3>
          <p className="text-zinc-500 text-sm">
            {searchQuery || statusFilter !== 'all' 
              ? 'Try adjusting your search or filters' 
              : 'Orders will appear here when customers make purchases'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrders.has(order.id);
            const statusInfo = ORDER_STATUSES[order.status] || ORDER_STATUSES.pending;
            const StatusIcon = statusInfo.icon;
            
            return (
              <div
                key={order.id}
                className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Order Header */}
                <div 
                  className="p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  onClick={() => toggleOrderExpanded(order.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Status Badge */}
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${statusInfo.color}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        <span className="text-xs font-semibold">{statusInfo.label}</span>
                      </div>
                      
                      {/* Order Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-zinc-900 dark:text-white">
                            #{order.id.substring(0, 8)}
                          </h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(order.id, order.id);
                            }}
                            className="text-zinc-400 hover:text-zinc-600"
                          >
                            {copiedId === order.id ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(order.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {order.shippingAddress?.name || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {/* Price */}
                      <div className="text-right">
                        <p className="text-lg font-bold text-fuchsia-600">
                          £{order.stencilData?.pricing?.total || '0.00'}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {order.stencilData?.numStencils || 0} layers
                        </p>
                      </div>
                      
                      {/* Expand Button */}
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-zinc-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-zinc-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-800/30">
                    <div className="grid md:grid-cols-3 gap-6">
                      {/* Customer & Shipping Info */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-fuchsia-500" />
                          Shipping Address
                        </h4>
                        <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 space-y-2 text-sm">
                          <p className="font-medium text-zinc-900 dark:text-white">
                            {order.shippingAddress?.name}
                          </p>
                          <p className="text-zinc-600 dark:text-zinc-400">
                            {order.shippingAddress?.addressLine1}
                          </p>
                          {order.shippingAddress?.addressLine2 && (
                            <p className="text-zinc-600 dark:text-zinc-400">
                              {order.shippingAddress?.addressLine2}
                            </p>
                          )}
                          <p className="text-zinc-600 dark:text-zinc-400">
                            {order.shippingAddress?.city}
                          </p>
                          <p className="font-medium text-zinc-900 dark:text-white">
                            {order.shippingAddress?.postcode}
                          </p>
                          {order.shippingAddress?.country && (
                            <p className="text-zinc-600 dark:text-zinc-400">
                              {order.shippingAddress?.country}
                            </p>
                          )}
                          {order.shippingAddress?.phone && (
                            <p className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                              <Phone className="h-3 w-3" />
                              {order.shippingAddress?.phone}
                            </p>
                          )}
                        </div>

                        {/* Quick Copy Address */}
                        <button
                          onClick={() => {
                            const addr = order.shippingAddress;
                            const fullAddress = `${addr?.name}\n${addr?.addressLine1}${addr?.addressLine2 ? '\n' + addr?.addressLine2 : ''}\n${addr?.city}\n${addr?.postcode}${addr?.country ? '\n' + addr?.country : ''}`;
                            copyToClipboard(fullAddress, `addr-${order.id}`);
                          }}
                          className="w-full text-xs px-3 py-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-lg text-zinc-700 dark:text-zinc-300 flex items-center justify-center gap-1 transition-colors"
                        >
                          {copiedId === `addr-${order.id}` ? (
                            <>
                              <Check className="h-3 w-3 text-green-500" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copy Address
                            </>
                          )}
                        </button>
                      </div>

                      {/* Order Details & Pricing */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                          <FileText className="h-4 w-4 text-fuchsia-500" />
                          Order Details
                        </h4>
                        <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Stencil Layers</span>
                            <span className="font-medium text-zinc-900 dark:text-white">
                              {order.stencilData?.numStencils || 0}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Layer Mode</span>
                            <span className="font-medium text-zinc-900 dark:text-white capitalize">
                              {order.stencilData?.layerMode || 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Stencil Mode</span>
                            <span className="font-medium text-zinc-900 dark:text-white capitalize">
                              {order.stencilData?.stencilMode || 'standard'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Original File</span>
                            <span className="font-medium text-zinc-900 dark:text-white text-xs truncate max-w-[140px]">
                              {order.stencilData?.originalImageName || 'N/A'}
                            </span>
                          </div>
                          
                          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-2 mt-2 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-zinc-500">Stencil Price</span>
                              <span>£{order.stencilData?.pricing?.stencilPrice || '0.00'}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-zinc-500">Shipping</span>
                              <span>£{order.stencilData?.pricing?.shippingPrice || '0.00'}</span>
                            </div>
                            <div className="flex justify-between font-bold text-fuchsia-600 pt-1">
                              <span>Total</span>
                              <span>£{order.stencilData?.pricing?.total || '0.00'}</span>
                            </div>
                          </div>
                        </div>

                        {/* PayPal Order ID */}
                        {order.paypalOrderId && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">PayPal Order ID</p>
                            <p className="text-xs font-mono text-blue-800 dark:text-blue-300 break-all">
                              {order.paypalOrderId}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Downloads & Actions */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                          <Download className="h-4 w-4 text-fuchsia-500" />
                          Downloads & Actions
                        </h4>
                        
                        {/* Download All Button */}
                        <button
                          onClick={() => downloadAllSVGs(order)}
                          disabled={downloadingOrder === order.id}
                          className={`w-full px-4 py-3 ${
                            downloadingOrder === order.id 
                              ? 'bg-zinc-400 cursor-wait' 
                              : 'bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700 shadow-lg shadow-fuchsia-500/20'
                          } text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2`}
                        >
                          {downloadingOrder === order.id ? (
                            <>
                              <Loader className="h-4 w-4 animate-spin" />
                              <span>
                                Preparing ZIP... {downloadProgress.current}/{downloadProgress.total} files
                              </span>
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4" />
                              Download All SVGs (ZIP)
                            </>
                          )}
                        </button>
                        
                        {/* Progress bar when downloading */}
                        {downloadingOrder === order.id && (
                          <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-fuchsia-500 to-purple-600 h-full transition-all duration-300 ease-out"
                              style={{ width: `${downloadProgress.total > 0 ? (downloadProgress.current / downloadProgress.total) * 100 : 0}%` }}
                            />
                          </div>
                        )}

                        {/* Individual Layers */}
                        {order.stencilData?.storageUrls && (
                          <div className="grid grid-cols-4 gap-2">
                            {order.stencilData.storageUrls.map((layer, index) => (
                              <button
                                key={index}
                                onClick={() => downloadFile(layer.svgUrl, layer.svgFileName || `layer-${index + 1}.svg`)}
                                className="group relative aspect-square bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-fuchsia-500 transition-colors flex items-center justify-center"
                                title={`Download Layer ${index + 1}`}
                              >
                                <Layers className="h-5 w-5 text-zinc-400 group-hover:text-fuchsia-500 transition-colors" />
                                <span className="absolute bottom-1 text-[10px] font-medium text-zinc-500">
                                  {index + 1}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Paint Colors Guide */}
                        {order.stencilData?.layerColors && order.stencilData.layerColors.length > 0 && (
                          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
                            <h5 className="text-xs font-semibold text-orange-800 dark:text-orange-300 mb-2 flex items-center gap-1">
                              <Palette className="h-3 w-3" />
                              Customer Paint Colors
                            </h5>
                            <div className="grid grid-cols-2 gap-1">
                              {order.stencilData.layerColors.map((lc, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 text-xs">
                                  <div
                                    className="w-4 h-4 rounded border border-zinc-300 flex-shrink-0"
                                    style={{ backgroundColor: lc.color?.hex || '#888' }}
                                  />
                                  <span className="text-zinc-700 dark:text-zinc-300 truncate">
                                    L{lc.layerIndex + 1}: {lc.color?.name || 'Color'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* LightBurn Layer Colors Guide */}
                        {order.stencilData?.storageUrls && order.stencilData.storageUrls.length > 0 && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                            <h5 className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1">
                              <Layers className="h-3 w-3" />
                              LightBurn Layer Colors (in ZIP)
                            </h5>
                            <div className="grid grid-cols-2 gap-1">
                              {order.stencilData.storageUrls.map((_, idx) => {
                                const lightburnColors = ['#FF0000', '#00FF00', '#0000FF', '#FF00FF', '#00FFFF', '#FFFF00', '#FF8000', '#8000FF', '#00FF80', '#FF0080'];
                                const colorNames = ['Red', 'Green', 'Blue', 'Magenta', 'Cyan', 'Yellow', 'Orange', 'Purple', 'Spring Green', 'Pink'];
                                return (
                                  <div key={idx} className="flex items-center gap-1.5 text-xs">
                                    <div
                                      className="w-4 h-4 rounded border border-zinc-300 flex-shrink-0"
                                      style={{ backgroundColor: lightburnColors[idx % lightburnColors.length] }}
                                    />
                                    <span className="text-zinc-700 dark:text-zinc-300 truncate">
                                      Layer {idx + 1}: {colorNames[idx % colorNames.length]}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-2">
                              Each layer will be a separate color in LightBurn
                            </p>
                          </div>
                        )}

                        {/* Status Update */}
                        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3">
                          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                            Update Status
                          </label>
                          <select
                            value={order.status}
                            onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                            disabled={updatingStatus === order.id}
                            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-fuchsia-500"
                          >
                            <option value="pending">📋 Pending</option>
                            <option value="processing">⚙️ Processing</option>
                            <option value="cutting">✂️ Cutting</option>
                            <option value="shipped">📦 Shipped</option>
                            <option value="delivered">✅ Delivered</option>
                            <option value="cancelled">❌ Cancelled</option>
                          </select>
                          {updatingStatus === order.id && (
                            <p className="text-xs text-fuchsia-600 mt-1 flex items-center gap-1">
                              <Loader className="h-3 w-3 animate-spin" />
                              Updating...
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
