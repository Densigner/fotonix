/**
 * StencilEditor - Professional dual-panel image editor for stencil creation
 * 
 * Features:
 * - Dual panel view: original (left) vs working (right)
 * - Pan and zoom with synchronized views
 * - History system with undo/redo (max 50 states)
 * - Brush and eraser tools
 * - Selection tools: Lasso, Rectangle, Ellipse with marching ants
 * - Clean toolbar and adjustments panel
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Undo2, Redo2, ZoomIn, ZoomOut, Move, Paintbrush, Eraser,
  RotateCcw, Check, Maximize2, Minimize2, Eye, EyeOff,
  Sun, Contrast, Sliders, ChevronLeft, ChevronRight,
  Lasso, Square, Circle, Wand2, Trash2, PaintBucket,
  Plus, Minus, Sparkles, RefreshCw, Zap, Wind, Layers,
  Minimize, Grid3X3, Play, AlertTriangle, Link, Scan,
  Activity, Shield, ShieldAlert, ShieldCheck, Crosshair,
  Scissors, Package, Download, ShoppingCart, Edit3
} from 'lucide-react';

const MAX_HISTORY = 50;

export default function StencilEditor({ 
  isOpen, 
  onClose, 
  imageUrl, 
  onApply,
  isDarkMode = true 
}) {
  // Canvas refs
  const originalCanvasRef = useRef(null);
  const workingCanvasRef = useRef(null);
  const stencilCanvasRef = useRef(null); // Live stencil preview canvas
  const selectionCanvasRef = useRef(null); // Overlay canvas for selection visualization
  const containerRef = useRef(null);
  const marchingAntsRef = useRef(0); // Animation frame offset
  const animationFrameRef = useRef(null);
  const stencilUpdateTimeoutRef = useRef(null); // Debounce stencil updates
  
  // Image state
  const [originalImage, setOriginalImage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // View state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // Tool state
  const [activeTool, setActiveTool] = useState('brush'); // 'brush', 'eraser', 'pan', 'lasso', 'marquee-rect', 'marquee-ellipse'
  const [brushSize, setBrushSize] = useState(20);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushHardness, setBrushHardness] = useState(100);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState(null);
  
  // Selection state
  const [selectionMask, setSelectionMask] = useState(null); // ImageData with alpha channel for selection
  const [selectionPath, setSelectionPath] = useState([]); // Points for current selection being drawn
  const [selectionStart, setSelectionStart] = useState(null); // Start point for marquee tools
  const [hasSelection, setHasSelection] = useState(false);
  const [isAddingToSelection, setIsAddingToSelection] = useState(false); // Shift key held
  const [selectionPixelCount, setSelectionPixelCount] = useState(0);
  
  // Magic wand settings
  const [magicWandTolerance, setMagicWandTolerance] = useState(32);
  
  // Selection modifier settings
  const [expandAmount, setExpandAmount] = useState(5);
  const [contractAmount, setContractAmount] = useState(5);
  const [featherAmount, setFeatherAmount] = useState(3);
  
  // Constrain to selection
  const [constrainToSelection, setConstrainToSelection] = useState(true);
  
  // History state
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // UI state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAdjustments, setShowAdjustments] = useState(true);
  
  // Adjustment values
  const [adjustments, setAdjustments] = useState({
    brightness: 0,
    contrast: 0,
    saturation: 0
  });
  
  // Image enhancement settings
  const [sharpenAmount, setSharpenAmount] = useState(0);
  const [noiseReduction, setNoiseReduction] = useState(0);
  const [posterizeLevels, setPosterizeLevels] = useState(8);
  const [simplifyThreshold, setSimplifyThreshold] = useState(3);
  const [gradientMode, setGradientMode] = useState('none'); // 'none', 'dither', 'halftone'
  const [halftoneSize, setHalftoneSize] = useState(4);
  // Stencil style selection (used when saving/exporting stencils)
  const [stencilStyle, setStencilStyle] = useState('threshold'); // 'am-halftone', 'fm-halftone', 'threshold', 'dither', 'line'
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Store base image for live adjustments
  const baseImageDataRef = useRef(null);
  
  // Stencil analysis state
  const [showStencilAnalysis, setShowStencilAnalysis] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [showIslands, setShowIslands] = useState(true);
  const [showWeakBridges, setShowWeakBridges] = useState(true);
  const [bridgeSuggestions, setBridgeSuggestions] = useState([]);
  const [bridgeWidth, setBridgeWidth] = useState(3);
  const [structuralHealth, setStructuralHealth] = useState(null); // 0-100 score
  const analysisCanvasRef = useRef(null); // Overlay for analysis visualization
  
  // Live stencil preview settings
  const [stencilThreshold, setStencilThreshold] = useState(128); // 0-255 threshold for B&W conversion
  const [stencilInverted, setStencilInverted] = useState(false); // Invert black/white
  const [stencilMaterialColor, setStencilMaterialColor] = useState('#4a5568'); // Stencil material appearance
  const [showStencilCutouts, setShowStencilCutouts] = useState(true); // Show what will be cut
  
  // Extracted stencils (each one is a purchasable item)
  const [extractedStencils, setExtractedStencils] = useState([]);
  const [selectedStencilId, setSelectedStencilId] = useState(null); // For highlighting in gallery
  const stencilIdCounter = useRef(1);

  // Load image when opened
  useEffect(() => {
    if (isOpen && imageUrl) {
      setIsLoading(true);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setOriginalImage(img);
        setIsLoading(false);
        // Reset state
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setHistory([]);
        setHistoryIndex(-1);
        setAdjustments({ brightness: 0, contrast: 0, saturation: 0 });
        setSelectionMask(null);
        setHasSelection(false);
        setSelectionPath([]);
        // Reset enhancement values
        setSharpenAmount(0);
        setNoiseReduction(0);
        setPosterizeLevels(8);
        setSimplifyThreshold(3);
        setGradientMode('none');
        setHalftoneSize(4);
        baseImageDataRef.current = null;
        // Reset stencil analysis
        setShowStencilAnalysis(false);
        setAnalysisResults(null);
        setBridgeSuggestions([]);
        setStructuralHealth(null);
        // Reset extracted stencils
        setExtractedStencils([]);
        setSelectedStencilId(null);
        stencilIdCounter.current = 1;
      };
      img.onerror = () => {
        console.error('Failed to load image');
        setIsLoading(false);
      };
      img.src = imageUrl;
    }
  }, [isOpen, imageUrl]);

  // Initialize canvases when image loads
  useEffect(() => {
    if (!originalImage || !originalCanvasRef.current || !workingCanvasRef.current || !selectionCanvasRef.current || !stencilCanvasRef.current) return;
    
    const setupCanvas = (canvas) => {
      canvas.width = originalImage.width;
      canvas.height = originalImage.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(originalImage, 0, 0);
      return ctx;
    };
    
    setupCanvas(originalCanvasRef.current);
    setupCanvas(workingCanvasRef.current);
    
    // Setup selection overlay canvas
    const selCanvas = selectionCanvasRef.current;
    selCanvas.width = originalImage.width;
    selCanvas.height = originalImage.height;
    
    // Setup stencil preview canvas
    const stencilCanvas = stencilCanvasRef.current;
    stencilCanvas.width = originalImage.width;
    stencilCanvas.height = originalImage.height;
    
    // Save initial state to history
    saveToHistory();
  }, [originalImage]);

  // Marching ants animation
  useEffect(() => {
    if (!hasSelection || !selectionCanvasRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Clear the selection canvas when there's no selection
      if (selectionCanvasRef.current && !hasSelection) {
        const ctx = selectionCanvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, selectionCanvasRef.current.width, selectionCanvasRef.current.height);
      }
      return;
    }

    const animate = () => {
      marchingAntsRef.current = (marchingAntsRef.current + 0.5) % 16;
      drawSelectionOverlay();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [hasSelection, selectionMask]);

  // Save current state to history (defined early to avoid temporal dead zone issues)
  const saveToHistory = useCallback(() => {
    if (!workingCanvasRef.current) return;
    
    const canvas = workingCanvasRef.current;
    const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    
    setHistory(prev => {
      // Remove any future states if we're not at the end
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(imageData);
      
      // Limit history size
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  // Helper function to apply stencil style conversion to image data
  // Returns an array of booleans indicating if each pixel should be black (material)
  const applyStencilStyle = useCallback((sourceData, width, height, style, threshold, inverted, dotSize) => {
    const result = new Uint8Array(width * height);
    
    // Get luminance at pixel index
    const getLum = (i) => sourceData[i] * 0.299 + sourceData[i + 1] * 0.587 + sourceData[i + 2] * 0.114;

    switch (style) {
      case 'threshold':
      default: {
        for (let i = 0; i < sourceData.length; i += 4) {
          const lum = getLum(i);
          let isBlack = lum < threshold;
          if (inverted) isBlack = !isBlack;
          result[i / 4] = isBlack ? 1 : 0;
        }
        break;
      }

      case 'dither': {
        const lumArray = new Float32Array(width * height);
        for (let i = 0; i < sourceData.length; i += 4) {
          lumArray[i / 4] = getLum(i);
        }

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const oldLum = lumArray[idx];
            const newLum = oldLum < threshold ? 0 : 255;
            const error = oldLum - newLum;

            let isBlack = newLum === 0;
            if (inverted) isBlack = !isBlack;
            result[idx] = isBlack ? 1 : 0;

            if (x + 1 < width) lumArray[idx + 1] += error * 7 / 16;
            if (y + 1 < height) {
              if (x > 0) lumArray[idx + width - 1] += error * 3 / 16;
              lumArray[idx + width] += error * 5 / 16;
              if (x + 1 < width) lumArray[idx + width + 1] += error * 1 / 16;
            }
          }
        }
        break;
      }

      case 'am-halftone': {
        const dotSpacing = Math.max(4, Math.round(dotSize * 2));
        
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const pixelIdx = idx * 4;
            const lum = getLum(pixelIdx);
            
            const cellX = x % dotSpacing;
            const cellY = y % dotSpacing;
            const centerDist = Math.sqrt(
              Math.pow(cellX - dotSpacing / 2, 2) + 
              Math.pow(cellY - dotSpacing / 2, 2)
            );
            
            const maxRadius = dotSpacing / 2;
            const normalizedLum = lum / 255;
            const dotRadius = maxRadius * (1 - normalizedLum) * (threshold / 128);
            
            let isBlack = centerDist < dotRadius;
            if (inverted) isBlack = !isBlack;
            result[idx] = isBlack ? 1 : 0;
          }
        }
        break;
      }

      case 'fm-halftone': {
        // Use seeded random for consistency
        const seedRandom = (seed) => {
          const x = Math.sin(seed) * 10000;
          return x - Math.floor(x);
        };
        
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const pixelIdx = idx * 4;
            const lum = getLum(pixelIdx);
            
            const noise = seedRandom(idx * 9999 + 12345) * 255;
            const thresholdVal = (lum / 255) * 255;
            let isBlack = noise > thresholdVal * (threshold / 128);
            if (inverted) isBlack = !isBlack;
            result[idx] = isBlack ? 1 : 0;
          }
        }
        break;
      }

      case 'line': {
        const lineSpacing = Math.max(3, Math.round(dotSize * 1.5));
        
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const pixelIdx = idx * 4;
            const lum = getLum(pixelIdx);
            
            const lineY = y % lineSpacing;
            const lineCenterDist = Math.abs(lineY - lineSpacing / 2);
            
            const maxThickness = lineSpacing / 2;
            const normalizedLum = lum / 255;
            const lineThickness = maxThickness * (1 - normalizedLum) * (threshold / 128);
            
            let isBlack = lineCenterDist < lineThickness;
            if (inverted) isBlack = !isBlack;
            result[idx] = isBlack ? 1 : 0;
          }
        }
        break;
      }
    }

    return result;
  }, []);

  // Update live stencil preview (converts working canvas to stencil)
  const updateStencilPreview = useCallback(() => {
    if (!workingCanvasRef.current || !stencilCanvasRef.current) return;

    const srcCanvas = workingCanvasRef.current;
    const stencilCanvas = stencilCanvasRef.current;
    const srcCtx = srcCanvas.getContext('2d');
    const stencilCtx = stencilCanvas.getContext('2d');
    const width = srcCanvas.width;
    const height = srcCanvas.height;

    // Get source image data
    const imageData = srcCtx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Create stencil output
    const stencilData = stencilCtx.createImageData(width, height);
    const sData = stencilData.data;

    // Parse material color once
    const hex = stencilMaterialColor.slice(1);
    const matR = parseInt(hex.slice(0, 2), 16);
    const matG = parseInt(hex.slice(2, 4), 16);
    const matB = parseInt(hex.slice(4, 6), 16);

    // Apply stencil style conversion
    const blackMask = applyStencilStyle(data, width, height, stencilStyle, stencilThreshold, stencilInverted, halftoneSize);

    // Convert mask to pixels
    for (let i = 0; i < blackMask.length; i++) {
      const pixelIdx = i * 4;
      if (blackMask[i]) {
        // Material (black in export, colored in preview)
        sData[pixelIdx] = matR;
        sData[pixelIdx + 1] = matG;
        sData[pixelIdx + 2] = matB;
        sData[pixelIdx + 3] = 255;
      } else {
        // Cutout (white/transparent)
        if (showStencilCutouts) {
          sData[pixelIdx] = 255;
          sData[pixelIdx + 1] = 255;
          sData[pixelIdx + 2] = 255;
          sData[pixelIdx + 3] = 200;
        } else {
          sData[pixelIdx + 3] = 0;
        }
      }
    }

    stencilCtx.putImageData(stencilData, 0, 0);
  }, [stencilThreshold, stencilInverted, stencilMaterialColor, showStencilCutouts, stencilStyle, halftoneSize, applyStencilStyle]);

  // Debounced stencil update - call this after any edit
  const triggerStencilUpdate = useCallback(() => {
    if (stencilUpdateTimeoutRef.current) {
      clearTimeout(stencilUpdateTimeoutRef.current);
    }
    stencilUpdateTimeoutRef.current = setTimeout(() => {
      updateStencilPreview();
    }, 50); // 50ms debounce for smooth performance
  }, [updateStencilPreview]);

  // Update stencil preview when stencil settings change
  useEffect(() => {
    if (originalImage && stencilCanvasRef.current) {
      updateStencilPreview();
    }
  }, [stencilThreshold, stencilInverted, stencilMaterialColor, showStencilCutouts, stencilStyle, halftoneSize, originalImage]);

  // Update stencil preview when history changes (means canvas was modified)
  useEffect(() => {
    if (historyIndex >= 0) {
      triggerStencilUpdate();
    }
  }, [historyIndex, triggerStencilUpdate]);

  // Draw selection overlay with marching ants
  const drawSelectionOverlay = useCallback(() => {
    if (!selectionCanvasRef.current || !selectionMask) return;

    const canvas = selectionCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Find selection edges and draw marching ants
    const width = selectionMask.width;
    const height = selectionMask.height;
    const data = selectionMask.data;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -marchingAntsRef.current;

    // Draw edge pixels
    ctx.beginPath();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const isSelected = data[idx + 3] > 127;

        if (isSelected) {
          // Check if this is an edge pixel
          const isEdge = 
            (x === 0 || data[(y * width + (x - 1)) * 4 + 3] <= 127) ||
            (x === width - 1 || data[(y * width + (x + 1)) * 4 + 3] <= 127) ||
            (y === 0 || data[((y - 1) * width + x) * 4 + 3] <= 127) ||
            (y === height - 1 || data[((y + 1) * width + x) * 4 + 3] <= 127);

          if (isEdge) {
            ctx.rect(x, y, 1, 1);
          }
        }
      }
    }
    ctx.stroke();

    // Draw white dashes offset
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineDashOffset = -marchingAntsRef.current + 4;
    ctx.stroke();
  }, [selectionMask]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectionMask(null);
    setHasSelection(false);
    setSelectionPath([]);
    if (selectionCanvasRef.current) {
      const ctx = selectionCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, selectionCanvasRef.current.width, selectionCanvasRef.current.height);
    }
  }, []);

  // Create selection mask from path (for lasso)
  const createMaskFromPath = useCallback((path, addToExisting = false) => {
    if (!workingCanvasRef.current || path.length < 3) return;

    const canvas = workingCanvasRef.current;
    const width = canvas.width;
    const height = canvas.height;

    // Create temporary canvas to draw the path
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw filled path
    tempCtx.fillStyle = 'white';
    tempCtx.beginPath();
    tempCtx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
      tempCtx.lineTo(path[i].x, path[i].y);
    }
    tempCtx.closePath();
    tempCtx.fill();

    const newMaskData = tempCtx.getImageData(0, 0, width, height);

    if (addToExisting && selectionMask) {
      // Combine with existing selection
      const existingData = selectionMask.data;
      for (let i = 0; i < newMaskData.data.length; i += 4) {
        if (existingData[i + 3] > 127) {
          newMaskData.data[i + 3] = 255;
        }
      }
    }

    setSelectionMask(newMaskData);
    setHasSelection(true);
  }, [selectionMask]);

  // Create selection mask from rectangle
  const createMaskFromRect = useCallback((start, end, addToExisting = false) => {
    if (!workingCanvasRef.current) return;

    const canvas = workingCanvasRef.current;
    const width = canvas.width;
    const height = canvas.height;

    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);

    if (w < 2 || h < 2) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(x, y, w, h);

    const newMaskData = tempCtx.getImageData(0, 0, width, height);

    if (addToExisting && selectionMask) {
      const existingData = selectionMask.data;
      for (let i = 0; i < newMaskData.data.length; i += 4) {
        if (existingData[i + 3] > 127) {
          newMaskData.data[i + 3] = 255;
        }
      }
    }

    setSelectionMask(newMaskData);
    setHasSelection(true);
  }, [selectionMask]);

  // Create selection mask from ellipse
  const createMaskFromEllipse = useCallback((start, end, addToExisting = false) => {
    if (!workingCanvasRef.current) return;

    const canvas = workingCanvasRef.current;
    const width = canvas.width;
    const height = canvas.height;

    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;

    if (rx < 2 || ry < 2) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.fillStyle = 'white';
    tempCtx.beginPath();
    tempCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    tempCtx.fill();

    const newMaskData = tempCtx.getImageData(0, 0, width, height);

    if (addToExisting && selectionMask) {
      const existingData = selectionMask.data;
      for (let i = 0; i < newMaskData.data.length; i += 4) {
        if (existingData[i + 3] > 127) {
          newMaskData.data[i + 3] = 255;
        }
      }
    }

    setSelectionMask(newMaskData);
    setHasSelection(true);
    updateSelectionPixelCount(newMaskData);
  }, [selectionMask]);

  // Magic wand - flood fill selection
  const magicWandSelect = useCallback((startX, startY, addToExisting = false) => {
    if (!workingCanvasRef.current) return;

    const canvas = workingCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Get the color at click point
    const startIdx = (Math.floor(startY) * width + Math.floor(startX)) * 4;
    const targetR = data[startIdx];
    const targetG = data[startIdx + 1];
    const targetB = data[startIdx + 2];

    // Create mask
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    const maskImageData = tempCtx.createImageData(width, height);
    const maskData = maskImageData.data;

    // Visited array
    const visited = new Uint8Array(width * height);

    // Color similarity check
    const isColorSimilar = (idx) => {
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      return Math.abs(r - targetR) <= magicWandTolerance &&
             Math.abs(g - targetG) <= magicWandTolerance &&
             Math.abs(b - targetB) <= magicWandTolerance;
    };

    // Flood fill using queue (BFS)
    const queue = [[Math.floor(startX), Math.floor(startY)]];
    
    while (queue.length > 0) {
      const [x, y] = queue.shift();
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const pixelIdx = y * width + x;
      if (visited[pixelIdx]) continue;
      
      const colorIdx = pixelIdx * 4;
      if (!isColorSimilar(colorIdx)) continue;
      
      visited[pixelIdx] = 1;
      maskData[colorIdx + 3] = 255; // Mark as selected
      
      // Add neighbors
      queue.push([x + 1, y]);
      queue.push([x - 1, y]);
      queue.push([x, y + 1]);
      queue.push([x, y - 1]);
    }

    // Combine with existing selection if needed
    if (addToExisting && selectionMask) {
      const existingData = selectionMask.data;
      for (let i = 0; i < maskData.length; i += 4) {
        if (existingData[i + 3] > 127) {
          maskData[i + 3] = 255;
        }
      }
    }

    setSelectionMask(maskImageData);
    setHasSelection(true);
    updateSelectionPixelCount(maskImageData);
  }, [magicWandTolerance, selectionMask]);

  // Update selection pixel count
  const updateSelectionPixelCount = useCallback((mask) => {
    if (!mask) {
      setSelectionPixelCount(0);
      return;
    }
    let count = 0;
    for (let i = 3; i < mask.data.length; i += 4) {
      if (mask.data[i] > 127) count++;
    }
    setSelectionPixelCount(count);
  }, []);

  // Expand selection
  const expandSelection = useCallback(() => {
    if (!selectionMask || !workingCanvasRef.current) return;

    const width = selectionMask.width;
    const height = selectionMask.height;
    const data = selectionMask.data;
    
    const newMask = new ImageData(width, height);
    const newData = newMask.data;
    const amount = expandAmount;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Check if any pixel within 'amount' radius is selected
        let isNearSelected = false;
        for (let dy = -amount; dy <= amount && !isNearSelected; dy++) {
          for (let dx = -amount; dx <= amount && !isNearSelected; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= amount) {
                const nidx = (ny * width + nx) * 4;
                if (data[nidx + 3] > 127) {
                  isNearSelected = true;
                }
              }
            }
          }
        }
        
        if (isNearSelected) {
          newData[idx + 3] = 255;
        }
      }
    }

    setSelectionMask(newMask);
    updateSelectionPixelCount(newMask);
  }, [selectionMask, expandAmount, updateSelectionPixelCount]);

  // Contract selection
  const contractSelection = useCallback(() => {
    if (!selectionMask || !workingCanvasRef.current) return;

    const width = selectionMask.width;
    const height = selectionMask.height;
    const data = selectionMask.data;
    
    const newMask = new ImageData(width, height);
    const newData = newMask.data;
    const amount = contractAmount;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        if (data[idx + 3] <= 127) continue; // Not selected
        
        // Check if all pixels within 'amount' radius are selected
        let allSelected = true;
        for (let dy = -amount; dy <= amount && allSelected; dy++) {
          for (let dx = -amount; dx <= amount && allSelected; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= amount) {
                const nidx = (ny * width + nx) * 4;
                if (data[nidx + 3] <= 127) {
                  allSelected = false;
                }
              }
            } else {
              allSelected = false;
            }
          }
        }
        
        if (allSelected) {
          newData[idx + 3] = 255;
        }
      }
    }

    setSelectionMask(newMask);
    updateSelectionPixelCount(newMask);
    
    // Check if selection is now empty
    let hasAny = false;
    for (let i = 3; i < newData.length; i += 4) {
      if (newData[i] > 127) { hasAny = true; break; }
    }
    if (!hasAny) {
      clearSelection();
    }
  }, [selectionMask, contractAmount, updateSelectionPixelCount, clearSelection]);

  // Feather selection
  const featherSelection = useCallback(() => {
    if (!selectionMask || !workingCanvasRef.current) return;

    const width = selectionMask.width;
    const height = selectionMask.height;
    const data = selectionMask.data;
    
    const newMask = new ImageData(width, height);
    const newData = newMask.data;
    const radius = featherAmount;

    // Apply gaussian-like blur to the selection mask
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        let totalAlpha = 0;
        let weight = 0;
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= radius) {
                const nidx = (ny * width + nx) * 4;
                const w = 1 - (dist / (radius + 1));
                totalAlpha += data[nidx + 3] * w;
                weight += w;
              }
            }
          }
        }
        
        newData[idx + 3] = weight > 0 ? Math.round(totalAlpha / weight) : 0;
      }
    }

    setSelectionMask(newMask);
    updateSelectionPixelCount(newMask);
  }, [selectionMask, featherAmount, updateSelectionPixelCount]);

  // Invert selection
  const invertSelection = useCallback(() => {
    if (!workingCanvasRef.current) return;

    const width = workingCanvasRef.current.width;
    const height = workingCanvasRef.current.height;
    
    const newMask = new ImageData(width, height);
    const newData = newMask.data;

    if (selectionMask) {
      const data = selectionMask.data;
      for (let i = 0; i < data.length; i += 4) {
        newData[i + 3] = data[i + 3] > 127 ? 0 : 255;
      }
    } else {
      // Select all if no selection
      for (let i = 0; i < newData.length; i += 4) {
        newData[i + 3] = 255;
      }
    }

    setSelectionMask(newMask);
    setHasSelection(true);
    updateSelectionPixelCount(newMask);
  }, [selectionMask, updateSelectionPixelCount]);

  // Delete selection (fill with white)
  const deleteSelection = useCallback(() => {
    if (!selectionMask || !workingCanvasRef.current) return;

    const canvas = workingCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const maskData = selectionMask.data;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = maskData[i + 3] / 255;
      if (alpha > 0) {
        // Blend with white based on selection alpha
        data[i] = Math.round(data[i] * (1 - alpha) + 255 * alpha);
        data[i + 1] = Math.round(data[i + 1] * (1 - alpha) + 255 * alpha);
        data[i + 2] = Math.round(data[i + 2] * (1 - alpha) + 255 * alpha);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    saveToHistory();
  }, [selectionMask, saveToHistory]);

  // Fill selection with brush color
  const fillSelection = useCallback(() => {
    if (!selectionMask || !workingCanvasRef.current) return;

    const canvas = workingCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const maskData = selectionMask.data;

    // Parse brush color
    const r = parseInt(brushColor.slice(1, 3), 16);
    const g = parseInt(brushColor.slice(3, 5), 16);
    const b = parseInt(brushColor.slice(5, 7), 16);

    for (let i = 0; i < data.length; i += 4) {
      const alpha = maskData[i + 3] / 255;
      if (alpha > 0) {
        // Blend with fill color based on selection alpha
        data[i] = Math.round(data[i] * (1 - alpha) + r * alpha);
        data[i + 1] = Math.round(data[i + 1] * (1 - alpha) + g * alpha);
        data[i + 2] = Math.round(data[i + 2] * (1 - alpha) + b * alpha);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    saveToHistory();
  }, [selectionMask, brushColor, saveToHistory]);

  // Extract selection as a new stencil (the main monetization feature)
  const extractSelectionAsStencil = useCallback(() => {
    if (!selectionMask || !workingCanvasRef.current) return;

    const canvas = workingCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const maskData = selectionMask.data;
    const width = canvas.width;
    const height = canvas.height;

    // Find bounding box of selection
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (maskData[idx + 3] > 127) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    // Add padding
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width - 1, maxX + padding);
    maxY = Math.min(height - 1, maxY + padding);

    const cropWidth = maxX - minX + 1;
    const cropHeight = maxY - minY + 1;

    if (cropWidth <= 0 || cropHeight <= 0) return;

    // Create cropped source data for style processing
    const croppedData = new Uint8ClampedArray(cropWidth * cropHeight * 4);
    for (let y = 0; y < cropHeight; y++) {
      for (let x = 0; x < cropWidth; x++) {
        const srcX = minX + x;
        const srcY = minY + y;
        const srcIdx = (srcY * width + srcX) * 4;
        const destIdx = (y * cropWidth + x) * 4;
        croppedData[destIdx] = data[srcIdx];
        croppedData[destIdx + 1] = data[srcIdx + 1];
        croppedData[destIdx + 2] = data[srcIdx + 2];
        croppedData[destIdx + 3] = data[srcIdx + 3];
      }
    }

    // Apply stencil style conversion using the same helper as preview
    const blackMask = applyStencilStyle(croppedData, cropWidth, cropHeight, stencilStyle, stencilThreshold, stencilInverted, halftoneSize);

    // Create the stencil canvas (cropped to selection bounds)
    const stencilCanvas = document.createElement('canvas');
    stencilCanvas.width = cropWidth;
    stencilCanvas.height = cropHeight;
    const stencilCtx = stencilCanvas.getContext('2d');
    const stencilImageData = stencilCtx.createImageData(cropWidth, cropHeight);
    const sData = stencilImageData.data;

    for (let y = 0; y < cropHeight; y++) {
      for (let x = 0; x < cropWidth; x++) {
        const srcX = minX + x;
        const srcY = minY + y;
        const srcIdx = (srcY * width + srcX) * 4;
        const destIdx = (y * cropWidth + x) * 4;
        const maskIdx = y * cropWidth + x;

        // Check if this pixel is in the selection
        const inSelection = maskData[srcIdx + 3] > 127;

        if (inSelection) {
          if (blackMask[maskIdx]) {
            // Black = stencil material
            sData[destIdx] = 0;
            sData[destIdx + 1] = 0;
            sData[destIdx + 2] = 0;
            sData[destIdx + 3] = 255;
          } else {
            // White = cut out
            sData[destIdx] = 255;
            sData[destIdx + 1] = 255;
            sData[destIdx + 2] = 255;
            sData[destIdx + 3] = 255;
          }
        } else {
          // Outside selection = transparent (not part of stencil)
          sData[destIdx + 3] = 0;
        }
      }
    }

    stencilCtx.putImageData(stencilImageData, 0, 0);

    // Create preview thumbnail
    const thumbnailSize = 120;
    const thumbnailCanvas = document.createElement('canvas');
    const scale = Math.min(thumbnailSize / cropWidth, thumbnailSize / cropHeight);
    thumbnailCanvas.width = Math.round(cropWidth * scale);
    thumbnailCanvas.height = Math.round(cropHeight * scale);
    const thumbCtx = thumbnailCanvas.getContext('2d');
    thumbCtx.drawImage(stencilCanvas, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);

    // Create stencil object
    const newStencil = {
      id: stencilIdCounter.current++,
      name: `Stencil ${extractedStencils.length + 1}`,
      dataUrl: stencilCanvas.toDataURL('image/png'),
      thumbnailUrl: thumbnailCanvas.toDataURL('image/png'),
      width: cropWidth,
      height: cropHeight,
      createdAt: new Date().toISOString(),
      style: stencilStyle // Store the style used
    };

    // Add to extracted stencils
    setExtractedStencils(prev => [...prev, newStencil]);
    setSelectedStencilId(newStencil.id);

    // Remove the selection from the working canvas (fill with white)
    for (let i = 0; i < data.length; i += 4) {
      const alpha = maskData[i + 3] / 255;
      if (alpha > 0) {
        data[i] = Math.round(data[i] * (1 - alpha) + 255 * alpha);
        data[i + 1] = Math.round(data[i + 1] * (1 - alpha) + 255 * alpha);
        data[i + 2] = Math.round(data[i + 2] * (1 - alpha) + 255 * alpha);
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Clear selection and save to history
    setSelectionMask(null);
    setHasSelection(false);
    setSelectionPixelCount(0);
    
    // Clear the selection canvas overlay (marching ants)
    if (selectionCanvasRef.current) {
      const selCtx = selectionCanvasRef.current.getContext('2d');
      selCtx.clearRect(0, 0, selectionCanvasRef.current.width, selectionCanvasRef.current.height);
    }
    
    saveToHistory();
    triggerStencilUpdate();
  }, [selectionMask, stencilThreshold, stencilInverted, stencilStyle, halftoneSize, extractedStencils, saveToHistory, triggerStencilUpdate, applyStencilStyle]);

  // Delete an extracted stencil
  const deleteExtractedStencil = useCallback((stencilId) => {
    setExtractedStencils(prev => prev.filter(s => s.id !== stencilId));
    if (selectedStencilId === stencilId) {
      setSelectedStencilId(null);
    }
  }, [selectedStencilId]);

  // Rename an extracted stencil
  const renameExtractedStencil = useCallback((stencilId, newName) => {
    setExtractedStencils(prev => prev.map(s => 
      s.id === stencilId ? { ...s, name: newName } : s
    ));
  }, []);



  // ============================================
  // IMAGE ENHANCEMENT FUNCTIONS
  // ============================================

  // Store base image when starting adjustments
  const storeBaseImage = useCallback(() => {
    if (!workingCanvasRef.current) return;
    const ctx = workingCanvasRef.current.getContext('2d');
    baseImageDataRef.current = ctx.getImageData(0, 0, workingCanvasRef.current.width, workingCanvasRef.current.height);
  }, []);

  // Apply brightness and contrast adjustments (live preview)
  const applyBrightnessContrast = useCallback((brightness, contrast) => {
    if (!workingCanvasRef.current || !baseImageDataRef.current) return;

    const canvas = workingCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const baseData = baseImageDataRef.current.data;
    const newImageData = ctx.createImageData(canvas.width, canvas.height);
    const data = newImageData.data;

    const brightnessVal = brightness * 2.55; // Convert -100..100 to -255..255
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < baseData.length; i += 4) {
      // Apply brightness
      let r = baseData[i] + brightnessVal;
      let g = baseData[i + 1] + brightnessVal;
      let b = baseData[i + 2] + brightnessVal;

      // Apply contrast
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;

      // Clamp values
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
      data[i + 3] = baseData[i + 3];
    }

    ctx.putImageData(newImageData, 0, 0);
  }, []);

  // Apply sharpening (edge enhancement)
  const applySharpen = useCallback(() => {
    if (!workingCanvasRef.current || sharpenAmount === 0) return;
    setIsProcessing(true);

    setTimeout(() => {
      const canvas = workingCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;
      const amount = sharpenAmount / 100;

      // Sharpening kernel
      const kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
      ];

      const output = new Uint8ClampedArray(data.length);

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          for (let c = 0; c < 3; c++) {
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                sum += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
              }
            }
            const idx = (y * width + x) * 4 + c;
            output[idx] = Math.max(0, Math.min(255, data[idx] * (1 - amount) + sum * amount));
          }
          output[(y * width + x) * 4 + 3] = data[(y * width + x) * 4 + 3];
        }
      }

      // Copy back
      for (let i = 0; i < data.length; i++) {
        if (output[i] !== undefined) data[i] = output[i];
      }

      ctx.putImageData(imageData, 0, 0);
      saveToHistory();
      storeBaseImage();
      setIsProcessing(false);
    }, 10);
  }, [sharpenAmount, saveToHistory, storeBaseImage]);

  // Find edges (Sobel operator)
  const applyFindEdges = useCallback(() => {
    if (!workingCanvasRef.current) return;
    setIsProcessing(true);

    setTimeout(() => {
      const canvas = workingCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;

      // Sobel kernels
      const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

      const output = new Uint8ClampedArray(data.length);

      // Convert to grayscale first
      const gray = new Float32Array(width * height);
      for (let i = 0; i < data.length; i += 4) {
        gray[i / 4] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      }

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let gx = 0, gy = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = (y + ky) * width + (x + kx);
              const ki = (ky + 1) * 3 + (kx + 1);
              gx += gray[idx] * sobelX[ki];
              gy += gray[idx] * sobelY[ki];
            }
          }
          const magnitude = Math.min(255, Math.sqrt(gx * gx + gy * gy));
          const outIdx = (y * width + x) * 4;
          // Invert for stencil (edges become dark on white)
          const val = 255 - magnitude;
          output[outIdx] = val;
          output[outIdx + 1] = val;
          output[outIdx + 2] = val;
          output[outIdx + 3] = 255;
        }
      }

      for (let i = 0; i < data.length; i++) {
        if (output[i] !== undefined) data[i] = output[i];
      }

      ctx.putImageData(imageData, 0, 0);
      saveToHistory();
      storeBaseImage();
      setIsProcessing(false);
    }, 10);
  }, [saveToHistory, storeBaseImage]);

  // Apply noise reduction (box blur)
  const applyNoiseReduction = useCallback(() => {
    if (!workingCanvasRef.current || noiseReduction === 0) return;
    setIsProcessing(true);

    setTimeout(() => {
      const canvas = workingCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;
      const radius = Math.ceil(noiseReduction / 20); // 1-5 pixel radius

      const output = new Uint8ClampedArray(data.length);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let r = 0, g = 0, b = 0, count = 0;

          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const idx = (ny * width + nx) * 4;
                r += data[idx];
                g += data[idx + 1];
                b += data[idx + 2];
                count++;
              }
            }
          }

          const outIdx = (y * width + x) * 4;
          output[outIdx] = r / count;
          output[outIdx + 1] = g / count;
          output[outIdx + 2] = b / count;
          output[outIdx + 3] = data[outIdx + 3];
        }
      }

      for (let i = 0; i < data.length; i++) {
        data[i] = output[i];
      }

      ctx.putImageData(imageData, 0, 0);
      saveToHistory();
      storeBaseImage();
      setIsProcessing(false);
    }, 10);
  }, [noiseReduction, saveToHistory, storeBaseImage]);

  // Apply posterize (reduce colors)
  const applyPosterize = useCallback(() => {
    if (!workingCanvasRef.current) return;
    setIsProcessing(true);

    setTimeout(() => {
      const canvas = workingCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const levels = posterizeLevels;
      const step = 255 / (levels - 1);

      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round(Math.round(data[i] / step) * step);
        data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
        data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
      }

      ctx.putImageData(imageData, 0, 0);
      saveToHistory();
      storeBaseImage();
      setIsProcessing(false);
    }, 10);
  }, [posterizeLevels, saveToHistory, storeBaseImage]);

  // Simplify details (remove small features)
  const applySimplifyDetails = useCallback(() => {
    if (!workingCanvasRef.current) return;
    setIsProcessing(true);

    setTimeout(() => {
      const canvas = workingCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;
      const threshold = simplifyThreshold;

      // Morphological opening (erosion followed by dilation) to remove small features
      // First, convert to binary based on luminance
      const binary = new Uint8Array(width * height);
      for (let i = 0; i < data.length; i += 4) {
        const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        binary[i / 4] = lum < 128 ? 1 : 0; // 1 = material (dark), 0 = cut out (light)
      }

      // Erosion
      const eroded = new Uint8Array(width * height);
      for (let y = threshold; y < height - threshold; y++) {
        for (let x = threshold; x < width - threshold; x++) {
          let allSet = true;
          for (let dy = -threshold; dy <= threshold && allSet; dy++) {
            for (let dx = -threshold; dx <= threshold && allSet; dx++) {
              if (binary[(y + dy) * width + (x + dx)] === 0) {
                allSet = false;
              }
            }
          }
          eroded[y * width + x] = allSet ? 1 : 0;
        }
      }

      // Dilation
      const dilated = new Uint8Array(width * height);
      for (let y = threshold; y < height - threshold; y++) {
        for (let x = threshold; x < width - threshold; x++) {
          let anySet = false;
          for (let dy = -threshold; dy <= threshold && !anySet; dy++) {
            for (let dx = -threshold; dx <= threshold && !anySet; dx++) {
              if (eroded[(y + dy) * width + (x + dx)] === 1) {
                anySet = true;
              }
            }
          }
          dilated[y * width + x] = anySet ? 1 : 0;
        }
      }

      // Apply back to image
      for (let i = 0; i < data.length; i += 4) {
        const idx = i / 4;
        if (dilated[idx] === 1) {
          // Keep original dark pixels that survived
          // Keep as is
        } else {
          // Make white (remove small features)
          const origLum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          if (origLum < 128 && binary[idx] === 1) {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      saveToHistory();
      storeBaseImage();
      setIsProcessing(false);
    }, 10);
  }, [simplifyThreshold, saveToHistory, storeBaseImage]);

  // Apply dithering (Floyd-Steinberg)
  const applyDithering = useCallback(() => {
    if (!workingCanvasRef.current) return;
    setIsProcessing(true);

    setTimeout(() => {
      const canvas = workingCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;

      // Convert to grayscale float array
      const gray = new Float32Array(width * height);
      for (let i = 0; i < data.length; i += 4) {
        gray[i / 4] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      }

      // Floyd-Steinberg dithering
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const oldPixel = gray[idx];
          const newPixel = oldPixel < 128 ? 0 : 255;
          gray[idx] = newPixel;
          const error = oldPixel - newPixel;

          // Distribute error to neighbors
          if (x + 1 < width) gray[idx + 1] += error * 7 / 16;
          if (y + 1 < height) {
            if (x > 0) gray[(y + 1) * width + (x - 1)] += error * 3 / 16;
            gray[(y + 1) * width + x] += error * 5 / 16;
            if (x + 1 < width) gray[(y + 1) * width + (x + 1)] += error * 1 / 16;
          }
        }
      }

      // Apply back
      for (let i = 0; i < data.length; i += 4) {
        const val = gray[i / 4] < 128 ? 0 : 255;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }

      ctx.putImageData(imageData, 0, 0);
      saveToHistory();
      storeBaseImage();
      setIsProcessing(false);
    }, 10);
  }, [saveToHistory, storeBaseImage]);

  // Apply halftone pattern
  const applyHalftone = useCallback(() => {
    if (!workingCanvasRef.current) return;
    setIsProcessing(true);

    setTimeout(() => {
      const canvas = workingCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;
      const cellSize = halftoneSize;

      // Process in cells
      for (let cy = 0; cy < height; cy += cellSize) {
        for (let cx = 0; cx < width; cx += cellSize) {
          // Calculate average luminance in cell
          let totalLum = 0;
          let count = 0;
          for (let y = cy; y < Math.min(cy + cellSize, height); y++) {
            for (let x = cx; x < Math.min(cx + cellSize, width); x++) {
              const idx = (y * width + x) * 4;
              totalLum += data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
              count++;
            }
          }
          const avgLum = totalLum / count;

          // Calculate dot radius based on luminance (darker = bigger dot)
          const maxRadius = cellSize / 2;
          const dotRadius = maxRadius * (1 - avgLum / 255);

          // Draw the cell
          const centerX = cx + cellSize / 2;
          const centerY = cy + cellSize / 2;

          for (let y = cy; y < Math.min(cy + cellSize, height); y++) {
            for (let x = cx; x < Math.min(cx + cellSize, width); x++) {
              const idx = (y * width + x) * 4;
              const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
              
              if (dist <= dotRadius) {
                // Inside dot - black
                data[idx] = 0;
                data[idx + 1] = 0;
                data[idx + 2] = 0;
              } else {
                // Outside dot - white
                data[idx] = 255;
                data[idx + 1] = 255;
                data[idx + 2] = 255;
              }
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      saveToHistory();
      storeBaseImage();
      setIsProcessing(false);
    }, 10);
  }, [halftoneSize, saveToHistory, storeBaseImage]);

  // Live brightness/contrast preview effect
  useEffect(() => {
    if (!workingCanvasRef.current || !originalImage) return;
    
    // Store base image on first render
    if (!baseImageDataRef.current) {
      const ctx = workingCanvasRef.current.getContext('2d');
      baseImageDataRef.current = ctx.getImageData(0, 0, workingCanvasRef.current.width, workingCanvasRef.current.height);
    }
    
    // Apply adjustments
    if (adjustments.brightness !== 0 || adjustments.contrast !== 0) {
      applyBrightnessContrast(adjustments.brightness, adjustments.contrast);
    } else if (baseImageDataRef.current) {
      // Reset to base image
      const ctx = workingCanvasRef.current.getContext('2d');
      ctx.putImageData(baseImageDataRef.current, 0, 0);
    }
  }, [adjustments.brightness, adjustments.contrast, originalImage, applyBrightnessContrast]);

  // Apply gradient conversion based on mode
  const applyGradientConversion = useCallback(() => {
    if (gradientMode === 'dither') {
      applyDithering();
    } else if (gradientMode === 'halftone') {
      applyHalftone();
    }
  }, [gradientMode, applyDithering, applyHalftone]);

  // Commit brightness/contrast changes to history
  const commitAdjustments = useCallback(() => {
    if (!workingCanvasRef.current) return;
    saveToHistory();
    storeBaseImage();
    setAdjustments({ brightness: 0, contrast: 0, saturation: 0 });
  }, [saveToHistory, storeBaseImage]);

  // ============================================
  // STENCIL ANALYSIS FUNCTIONS
  // ============================================

  // Analyze stencil for structural issues
  const analyzeStencil = useCallback(() => {
    if (!workingCanvasRef.current) return;
    setIsProcessing(true);

    setTimeout(() => {
      const canvas = workingCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;

      // Convert to binary (dark = stencil material, light = cut out)
      const binary = new Uint8Array(width * height);
      for (let i = 0; i < data.length; i += 4) {
        const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        binary[i / 4] = lum < 128 ? 1 : 0; // 1 = material (dark), 0 = cut out (light)
      }

      // Find connected regions using flood fill
      const labels = new Int32Array(width * height);
      let currentLabel = 0;
      const regionSizes = new Map();
      const regionBounds = new Map();

      const floodFill = (startX, startY, label) => {
        const stack = [[startX, startY]];
        let size = 0;
        let minX = startX, maxX = startX, minY = startY, maxY = startY;

        while (stack.length > 0) {
          const [x, y] = stack.pop();
          const idx = y * width + x;

          if (x < 0 || x >= width || y < 0 || y >= height) continue;
          if (labels[idx] !== 0 || binary[idx] !== 1) continue;

          labels[idx] = label;
          size++;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);

          stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }

        return { size, bounds: { minX, maxX, minY, maxY } };
      };

      // Label all connected regions
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (binary[idx] === 1 && labels[idx] === 0) {
            currentLabel++;
            const { size, bounds } = floodFill(x, y, currentLabel);
            regionSizes.set(currentLabel, size);
            regionBounds.set(currentLabel, bounds);
          }
        }
      }

      // Find the main region (connected to edges or largest)
      let mainRegion = 0;
      let maxEdgeContact = 0;

      for (let label = 1; label <= currentLabel; label++) {
        let edgeContact = 0;
        const bounds = regionBounds.get(label);
        
        // Check if region touches edges
        for (let x = 0; x < width; x++) {
          if (labels[x] === label) edgeContact++;
          if (labels[(height - 1) * width + x] === label) edgeContact++;
        }
        for (let y = 0; y < height; y++) {
          if (labels[y * width] === label) edgeContact++;
          if (labels[y * width + (width - 1)] === label) edgeContact++;
        }

        if (edgeContact > maxEdgeContact) {
          maxEdgeContact = edgeContact;
          mainRegion = label;
        }
      }

      // If no region touches edges, use largest
      if (mainRegion === 0) {
        let maxSize = 0;
        for (const [label, size] of regionSizes) {
          if (size > maxSize) {
            maxSize = size;
            mainRegion = label;
          }
        }
      }

      // Islands are regions not connected to main region
      const islands = [];
      for (let label = 1; label <= currentLabel; label++) {
        if (label !== mainRegion) {
          const bounds = regionBounds.get(label);
          const size = regionSizes.get(label);
          islands.push({
            label,
            size,
            bounds,
            center: {
              x: (bounds.minX + bounds.maxX) / 2,
              y: (bounds.minY + bounds.maxY) / 2
            }
          });
        }
      }

      // Find weak bridges (thin connections) using erosion
      const weakBridges = [];
      const erosionRadius = 2;
      const eroded = new Uint8Array(width * height);

      // Apply erosion to find thin areas
      for (let y = erosionRadius; y < height - erosionRadius; y++) {
        for (let x = erosionRadius; x < width - erosionRadius; x++) {
          const idx = y * width + x;
          if (binary[idx] === 0) continue;

          let minNeighbor = 1;
          for (let dy = -erosionRadius; dy <= erosionRadius; dy++) {
            for (let dx = -erosionRadius; dx <= erosionRadius; dx++) {
              const nidx = (y + dy) * width + (x + dx);
              if (binary[nidx] === 0) {
                minNeighbor = 0;
                break;
              }
            }
            if (minNeighbor === 0) break;
          }
          eroded[idx] = minNeighbor;
        }
      }

      // Find pixels that are in original but not in eroded (these are thin/weak)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (binary[idx] === 1 && eroded[idx] === 0) {
            weakBridges.push({ x, y });
          }
        }
      }

      // Generate bridge suggestions to connect islands to main region
      const suggestions = [];
      for (const island of islands) {
        // Find closest point on main region
        let closestDist = Infinity;
        let closestPoint = null;
        let islandEdgePoint = null;

        // Sample points on island edge
        const { bounds } = island;
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
          for (let x = bounds.minX; x <= bounds.maxX; x++) {
            const idx = y * width + x;
            if (labels[idx] !== island.label) continue;

            // Check if edge pixel
            const isEdge = (
              (x > 0 && labels[idx - 1] !== island.label) ||
              (x < width - 1 && labels[idx + 1] !== island.label) ||
              (y > 0 && labels[idx - width] !== island.label) ||
              (y < height - 1 && labels[idx + width] !== island.label)
            );

            if (!isEdge) continue;

            // Find closest main region pixel
            const searchRadius = Math.min(100, width / 4);
            for (let sy = Math.max(0, y - searchRadius); sy < Math.min(height, y + searchRadius); sy++) {
              for (let sx = Math.max(0, x - searchRadius); sx < Math.min(width, x + searchRadius); sx++) {
                if (labels[sy * width + sx] === mainRegion) {
                  const dist = Math.sqrt((sx - x) ** 2 + (sy - y) ** 2);
                  if (dist < closestDist) {
                    closestDist = dist;
                    closestPoint = { x: sx, y: sy };
                    islandEdgePoint = { x, y };
                  }
                }
              }
            }
          }
        }

        if (closestPoint && islandEdgePoint && closestDist < 100) {
          suggestions.push({
            island,
            from: islandEdgePoint,
            to: closestPoint,
            distance: closestDist
          });
        }
      }

      // Calculate structural health score
      const totalMaterialPixels = regionSizes.get(mainRegion) || 0;
      const totalIslandPixels = islands.reduce((sum, i) => sum + i.size, 0);
      const weakBridgeRatio = weakBridges.length / (totalMaterialPixels || 1);
      const islandRatio = totalIslandPixels / (totalMaterialPixels + totalIslandPixels || 1);

      let healthScore = 100;
      healthScore -= Math.min(40, islands.length * 10); // Penalize islands
      healthScore -= Math.min(30, weakBridgeRatio * 1000); // Penalize weak bridges
      healthScore -= Math.min(20, islandRatio * 100); // Penalize island area
      healthScore = Math.max(0, Math.round(healthScore));

      setAnalysisResults({
        islands,
        weakBridges,
        mainRegion,
        labels,
        binary,
        width,
        height,
        totalRegions: currentLabel
      });

      setBridgeSuggestions(suggestions);
      setStructuralHealth(healthScore);
      setShowStencilAnalysis(true);
      setIsProcessing(false);
    }, 10);
  }, []);

  // Draw analysis overlay
  const drawAnalysisOverlay = useCallback(() => {
    if (!selectionCanvasRef.current || !analysisResults) return;

    const canvas = selectionCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { islands, weakBridges, labels, width } = analysisResults;

    // Draw islands in red
    if (showIslands && islands.length > 0) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
      for (const island of islands) {
        const { bounds } = island;
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
          for (let x = bounds.minX; x <= bounds.maxX; x++) {
            if (labels[y * width + x] === island.label) {
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
      }

      // Draw island outlines
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      for (const island of islands) {
        const { bounds } = island;
        ctx.strokeRect(bounds.minX - 2, bounds.minY - 2, 
                       bounds.maxX - bounds.minX + 4, bounds.maxY - bounds.minY + 4);
      }
    }

    // Draw weak bridges in yellow
    if (showWeakBridges && weakBridges.length > 0) {
      ctx.fillStyle = 'rgba(255, 200, 0, 0.6)';
      for (const point of weakBridges) {
        ctx.fillRect(point.x, point.y, 1, 1);
      }
    }

    // Draw bridge suggestions in green
    if (bridgeSuggestions.length > 0) {
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.8)';
      ctx.lineWidth = bridgeWidth;
      ctx.setLineDash([5, 5]);
      for (const suggestion of bridgeSuggestions) {
        ctx.beginPath();
        ctx.moveTo(suggestion.from.x, suggestion.from.y);
        ctx.lineTo(suggestion.to.x, suggestion.to.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }, [analysisResults, showIslands, showWeakBridges, bridgeSuggestions, bridgeWidth]);

  // Note: applyBridge and applyAllBridges are defined after saveToHistory to avoid temporal dead zone

  // Effect to redraw analysis overlay when visibility changes
  useEffect(() => {
    if (showStencilAnalysis) {
      drawAnalysisOverlay();
    }
  }, [showStencilAnalysis, showIslands, showWeakBridges, drawAnalysisOverlay]);

  // Clear analysis
  const clearAnalysis = useCallback(() => {
    setShowStencilAnalysis(false);
    setAnalysisResults(null);
    setBridgeSuggestions([]);
    setStructuralHealth(null);
    
    if (selectionCanvasRef.current) {
      const ctx = selectionCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, selectionCanvasRef.current.width, selectionCanvasRef.current.height);
    }
  }, []);

  // Draw selection preview (while dragging)
  const drawSelectionPreview = useCallback((start, current, type) => {
    if (!selectionCanvasRef.current) return;

    const canvas = selectionCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#00AAFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);

    if (type === 'rect') {
      const x = Math.min(start.x, current.x);
      const y = Math.min(start.y, current.y);
      const w = Math.abs(current.x - start.x);
      const h = Math.abs(current.y - start.y);
      ctx.strokeRect(x, y, w, h);
    } else if (type === 'ellipse') {
      const cx = (start.x + current.x) / 2;
      const cy = (start.y + current.y) / 2;
      const rx = Math.abs(current.x - start.x) / 2;
      const ry = Math.abs(current.y - start.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === 'lasso' && selectionPath.length > 0) {
      ctx.beginPath();
      ctx.moveTo(selectionPath[0].x, selectionPath[0].y);
      for (let i = 1; i < selectionPath.length; i++) {
        ctx.lineTo(selectionPath[i].x, selectionPath[i].y);
      }
      if (current) {
        ctx.lineTo(current.x, current.y);
      }
      ctx.stroke();
    }
  }, [selectionPath]);

  // Save current state to history
  // Apply suggested bridge
  const applyBridge = useCallback((suggestion) => {
    if (!workingCanvasRef.current) return;

    const canvas = workingCanvasRef.current;
    const ctx = canvas.getContext('2d');

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = bridgeWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(suggestion.from.x, suggestion.from.y);
    ctx.lineTo(suggestion.to.x, suggestion.to.y);
    ctx.stroke();

    saveToHistory();
    
    // Re-analyze after applying bridge
    setTimeout(() => analyzeStencil(), 100);
  }, [bridgeWidth, saveToHistory, analyzeStencil]);

  // Apply all suggested bridges
  const applyAllBridges = useCallback(() => {
    if (!workingCanvasRef.current || bridgeSuggestions.length === 0) return;

    const canvas = workingCanvasRef.current;
    const ctx = canvas.getContext('2d');

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = bridgeWidth;
    ctx.lineCap = 'round';

    for (const suggestion of bridgeSuggestions) {
      ctx.beginPath();
      ctx.moveTo(suggestion.from.x, suggestion.from.y);
      ctx.lineTo(suggestion.to.x, suggestion.to.y);
      ctx.stroke();
    }

    saveToHistory();
    
    // Re-analyze after applying bridges
    setTimeout(() => analyzeStencil(), 100);
  }, [bridgeSuggestions, bridgeWidth, saveToHistory, analyzeStencil]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex <= 0 || !workingCanvasRef.current) return;
    
    const newIndex = historyIndex - 1;
    const ctx = workingCanvasRef.current.getContext('2d');
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
    triggerStencilUpdate();
  }, [history, historyIndex, triggerStencilUpdate]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1 || !workingCanvasRef.current) return;
    
    const newIndex = historyIndex + 1;
    const ctx = workingCanvasRef.current.getContext('2d');
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
    triggerStencilUpdate();
  }, [history, historyIndex, triggerStencilUpdate]);

  // Reset to original
  const resetToOriginal = useCallback(() => {
    if (!originalImage || !workingCanvasRef.current) return;
    
    const ctx = workingCanvasRef.current.getContext('2d');
    ctx.drawImage(originalImage, 0, 0);
    saveToHistory();
    triggerStencilUpdate();
  }, [originalImage, saveToHistory, triggerStencilUpdate]);

  // Get canvas coordinates from mouse event
  const getCanvasCoords = useCallback((e, canvas) => {
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    
    // The canvas element is wrapped in a container with CSS transform: scale(zoom) translate(pan.x, pan.y)
    // getBoundingClientRect() returns the transformed (visual) bounds
    // We need to convert screen coordinates to canvas pixel coordinates
    
    // Get click position relative to the canvas element
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // The rect dimensions are the visual (scaled) dimensions
    // Canvas intrinsic dimensions are canvas.width/height
    // Scale factor = visual size / intrinsic size = zoom (when the canvas fills its natural size)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Convert to canvas pixel coordinates
    const canvasX = clickX * scaleX;
    const canvasY = clickY * scaleY;
    
    // Clamp to canvas bounds
    const clampedX = Math.max(0, Math.min(canvas.width - 1, Math.round(canvasX)));
    const clampedY = Math.max(0, Math.min(canvas.height - 1, Math.round(canvasY)));
    
    return {
      x: clampedX,
      y: clampedY
    };
  }, []);

  // Draw on canvas (with selection constraint support)
  const draw = useCallback((e) => {
    if (!isDrawing || !workingCanvasRef.current) return;
    if (activeTool === 'pan') return;
    
    const canvas = workingCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCanvasCoords(e, canvas);
    
    if (!coords) return;

    // If constrainToSelection is on and we have a selection, use clipping
    const useClipping = constrainToSelection && hasSelection && selectionMask;
    
    if (useClipping) {
      ctx.save();
      
      // Create clipping path from selection mask
      const maskData = selectionMask.data;
      const width = selectionMask.width;
      const height = selectionMask.height;
      
      // Use a path-based approach for better performance
      ctx.beginPath();
      for (let y = 0; y < height; y++) {
        let inSelection = false;
        let startX = 0;
        for (let x = 0; x <= width; x++) {
          const idx = (y * width + x) * 4;
          const isSelected = x < width && maskData[idx + 3] > 127;
          
          if (isSelected && !inSelection) {
            startX = x;
            inSelection = true;
          } else if (!isSelected && inSelection) {
            ctx.rect(startX, y, x - startX, 1);
            inSelection = false;
          }
        }
      }
      ctx.clip();
    }
    
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    
    if (activeTool === 'brush') {
      ctx.strokeStyle = brushColor;
      ctx.globalCompositeOperation = 'source-over';
    } else if (activeTool === 'eraser') {
      ctx.strokeStyle = '#FFFFFF';
      ctx.globalCompositeOperation = 'source-over';
    }
    
    if (lastPoint) {
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    } else {
      ctx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    if (useClipping) {
      ctx.restore();
    }
    
    setLastPoint(coords);
    
    // Update stencil preview during drawing for live feedback
    triggerStencilUpdate();
  }, [isDrawing, activeTool, brushSize, brushColor, lastPoint, getCanvasCoords, constrainToSelection, hasSelection, selectionMask, triggerStencilUpdate]);

  // Mouse handlers
  const handleMouseDown = useCallback((e) => {
    const coords = getCanvasCoords(e, workingCanvasRef.current);
    if (!coords) return;

    // Check for shift key (add to selection)
    setIsAddingToSelection(e.shiftKey);

    if (activeTool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (activeTool === 'magic-wand') {
      magicWandSelect(coords.x, coords.y, e.shiftKey);
    } else if (activeTool === 'lasso') {
      setIsDrawing(true);
      setSelectionPath([coords]);
    } else if (activeTool === 'marquee-rect' || activeTool === 'marquee-ellipse') {
      setIsDrawing(true);
      setSelectionStart(coords);
    } else {
      setIsDrawing(true);
      setLastPoint(coords);
      draw(e);
    }
  }, [activeTool, pan, getCanvasCoords, draw]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (isDrawing) {
      const coords = getCanvasCoords(e, workingCanvasRef.current);
      if (!coords) return;

      if (activeTool === 'lasso') {
        setSelectionPath(prev => [...prev, coords]);
        drawSelectionPreview(null, coords, 'lasso');
      } else if (activeTool === 'marquee-rect' && selectionStart) {
        drawSelectionPreview(selectionStart, coords, 'rect');
      } else if (activeTool === 'marquee-ellipse' && selectionStart) {
        drawSelectionPreview(selectionStart, coords, 'ellipse');
      } else {
        draw(e);
      }
    }
  }, [isPanning, panStart, isDrawing, activeTool, selectionStart, getCanvasCoords, draw, drawSelectionPreview]);

  const handleMouseUp = useCallback((e) => {
    if (isDrawing) {
      const coords = getCanvasCoords(e, workingCanvasRef.current);

      if (activeTool === 'lasso' && selectionPath.length > 2) {
        createMaskFromPath(selectionPath, isAddingToSelection);
        setSelectionPath([]);
      } else if (activeTool === 'marquee-rect' && selectionStart && coords) {
        createMaskFromRect(selectionStart, coords, isAddingToSelection);
        setSelectionStart(null);
      } else if (activeTool === 'marquee-ellipse' && selectionStart && coords) {
        createMaskFromEllipse(selectionStart, coords, isAddingToSelection);
        setSelectionStart(null);
      } else if (activeTool === 'brush' || activeTool === 'eraser') {
        saveToHistory();
      }
    }
    setIsDrawing(false);
    setIsPanning(false);
    setLastPoint(null);
    setIsAddingToSelection(false);
  }, [isDrawing, activeTool, selectionPath, selectionStart, isAddingToSelection, 
      getCanvasCoords, createMaskFromPath, createMaskFromRect, createMaskFromEllipse, saveToHistory]);

  // Zoom handlers
  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 5));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.1));
  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(Math.max(z * delta, 0.1), 5));
  }, []);

  // Save entire canvas as a single stencil (for when user just edits without extracting)
  const saveCanvasAsStencil = useCallback(() => {
    if (!workingCanvasRef.current) return;

    const canvas = workingCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Apply stencil style conversion using the same helper as preview
    const blackMask = applyStencilStyle(data, width, height, stencilStyle, stencilThreshold, stencilInverted, halftoneSize);

    // Create stencil canvas with black/white based on style
    const stencilCanvas = document.createElement('canvas');
    stencilCanvas.width = width;
    stencilCanvas.height = height;
    const stencilCtx = stencilCanvas.getContext('2d');
    const stencilImageData = stencilCtx.createImageData(width, height);
    const sData = stencilImageData.data;

    for (let i = 0; i < blackMask.length; i++) {
      const pixelIdx = i * 4;
      if (blackMask[i]) {
        // Black = stencil material
        sData[pixelIdx] = 0;
        sData[pixelIdx + 1] = 0;
        sData[pixelIdx + 2] = 0;
        sData[pixelIdx + 3] = 255;
      } else {
        // White = cut out
        sData[pixelIdx] = 255;
        sData[pixelIdx + 1] = 255;
        sData[pixelIdx + 2] = 255;
        sData[pixelIdx + 3] = 255;
      }
    }

    stencilCtx.putImageData(stencilImageData, 0, 0);

    // Create thumbnail
    const thumbnailSize = 120;
    const thumbnailCanvas = document.createElement('canvas');
    const scale = Math.min(thumbnailSize / width, thumbnailSize / height);
    thumbnailCanvas.width = Math.round(width * scale);
    thumbnailCanvas.height = Math.round(height * scale);
    const thumbCtx = thumbnailCanvas.getContext('2d');
    thumbCtx.drawImage(stencilCanvas, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);

    // Create stencil object
    const newStencil = {
      id: Date.now(),
      name: 'Edited Stencil',
      dataUrl: stencilCanvas.toDataURL('image/png'),
      thumbnailUrl: thumbnailCanvas.toDataURL('image/png'),
      width: width,
      height: height,
      createdAt: new Date().toISOString(),
      style: stencilStyle // Store the style used
    };

    // Send to parent - this will replace any existing extracted stencils with just this one
    onApply([newStencil]);
    onClose();
  }, [workingCanvasRef, stencilThreshold, stencilInverted, stencilStyle, halftoneSize, onApply, onClose, applyStencilStyle]);

  // Apply changes - exports all extracted stencils
  const handleApply = useCallback(() => {
    if (extractedStencils.length === 0) return;
    
    // Send all extracted stencils to the parent component
    onApply(extractedStencils);
    onClose();
  }, [onApply, onClose, extractedStencils]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key === 'y') {
          e.preventDefault();
          redo();
        } else if (e.key === 'd') {
          e.preventDefault();
          clearSelection();
        }
      } else if (e.key === 'Escape') {
        clearSelection();
      } else if (e.key === 'b') {
        setActiveTool('brush');
      } else if (e.key === 'e') {
        setActiveTool('eraser');
      } else if (e.key === 'w') {
        setActiveTool('magic-wand');
      } else if (e.key === 'l') {
        setActiveTool('lasso');
      } else if (e.key === 'm') {
        setActiveTool('marquee-rect');
      } else if (e.key === 'o') {
        setActiveTool('marquee-ellipse');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (hasSelection) {
          e.preventDefault();
          deleteSelection();
        }
      } else if (e.key === 'Enter') {
        if (hasSelection) {
          e.preventDefault();
          extractSelectionAsStencil();
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        setActiveTool('pan');
      }
    };
    
    const handleKeyUp = (e) => {
      if (e.key === ' ') {
        setActiveTool('brush');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, undo, redo, clearSelection, hasSelection, deleteSelection, extractSelectionAsStencil]);

  if (!isOpen) return null;

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Tool button component
  const ToolButton = ({ tool, icon: Icon, label, shortcut }) => (
    <button
      onClick={() => setActiveTool(tool)}
      className={`
        relative group flex items-center justify-center w-10 h-10 rounded-lg transition-all
        ${activeTool === tool 
          ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' 
          : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 hover:text-white'
        }
      `}
      title={`${label} (${shortcut})`}
    >
      <Icon size={20} />
      <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded 
                       opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
        {label} <span className="text-gray-400">({shortcut})</span>
      </span>
    </button>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className={`
            relative flex flex-col bg-gray-900 rounded-xl overflow-hidden shadow-2xl
            ${isFullscreen ? 'w-full h-full rounded-none' : 'w-[95vw] h-[90vh] max-w-[1800px]'}
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800/80 border-b border-gray-700/50">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-white">Stencil Editor</h2>
              <div className="flex items-center gap-1 text-sm text-gray-400">
                <span className="px-2 py-0.5 bg-gray-700/50 rounded">
                  {Math.round(zoom * 100)}%
                </span>
                {originalImage && (
                  <span className="px-2 py-0.5 bg-gray-700/50 rounded">
                    {originalImage.width} × {originalImage.height}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Undo/Redo */}
              <div className="flex items-center gap-1 mr-2">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className={`p-2 rounded-lg transition-all ${
                    canUndo 
                      ? 'text-gray-300 hover:bg-gray-700/50 hover:text-white' 
                      : 'text-gray-600 cursor-not-allowed'
                  }`}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 size={18} />
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className={`p-2 rounded-lg transition-all ${
                    canRedo 
                      ? 'text-gray-300 hover:bg-gray-700/50 hover:text-white' 
                      : 'text-gray-600 cursor-not-allowed'
                  }`}
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 size={18} />
                </button>
              </div>
              
              {/* Zoom controls */}
              <div className="flex items-center gap-1 px-2 border-l border-gray-700">
                <button
                  onClick={handleZoomOut}
                  className="p-2 text-gray-300 hover:bg-gray-700/50 hover:text-white rounded-lg transition-all"
                  title="Zoom Out"
                >
                  <ZoomOut size={18} />
                </button>
                <button
                  onClick={handleZoomReset}
                  className="px-2 py-1 text-sm text-gray-300 hover:bg-gray-700/50 hover:text-white rounded-lg transition-all"
                  title="Reset Zoom"
                >
                  Fit
                </button>
                <button
                  onClick={handleZoomIn}
                  className="p-2 text-gray-300 hover:bg-gray-700/50 hover:text-white rounded-lg transition-all"
                  title="Zoom In"
                >
                  <ZoomIn size={18} />
                </button>
              </div>
              
              {/* View toggles */}
              <div className="flex items-center gap-1 px-2 border-l border-gray-700">
                <button
                  onClick={() => setShowAdjustments(!showAdjustments)}
                  className={`p-2 rounded-lg transition-all ${
                    showAdjustments ? 'text-purple-400 bg-purple-500/20' : 'text-gray-400 hover:bg-gray-700/50'
                  }`}
                  title={showAdjustments ? 'Hide Settings Panel' : 'Show Settings Panel'}
                >
                  <Sliders size={18} />
                </button>
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 text-gray-300 hover:bg-gray-700/50 hover:text-white rounded-lg transition-all"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
              </div>
              
              {/* Close */}
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all ml-2"
                title="Close (Esc)"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Main content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left toolbar */}
            <div className="w-14 bg-gray-800/50 border-r border-gray-700/50 p-2 flex flex-col gap-2">
              {/* Drawing tools */}
              <ToolButton tool="brush" icon={Paintbrush} label="Brush" shortcut="B" />
              <ToolButton tool="eraser" icon={Eraser} label="Eraser" shortcut="E" />
              
              <div className="my-2 border-t border-gray-700/50" />
              
              {/* Selection tools */}
              <ToolButton tool="magic-wand" icon={Wand2} label="Magic Wand" shortcut="W" />
              <ToolButton tool="lasso" icon={Lasso} label="Lasso Select" shortcut="L" />
              <ToolButton tool="marquee-rect" icon={Square} label="Rectangle Select" shortcut="M" />
              <ToolButton tool="marquee-ellipse" icon={Circle} label="Ellipse Select" shortcut="O" />
              
              <div className="my-2 border-t border-gray-700/50" />
              
              {/* Navigation */}
              <ToolButton tool="pan" icon={Move} label="Pan" shortcut="Space" />
              
              <div className="my-2 border-t border-gray-700/50" />
              
              <button
                onClick={resetToOriginal}
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-700/50 
                         text-gray-300 hover:bg-orange-500/20 hover:text-orange-400 transition-all"
                title="Reset to Original"
              >
                <RotateCcw size={20} />
              </button>
              
              {/* Clear selection button (only show when there's a selection) */}
              {hasSelection && (
                <button
                  onClick={clearSelection}
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-700/50 
                           text-gray-300 hover:bg-red-500/20 hover:text-red-400 transition-all"
                  title="Clear Selection (Esc)"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Canvas area */}
            <div 
              ref={containerRef}
              className="flex-1 flex overflow-hidden bg-gray-950"
              onWheel={handleWheel}
            >
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    <p className="text-gray-400">Loading image...</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Editing panel (left) - where user edits the image */}
                  <div className="flex-1 flex flex-col border-r border-gray-800">
                    <div className="px-3 py-1.5 bg-gray-800/30 border-b border-gray-700/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">
                          Editing1111
                        </span>
                        {hasSelection && (
                          <span className="text-xs text-blue-400 flex items-center gap-1">
                            <Square size={10} /> {selectionPixelCount.toLocaleString()} px
                          </span>
                        )}
                      </div>
                    </div>
                    <div 
                      className="flex-1 overflow-hidden flex items-center justify-center p-4 relative"
                      style={{ 
                        cursor: activeTool === 'pan' ? 'grab' : 
                                ['lasso', 'marquee-rect', 'marquee-ellipse', 'magic-wand'].includes(activeTool) ? 'crosshair' : 'crosshair' 
                      }}
                    >
                      <div
                        style={{
                          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                          transformOrigin: 'center center',
                          position: 'relative'
                        }}
                      >
                        <canvas
                          ref={workingCanvasRef}
                          className="shadow-2xl"
                          style={{ 
                            imageRendering: zoom > 2 ? 'pixelated' : 'auto',
                            background: 'repeating-conic-gradient(#1f2937 0% 25%, #111827 0% 50%) 50% / 20px 20px',
                            display: 'block',
                            maxWidth: '100%',
                            maxHeight: '100%'
                          }}
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
                        />
                        {/* Selection overlay canvas - must match working canvas size exactly */}
                        <canvas
                          ref={selectionCanvasRef}
                          className="pointer-events-none"
                          style={{ 
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            imageRendering: 'auto',
                            display: 'block'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stencil Preview panel (right) - live preview of the stencil */}
                  <div className="flex-1 flex flex-col">
                    <div className="px-3 py-1.5 bg-gray-800/30 border-b border-gray-700/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-green-400 uppercase tracking-wider">
                          Stencil Preview
                        </span>
                        {showStencilAnalysis && structuralHealth !== null && (
                          <span className={`text-xs flex items-center gap-1 px-1.5 py-0.5 rounded ${
                            structuralHealth >= 80 ? 'bg-green-500/20 text-green-400' :
                            structuralHealth >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {structuralHealth >= 80 ? <ShieldCheck size={10} /> :
                             structuralHealth >= 50 ? <Shield size={10} /> : <ShieldAlert size={10} />}
                            {structuralHealth}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {analysisResults && analysisResults.islands.length > 0 && (
                          <span className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle size={10} /> {analysisResults.islands.length} island{analysisResults.islands.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          This is what will be saved
                        </span>
                      </div>
                    </div>
                    <div 
                      className="flex-1 overflow-hidden flex items-center justify-center p-4 relative"
                    >
                      <div
                        style={{
                          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                          transformOrigin: 'center center',
                          position: 'relative'
                        }}
                      >
                        {/* Stencil preview canvas */}
                        <canvas
                          ref={stencilCanvasRef}
                          className="max-w-full max-h-full shadow-2xl"
                          style={{ 
                            imageRendering: zoom > 2 ? 'pixelated' : 'auto',
                            background: 'repeating-conic-gradient(#1f2937 0% 25%, #111827 0% 50%) 50% / 20px 20px'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Hidden original canvas (for reference/reset functionality) */}
                  <canvas ref={originalCanvasRef} className="hidden" />
                </>
              )}
            </div>

            {/* Right adjustments panel */}
            <div className={`
              bg-gray-800/50 border-l border-gray-700/50 transition-all duration-300 overflow-hidden
              ${showAdjustments ? 'w-64' : 'w-0'}
            `}>
              {showAdjustments && (
                <div className="p-4 space-y-6 h-full overflow-y-auto">
                  {/* Stencil Settings - controls how the preview looks */}
                  <div>
                    <h3 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                      <Layers size={14} />
                      Stencil Conversion
                    </h3>
                    
                    <div className="space-y-4">
                      {/* Threshold */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-gray-400">Threshold</label>
                          <span className="text-xs text-gray-300">{stencilThreshold}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={stencilThreshold}
                          onChange={(e) => setStencilThreshold(Number(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                                   [&::-webkit-slider-thumb]:bg-green-500 [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Lower = more black (material), Higher = more white (cut out)
                        </p>
                      </div>
                      
                      {/* Invert */}
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-400">Invert Stencil</label>
                        <button
                          onClick={() => setStencilInverted(!stencilInverted)}
                          className={`w-10 h-5 rounded-full transition-colors ${
                            stencilInverted ? 'bg-green-500' : 'bg-gray-600'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                            stencilInverted ? 'translate-x-5' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </div>
                      
                      {/* Material Color Preview */}
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Preview Material Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={stencilMaterialColor}
                            onChange={(e) => setStencilMaterialColor(e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border border-gray-600"
                          />
                          <div className="flex-1 grid grid-cols-4 gap-1">
                            {['#4a5568', '#1a202c', '#2d3748', '#744210'].map(color => (
                              <button
                                key={color}
                                onClick={() => setStencilMaterialColor(color)}
                                className={`w-6 h-6 rounded border ${
                                  stencilMaterialColor === color ? 'border-green-500' : 'border-gray-600'
                                }`}
                                style={{ backgroundColor: color }}
                                title={color === '#4a5568' ? 'Gray' : color === '#1a202c' ? 'Dark' : color === '#2d3748' ? 'Slate' : 'Brown'}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          This is for preview only - exported stencil is black & white
                        </p>
                      </div>
                      
                      {/* Show Cutouts Toggle */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-400">Show Cutout Areas</label>
                        <button
                          onClick={() => setShowStencilCutouts(!showStencilCutouts)}
                          className={`w-10 h-5 rounded-full transition-colors ${
                            showStencilCutouts ? 'bg-green-500' : 'bg-gray-600'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                            showStencilCutouts ? 'translate-x-5' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-700/50" />
                  
                  {/* Brush settings */}
                  <div>
                    <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <Paintbrush size={14} />
                      Brush Settings
                    </h3>
                    
                    <div className="space-y-4">
                      {/* Size */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-gray-400">Size</label>
                          <span className="text-xs text-gray-300">{brushSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={brushSize}
                          onChange={(e) => setBrushSize(Number(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                                   [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                      </div>
                      
                      {/* Color */}
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={brushColor}
                            onChange={(e) => setBrushColor(e.target.value)}
                            className="w-10 h-10 rounded-lg cursor-pointer border-2 border-gray-600"
                          />
                          <div className="flex-1 grid grid-cols-5 gap-1">
                            {['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF'].map(color => (
                              <button
                                key={color}
                                onClick={() => setBrushColor(color)}
                                className={`w-6 h-6 rounded border-2 ${
                                  brushColor === color ? 'border-purple-500' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Hardness */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-gray-400">Hardness</label>
                          <span className="text-xs text-gray-300">{brushHardness}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={brushHardness}
                          onChange={(e) => setBrushHardness(Number(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                                   [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                      </div>
                      
                      {/* Constrain to Selection */}
                      {hasSelection && (
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="constrainToSelection"
                            checked={constrainToSelection}
                            onChange={(e) => setConstrainToSelection(e.target.checked)}
                            className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-purple-500 
                                     focus:ring-purple-500 focus:ring-2"
                          />
                          <label htmlFor="constrainToSelection" className="text-xs text-gray-400">
                            Apply to selection only
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-700/50" />
                  
                  {/* Magic Wand Settings */}
                  <div>
                    <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <Wand2 size={14} />
                      Magic Wand
                    </h3>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-gray-400">Tolerance</label>
                        <span className="text-xs text-gray-300">{magicWandTolerance}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={magicWandTolerance}
                        onChange={(e) => setMagicWandTolerance(Number(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                                 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                                 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                                 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer"
                      />
                      <p className="text-xs text-gray-500 mt-1">Higher = select more similar colors</p>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-700/50" />
                  
                  {/* Selection Modifiers */}
                  <div>
                    <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <Square size={14} />
                      Selection Modifiers
                    </h3>
                    <div className="space-y-3">
                      {/* Expand */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={expandSelection}
                          disabled={!hasSelection}
                          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs
                            ${hasSelection 
                              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                              : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                          title="Expand selection"
                        >
                          <Plus size={12} /> Expand
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={expandAmount}
                          onChange={(e) => setExpandAmount(Math.max(1, Math.min(50, Number(e.target.value))))}
                          className="w-14 px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600 
                                   focus:border-purple-500 focus:outline-none"
                        />
                        <span className="text-xs text-gray-500">px</span>
                      </div>
                      
                      {/* Contract */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={contractSelection}
                          disabled={!hasSelection}
                          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs
                            ${hasSelection 
                              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                              : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                          title="Contract selection"
                        >
                          <Minus size={12} /> Contract
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={contractAmount}
                          onChange={(e) => setContractAmount(Math.max(1, Math.min(50, Number(e.target.value))))}
                          className="w-14 px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600 
                                   focus:border-purple-500 focus:outline-none"
                        />
                        <span className="text-xs text-gray-500">px</span>
                      </div>
                      
                      {/* Feather */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={featherSelection}
                          disabled={!hasSelection}
                          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs
                            ${hasSelection 
                              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                              : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                          title="Feather selection edges"
                        >
                          <Sparkles size={12} /> Feather
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={featherAmount}
                          onChange={(e) => setFeatherAmount(Math.max(1, Math.min(20, Number(e.target.value))))}
                          className="w-14 px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600 
                                   focus:border-purple-500 focus:outline-none"
                        />
                        <span className="text-xs text-gray-500">px</span>
                      </div>
                      
                      {/* Invert */}
                      <button
                        onClick={invertSelection}
                        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs
                                 bg-gray-700 hover:bg-gray-600 text-white"
                        title="Invert selection"
                      >
                        <RefreshCw size={12} /> Invert Selection
                      </button>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-700/50" />
                  
                  {/* Selection Actions */}
                  <div>
                    <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <PaintBucket size={14} />
                      Selection Actions
                    </h3>
                    <div className="space-y-2">
                      {/* MAIN ACTION: Extract as Stencil */}
                      <button
                        onClick={extractSelectionAsStencil}
                        disabled={!hasSelection}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded text-sm font-medium
                          ${hasSelection 
                            ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-500/25' 
                            : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'}`}
                        title="Extract selection as a purchasable stencil"
                      >
                        <Scissors size={16} /> Extract as Stencil
                      </button>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={deleteSelection}
                          disabled={!hasSelection}
                          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs
                            ${hasSelection 
                              ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30' 
                              : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'}`}
                          title="Delete selection (fill with white)"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                        <button
                          onClick={fillSelection}
                          disabled={!hasSelection}
                          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs
                            ${hasSelection 
                              ? 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-600/30' 
                              : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'}`}
                          title="Fill selection with brush color"
                        >
                          <PaintBucket size={12} /> 
                          Fill
                          <span 
                            className="w-3 h-3 rounded border border-gray-500" 
                            style={{ backgroundColor: brushColor }}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-700/50" />
                  
                  {/* Image Adjustments (Live Preview) */}
                  <div>
                    <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <Sliders size={14} />
                      Image Adjustments
                      {(adjustments.brightness !== 0 || adjustments.contrast !== 0) && (
                        <span className="text-xs text-yellow-400 ml-auto">Live</span>
                      )}
                    </h3>
                    
                    <div className="space-y-4">
                      {/* Brightness */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-gray-400 flex items-center gap-1">
                            <Sun size={12} /> Brightness
                          </label>
                          <span className="text-xs text-gray-300">{adjustments.brightness}</span>
                        </div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={adjustments.brightness}
                          onChange={(e) => setAdjustments(prev => ({ ...prev, brightness: Number(e.target.value) }))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                                   [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                      </div>
                      
                      {/* Contrast */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-gray-400 flex items-center gap-1">
                            <Contrast size={12} /> Contrast
                          </label>
                          <span className="text-xs text-gray-300">{adjustments.contrast}</span>
                        </div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={adjustments.contrast}
                          onChange={(e) => setAdjustments(prev => ({ ...prev, contrast: Number(e.target.value) }))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                                   [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                      </div>
                      
                      {/* Commit button */}
                      {(adjustments.brightness !== 0 || adjustments.contrast !== 0) && (
                        <button
                          onClick={commitAdjustments}
                          className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs
                                   bg-purple-600 hover:bg-purple-500 text-white"
                        >
                          <Check size={12} /> Apply Adjustments
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-700/50" />
                  
                  {/* Edge Enhancement */}
                  <div>
                    <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <Zap size={14} />
                      Edge Enhancement
                    </h3>
                    <div className="space-y-3">
                      {/* Sharpen slider */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-gray-400">Sharpen</label>
                          <span className="text-xs text-gray-300">{sharpenAmount}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={sharpenAmount}
                          onChange={(e) => setSharpenAmount(Number(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                                   [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={applySharpen}
                          disabled={isProcessing || sharpenAmount === 0}
                          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs
                            ${!isProcessing && sharpenAmount > 0
                              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                              : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                        >
                          <Zap size={12} /> Sharpen
                        </button>
                        <button
                          onClick={applyFindEdges}
                          disabled={isProcessing}
                          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs
                            ${!isProcessing
                              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                              : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                        >
                          <Square size={12} /> Find Edges
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-700/50" />
                  
                  {/* Noise Reduction */}
                  <div>
                    <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <Wind size={14} />
                      Noise Reduction
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-gray-400">Strength</label>
                          <span className="text-xs text-gray-300">{noiseReduction}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={noiseReduction}
                          onChange={(e) => setNoiseReduction(Number(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                                   [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                      </div>
                      <button
                        onClick={applyNoiseReduction}
                        disabled={isProcessing || noiseReduction === 0}
                        className={`w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs
                          ${!isProcessing && noiseReduction > 0
                            ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                            : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                      >
                        <Wind size={12} /> Apply Noise Reduction
                      </button>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-700/50" />
                  
                  {/* Posterize & Simplify */}
                  <div>
                    <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <Layers size={14} />
                      Simplify Image
                    </h3>
                    <div className="space-y-3">
                      {/* Posterize */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-gray-400">Color Levels</label>
                          <span className="text-xs text-gray-300">{posterizeLevels}</span>
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="16"
                          value={posterizeLevels}
                          onChange={(e) => setPosterizeLevels(Number(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                                   [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                      </div>
                      <button
                        onClick={applyPosterize}
                        disabled={isProcessing}
                        className={`w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs
                          ${!isProcessing
                            ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                            : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                      >
                        <Layers size={12} /> Posterize
                      </button>
                      
                      {/* Simplify Details */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-gray-400">Detail Threshold</label>
                          <span className="text-xs text-gray-300">{simplifyThreshold}px</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={simplifyThreshold}
                          onChange={(e) => setSimplifyThreshold(Number(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                                   [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                        <p className="text-xs text-gray-500 mt-1">Remove details smaller than threshold</p>
                      </div>
                      <button
                        onClick={applySimplifyDetails}
                        disabled={isProcessing}
                        className={`w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs
                          ${!isProcessing
                            ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                            : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                      >
                        <Minimize size={12} /> Simplify Details
                      </button>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-700/50" />
                  
                  {/* Stencil Style */}
                  <div>
                    <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <Grid3X3 size={14} />
                      Stencil Style
                    </h3>
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500">Choose a stencil generation style - preview updates live.</p>
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-gray-400">Style</label>
                        <select
                          id="stencil-style-select"
                          value={stencilStyle}
                          onChange={(e) => setStencilStyle(e.target.value)}
                          className="flex-1 px-2 py-1 rounded bg-gray-700 text-white text-xs border border-gray-600"
                        >
                          <option value="threshold">Threshold</option>
                          <option value="dither">Dither</option>
                          <option value="am-halftone">AM Halftone</option>
                          <option value="fm-halftone">FM Halftone</option>
                          <option value="line">Line Pattern</option>
                        </select>
                      </div>
                      
                      {/* Pattern Size - only show for halftone and line styles */}
                      {['am-halftone', 'fm-halftone', 'line'].includes(stencilStyle) && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-gray-400">Pattern Size</label>
                            <span className="text-xs text-gray-300">{halftoneSize}px</span>
                          </div>
                          <input
                            type="range"
                            min="2"
                            max="16"
                            value={halftoneSize}
                            onChange={(e) => setHalftoneSize(Number(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                                     [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                                     [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            {stencilStyle === 'line' ? 'Line spacing' : 'Dot spacing'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-gray-700/50" />
                  
                  {/* Stencil Analysis */}
                  <div>
                    <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <Scan size={14} />
                      Stencil Analysis
                    </h3>
                    
                    {/* Structural Health Indicator */}
                    {structuralHealth !== null && (
                      <div className="mb-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            {structuralHealth >= 80 ? (
                              <ShieldCheck size={14} className="text-green-400" />
                            ) : structuralHealth >= 50 ? (
                              <Shield size={14} className="text-yellow-400" />
                            ) : (
                              <ShieldAlert size={14} className="text-red-400" />
                            )}
                            Structural Health
                          </span>
                          <span className={`text-sm font-bold ${
                            structuralHealth >= 80 ? 'text-green-400' :
                            structuralHealth >= 50 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {structuralHealth}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              structuralHealth >= 80 ? 'bg-green-500' :
                              structuralHealth >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${structuralHealth}%` }}
                          />
                        </div>
                        {analysisResults && (
                          <div className="mt-2 text-xs text-gray-500 space-y-1">
                            <p>• {analysisResults.islands.length} floating island{analysisResults.islands.length !== 1 ? 's' : ''}</p>
                            <p>• {analysisResults.weakBridges.length} weak bridge pixels</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      {/* Analyze Button */}
                      <button
                        onClick={analyzeStencil}
                        disabled={isProcessing}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm
                          ${!isProcessing
                            ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-600/30' 
                            : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'}`}
                      >
                        <Activity size={14} /> Analyze Stencil
                      </button>
                      
                      {/* Analysis visibility toggles */}
                      {showStencilAnalysis && analysisResults && (
                        <div className="space-y-2 p-2 bg-gray-800/30 rounded">
                          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showIslands}
                              onChange={(e) => setShowIslands(e.target.checked)}
                              className="w-3 h-3 rounded bg-gray-700 border-gray-600 text-red-500"
                            />
                            <span className="flex items-center gap-1">
                              <AlertTriangle size={12} className="text-red-400" />
                              Show Islands ({analysisResults.islands.length})
                            </span>
                          </label>
                          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showWeakBridges}
                              onChange={(e) => setShowWeakBridges(e.target.checked)}
                              className="w-3 h-3 rounded bg-gray-700 border-gray-600 text-yellow-500"
                            />
                            <span className="flex items-center gap-1">
                              <Link size={12} className="text-yellow-400" />
                              Show Weak Bridges
                            </span>
                          </label>
                        </div>
                      )}
                      
                      {/* Bridge suggestions */}
                      {bridgeSuggestions.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">Bridge Width</span>
                            <span className="text-xs text-gray-300">{bridgeWidth}px</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={bridgeWidth}
                            onChange={(e) => setBridgeWidth(Number(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                                     [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                                     [&::-webkit-slider-thumb]:bg-green-500 [&::-webkit-slider-thumb]:cursor-pointer"
                          />
                          
                          <button
                            onClick={applyAllBridges}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm
                                     bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30"
                          >
                            <Link size={14} /> Add All Bridges ({bridgeSuggestions.length})
                          </button>
                          
                          {/* Individual bridge suggestions */}
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {bridgeSuggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                onClick={() => applyBridge(suggestion)}
                                className="w-full flex items-center justify-between px-2 py-1 rounded text-xs
                                         bg-gray-700/50 hover:bg-gray-600/50 text-gray-300"
                              >
                                <span>Bridge #{idx + 1}</span>
                                <span className="text-gray-500">{Math.round(suggestion.distance)}px</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Clear analysis */}
                      {showStencilAnalysis && (
                        <button
                          onClick={clearAnalysis}
                          className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs
                                   bg-gray-700/50 hover:bg-gray-600/50 text-gray-400"
                        >
                          <X size={12} /> Clear Analysis
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-700/50" />
                  
                  {/* Extracted Stencils Gallery */}
                  <div>
                    <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <ShoppingCart size={14} />
                      Your Stencils
                      {extractedStencils.length > 0 && (
                        <span className="ml-auto px-2 py-0.5 bg-green-600/30 text-green-400 text-xs rounded-full">
                          {extractedStencils.length}
                        </span>
                      )}
                    </h3>
                    
                    {extractedStencils.length === 0 ? (
                      <div className="text-center py-4 px-2">
                        <Package size={24} className="mx-auto text-gray-600 mb-2" />
                        <p className="text-xs text-gray-500">
                          No stencils extracted yet.
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Make a selection and click "Extract as Stencil" to add one.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Stencil thumbnails */}
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                          {extractedStencils.map((stencil) => (
                            <div
                              key={stencil.id}
                              className={`relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer
                                ${selectedStencilId === stencil.id 
                                  ? 'border-green-500 shadow-lg shadow-green-500/20' 
                                  : 'border-gray-700 hover:border-gray-500'}`}
                              onClick={() => setSelectedStencilId(stencil.id === selectedStencilId ? null : stencil.id)}
                            >
                              <img
                                src={stencil.thumbnailUrl}
                                alt={stencil.name}
                                className="w-full h-16 object-contain bg-gray-900"
                              />
                              {/* Overlay with actions */}
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 
                                            transition-opacity flex items-center justify-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const link = document.createElement('a');
                                    link.href = stencil.dataUrl;
                                    link.download = `${stencil.name}.png`;
                                    link.click();
                                  }}
                                  className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white"
                                  title="Download this stencil"
                                >
                                  <Download size={12} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteExtractedStencil(stencil.id);
                                  }}
                                  className="p-1.5 bg-red-600 hover:bg-red-500 rounded text-white"
                                  title="Delete this stencil"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              {/* Name label */}
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent 
                                            px-1.5 py-1">
                                <p className="text-xs text-white truncate">{stencil.name}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Selected stencil details */}
                        {selectedStencilId && (() => {
                          const stencil = extractedStencils.find(s => s.id === selectedStencilId);
                          if (!stencil) return null;
                          return (
                            <div className="p-2 bg-gray-800/50 rounded-lg space-y-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={stencil.name}
                                  onChange={(e) => renameExtractedStencil(stencil.id, e.target.value)}
                                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 
                                           text-xs text-white focus:outline-none focus:border-green-500"
                                />
                                <Edit3 size={12} className="text-gray-500" />
                              </div>
                              <div className="text-xs text-gray-500">
                                {stencil.width} × {stencil.height} px
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Total */}
                        <div className="pt-2 border-t border-gray-700/50">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Total Stencils:</span>
                            <span className="text-green-400 font-medium">{extractedStencils.length}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="border-t border-gray-700/50" />
                  
                  {/* Processing indicator */}
                  {isProcessing && (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                      <span className="text-xs text-purple-400">Processing...</span>
                    </div>
                  )}
                  
                  {/* History info */}
                  <div className="text-xs text-gray-500">
                    <p>History: {historyIndex + 1} / {history.length} states</p>
                    <p className="mt-1">Max: {MAX_HISTORY} states</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Panel toggle */}
            <button
              onClick={() => setShowAdjustments(!showAdjustments)}
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-gray-800 hover:bg-gray-700 
                       text-gray-400 hover:text-white p-1 rounded-l-lg transition-all"
              style={{ right: showAdjustments ? '256px' : '0' }}
            >
              {showAdjustments ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800/80 border-t border-gray-700/50">
            <div className="text-sm text-gray-400 flex flex-wrap gap-x-2 gap-y-1">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">B</kbd> Brush
              </span>
              <span className="text-gray-600">|</span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">E</kbd> Eraser
              </span>
              <span className="text-gray-600">|</span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">W</kbd> Wand
              </span>
              <span className="text-gray-600">|</span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">L</kbd> Lasso
              </span>
              <span className="text-gray-600">|</span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">M</kbd> Rect
              </span>
              <span className="text-gray-600">|</span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">Del</kbd> Delete
              </span>
              <span className="text-gray-600">|</span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-green-700 rounded text-xs">Enter</kbd> 
                <span className="text-green-400">Extract</span>
              </span>
              <span className="text-gray-600">|</span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">Esc</kbd> Deselect
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Stencil count badge */}
              {extractedStencils.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 border border-green-600/30 rounded-lg">
                  <ShoppingCart size={16} className="text-green-400" />
                  <span className="text-green-400 font-medium">{extractedStencils.length} stencil{extractedStencils.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
              >
                Cancel
              </button>
              
              {/* Save Entire Edit button - always available */}
              <button
                onClick={saveCanvasAsStencil}
                className="px-4 py-2 font-medium rounded-lg shadow-lg transition-all flex items-center gap-2
                  bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-500/25"
                title="Save the entire edited image as a single stencil"
              >
                <Layers size={18} />
                Save Edit
              </button>
              
              {/* Save Extracted Stencils button - only enabled when there are extractions */}
              <button
                onClick={handleApply}
                disabled={extractedStencils.length === 0}
                className={`px-6 py-2 font-medium rounded-lg shadow-lg transition-all flex items-center gap-2
                  ${extractedStencils.length > 0 
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-green-500/25' 
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed shadow-none'}`}
                title={extractedStencils.length === 0 ? 'Use selection tools to extract stencils first' : `Save ${extractedStencils.length} extracted stencil(s)`}
              >
                <Check size={18} />
                {extractedStencils.length > 0 
                  ? `Save ${extractedStencils.length} Extraction${extractedStencils.length !== 1 ? 's' : ''}`
                  : 'No Extractions'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
