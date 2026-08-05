import React, { useState, useEffect } from 'react';
// PayPal imports removed - using hosted buttons

function ProductPage({ product }) {
  const [quantity, setQuantity] = useState(1);
  const [paypalLoaded, setPaypalLoaded] = useState(false);

  // PayPal hosted button initialization removed from here to avoid injecting
  // a second PayPal SDK instance. The unified `PayPalSDKLoader` is used
  // in the product pages so only one SDK loader runs. If hosted buttons
  // are required, render them from a single place after the SDK is ready.

  // Default to Lumina Mirror if no product is passed
  const defaultProduct = {
    id: 1,
    name: "Fotonix Lumina Mirror",
    tagline: "The Future of Smart Mirrors",
    price: "£22.99",
    originalPrice: "£25.99",
    description: "Transform your daily routine with our revolutionary smart mirror technology. Experience perfect lighting, smart connectivity, and elegant design in one premium package.",
    features: [
      
      "Perfect LED Lighting System",
      "Voice Control Integration",
      "Smartphone App Connectivity",
      "Anti-Fog Technology"
    ],
    specifications: [
      { label: "Dimensions", value: "80cm x 60cm x 3cm" },
      { label: "Weight", value: "12kg" },
      { label: "Display", value: "32-inch 4K Smart Display" },
      { label: "Connectivity", value: "WiFi, Bluetooth 5.0" },
      { label: "Power", value: "100-240V AC" },
      { label: "Warranty", value: "3 Years Premium" }
    ],
    images: [
      "LUMINA FRONT",
      "LUMINA SIDE",
      "LUMINA APP",
      "LUMINA ROOM"
    ],
    inStock: true,
    rating: 4.8,
    reviews: 127
  };

  const currentProduct = product || defaultProduct;

  // Calculate total price based on quantity
  const totalPrice = (parseInt(currentProduct.price.replace('£', '')) * quantity).toString();

  return (
    <div className="product-page">
      {/* Product Header */}
      <div className="product-header">
        <div className="container">
          <div className="breadcrumb">
            <a href="#home">Home</a> / <a href="#products">Products</a> / <span>{currentProduct.name}</span>
          </div>
        </div>
      </div>

      {/* Product Details */}
      <section className="product-details">
        <div className="container">
          <div className="product-layout">
            
            {/* Product Images */}
            <div className="product-images">
              <div className="main-image">
                <div className="product-image-large lumina">
                  {currentProduct.images[0]}
                </div>
              </div>
              <div className="thumbnail-images">
                {currentProduct.images.map((image, index) => (
                  <div key={index} className="thumbnail">
                    <div className="product-image-small">
                      {image}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Product Info */}
            <div className="product-info">
              <h1>{currentProduct.name}</h1>
              <p className="product-tagline">{currentProduct.tagline}</p>
              
              <div className="product-rating">
                <div className="stars">
                  <a href="https://endorsed.reviews" target="_blank" rel="noopener noreferrer" aria-label="Endorsed.Reviews" className="inline-block mr-2 align-middle">
                    <img src="/endorsed.svg" alt="Endorsed.Review" className="h-7 inline-block" />
                  </a>
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={i < Math.floor(currentProduct.rating) ? "star filled" : "star"}>★</span>
                  ))}
                  <span className="rating-text">(<a href="https://endorsed.review/#/biz/fotonix" target="_blank" rel="noopener noreferrer" className="underline">{currentProduct.rating}</a>) • <a href="https://endorsed.review/#/biz/fotonix" target="_blank" rel="noopener noreferrer" className="underline">{currentProduct.reviews} reviews</a></span>
                </div>
              </div>

              <div className="product-pricing">
                <span className="current-price">{currentProduct.price}</span>
                {currentProduct.originalPrice && (
                  <span className="original-price">{currentProduct.originalPrice}</span>
                )}
                <span className="savings">Save £{parseInt(currentProduct.originalPrice?.replace('£', '') || '0') - parseInt(currentProduct.price.replace('£', ''))}</span>
              </div>

              <div className="stock-status">
                <span className={`status ${currentProduct.inStock ? 'in-stock' : 'out-stock'}`}>
                  {currentProduct.inStock ? '✓ In Stock' : '✗ Out of Stock'}
                </span>
              </div>

              <div className="product-description">
                <p>{currentProduct.description}</p>
              </div>

              <div className="product-actions">
                <div className="quantity-selector">
                  <label>Quantity:</label>
                  <select value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value))}>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                </div>
                
                <div className="total-price">
                  <strong>Total: £{totalPrice}</strong>
                </div>
                
                <button className="add-to-cart-btn">Add to Cart</button>
                
                {/* PayPal Hosted Button */}
                <div className="payment-section">
                  <div className="payment-divider">
                    <span>or pay instantly with</span>
                  </div>
                  <div id="paypal-container-42UJ59FN5F458" className="paypal-hosted-container"></div>
                </div>
              </div>

              <div className="product-guarantee">
                <div className="guarantee-item">
                  <span className="icon">🚚</span>
                  <span>Free UK Delivery</span>
                </div>
                <div className="guarantee-item">
                  <span className="icon">🔧</span>
                  <span>Professional Installation</span>
                </div>
                <div className="guarantee-item">
                  <span className="icon">🛡️</span>
                  <span>3 Year Warranty</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Features */}
      <section className="product-features">
        <div className="container">
          <h2>Key Features</h2>
          <div className="features-grid">
            {currentProduct.features.map((feature, index) => (
              <div key={index} className="feature-item">
                <span className="feature-icon">✓</span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Specifications */}
      <section className="product-specs">
        <div className="container">
          <h2>Technical Specifications</h2>
          <div className="specs-table">
            {currentProduct.specifications.map((spec, index) => (
              <div key={index} className="spec-row">
                <div className="spec-label">{spec.label}</div>
                <div className="spec-value">{spec.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related Products */}
      <section className="related-products">
        <div className="container">
          <h2>You Might Also Like</h2>
          <div className="related-grid">
            <div className="related-item">
              <div className="related-image">MIRROR PRO</div>
              <h4>Fotonix Mirror Pro</h4>
              <p>£1,299</p>
            </div>
            <div className="related-item">
              <div className="related-image">MIRROR LITE</div>
              <h4>Fotonix Mirror Lite</h4>
              <p>£499</p>
            </div>
            <div className="related-item">
              <div className="related-image">ACCESSORIES</div>
              <h4>Smart Accessories</h4>
              <p>From £49</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ProductPage;
