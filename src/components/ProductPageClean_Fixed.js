import React, { useState, useEffect, useRef } from 'react';
// Avoid bundling/importing Fabric here to prevent duplicate runtime definitions.
// Use window.fabric which is provided by the dynamic loader in ProductPageClean.
const fabric = (typeof window !== 'undefined' && window.fabric) || null;

function ProductPage({ selectedProduct, onBack }) {
  const [quantity, setQuantity] = useState(1);
  const [mainCanvas, setMainCanvas] = useState(null);
  const [customCanvas, setCustomCanvas] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const dragCounter = useRef(0);

  // React event handlers for canvas interactions
  const handleAddText = () => {
    console.log('handleAddText called');
    alert('Add Text button clicked!');
    
    if (mainCanvas && fabric) {
      try {
        const text = new fabric.Text('Smart Mirror Text', {
          left: Math.random() * 400 + 100,
          top: Math.random() * 200 + 100,
          fontFamily: 'Arial',
          fontSize: 16,
          fill: '#333333'
        });
        mainCanvas.add(text);
        mainCanvas.renderAll();
      } catch (error) {
        console.error('Error adding text:', error);
      }
    }
  };

  const handleDrawMode = () => {
    console.log('handleDrawMode called');
    alert('Draw Mode button clicked!');
    
    if (mainCanvas) {
      const isDrawing = !mainCanvas.isDrawingMode;
      mainCanvas.isDrawingMode = isDrawing;
      if (isDrawing) {
        mainCanvas.freeDrawingBrush.color = '#333333';
        mainCanvas.freeDrawingBrush.width = 3;
      }
    }
  };

  const handleClearCanvas = () => {
    console.log('handleClearCanvas called');
    alert('Clear Canvas button clicked!');
    
    if (mainCanvas) {
      mainCanvas.clear();
      mainCanvas.backgroundColor = 'rgba(240, 240, 240, 0.9)';
      
      // Re-add the frame
      const frame = new fabric.Rect({
        left: 50,
        top: 50,
        width: 500,
        height: 300,
        fill: 'transparent',
        stroke: '#888888',
        strokeWidth: 2,
        rx: 10,
        ry: 10,
        selectable: false
      });
      mainCanvas.add(frame);
      mainCanvas.renderAll();
    }
  };

  // Generate an AI silhouette via server endpoint and add to main canvas
  const handleGenerateSilhouette = async () => {
    // kept for backward compatibility when called without an explicit prompt
    return handleGenerateSilhouetteWithPrompt();

  };

  // New helper: allow passing a prompt (used by the Ask AI input). If no prompt provided,
  // prompt the user via window.prompt to preserve existing behaviour.
  const handleGenerateSilhouetteWithPrompt = async (providedPrompt) => {
    if (!mainCanvas) {
      alert('Canvas not ready yet.');
      return;
    }

    const prompt = providedPrompt || window.prompt('Enter a short prompt for the silhouette (e.g. "oak leaf silhouette on white background")', 'black silhouette of an oak leaf on white background');
    if (!prompt) return;

    try {
      const resp = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        console.error('generate-image failed', resp.status, err);
        alert('Image generation failed: ' + (err?.error || resp.status));
        return;
      }

      const j = await resp.json();
      const dataUrl = 'data:image/png;base64,' + j.imageBase64;

      // Create a Fabric image and add it to the center of the main canvas
      fabric.Image.fromURL(dataUrl, (img) => {
        // center
        img.set({ originX: 'center', originY: 'center' });
        const canvasCenterX = (mainCanvas.getWidth && mainCanvas.getWidth()) || mainCanvas.width || 300;
        const canvasCenterY = (mainCanvas.getHeight && mainCanvas.getHeight()) || mainCanvas.height || 200;
        img.left = canvasCenterX / 2;
        img.top = canvasCenterY / 2;

        // scale to fit inside canvas nicely
        const maxW = canvasCenterX * 0.6;
        const maxH = canvasCenterY * 0.6;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        if (scale && scale > 0) img.scale(scale);

  img.selectable = true;
  mainCanvas.add(img);
  // Ensure the new image is on top of other objects (frame, text, etc.)
  try { img.bringToFront(); } catch(e) { /* ignore */ }
  mainCanvas.setActiveObject(img);
  if (typeof mainCanvas.requestRenderAll === 'function') mainCanvas.requestRenderAll();
  else mainCanvas.renderAll();
  // After the AI finishes and the image is in the canvas, scroll to top so the user sees it
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e) { /* ignore in non-browser env */ }
      }, { crossOrigin: 'anonymous' });

    } catch (err) {
      console.error('Error generating silhouette', err);
      alert('Error generating silhouette: ' + String(err));
    }
  };

  // Drag & drop / file selection handlers for image upload into the customization canvas
  const handleDropZoneClick = () => {
    const el = document.getElementById('imageFileInput');
    if (el) el.click();
  };

  const handleFileSelected = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      if (customCanvas) {
        fabric.Image.fromURL(dataUrl, (img) => {
          img.set({ originX: 'center', originY: 'center' });
          const cw = (customCanvas.getWidth && customCanvas.getWidth()) || customCanvas.width || 300;
          const ch = (customCanvas.getHeight && customCanvas.getHeight()) || customCanvas.height || 200;
          img.left = cw / 2;
          img.top = ch / 2;
          const scale = Math.min((cw * 0.8) / img.width, (ch * 0.8) / img.height, 1);
          if (scale && scale > 0) img.scale(scale);
          img.selectable = true;
          customCanvas.add(img);
          // Ensure newly added image is on top of frame/other objects
          try { if (typeof img.bringToFront === 'function') img.bringToFront(); } catch(e) { /* ignore */ }
          customCanvas.setActiveObject(img);
          try { if (typeof customCanvas.requestRenderAll === 'function') customCanvas.requestRenderAll(); else customCanvas.renderAll(); } catch(e){ if (typeof customCanvas.renderAll === 'function') customCanvas.renderAll(); }
        }, { crossOrigin: 'anonymous' });
      } else {
        alert('Customization canvas not ready yet.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please drop an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      if (customCanvas) {
        fabric.Image.fromURL(dataUrl, (img) => {
          img.set({ originX: 'center', originY: 'center' });
          const cw = (customCanvas.getWidth && customCanvas.getWidth()) || customCanvas.width || 300;
          const ch = (customCanvas.getHeight && customCanvas.getHeight()) || customCanvas.height || 200;
          img.left = cw / 2;
          img.top = ch / 2;
          const scale = Math.min((cw * 0.8) / img.width, (ch * 0.8) / img.height, 1);
          if (scale && scale > 0) img.scale(scale);
          img.selectable = true;
          customCanvas.add(img);
          // Ensure newly added image is on top
          try { if (typeof img.bringToFront === 'function') img.bringToFront(); } catch(e) { /* ignore */ }
          customCanvas.setActiveObject(img);
          try { if (typeof customCanvas.requestRenderAll === 'function') customCanvas.requestRenderAll(); else customCanvas.renderAll(); } catch(e){ if (typeof customCanvas.renderAll === 'function') customCanvas.renderAll(); }
        }, { crossOrigin: 'anonymous' });
      }
    };
    reader.readAsDataURL(file);
  };

  // Global window-level drag handlers so dragging anywhere on the screen shows an upload overlay
  useEffect(() => {
    const onDragEnter = (e) => {
      e.preventDefault();
      dragCounter.current = (dragCounter.current || 0) + 1;
      setIsDragActive(true);
    };
    const onDragOverWindow = (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = (e) => {
      e.preventDefault();
      dragCounter.current = Math.max(0, (dragCounter.current || 1) - 1);
      if (dragCounter.current === 0) setIsDragActive(false);
    };
    const onDropWindow = (e) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragActive(false);
      // Delegate to existing drop handler so behavior is consistent
      try { handleDrop(e); } catch (err) { console.error('drop handling failed', err); }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOverWindow);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDropWindow);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOverWindow);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDropWindow);
    };
  }, [customCanvas]);

  const handleAddQuote = () => {
    console.log('handleAddQuote called');
    alert('Add Quote button clicked!');
    
    if (customCanvas && fabric) {
      const selectedText = 'Good Vibes Only';
      const selectedFont = 'Dancing Script';
      
      const newText = new fabric.Text(selectedText, {
        left: Math.random() * 200 + 50,
        top: Math.random() * 100 + 50,
        fontFamily: `'${selectedFont}', cursive`,
        fontSize: 16,
        fill: '#333333'
      });
      customCanvas.add(newText);
      customCanvas.renderAll();
    }
  };

  const handleClearCustomCanvas = () => {
    if (customCanvas && fabric) {
      customCanvas.clear();
      customCanvas.backgroundColor = 'rgba(240, 240, 240, 0.9)';
      
      // Re-add sample text
      const sampleText = new fabric.Text('Good Vibes Only', {
        left: 150,
        top: 100,
        fontFamily: "'Dancing Script', cursive",
        fontSize: 18,
        fill: '#333333',
        textAlign: 'center',
        originX: 'center',
        originY: 'center'
      });
      customCanvas.add(sampleText);
      customCanvas.renderAll();
    }
  };

  // Load Google Fonts and initialize canvases
  useEffect(() => {
    const loadGoogleFonts = () => {
      if (document.querySelector('link[href*="fonts.googleapis.com"]')) {
        return;
      }

      const fontsLink = document.createElement('link');
      fontsLink.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&family=Pacifico&family=Lobster&family=Great+Vibes&family=Satisfy&family=Kaushan+Script&family=Righteous&family=Fredoka+One&family=Comfortaa:wght@300;400;700&family=Caveat:wght@400;700&family=Patrick+Hand&family=Indie+Flower&family=Amatic+SC:wght@400;700&family=Courgette&family=Gloria+Hallelujah&display=swap';
      fontsLink.rel = 'stylesheet';
      
      document.head.appendChild(fontsLink);
      console.log('Google Fonts loaded successfully');
    };

    const initializeFabricCanvas = () => {
      setTimeout(() => {
        console.log('Initializing Fabric canvases...');
        
        // Initialize main demo canvas
        const fabricCanvasElement = document.getElementById('fabricCanvas');
        if (fabricCanvasElement) {
          console.log('Found fabricCanvas element, initializing...');
          try {
            const canvas = new fabric.Canvas('canvas');
            
            // Set canvas properties to look like a mirror
            canvas.backgroundColor = 'rgba(240, 240, 240, 0.9)';
            canvas.renderAll();

            // Add welcome text
            const welcomeText = new fabric.Text('Welcome to Fotonix Lumina Mirror', {
              left: 300,
              top: 50,
              fontFamily: 'Arial',
              fontSize: 20,
              fill: '#333333',
              textAlign: 'center',
              originX: 'center',
              originY: 'center'
            });
            canvas.add(welcomeText);

            // Add mirror frame effect
            const frame = new fabric.Rect({
              left: 50,
              top: 50,
              width: 500,
              height: 300,
              fill: 'transparent',
              stroke: '#888888',
              strokeWidth: 2,
              rx: 10,
              ry: 10,
              selectable: false
            });
            canvas.add(frame);

            setMainCanvas(canvas);
            console.log('Main canvas initialized successfully');
          } catch (error) {
            console.error('Failed to initialize main demo canvas:', error);
          }
        } else {
          console.log('fabricCanvas element not found');
        }

        // Initialize customization canvas
        const customCanvasElement = document.getElementById('customizationCanvas');
        if (customCanvasElement) {
          console.log('Found customizationCanvas element, initializing...');
          try {
            const customCanvas = new fabric.Canvas('customizationCanvas');
            
            // Set canvas properties to look like a mirror
            customCanvas.backgroundColor = 'rgba(240, 240, 240, 0.9)';
            customCanvas.renderAll();

            // Add initial sample text
            const sampleText = new fabric.Text('Good Vibes Only', {
              left: 150,
              top: 100,
              fontFamily: "'Dancing Script', cursive",
              fontSize: 18,
              fill: '#333333',
              textAlign: 'center',
              originX: 'center',
              originY: 'center'
            });
            customCanvas.add(sampleText);

            setCustomCanvas(customCanvas);
            console.log('Customization canvas initialized successfully');
          } catch (error) {
            console.error('Failed to initialize customization canvas:', error);
          }
        } else {
          console.log('customizationCanvas element not found');
        }
      }, 500);
    };

    // Load resources
    loadGoogleFonts();
    initializeFabricCanvas();

    // Cleanup function
    return () => {
      if (mainCanvas && typeof mainCanvas.dispose === 'function') {
        mainCanvas.dispose();
      }
      if (customCanvas && typeof customCanvas.dispose === 'function') {
        customCanvas.dispose();
      }
    };
  }, []);

  // Default product data
  const defaultProduct = {
    id: 1,
    name: "Fotonix Lxxumina Mirror",
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

  const currentProduct = selectedProduct ? {
    ...defaultProduct,
    ...selectedProduct,
    images: selectedProduct.images || defaultProduct.images,
    features: selectedProduct.features || defaultProduct.features
  } : defaultProduct;

  // Calculate total price based on quantity
  const totalPrice = (parseInt(currentProduct.price.replace('£', '')) * quantity).toString();

  return (
    <div className="product-page">
      {isDragActive && (
        <div
          className="global-drag-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            flexDirection: 'column',
            textAlign: 'center',
            padding: '20px'
          }}
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); try { handleDrop(e); } catch(err) { console.error(err); } }}
        >
          <div style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>Drop image to upload</div>
          <div style={{ fontSize: '14px', opacity: 0.95 }}>We will add it to your customization canvas</div>
        </div>
      )}
      {/* Product Header */}
      <div className="product-header">
        <div className="container">
          <div className="breadcrumb">
            <button 
              onClick={onBack} 
              style={{
                background: 'none',
                border: 'none', 
                color: '#ff1493',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
                font: 'inherit'
              }}
            >
              ← Back to Home
            </button> / <span>Products</span> / <span>{currentProduct.name}</span>
          </div>
        </div>
      </div>

      {/* Product Details */}
      <section className="product-details">
        <div className="container">
          <div className="product-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '30px' }}>
            
            {/* Product Images */}
            <div className="product-images">
              <div className="main-image">
                <div className="product-image-large lumina">
                  {currentProduct.images && currentProduct.images[0] ? currentProduct.images[0] : "LUMINA"}
                </div>
              </div>
              <div className="thumbnail-images">
                {currentProduct.images && currentProduct.images.map((image, index) => (
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
                  <span className="rating-text">(<a href="https://endorsed.review/biz/fotonix" target="_blank" rel="noopener noreferrer" className="underline">{currentProduct.rating}</a>) • <a href="https://endorsed.review/biz/fotonix" target="_blank" rel="noopener noreferrer" className="underline">{currentProduct.reviews} reviews</a></span>
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

            {/* Mirror Customization Panel */}
            <div className="mirror-customization">
              <h3 style={{ color: '#ff1493', marginBottom: '20px' }}>Customize Your Mirror</h3>
              
              {/* Canvas for customization */}
              <div className="customization-canvas">
                <canvas 
                  id="customizationCanvas" 
                  width="300" 
                  height="200" 
                  style={{
                    border: '3px solid #c0c0c0',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #f0f0f0 0%, #d4d4d4 25%, #e8e8e8 50%, #c8c8c8 75%, #f0f0f0 100%)',
                    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                    width: '100%',
                    maxWidth: '300px'
                  }}
                ></canvas>
              </div>

              {/* Font Selection */}
              <div className="font-selection" style={{ marginTop: '20px' }}>
                <h4 style={{ color: '#fff', marginBottom: '15px' }}>Popular Mirror Fonts</h4>
                <div className="font-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <div className="font-item" data-font="Dancing Script" style={{ 
                    padding: '8px', 
                    cursor: 'pointer', 
                    borderRadius: '4px',
                    marginBottom: '5px',
                    fontFamily: "'Dancing Script', cursive",
                    fontSize: '16px',
                    color: '#fff',
                    transition: 'background 0.3s'
                  }}>
                    Good Vibes Only ✨
                  </div>
                  <div className="font-item" data-font="Pacifico" style={{ 
                    padding: '8px', 
                    cursor: 'pointer', 
                    borderRadius: '4px',
                    marginBottom: '5px',
                    fontFamily: "'Pacifico', cursive",
                    fontSize: '16px',
                    color: '#fff',
                    transition: 'background 0.3s'
                  }}>
                    You Look Amazing
                  </div>
                  <div className="font-item" data-font="Lobster" style={{ 
                    padding: '8px', 
                    cursor: 'pointer', 
                    borderRadius: '4px',
                    marginBottom: '5px',
                    fontFamily: "'Lobster', cursive",
                    fontSize: '16px',
                    color: '#fff',
                    transition: 'background 0.3s'
                  }}>
                    Smile Today
                  </div>
                </div>
              </div>

              {/* Customization Controls */}
              <div className="customization-controls" style={{ marginTop: '20px' }}>
                <button 
                  id="addQuoteBtn"
                  onClick={handleAddQuote}
                  style={{
                    background: 'linear-gradient(135deg, #ff1493, #e6127a)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 15px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    width: '100%',
                    marginBottom: '10px',
                    fontSize: '14px'
                  }}
                >
                  Add Selected Quote
                </button>
                <button 
                  id="clearCustomCanvas"
                  onClick={handleClearCustomCanvas}
                  style={{
                    background: 'linear-gradient(135deg, #666, #444)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 15px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    width: '100%',
                    fontSize: '14px'
                  }}
                >
                  Clear Canvas
                </button>
              </div>

              {/* Ask AI + Upload Section */}
              <div className="ai-upload-section" style={{ marginTop: '18px', color: '#fff' }}>
                <h4 style={{ marginBottom: '10px' }}>Use AI to generate your image</h4>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input id="aiPromptInput" type="text" placeholder="Describe silhouette, e.g. 'oak leaf'" style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
                  <button onClick={async () => {
                    const el = document.getElementById('aiPromptInput');
                    const prompt = el ? el.value : '';
                    await handleGenerateSilhouetteWithPrompt(prompt);
                  }}
                  style={{ background: 'linear-gradient(135deg, #2b6df6, #1848c6)', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>
                    Generate
                  </button>
                </div>

                {/* Image upload removed: Ask-AI now supports prompt-only suggestions */}
                <div style={{ fontSize: '13px', opacity: 0.95, marginTop: '8px' }}>
                  Enter a descriptive prompt and click Generate. The AI will produce prompt-based suggestions only — file uploads are disabled.
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
            {currentProduct.features && currentProduct.features.map((feature, index) => (
              <div key={index} className="feature-item">
                <span className="feature-icon">✓</span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Mirror Demo */}
      <section className="mirror-demo">
        <div className="container">
          <h2>Interactive Mirror Experience</h2>
          <p>Experience the Fotonix Lumina Mirror's interface. Try drawing, adding text, or exploring the smart features!</p>
          <div className="demo-container">
            <canvas id="fabricCanvas" width="600" height="400" style={{
              border: '4px solid #c0c0c0',
              borderRadius: '15px',
              background: 'linear-gradient(135deg, #f0f0f0 0%, #d4d4d4 25%, #e8e8e8 50%, #c8c8c8 75%, #f0f0f0 100%)',
              boxShadow: '0 15px 40px rgba(0, 0, 0, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.8), inset 0 -2px 0 rgba(0, 0, 0, 0.1)'
            }}></canvas>
            <div className="demo-controls" style={{
              marginTop: '15px',
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap'
            }}>
        
              <button 
                id="drawModeBtn"
                onClick={handleDrawMode}
                style={{
                  background: 'linear-gradient(135deg, #ff1493, #e6127a)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Draw Mode
              </button>
              <button
                id="generateSilhouetteBtn"
                onClick={handleGenerateSilhouette}
                style={{
                  background: 'linear-gradient(135deg, #2b6df6, #1848c6)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Generate Silhouette
              </button>
              <button 
                id="clearCanvasBtn"
                onClick={handleClearCanvas}
                style={{
                  background: 'linear-gradient(135deg, #666, #444)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
            </div>
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
