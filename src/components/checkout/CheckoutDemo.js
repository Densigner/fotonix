import React, { useState } from 'react';
import CheckoutPage from './CheckoutPage';

/**
 * CHECKOUT DEMO COMPONENT
 * 
 * Example of how to use the CheckoutPage with bumper products.
 * This shows the complete flow from cart to checkout.
 */

export default function CheckoutDemo() {
  const [showCheckout, setShowCheckout] = useState(false);

  // Example cart items - these should come from your cart state/context
  const mockCartItems = [
    {
      id: 'product_123', // This ID must match a product in Firebase
      name: 'Premium Photo Mirror',
      price: 29.99,
      quantity: 1,
      image: '/images/products/mirror-1.jpg',
      variant: 'Large - 30x40cm'
    },
    {
      id: 'product_456',
      name: 'Custom Phone Case',
      price: 14.99,
      quantity: 2,
      image: '/images/products/case-1.jpg',
      variant: 'iPhone 14 Pro'
    }
  ];

  const handleOrderComplete = (orderData) => {
    console.log('Order completed:', orderData);
    alert('Order completed successfully! Check console for details.');
    setShowCheckout(false);
  };

  const handleBack = () => {
    setShowCheckout(false);
  };

  if (showCheckout) {
    return (
      <CheckoutPage
        cartItems={mockCartItems}
        onOrderComplete={handleOrderComplete}
        onBack={handleBack}
        user={null} // Pass logged-in user object if available
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Shopping Cart Demo</h1>
        <p className="text-slate-600 mb-6">
          This demo shows how bumper products work in the checkout flow.
        </p>

        <div className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold text-slate-800">Your Cart</h2>
          {mockCartItems.map((item, index) => (
            <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
              <div className="w-16 h-16 bg-slate-200 rounded-lg"></div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">{item.name}</h3>
                <p className="text-sm text-slate-600">{item.variant}</p>
                <p className="text-sm font-semibold text-purple-600 mt-1">
                  £{item.price.toFixed(2)} x {item.quantity}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-purple-900 mb-2">How Bumper Products Work:</h3>
          <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside">
            <li>Create products in the Product Builder</li>
            <li>In each product, select other products as "Bumper Products"</li>
            <li>Customize the bumper message and CTA button text</li>
            <li>When customers add that product to cart and proceed to checkout...</li>
            <li>The bumper products appear automatically with your custom messaging!</li>
          </ol>
        </div>

        <button
          onClick={() => setShowCheckout(true)}
          className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
        >
          Proceed to Checkout
        </button>

        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs text-amber-800">
            <strong>Note:</strong> For bumpers to appear, make sure the products in your cart have bumper products 
            configured in Firebase under <code className="bg-amber-100 px-1 rounded">bumperProducts</code> field.
          </p>
        </div>
      </div>
    </div>
  );
}
