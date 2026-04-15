import React, { useState, useEffect } from 'react';
import { ref as dbRef, onValue, query } from 'firebase/database';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../shared/Header';
import { 
  Package, 
  Calendar, 
  Layers,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Loader,
  Truck,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Smartphone
} from 'lucide-react';

const MyOrders = () => {
  const { user, currentUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);

  // Get the authenticated user's UID
  const uid = currentUser?.uid || user?.uid;

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    // Listen to user's stencilOrders AND pbnOrders nodes in Firebase
    const stencilRef = dbRef(db, `users/${uid}/stencilOrders`);
    const pbnRef = dbRef(db, `users/${uid}/pbnOrders`);

    let stencilOrders = [];
    let pbnOrders = [];
    let stencilLoaded = false;
    let pbnLoaded = false;

    const mergeAndSet = () => {
      if (!stencilLoaded || !pbnLoaded) return;
      const all = [...stencilOrders, ...pbnOrders];
      all.sort((a, b) => {
        const timeA = a.timestamp || a.createdAt || 0;
        const timeB = b.timestamp || b.createdAt || 0;
        return timeB - timeA;
      });
      setOrders(all);
      setLoading(false);
    };

    const unsubStencil = onValue(query(stencilRef), (snapshot) => {
      stencilOrders = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          stencilOrders.push({ id: child.key, orderType: 'stencil', ...child.val() });
        });
      }
      stencilLoaded = true;
      mergeAndSet();
    });

    const unsubPbn = onValue(query(pbnRef), (snapshot) => {
      pbnOrders = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          pbnOrders.push({ id: child.key, orderType: 'pbn', ...child.val() });
        });
      }
      pbnLoaded = true;
      mergeAndSet();
    });

    return () => { unsubStencil(); unsubPbn(); };
  }, [uid]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Invalid Date';
    return new Date(timestamp).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper to get the order date from either timestamp or createdAt field
  const getOrderDate = (order) => {
    return order.timestamp || order.createdAt || null;
  };

  // Helper to get storageUrls from either location (handles old and new data structure)
  const getStorageUrls = (order) => {
    return order.stencilData?.storageUrls || order.storageUrls || [];
  };

  // Helper to get number of layers
  const getLayerCount = (order) => {
    const urls = getStorageUrls(order);
    return order.stencilData?.numStencils || urls.length || order.numStencils || 0;
  };

  // Helper to get pricing
  const getPricing = (order) => {
    return order.stencilData?.pricing || order.pricing || {};
  };

  // Helper to get layer colors
  const getLayerColors = (order) => {
    return order.stencilData?.layerColors || order.paintingGuide?.layerColors || [];
  };

  // Helper to check if order is a PBN product
  const isPbnOrder = (order) => {
    return order.orderType === 'pbn';
  };

  // Helper to check if order is an acrylic/LED product
  const isAcrylicOrder = (order) => {
    return order.productType === 'acrylic' || order.id?.startsWith('ACRYLIC-');
  };

  // Helper to get product display name
  const getProductName = (order) => {
    if (isAcrylicOrder(order)) {
      return order.productName || 'Side-Lit Acrylic Lamp';
    }
    if (isPbnOrder(order)) {
      return order.productLabel || 'Paint-by-Numbers Kit';
    }
    return 'Custom Stencil Set';
  };

  // Helper to get order thumbnail
  const getOrderThumbnail = (order) => {
    if (isAcrylicOrder(order)) {
      return order.designImageUrl || null;
    }
    if (isPbnOrder(order)) {
      return order.metadata?.originalImageUrl || null;
    }
    return order.stencilData?.originalImageUrl || null;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
      case 'completed':
        return (
          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium rounded-full flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" />
            Paid
          </span>
        );
      case 'processing':
        return (
          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-medium rounded-full flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Processing
          </span>
        );
      case 'shipped':
        return (
          <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-sm font-medium rounded-full flex items-center gap-1">
            <Truck className="h-4 w-4" />
            Shipped
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400 text-sm font-medium rounded-full flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {status || 'Pending'}
          </span>
        );
    }
  };

  // Not logged in state
  if (!uid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <Header currentPage="my-orders" />
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-12 text-center">
            <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Please Log In
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You need to be logged in to view your orders
            </p>
            <a 
              href="/#login" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
            >
              Log In to Your Account
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <Header currentPage="my-orders" />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <Loader className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading your orders...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Header currentPage="my-orders" />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Package className="h-8 w-8 text-purple-600" />
            My Orders
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            View your stencils, paint-by-numbers and acrylic lamp orders
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Orders Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You haven't purchased any stencils yet. Create your first stencil now!
            </p>
            <a 
              href="/tools/stencil-generator" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
            >
              <Layers className="h-5 w-5" />
              Create Stencils
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Order Count */}
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg px-4 py-3">
              <p className="text-purple-800 dark:text-purple-300 font-medium">
                📦 You have {orders.length} order{orders.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Orders List */}
            {orders.map((order) => (
              <div
                key={order.id}
                className={`bg-white dark:bg-slate-800 rounded-xl shadow-lg border overflow-hidden hover:shadow-xl transition-shadow ${
                  isAcrylicOrder(order) 
                    ? 'border-cyan-200 dark:border-cyan-800' 
                    : 'border-gray-200 dark:border-slate-700'
                }`}
              >
                {/* Order Header - Always visible */}
                <div 
                  className="p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Order thumbnail - different styling for acrylic vs stencil */}
                      {getOrderThumbnail(order) ? (
                        <div className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center ${
                          isAcrylicOrder(order) 
                            ? 'bg-gradient-to-br from-cyan-100 to-purple-100 dark:from-cyan-900/30 dark:to-purple-900/30' 
                            : 'bg-gray-100 dark:bg-slate-700'
                        }`}>
                          <img 
                            src={getOrderThumbnail(order)} 
                            alt="Order preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.innerHTML = isAcrylicOrder(order)
                                ? '<div class="w-full h-full flex items-center justify-center"><svg class="h-8 w-8 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg></div>'
                                : '<div class="w-full h-full flex items-center justify-center"><svg class="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>';
                            }}
                          />
                        </div>
                      ) : (
                        <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${
                          isAcrylicOrder(order)
                            ? 'bg-gradient-to-br from-cyan-100 to-purple-100 dark:from-cyan-900/30 dark:to-purple-900/30'
                            : 'bg-gray-100 dark:bg-slate-700'
                        }`}>
                          {isAcrylicOrder(order) ? (
                            <Lightbulb className="h-8 w-8 text-cyan-500" />
                          ) : (
                            <Layers className="h-8 w-8 text-gray-400" />
                          )}
                        </div>
                      )}
                      
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {getProductName(order)}
                          </h3>
                          {isPbnOrder(order) && (
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-full">
                              PBN
                            </span>
                          )}
                          {isAcrylicOrder(order) && (
                            <span className="px-2 py-0.5 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 text-xs font-medium rounded-full">
                              LED Lamp
                            </span>
                          )}
                          {getStatusBadge(order.status || 'paid')}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(getOrderDate(order))}
                          </span>
                          {!isAcrylicOrder(order) && !isPbnOrder(order) && (
                            <span className="flex items-center gap-1">
                              <Layers className="h-4 w-4" />
                              {getLayerCount(order) || '?'} layers
                            </span>
                          )}
                          {isPbnOrder(order) && (
                            <span className="flex items-center gap-1">
                              <ImageIcon className="h-4 w-4" />
                              {order.metadata?.numColors || order.paletteColours || '?'} colours
                            </span>
                          )}
                          {isAcrylicOrder(order) && (
                            <span className="flex items-center gap-1">
                              <Smartphone className="h-4 w-4" />
                              App Controlled
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Total Price */}
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          isAcrylicOrder(order) 
                            ? 'text-cyan-600 dark:text-cyan-400' 
                            : 'text-purple-600 dark:text-purple-400'
                        }`}>
                          £{getPricing(order).total || order.total || '?.??'}
                        </div>
                      </div>
                      
                      {/* Expand/Collapse Icon */}
                      {expandedOrder === order.id ? (
                        <ChevronUp className="h-6 w-6 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-6 w-6 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Order Details */}
                {expandedOrder === order.id && (
                  <div className="border-t border-gray-200 dark:border-slate-700 p-6 bg-gray-50 dark:bg-slate-900/50">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Order Details */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <FileText className={`h-5 w-5 ${isAcrylicOrder(order) ? 'text-cyan-600' : 'text-purple-600'}`} />
                          Order Details
                        </h4>
                        
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 space-y-3 border border-gray-200 dark:border-slate-700">
                          {/* Order ID */}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Order ID</span>
                            <span className="font-mono text-xs text-gray-900 dark:text-white">
                              {order.id.substring(0, 16)}
                            </span>
                          </div>

                          {/* Acrylic-specific details */}
                          {isAcrylicOrder(order) ? (
                            <>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Product</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {order.productName || 'Side-Lit Acrylic Lamp'}
                                </span>
                              </div>
                              
                              {order.metadata?.productSize && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">Size</span>
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {order.metadata.productSize}
                                  </span>
                                </div>
                              )}

                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">LED Base</span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                  RGB Color Changing
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Stencil-specific details */}
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Stencil Layers</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {getLayerCount(order) || '?'}
                                </span>
                              </div>

                              {order.stencilData?.layerMode && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">Layer Mode</span>
                                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                                    {order.stencilData.layerMode}
                                  </span>
                                </div>
                              )}

                              {order.stencilData?.stencilMode && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">Stencil Mode</span>
                                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                                    {order.stencilData.stencilMode}
                                  </span>
                                </div>
                              )}

                              {order.stencilData?.stencilSize && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">Size</span>
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {order.stencilData.stencilSize}
                                  </span>
                                </div>
                              )}

                              {order.stencilData?.originalImageName && (
                                <div className="flex items-center justify-between text-sm pt-3 border-t border-gray-200 dark:border-slate-600">
                                  <span className="text-gray-600 dark:text-gray-400">Original File</span>
                                  <span className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[180px]">
                                    {order.stencilData.originalImageName}
                                  </span>
                                </div>
                              )}
                            </>
                          )}

                          {order.paypalOrderId && (
                            <div className="flex items-center justify-between text-sm pt-3 border-t border-gray-200 dark:border-slate-600">
                              <span className="text-gray-600 dark:text-gray-400">PayPal ID</span>
                              <span className="font-mono text-xs text-gray-900 dark:text-white">
                                {order.paypalOrderId.substring(0, 16)}...
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Shipping Address */}
                        {order.shippingAddress && (
                          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
                            <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                              <Truck className="h-4 w-4 text-purple-600" />
                              Shipping To
                            </h5>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              <p className="font-medium text-gray-900 dark:text-white">{order.shippingAddress.name}</p>
                              <p>{order.shippingAddress.addressLine1}</p>
                              {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                              <p>{order.shippingAddress.city}, {order.shippingAddress.postcode}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Product Info - Different for Acrylic vs Stencil */}
                      <div className="space-y-4">
                        {isAcrylicOrder(order) ? (
                          <>
                            <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                              <Lightbulb className="h-5 w-5 text-cyan-600" />
                              Your Acrylic Lamp
                            </h4>

                            {/* Acrylic product being shipped */}
                            <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4">
                              <div className="flex items-start gap-2">
                                <Truck className="h-5 w-5 text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-cyan-800 dark:text-cyan-300">
                                    Your Lamp is Being Prepared
                                  </p>
                                  <p className="text-xs text-cyan-700 dark:text-cyan-400 mt-1">
                                    Your custom laser-engraved acrylic lamp with RGB LED base is being crafted. You'll receive tracking info once it ships.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* App Control Info */}
                            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                              <div className="flex items-start gap-2">
                                <Smartphone className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                                    Control with the Fotonix App
                                  </p>
                                  <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                                    Download the Fotonix app to control your lamp's LED colors, brightness, and effects once it arrives.
                                  </p>
                                  <a 
                                    href={order.metadata?.appLink || 'https://fotonix.co.uk/app'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
                                  >
                                    <Smartphone className="h-3 w-3" />
                                    Get the App
                                  </a>
                                </div>
                              </div>
                            </div>

                            {/* Design Preview if available */}
                            {order.designImageUrl && (
                              <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
                                <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                  <ImageIcon className="h-4 w-4" />
                                  Your Design
                                </h5>
                                <img 
                                  src={order.designImageUrl} 
                                  alt="Your lamp design"
                                  className="w-full max-w-[200px] mx-auto rounded-lg border border-gray-200 dark:border-slate-600"
                                />
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                              <Layers className="h-5 w-5 text-purple-600" />
                              Your Stencils
                            </h4>

                            {/* Show different message based on whether it's a free or paid order */}
                            {order.id.startsWith('FREE-APP') || order.status === 'free_app_access' || order.status === 'free_lead' ? (
                              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                                <div className="flex items-start gap-2">
                                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-sm font-medium text-green-800 dark:text-green-300">
                                      Digital Stencils Ready
                                    </p>
                                    <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                                      Your stencil files are available in the Fotonix app. Open the app and go to "My Orders" to view your color guide and SVG files.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <div className="flex items-start gap-2">
                                  <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                                      Physical Stencils Being Shipped
                                    </p>
                                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                                      Your custom laser-cut stencils are being prepared and will be shipped to your address. You'll receive a tracking number once dispatched.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Color Guide - Only for stencil orders */}
                            {getLayerColors(order).length > 0 && (
                              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                                <h5 className="text-sm font-semibold text-orange-900 dark:text-orange-300 mb-3 flex items-center gap-2">
                                  <ImageIcon className="h-4 w-4" />
                                  Paint Colors ({getLayerColors(order).length} layers)
                                </h5>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                  {getLayerColors(order).map((lc) => (
                                    <div key={lc.layerIndex} className="flex items-center gap-2 text-xs">
                                      <div
                                        className="w-5 h-5 rounded border border-gray-300 dark:border-slate-600 flex-shrink-0"
                                        style={{ backgroundColor: lc.color?.hex || '#888' }}
                                      />
                                      <span className="text-gray-700 dark:text-gray-300 font-medium truncate">
                                        L{lc.layerIndex + 1}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create More Stencils CTA */}
        {orders.length > 0 && (
          <div className="mt-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white text-center">
            <h3 className="text-xl font-bold mb-2">Create More Stencils</h3>
            <p className="text-white/90 mb-4">Turn any image into professional multi-layer stencils</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a 
                href="/tools/stencil-generator" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition-all font-semibold shadow-lg"
              >
                <Layers className="h-5 w-5" />
                Stencil Generator
              </a>
              <a 
                href="/tools/paint-by-numbers" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-amber-600 rounded-lg hover:bg-gray-100 transition-all font-semibold shadow-lg"
              >
                🖌️ PaintYourPhoto
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyOrders;
