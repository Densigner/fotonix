import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref as dbRef, get } from 'firebase/database';
import { db } from '../../firebase';
import PayPalButton from '../payments/PayPalButton';
import {
  ShoppingCart,
  Heart,
  Share2,
  Star,
  Truck,
  Shield,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Check,
  Loader,
  Package,
  AlertCircle
} from 'lucide-react';

/**
 * CustomerProductPage - Public facing product page for member products
 * 
 * Displays product details and allows customers to purchase via PayPal
 * The productId and ownerId are passed to PayPal for owner notifications
 */
export default function CustomerProductPage() {
  const { ownerId, productId } = useParams();
  const navigate = useNavigate();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);

  useEffect(() => {
    loadProduct();
  }, [ownerId, productId]);

  async function loadProduct() {
    try {
      setLoading(true);
      setError(null);

      // Products are stored at products/{ownerId}/{productId}
      const productRef = dbRef(db, `products/${ownerId}/${productId}`);
      const snapshot = await get(productRef);

      if (snapshot.exists()) {
        const productData = snapshot.val();
        setProduct({
          id: productId,
          ownerId: ownerId,
          ...productData
        });

        // Set default variant if available
        if (productData.variants && productData.variants.length > 0) {
          setSelectedVariant(productData.variants[0]);
        }
      } else {
        setError('Product not found');
      }
    } catch (err) {
      console.error('Error loading product:', err);
      setError('Failed to load product');
    } finally {
      setLoading(false);
    }
  }

  const handleQuantityChange = (delta) => {
    setQuantity(prev => Math.max(1, Math.min(10, prev + delta)));
  };

  const calculateTotal = () => {
    const basePrice = product?.price || 0;
    const variantAdditional = selectedVariant?.priceModifier || 0;
    return ((basePrice + variantAdditional) * quantity).toFixed(2);
  };

  const handlePaymentSuccess = (details) => {
    console.log('Payment successful:', details);
    setPaymentSuccess(true);
    setOrderDetails(details);
    setShowPayment(false);
  };

  const handlePaymentError = (error) => {
    console.error('Payment error:', error);
    alert('Payment failed. Please try again.');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Product Not Found</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Order Confirmed!</h1>
          <p className="text-slate-600 mb-6">
            Thank you for your purchase! You will receive an email confirmation shortly.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
            <h3 className="font-semibold text-slate-900 mb-2">Order Details</h3>
            <p className="text-sm text-slate-600">Product: {product?.title}</p>
            <p className="text-sm text-slate-600">Quantity: {quantity}</p>
            <p className="text-sm text-slate-600">Total: £{calculateTotal()}</p>
            {orderDetails?.id && (
              <p className="text-sm text-slate-600">Order ID: {orderDetails.id}</p>
            )}
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  const images = product?.images || [];
  const mainImage = images[selectedImage]?.url || images[selectedImage] || '/placeholder-product.jpg';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
          >
            <ChevronLeft className="h-5 w-5" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-full hover:bg-slate-100 transition">
              <Heart className="h-5 w-5 text-slate-600" />
            </button>
            <button className="p-2 rounded-full hover:bg-slate-100 transition">
              <Share2 className="h-5 w-5 text-slate-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="aspect-square bg-white rounded-3xl shadow-lg overflow-hidden">
              <img
                src={mainImage}
                alt={product?.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/600x600?text=Product+Image';
                }}
              />
            </div>
            
            {/* Thumbnail Gallery */}
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition ${
                      selectedImage === index 
                        ? 'border-purple-600 ring-2 ring-purple-200' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <img
                      src={img.url || img}
                      alt={`View ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Category Badge */}
            {product?.category && (
              <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                {product.category}
              </span>
            )}

            <h1 className="text-3xl lg:text-4xl font-bold text-slate-900">
              {product?.title}
            </h1>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-purple-600">
                £{product?.price?.toFixed(2)}
              </span>
              {product?.originalPrice && product.originalPrice > product.price && (
                <>
                  <span className="text-xl text-slate-400 line-through">
                    £{product.originalPrice.toFixed(2)}
                  </span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-semibold">
                    Save {Math.round((1 - product.price / product.originalPrice) * 100)}%
                  </span>
                </>
              )}
            </div>

            {/* Description */}
            {product?.description && (
              <p className="text-slate-600 text-lg leading-relaxed">
                {product.description}
              </p>
            )}

            {/* Variants */}
            {product?.variants && product.variants.length > 0 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  Select Option
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedVariant(variant)}
                      className={`px-4 py-2 rounded-xl border-2 transition ${
                        selectedVariant === variant
                          ? 'border-purple-600 bg-purple-50 text-purple-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {variant.name}
                      {variant.priceModifier > 0 && (
                        <span className="ml-1 text-sm text-slate-500">
                          (+£{variant.priceModifier.toFixed(2)})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Quantity
              </label>
              <div className="flex items-center gap-4">
                <div className="flex items-center border-2 border-slate-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className="p-3 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="px-6 py-3 font-semibold min-w-[60px] text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= 10}
                    className="p-3 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <span className="text-slate-600">
                  {product?.quantity > 0 && `${product.quantity} in stock`}
                </span>
              </div>
            </div>

            {/* Total */}
            <div className="bg-slate-50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-600">Total</span>
                <span className="text-3xl font-bold text-slate-900">
                  £{calculateTotal()}
                </span>
              </div>

              {!showPayment ? (
                <button
                  onClick={() => setShowPayment(true)}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="h-5 w-5" />
                  Buy Now
                </button>
              ) : (
                <div className="space-y-4">
                  <p className="text-center text-sm text-slate-600 mb-2">
                    Complete your purchase with PayPal
                  </p>
                  <PayPalButton
                    amount={calculateTotal()}
                    productName={product?.title}
                    productId={productId}
                    ownerId={ownerId}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                    onCancel={() => setShowPayment(false)}
                  />
                  <button
                    onClick={() => setShowPayment(false)}
                    className="w-full py-2 text-slate-600 hover:text-slate-900 transition"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center text-center p-4 bg-white rounded-xl">
                <Truck className="h-6 w-6 text-purple-600 mb-2" />
                <span className="text-xs font-medium text-slate-700">Fast Delivery</span>
              </div>
              <div className="flex flex-col items-center text-center p-4 bg-white rounded-xl">
                <Shield className="h-6 w-6 text-purple-600 mb-2" />
                <span className="text-xs font-medium text-slate-700">Secure Payment</span>
              </div>
              <div className="flex flex-col items-center text-center p-4 bg-white rounded-xl">
                <RotateCcw className="h-6 w-6 text-purple-600 mb-2" />
                <span className="text-xs font-medium text-slate-700">Easy Returns</span>
              </div>
            </div>

            {/* Bumper/Cross-sell Products */}
            {product?.bumperProducts && product.bumperProducts.length > 0 && (
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6">
                <h3 className="font-semibold text-slate-900 mb-2">
                  {product.bumperMessage || 'You might also like'}
                </h3>
                <div className="space-y-3">
                  {product.bumperProducts.map((bumper, index) => (
                    <div key={index} className="flex items-center justify-between bg-white rounded-xl p-3">
                      <div>
                        <p className="font-medium text-slate-900">{bumper.title}</p>
                        <p className="text-sm text-purple-600 font-semibold">£{bumper.price?.toFixed(2)}</p>
                      </div>
                      <button className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition">
                        {product.bumperCTA || 'Add'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
