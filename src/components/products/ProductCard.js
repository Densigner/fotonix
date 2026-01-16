import React, { useState } from 'react';

function ProductCard({ product, featured = false, onViewDetails }) {
  const [imageError, setImageError] = useState(false);
  
  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(product);
    }
  };

  const buttonLabel = product.buttonLabel || 'View Details';

  // Fallback gradient placeholder when image fails to load
  const FallbackPlaceholder = () => (
    <div 
      className="w-full h-[150px] rounded-[10px] flex items-center justify-center"
      style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <span className="text-white text-4xl">🪞</span>
    </div>
  );

  return (
    <div className={`product-card ${featured ? 'featured' : ''}`}>
      {featured && <div className="product-badge">Featured</div>}
      <div className="product-image">
        {typeof product.imagePlaceholder === 'string' && product.imagePlaceholder.startsWith('http') && !imageError ? (
          <div className={`product-placeholder ${product.imageClass || ''}`}>
            <img 
              src={product.imagePlaceholder} 
              alt={product.name} 
              style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '10px' }}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          </div>
        ) : typeof product.imagePlaceholder === 'string' && product.imagePlaceholder.startsWith('/') && !imageError ? (
          <div className={`product-placeholder ${product.imageClass || ''}`}>
            <img 
              src={product.imagePlaceholder} 
              alt={product.name} 
              style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '10px' }}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          </div>
        ) : imageError ? (
          <div className={`product-placeholder ${product.imageClass || ''}`}>
            <FallbackPlaceholder />
          </div>
        ) : (
          <div className={`product-placeholder ${product.imageClass || ''}`}>
            {product.imagePlaceholder || <FallbackPlaceholder />}
          </div>
        )}
      </div>
      <h3>{product.name}</h3>
      <p>{product.description}</p>
      <div className="price">{product.price}</div>
      <button className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 text-white hover:brightness-110 active:brightness-95 transition-all shadow-lg shadow-pink-500/20 rounded-xl px-4 py-2 font-semibold" onClick={handleViewDetails}>
        {buttonLabel}
      </button>
    </div>
  );
}

export default ProductCard;
