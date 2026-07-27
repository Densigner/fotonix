import React, { useState, useEffect } from 'react';
import { ref as dbRef, onValue, query, orderByChild, update } from 'firebase/database';
import { db } from '../../firebase';
import { API_URL } from '../../config/environment';
import { 
  Package, 
  Download, 
  MapPin, 
  Phone, 
  User, 
  Calendar, 
  Layers,
  DollarSign,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Loader,
  Truck,
  Send,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';

// Courier options with tracking URL templates
const COURIERS = [
  { id: 'royal-mail', name: 'Royal Mail', trackingUrl: 'https://www.royalmail.com/track-your-item#/tracking-results/{tracking}' },
  { id: 'royal-mail-signed', name: 'Royal Mail Signed For', trackingUrl: 'https://www.royalmail.com/track-your-item#/tracking-results/{tracking}' },
  { id: 'parcelforce', name: 'Parcelforce', trackingUrl: 'https://www.parcelforce.com/track-trace?trackNumber={tracking}' },
  { id: 'dhl', name: 'DHL', trackingUrl: 'https://www.dhl.com/gb-en/home/tracking.html?tracking-id={tracking}' },
  { id: 'dpd', name: 'DPD', trackingUrl: 'https://www.dpd.co.uk/tracking/quicktrack?search={tracking}' },
  { id: 'hermes', name: 'Evri (Hermes)', trackingUrl: 'https://www.evri.com/track-a-parcel/{tracking}' },
  { id: 'ups', name: 'UPS', trackingUrl: 'https://www.ups.com/track?tracknum={tracking}' },
  { id: 'fedex', name: 'FedEx', trackingUrl: 'https://www.fedex.com/fedextrack/?trknbr={tracking}' },
  { id: 'yodel', name: 'Yodel', trackingUrl: 'https://www.yodel.co.uk/track/{tracking}' },
  { id: 'other', name: 'Other', trackingUrl: '' }
];

const MadeOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [trackingInputs, setTrackingInputs] = useState({}); // { orderId: { courier: '', trackingNumber: '', notes: '' } }
  const [sendingEmail, setSendingEmail] = useState(null); // orderId currently sending
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    // Listen to madeOrders node in Firebase
    const ordersRef = dbRef(db, 'madeOrders');
    const ordersQuery = query(ordersRef, orderByChild('createdAt'));

    const unsubscribe = onValue(ordersQuery, (snapshot) => {
      if (snapshot.exists()) {
        const ordersData = [];
        snapshot.forEach((childSnapshot) => {
          ordersData.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
        // Sort by newest first
        ordersData.sort((a, b) => b.createdAt - a.createdAt);
        setOrders(ordersData);
        
        // Initialize tracking inputs for orders that don't have tracking yet
        const inputs = {};
        ordersData.forEach(order => {
          if (!order.shipping?.posted) {
            inputs[order.id] = {
              courier: order.shipping?.courier || '',
              trackingNumber: order.shipping?.trackingNumber || '',
              notes: order.shipping?.notes || ''
            };
          }
        });
        setTrackingInputs(prev => ({ ...prev, ...inputs }));
      } else {
        setOrders([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const downloadSVG = (url, fileName) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    a.click();
  };

  const downloadAllSVGs = (order) => {
    order.stencilData.storageUrls.forEach((layer, index) => {
      setTimeout(() => {
        downloadSVG(layer.svgUrl, layer.svgFileName);
      }, index * 200);
    });
  };

  const updateTrackingInput = (orderId, field, value) => {
    setTrackingInputs(prev => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value
      }
    }));
  };

  const getTrackingUrl = (courierId, trackingNumber) => {
    const courier = COURIERS.find(c => c.id === courierId);
    if (!courier || !courier.trackingUrl || !trackingNumber) return null;
    return courier.trackingUrl.replace('{tracking}', encodeURIComponent(trackingNumber));
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const markAsPosted = async (order) => {
    const tracking = trackingInputs[order.id];
    if (!tracking?.courier) {
      alert('Please select a courier');
      return;
    }

    setSendingEmail(order.id);

    try {
      const courierInfo = COURIERS.find(c => c.id === tracking.courier);
      const trackingUrl = getTrackingUrl(tracking.courier, tracking.trackingNumber);
      
      const shippingData = {
        posted: true,
        postedAt: Date.now(),
        courier: tracking.courier,
        courierName: courierInfo?.name || tracking.courier,
        trackingNumber: tracking.trackingNumber || '',
        trackingUrl: trackingUrl || '',
        notes: tracking.notes || ''
      };

      // Update Firebase - both madeOrders and user's orders (stencil or pbn)
      const updates = {};
      updates[`madeOrders/${order.id}/shipping`] = shippingData;
      updates[`madeOrders/${order.id}/status`] = 'shipped';
      
      if (order.userId) {
        const orderPath = order.orderType === 'pbn' ? 'pbnOrders' : 'stencilOrders';
        updates[`users/${order.userId}/${orderPath}/${order.id}/shipping`] = shippingData;
        updates[`users/${order.userId}/${orderPath}/${order.id}/status`] = 'shipped';
      }

      await update(dbRef(db), updates);

      // Send email notification to customer
      const emailData = {
        to: order.shippingAddress?.email || order.customerEmail,
        customerName: order.shippingAddress?.name || 'Customer',
        orderId: order.id.substring(0, 8).toUpperCase(),
        courierName: courierInfo?.name || tracking.courier,
        trackingNumber: tracking.trackingNumber || 'Not provided',
        trackingUrl: trackingUrl || '',
        shippingAddress: order.shippingAddress,
        numLayers: order.orderType === 'pbn'
          ? (order.pbnData?.numColors || 0)
          : (order.stencilData?.numStencils || order.stencilData?.storageUrls?.length || 0),
        notes: tracking.notes || ''
      };

      // Call server endpoint to send shipping notification email
      const response = await fetch(`${API_URL}/api/email/shipping-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        console.error('Failed to send email, but order marked as shipped');
      }

      alert(`✅ Order marked as shipped! ${response.ok ? 'Email sent to customer.' : 'Note: Email may not have been sent.'}`);
    } catch (error) {
      console.error('Error marking order as posted:', error);
      alert('Error updating order. Please try again.');
    } finally {
      setSendingEmail(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Package className="h-8 w-8 text-purple-600" />
            Orders
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage and fulfill customer orders
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Orders Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Orders will appear here once customers complete their purchases
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    {/* Order Header */}
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          Order #{order.id.substring(0, 8)}
                        </h3>
                        {order.shipping?.posted ? (
                          <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-sm font-medium rounded-full flex items-center gap-1">
                            <Truck className="h-4 w-4" />
                            Shipped
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-medium rounded-full flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Awaiting Dispatch
                          </span>
                        )}
                        <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium rounded-full flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Paid
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="h-4 w-4" />
                        {formatDate(order.createdAt)}
                      </div>
                    </div>

                    {/* Total Price */}
                    <div className="text-right">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total</div>
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        £{(order.orderType === 'pbn' ? order.pbnData?.pricing?.total : order.stencilData?.pricing?.total) || '?.??'}
                      </div>
                      {order.orderType === 'pbn' && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full font-medium">PBN</span>
                      )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Customer Info */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <User className="h-5 w-5 text-purple-600" />
                        Customer Information
                      </h4>
                      
                      <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-2">
                        <div className="flex items-start gap-2">
                          <User className="h-4 w-4 text-gray-500 mt-0.5" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {order.shippingAddress?.name || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              User ID: {order.userId ? order.userId.substring(0, 12) + '...' : 'N/A'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            <div>{order.shippingAddress?.addressLine1 || ''}</div>
                            {order.shippingAddress?.addressLine2 && (
                              <div>{order.shippingAddress.addressLine2}</div>
                            )}
                            <div>{order.shippingAddress?.city || ''}</div>
                            <div className="font-medium">{order.shippingAddress?.postcode || ''}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            {order.shippingAddress?.phone || '—'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Order Details */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileText className="h-5 w-5 text-purple-600" />
                        Order Details
                      </h4>
                      
                      {order.orderType === 'pbn' ? (
                        /* ── PBN Order Details ────────────────────── */
                        <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Product</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {order.pbnData?.productLabel || order.pbnData?.selectedSize || 'PBN Kit'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Material</span>
                            <span className="font-medium text-gray-900 dark:text-white capitalize">
                              {order.pbnData?.materialType || 'canvas'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Size</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {order.pbnData?.selectedSize || '—'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Colours</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {order.pbnData?.numColors || '—'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Detail Level</span>
                            <span className="font-medium text-gray-900 dark:text-white capitalize">
                              {order.pbnData?.detailLevel || '—'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-sm pt-3 border-t border-gray-200 dark:border-slate-600">
                            <span className="text-gray-600 dark:text-gray-400">PayPal Status</span>
                            <span className="font-mono text-xs text-gray-900 dark:text-white">
                              {order.paypalStatus || '—'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* ── Stencil Order Details ────────────────── */
                        <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Stencil Layers</span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {order.stencilData.numStencils}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Layer Mode</span>
                          <span className="font-medium text-gray-900 dark:text-white capitalize">
                            {order.stencilData.layerMode}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Stencil Mode</span>
                          <span className="font-medium text-gray-900 dark:text-white capitalize">
                            {order.stencilData.stencilMode || 'standard'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Original File</span>
                          <span className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[200px]">
                            {order.stencilData.originalImageName}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm pt-3 border-t border-gray-200 dark:border-slate-600">
                          <span className="text-gray-600 dark:text-gray-400">PayPal Order ID</span>
                          <span className="font-mono text-xs text-gray-900 dark:text-white">
                            {order.paypalOrderId ? order.paypalOrderId.substring(0, 16) + '...' : '—'}
                          </span>
                        </div>
                      </div>
                      )}
                    </div>
                  </div>

                  {/* Download Section */}
                  {order.orderType === 'pbn' ? (
                    /* ── PBN Files ──────────────────────────── */
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                      <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                        <Download className="h-5 w-5 text-purple-600" />
                        Paint-by-Numbers Files
                      </h4>
                      {order.pbnData?.storageUrls?.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {order.pbnData.storageUrls.map((url, index) => (
                            <a
                              key={index}
                              href={typeof url === 'string' ? url : url.svgUrl || url.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group relative bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg p-3 border border-gray-200 dark:border-slate-600 transition-all hover:shadow-md flex flex-col items-center gap-2"
                            >
                              <ImageIcon className="h-8 w-8 text-blue-600" />
                              <div className="text-sm font-medium text-gray-900 dark:text-white">File {index + 1}</div>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No files uploaded for this order.</p>
                      )}

                      {/* PBN Colour Palette */}
                      {order.pbnData?.paletteData?.length > 0 && (
                        <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" />
                            Colour Palette ({order.pbnData.paletteData.length} colours)
                          </h5>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {order.pbnData.paletteData.map((col) => (
                              <div key={col.number} className="flex items-center gap-2 text-xs">
                                <div
                                  className="w-6 h-6 rounded border border-gray-300 dark:border-slate-600 flex-shrink-0"
                                  style={{ backgroundColor: col.hex }}
                                />
                                <span className="text-gray-700 dark:text-gray-300 font-medium">
                                  #{col.number}: {col.name || col.hex}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : order.stencilData?.storageUrls ? (
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <Download className="h-5 w-5 text-purple-600" />
                          LightBurn Files (SVG)
                        </h4>
                        <button
                          onClick={() => downloadAllSVGs(order)}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download All SVGs
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {order.stencilData.storageUrls.map((layer, index) => (
                        <button
                          key={index}
                          onClick={() => downloadSVG(layer.svgUrl, layer.svgFileName)}
                          className="group relative bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg p-3 border border-gray-200 dark:border-slate-600 transition-all hover:shadow-md"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Layers className="h-8 w-8 text-purple-600" />
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              Layer {index + 1}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              SVG
                            </div>
                          </div>
                          <div className="absolute inset-0 bg-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                        </button>
                      ))}
                      </div>

                    {/* Color Guide */}
                    {order.stencilData.layerColors && order.stencilData.layerColors.length > 0 && (
                      <div className="mt-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                        <h5 className="text-sm font-semibold text-orange-900 dark:text-orange-300 mb-3 flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Paint Colors ({order.stencilData.layerColors.length} layers)
                        </h5>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {order.stencilData.layerColors.map((lc) => (
                            <div key={lc.layerIndex} className="flex items-center gap-2 text-xs">
                              <div
                                className="w-6 h-6 rounded border border-gray-300 dark:border-slate-600 flex-shrink-0"
                                style={{ backgroundColor: lc.color.hex }}
                              />
                              <span className="text-gray-700 dark:text-gray-300 font-medium">
                                L{lc.layerIndex + 1}: {lc.color.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    </div>
                  ) : null}

                  {/* Shipping & Tracking Section */}
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                      <Truck className="h-5 w-5 text-purple-600" />
                      Shipping & Tracking
                    </h4>

                    {order.shipping?.posted ? (
                      /* Already Posted - Show shipping details */
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <span className="font-semibold text-green-800 dark:text-green-300">
                            Shipped on {formatDate(order.shipping.postedAt)}
                          </span>
                        </div>
                        
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Courier</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {order.shipping.courierName}
                            </p>
                          </div>
                          
                          {order.shipping.trackingNumber && (
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tracking Number</p>
                              <div className="flex items-center gap-2">
                                <code className="font-mono text-sm bg-white dark:bg-slate-800 px-2 py-1 rounded border border-gray-200 dark:border-slate-600">
                                  {order.shipping.trackingNumber}
                                </code>
                                <button
                                  onClick={() => copyToClipboard(order.shipping.trackingNumber, `track-${order.id}`)}
                                  className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors"
                                  title="Copy tracking number"
                                >
                                  {copiedId === `track-${order.id}` ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4 text-gray-500" />
                                  )}
                                </button>
                                {order.shipping.trackingUrl && (
                                  <a
                                    href={order.shipping.trackingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors"
                                    title="Track package"
                                  >
                                    <ExternalLink className="h-4 w-4 text-blue-500" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {order.shipping.notes && (
                          <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Notes</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{order.shipping.notes}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Not Posted Yet - Show form */
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          <span className="font-semibold text-amber-800 dark:text-amber-300">
                            Awaiting Dispatch
                          </span>
                        </div>
                        
                        <div className="grid sm:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Courier *
                            </label>
                            <select
                              value={trackingInputs[order.id]?.courier || ''}
                              onChange={(e) => updateTrackingInput(order.id, 'courier', e.target.value)}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                            >
                              <option value="">Select courier...</option>
                              {COURIERS.map(courier => (
                                <option key={courier.id} value={courier.id}>
                                  {courier.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Tracking Number
                            </label>
                            <input
                              type="text"
                              value={trackingInputs[order.id]?.trackingNumber || ''}
                              onChange={(e) => updateTrackingInput(order.id, 'trackingNumber', e.target.value)}
                              placeholder="e.g., AB123456789GB"
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                            />
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Notes for Customer (optional)
                          </label>
                          <textarea
                            value={trackingInputs[order.id]?.notes || ''}
                            onChange={(e) => updateTrackingInput(order.id, 'notes', e.target.value)}
                            placeholder="e.g., Package includes extra registration marks, handle with care..."
                            rows={2}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm resize-none"
                          />
                        </div>
                        
                        <button
                          onClick={() => markAsPosted(order)}
                          disabled={sendingEmail === order.id || !trackingInputs[order.id]?.courier}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-semibold transition-all shadow-lg disabled:cursor-not-allowed"
                        >
                          {sendingEmail === order.id ? (
                            <>
                              <Loader className="h-5 w-5 animate-spin" />
                              Sending notification...
                            </>
                          ) : (
                            <>
                              <Send className="h-5 w-5" />
                              Mark as Posted & Notify Customer
                            </>
                          )}
                        </button>
                        
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                          This will send a shipping notification email to the customer
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MadeOrders;
