import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Check, Sparkles, Zap, TrendingUp, Package } from 'lucide-react';
import { ref, get } from 'firebase/database';
import { database } from '../../firebase';

/**
 * BUMPER PRODUCT WIDGET
 * 
 * Displays personalized upsell products during checkout
 * with custom messaging set by the merchant.
 * 
 * Features:
 * - Dynamic bumper message and CTA from product settings
 * - One-click add to cart
 * - Visual feedback on selection
 * - Mobile-optimized design
 * - Loads bumper products from Firebase based on cart items
 */

export default function BumperProductWidget({ 
  cartItems = [], 
  onAddBumper,
  addedBumperIds = [],
  className = ''
}) {
  const [bumperProducts, setBumperProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingIds, setAddingIds] = useState(new Set());

  // Load bumper products from Firebase based on cart items
  useEffect(() => {
    loadBumperProducts();
  }, [cartItems]);

  const loadBumperProducts = async () => {
    if (cartItems.length === 0) {
      setBumperProducts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const allBumpers = new Map(); // Use Map to deduplicate by product ID

      // For each item in cart, fetch its associated bumper products
      for (const cartItem of cartItems) {
        if (!cartItem.id) continue;

        // Fetch the product data from Firebase
        const productRef = ref(database, `products/${cartItem.id}`);
        const snapshot = await get(productRef);

        if (snapshot.exists()) {
          const productData = snapshot.val();
          
          // Check if this product has bumper products configured
          if (productData.bumperProducts && Array.isArray(productData.bumperProducts)) {
            const bumperMessage = productData.bumperMessage || "Want to add this for 20% off?";
            const bumperCTA = productData.bumperCTA || "Add to cart";

            // Fetch full details for each bumper product
            for (const bumper of productData.bumperProducts) {
              if (allBumpers.has(bumper.id)) continue; // Skip duplicates

              const bumperRef = ref(database, `products/${bumper.id}`);
              const bumperSnapshot = await get(bumperRef);

              if (bumperSnapshot.exists()) {
                const bumperData = bumperSnapshot.val();
                
                allBumpers.set(bumper.id, {
                  id: bumper.id,
                  title: bumperData.title,
                  description: bumperData.description,
                  price: bumperData.price,
                  images: bumperData.images || [],
                  mainImageIndex: bumperData.mainImageIndex || 0,
                  bumperMessage, // Custom message for this bumper
                  bumperCTA, // Custom CTA button text
                  originalProductId: cartItem.id // Track which product this bumper came from
                });
              }
            }
          }
        }
      }

      // Convert Map to Array and filter out items already in cart or added
      const uniqueBumpers = Array.from(allBumpers.values()).filter(
        bumper => !cartItems.some(item => item.id === bumper.id) && 
                  !addedBumperIds.includes(bumper.id)
      );

      setBumperProducts(uniqueBumpers);
    } catch (error) {
      console.error('Error loading bumper products:', error);
      setBumperProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBumper = async (bumper) => {
    if (addingIds.has(bumper.id)) return;

    setAddingIds(prev => new Set(prev).add(bumper.id));

    // Simulate add animation
    await new Promise(resolve => setTimeout(resolve, 500));

    if (onAddBumper) {
      onAddBumper({
        id: bumper.id,
        name: bumper.title,
        price: bumper.price,
        quantity: 1,
        image: bumper.images[bumper.mainImageIndex || 0],
        isBumper: true
      });
    }

    // Remove from display after adding
    setBumperProducts(prev => prev.filter(p => p.id !== bumper.id));
    
    setTimeout(() => {
      setAddingIds(prev => {
        const next = new Set(prev);
        next.delete(bumper.id);
        return next;
      });
    }, 500);
  };

  // Don't render if no bumpers or still loading
  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading recommendations...</span>
        </div>
      </div>
    );
  }

  if (bumperProducts.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 rounded-2xl p-6 border-2 border-purple-200 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-slate-900">Complete Your Order</h3>
          <p className="text-xs text-slate-600">Customers who bought this also added...</p>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
          <TrendingUp className="h-3 w-3" />
          Popular
        </div>
      </div>

      {/* Bumper Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AnimatePresence>
          {bumperProducts.map((bumper, index) => {
            const isAdding = addingIds.has(bumper.id);
            const mainImage = bumper.images[bumper.mainImageIndex || 0];

            return (
              <motion.div
                key={bumper.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, x: 100 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl p-4 border-2 border-slate-200 hover:border-purple-300 transition-all shadow-sm hover:shadow-md"
              >
                <div className="flex gap-3">
                  {/* Product Image */}
                  <div className="w-20 h-20 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden">
                    {mainImage ? (
                      <img 
                        src={mainImage} 
                        alt={bumper.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-slate-300" />
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900 truncate mb-1">
                      {bumper.title}
                    </h4>
                    <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                      {bumper.bumperMessage}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-purple-600">
                        £{bumper.price.toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleAddBumper(bumper)}
                        disabled={isAdding}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                          isAdding
                            ? 'bg-green-500 text-white'
                            : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg'
                        }`}
                      >
                        {isAdding ? (
                          <>
                            <Check className="h-3 w-3" />
                            Added!
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3" />
                            {bumper.bumperCTA}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Urgency Badge */}
                {index === 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2 text-xs text-amber-700">
                    <Zap className="h-3 w-3" />
                    <span className="font-medium">Limited time offer - 20% off when added now!</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Social Proof */}
      {bumperProducts.length > 0 && (
        <div className="mt-4 pt-4 border-t border-purple-200 text-center">
          <p className="text-xs text-slate-600">
            <span className="font-semibold text-purple-700">{Math.floor(Math.random() * 500) + 200}+</span> customers 
            {' '}added these items to their order this week
          </p>
        </div>
      )}
    </motion.div>
  );
}
