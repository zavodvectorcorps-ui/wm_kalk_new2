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
  
  // UI state
  const [selectedObject, setSelectedObject] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const [canvasWidth, setCanvasWidth] = useState(800);
  const [canvasHeight, setCanvasHeight] = useState(400);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('elements');
  
  // Drawing tools state
  const [activeTool, setActiveTool] = useState('select');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingObject, setDrawingObject] = useState(null);
  const [drawStartPoint, setDrawStartPoint] = useState(null);
  const [drawingColor, setDrawingColor] = useState('#374151');
  const [drawingStrokeWidth, setDrawingStrokeWidth] = useState(3);
  const [drawingFill, setDrawingFill] = useState('transparent');
  
  // Refs for drawing (to access current state in event handlers)
  const activeToolRef = useRef('select');
  const isDrawingRef = useRef(false);
  const drawingObjectRef = useRef(null);
  const drawStartPointRef = useRef(null);
  const drawingColorRef = useRef('#374151');
  const drawingStrokeWidthRef = useRef(3);
  const drawingFillRef = useRef('transparent');
  
  // Keep refs in sync with state
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { drawingColorRef.current = drawingColor; }, [drawingColor]);
  useEffect(() => { drawingStrokeWidthRef.current = drawingStrokeWidth; }, [drawingStrokeWidth]);
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
      
      // Drawing event listeners
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

  // Update canvas size when model changes
  useEffect(() => {
    if (fabricRef.current) {
      fabricRef.current.setWidth(canvasWidth);
      fabricRef.current.setHeight(canvasHeight);
      drawGrid();
    }
  }, [canvasWidth, canvasHeight]);

  // Draw grid
  const drawGrid = useCallback(() => {
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    
    // Remove existing grid lines
    const objects = canvas.getObjects();
    objects.forEach(obj => {
      if (obj.isGridLine) {
        canvas.remove(obj);
      }
    });
    
    if (!showGrid) {
      canvas.renderAll();
      return;
    }
    
    // Draw vertical lines
    for (let i = 0; i <= canvasWidth; i += gridSize) {
      const line = new fabric.Line([i, 0, i, canvasHeight], {
        stroke: '#e2e8f0',
        strokeWidth: i % (gridSize * 5) === 0 ? 1 : 0.5,
        selectable: false,
        evented: false,
        isGridLine: true,
      });
      canvas.add(line);
      canvas.sendToBack(line);
    }
    
    // Draw horizontal lines
    for (let i = 0; i <= canvasHeight; i += gridSize) {
      const line = new fabric.Line([0, i, canvasWidth, i], {
        stroke: '#e2e8f0',
        strokeWidth: i % (gridSize * 5) === 0 ? 1 : 0.5,
        selectable: false,
        evented: false,
        isGridLine: true,
      });
      canvas.add(line);
      canvas.sendToBack(line);
    }
    
    canvas.renderAll();
  }, [showGrid, gridSize, canvasWidth, canvasHeight]);

  useEffect(() => {
    drawGrid();
  }, [showGrid, gridSize, drawGrid]);

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

  // Convert pixels to centimeters
  const pxToCm = (px) => {
    if (!modelOutline?.pixelsPerCm) return null;
    return (px / modelOutline.pixelsPerCm).toFixed(1);
  };

  // Convert centimeters to pixels
  const cmToPx = (cm) => {
    if (!modelOutline?.pixelsPerCm) return null;
    return cm * modelOutline.pixelsPerCm;
  };

  // Snap to grid
  const snapToGrid = useCallback((value) => {
    return Math.round(value / gridSize) * gridSize;
  }, [gridSize]);

  // ============ DRAWING TOOLS ============
  
  // Mouse down - start drawing
  const handleCanvasMouseDown = useCallback((opt) => {
    const currentTool = activeToolRef.current;
    if (currentTool === 'select') return;
    
    // Don't start drawing if clicking on an existing object
    if (opt.target && !opt.target.isGridLine) return;
    
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    const pointer = canvas.getPointer(opt.e);
    const snap = (v) => Math.round(v / gridSize) * gridSize;
    const x = snap(pointer.x);
    const y = snap(pointer.y);
    
    isDrawingRef.current = true;
    drawStartPointRef.current = { x, y };
    setIsDrawing(true);
    setDrawStartPoint({ x, y });
    
    let obj;
    
    if (currentTool === 'rectangle') {
      obj = new fabric.Rect({
        left: x,
        top: y,
        width: 1,
        height: 1,
        fill: drawingFillRef.current,
        stroke: drawingColorRef.current,
        strokeWidth: drawingStrokeWidthRef.current,
        strokeUniform: true,
        elementId: `rect-${Date.now()}`,
        elementType: 'rect',
        isDrawnShape: true,
      });
    } else if (currentTool === 'wall') {
      obj = new fabric.Line([x, y, x + 1, y], {
        stroke: drawingColorRef.current,
        strokeWidth: drawingStrokeWidthRef.current,
        strokeLineCap: 'round',
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
  }, [gridSize]);
  
  // Mouse move - update drawing
  const handleCanvasMouseMove = useCallback((opt) => {
    if (!isDrawingRef.current || !drawingObjectRef.current || !drawStartPointRef.current) return;
    
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    const pointer = canvas.getPointer(opt.e);
    const snap = (v) => Math.round(v / gridSize) * gridSize;
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
  }, [gridSize]);
  
  // Mouse up - finish drawing
  const handleCanvasMouseUp = useCallback((opt) => {
    if (!isDrawingRef.current) return;
    
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    isDrawingRef.current = false;
    setIsDrawing(false);
    
    const obj = drawingObjectRef.current;
    const currentTool = activeToolRef.current;
    
    if (obj) {
      // Check if shape is too small (accidental click)
      let isTooSmall = false;
      
      if (currentTool === 'rectangle') {
        isTooSmall = (obj.width || 0) < gridSize || (obj.height || 0) < gridSize;
      } else if (currentTool === 'wall') {
        const dx = (obj.x2 || 0) - (obj.x1 || 0);
        const dy = (obj.y2 || 0) - (obj.y1 || 0);
        const length = Math.sqrt(dx * dx + dy * dy);
        isTooSmall = length < gridSize;
      }
      
      if (isTooSmall) {
        canvas.remove(obj);
        toast.info('Слишком маленький объект');
      } else {
        // Enable controls for resizing
        obj.setCoords();
        canvas.setActiveObject(obj);
        canvas.renderAll();
        
        // Show dimensions
        if (currentTool === 'rectangle') {
          toast.success(`Прямоугольник: ${obj.width} × ${obj.height} px`);
        } else if (currentTool === 'wall') {
          const dx = (obj.x2 || 0) - (obj.x1 || 0);
          const dy = (obj.y2 || 0) - (obj.y1 || 0);
          const lengthPx = Math.sqrt(dx * dx + dy * dy);
          toast.success(`Стена: ${Math.round(lengthPx)} px`);
        }
      }
    }
    
    drawingObjectRef.current = null;
    drawStartPointRef.current = null;
    setDrawingObject(null);
    setDrawStartPoint(null);
  }, [gridSize]);

  // Handle object scaling (for showing dimensions while resizing)
  const handleObjectScaling = (e) => {
    const obj = e.target;
    if (!obj || !obj.isDrawnShape) return;
    
    // Snap scale to grid
    if (obj.type === 'rect') {
      const newWidth = snapToGrid(obj.width * obj.scaleX);
      const newHeight = snapToGrid(obj.height * obj.scaleY);
      obj.set({
        width: newWidth,
        height: newHeight,
        scaleX: 1,
        scaleY: 1,
      });
    }
  };

  // Event handlers
  const handleObjectSelected = (e) => {
    const obj = e.selected?.[0];
    if (obj && !obj.isGridLine && !obj.isBackground) {
      const canvas = fabricRef.current;
      
      // Get dimensions for drawn shapes
      let width = null, height = null, length = null;
      if (obj.isDrawnShape) {
        if (obj.type === 'rect') {
          width = Math.round(obj.width * (obj.scaleX || 1));
          height = Math.round(obj.height * (obj.scaleY || 1));
        } else if (obj.type === 'line') {
          const dx = obj.x2 - obj.x1;
          const dy = obj.y2 - obj.y1;
          length = Math.round(Math.sqrt(dx * dx + dy * dy));
        }
      }
      
      setSelectedObject({
        id: obj.elementId,
        type: obj.elementType,
        x: Math.round(obj.left),
        y: Math.round(obj.top),
        rotation: Math.round(obj.angle || 0),
        scale: obj.scaleX || 1,
        zIndex: canvas ? canvas.getObjects().indexOf(obj) : 0,
        isDrawnShape: obj.isDrawnShape || false,
        width,
        height,
        length,
        stroke: obj.stroke,
        fill: obj.fill,
        strokeWidth: obj.strokeWidth,
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
    }
  };

  const handleObjectMoving = (e) => {
    const obj = e.target;
    obj.set({
      left: snapToGrid(obj.left),
      top: snapToGrid(obj.top),
    });
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
      {/* Left Panel - Elements */}
      <div className="w-64 flex-shrink-0 flex flex-col">
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="py-3 px-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Элементы</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setUploadAssetDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 flex-1 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-2 mb-2">
                <TabsTrigger value="elements" className="text-xs">Библиотека</TabsTrigger>
                <TabsTrigger value="layouts" className="text-xs">Планировки</TabsTrigger>
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
        {/* Toolbar */}
        <Card className="mb-2">
          <CardContent className="p-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Model selector */}
              <Select
                value={selectedModel?.id || ''}
                onValueChange={handleModelChange}
              >
                <SelectTrigger className="w-[200px]">
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
              
              {/* Variant selector */}
              {selectedModel?.variants?.length > 0 && (
                <Select
                  value={selectedVariant?.id || ''}
                  onValueChange={handleVariantChange}
                >
                  <SelectTrigger className="w-[180px]">
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
              )}
              
              {/* Outline upload button */}
              {selectedModel && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUploadOutlineDialogOpen(true)}
                  title="Загрузить контур сауны"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Контур
                </Button>
              )}
              
              <div className="h-6 w-px bg-border" />
              
              {/* Canvas size */}
              <div className="flex items-center gap-1 text-xs">
                <Input
                  type="number"
                  value={canvasWidth}
                  onChange={(e) => setCanvasWidth(parseInt(e.target.value) || 800)}
                  className="w-16 h-7 text-xs"
                />
                <span className="text-muted-foreground">×</span>
                <Input
                  type="number"
                  value={canvasHeight}
                  onChange={(e) => setCanvasHeight(parseInt(e.target.value) || 400)}
                  className="w-16 h-7 text-xs"
                />
                <span className="text-muted-foreground text-xs">px</span>
              </div>
              
              {/* Show dimensions info */}
              {modelOutline && (
                <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  {modelOutline.outerLength}×{modelOutline.outerWidth} см
                </div>
              )}
              
              <div className="h-6 w-px bg-border" />
              
              {/* Grid toggle */}
              <Button
                size="sm"
                variant={showGrid ? 'default' : 'outline'}
                onClick={() => setShowGrid(!showGrid)}
              >
                <Grid3X3 className="h-4 w-4 mr-1" />
                Сетка
              </Button>
              
              {/* Dimensions toggle */}
              <Button
                size="sm"
                variant={showDimensions ? 'default' : 'outline'}
                onClick={() => setShowDimensions(!showDimensions)}
                title="Показать размеры"
              >
                📏 Размеры
              </Button>
              
              <div className="h-6 w-px bg-border" />
              
              {/* Drawing Tools */}
              <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                {Object.entries(DRAWING_TOOLS).map(([toolId, tool]) => {
                  const Icon = tool.icon;
                  return (
                    <Button
                      key={toolId}
                      size="sm"
                      variant={activeTool === toolId ? 'default' : 'ghost'}
                      className="h-7 w-7 p-0"
                      onClick={() => setActiveTool(toolId)}
                      title={tool.name}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  );
                })}
              </div>
              
              {/* Drawing color picker (when drawing tool is active) */}
              {activeTool !== 'select' && (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={drawingColor}
                    onChange={(e) => setDrawingColor(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer"
                    title="Цвет"
                  />
                  <Select
                    value={drawingStrokeWidth.toString()}
                    onValueChange={(val) => setDrawingStrokeWidth(parseInt(val))}
                  >
                    <SelectTrigger className="w-16 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1px</SelectItem>
                      <SelectItem value="2">2px</SelectItem>
                      <SelectItem value="3">3px</SelectItem>
                      <SelectItem value="5">5px</SelectItem>
                      <SelectItem value="8">8px</SelectItem>
                      <SelectItem value="10">10px</SelectItem>
                    </SelectContent>
                  </Select>
                  {activeTool === 'rectangle' && (
                    <Button
                      size="sm"
                      variant={drawingFill !== 'transparent' ? 'default' : 'outline'}
                      className="h-7 text-xs"
                      onClick={() => setDrawingFill(drawingFill === 'transparent' ? drawingColor + '20' : 'transparent')}
                      title="Заливка"
                    >
                      Заливка
                    </Button>
                  )}
                </div>
              )}
              
              <div className="h-6 w-px bg-border" />
              
              {/* Actions */}
              <Button size="sm" variant="outline" onClick={clearCanvas}>
                <Trash2 className="h-4 w-4 mr-1" />
                Очистить
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (selectedModel) {
                    setLayoutName(currentLayout?.name || `${selectedModel.name}${selectedVariant ? ` - ${selectedVariant.nameRu || selectedVariant.name}` : ''} - Планировка`);
                    setSaveDialogOpen(true);
                  } else {
                    toast.error('Сначала выберите модель сауны');
                  }
                }}
              >
                <Save className="h-4 w-4 mr-1" />
                Сохранить
              </Button>
              
              <Button size="sm" variant="outline" onClick={handleExportPNG}>
                <Download className="h-4 w-4 mr-1" />
                PNG
              </Button>
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
                
                {/* Dimensions for drawn shapes */}
                {selectedObject.isDrawnShape && selectedObject.width && selectedObject.height && (
                  <div className="p-2 bg-muted rounded text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Ширина:</span>
                      <span className="font-medium">{selectedObject.width} px {pxToCm(selectedObject.width) && `(${pxToCm(selectedObject.width)} см)`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Высота:</span>
                      <span className="font-medium">{selectedObject.height} px {pxToCm(selectedObject.height) && `(${pxToCm(selectedObject.height)} см)`}</span>
                    </div>
                  </div>
                )}
                
                {selectedObject.isDrawnShape && selectedObject.length && (
                  <div className="p-2 bg-muted rounded text-xs">
                    <div className="flex justify-between">
                      <span>Длина:</span>
                      <span className="font-medium">{selectedObject.length} px {pxToCm(selectedObject.length) && `(${pxToCm(selectedObject.length)} см)`}</span>
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
                        min="1"
                        max="20"
                        value={selectedObject.strokeWidth || 3}
                        onChange={(e) => {
                          const obj = fabricRef.current?.getActiveObject();
                          if (obj) {
                            obj.set('strokeWidth', parseInt(e.target.value) || 3);
                            fabricRef.current.renderAll();
                            handleObjectSelected({ selected: [obj] });
                          }
                        }}
                        className="w-16 h-7 text-xs"
                      />
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">X (px)</Label>
                    <Input
                      type="number"
                      value={selectedObject.x}
                      onChange={(e) => {
                        const obj = fabricRef.current?.getActiveObject();
                        if (obj) {
                          obj.set('left', parseInt(e.target.value) || 0);
                          fabricRef.current.renderAll();
                          handleObjectSelected({ selected: [obj] });
                        }
                      }}
                      className="h-7 text-xs"
                    />
                    {showDimensions && pxToCm(selectedObject.x) && (
                      <span className="text-xs text-muted-foreground">{pxToCm(selectedObject.x)} см</span>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Y (px)</Label>
                    <Input
                      type="number"
                      value={selectedObject.y}
                      onChange={(e) => {
                        const obj = fabricRef.current?.getActiveObject();
                        if (obj) {
                          obj.set('top', parseInt(e.target.value) || 0);
                          fabricRef.current.renderAll();
                          handleObjectSelected({ selected: [obj] });
                        }
                      }}
                      className="h-7 text-xs"
                    />
                    {showDimensions && pxToCm(selectedObject.y) && (
                      <span className="text-xs text-muted-foreground">{pxToCm(selectedObject.y)} см</span>
                    )}
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
