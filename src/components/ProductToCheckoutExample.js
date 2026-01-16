import React, { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../firebase';
import CheckoutPage from './checkout/CheckoutPage';

/**
 * EXAMPLE: Product Page to Checkout Flow
 * 
 * This demonstrates the complete customer journey:
 * 1. Customer views product page
 * 2. Customer adds product to cart
 * 3. Customer proceeds to checkout
 * 4. Bumper products automatically display
 * 5. Customer completes purchase
 */

export default function ProductToCheckoutExample() {
  const [currentView, setCurrentView] = useState('product'); // 'product' | 'cart' | 'checkout'
  const [product, setProduct] = useState(null);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load sample product from Firebase
  useEffect(() => {
    loadSampleProduct();
  }, []);

  const loadSampleProduct = async () => {
    try {
      setLoading(true);
      
      // In real app, get product ID from URL params or props
      // For demo, you can hardcode a product ID that exists in your Firebase
      const productId = 'YOUR_PRODUCT_ID_HERE'; // Replace with actual product ID
      
      const productRef = ref(database, `products/${productId}`);
      const snapshot = await get(productRef);
      
      if (snapshot.exists()) {
        const productData = { id: productId, ...snapshot.val() };
        setProduct(productData);
      } else {
        // Fallback to mock data if product not found
        setProduct({
          id: 'demo_product',
          title: 'Premium Photo Mirror',
          description: 'Beautiful laser-engraved photo on mirror glass',
          price: 29.99,
          images: ['/placeholder-product.jpg'],
          mainImageIndex: 0,
          bumperMessage: 'Want to add this for 20% off?',
          bumperCTA: 'Add to cart',
          bumperProducts: [
            { id: 'bumper_1', title: 'Wooden Frame', price: 12.99 },
            { id: 'bumper_2', title: 'LED Light Strip', price: 8.99 }
          ]
        });
      }
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    const cartItem = {
      id: product.id,
      name: product.title,
      price: product.price,
      quantity: 1,
      image: product.images[product.mainImageIndex || 0],
      variant: null
    };
    
    setCart([...cart, cartItem]);
    setCurrentView('cart');
  };

  const handleProceedToCheckout = () => {
    setCurrentView('checkout');
  };

  const handleOrderComplete = (orderData) => {
    console.log('Order completed:', orderData);
    alert('Order completed successfully!');
    setCart([]);
    setCurrentView('product');
  };

  const handleBackToCart = () => {
    setCurrentView('cart');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading product...</p>
        </div>
      </div>
    );
  }

  // Product Page View
  if (currentView === 'product' && product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="grid md:grid-cols-2 gap-8 p-8">
              {/* Product Image */}
              <div>
                <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden">
                  {product.images[product.mainImageIndex || 0] ? (
                    <img 
                      src={product.images[product.mainImageIndex || 0]} 
                      alt={product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <span className="text-6xl">📦</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Product Details */}
              <div className="flex flex-col">
                <h1 className="text-3xl font-bold text-slate-900 mb-4">{product.title}</h1>
                <p className="text-slate-600 mb-6">{product.description}</p>
                
                <div className="text-4xl font-bold text-purple-600 mb-8">
                  £{product.price.toFixed(2)}
                </div>

                {/* Bumper Info Preview */}
                {product.bumperProducts && product.bumperProducts.length > 0 && (
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 mb-6 border-2 border-purple-200">
                    <p className="text-sm font-semibold text-purple-900 mb-2">
                      💡 Smart Recommendations Available
                    </p>
                    <p className="text-xs text-slate-600">
                      {product.bumperProducts.length} complementary {product.bumperProducts.length === 1 ? 'product' : 'products'} will 
                      be suggested at checkout based on your selection.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleAddToCart}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all text-lg"
                >
                  Add to Cart
                </button>

                <div className="mt-6 space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span>✓</span>
                    <span>Free UK delivery on orders over £50</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>✓</span>
                    <span>30-day money-back guarantee</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>✓</span>
                    <span>Secure checkout with SSL encryption</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Cart View
  if (currentView === 'cart') {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-8">Shopping Cart</h1>

            {cart.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-600 mb-4">Your cart is empty</p>
                <button
                  onClick={() => setCurrentView('product')}
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Continue Shopping
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-8">
                  {cart.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                      <div className="w-20 h-20 bg-slate-200 rounded-lg overflow-hidden">
                        {item.image && (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">{item.name}</h3>
                        {item.variant && (
                          <p className="text-sm text-slate-600">{item.variant}</p>
                        )}
                        <p className="text-sm font-semibold text-purple-600 mt-1">
                          £{item.price.toFixed(2)} x {item.quantity}
                        </p>
                      </div>
                      <button
                        onClick={() => setCart(cart.filter((_, i) => i !== index))}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-200 pt-6 mb-6">
                  <div className="flex items-center justify-between text-lg font-semibold">
                    <span className="text-slate-900">Subtotal:</span>
                    <span className="text-purple-600">£{subtotal.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Taxes and shipping calculated at checkout
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleProceedToCheckout}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all text-lg"
                  >
                    Proceed to Checkout
                  </button>
                  <button
                    onClick={() => setCurrentView('product')}
                    className="w-full py-4 border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Continue Shopping
                  </button>
                </div>

                <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                  <p className="text-sm text-purple-900">
                    <strong>💡 Tip:</strong> At checkout, you'll see personalized recommendations for products 
                    that go great with your purchase!
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Checkout View (with bumper products)
  if (currentView === 'checkout') {
    return (
      <CheckoutPage
        cartItems={cart}
        onOrderComplete={handleOrderComplete}
        onBack={handleBackToCart}
        user={null} // Replace with your auth user object
      />
    );
  }

  return null;
}
