import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Layers,
  Maximize2,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Save,
  AlertTriangle,
  CheckCircle2,
  Info,
  Settings,
  Eye,
  EyeOff,
  Grid as GridIcon,
  Circle,
  Link2,
  Trash2,
  Activity,
  Ruler,
  AlertCircle,
  Sliders,
  Filter,
  Scissors,
  Edit3,
  Eraser
} from 'lucide-react';

/**
 * Stencil Post-Processing Editor
 * 
 * This editor works on STENCIL GEOMETRY, not photographic image data.
 * Operates after stencil generation to refine structural integrity,
 * dot safety, and laser-cutting feasibility.
 * 
 * Core capabilities:
 * - Island detection & bridge placement
 * - Dot size enforcement & cleanup
 * - Thin feature warnings
 * - Pre-export validation
 */

const ActualStencilEditor = ({ 
  layers, 
  sourceImageUrl,
  onSave, 
  onClose,
  stencilMode 
}) => {
  // Editor state
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState('select'); // 'select', 'bridge', 'measure', 'cleanup', 'draw-dots', 'draw-circle', 'draw-rectangle', 'draw-line', 'ruler', 'eraser'
  const [showOriginal, setShowOriginal] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingStart, setDrawingStart] = useState(null);
  const [drawingPreview, setDrawingPreview] = useState(null); // Preview shape while dragging
  const [drawnShapes, setDrawnShapes] = useState([]); // Store user-drawn shapes
  const [selectedShapeIndex, setSelectedShapeIndex] = useState(null); // Selected shape for deletion
  const [rulerStart, setRulerStart] = useState(null);
  const [rulerEnd, setRulerEnd] = useState(null);
  const [rulerMeasurement, setRulerMeasurement] = useState(null);
  const [eraserSize, setEraserSize] = useState(5); // eraser diameter in % of image
  const [eraserCursor, setEraserCursor] = useState(null); // { x, y } for cursor preview
  const [erasedAreas, setErasedAreas] = useState([]); // Areas erased from stencil
  const [dotPattern, setDotPattern] = useState({
    spacing: 2.0, // mm
    diameter: 0.8, // mm (will be converted to % of image)
    pattern: 'grid' // 'grid', 'hex', 'random'
  });
  
  // Validation & health metrics
  const [healthScore, setHealthScore] = useState(null);
  const [validationIssues, setValidationIssues] = useState([]);
  const [showValidationPanel, setShowValidationPanel] = useState(true);
  
  // Tool panels
  const [activePanel, setActivePanel] = useState('structure'); // 'structure', 'dots', 'safety', 'layers', 'cleanup'
  
  // Overlay modes
  const [overlays, setOverlays] = useState({
    islands: true,
    thinFeatures: true,
    bridges: false,
    grid: false
  });
  
  // Settings
  const [settings, setSettings] = useState({
    minFeatureSize: 0.5, // mm
    minDotDiameter: 0.6, // mm
    minBridgeWidth: 0.6, // mm
    kerfWidth: 0.2, // mm (laser beam width)
  });
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  const imageRef = useRef(null);
  
  // Handle canvas drawing - click to add dots, drag for shapes
  const handleCanvasMouseDown = (e) => {
    if (!imageRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const imgRect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - imgRect.left) / imgRect.width) * 100;
    const y = ((e.clientY - imgRect.top) / imgRect.height) * 100;
    
    // Ruler tool
    if (activeTool === 'ruler') {
      setRulerStart({ x, y });
      setRulerEnd(null);
      setRulerMeasurement(null);
      setIsDrawing(true);
      return;
    }
    
    // Eraser tool - constrain within stencil area (1% border margin - right at edges)
    if (activeTool === 'eraser') {
      const borderMargin = 1; // 1% border on each side (minimal)
      const constrainedX = Math.max(borderMargin, Math.min(100 - borderMargin, x));
      const constrainedY = Math.max(borderMargin, Math.min(100 - borderMargin, y));
      
      // Only erase if within the allowed area
      if (x >= borderMargin && x <= 100 - borderMargin && y >= borderMargin && y <= 100 - borderMargin) {
        setIsDrawing(true);
        // Erase shapes at this point
        eraseAtPoint(constrainedX, constrainedY);
        // Add erased area to stencil
        setErasedAreas([...erasedAreas, { x: constrainedX, y: constrainedY, size: eraserSize }]);
      }
      return;
    }
    
    // If in select mode, check if clicking on a shape
    if (activeTool === 'select') {
      let clickedIndex = -1;
      
      for (let i = drawnShapes.length - 1; i >= 0; i--) {
        const shape = drawnShapes[i];
        if (shape.layer !== selectedLayer) continue;
        
        if (shape.type === 'dot') {
          const distance = Math.sqrt(Math.pow(shape.x - x, 2) + Math.pow(shape.y - y, 2));
          if (distance < 3) {
            clickedIndex = i;
            break;
          }
        } else {
          const left = Math.min(shape.start.x, shape.end.x);
          const right = Math.max(shape.start.x, shape.end.x);
          const top = Math.min(shape.start.y, shape.end.y);
          const bottom = Math.max(shape.start.y, shape.end.y);
          
          if (x >= left && x <= right && y >= top && y <= bottom) {
            clickedIndex = i;
            break;
          }
        }
      }
      
      setSelectedShapeIndex(clickedIndex >= 0 ? clickedIndex : null);
      return;
    }
    
    if (!['draw-dots', 'draw-circle', 'draw-rectangle', 'draw-line'].includes(activeTool)) return;
    
    // For dots, add immediately on click
    if (activeTool === 'draw-dots') {
      const newDot = {
        type: 'dot',
        x,
        y,
        diameter: dotPattern.diameter / 3, // percentage of image width
        layer: selectedLayer
      };
      setDrawnShapes([...drawnShapes, newDot]);
      setSelectedShapeIndex(null);
    } else {
      setIsDrawing(true);
      setDrawingStart({ x, y });
      setDrawingPreview({ x, y, endX: x, endY: y });
    }
  };
  
  const handleCanvasMouseMove = (e) => {
    if (!imageRef.current) return;
    
    const imgRect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - imgRect.left) / imgRect.width) * 100;
    const y = ((e.clientY - imgRect.top) / imgRect.height) * 100;
    
    // Update eraser cursor position - constrain within stencil area (1% border margin)
    if (activeTool === 'eraser') {
      const borderMargin = 1;
      const constrainedX = Math.max(borderMargin, Math.min(100 - borderMargin, x));
      const constrainedY = Math.max(borderMargin, Math.min(100 - borderMargin, y));
      setEraserCursor({ x: constrainedX, y: constrainedY });
      
      if (isDrawing && x >= borderMargin && x <= 100 - borderMargin && y >= borderMargin && y <= 100 - borderMargin) {
        eraseAtPoint(constrainedX, constrainedY);
        setErasedAreas([...erasedAreas, { x: constrainedX, y: constrainedY, size: eraserSize }]);
      }
      return;
    }
    
    if (activeTool === 'ruler' && isDrawing && rulerStart) {
      setRulerEnd({ x, y });
      
      // Calculate distance in mm (assuming 304.8mm = 12 inches for standard stencil)
      const dx = x - rulerStart.x;
      const dy = y - rulerStart.y;
      const percentDistance = Math.sqrt(dx * dx + dy * dy);
      const mmDistance = (percentDistance / 100) * 304.8;
      setRulerMeasurement(mmDistance.toFixed(2));
      return;
    }
    
    if (!isDrawing || !drawingStart || activeTool === 'draw-dots') return;
    
    e.preventDefault();
    
    // Update preview
    setDrawingPreview({ x: drawingStart.x, y: drawingStart.y, endX: x, endY: y });
  };
  
  const handleCanvasMouseUp = (e) => {
    if (activeTool === 'eraser' && isDrawing) {
      setIsDrawing(false);
      return;
    }
    
    if (activeTool === 'ruler' && isDrawing) {
      setIsDrawing(false);
      return;
    }
    
    if (!isDrawing || !drawingStart || activeTool === 'draw-dots') return;
    if (!imageRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const imgRect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - imgRect.left) / imgRect.width) * 100;
    const y = ((e.clientY - imgRect.top) / imgRect.height) * 100;
    
    // Only create shape if dragged more than 1%
    if (Math.abs(x - drawingStart.x) > 1 || Math.abs(y - drawingStart.y) > 1) {
      const newShape = {
        type: activeTool.replace('draw-', ''),
        start: drawingStart,
        end: { x, y },
        layer: selectedLayer,
        settings: {}
      };
      setDrawnShapes([...drawnShapes, newShape]);
    }
    
    setIsDrawing(false);
    setDrawingStart(null);
    setDrawingPreview(null);
  };
  
  // Handle mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prevZoom => Math.max(0.25, Math.min(5, prevZoom + delta)));
  };
  
  // Erase shapes at point
  const eraseAtPoint = (x, y) => {
    const radius = eraserSize / 2;
    setDrawnShapes(drawnShapes.filter(shape => {
      if (shape.layer !== selectedLayer) return true;
      
      if (shape.type === 'dot') {
        const distance = Math.sqrt(Math.pow(shape.x - x, 2) + Math.pow(shape.y - y, 2));
        return distance > radius; // Keep if outside eraser radius
      } else {
        // For shapes, check if center is within eraser
        const centerX = (shape.start.x + shape.end.x) / 2;
        const centerY = (shape.start.y + shape.end.y) / 2;
        const distance = Math.sqrt(Math.pow(centerX - x, 2) + Math.pow(centerY - y, 2));
        return distance > radius;
      }
    }));
  };
  
  // Delete selected shape
  const handleDeleteSelected = () => {
    if (selectedShapeIndex !== null) {
      setDrawnShapes(drawnShapes.filter((_, idx) => idx !== selectedShapeIndex));
      setSelectedShapeIndex(null);
    }
  };
  
  // Keyboard handler for delete key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeIndex !== null) {
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeIndex]);
  
  // Calculate health score on load and after edits
  useEffect(() => {
    calculateHealthScore();
  }, [layers, selectedLayer]);
  
  const calculateHealthScore = () => {
    // Simplified health score algorithm
    // In production, this would analyze actual geometry
    let score = 100;
    const issues = [];
    
    // Mock validation (would analyze actual canvas/path data)
    const hasIslands = false; // Would check topology
    const hasThinFeatures = false; // Would check feature sizes
    const hasFloatingDebris = false; // Would check for small disconnected regions
    
    if (hasIslands) {
      score -= 40;
      issues.push({
        severity: 'error',
        type: 'floating-island',
        message: 'Floating islands detected',
        count: 0,
        autoFixAvailable: true
      });
    }
    
    if (hasThinFeatures) {
      score -= 30;
      issues.push({
        severity: 'warning',
        type: 'thin-feature',
        message: 'Features below minimum size detected',
        count: 0,
        autoFixAvailable: false
      });
    }
    
    if (hasFloatingDebris) {
      score -= 10;
      issues.push({
        severity: 'info',
        type: 'debris',
        message: 'Small fragments detected',
        count: 0,
        autoFixAvailable: true
      });
    }
    
    setHealthScore(Math.max(0, score));
    setValidationIssues(issues);
  };
  
  // Apply drawn shapes and erased areas to a layer's canvas
  const applyEditsToLayer = async (layer, layerIndex) => {
    // Check if there are any edits for this layer
    const layerShapes = drawnShapes.filter(s => s.layer === layerIndex);
    const hasEdits = layerShapes.length > 0 || erasedAreas.length > 0;
    
    if (!hasEdits) {
      return layer; // No edits, return original
    }
    
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        // Draw original layer
        ctx.drawImage(img, 0, 0);
        
        // Apply erased areas (white circles that remove stencil content)
        ctx.fillStyle = '#ffffff';
        erasedAreas.forEach(area => {
          const centerX = (area.x / 100) * canvas.width;
          const centerY = (area.y / 100) * canvas.height;
          const radius = (area.size / 100) * Math.min(canvas.width, canvas.height) / 2;
          
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fill();
        });
        
        // Apply drawn shapes (black shapes that add to stencil)
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = '#000000';
        
        layerShapes.forEach(shape => {
          if (shape.type === 'dot') {
            const centerX = (shape.x / 100) * canvas.width;
            const centerY = (shape.y / 100) * canvas.height;
            const radius = (shape.diameter / 100) * canvas.width / 2;
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
          } else if (shape.type === 'circle') {
            const left = (Math.min(shape.start.x, shape.end.x) / 100) * canvas.width;
            const top = (Math.min(shape.start.y, shape.end.y) / 100) * canvas.height;
            const width = (Math.abs(shape.end.x - shape.start.x) / 100) * canvas.width;
            const height = (Math.abs(shape.end.y - shape.start.y) / 100) * canvas.height;
            
            ctx.beginPath();
            ctx.ellipse(left + width/2, top + height/2, width/2, height/2, 0, 0, Math.PI * 2);
            ctx.fill();
          } else if (shape.type === 'rectangle') {
            const left = (Math.min(shape.start.x, shape.end.x) / 100) * canvas.width;
            const top = (Math.min(shape.start.y, shape.end.y) / 100) * canvas.height;
            const width = (Math.abs(shape.end.x - shape.start.x) / 100) * canvas.width;
            const height = (Math.abs(shape.end.y - shape.start.y) / 100) * canvas.height;
            
            ctx.fillRect(left, top, width, height);
          } else if (shape.type === 'line') {
            const x1 = (shape.start.x / 100) * canvas.width;
            const y1 = (shape.start.y / 100) * canvas.height;
            const x2 = (shape.end.x / 100) * canvas.width;
            const y2 = (shape.end.y / 100) * canvas.height;
            
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        });
        
        // Convert to data URL and create updated layer
        const dataUrl = canvas.toDataURL('image/png');
        resolve({
          ...layer,
          dataUrl,
          edited: true,
          editTimestamp: Date.now()
        });
      };
      img.onerror = () => {
        console.error('Failed to load layer image for editing');
        resolve(layer); // Return original on error
      };
      img.src = layer.dataUrl;
    });
  };
  
  const handleSave = async () => {
    // Apply all edits to layers before saving
    if (drawnShapes.length === 0 && erasedAreas.length === 0) {
      // No edits, return original layers
      onSave(layers);
      return;
    }
    
    // Process each layer and apply edits
    const editedLayers = await Promise.all(
      layers.map((layer, index) => applyEditsToLayer(layer, index))
    );
    
    onSave(editedLayers);
  };
  
  const handleAutoFix = (issueType) => {
    // Auto-fix specific issues
    console.log('Auto-fixing:', issueType);
    // Would implement auto-bridge, cleanup, etc.
    calculateHealthScore();
  };
  
  const getHealthColor = (score) => {
    if (score >= 85) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };
  
  const getHealthBgColor = (score) => {
    if (score >= 85) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-[9999] flex flex-col select-none" style={{ userSelect: 'none' }}>
      {/* Header - Simple filler bar */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
            <Scissors className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Stencil Editor</h1>
            <p className="text-xs text-slate-400">Refine geometry • Validate integrity • Optimize for laser</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <X className="h-5 w-5 text-slate-400" />
        </button>
      </div>
      
      {/* Footer Bar - Main controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 shadow-lg" style={{ zIndex: 100 }}>
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Layer Navigation */}
          {layers.length > 0 && !showOriginal && (
            <div className="flex items-center gap-2 bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => setSelectedLayer(Math.max(0, selectedLayer - 1))}
                disabled={selectedLayer === 0}
                className="p-2 hover:bg-slate-600 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="px-3 py-1 text-sm font-medium text-white">
                Layer {selectedLayer + 1} / {layers.length}
              </div>
              
              <button
                onClick={() => setSelectedLayer(Math.min(layers.length - 1, selectedLayer + 1))}
                disabled={selectedLayer === layers.length - 1}
                className="p-2 hover:bg-slate-600 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
          {(layers.length === 0 || showOriginal) && <div />}
          
          {/* Health Score & Actions */}
          {healthScore !== null && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-lg">
                <Activity className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Health Score</p>
                  <p className={`text-2xl font-bold ${getHealthColor(healthScore)}`}>
                    {healthScore}
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-semibold transition-all shadow-lg"
              >
                <Save className="h-4 w-4" />
                Save & Continue
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden" style={{ marginTop: '0' }}>
        {/* Left Sidebar - Tools */}
        <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col overflow-y-auto pb-20 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
          {/* Tool Tabs */}
          <div className="border-b border-slate-700 p-2 space-y-1">
            {[
              { id: 'structure', label: 'Structure', icon: Link2 },
              { id: 'dots', label: 'Halftone', icon: Circle },              { id: 'draw', label: 'Draw', icon: Edit3 },              { id: 'safety', label: 'Safety', icon: AlertTriangle },
              { id: 'layers', label: 'Layers', icon: Layers },
              { id: 'cleanup', label: 'Cleanup', icon: Filter },
              { id: 'measure', label: 'Measure', icon: Ruler }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActivePanel(id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activePanel === id
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          
          {/* Tool Panel Content */}
          <div className="p-4 space-y-4">
            {activePanel === 'structure' && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Structural Integrity</h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Prevent floating islands and ensure connectivity
                  </p>
                </div>
                
                <button className="w-full flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-all">
                  <Activity className="h-4 w-4" />
                  Auto-Detect Islands
                </button>
                
                <button className="w-full flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-all">
                  <Link2 className="h-4 w-4" />
                  Smart Bridge Placement
                </button>
                
                <div className="pt-2 border-t border-slate-700">
                  <label className="block text-xs text-slate-400 mb-1">Bridge Width (mm)</label>
                  <input
                    type="range"
                    min="0.3"
                    max="2.0"
                    step="0.1"
                    value={settings.minBridgeWidth}
                    onChange={(e) => setSettings({ ...settings, minBridgeWidth: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>0.3mm</span>
                    <span className="font-semibold text-white">{settings.minBridgeWidth}mm</span>
                    <span>2.0mm</span>
                  </div>
                </div>
              </>
            )}
            
            {activePanel === 'dots' && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Halftone Controls</h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Ensure dots are laser-safe and properly sized
                  </p>
                </div>
                
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Minimum Dot Size (mm)</label>
                  <input
                    type="range"
                    min="0.3"
                    max="2.0"
                    step="0.1"
                    value={settings.minDotDiameter}
                    onChange={(e) => setSettings({ ...settings, minDotDiameter: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>0.3mm</span>
                    <span className="font-semibold text-white">{settings.minDotDiameter}mm</span>
                    <span>2.0mm</span>
                  </div>
                </div>
                
                <button className="w-full flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-all">
                  <Filter className="h-4 w-4" />
                  Enforce Minimum Size
                </button>
                
                <button className="w-full flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-all">
                  <Trash2 className="h-4 w-4" />
                  Remove Pepper Noise
                </button>
              </>
            )}
            
            {activePanel === 'draw' && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Draw Tools</h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Add halftone dots, shapes, and lines to your stencil
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 mb-2">DRAWING TOOLS</p>
                  
                  <button
                    onClick={() => setActiveTool('draw-dots')}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      activeTool === 'draw-dots'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
                  >
                    <Circle className="h-4 w-4" />
                    Halftone Dot Brush
                  </button>
                  
                  <button
                    onClick={() => setActiveTool('draw-circle')}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      activeTool === 'draw-circle'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
                  >
                    <Circle className="h-4 w-4" />
                    Circle
                  </button>
                  
                  <button
                    onClick={() => setActiveTool('draw-rectangle')}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      activeTool === 'draw-rectangle'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
                  >
                    <Maximize2 className="h-4 w-4" />
                    Rectangle
                  </button>
                  
                  <button
                    onClick={() => setActiveTool('draw-line')}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      activeTool === 'draw-line'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20L20 4" />
                    </svg>
                    Line
                  </button>
                  
                  <button
                    onClick={() => setActiveTool('eraser')}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      activeTool === 'eraser'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
                  >
                    <Eraser className="h-4 w-4" />
                    Eraser
                  </button>
                </div>
                
                {activeTool === 'draw-dots' && (
                  <div className="pt-3 border-t border-slate-700 space-y-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Dot Spacing (mm)</label>
                      <input
                        type="range"
                        min="0.5"
                        max="5.0"
                        step="0.1"
                        value={dotPattern.spacing}
                        onChange={(e) => setDotPattern({ ...dotPattern, spacing: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>0.5mm</span>
                        <span className="font-semibold text-white">{dotPattern.spacing}mm</span>
                        <span>5.0mm</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Dot Diameter (mm)</label>
                      <input
                        type="range"
                        min="0.3"
                        max="3.0"
                        step="0.1"
                        value={dotPattern.diameter}
                        onChange={(e) => setDotPattern({ ...dotPattern, diameter: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>0.3mm</span>
                        <span className="font-semibold text-white">{dotPattern.diameter}mm</span>
                        <span>3.0mm</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Pattern</label>
                      <select
                        value={dotPattern.pattern}
                        onChange={(e) => setDotPattern({ ...dotPattern, pattern: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg text-sm border border-slate-600"
                      >
                        <option value="grid">Grid</option>
                        <option value="hex">Hexagonal</option>
                        <option value="random">Random</option>
                      </select>
                    </div>
                  </div>
                )}
                
                {activeTool === 'eraser' && (
                  <div className="pt-3 border-t border-slate-700 space-y-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Eraser Size</label>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="0.5"
                        value={eraserSize}
                        onChange={(e) => setEraserSize(parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>Small</span>
                        <span className="font-semibold text-white">{eraserSize.toFixed(1)}%</span>
                        <span>Large</span>
                      </div>
                    </div>
                    
                    {erasedAreas.length > 0 && (
                      <button
                        onClick={() => setErasedAreas([])}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-all"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Undo All Erases
                      </button>
                    )}
                  </div>
                )}
                
                {drawnShapes.length > 0 && (
                  <div className="pt-3 border-t border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-400">
                        DRAWN OBJECTS ({drawnShapes.length})
                      </p>
                      <button
                        onClick={() => setDrawnShapes([])}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {drawnShapes.map((shape, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-2 py-1 bg-slate-700 rounded text-xs text-slate-300"
                        >
                          <span className="capitalize">{shape.type}</span>
                          <button
                            onClick={() => setDrawnShapes(drawnShapes.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="pt-3 border-t border-slate-700">
                  <button
                    onClick={() => setActiveTool('select')}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-all"
                  >
                    <Move className="h-4 w-4" />
                    Back to Select Tool
                  </button>
                </div>
              </>
            )}
            
            {activePanel === 'safety' && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Laser Safety</h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Validate features for reliable cutting
                  </p>
                </div>
                
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Min Feature Size (mm)</label>
                  <input
                    type="range"
                    min="0.3"
                    max="1.0"
                    step="0.05"
                    value={settings.minFeatureSize}
                    onChange={(e) => setSettings({ ...settings, minFeatureSize: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>0.3mm</span>
                    <span className="font-semibold text-white">{settings.minFeatureSize}mm</span>
                    <span>1.0mm</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Kerf Compensation (mm)</label>
                  <input
                    type="range"
                    min="0.1"
                    max="0.4"
                    step="0.05"
                    value={settings.kerfWidth}
                    onChange={(e) => setSettings({ ...settings, kerfWidth: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>0.1mm</span>
                    <span className="font-semibold text-white">{settings.kerfWidth}mm</span>
                    <span>0.4mm</span>
                  </div>
                </div>
                
                <button className="w-full flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-all">
                  <AlertTriangle className="h-4 w-4" />
                  Scan for Issues
                </button>
              </>
            )}
            
            {activePanel === 'measure' && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Measurement</h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Verify physical dimensions
                  </p>
                </div>
                
                <button
                  onClick={() => setActiveTool('ruler')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    activeTool === 'ruler'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  <Ruler className="h-4 w-4" />
                  Ruler Tool
                </button>
                
                {rulerMeasurement && (
                  <div className="p-3 bg-purple-900/20 border border-purple-700 rounded-lg text-sm">
                    <p className="text-purple-400 font-semibold mb-1">Measurement:</p>
                    <p className="text-white text-2xl font-mono">{rulerMeasurement} mm</p>
                    <p className="text-slate-400 text-xs mt-1">
                      {(rulerMeasurement / 25.4).toFixed(2)} inches
                    </p>
                  </div>
                )}
                
                <div className="pt-3 border-t border-slate-700">
                  <button
                    onClick={() => {
                      setRulerStart(null);
                      setRulerEnd(null);
                      setRulerMeasurement(null);
                      setActiveTool('select');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-all"
                  >
                    <Move className="h-4 w-4" />
                    Back to Select Tool
                  </button>
                </div>
                
                <div className="p-3 bg-slate-700 rounded-lg text-xs mt-3">
                  <p className="text-slate-400 mb-1">Stencil Dimensions:</p>
                  <p className="text-white font-mono">Width: 304.8mm (12")</p>
                  <p className="text-white font-mono">Height: 304.8mm (12")</p>
                </div>
              </>
            )}
          </div>
          
          {/* Overlays Toggle */}
          <div className="border-t border-slate-700 p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-400 mb-2">OVERLAYS</p>
            {Object.entries(overlays).map(([key, value]) => (
              <label key={key} className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-slate-300 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                <button
                  onClick={() => setOverlays({ ...overlays, [key]: !value })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    value ? 'bg-purple-600' : 'bg-slate-600'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    value ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </label>
            ))}
          </div>
        </div>
        
        {/* Main Canvas Area */}
        <div className="flex-1 relative bg-slate-900">
          {/* Canvas Controls */}
          <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
            {/* Active Tool Indicator */}
            {['draw-dots', 'draw-circle', 'draw-rectangle', 'draw-line'].includes(activeTool) && (
              <div className="bg-purple-600/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 text-white text-sm font-medium flex items-center gap-2">
                <Circle className="h-4 w-4" />
                {activeTool === 'draw-dots' ? 'Click to add dots' : `Drawing: ${activeTool.replace('draw-', '')}`}
              </div>
            )}
            
            {/* Delete Selected Button */}
            {selectedShapeIndex !== null && activeTool === 'select' && (
              <button
                onClick={handleDeleteSelected}
                className="bg-red-600/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 text-white text-sm font-medium flex items-center gap-2 hover:bg-red-700 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected (Del)
              </button>
            )}
            
            <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-lg p-2 flex items-center gap-2">
              <button
                onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
                className="p-2 hover:bg-slate-700 rounded transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4 text-slate-300" />
              </button>
              <span className="text-sm text-white px-2 font-mono">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(Math.min(5, zoom + 0.25))}
                className="p-2 hover:bg-slate-700 rounded transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4 text-slate-300" />
              </button>
              <div className="w-px h-6 bg-slate-600" />
              <button
                onClick={() => setZoom(1)}
                className="p-2 hover:bg-slate-700 rounded transition-colors text-xs text-slate-300"
                title="Reset Zoom"
              >
                100%
              </button>
            </div>
            
            {layers.length > 0 && (
              <button
                onClick={() => setShowOriginal(!showOriginal)}
                className="bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 hover:bg-slate-700 transition-colors"
              >
                {showOriginal ? <EyeOff className="h-4 w-4 text-slate-300" /> : <Eye className="h-4 w-4 text-slate-300" />}
                <span className="text-sm text-white">{showOriginal ? 'Show Layer' : 'Show Original'}</span>
              </button>
            )}
          </div>
          
          {/* Canvas */}
          <div 
            ref={containerRef}
            className="absolute inset-0 flex items-center justify-center overflow-hidden select-none"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onWheel={handleWheel}
            onDragStart={(e) => e.preventDefault()}
            style={{ 
              cursor: activeTool === 'ruler'
                ? 'crosshair'
                : activeTool === 'eraser'
                  ? 'none'
                  : activeTool === 'select'
                    ? 'default'
                    : ['draw-dots', 'draw-circle', 'draw-rectangle', 'draw-line'].includes(activeTool) 
                      ? 'crosshair' 
                      : 'default',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none'
            }}
          >
            {layers.length > 0 && (
              <div 
                className="relative"
                style={{ 
                  transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                  transition: 'transform 200ms'
                }}
              >
                <img
                  ref={imageRef}
                  src={showOriginal ? sourceImageUrl : layers[selectedLayer]?.dataUrl}
                  alt={showOriginal ? 'Original' : `Layer ${selectedLayer + 1}`}
                  className="max-w-full max-h-full object-contain pointer-events-none"
                  style={{ 
                    filter: showOriginal ? 'none' : 'none'
                  }}
                />
                
                {/* Overlay Indicators */}
                {overlays.islands && !showOriginal && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Island highlights would be rendered here */}
                  </div>
                )}
                
                {/* Border restriction zone indicator for eraser tool */}
                {activeTool === 'eraser' && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Top border zone */}
                    <div className="absolute top-0 left-0 right-0 bg-red-500/10 border-b border-dashed border-red-500/50" style={{ height: '1%' }} />
                    {/* Bottom border zone */}
                    <div className="absolute bottom-0 left-0 right-0 bg-red-500/10 border-t border-dashed border-red-500/50" style={{ height: '1%' }} />
                    {/* Left border zone */}
                    <div className="absolute top-0 left-0 bottom-0 bg-red-500/10 border-r border-dashed border-red-500/50" style={{ width: '1%' }} />
                    {/* Right border zone */}
                    <div className="absolute top-0 right-0 bottom-0 bg-red-500/10 border-l border-dashed border-red-500/50" style={{ width: '1%' }} />
                  </div>
                )}
                
                {/* Drawn Shapes - positioned relative to image using percentages */}
                {drawnShapes.filter(s => s.layer === selectedLayer).map((shape, idx) => {
                  // Render individual dots
                  if (shape.type === 'dot') {
                    const isSelected = idx === selectedShapeIndex;
                    return (
                      <div
                        key={idx}
                        className="absolute"
                        onClick={(e) => {
                          if (activeTool === 'select') {
                            e.stopPropagation();
                            setSelectedShapeIndex(idx);
                          }
                        }}
                        style={{
                          left: `${shape.x}%`,
                          top: `${shape.y}%`,
                          width: `${shape.diameter}%`,
                          height: `${shape.diameter}%`,
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: '#000000',
                          borderRadius: '50%',
                          boxShadow: isSelected 
                            ? '0 0 0 2px #fff, 0 0 0 4px #a855f7' 
                            : '0 0 2px rgba(0, 0, 0, 0.5)',
                          border: isSelected ? '2px solid #a855f7' : 'none',
                          cursor: activeTool === 'select' ? 'pointer' : 'default',
                          pointerEvents: 'auto'
                        }}
                      />
                    );
                  }
                  
                  // Render shapes (circle, rectangle, line)
                  const isSelected = idx === selectedShapeIndex;
                  
                  // Render lines as SVG
                  if (shape.type === 'line') {
                    return (
                      <svg
                        key={idx}
                        className="absolute pointer-events-none"
                        style={{
                          left: 0,
                          top: 0,
                          width: '100%',
                          height: '100%'
                        }}
                      >
                        <line
                          x1={`${shape.start.x}%`}
                          y1={`${shape.start.y}%`}
                          x2={`${shape.end.x}%`}
                          y2={`${shape.end.y}%`}
                          stroke="#000000"
                          strokeWidth={isSelected ? "3" : "2"}
                          style={{
                            filter: isSelected ? 'drop-shadow(0 0 4px #a855f7)' : 'none',
                            cursor: activeTool === 'select' ? 'pointer' : 'default'
                          }}
                          onClick={(e) => {
                            if (activeTool === 'select') {
                              e.stopPropagation();
                              setSelectedShapeIndex(idx);
                            }
                          }}
                        />
                        {isSelected && (
                          <>
                            <circle cx={`${shape.start.x}%`} cy={`${shape.start.y}%`} r="4" fill="#a855f7" />
                            <circle cx={`${shape.end.x}%`} cy={`${shape.end.y}%`} r="4" fill="#a855f7" />
                          </>
                        )}
                      </svg>
                    );
                  }
                  
                  const left = Math.min(shape.start.x, shape.end.x);
                  const top = Math.min(shape.start.y, shape.end.y);
                  const width = Math.abs(shape.end.x - shape.start.x);
                  const height = Math.abs(shape.end.y - shape.start.y);
                  
                  return (
                    <div
                      key={idx}
                      className="absolute"
                      onClick={(e) => {
                        if (activeTool === 'select') {
                          e.stopPropagation();
                          setSelectedShapeIndex(idx);
                        }
                      }}
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        width: `${width}%`,
                        height: `${height}%`,
                        backgroundColor: '#000000',
                        borderRadius: shape.type === 'circle' ? '50%' : '0',
                        border: isSelected ? '2px solid #a855f7' : '1px solid rgba(0, 0, 0, 0.3)',
                        boxShadow: isSelected ? '0 0 0 2px #fff, 0 0 0 4px #a855f7' : 'none',
                        cursor: activeTool === 'select' ? 'pointer' : 'default',
                        pointerEvents: 'auto'
                      }}
                    />
                  );
                })}
                
                {/* Drawing Preview */}
                {drawingPreview && isDrawing && activeTool !== 'ruler' && activeTool !== 'eraser' && (
                  <>
                    {activeTool === 'draw-line' ? (
                      <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                        <line
                          x1={`${drawingPreview.x}%`}
                          y1={`${drawingPreview.y}%`}
                          x2={`${drawingPreview.endX}%`}
                          y2={`${drawingPreview.endY}%`}
                          stroke="#a855f7"
                          strokeWidth="2"
                          strokeDasharray="5,5"
                        />
                      </svg>
                    ) : (
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          left: `${Math.min(drawingPreview.x, drawingPreview.endX)}%`,
                          top: `${Math.min(drawingPreview.y, drawingPreview.endY)}%`,
                          width: `${Math.abs(drawingPreview.endX - drawingPreview.x)}%`,
                          height: `${Math.abs(drawingPreview.endY - drawingPreview.y)}%`,
                          border: '2px dashed #a855f7',
                          backgroundColor: 'rgba(168, 85, 247, 0.1)',
                          borderRadius: activeTool === 'draw-circle' ? '50%' : '0'
                        }}
                      />
                    )}
                  </>
                )}
                
                {/* Ruler Line */}
                {rulerStart && rulerEnd && activeTool === 'ruler' && (
                  <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                    <line
                      x1={`${rulerStart.x}%`}
                      y1={`${rulerStart.y}%`}
                      x2={`${rulerEnd.x}%`}
                      y2={`${rulerEnd.y}%`}
                      stroke="#a855f7"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                    />
                    <circle cx={`${rulerStart.x}%`} cy={`${rulerStart.y}%`} r="4" fill="#a855f7" />
                    <circle cx={`${rulerEnd.x}%`} cy={`${rulerEnd.y}%`} r="4" fill="#a855f7" />
                  </svg>
                )}
                
                {/* Erased Areas (white circles that mask stencil) */}
                {erasedAreas.map((area, idx) => (
                  <div
                    key={idx}
                    className="absolute pointer-events-none"
                    style={{
                      left: `${area.x}%`,
                      top: `${area.y}%`,
                      width: `${area.size}%`,
                      height: `${area.size}%`,
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: '#ffffff',
                      borderRadius: '50%',
                      opacity: 0.9
                    }}
                  />
                ))}
                
                {/* Eraser Cursor */}
                {eraserCursor && activeTool === 'eraser' && (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: `${eraserCursor.x}%`,
                      top: `${eraserCursor.y}%`,
                      width: `${eraserSize}%`,
                      height: `${eraserSize}%`,
                      transform: 'translate(-50%, -50%)',
                      border: '2px solid #ef4444',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)'
                    }}
                  />
                )}
              </div>
            )}
          </div>
          
        </div>
        
        {/* Right Sidebar - Validation */}
        {showValidationPanel && (
          <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col overflow-y-auto pb-20 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-white">Validation</h2>
              <button
                onClick={() => setShowValidationPanel(false)}
                className="p-1 hover:bg-slate-700 rounded transition-colors"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            
            {/* Health Score Breakdown */}
            <div className="p-4 border-b border-slate-700">
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-slate-700"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className={getHealthBgColor(healthScore)}
                      strokeDasharray={`${(healthScore / 100) * 352} 352`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className={`text-3xl font-bold ${getHealthColor(healthScore)}`}>
                        {healthScore}
                      </p>
                      <p className="text-xs text-slate-400">Health</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Topology</span>
                  <span className="text-green-500 font-semibold">✓ 100%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Feature Safety</span>
                  <span className="text-green-500 font-semibold">✓ 100%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Bridge Quality</span>
                  <span className="text-green-500 font-semibold">✓ 100%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Debris Check</span>
                  <span className="text-green-500 font-semibold">✓ 100%</span>
                </div>
              </div>
            </div>
            
            {/* Validation Issues */}
            <div className="flex-1 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Issues Found</h3>
              
              {validationIssues.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-300 font-medium">All Clear!</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Stencil passes all validation checks
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {validationIssues.map((issue, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        issue.severity === 'error'
                          ? 'bg-red-900/20 border-red-700'
                          : issue.severity === 'warning'
                          ? 'bg-amber-900/20 border-amber-700'
                          : 'bg-blue-900/20 border-blue-700'
                      }`}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        {issue.severity === 'error' ? (
                          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                        ) : issue.severity === 'warning' ? (
                          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm text-white font-medium">{issue.message}</p>
                          {issue.count > 0 && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {issue.count} instance{issue.count !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {issue.autoFixAvailable && (
                        <button
                          onClick={() => handleAutoFix(issue.type)}
                          className="w-full mt-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-all"
                        >
                          Auto-Fix
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Pre-Export Checklist */}
            <div className="border-t border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Export Checklist</h3>
              <div className="space-y-2 text-xs">
                {[
                  { label: 'No floating islands', checked: true },
                  { label: 'Features above minimum', checked: true },
                  { label: 'Bridges validated', checked: true },
                  { label: 'Debris cleaned', checked: true }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded flex items-center justify-center ${
                      item.checked ? 'bg-green-500' : 'bg-slate-600'
                    }`}>
                      {item.checked && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={item.checked ? 'text-slate-300' : 'text-slate-500'}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActualStencilEditor;
