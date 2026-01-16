import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StoreWidgets } from './StoreWidgets';
import { API_URL } from '../../../config/environment';

// Product Grid component that loads products from API
function ProductGridViewer({ block, storeHandle }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const carouselRef = useRef(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/member/products`, {
        method: 'GET',
        headers: {
          'x-member-uid': storeHandle // Use store handle as user ID for now
        }
      });
      
      if (response.ok) {
        const userProducts = await response.json();
        setProducts(userProducts);
      } else {
        // Fallback to mock data if API fails
        const mockProducts = [
          { 
            id: '1', 
            title: 'Fotonix Lumina Mirror', 
            price: 29.99, 
            priceCents: 2999,
            description: 'Beautiful LED mirror with customizable lighting', 
            images: ['https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=400&fit=crop']
          },
          { 
            id: '2', 
            title: 'Light Up Design Pro', 
            price: 19.99, 
            priceCents: 1999,
            description: 'Custom light-up creation with premium features', 
            images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop']
          },
          { 
            id: '3', 
            title: 'Custom Cut Mirror', 
            price: 40.00, 
            priceCents: 4000,
            description: 'Precisely cut mirror to your specifications', 
            images: ['https://images.unsplash.com/photo-1586953208462-d35b1f4468bc?w=400&h=400&fit=crop']
          }
        ];
        setProducts(mockProducts);
      }
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  // Filter products by saved productIds
  const selectedProducts = products.filter(p => block.data.productIds.includes(p.id));
  const displayProducts = selectedProducts.length > 0 ? selectedProducts : products.slice(0, 6);

  // Carousel navigation functions
  const nextSlide = () => {
    if (block.data.layout === 'carousel') {
      setCurrentSlide((prev) => (prev + 1) % Math.ceil(displayProducts.length / (block.data.columns || 3)));
    }
  };

  const prevSlide = () => {
    if (block.data.layout === 'carousel') {
      setCurrentSlide((prev) => (prev - 1 + Math.ceil(displayProducts.length / (block.data.columns || 3))) % Math.ceil(displayProducts.length / (block.data.columns || 3)));
    }
  };

  const renderProductCard = (product) => (
    <div key={product.id} className={`bg-gray-50 rounded-lg p-4 border hover:shadow-md transition-shadow cursor-pointer ${block.data.layout === 'list' ? 'flex gap-4' : ''}`}>
      <div className={`bg-gray-200 rounded-lg overflow-hidden ${block.data.layout === 'list' ? 'w-24 h-24 flex-shrink-0' : 'aspect-square mb-3'}`}>
        {product.images && product.images[0] ? (
          <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center text-gray-400 ${block.data.layout === 'list' ? 'text-sm' : ''}`}>No Image</div>
        )}
      </div>
      <div className={block.data.layout === 'list' ? 'flex-1' : ''}>
        <h4 className={`font-medium mb-1 line-clamp-2 ${block.data.layout === 'list' ? 'text-base' : ''}`}>{product.title}</h4>
        {block.data.showDescription && product.description && (
          <p className={`text-gray-600 mb-2 line-clamp-2 ${block.data.layout === 'list' ? 'text-sm' : 'text-sm'}`}>{product.description}</p>
        )}
        {block.data.showPrices && (
          <div className={`flex items-center ${block.data.layout === 'list' ? 'justify-start gap-4' : 'justify-between'}`}>
            <p className="font-bold text-indigo-600">
              £{typeof product.price === 'number' ? product.price.toFixed(2) : (product.priceCents / 100).toFixed(2)}
            </p>
            <button className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700">
              View
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <section className="w-full bg-white py-16 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-16">
            <div className="animate-spin h-12 w-12 border-3 border-indigo-600 border-t-transparent rounded-full mx-auto mb-6" />
            <p className="text-lg text-gray-600">Loading products...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full bg-white py-16 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h3 className="text-3xl font-bold mb-4">{block.data.title}</h3>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">{block.data.description}</p>
        </div>
        
        {block.data.layout === 'carousel' ? (
          <div className="relative">
            <div className="overflow-hidden" ref={carouselRef}>
              <div 
                className="flex transition-transform duration-300 ease-in-out"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {Array.from({ length: Math.ceil(displayProducts.length / (block.data.columns || 3)) }, (_, slideIndex) => (
                  <div key={slideIndex} className="w-full flex-shrink-0">
                    <div className={`grid gap-8 ${
                      block.data.columns === 2 
                        ? 'grid-cols-2' 
                        : block.data.columns === 3 
                        ? 'grid-cols-3' 
                        : 'grid-cols-4'
                    }`}>
                      {displayProducts
                        .slice(slideIndex * (block.data.columns || 3), (slideIndex + 1) * (block.data.columns || 3))
                        .map(renderProductCard)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {Math.ceil(displayProducts.length / (block.data.columns || 3)) > 1 && (
              <>
                <button
                  onClick={prevSlide}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-white shadow-lg rounded-full p-3 hover:bg-gray-50 transition-colors z-10"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={nextSlide}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-white shadow-lg rounded-full p-3 hover:bg-gray-50 transition-colors z-10"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
                <div className="flex justify-center mt-8 gap-2">
                  {Array.from({ length: Math.ceil(displayProducts.length / (block.data.columns || 3)) }, (_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`w-3 h-3 rounded-full transition-colors ${
                        currentSlide === index ? 'bg-indigo-600' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : block.data.layout === 'list' ? (
          <div className="space-y-6 max-w-4xl mx-auto">
            {displayProducts.map(renderProductCard)}
          </div>
        ) : (
          <div className={`grid gap-8 ${
            block.data.columns === 2 
              ? 'md:grid-cols-2 lg:grid-cols-3' 
              : block.data.columns === 3 
              ? 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
              : 'md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'
          }`}>
            {displayProducts.map(renderProductCard)}
          </div>
        )}
      </div>
    </section>
  );
}

// Simple store viewer for published stores
export function StoreViewer({ handle: propHandle }) {
  const { handle: routeHandle } = useParams();
  const handle = propHandle || routeHandle;
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStore();
  }, [handle]);

  async function loadStore() {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/stores/view/${handle}`);
      
      if (response.ok) {
        const data = await response.json();
        setStore(data.store);
      } else if (response.status === 404) {
        setError('Store not found');
      } else {
        setError('Failed to load store');
      }
    } catch (err) {
      setError('Failed to load store');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading store...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Store Not Found</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!store) return null;

  // Handle blocks - could be a JSON string or already parsed array
  let blocks;
  try {
    blocks = typeof store.blocks === 'string' ? JSON.parse(store.blocks) : (store.blocks || []);
  } catch (e) {
    console.error('Error parsing blocks:', e);
    blocks = [];
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Store Content - Full Width */}
      <div className="w-full space-y-0">
        {blocks.map((block) => (
          <StoreBlockRenderer key={block.id} block={block} storeHandle={handle} />
        ))}
      </div>

      {/* Store Widgets (Chatbot, Social Proof, etc.) */}
      <StoreWidgets storeHandle={handle} blocks={blocks} />
    </div>
  );
}

// Simplified block renderer for published stores
function StoreBlockRenderer({ block, storeHandle }) {
  switch (block.type) {
    case 'storeHero':
      return (
        <section className="relative overflow-hidden w-full h-[60vh] min-h-[500px]">
          <img src={block.data.backgroundImage} alt="Store Hero" className="absolute inset-0 w-full h-full object-cover" />
          {block.data.overlay && <div className="absolute inset-0 bg-black/50" />}
          <div className={`relative z-10 flex flex-col items-center justify-center h-full text-center px-8 ${block.data.textColor === 'white' ? 'text-white' : 'text-gray-900'}`}>
            {block.data.showLogo && (
              <h1 className="text-3xl font-bold mb-4">{block.data.logoText}</h1>
            )}
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 max-w-4xl">{block.data.headline}</h2>
            <p className="text-xl md:text-2xl mb-8 max-w-3xl leading-relaxed">{block.data.subhead}</p>
            <a 
              href={block.data.ctaLink} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors shadow-lg hover:shadow-xl"
            >
              {block.data.ctaText}
            </a>
          </div>
        </section>
      );

    case 'productGrid':
      return <ProductGridViewer block={block} storeHandle={storeHandle} />;

    case 'socialLinks':
      return (
        <section className="w-full bg-gray-50 py-16 px-4 md:px-8">
          <div className="max-w-7xl mx-auto">
            <div className={`${block.data.alignment === "center" ? "text-center" : "text-left"} mb-8`}>
              <h3 className="text-3xl font-bold mb-4">{block.data.title}</h3>
              <p className="text-lg text-gray-600">{block.data.description}</p>
            </div>
            <div className={`flex gap-6 ${block.data.alignment === "center" ? "justify-center" : "justify-start"}`}>
              {block.data.links.map((link) => (
                <a
                  key={link.id}
                  href={link.url || "#"}
                  className={`inline-flex items-center gap-3 ${
                    block.data.style === "buttons" 
                      ? "bg-white hover:bg-gray-50 px-6 py-3 rounded-lg shadow-sm border border-gray-200" 
                      : block.data.style === "icons"
                      ? "bg-indigo-100 hover:bg-indigo-200 p-4 rounded-full shadow-sm"
                      : "text-indigo-600 hover:text-indigo-800 text-lg"
                  } transition-all duration-200 hover:shadow-md`}
                >
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      );

    case 'testimonials':
      return (
        <section className="w-full bg-gray-50 py-16 px-4 md:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold mb-4">{block.data.title}</h3>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">{block.data.description}</p>
            </div>
            <div className={`grid gap-8 ${block.data.layout === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : "max-w-4xl mx-auto"}`}>
            {block.data.testimonials.map((testimonial) => (
              <div key={testimonial.id} className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <span key={i} className="text-yellow-400">⭐</span>
                  ))}
                </div>
                <p className="text-gray-700 mb-4">"{testimonial.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">{testimonial.name.charAt(0)}</span>
                  </div>
                  <div className="font-medium">{testimonial.name}</div>
                </div>
              </div>
            ))}
            </div>
          </div>
        </section>
      );

    default:
      return null;
  }
}

export default StoreViewer;