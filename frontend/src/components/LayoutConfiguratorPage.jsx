import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Badge } from './ui/badge';
import { Slider } from './ui/slider';
import { toast } from 'sonner';
import {
  Plus, Trash2, Save, Download, Upload, RotateCw, RotateCcw,
  ZoomIn, ZoomOut, Grid3X3, Eye, EyeOff, Layers, Settings2,
  FolderOpen, Copy, Move, Loader2, RefreshCw, GripVertical,
  Square, Minus, MousePointer, Pencil
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// A4 Landscape dimensions
// A4 = 297mm x 210mm (landscape)
// Using scale: 2 pixels per mm = 20 pixels per cm
const A4_LANDSCAPE = {
  widthPx: 842,   // 297mm * 2.83 ≈ 842px (standard 72dpi)
  heightPx: 595,  // 210mm * 2.83 ≈ 595px
  widthCm: 29.7,
  heightCm: 21.0,
};

// Default scale: how many real cm fit in the canvas
// E.g., if canvas represents 500cm x 350cm area
const DEFAULT_CANVAS_REAL_SIZE = {
  widthCm: 500,  // Real width the canvas represents
  heightCm: 350, // Real height the canvas represents
};

// Drawing tools
const DRAWING_TOOLS = {
  select: { icon: MousePointer, name: 'Выбор', cursor: 'default' },
  rectangle: { icon: Square, name: 'Прямоугольник', cursor: 'crosshair' },
  wall: { icon: Minus, name: 'Стена/Линия', cursor: 'crosshair' },
};

// Element type icons and colors
const ELEMENT_TYPES = {
  heater: { icon: '🔥', color: '#ef4444', name: 'Печь', namePl: 'Piec' },
  bench: { icon: '🪑', color: '#8b5cf6', name: 'Лавка', namePl: 'Ławka' },
  door: { icon: '🚪', color: '#3b82f6', name: 'Дверь', namePl: 'Drzwi' },
  window: { icon: '🪟', color: '#06b6d4', name: 'Окно', namePl: 'Okno' },
  shower: { icon: '🚿', color: '#10b981', name: 'Душ', namePl: 'Prysznic' },
  divider: { icon: '📏', color: '#f59e0b', name: 'Перегородка', namePl: 'Ścianka' },
  stairs: { icon: '🪜', color: '#6366f1', name: 'Ступеньки', namePl: 'Schody' },
  terrace: { icon: '🏡', color: '#84cc16', name: 'Терраса', namePl: 'Taras' },
  other: { icon: '📦', color: '#64748b', name: 'Другое', namePl: 'Inne' },
  rect: { icon: '⬜', color: '#374151', name: 'Область', namePl: 'Obszar' },
  wall: { icon: '➖', color: '#1f2937', name: 'Стена', namePl: 'Ściana' },
};

const LayoutConfiguratorPage = () => {
  // Canvas ref and state
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const fileInputRef = useRef(null);
  const bgFileInputRef = useRef(null);
  const outlineFileInputRef = useRef(null);
  
  // Data state
  const [saunaModels, setSaunaModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [modelOutline, setModelOutline] = useState(null);
  const [assets, setAssets] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [currentLayout, setCurrentLayout] = useState(null);
  
  // Canvas state - A4 landscape fixed size
  const [canvasWidth] = useState(A4_LANDSCAPE.widthPx);
  const [canvasHeight] = useState(A4_LANDSCAPE.heightPx);
  
  // Real-world dimensions that the canvas represents (in cm)
  const [canvasRealWidthCm, setCanvasRealWidthCm] = useState(DEFAULT_CANVAS_REAL_SIZE.widthCm);
  const [canvasRealHeightCm, setCanvasRealHeightCm] = useState(DEFAULT_CANVAS_REAL_SIZE.heightCm);
  
  // Calculated scale: pixels per cm
  const pixelsPerCm = canvasWidth / canvasRealWidthCm;
  
  // Grid in cm (e.g., 10cm grid)
  const [gridSizeCm, setGridSizeCm] = useState(10);
  const gridSizePx = gridSizeCm * pixelsPerCm;
  
  // Zoom state
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // UI state
  const [selectedObject, setSelectedObject] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('elements');
  
  // Drawing tools state
  const [activeTool, setActiveTool] = useState('select');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingObject, setDrawingObject] = useState(null);
  const [drawStartPoint, setDrawStartPoint] = useState(null);
  const [drawingColor, setDrawingColor] = useState('#374151');
  const [drawingStrokeWidthCm, setDrawingStrokeWidthCm] = useState(4); // Stroke width in CM
  const [drawingFill, setDrawingFill] = useState('transparent');
  
  // Refs for drawing (to access current state in event handlers)
  const activeToolRef = useRef('select');
  const isDrawingRef = useRef(false);
  const drawingObjectRef = useRef(null);
  const pixelsPerCmRef = useRef(pixelsPerCm);
  const strokeWidthCmRef = useRef(4);
  
  // Keep refs updated
  useEffect(() => { pixelsPerCmRef.current = pixelsPerCm; }, [pixelsPerCm]);
  useEffect(() => { strokeWidthCmRef.current = drawingStrokeWidthCm; }, [drawingStrokeWidthCm]);
  const drawStartPointRef = useRef(null);
  const drawingColorRef = useRef('#374151');
  const drawingFillRef = useRef('transparent');
  
  // Keep refs in sync with state
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { drawingColorRef.current = drawingColor; }, [drawingColor]);
  useEffect(() => { drawingFillRef.current = drawingFill; }, [drawingFill]);
  
  // Dialogs
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [uploadAssetDialogOpen, setUploadAssetDialogOpen] = useState(false);
  const [uploadOutlineDialogOpen, setUploadOutlineDialogOpen] = useState(false);
  const [showSaveOutlineDialog, setShowSaveOutlineDialog] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  
  // Save outline form
  const [saveOutlineForm, setSaveOutlineForm] = useState({
    outerLength: 400,
    outerWidth: 300,
    innerLength: 380,
    innerWidth: 280,
    wallThickness: 10,
  });
  
  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    name: '',
    type: 'other',
    modelId: null,
    file: null,
  });
  
  // Outline upload form
  const [outlineForm, setOutlineForm] = useState({
    file: null,
    outerWidth: 300,  // cm
    outerLength: 400, // cm
    innerWidth: 280,
    innerLength: 380,
    wallThickness: 10,
  });


  // Initialize Fabric canvas
  useEffect(() => {
    if (canvasRef.current && !fabricRef.current) {
      const canvas = new fabric.Canvas(canvasRef.current, {
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: '#f8fafc',
        selection: true,
        preserveObjectStacking: true,
      });
      
      fabricRef.current = canvas;
      
      // Event listeners
      canvas.on('selection:created', handleObjectSelected);
      canvas.on('selection:updated', handleObjectSelected);
      canvas.on('selection:cleared', () => setSelectedObject(null));
      canvas.on('object:modified', handleObjectModified);
      canvas.on('object:moving', handleObjectMoving);
      canvas.on('object:scaling', handleObjectScaling);
      
      // CRITICAL: Use mouse:down:before to intercept BEFORE Fabric processes selection
      canvas.on('mouse:down:before', handleCanvasMouseDownBefore);
      canvas.on('mouse:down', handleCanvasMouseDown);
      canvas.on('mouse:move', handleCanvasMouseMove);
      canvas.on('mouse:up', handleCanvasMouseUp);
      
      // Draw initial grid
      drawGrid();
      
      return () => {
        canvas.dispose();
        fabricRef.current = null;
      };
    }
  }, []);

  // Update canvas cursor when tool changes
  useEffect(() => {
    if (fabricRef.current) {
      const tool = DRAWING_TOOLS[activeTool];
      fabricRef.current.defaultCursor = tool?.cursor || 'default';
      fabricRef.current.hoverCursor = activeTool === 'select' ? 'move' : tool?.cursor || 'default';
      // Disable selection when drawing
      fabricRef.current.selection = activeTool === 'select';
    }
  }, [activeTool]);

  // Fetch initial data
  useEffect(() => {
    fetchSaunaModels();
    fetchAssets();
    fetchLayouts();
  }, []);

  // Redraw grid when scale or grid size changes
  useEffect(() => {
    if (fabricRef.current) {
      drawGrid();
    }
  }, [canvasRealWidthCm, gridSizeCm, showGrid]);

  // Draw grid
  const drawGrid = useCallback(() => {
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    
    // Remove existing grid lines and labels
    const objects = canvas.getObjects();
    objects.forEach(obj => {
      if (obj.isGridLine || obj.isGridLabel) {
        canvas.remove(obj);
      }
    });
    
    if (!showGrid) {
      canvas.renderAll();
      return;
    }
    
    const gridPx = gridSizeCm * pixelsPerCm;
    const majorGridEvery = 5; // Major grid line every 5 cells (e.g., every 50cm if grid is 10cm)
    
    // Draw vertical lines
    for (let i = 0; i <= canvasWidth; i += gridPx) {
      const cmValue = Math.round(i / pixelsPerCm);
      const isMajor = cmValue % (gridSizeCm * majorGridEvery) === 0;
      
      const line = new fabric.Line([i, 0, i, canvasHeight], {
        stroke: isMajor ? '#cbd5e1' : '#e2e8f0',
        strokeWidth: isMajor ? 1 : 0.5,
        selectable: false,
        evented: false,
        isGridLine: true,
      });
      canvas.add(line);
      canvas.sendToBack(line);
      
      // Add label for major lines
      if (isMajor && cmValue > 0) {
        const label = new fabric.Text(`${cmValue}`, {
          left: i + 2,
          top: 2,
          fontSize: 9,
          fill: '#94a3b8',
          selectable: false,
          evented: false,
          isGridLabel: true,
        });
        canvas.add(label);
      }
    }
    
    // Draw horizontal lines
    for (let i = 0; i <= canvasHeight; i += gridPx) {
      const cmValue = Math.round(i / pixelsPerCm);
      const isMajor = cmValue % (gridSizeCm * majorGridEvery) === 0;
      
      const line = new fabric.Line([0, i, canvasWidth, i], {
        stroke: isMajor ? '#cbd5e1' : '#e2e8f0',
        strokeWidth: isMajor ? 1 : 0.5,
        selectable: false,
        evented: false,
        isGridLine: true,
      });
      canvas.add(line);
      canvas.sendToBack(line);
      
      // Add label for major lines
      if (isMajor && cmValue > 0) {
        const label = new fabric.Text(`${cmValue}`, {
          left: 2,
          top: i + 2,
          fontSize: 9,
          fill: '#94a3b8',
          selectable: false,
          evented: false,
          isGridLabel: true,
        });
        canvas.add(label);
      }
    }
    
    canvas.renderAll();
  }, [showGrid, gridSizeCm, pixelsPerCm, canvasWidth, canvasHeight]);

  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  // API calls
  const fetchSaunaModels = async () => {
    try {
      const res = await fetch(`${API_URL}/api/layout-configurator/sauna-models`);
      const data = await res.json();
      setSaunaModels(data.models || []);
    } catch (error) {
      console.error('Error fetching sauna models:', error);
    }
  };

  const fetchAssets = async () => {
    try {
      const res = await fetch(`${API_URL}/api/layout-configurator/assets`);
      const data = await res.json();
      setAssets(data.assets || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
    }
  };

  const fetchLayouts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/layout-configurator/layouts`);
      const data = await res.json();
      setLayouts(data.layouts || []);
    } catch (error) {
      console.error('Error fetching layouts:', error);
    }
  };

  // Fetch outline for selected model/variant
  const fetchOutline = async (modelId, variantId = null) => {
    try {
      let url = `${API_URL}/api/layout-configurator/outlines/${modelId}`;
      if (variantId) {
        url += `?variant_id=${variantId}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const outline = await res.json();
        setModelOutline(outline);
        // Update canvas size based on outline
        if (outline.canvasWidth && outline.canvasHeight) {
          setCanvasWidth(outline.canvasWidth);
          setCanvasHeight(outline.canvasHeight);
        }
        // Load outline image to canvas
        loadOutlineToCanvas(outline);
      } else {
        setModelOutline(null);
        removeOutlineFromCanvas();
      }
    } catch (error) {
      console.error('Error fetching outline:', error);
      setModelOutline(null);
    }
  };

  // Load outline image to canvas as background
  const loadOutlineToCanvas = (outline) => {
    if (!fabricRef.current || !outline?.imageUrl) return;
    
    const canvas = fabricRef.current;
    
    // Remove existing outline
    removeOutlineFromCanvas();
    
    let imageUrl = outline.imageUrl;
    if (imageUrl.startsWith('/api/')) {
      imageUrl = `${API_URL}${imageUrl}`;
    }
    
    fabric.Image.fromURL(imageUrl, (img) => {
      if (!img) return;
      
      // Scale to fit canvas
      const scaleX = canvasWidth / img.width;
      const scaleY = canvasHeight / img.height;
      const scale = Math.min(scaleX, scaleY) * 0.95;
      
      img.set({
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        originX: 'center',
        originY: 'center',
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false,
        isOutline: true,
        opacity: 0.8,
      });
      
      canvas.add(img);
      // Send to back but above grid
      const gridLines = canvas.getObjects().filter(o => o.isGridLine);
      canvas.moveTo(img, gridLines.length);
      canvas.renderAll();
    }, { crossOrigin: 'anonymous' });
  };

  // Remove outline from canvas
  const removeOutlineFromCanvas = () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const outlines = canvas.getObjects().filter(o => o.isOutline);
    outlines.forEach(o => canvas.remove(o));
    canvas.renderAll();
  };

  // Handle model selection change
  const handleModelChange = (modelId) => {
    const model = saunaModels.find(m => m.id === modelId);
    setSelectedModel(model);
    setSelectedVariant(null);
    if (model) {
      fetchOutline(modelId);
    } else {
      setModelOutline(null);
      removeOutlineFromCanvas();
    }
  };

  // Handle variant selection change
  const handleVariantChange = (variantId) => {
    if (!selectedModel) return;
    const variant = selectedModel.variants?.find(v => v.id === variantId);
    setSelectedVariant(variant);
    fetchOutline(selectedModel.id, variantId);
  };

  // Upload outline
  const handleUploadOutline = async () => {
    if (!outlineForm.file || !selectedModel) {
      toast.error('Выберите модель и файл контура');
      return;
    }
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', outlineForm.file);
      formData.append('modelId', selectedModel.id);
      if (selectedVariant) {
        formData.append('variantId', selectedVariant.id);
      }
      formData.append('outerWidth', outlineForm.outerWidth.toString());
      formData.append('outerLength', outlineForm.outerLength.toString());
      formData.append('innerWidth', outlineForm.innerWidth.toString());
      formData.append('innerLength', outlineForm.innerLength.toString());
      formData.append('wallThickness', outlineForm.wallThickness.toString());
      formData.append('canvasWidth', canvasWidth.toString());
      formData.append('canvasHeight', canvasHeight.toString());
      
      const res = await fetch(`${API_URL}/api/layout-configurator/outlines`, {
        method: 'POST',
        body: formData,
      });
      
      if (res.ok) {
        const outline = await res.json();
        setModelOutline(outline);
        loadOutlineToCanvas(outline);
        toast.success('Контур загружен!');
        setUploadOutlineDialogOpen(false);
        setOutlineForm({
          file: null,
          outerWidth: 300,
          outerLength: 400,
          innerWidth: 280,
          innerLength: 380,
          wallThickness: 10,
        });
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Ошибка загрузки');
      }
    } catch (error) {
      toast.error('Ошибка при загрузке контура');
    }
    setLoading(false);
  };

  // Save drawn rectangle as outline for model
  const handleSaveDrawnOutline = async () => {
    if (!fabricRef.current || !selectedModel) {
      toast.error('Выберите модель сауны');
      return;
    }
    
    const canvas = fabricRef.current;
    const activeObj = canvas.getActiveObject();
    
    if (!activeObj || activeObj.type !== 'rect') {
      toast.error('Выберите прямоугольник для сохранения как контур');
      return;
    }
    
    setLoading(true);
    try {
      // Export only the selected rectangle as PNG
      const tempCanvas = document.createElement('canvas');
      const rectWidth = activeObj.width * (activeObj.scaleX || 1);
      const rectHeight = activeObj.height * (activeObj.scaleY || 1);
      tempCanvas.width = rectWidth;
      tempCanvas.height = rectHeight;
      const ctx = tempCanvas.getContext('2d');
      
      // Draw rectangle
      ctx.strokeStyle = activeObj.stroke || '#374151';
      ctx.lineWidth = activeObj.strokeWidth || 3;
      ctx.strokeRect(0, 0, rectWidth, rectHeight);
      if (activeObj.fill && activeObj.fill !== 'transparent') {
        ctx.fillStyle = activeObj.fill;
        ctx.fillRect(0, 0, rectWidth, rectHeight);
      }
      
      // Convert to base64
      const dataUrl = tempCanvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1];
      
      // Create a blob from base64
      const byteString = atob(base64Data);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: 'image/png' });
      const file = new File([blob], 'outline.png', { type: 'image/png' });
      
      // Upload to backend
      const formData = new FormData();
      formData.append('file', file);
      formData.append('modelId', selectedModel.id);
      if (selectedVariant) {
        formData.append('variantId', selectedVariant.id);
      }
      formData.append('outerLength', saveOutlineForm.outerLength.toString());
      formData.append('outerWidth', saveOutlineForm.outerWidth.toString());
      formData.append('innerLength', saveOutlineForm.innerLength.toString());
      formData.append('innerWidth', saveOutlineForm.innerWidth.toString());
      formData.append('wallThickness', saveOutlineForm.wallThickness.toString());
      formData.append('canvasWidth', canvasWidth.toString());
      formData.append('canvasHeight', canvasHeight.toString());
      
      const res = await fetch(`${API_URL}/api/layout-configurator/outlines`, {
        method: 'POST',
        body: formData,
      });
      
      if (res.ok) {
        const outline = await res.json();
        setModelOutline(outline);
        toast.success('Контур сохранён для модели!');
        setShowSaveOutlineDialog(false);
        
        // Mark the rectangle as outline (optional: make it non-selectable)
        activeObj.set({
          isOutline: true,
          selectable: false,
          evented: false,
          opacity: 0.8,
        });
        canvas.discardActiveObject();
        canvas.renderAll();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Ошибка сохранения');
      }
    } catch (error) {
      console.error('Save outline error:', error);
      toast.error('Ошибка при сохранении контура');
    }
    setLoading(false);
  };

  // Convert pixels to centimeters (using current scale)
  const pxToCm = useCallback((px) => {
    return (px / pixelsPerCm).toFixed(1);
  }, [pixelsPerCm]);

  // Convert centimeters to pixels
  const cmToPx = useCallback((cm) => {
    return cm * pixelsPerCm;
  }, [pixelsPerCm]);

  // Snap to grid (in pixels, based on cm grid)
  const snapToGrid = useCallback((valuePx) => {
    const gridPx = gridSizeCm * pixelsPerCm;
    return Math.round(valuePx / gridPx) * gridPx;
  }, [gridSizeCm, pixelsPerCm]);

  // Snap cm value to grid
  const snapCmToGrid = useCallback((valueCm) => {
    return Math.round(valueCm / gridSizeCm) * gridSizeCm;
  }, [gridSizeCm]);

  // ============ ZOOM ============
  
  const handleZoom = useCallback((delta) => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    let newZoom = zoomLevel + delta;
    newZoom = Math.max(0.25, Math.min(3, newZoom)); // Limit zoom 25% - 300%
    
    canvas.setZoom(newZoom);
    canvas.setWidth(canvasWidth * newZoom);
    canvas.setHeight(canvasHeight * newZoom);
    setZoomLevel(newZoom);
  }, [zoomLevel, canvasWidth, canvasHeight]);

  const resetZoom = useCallback(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    canvas.setZoom(1);
    canvas.setWidth(canvasWidth);
    canvas.setHeight(canvasHeight);
    setZoomLevel(1);
  }, [canvasWidth, canvasHeight]);

  // ============ DRAWING TOOLS ============
  
  // Update canvas interactivity based on active tool
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    const currentTool = activeToolRef.current;
    
    if (currentTool !== 'select') {
      // When drawing tool is active, completely disable object interactions
      canvas.skipTargetFind = true;
      canvas.selection = false;
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
      
      // Make all existing objects non-interactive
      canvas.getObjects().forEach(obj => {
        if (!obj.isGridLine && !obj.isGridLabel && !obj.isDimensionLabel) {
          obj.selectable = false;
          obj.evented = false;
          obj.hoverCursor = 'crosshair';
        }
      });
    } else {
      // When select tool is active, enable interactions
      canvas.skipTargetFind = false;
      canvas.selection = true;
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
      
      // Make all objects interactive again
      canvas.getObjects().forEach(obj => {
        if (!obj.isGridLine && !obj.isGridLabel && !obj.isDimensionLabel) {
          obj.selectable = true;
          obj.evented = true;
          obj.hoverCursor = 'move';
        }
      });
    }
    
    canvas.renderAll();
  }, [activeTool]);
  
  // Mouse down - start drawing
  const handleCanvasMouseDown = useCallback((opt) => {
    const currentTool = activeToolRef.current;
    if (currentTool === 'select') return;
    
    // Skip grid labels
    if (opt.target && opt.target.isGridLabel) return;
    
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    // Ensure canvas is in drawing mode (already set in before handler)
    canvas.renderAll();
    
    const pointer = canvas.getPointer(opt.e);
    const pxPerCm = pixelsPerCmRef.current;
    // Snap to 1cm for precise positioning
    const snap = (v) => Math.round(v / pxPerCm) * pxPerCm;
    const x = snap(pointer.x);
    const y = snap(pointer.y);
    
    isDrawingRef.current = true;
    drawStartPointRef.current = { x, y };
    setIsDrawing(true);
    setDrawStartPoint({ x, y });
    
    // Calculate stroke width in pixels from cm
    const strokeWidthPx = strokeWidthCmRef.current * pxPerCm;
    
    let obj;
    
    if (currentTool === 'rectangle') {
      obj = new fabric.Rect({
        left: x,
        top: y,
        width: 1,
        height: 1,
        fill: drawingFillRef.current,
        stroke: drawingColorRef.current,
        strokeWidth: strokeWidthPx,
        strokeUniform: true,
        strokeWidthCm: strokeWidthCmRef.current,
        elementId: `rect-${Date.now()}`,
        elementType: 'rect',
        isDrawnShape: true,
      });
    } else if (currentTool === 'wall') {
      obj = new fabric.Line([x, y, x + 1, y], {
        stroke: drawingColorRef.current,
        strokeWidth: strokeWidthPx,
        strokeLineCap: 'round',
        strokeWidthCm: strokeWidthCmRef.current,
        elementId: `wall-${Date.now()}`,
        elementType: 'wall',
        isDrawnShape: true,
      });
    }
    
    if (obj) {
      canvas.add(obj);
      drawingObjectRef.current = obj;
      setDrawingObject(obj);
      canvas.renderAll();
    }
  }, [gridSizeCm]);
  
  // Mouse move - update drawing
  const handleCanvasMouseMove = useCallback((opt) => {
    if (!isDrawingRef.current || !drawingObjectRef.current || !drawStartPointRef.current) return;
    
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    const pointer = canvas.getPointer(opt.e);
    const pxPerCm = pixelsPerCmRef.current;
    // Snap to 1cm for precise positioning (not grid size)
    const snap = (v) => Math.round(v / pxPerCm) * pxPerCm;
    const x = snap(pointer.x);
    const y = snap(pointer.y);
    const startPoint = drawStartPointRef.current;
    const obj = drawingObjectRef.current;
    const currentTool = activeToolRef.current;
    
    if (currentTool === 'rectangle') {
      const width = Math.abs(x - startPoint.x) || 1;
      const height = Math.abs(y - startPoint.y) || 1;
      const left = Math.min(startPoint.x, x);
      const top = Math.min(startPoint.y, y);
      
      obj.set({
        left,
        top,
        width,
        height,
      });
    } else if (currentTool === 'wall') {
      obj.set({
        x2: x,
        y2: y,
      });
    }
    
    obj.setCoords();
    canvas.renderAll();
  }, []);
  
  // Mouse up - finish drawing
  const handleCanvasMouseUp = useCallback((opt) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    // CRITICAL: Re-enable target finding after drawing
    canvas.skipTargetFind = false;
    canvas.selection = true;
    
    // ALWAYS restore interactivity of all objects after mouse up
    // This is critical - even if we weren't drawing, restore state
    canvas.getObjects().forEach(obj => {
      if (obj._wasSelectable !== undefined) {
        obj.selectable = obj._wasSelectable;
        obj.evented = obj._wasEvented;
        delete obj._wasSelectable;
        delete obj._wasEvented;
      }
    });
    
    if (!isDrawingRef.current) {
      canvas.renderAll();
      return;
    }
    
    isDrawingRef.current = false;
    setIsDrawing(false);
    
    const obj = drawingObjectRef.current;
    const currentTool = activeToolRef.current;
    const pxPerCm = pixelsPerCmRef.current;
    // Minimum size is 5cm (not dependent on grid size)
    const minSizePx = 5 * pxPerCm;
    
    if (obj) {
      // Check if shape is too small (less than 5cm)
      let isTooSmall = false;
      
      if (currentTool === 'rectangle') {
        isTooSmall = (obj.width || 0) < minSizePx || (obj.height || 0) < minSizePx;
      } else if (currentTool === 'wall') {
        const dx = (obj.x2 || 0) - (obj.x1 || 0);
        const dy = (obj.y2 || 0) - (obj.y1 || 0);
        const length = Math.sqrt(dx * dx + dy * dy);
        isTooSmall = length < minSizePx;
      }
      
      if (isTooSmall) {
        canvas.remove(obj);
        toast.info('Слишком маленький объект (минимум 5 см)');
      } else {
        // Enable controls for resizing
        obj.setCoords();
        canvas.setActiveObject(obj);
        
        // Show dimensions in CM
        if (currentTool === 'rectangle') {
          const widthCm = (obj.width / pxPerCm).toFixed(0);
          const heightCm = (obj.height / pxPerCm).toFixed(0);
          toast.success(`Прямоугольник: ${widthCm} × ${heightCm} см`);
        } else if (currentTool === 'wall') {
          const dx = (obj.x2 || 0) - (obj.x1 || 0);
          const dy = (obj.y2 || 0) - (obj.y1 || 0);
          const lengthPx = Math.sqrt(dx * dx + dy * dy);
          const lengthCm = (lengthPx / pxPerCm).toFixed(0);
          toast.success(`Стена: ${lengthCm} см`);
        }
      }
    }
    
    drawingObjectRef.current = null;
    drawStartPointRef.current = null;
    setDrawingObject(null);
    setDrawStartPoint(null);
    canvas.renderAll();
  }, []);

  // Handle object scaling (for showing dimensions while resizing)
  const handleObjectScaling = (e) => {
    const obj = e.target;
    if (!obj || !obj.isDrawnShape) return;
    
    // Snap scale to grid
    if (obj.type === 'rect') {
      const gridPx = gridSizeCm * pixelsPerCm;
      const newWidth = Math.round((obj.width * obj.scaleX) / gridPx) * gridPx;
      const newHeight = Math.round((obj.height * obj.scaleY) / gridPx) * gridPx;
      obj.set({
        width: newWidth,
        height: newHeight,
        scaleX: 1,
        scaleY: 1,
      });
    }
  };

  // Find the main room rectangle (largest rect that could be the room outline)
  const findRoomRect = useCallback(() => {
    if (!fabricRef.current) return null;
    const canvas = fabricRef.current;
    const rects = canvas.getObjects().filter(o => 
      o.isDrawnShape && o.type === 'rect' && !o.isOutline
    );
    if (rects.length === 0) return null;
    
    // Find the largest rectangle by area
    let largest = rects[0];
    let maxArea = (largest.width || 0) * (largest.height || 0);
    
    rects.forEach(rect => {
      const area = (rect.width || 0) * (rect.height || 0);
      if (area > maxArea) {
        maxArea = area;
        largest = rect;
      }
    });
    
    return largest;
  }, []);

  // Calculate distances from object to room walls
  const calculateDistances = useCallback((obj) => {
    const room = findRoomRect();
    if (!room || !obj || obj === room) return null;
    
    const objLeft = obj.left;
    const objTop = obj.top;
    const objRight = obj.left + (obj.width || 0) * (obj.scaleX || 1);
    const objBottom = obj.top + (obj.height || 0) * (obj.scaleY || 1);
    
    const roomLeft = room.left;
    const roomTop = room.top;
    const roomRight = room.left + room.width * (room.scaleX || 1);
    const roomBottom = room.top + room.height * (room.scaleY || 1);
    
    return {
      leftWall: ((objLeft - roomLeft) / pixelsPerCm).toFixed(0),
      rightWall: ((roomRight - objRight) / pixelsPerCm).toFixed(0),
      topWall: ((objTop - roomTop) / pixelsPerCm).toFixed(0),
      bottomWall: ((roomBottom - objBottom) / pixelsPerCm).toFixed(0),
    };
  }, [pixelsPerCm, findRoomRect]);

  // Update dimension labels on canvas
  const updateDimensionLabels = useCallback(() => {
    if (!fabricRef.current || !showDimensions) return;
    
    const canvas = fabricRef.current;
    
    // Remove old dimension labels
    canvas.getObjects().filter(o => o.isDimensionLabel).forEach(o => canvas.remove(o));
    
    // Get all drawn shapes (except grid)
    const shapes = canvas.getObjects().filter(o => 
      o.isDrawnShape && !o.isGridLine && !o.isGridLabel
    );
    
    // Find room (largest rectangle)
    const room = findRoomRect();
    
    // Helper to draw distance line with arrows and label
    const drawDistanceLine = (x1, y1, x2, y2, labelText, isHorizontal = true) => {
      const arrowSize = 4;
      
      // Main line
      const line = new fabric.Line([x1, y1, x2, y2], {
        stroke: '#dc2626',
        strokeWidth: 1,
        strokeDashArray: [4, 2],
        selectable: false,
        evented: false,
        isDimensionLabel: true,
      });
      canvas.add(line);
      
      // Arrow at start
      if (isHorizontal) {
        const arrow1 = new fabric.Triangle({
          left: x1,
          top: y1,
          width: arrowSize,
          height: arrowSize * 1.5,
          fill: '#dc2626',
          angle: -90,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
          isDimensionLabel: true,
        });
        canvas.add(arrow1);
        
        const arrow2 = new fabric.Triangle({
          left: x2,
          top: y2,
          width: arrowSize,
          height: arrowSize * 1.5,
          fill: '#dc2626',
          angle: 90,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
          isDimensionLabel: true,
        });
        canvas.add(arrow2);
      } else {
        const arrow1 = new fabric.Triangle({
          left: x1,
          top: y1,
          width: arrowSize,
          height: arrowSize * 1.5,
          fill: '#dc2626',
          angle: 0,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
          isDimensionLabel: true,
        });
        canvas.add(arrow1);
        
        const arrow2 = new fabric.Triangle({
          left: x2,
          top: y2,
          width: arrowSize,
          height: arrowSize * 1.5,
          fill: '#dc2626',
          angle: 180,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
          isDimensionLabel: true,
        });
        canvas.add(arrow2);
      }
      
      // Label
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const label = new fabric.Text(labelText, {
        left: midX + (isHorizontal ? 0 : 8),
        top: midY + (isHorizontal ? -12 : 0),
        fontSize: 9,
        fill: '#dc2626',
        fontWeight: 'bold',
        backgroundColor: 'rgba(255,255,255,0.8)',
        originX: 'center',
        originY: isHorizontal ? 'bottom' : 'center',
        selectable: false,
        evented: false,
        isDimensionLabel: true,
      });
      canvas.add(label);
    };
    
    shapes.forEach(obj => {
      if (obj.type === 'rect') {
        const width = obj.width * (obj.scaleX || 1);
        const height = obj.height * (obj.scaleY || 1);
        const widthCm = Math.round(width / pixelsPerCm);
        const heightCm = Math.round(height / pixelsPerCm);
        
        // Width label (top center)
        const widthLabel = new fabric.Text(`${widthCm} см`, {
          left: obj.left + width / 2,
          top: obj.top - 14,
          fontSize: 10,
          fill: '#1e40af',
          fontWeight: 'bold',
          originX: 'center',
          selectable: false,
          evented: false,
          isDimensionLabel: true,
        });
        canvas.add(widthLabel);
        
        // Height label (left center, rotated)
        const heightLabel = new fabric.Text(`${heightCm} см`, {
          left: obj.left - 6,
          top: obj.top + height / 2,
          fontSize: 10,
          fill: '#1e40af',
          fontWeight: 'bold',
          originX: 'center',
          originY: 'center',
          angle: -90,
          selectable: false,
          evented: false,
          isDimensionLabel: true,
        });
        canvas.add(heightLabel);
        
        // Distance labels to room walls (if this is not the room itself)
        if (room && obj !== room) {
          const objRight = obj.left + width;
          const objBottom = obj.top + height;
          const roomRight = room.left + room.width * (room.scaleX || 1);
          const roomBottom = room.top + room.height * (room.scaleY || 1);
          
          const distLeft = Math.round((obj.left - room.left) / pixelsPerCm);
          const distRight = Math.round((roomRight - objRight) / pixelsPerCm);
          const distTop = Math.round((obj.top - room.top) / pixelsPerCm);
          const distBottom = Math.round((roomBottom - objBottom) / pixelsPerCm);
          
          // Left distance line + label
          if (distLeft > 10) {
            drawDistanceLine(room.left, obj.top + height / 2, obj.left, obj.top + height / 2, `${distLeft}`, true);
          }
          
          // Right distance line + label
          if (distRight > 10) {
            drawDistanceLine(objRight, obj.top + height / 2, roomRight, obj.top + height / 2, `${distRight}`, true);
          }
          
          // Top distance line + label
          if (distTop > 10) {
            drawDistanceLine(obj.left + width / 2, room.top, obj.left + width / 2, obj.top, `${distTop}`, false);
          }
          
          // Bottom distance line + label
          if (distBottom > 10) {
            drawDistanceLine(obj.left + width / 2, objBottom, obj.left + width / 2, roomBottom, `${distBottom}`, false);
          }
        }
      } else if (obj.type === 'line') {
        // Line length label
        const dx = (obj.x2 || 0) - (obj.x1 || 0);
        const dy = (obj.y2 || 0) - (obj.y1 || 0);
        const length = Math.sqrt(dx * dx + dy * dy);
        const lengthCm = Math.round(length / pixelsPerCm);
        
        const midX = obj.left + (obj.x1 + obj.x2) / 2;
        const midY = obj.top + (obj.y1 + obj.y2) / 2;
        
        const lineLabel = new fabric.Text(`${lengthCm} см`, {
          left: midX,
          top: midY - 12,
          fontSize: 10,
          fill: '#1e40af',
          fontWeight: 'bold',
          originX: 'center',
          selectable: false,
          evented: false,
          isDimensionLabel: true,
        });
        canvas.add(lineLabel);
      }
    });
    
    // Draw distances between objects (not room)
    const nonRoomShapes = shapes.filter(s => s !== room && s.type === 'rect');
    for (let i = 0; i < nonRoomShapes.length; i++) {
      for (let j = i + 1; j < nonRoomShapes.length; j++) {
        const obj1 = nonRoomShapes[i];
        const obj2 = nonRoomShapes[j];
        
        const w1 = obj1.width * (obj1.scaleX || 1);
        const h1 = obj1.height * (obj1.scaleY || 1);
        const w2 = obj2.width * (obj2.scaleX || 1);
        const h2 = obj2.height * (obj2.scaleY || 1);
        
        const c1x = obj1.left + w1 / 2;
        const c1y = obj1.top + h1 / 2;
        const c2x = obj2.left + w2 / 2;
        const c2y = obj2.top + h2 / 2;
        
        // Check if objects are horizontally aligned (similar Y)
        if (Math.abs(c1y - c2y) < Math.max(h1, h2) / 2) {
          // Horizontal distance between objects
          let distPx;
          if (obj1.left + w1 < obj2.left) {
            // obj1 is to the left of obj2
            distPx = obj2.left - (obj1.left + w1);
            if (distPx > 10 * pixelsPerCm) {
              const distCm = Math.round(distPx / pixelsPerCm);
              const y = (c1y + c2y) / 2;
              drawDistanceLine(obj1.left + w1, y, obj2.left, y, `${distCm}`, true);
            }
          } else if (obj2.left + w2 < obj1.left) {
            // obj2 is to the left of obj1
            distPx = obj1.left - (obj2.left + w2);
            if (distPx > 10 * pixelsPerCm) {
              const distCm = Math.round(distPx / pixelsPerCm);
              const y = (c1y + c2y) / 2;
              drawDistanceLine(obj2.left + w2, y, obj1.left, y, `${distCm}`, true);
            }
          }
        }
        
        // Check if objects are vertically aligned (similar X)
        if (Math.abs(c1x - c2x) < Math.max(w1, w2) / 2) {
          // Vertical distance between objects
          let distPx;
          if (obj1.top + h1 < obj2.top) {
            // obj1 is above obj2
            distPx = obj2.top - (obj1.top + h1);
            if (distPx > 10 * pixelsPerCm) {
              const distCm = Math.round(distPx / pixelsPerCm);
              const x = (c1x + c2x) / 2;
              drawDistanceLine(x, obj1.top + h1, x, obj2.top, `${distCm}`, false);
            }
          } else if (obj2.top + h2 < obj1.top) {
            // obj2 is above obj1
            distPx = obj1.top - (obj2.top + h2);
            if (distPx > 10 * pixelsPerCm) {
              const distCm = Math.round(distPx / pixelsPerCm);
              const x = (c1x + c2x) / 2;
              drawDistanceLine(x, obj2.top + h2, x, obj1.top, `${distCm}`, false);
            }
          }
        }
      }
    }
    
    canvas.renderAll();
  }, [pixelsPerCm, findRoomRect, showDimensions]);

  // Update dimension labels when showDimensions changes
  useEffect(() => {
    if (fabricRef.current) {
      if (showDimensions) {
        updateDimensionLabels();
      } else {
        // Remove dimension labels
        fabricRef.current.getObjects()
          .filter(o => o.isDimensionLabel)
          .forEach(o => fabricRef.current.remove(o));
        fabricRef.current.renderAll();
      }
    }
  }, [showDimensions, updateDimensionLabels]);

  // Update dimension labels when drawing finishes
  useEffect(() => {
    if (!isDrawing && showDimensions && fabricRef.current) {
      // Small delay to ensure the object is fully added
      const timer = setTimeout(() => {
        updateDimensionLabels();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isDrawing, showDimensions, updateDimensionLabels]);

  // Event handlers
  const handleObjectSelected = (e) => {
    const obj = e.selected?.[0];
    if (obj && !obj.isGridLine && !obj.isBackground && !obj.isGridLabel) {
      const canvas = fabricRef.current;
      
      // Get dimensions for drawn shapes in CM
      let widthCm = null, heightCm = null, lengthCm = null;
      let widthPx = null, heightPx = null, lengthPx = null;
      let strokeWidthCm = obj.strokeWidthCm || (obj.strokeWidth / pixelsPerCm).toFixed(1);
      
      if (obj.isDrawnShape) {
        if (obj.type === 'rect') {
          widthPx = Math.round(obj.width * (obj.scaleX || 1));
          heightPx = Math.round(obj.height * (obj.scaleY || 1));
          widthCm = (widthPx / pixelsPerCm).toFixed(0);
          heightCm = (heightPx / pixelsPerCm).toFixed(0);
        } else if (obj.type === 'line') {
          const dx = obj.x2 - obj.x1;
          const dy = obj.y2 - obj.y1;
          lengthPx = Math.round(Math.sqrt(dx * dx + dy * dy));
          lengthCm = (lengthPx / pixelsPerCm).toFixed(0);
        }
      }
      
      // Position in CM
      const xCm = (obj.left / pixelsPerCm).toFixed(0);
      const yCm = (obj.top / pixelsPerCm).toFixed(0);
      
      // Calculate distances to room walls
      const distances = calculateDistances(obj);
      
      setSelectedObject({
        id: obj.elementId,
        type: obj.elementType,
        x: Math.round(obj.left),
        y: Math.round(obj.top),
        xCm,
        yCm,
        rotation: Math.round(obj.angle || 0),
        scale: obj.scaleX || 1,
        zIndex: canvas ? canvas.getObjects().indexOf(obj) : 0,
        isDrawnShape: obj.isDrawnShape || false,
        widthPx,
        heightPx,
        lengthPx,
        widthCm,
        heightCm,
        lengthCm,
        stroke: obj.stroke,
        fill: obj.fill,
        strokeWidth: obj.strokeWidth,
        strokeWidthCm,
        distances, // Distances to room walls
      });
    }
  };

  const handleObjectModified = (e) => {
    const obj = e.target;
    if (obj && !obj.isGridLine) {
      // Snap to grid after modification
      obj.set({
        left: snapToGrid(obj.left),
        top: snapToGrid(obj.top),
      });
      
      // For drawn rectangles, also snap dimensions
      if (obj.isDrawnShape && obj.type === 'rect') {
        const newWidth = snapToGrid(obj.width * (obj.scaleX || 1));
        const newHeight = snapToGrid(obj.height * (obj.scaleY || 1));
        obj.set({
          width: newWidth,
          height: newHeight,
          scaleX: 1,
          scaleY: 1,
        });
      }
      
      obj.setCoords();
      fabricRef.current.renderAll();
      
      handleObjectSelected({ selected: [obj] });
      updateDimensionLabels();
    }
  };

  const handleObjectMoving = (e) => {
    const obj = e.target;
    obj.set({
      left: snapToGrid(obj.left),
      top: snapToGrid(obj.top),
    });
    // Update dimension labels during movement for real-time feedback
    updateDimensionLabels();
  };

  // Add element to canvas
  const addElementToCanvas = async (asset) => {
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    
    try {
      // Determine image URL
      let imageUrl = asset.imageUrl;
      if (imageUrl.startsWith('/api/')) {
        imageUrl = `${API_URL}${imageUrl}`;
      }
      
      fabric.Image.fromURL(imageUrl, (img) => {
        if (!img) {
          toast.error('Не удалось загрузить изображение');
          return;
        }
        
        // Set initial properties
        const scale = Math.min(asset.width / img.width, asset.height / img.height, 1);
        img.set({
          left: snapToGrid(canvasWidth / 2 - (img.width * scale) / 2),
          top: snapToGrid(canvasHeight / 2 - (img.height * scale) / 2),
          scaleX: scale,
          scaleY: scale,
          elementId: `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          elementType: asset.type,
          assetId: asset.id,
          assetName: asset.name,
        });
        
        // Add controls
        img.setControlsVisibility({
          mt: false,
          mb: false,
          ml: false,
          mr: false,
        });
        
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        
        toast.success(`Добавлен: ${asset.name}`);
      }, { crossOrigin: 'anonymous' });
    } catch (error) {
      console.error('Error adding element:', error);
      toast.error('Ошибка при добавлении элемента');
    }
  };

  // Rotate selected object
  const rotateSelected = (degrees) => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const obj = canvas.getActiveObject();
    if (obj && !obj.isGridLine) {
      obj.rotate((obj.angle || 0) + degrees);
      canvas.renderAll();
      handleObjectSelected({ selected: [obj] });
    }
  };

  // Scale selected object
  const scaleSelected = (delta) => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const obj = canvas.getActiveObject();
    if (obj && !obj.isGridLine) {
      const newScale = Math.max(0.1, Math.min(3, (obj.scaleX || 1) + delta));
      obj.scale(newScale);
      canvas.renderAll();
      handleObjectSelected({ selected: [obj] });
    }
  };

  // Delete selected object
  const deleteSelected = () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const obj = canvas.getActiveObject();
    if (obj && !obj.isGridLine && !obj.isBackground) {
      canvas.remove(obj);
      canvas.renderAll();
      setSelectedObject(null);
      toast.success('Элемент удален');
    }
  };

  // Clear canvas
  const clearCanvas = () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const objects = canvas.getObjects().filter(o => !o.isGridLine);
    objects.forEach(obj => canvas.remove(obj));
    canvas.renderAll();
    setSelectedObject(null);
    setCurrentLayout(null);
  };

  // Upload asset
  const handleUploadAsset = async () => {
    if (!uploadForm.file || !uploadForm.name || !uploadForm.type) {
      toast.error('Заполните все поля');
      return;
    }
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('name', uploadForm.name);
      formData.append('nameRu', uploadForm.name);
      formData.append('type', uploadForm.type);
      if (uploadForm.modelId) {
        formData.append('modelId', uploadForm.modelId);
      }
      
      const res = await fetch(`${API_URL}/api/layout-configurator/assets`, {
        method: 'POST',
        body: formData,
      });
      
      if (res.ok) {
        toast.success('Элемент загружен!');
        setUploadAssetDialogOpen(false);
        setUploadForm({ name: '', type: 'other', modelId: null, file: null });
        fetchAssets();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Ошибка загрузки');
      }
    } catch (error) {
      toast.error('Ошибка при загрузке');
    }
    setLoading(false);
  };

  // Delete asset
  const handleDeleteAsset = async (assetId) => {
    if (!window.confirm('Удалить этот элемент из библиотеки?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/layout-configurator/assets/${assetId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Элемент удален');
        fetchAssets();
      }
    } catch (error) {
      toast.error('Ошибка при удалении');
    }
  };

  // Save layout
  const handleSaveLayout = async () => {
    if (!fabricRef.current || !selectedModel || !layoutName.trim()) {
      toast.error('Выберите модель и введите название');
      return;
    }
    
    setLoading(true);
    try {
      const canvas = fabricRef.current;
      
      // Collect elements
      const elements = [];
      canvas.getObjects().forEach((obj, index) => {
        if (!obj.isGridLine && !obj.isBackground && obj.elementId) {
          elements.push({
            id: obj.elementId,
            assetId: obj.assetId,
            type: obj.elementType,
            x: Math.round(obj.left),
            y: Math.round(obj.top),
            rotation: Math.round(obj.angle || 0),
            scale: parseFloat((obj.scaleX || 1).toFixed(2)),
            zIndex: index,
          });
        }
      });
      
      const formData = new FormData();
      formData.append('name', layoutName);
      formData.append('modelId', selectedModel.id);
      formData.append('modelName', selectedModel.name);
      formData.append('canvasWidth', canvasWidth.toString());
      formData.append('canvasHeight', canvasHeight.toString());
      formData.append('elements', JSON.stringify(elements));
      formData.append('modelSize', selectedModel.layoutSize || '');
      formData.append('capacity', selectedModel.capacity || '');
      
      const url = currentLayout
        ? `${API_URL}/api/layout-configurator/layouts/${currentLayout.id}/data`
        : `${API_URL}/api/layout-configurator/layouts`;
      
      const method = currentLayout ? 'PUT' : 'POST';
      
      let res;
      if (currentLayout) {
        // Update existing
        res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: layoutName,
            elements,
            canvasWidth,
            canvasHeight,
          }),
        });
      } else {
        // Create new
        res = await fetch(url, {
          method: 'POST',
          body: formData,
        });
      }
      
      if (res.ok) {
        const data = await res.json();
        toast.success('Планировка сохранена!');
        setSaveDialogOpen(false);
        fetchLayouts();
        if (!currentLayout) {
          setCurrentLayout({ id: data.layoutId, name: layoutName });
        }
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Ошибка сохранения');
      }
    } catch (error) {
      toast.error('Ошибка при сохранении');
    }
    setLoading(false);
  };

  // Load layout
  const handleLoadLayout = async (layout) => {
    if (!fabricRef.current) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/layout-configurator/layouts/${layout.id}`);
      if (!res.ok) throw new Error('Layout not found');
      
      const data = await res.json();
      
      // Clear canvas
      clearCanvas();
      
      // Set canvas size
      setCanvasWidth(data.canvasWidth || 800);
      setCanvasHeight(data.canvasHeight || 400);
      
      // Find and set model
      const model = saunaModels.find(m => m.id === data.modelId);
      if (model) setSelectedModel(model);
      
      // Load elements
      for (const el of data.elements || []) {
        const asset = assets.find(a => a.id === el.assetId);
        if (asset) {
          await loadElementToCanvas(asset, el);
        }
      }
      
      setCurrentLayout(data);
      setLayoutName(data.name);
      setLoadDialogOpen(false);
      toast.success('Планировка загружена');
    } catch (error) {
      toast.error('Ошибка при загрузке планировки');
    }
    setLoading(false);
  };

  // Load element with position
  const loadElementToCanvas = (asset, position) => {
    return new Promise((resolve) => {
      if (!fabricRef.current) {
        resolve();
        return;
      }
      
      let imageUrl = asset.imageUrl;
      if (imageUrl.startsWith('/api/')) {
        imageUrl = `${API_URL}${imageUrl}`;
      }
      
      fabric.Image.fromURL(imageUrl, (img) => {
        if (!img) {
          resolve();
          return;
        }
        
        img.set({
          left: position.x,
          top: position.y,
          scaleX: position.scale || 1,
          scaleY: position.scale || 1,
          angle: position.rotation || 0,
          elementId: position.id,
          elementType: position.type,
          assetId: asset.id,
          assetName: asset.name,
        });
        
        fabricRef.current.add(img);
        fabricRef.current.renderAll();
        resolve();
      }, { crossOrigin: 'anonymous' });
    });
  };

  // Export to PNG
  const handleExportPNG = () => {
    if (!fabricRef.current) return;
    
    // Temporarily hide grid
    const gridLines = fabricRef.current.getObjects().filter(o => o.isGridLine);
    gridLines.forEach(line => line.set('visible', false));
    fabricRef.current.renderAll();
    
    // Export
    const dataURL = fabricRef.current.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
    });
    
    // Restore grid
    gridLines.forEach(line => line.set('visible', showGrid));
    fabricRef.current.renderAll();
    
    // Download
    const link = document.createElement('a');
    link.download = `layout-${currentLayout?.name || 'export'}-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    
    toast.success('Изображение экспортировано');
  };

  // Publish layout
  const handlePublishLayout = async (layout) => {
    try {
      const endpoint = layout.isPublished ? 'unpublish' : 'publish';
      const res = await fetch(`${API_URL}/api/layout-configurator/layouts/${layout.id}/${endpoint}`, {
        method: 'POST',
      });
      
      if (res.ok) {
        toast.success(layout.isPublished ? 'Планировка скрыта' : 'Планировка опубликована!');
        fetchLayouts();
      }
    } catch (error) {
      toast.error('Ошибка');
    }
  };

  // Delete layout
  const handleDeleteLayout = async (layoutId) => {
    if (!window.confirm('Удалить эту планировку?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/layout-configurator/layouts/${layoutId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Планировка удалена');
        fetchLayouts();
        if (currentLayout?.id === layoutId) {
          clearCanvas();
        }
      }
    } catch (error) {
      toast.error('Ошибка при удалении');
    }
  };

  // Duplicate layout
  const handleDuplicateLayout = async (layout) => {
    try {
      const res = await fetch(`${API_URL}/api/layout-configurator/layouts/${layout.id}/duplicate`, {
        method: 'POST',
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success('Планировка скопирована!');
        fetchLayouts();
        // Optionally load the duplicated layout
        if (data.layout) {
          handleLoadLayout(data.layout);
        }
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Ошибка при копировании');
      }
    } catch (error) {
      toast.error('Ошибка при копировании');
    }
  };

  // Group assets by type
  const assetsByType = assets.reduce((acc, asset) => {
    if (!acc[asset.type]) acc[asset.type] = [];
    acc[asset.type].push(asset);
    return acc;
  }, {});

  return (
    <div className="h-[calc(100vh-200px)] flex gap-4">
      {/* Left Panel - Settings & Elements */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-2">
        {/* Settings Card */}
        <Card>
          <CardHeader className="py-2 px-3 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Настройки
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-3">
            {/* Model selector */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Модель сауны</Label>
              <Select
                value={selectedModel?.id || ''}
                onValueChange={handleModelChange}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Выберите модель..." />
                </SelectTrigger>
                <SelectContent>
                  {saunaModels.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Variant selector */}
            {selectedModel?.variants?.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Вариант</Label>
                <Select
                  value={selectedVariant?.id || ''}
                  onValueChange={handleVariantChange}
                >
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="Вариант..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedModel.variants.map(variant => (
                      <SelectItem key={variant.id} value={variant.id}>
                        {variant.nameRu || variant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Outline upload button */}
            {selectedModel && (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-8 text-xs"
                onClick={() => setUploadOutlineDialogOpen(true)}
              >
                <Upload className="h-3 w-3 mr-1" />
                Загрузить контур
              </Button>
            )}
            
            <div className="border-t pt-3 space-y-2">
              {/* Grid controls */}
              <div className="flex items-center justify-between">
                <Label className="text-xs">Сетка</Label>
                <div className="flex items-center gap-1">
                  <Select
                    value={gridSizeCm.toString()}
                    onValueChange={(val) => setGridSizeCm(parseInt(val))}
                  >
                    <SelectTrigger className="w-16 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 см</SelectItem>
                      <SelectItem value="5">5 см</SelectItem>
                      <SelectItem value="10">10 см</SelectItem>
                      <SelectItem value="20">20 см</SelectItem>
                      <SelectItem value="50">50 см</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant={showGrid ? 'default' : 'outline'}
                    className="h-7 w-7 p-0"
                    onClick={() => setShowGrid(!showGrid)}
                    title={showGrid ? 'Скрыть сетку' : 'Показать сетку'}
                  >
                    <Grid3X3 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              {/* Dimensions toggle */}
              <div className="flex items-center justify-between">
                <Label className="text-xs">Размеры</Label>
                <Button
                  size="sm"
                  variant={showDimensions ? 'default' : 'outline'}
                  className="h-7 text-xs px-2"
                  onClick={() => {
                    setShowDimensions(!showDimensions);
                    setTimeout(() => {
                      if (!showDimensions) {
                        updateDimensionLabels();
                      } else {
                        if (fabricRef.current) {
                          fabricRef.current.getObjects()
                            .filter(o => o.isDimensionLabel)
                            .forEach(o => fabricRef.current.remove(o));
                          fabricRef.current.renderAll();
                        }
                      }
                    }, 0);
                  }}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  {showDimensions ? 'Вкл' : 'Выкл'}
                </Button>
              </div>
              
              {/* Zoom controls */}
              <div className="flex items-center justify-between">
                <Label className="text-xs">Масштаб</Label>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0"
                    onClick={() => handleZoom(-0.25)}
                  >
                    <ZoomOut className="h-3 w-3" />
                  </Button>
                  <span className="text-xs w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0"
                    onClick={() => handleZoom(0.25)}
                  >
                    <ZoomIn className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-1 text-xs"
                    onClick={resetZoom}
                  >
                    100%
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="border-t pt-3 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={clearCanvas}>
                <Trash2 className="h-3 w-3 mr-1" />
                Очистить
              </Button>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={handleExportPNG} title="Экспорт PNG">
                <Download className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => {
                  if (selectedModel) {
                    setLayoutName(currentLayout?.name || `${selectedModel.name}${selectedVariant ? ` - ${selectedVariant.nameRu || selectedVariant.name}` : ''} - Планировка`);
                    setSaveDialogOpen(true);
                  } else {
                    toast.error('Сначала выберите модель сауны');
                  }
                }}
              >
                <Save className="h-3 w-3 mr-1" />
                Сохранить
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Elements Card */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="py-2 px-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Элементы</CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="h-6 w-6 p-0"
                onClick={() => setUploadAssetDialogOpen(true)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 flex-1 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-2 mb-2 h-7">
                <TabsTrigger value="elements" className="text-xs h-6">Библиотека</TabsTrigger>
                <TabsTrigger value="layouts" className="text-xs h-6">Планировки</TabsTrigger>
              </TabsList>
              
              <TabsContent value="elements" className="mt-0">
                {Object.entries(assetsByType).map(([type, typeAssets]) => (
                  <div key={type} className="mb-3">
                    <div className="flex items-center gap-1 mb-1 text-xs font-medium text-muted-foreground">
                      <span>{ELEMENT_TYPES[type]?.icon}</span>
                      <span>{ELEMENT_TYPES[type]?.name || type}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {typeAssets.map(asset => (
                        <div
                          key={asset.id}
                          className="group relative aspect-square bg-muted rounded border cursor-pointer hover:border-primary transition-colors"
                          onClick={() => addElementToCanvas(asset)}
                          title={`Нажмите чтобы добавить: ${asset.name}`}
                        >
                          <img
                            src={asset.imageUrl.startsWith('http') ? asset.imageUrl : `${API_URL}${asset.imageUrl}`}
                            alt={asset.name}
                            className="w-full h-full object-contain p-1"
                          />
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute top-0 right-0 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAsset(asset.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {assets.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <p>Нет загруженных элементов</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setUploadAssetDialogOpen(true)}
                    >
                      Загрузить первый элемент
                    </Button>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="layouts" className="mt-0">
                <div className="space-y-2">
                  {layouts.map(layout => (
                    <div
                      key={layout.id}
                      className="p-2 border rounded hover:bg-muted/50 cursor-pointer group"
                      onClick={() => handleLoadLayout(layout)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{layout.name}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            title="Дублировать"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateLayout(layout);
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            title={layout.isPublished ? 'Скрыть' : 'Опубликовать'}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePublishLayout(layout);
                            }}
                          >
                            {layout.isPublished ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive"
                            title="Удалить"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLayout(layout.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {layout.modelName}
                        {layout.isPublished && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Опубликовано
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {layouts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <p>Нет сохраненных планировок</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      {/* Center - Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Drawing Toolbar - compact */}
        <Card className="mb-2">
          <CardContent className="p-2">
            <div className="flex items-center justify-center gap-4">
              {/* Drawing Tools */}
              <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                {Object.entries(DRAWING_TOOLS).map(([toolId, tool]) => {
                  const Icon = tool.icon;
                  return (
                    <Button
                      key={toolId}
                      size="sm"
                      variant={activeTool === toolId ? 'default' : 'ghost'}
                      className="h-8 w-8 p-0"
                      onClick={() => setActiveTool(toolId)}
                      title={tool.name}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  );
                })}
              </div>
              
              {/* Drawing options (when drawing tool is active) */}
              {activeTool !== 'select' && (
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={drawingColor}
                    onChange={(e) => setDrawingColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border"
                    title="Цвет"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Толщина:</span>
                    <Input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="20"
                      value={drawingStrokeWidthCm}
                      onChange={(e) => setDrawingStrokeWidthCm(parseFloat(e.target.value) || 1)}
                      className="w-16 h-8 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">см</span>
                  </div>
                  {activeTool === 'rectangle' && (
                    <Button
                      size="sm"
                      variant={drawingFill !== 'transparent' ? 'default' : 'outline'}
                      className="h-8 text-xs"
                      onClick={() => setDrawingFill(drawingFill === 'transparent' ? drawingColor + '20' : 'transparent')}
                    >
                      Заливка
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Canvas container */}
        <Card className="flex-1 overflow-auto">
          <CardContent className="p-4 flex items-center justify-center min-h-full">
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg"
              style={{ width: canvasWidth + 4, height: canvasHeight + 4 }}
            >
              <canvas ref={canvasRef} />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Right Panel - Properties */}
      <div className="w-64 flex-shrink-0">
        <Card className="h-full overflow-auto">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Свойства
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {selectedObject ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Тип</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span>{ELEMENT_TYPES[selectedObject.type]?.icon}</span>
                    <span className="text-sm">{ELEMENT_TYPES[selectedObject.type]?.name || selectedObject.type}</span>
                  </div>
                </div>
                
                {/* Dimensions for drawn shapes - in CM with editable inputs */}
                {selectedObject.isDrawnShape && selectedObject.widthCm && selectedObject.heightCm && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-medium">Ширина:</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          value={selectedObject.widthCm}
                          onChange={(e) => {
                            const obj = fabricRef.current?.getActiveObject();
                            if (obj && obj.type === 'rect') {
                              const newWidthCm = parseFloat(e.target.value) || 1;
                              const newWidthPx = newWidthCm * pixelsPerCm;
                              obj.set({ width: newWidthPx, scaleX: 1 });
                              obj.setCoords();
                              fabricRef.current.renderAll();
                              handleObjectSelected({ selected: [obj] });
                              updateDimensionLabels();
                            }
                          }}
                          className="w-20 h-7 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">см</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-medium">Высота:</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          value={selectedObject.heightCm}
                          onChange={(e) => {
                            const obj = fabricRef.current?.getActiveObject();
                            if (obj && obj.type === 'rect') {
                              const newHeightCm = parseFloat(e.target.value) || 1;
                              const newHeightPx = newHeightCm * pixelsPerCm;
                              obj.set({ height: newHeightPx, scaleY: 1 });
                              obj.setCoords();
                              fabricRef.current.renderAll();
                              handleObjectSelected({ selected: [obj] });
                              updateDimensionLabels();
                            }
                          }}
                          className="w-20 h-7 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">см</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedObject.isDrawnShape && selectedObject.lengthCm && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-medium">Длина:</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          value={selectedObject.lengthCm}
                          onChange={(e) => {
                            const obj = fabricRef.current?.getActiveObject();
                            if (obj && obj.type === 'line') {
                              const newLengthCm = parseFloat(e.target.value) || 1;
                              const newLengthPx = newLengthCm * pixelsPerCm;
                              // Keep direction, change length
                              const dx = (obj.x2 || 0) - (obj.x1 || 0);
                              const dy = (obj.y2 || 0) - (obj.y1 || 0);
                              const currentLength = Math.sqrt(dx * dx + dy * dy) || 1;
                              const ratio = newLengthPx / currentLength;
                              obj.set({
                                x2: obj.x1 + dx * ratio,
                                y2: obj.y1 + dy * ratio,
                              });
                              obj.setCoords();
                              fabricRef.current.renderAll();
                              handleObjectSelected({ selected: [obj] });
                              updateDimensionLabels();
                            }
                          }}
                          className="w-20 h-7 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">см</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Shape color controls */}
                {selectedObject.isDrawnShape && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Цвет:</Label>
                      <input
                        type="color"
                        value={selectedObject.stroke || '#374151'}
                        onChange={(e) => {
                          const obj = fabricRef.current?.getActiveObject();
                          if (obj) {
                            obj.set('stroke', e.target.value);
                            fabricRef.current.renderAll();
                            handleObjectSelected({ selected: [obj] });
                          }
                        }}
                        className="w-8 h-6 rounded cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Толщина:</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="50"
                        value={selectedObject.strokeWidthCm || 4}
                        onChange={(e) => {
                          const obj = fabricRef.current?.getActiveObject();
                          if (obj) {
                            const cmValue = parseFloat(e.target.value) || 1;
                            obj.set('strokeWidth', cmValue * pixelsPerCm);
                            obj.set('strokeWidthCm', cmValue);
                            fabricRef.current.renderAll();
                            handleObjectSelected({ selected: [obj] });
                          }
                        }}
                        className="w-16 h-7 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">см</span>
                    </div>
                  </div>
                )}
                
                {/* Distances to room walls */}
                {selectedObject.distances && (
                  <div className="p-2 bg-green-50 border border-green-200 rounded text-xs space-y-1">
                    <Label className="text-xs font-medium">Расстояние до стен:</Label>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <div className="flex justify-between">
                        <span>← Лево:</span>
                        <span className="font-medium">{selectedObject.distances.leftWall} см</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Право →:</span>
                        <span className="font-medium">{selectedObject.distances.rightWall} см</span>
                      </div>
                      <div className="flex justify-between">
                        <span>↑ Верх:</span>
                        <span className="font-medium">{selectedObject.distances.topWall} см</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Низ ↓:</span>
                        <span className="font-medium">{selectedObject.distances.bottomWall} см</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">X (см)</Label>
                    <Input
                      type="number"
                      value={selectedObject.xCm}
                      onChange={(e) => {
                        const obj = fabricRef.current?.getActiveObject();
                        if (obj) {
                          obj.set('left', parseFloat(e.target.value || 0) * pixelsPerCm);
                          fabricRef.current.renderAll();
                          handleObjectSelected({ selected: [obj] });
                        }
                      }}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Y (см)</Label>
                    <Input
                      type="number"
                      value={selectedObject.yCm}
                      onChange={(e) => {
                        const obj = fabricRef.current?.getActiveObject();
                        if (obj) {
                          obj.set('top', parseFloat(e.target.value || 0) * pixelsPerCm);
                          fabricRef.current.renderAll();
                          handleObjectSelected({ selected: [obj] });
                        }
                      }}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs">Поворот: {selectedObject.rotation}°</Label>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => rotateSelected(-90)}>
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => rotateSelected(-15)}>
                      -15°
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => rotateSelected(15)}>
                      +15°
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => rotateSelected(90)}>
                      <RotateCw className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs">Масштаб: {(selectedObject.scale * 100).toFixed(0)}%</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => scaleSelected(-0.1)}>
                      <ZoomOut className="h-3 w-3" />
                    </Button>
                    <Slider
                      value={[selectedObject.scale * 100]}
                      min={10}
                      max={300}
                      step={5}
                      onValueChange={([val]) => {
                        const obj = fabricRef.current?.getActiveObject();
                        if (obj) {
                          obj.scale(val / 100);
                          fabricRef.current.renderAll();
                          handleObjectSelected({ selected: [obj] });
                        }
                      }}
                      className="flex-1"
                    />
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => scaleSelected(0.1)}>
                      <ZoomIn className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="pt-2 border-t space-y-2">
                  {/* Save as outline button (for rectangles) */}
                  {selectedObject?.isDrawnShape && selectedObject?.type === 'rect' && selectedModel && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowSaveOutlineDialog(true)}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Сохранить как контур
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    onClick={deleteSelected}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Удалить
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <Move className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Выберите элемент</p>
              </div>
            )}
            
            {/* Model outline info */}
            {modelOutline && (
              <div className="mt-4 pt-4 border-t">
                <Label className="text-xs font-medium">Размеры сауны</Label>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Внешние:</span>
                    <span>{modelOutline.outerLength} × {modelOutline.outerWidth} см</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Внутренние:</span>
                    <span>{modelOutline.innerLength} × {modelOutline.innerWidth} см</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Стена:</span>
                    <span>{modelOutline.wallThickness} см</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Масштаб:</span>
                    <span>{modelOutline.pixelsPerCm?.toFixed(2)} px/см</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Upload Asset Dialog */}
      <Dialog open={uploadAssetDialogOpen} onOpenChange={setUploadAssetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Загрузить элемент</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Название</Label>
              <Input
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                placeholder="Печь Harvia..."
              />
            </div>
            
            <div>
              <Label>Тип элемента</Label>
              <Select
                value={uploadForm.type}
                onValueChange={(val) => setUploadForm({ ...uploadForm, type: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ELEMENT_TYPES).map(([id, type]) => (
                    <SelectItem key={id} value={id}>
                      {type.icon} {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Для модели (опционально)</Label>
              <Select
                value={uploadForm.modelId || 'global'}
                onValueChange={(val) => setUploadForm({ ...uploadForm, modelId: val === 'global' ? null : val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Для всех моделей" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Для всех моделей</SelectItem>
                  {saunaModels.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Изображение (PNG/SVG)</Label>
              <div className="mt-1">
                <input
                  type="file"
                  accept="image/png,image/svg+xml,image/webp"
                  onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
                  className="text-sm"
                />
              </div>
              {uploadForm.file && (
                <p className="text-xs text-muted-foreground mt-1">
                  Выбран: {uploadForm.file.name}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadAssetDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleUploadAsset} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Загрузить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Save Layout Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сохранить планировку</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Название планировки</Label>
              <Input
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
                placeholder="Вариант 1..."
              />
            </div>
            {selectedModel && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p><strong>Модель:</strong> {selectedModel.name}</p>
                {selectedVariant && <p><strong>Вариант:</strong> {selectedVariant.nameRu || selectedVariant.name}</p>}
                <p><strong>Размер холста:</strong> {canvasWidth} × {canvasHeight}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveLayout} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {currentLayout ? 'Обновить' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Upload Outline Dialog */}
      <Dialog open={uploadOutlineDialogOpen} onOpenChange={setUploadOutlineDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Загрузить контур сауны</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p><strong>Модель:</strong> {selectedModel?.name}</p>
              {selectedVariant && <p><strong>Вариант:</strong> {selectedVariant.nameRu || selectedVariant.name}</p>}
            </div>
            
            <div>
              <Label>Изображение контура (PNG/SVG)</Label>
              <div className="mt-1">
                <input
                  type="file"
                  accept="image/png,image/svg+xml,image/webp"
                  onChange={(e) => setOutlineForm({ ...outlineForm, file: e.target.files?.[0] || null })}
                  className="text-sm"
                />
              </div>
              {outlineForm.file && (
                <p className="text-xs text-muted-foreground mt-1">
                  Выбран: {outlineForm.file.name}
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Внешняя длина (см)</Label>
                <Input
                  type="number"
                  value={outlineForm.outerLength}
                  onChange={(e) => setOutlineForm({ ...outlineForm, outerLength: parseFloat(e.target.value) || 0 })}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Внешняя ширина (см)</Label>
                <Input
                  type="number"
                  value={outlineForm.outerWidth}
                  onChange={(e) => setOutlineForm({ ...outlineForm, outerWidth: parseFloat(e.target.value) || 0 })}
                  className="h-8"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Внутренняя длина (см)</Label>
                <Input
                  type="number"
                  value={outlineForm.innerLength}
                  onChange={(e) => setOutlineForm({ ...outlineForm, innerLength: parseFloat(e.target.value) || 0 })}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Внутренняя ширина (см)</Label>
                <Input
                  type="number"
                  value={outlineForm.innerWidth}
                  onChange={(e) => setOutlineForm({ ...outlineForm, innerWidth: parseFloat(e.target.value) || 0 })}
                  className="h-8"
                />
              </div>
            </div>
            
            <div>
              <Label className="text-xs">Толщина стены (см)</Label>
              <Input
                type="number"
                value={outlineForm.wallThickness}
                onChange={(e) => setOutlineForm({ ...outlineForm, wallThickness: parseFloat(e.target.value) || 0 })}
                className="h-8 w-32"
              />
            </div>
            
            <p className="text-xs text-muted-foreground">
              Размеры используются для расчёта масштаба. Контур будет отображаться на холсте как фон.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOutlineDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleUploadOutline} disabled={loading || !outlineForm.file}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Загрузить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Save Drawn Outline Dialog */}
      <Dialog open={showSaveOutlineDialog} onOpenChange={setShowSaveOutlineDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Сохранить контур для модели</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p><strong>Модель:</strong> {selectedModel?.name}</p>
              {selectedVariant && <p><strong>Вариант:</strong> {selectedVariant.nameRu || selectedVariant.name}</p>}
              {selectedObject?.width && selectedObject?.height && (
                <p><strong>Размер контура:</strong> {selectedObject.width} × {selectedObject.height} px</p>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground">
              Укажите реальные размеры сауны в сантиметрах. Это позволит правильно рассчитывать масштаб элементов.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Внешняя длина (см)</Label>
                <Input
                  type="number"
                  value={saveOutlineForm.outerLength}
                  onChange={(e) => setSaveOutlineForm({ ...saveOutlineForm, outerLength: parseFloat(e.target.value) || 0 })}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Внешняя ширина (см)</Label>
                <Input
                  type="number"
                  value={saveOutlineForm.outerWidth}
                  onChange={(e) => setSaveOutlineForm({ ...saveOutlineForm, outerWidth: parseFloat(e.target.value) || 0 })}
                  className="h-8"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Внутренняя длина (см)</Label>
                <Input
                  type="number"
                  value={saveOutlineForm.innerLength}
                  onChange={(e) => setSaveOutlineForm({ ...saveOutlineForm, innerLength: parseFloat(e.target.value) || 0 })}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Внутренняя ширина (см)</Label>
                <Input
                  type="number"
                  value={saveOutlineForm.innerWidth}
                  onChange={(e) => setSaveOutlineForm({ ...saveOutlineForm, innerWidth: parseFloat(e.target.value) || 0 })}
                  className="h-8"
                />
              </div>
            </div>
            
            <div>
              <Label className="text-xs">Толщина стены (см)</Label>
              <Input
                type="number"
                value={saveOutlineForm.wallThickness}
                onChange={(e) => setSaveOutlineForm({ ...saveOutlineForm, wallThickness: parseFloat(e.target.value) || 0 })}
                className="h-8 w-32"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveOutlineDialog(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveDrawnOutline} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Сохранить контур
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LayoutConfiguratorPage;
