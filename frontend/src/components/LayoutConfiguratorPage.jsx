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
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import {
  Plus, Trash2, Save, Download, Upload, RotateCw, RotateCcw,
  ZoomIn, ZoomOut, Grid3X3, Eye, EyeOff, Layers, Settings2,
  FolderOpen, Copy, Move, Loader2, RefreshCw, GripVertical,
  Square, Minus, MousePointer, Pencil, Ruler, Undo2, Type,
  Magnet, CopyPlus, FileInput, LayoutGrid, SplitSquareVertical, X, Calculator
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// A4 Landscape dimensions
// A4 = 297mm x 210mm (landscape)
// Using scale: 2 pixels per mm = 20 pixels per cm
const A4_LANDSCAPE = {
  widthPx: 1200,   // Increased for larger saunas
  heightPx: 800,   // Increased for larger saunas
  widthCm: 29.7,
  heightCm: 21.0,
};

// Default scale: how many real cm fit in the canvas
// Increased to support saunas up to 8m (800cm)
const DEFAULT_CANVAS_REAL_SIZE = {
  widthCm: 900,  // Real width the canvas represents (9m)
  heightCm: 600, // Real height the canvas represents (6m)
};

// Drawing tools
const DRAWING_TOOLS = {
  select: { icon: MousePointer, name: 'Выбор', cursor: 'default', shortcut: 'V' },
  rectangle: { icon: Square, name: 'Прямоугольник', cursor: 'crosshair', shortcut: 'R' },
  wall: { icon: Minus, name: 'Стена/Линия', cursor: 'crosshair', shortcut: 'L' },
  ruler: { icon: Ruler, name: 'Линейка', cursor: 'crosshair', shortcut: 'M' },
  text: { icon: Type, name: 'Текст', cursor: 'text', shortcut: 'T' },
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

const LayoutConfiguratorPage = ({ 
  isAdminMode = true,  // Controls admin features like "show hidden variants"
  initialModelId = null,  // Pre-select model from calculator
  initialVariantId = null,  // Pre-select variant from calculator
  onClose = null,  // Close callback for modal mode
  isModal = false,  // If true, shows close button and compact layout
  calculatorSelections = null,  // Selected options from calculator: {categoryId: optionId}
  orderId = null,  // Order ID to save layout config to
  onLayoutSaved = null,  // Callback when layout is saved to order
}) => {
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
  
  // Calculator categories for variant mapping (admin feature)
  const [calculatorCategories, setCalculatorCategories] = useState([]);
  
  // Canvas state - A4 landscape fixed size
  const [canvasWidth, setCanvasWidth] = useState(A4_LANDSCAPE.widthPx);
  const [canvasHeight, setCanvasHeight] = useState(A4_LANDSCAPE.heightPx);
  
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
  const [layoutLoadedForCalculator, setLayoutLoadedForCalculator] = useState(false); // Track if layout loaded for calculator integration
  
  // Undo history
  const [canvasHistory, setCanvasHistory] = useState([]);
  const isUndoing = useRef(false);
  const MAX_HISTORY = 30;
  
  // Drawing tools state
  const [activeTool, setActiveTool] = useState('select');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingObject, setDrawingObject] = useState(null);
  const [drawStartPoint, setDrawStartPoint] = useState(null);
  const [drawingColor, setDrawingColor] = useState('#374151');
  const [drawingStrokeWidthCm, setDrawingStrokeWidthCm] = useState(4); // Stroke width in CM
  const [drawingFill, setDrawingFill] = useState('transparent');
  
  // Snap settings
  const [snapToObjects, setSnapToObjects] = useState(true);
  const [snapDistance, setSnapDistance] = useState(10); // pixels
  
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
  
  // Add room dialog state
  const [addRoomDialogOpen, setAddRoomDialogOpen] = useState(false);
  const [roomForm, setRoomForm] = useState({
    outerWidthCm: 200,
    outerHeightCm: 150,
    wallLeftCm: 4.4,
    wallRightCm: 4.4,
    wallTopCm: 4.4,
    wallBottomCm: 4.4,
    isPartition: false,
    partitionPosition: 'vertical',
    partitionOffset: 50,
  });
  
  // Layout options & variants state
  const [layoutOptions, setLayoutOptions] = useState([]);
  const [selectedVariants, setSelectedVariants] = useState({}); // { optionId: variantId }
  const [showHiddenVariants, setShowHiddenVariants] = useState(false);
  const [createOptionDialogOpen, setCreateOptionDialogOpen] = useState(false);
  const [editOptionDialogOpen, setEditOptionDialogOpen] = useState(false);
  const [editOptionForm, setEditOptionForm] = useState({ id: '', name: '', namePl: '', nameRu: '' });
  const [editVariantDialogOpen, setEditVariantDialogOpen] = useState(false);
  const [editVariantForm, setEditVariantForm] = useState({ 
    optionId: '', 
    variantId: '', 
    name: '', 
    namePl: '', 
    nameRu: '',
    elementConfigs: [],
    conditions: [],
    newOptionId: '',
    calculatorMapping: null,  // {categoryId, optionId} for auto-apply from calculator
  });
  const [saveVariantDialogOpen, setSaveVariantDialogOpen] = useState(false);
  const [copyOptionDialogOpen, setCopyOptionDialogOpen] = useState(false);
  const [copyOptionForm, setCopyOptionForm] = useState({
    sourceOptionId: '',
    targetModelId: '',
    targetVariantId: '',
  });
  // Clone layout dialog state
  const [cloneLayoutDialogOpen, setCloneLayoutDialogOpen] = useState(false);
  const [cloneLayoutForm, setCloneLayoutForm] = useState({
    sourceLayoutId: '',
    sourceLayoutName: '',
    targetModelId: '',
    targetVariantId: '',
    newName: '',
    autoScale: true,  // Auto-calculate scale based on model sizes
    scaleX: 1.0,
    scaleY: 1.0,
  });
  const [newOptionForm, setNewOptionForm] = useState({ name: '', namePl: '', nameRu: '' });
  const [newVariantForm, setNewVariantForm] = useState({ 
    optionId: '', 
    name: '', 
    namePl: '', 
    nameRu: '',
    conditions: [], // Array of { optionId, variantId }
    elements: [], // Array of element configs to save (multiple elements)
  });
  
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
    widthCm: '',
    heightCm: '',
    fixedHeight: false,
  });
  
  // Text tool state
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textFontSize, setTextFontSize] = useState(14);
  const [textClickPosition, setTextClickPosition] = useState({ x: 0, y: 0 });
  
  // Clipboard for copy/paste
  const clipboardRef = useRef(null);
  
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
      canvas.on('mouse:down', handleCanvasMouseDown);
      canvas.on('mouse:move', handleCanvasMouseMove);
      canvas.on('mouse:up', handleCanvasMouseUp);
      
      // Draw initial grid
      drawGrid();
      
      // Subscribe to history-saving events
      const saveState = () => {
        if (!isUndoing.current) {
          saveToHistory();
        }
      };
      
      canvas.on('object:added', saveState);
      canvas.on('object:removed', saveState);
      canvas.on('object:modified', saveState);
      
      // Save initial empty state to history
      setTimeout(() => saveToHistory(), 100);
      
      return () => {
        canvas.off('object:added', saveState);
        canvas.off('object:removed', saveState);
        canvas.off('object:modified', saveState);
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
    fetchLayoutOptions();
    // Fetch calculator categories for admin mapping feature
    if (isAdminMode) {
      fetchCalculatorCategories();
    }
  }, []);

  // Fetch calculator categories (for admin variant mapping)
  const fetchCalculatorCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/layout-configurator/calculator-categories`);
      if (response.ok) {
        const data = await response.json();
        setCalculatorCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching calculator categories:', error);
    }
  };

  // Apply initial model/variant from props (for integration with calculator)
  useEffect(() => {
    if (saunaModels.length > 0 && initialModelId) {
      const model = saunaModels.find(m => m.id === initialModelId);
      if (model) {
        setSelectedModel(model);
        fetchLayouts(initialModelId, null);
        // IMPORTANT: Also fetch layout options for this specific model
        fetchLayoutOptions(initialModelId, null);
        
        // If initial variant is specified, select it too
        if (initialVariantId && model.variants?.length > 0) {
          const variant = model.variants.find(v => v.id === initialVariantId);
          if (variant) {
            setSelectedVariant(variant);
            fetchLayouts(initialModelId, initialVariantId);
            // IMPORTANT: Fetch layout options for this specific model + submodel
            fetchLayoutOptions(initialModelId, initialVariantId);
          }
        }
      }
    }
  }, [saunaModels, initialModelId, initialVariantId]);

  // Auto-apply variants based on calculator selections AFTER layout is loaded
  // Variants will be applied even without saved room position (coordinates may need manual adjustment)
  useEffect(() => {
    console.log('Auto-apply variants check:', {
      hasCalculatorSelections: !!calculatorSelections,
      calculatorSelections,
      layoutOptionsCount: layoutOptions.length,
      layoutLoadedForCalculator,
      selectedModelId: selectedModel?.id,
      selectedVariantId: selectedVariant?.id,
    });
    
    if (!calculatorSelections || !layoutOptions.length) {
      console.log('Skipping auto-apply: no calculator selections or no layout options');
      return;
    }
    if (!layoutLoadedForCalculator) {
      console.log('Skipping auto-apply: layout not loaded for calculator yet');
      return;
    }
    if (!selectedModel) {
      console.log('Skipping auto-apply: no model selected');
      return;
    }
    
    const canvas = fabricRef.current;
    if (!canvas) {
      console.log('Skipping auto-apply: no canvas');
      return;
    }
    
    // Small delay to ensure canvas is fully rendered
    const timeoutId = setTimeout(() => {
      const roomObj = canvas.getObjects().find(obj => obj.isRoom);
      if (!roomObj) {
        console.log('No room found on canvas, skipping auto-apply');
        return;
      }
      
      // Find variants that match calculator selections AND have room position saved
      // AND belong to the current model AND submodel
      const variantsToApply = [];
      let roomOffset = { x: 0, y: 0 };
      
      // Helper: Check if option belongs to current model/submodel context
      const isOptionForCurrentContext = (option) => {
        // If option has modelId, it must match current model
        if (option.modelId && option.modelId !== selectedModel.id) {
          return false;
        }
        // If option has variantId (submodel), it must match current submodel
        // or we should have the same submodel selected
        if (option.variantId && selectedVariant && option.variantId !== selectedVariant.id) {
          return false;
        }
        // If option has variantId but no submodel is selected, skip it
        if (option.variantId && !selectedVariant) {
          return false;
        }
        return true;
      };
      
      layoutOptions.forEach(option => {
        // Skip options that don't belong to current model/submodel context
        if (!isOptionForCurrentContext(option)) {
          console.log(`Skipping option "${option.namePl}" - belongs to different model/submodel (modelId: ${option.modelId}, variantId: ${option.variantId})`);
          return;
        }
        
        option.variants?.forEach(variant => {
          if (variant.calculatorMapping) {
            const { categoryId, optionId } = variant.calculatorMapping;
            if (calculatorSelections[categoryId] === optionId) {
              // Skip if we already have this variant (by ID)
              if (variantsToApply.some(v => v.variant.id === variant.id)) {
                console.log(`Skipping duplicate variant "${variant.namePl}" (already added)`);
                return;
              }
              
              // Check if variant has room position saved for better coordinate offset
              const variantRoomConfig = variant.elementConfigs?.find(c => c.isRoom);
              if (variantRoomConfig && variantRoomConfig.properties) {
                // Calculate room offset (use first variant's room position)
                if (roomOffset.x === 0 && roomOffset.y === 0) {
                  roomOffset = {
                    x: roomObj.left - (variantRoomConfig.properties.left || 0),
                    y: roomObj.top - (variantRoomConfig.properties.top || 0),
                  };
                  console.log('Room offset calculated:', roomOffset);
                }
              }
              // Always add variant to apply list (even without room position)
              variantsToApply.push({ option, variant });
              console.log(`Will apply variant "${variant.namePl}" from option "${option.namePl}" (has room position: ${!!variantRoomConfig?.properties})`);
            }
          }
        });
      });
      
      // IMPORTANT: Merge element changes from all variants to avoid conflicts
      // If multiple variants change the same element, we need to decide which one wins
      // Strategy: Later variants in the list override earlier ones (by element ID)
      const elementChanges = new Map(); // elementId -> {optionName, variantName, config}
      
      variantsToApply.forEach(({ option, variant }) => {
        variant.elementConfigs?.forEach(config => {
          if (config.isRoom) return; // Skip room
          
          // Create a unique key for this element
          const elementKey = config.elementId || config.instanceName || config.assetId || config.assetName || config.elementType;
          
          if (elementKey) {
            // Store the change, later variants override earlier ones
            elementChanges.set(elementKey, {
              optionName: option.namePl || option.name,
              variantName: variant.namePl || variant.name,
              config
            });
          }
        });
      });
      
      console.log(`Total unique element changes after merging: ${elementChanges.size}`);
      
      if (variantsToApply.length > 0) {
        console.log('Auto-applying variants for model', selectedModel.id, selectedVariant?.id || 'no-submodel', ':', variantsToApply.length);
        
        // Apply all variants but with merged element changes
        // This ensures each element is only moved once (to its final position)
        variantsToApply.forEach(({ option, variant }) => {
          applyVariant(option.id, variant, roomOffset);
        });
        toast.success(`Применено ${variantsToApply.length} вариантов из калькулятора`);
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [calculatorSelections, layoutOptions, layoutLoadedForCalculator, selectedModel, selectedVariant]);

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

  const fetchLayouts = async (modelId = null, variantId = null) => {
    try {
      let url = `${API_URL}/api/layout-configurator/layouts`;
      const params = new URLSearchParams();
      if (modelId) params.append('modelId', modelId);
      if (variantId) params.append('variantId', variantId);
      if (params.toString()) url += `?${params.toString()}`;
      
      const res = await fetch(url);
      const data = await res.json();
      setLayouts(data.layouts || []);
    } catch (error) {
      console.error('Error fetching layouts:', error);
    }
  };

  // Fetch layout options and variants
  const fetchLayoutOptions = async (modelId = null, variantId = null) => {
    try {
      let url = `${API_URL}/api/layout-configurator/options`;
      const params = new URLSearchParams();
      if (modelId) params.append('modelId', modelId);
      if (variantId) params.append('variantId', variantId);
      if (params.toString()) url += `?${params.toString()}`;
      
      const res = await fetch(url);
      const data = await res.json();
      setLayoutOptions(data.options || []);
    } catch (error) {
      console.error('Error fetching layout options:', error);
    }
  };

  // Create new option
  const createLayoutOption = async () => {
    if (!newOptionForm.name) {
      toast.error('Введите название опции');
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append('name', newOptionForm.name);
      formData.append('namePl', newOptionForm.namePl || newOptionForm.name);
      formData.append('nameRu', newOptionForm.nameRu || newOptionForm.name);
      // Add current model/variant context
      if (selectedModel) {
        formData.append('modelId', selectedModel.id);
      }
      if (selectedVariant) {
        formData.append('variantId', selectedVariant.id);
      }
      
      const res = await fetch(`${API_URL}/api/layout-configurator/options`, {
        method: 'POST',
        body: formData,
      });
      
      if (res.ok) {
        toast.success('Опция создана');
        setCreateOptionDialogOpen(false);
        setNewOptionForm({ name: '', namePl: '', nameRu: '' });
        // Reload options for current context
        fetchLayoutOptions(selectedModel?.id, selectedVariant?.id);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Ошибка создания опции');
      }
    } catch (error) {
      toast.error('Ошибка сети');
    }
  };

  // Update existing option
  const updateLayoutOption = async () => {
    if (!editOptionForm.id || !editOptionForm.namePl) {
      toast.error('Wprowadź nazwę opcji');
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append('name', editOptionForm.name || editOptionForm.namePl);
      formData.append('namePl', editOptionForm.namePl);
      formData.append('nameRu', editOptionForm.nameRu || editOptionForm.namePl);
      
      const res = await fetch(`${API_URL}/api/layout-configurator/options/${editOptionForm.id}`, {
        method: 'PUT',
        body: formData,
      });
      
      if (res.ok) {
        toast.success('Opcja zaktualizowana');
        setEditOptionDialogOpen(false);
        setEditOptionForm({ id: '', name: '', namePl: '', nameRu: '' });
        fetchLayoutOptions(selectedModel?.id, selectedVariant?.id);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Błąd aktualizacji opcji');
      }
    } catch (error) {
      toast.error('Błąd sieci');
    }
  };

  // Update existing variant
  const updateVariant = async () => {
    if (!editVariantForm.optionId || !editVariantForm.variantId) {
      toast.error('Brak danych wariantu');
      return;
    }
    
    try {
      // Check if we need to move variant to different option
      const targetOptionId = editVariantForm.newOptionId || editVariantForm.optionId;
      const needsMove = editVariantForm.newOptionId && editVariantForm.newOptionId !== editVariantForm.optionId;
      
      if (needsMove) {
        // Move variant: create in new option, delete from old
        const variantData = new FormData();
        variantData.append('name', editVariantForm.name || editVariantForm.namePl);
        variantData.append('namePl', editVariantForm.namePl);
        variantData.append('nameRu', editVariantForm.nameRu || editVariantForm.namePl);
        variantData.append('elementConfigs', JSON.stringify(editVariantForm.elementConfigs));
        variantData.append('conditions', JSON.stringify(editVariantForm.conditions || []));
        
        // Create in new option
        const createRes = await fetch(`${API_URL}/api/layout-configurator/options/${targetOptionId}/variants`, {
          method: 'POST',
          body: variantData,
        });
        
        if (!createRes.ok) {
          const err = await createRes.json();
          toast.error(err.detail || 'Błąd przenoszenia wariantu');
          return;
        }
        
        // Delete from old option
        await fetch(`${API_URL}/api/layout-configurator/options/${editVariantForm.optionId}/variants/${editVariantForm.variantId}`, {
          method: 'DELETE',
        });
        
        toast.success('Wariant przeniesiony do innej opcji');
      } else {
        // Just update in place
        const formData = new FormData();
        if (editVariantForm.namePl) {
          formData.append('name', editVariantForm.name || editVariantForm.namePl);
          formData.append('namePl', editVariantForm.namePl);
          formData.append('nameRu', editVariantForm.nameRu || editVariantForm.namePl);
        }
        formData.append('elementConfigs', JSON.stringify(editVariantForm.elementConfigs));
        formData.append('conditions', JSON.stringify(editVariantForm.conditions || []));
        // Add calculator mapping
        formData.append('calculatorMapping', JSON.stringify(editVariantForm.calculatorMapping || null));
        
        const res = await fetch(`${API_URL}/api/layout-configurator/options/${editVariantForm.optionId}/variants/${editVariantForm.variantId}`, {
          method: 'PUT',
          body: formData,
        });
        
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.detail || 'Błąd aktualizacji wariantu');
          return;
        }
        
        toast.success('Wariant zaktualizowany');
      }
      
      setEditVariantDialogOpen(false);
      setEditVariantForm({ optionId: '', variantId: '', name: '', namePl: '', nameRu: '', elementConfigs: [], conditions: [], newOptionId: '', calculatorMapping: null });
      fetchLayoutOptions(selectedModel?.id, selectedVariant?.id);
    } catch (error) {
      toast.error('Błąd sieci');
    }
  };

  // Update variant element config from current canvas selection
  const updateVariantElementFromCanvas = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    const selectedObj = canvas.getActiveObject();
    if (!selectedObj) {
      toast.error('Wybierz element na canvasie');
      return;
    }
    
    // Create element configuration from selected object
    const elementConfig = {
      elementType: selectedObj.elementType || selectedObj.type,
      matchBy: 'elementId', // Always use elementId for precise matching
      assetId: selectedObj.assetId || null,
      assetName: selectedObj.assetName || null,
      elementId: selectedObj.elementId || null,
      instanceName: selectedObj.instanceName || null,
      properties: {
        left: Math.round(selectedObj.left),
        top: Math.round(selectedObj.top),
        angle: selectedObj.angle || 0,
        scaleX: selectedObj.scaleX || 1,
        scaleY: selectedObj.scaleY || 1,
        flipX: selectedObj.flipX || false,
        flipY: selectedObj.flipY || false,
        isHidden: selectedObj.isHidden || false,
      }
    };
    
    // Update or add element in form (match by unique elementId)
    const existingIndex = editVariantForm.elementConfigs.findIndex(el => 
      el.elementId && el.elementId === elementConfig.elementId
    );
    
    let updatedConfigs;
    if (existingIndex >= 0) {
      updatedConfigs = [...editVariantForm.elementConfigs];
      updatedConfigs[existingIndex] = elementConfig;
      toast.success(`Zaktualizowano: ${elementConfig.assetName || elementConfig.elementType} (ID: ${elementConfig.elementId?.slice(-6)})`);
    } else {
      updatedConfigs = [...editVariantForm.elementConfigs, elementConfig];
      toast.success(`Dodano: ${elementConfig.assetName || elementConfig.elementType} (ID: ${elementConfig.elementId?.slice(-6)})`);
    }
    
    setEditVariantForm({ ...editVariantForm, elementConfigs: updatedConfigs });
  };

  // Delete option
  const deleteLayoutOption = async (optionId) => {
    if (!confirm('Удалить опцию и все её варианты?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/layout-configurator/options/${optionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Опция удалена');
        fetchLayoutOptions(selectedModel?.id, selectedVariant?.id);
      }
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  // Copy option with all variants to another model
  const copyOptionToModel = async () => {
    if (!copyOptionForm.targetModelId) {
      toast.error('Wybierz model docelowy');
      return;
    }
    
    try {
      setLoading(true);
      
      // Determine which options to copy
      const optionsToCopy = copyOptionForm.sourceOptionId === 'all' 
        ? layoutOptions 
        : layoutOptions.filter(o => o.id === copyOptionForm.sourceOptionId);
      
      if (optionsToCopy.length === 0) {
        toast.error('Nie znaleziono opcji do skopiowania');
        return;
      }
      
      let totalOptions = 0;
      let totalVariants = 0;
      
      for (const sourceOption of optionsToCopy) {
        // Create new option in target model
        const formData = new FormData();
        formData.append('name', sourceOption.name);
        formData.append('namePl', sourceOption.namePl || sourceOption.name);
        formData.append('nameRu', sourceOption.nameRu || sourceOption.name);
        formData.append('modelId', copyOptionForm.targetModelId);
        if (copyOptionForm.targetVariantId) {
          formData.append('variantId', copyOptionForm.targetVariantId);
        }
        
        const res = await fetch(`${API_URL}/api/layout-configurator/options`, {
          method: 'POST',
          body: formData,
        });
        
        if (!res.ok) {
          console.error('Error creating option:', await res.text());
          continue;
        }
        
        const newOption = await res.json();
        totalOptions++;
        
        // Copy all variants
        for (const variant of sourceOption.variants || []) {
          const variantFormData = new FormData();
          variantFormData.append('name', variant.name);
          variantFormData.append('namePl', variant.namePl || variant.name);
          variantFormData.append('nameRu', variant.nameRu || variant.name);
          variantFormData.append('elementConfigs', JSON.stringify(variant.elementConfigs || variant.configurations || []));
          variantFormData.append('conditions', JSON.stringify(variant.conditions || []));
          
          const varRes = await fetch(`${API_URL}/api/layout-configurator/options/${newOption.id}/variants`, {
            method: 'POST',
            body: variantFormData,
          });
          
          if (varRes.ok) {
            totalVariants++;
          }
        }
      }
      
      toast.success(`Skopiowano ${totalOptions} opcji z ${totalVariants} wariantami`);
      setCopyOptionDialogOpen(false);
      setCopyOptionForm({ sourceOptionId: '', targetModelId: '', targetVariantId: '' });
      
      // Refresh if we're viewing the target model
      if (selectedModel?.id === copyOptionForm.targetModelId) {
        fetchLayoutOptions(selectedModel?.id, selectedVariant?.id);
      }
    } catch (error) {
      console.error('Error copying options:', error);
      toast.error('Błąd kopiowania opcji');
    } finally {
      setLoading(false);
    }
  };

  // Add current selected element to variant form
  const addElementToVariantForm = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    const selectedObj = canvas.getActiveObject();
    if (!selectedObj) {
      toast.error('Wybierz element');
      return;
    }
    
    // Create element configuration from selected object
    const elementConfig = {
      elementType: selectedObj.elementType || selectedObj.type,
      matchBy: 'elementId', // Always use elementId for precise matching
      assetId: selectedObj.assetId || null,
      assetName: selectedObj.assetName || null,
      elementId: selectedObj.elementId || null,
      instanceName: selectedObj.instanceName || null,
      properties: {
        left: Math.round(selectedObj.left),
        top: Math.round(selectedObj.top),
        angle: selectedObj.angle || 0,
        scaleX: selectedObj.scaleX || 1,
        scaleY: selectedObj.scaleY || 1,
        flipX: selectedObj.flipX || false,
        flipY: selectedObj.flipY || false,
        isHidden: selectedObj.isHidden || false,
      }
    };
    
    // Check if element already added (by elementId - unique)
    const existingIndex = newVariantForm.elements.findIndex(el => 
      el.elementId && el.elementId === elementConfig.elementId
    );
    
    if (existingIndex >= 0) {
      // Update existing
      const updated = [...newVariantForm.elements];
      updated[existingIndex] = elementConfig;
      setNewVariantForm({ ...newVariantForm, elements: updated });
      toast.success('Zaktualizowano element');
    } else {
      setNewVariantForm({ 
        ...newVariantForm, 
        elements: [...newVariantForm.elements, elementConfig] 
      });
      toast.success(`Dodano: ${elementConfig.assetName || elementConfig.elementType} (ID: ${elementConfig.elementId?.slice(-6)})`);
    }
  };

  // Save current element configuration as variant
  const saveAsVariant = async () => {
    if (!newVariantForm.optionId || !newVariantForm.name) {
      toast.error('Выберите опцию и введите название варианта');
      return;
    }
    
    // Use accumulated elements or create from current selection
    let elementsToSave = newVariantForm.elements;
    
    if (elementsToSave.length === 0) {
      // If no elements accumulated, try to use current selection
      const canvas = fabricRef.current;
      if (!canvas) return;
      
      const selectedObj = canvas.getActiveObject();
      if (!selectedObj) {
        toast.error('Dodaj elementy do wariantu');
        return;
      }
      
      // Create element configuration from selected object
      elementsToSave = [{
        elementType: selectedObj.elementType || selectedObj.type,
        matchBy: 'elementId', // Always use elementId for precise matching
        assetId: selectedObj.assetId || null,
        assetName: selectedObj.assetName || null,
        elementId: selectedObj.elementId || null,
        instanceName: selectedObj.instanceName || null,
        properties: {
          left: Math.round(selectedObj.left),
          top: Math.round(selectedObj.top),
          angle: selectedObj.angle || 0,
          scaleX: selectedObj.scaleX || 1,
          scaleY: selectedObj.scaleY || 1,
          flipX: selectedObj.flipX || false,
          flipY: selectedObj.flipY || false,
          isHidden: selectedObj.isHidden || false,
        }
      }];
    }
    
    // Also save room position for coordinate normalization
    const roomObj = fabricRef.current?.getObjects().find(obj => obj.isRoom);
    if (roomObj) {
      elementsToSave.push({
        elementType: 'room',
        isRoom: true,
        properties: {
          left: Math.round(roomObj.left),
          top: Math.round(roomObj.top),
          width: roomObj.width,
          height: roomObj.height,
        }
      });
    }
    
    try {
      const formData = new FormData();
      formData.append('name', newVariantForm.name);
      formData.append('namePl', newVariantForm.namePl || newVariantForm.name);
      formData.append('nameRu', newVariantForm.nameRu || newVariantForm.name);
      formData.append('elementConfigs', JSON.stringify(elementsToSave));
      formData.append('conditions', JSON.stringify(newVariantForm.conditions || []));
      
      const res = await fetch(`${API_URL}/api/layout-configurator/options/${newVariantForm.optionId}/variants`, {
        method: 'POST',
        body: formData,
      });
      
      if (res.ok) {
        toast.success('Wariant zapisany');
        setSaveVariantDialogOpen(false);
        setNewVariantForm({ optionId: '', name: '', namePl: '', nameRu: '', conditions: [], elements: [] });
        fetchLayoutOptions(selectedModel?.id, selectedVariant?.id);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Ошибка сохранения варианта');
      }
    } catch (error) {
      toast.error('Ошибка сети');
    }
  };

  // Check if variant conditions are met
  const isVariantVisible = (variant) => {
    if (!variant.conditions || variant.conditions.length === 0) {
      return true; // No conditions = always visible
    }
    // All conditions must be met
    return variant.conditions.every(cond => 
      selectedVariants[cond.optionId] === cond.variantId
    );
  };

  // Delete variant
  const deleteVariant = async (optionId, variantId) => {
    if (!confirm('Удалить вариант?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/layout-configurator/options/${optionId}/variants/${variantId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Вариант удалён');
        fetchLayoutOptions(selectedModel?.id, selectedVariant?.id);
      }
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  // Apply variant to canvas - move/transform elements according to variant config
  const applyVariant = (optionId, variant, roomOffset = null) => {
    const canvas = fabricRef.current;
    if (!canvas || !variant.elementConfigs) return;
    
    console.log(`Applying variant: ${variant.namePl || variant.name}`);
    console.log(`Elements to change: ${variant.elementConfigs.length}`);
    
    // Calculate room offset for coordinate normalization
    // If roomOffset is not provided, calculate it from the canvas
    let offsetX = 0;
    let offsetY = 0;
    
    if (roomOffset) {
      offsetX = roomOffset.x;
      offsetY = roomOffset.y;
    } else {
      // Find current room position on canvas
      const roomObj = canvas.getObjects().find(obj => obj.isRoom);
      if (roomObj) {
        // If variant has reference room position, calculate offset
        const variantRoomConfig = variant.elementConfigs.find(c => c.isRoom);
        if (variantRoomConfig && variantRoomConfig.properties) {
          offsetX = roomObj.left - (variantRoomConfig.properties.left || 0);
          offsetY = roomObj.top - (variantRoomConfig.properties.top || 0);
          console.log(`  Room offset: X=${offsetX.toFixed(0)}, Y=${offsetY.toFixed(0)}`);
        }
      }
    }
    
    let changedCount = 0;
    
    variant.elementConfigs.forEach(config => {
      // Skip room element - we don't move the room
      if (config.isRoom) return;
      
      // Find matching element on canvas with fallback strategy
      let targetObj = null;
      
      // Step 1: Try exact elementId match
      if (config.elementId) {
        canvas.getObjects().forEach(obj => {
          if (obj.elementId === config.elementId) {
            targetObj = obj;
          }
        });
      }
      
      // Step 2: Try instanceName match
      if (!targetObj && config.instanceName) {
        canvas.getObjects().forEach(obj => {
          if (obj.instanceName === config.instanceName) {
            targetObj = obj;
          }
        });
      }
      
      // Step 3: Fallback to assetId (for copied variants or different layouts)
      if (!targetObj && config.assetId) {
        canvas.getObjects().forEach(obj => {
          if (obj.assetId === config.assetId && !targetObj) {
            targetObj = obj;
          }
        });
        if (targetObj) {
          console.log(`  Fallback match by assetId: ${config.assetName}`);
        }
      }
      
      // Step 4: Fallback to assetName
      if (!targetObj && config.assetName) {
        canvas.getObjects().forEach(obj => {
          if (obj.assetName === config.assetName && !targetObj) {
            targetObj = obj;
          }
        });
        if (targetObj) {
          console.log(`  Fallback match by assetName: ${config.assetName}`);
        }
      }
      
      // Step 5: Fallback to elementType
      if (!targetObj && config.elementType) {
        canvas.getObjects().forEach(obj => {
          if (obj.elementType === config.elementType && !targetObj) {
            targetObj = obj;
          }
        });
        if (targetObj) {
          console.log(`  Fallback match by type: ${config.elementType}`);
        }
      }
      
      if (targetObj && config.properties) {
        console.log(`  Changing: ${config.assetName || config.elementType} (ID: ${config.elementId?.slice(-6) || 'none'})`);
        changedCount++;
        
        // Apply properties WITH coordinate offset adjustment
        const props = config.properties;
        if (props.left !== undefined) targetObj.set('left', props.left + offsetX);
        if (props.top !== undefined) targetObj.set('top', props.top + offsetY);
        if (props.angle !== undefined) targetObj.set('angle', props.angle);
        if (props.scaleX !== undefined) targetObj.set('scaleX', props.scaleX);
        if (props.scaleY !== undefined) targetObj.set('scaleY', props.scaleY);
        if (props.flipX !== undefined) targetObj.set('flipX', props.flipX);
        if (props.flipY !== undefined) targetObj.set('flipY', props.flipY);
        // Handle visibility - use isHidden flag instead of visible
        if (props.visible !== undefined) {
          const isHidden = !props.visible;
          targetObj.set('isHidden', isHidden);
          targetObj.set('opacity', isHidden ? 0.25 : 1);
          // Keep selectable
          targetObj.set('selectable', true);
          targetObj.set('evented', true);
        }
        if (props.isHidden !== undefined) {
          targetObj.set('isHidden', props.isHidden);
          targetObj.set('opacity', props.isHidden ? 0.25 : 1);
          targetObj.set('selectable', true);
          targetObj.set('evented', true);
        }
        
        targetObj.setCoords();
      } else if (!targetObj) {
        console.log(`  NOT FOUND: ${config.assetName || config.elementType} (ID: ${config.elementId?.slice(-6) || 'none'})`);
      }
    });
    
    // Update selected variants state
    setSelectedVariants(prev => ({ ...prev, [optionId]: variant.id }));
    
    canvas.renderAll();
    updateDimensionLabels();
    saveToHistory();
    
    toast.success(`Применён: ${variant.namePl || variant.name} (${changedCount}/${variant.elementConfigs.length} элементов)`);
  };

  // Apply all variants that match calculator selections
  // Filters by current model AND submodel
  const applyAllCalculatorVariants = () => {
    if (!calculatorSelections || !layoutOptions.length) {
      toast.error('Нет данных для применения вариантов');
      return;
    }
    
    if (!selectedModel) {
      toast.error('Сначала выберите модель сауны');
      return;
    }
    
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    // Calculate room offset once for all variants
    let roomOffset = { x: 0, y: 0 };
    const roomObj = canvas.getObjects().find(obj => obj.isRoom);
    
    // Helper: Check if option belongs to current model/submodel context
    const isOptionForCurrentContext = (option) => {
      // If option has modelId, it must match current model
      if (option.modelId && option.modelId !== selectedModel.id) {
        return false;
      }
      // If option has variantId (submodel), it must match current submodel
      if (option.variantId && selectedVariant && option.variantId !== selectedVariant.id) {
        return false;
      }
      // If option has variantId but no submodel is selected, skip it
      if (option.variantId && !selectedVariant) {
        return false;
      }
      return true;
    };
    
    // Find variants that match calculator selections AND belong to current model/submodel
    const variantsToApply = [];
    
    layoutOptions.forEach(option => {
      // Skip options that don't belong to current model/submodel context
      if (!isOptionForCurrentContext(option)) {
        console.log(`Skipping option "${option.namePl}" - wrong model/submodel context`);
        return;
      }
      
      option.variants?.forEach(variant => {
        if (variant.calculatorMapping) {
          const { categoryId, optionId } = variant.calculatorMapping;
          if (calculatorSelections[categoryId] === optionId) {
            // Check if variant has room position info
            const variantRoomConfig = variant.elementConfigs?.find(c => c.isRoom);
            if (roomObj && variantRoomConfig && variantRoomConfig.properties) {
              // Use first valid room offset
              if (roomOffset.x === 0 && roomOffset.y === 0) {
                roomOffset = {
                  x: roomObj.left - (variantRoomConfig.properties.left || 0),
                  y: roomObj.top - (variantRoomConfig.properties.top || 0),
                };
              }
            }
            variantsToApply.push({ option, variant });
          }
        }
      });
    });
    
    if (variantsToApply.length === 0) {
      toast.info('Нет вариантов, соответствующих выборам в калькуляторе для текущей модели');
      return;
    }
    
    console.log('Applying all calculator variants for model', selectedModel.id, 'submodel', selectedVariant?.id || 'none');
    console.log('Room offset:', roomOffset);
    console.log('Variants to apply:', variantsToApply.length);
    
    // Apply variants sequentially with shared room offset
    variantsToApply.forEach(({ option, variant }) => {
      applyVariant(option.id, variant, roomOffset);
    });
    
    toast.success(`Применено ${variantsToApply.length} вариантов из калькулятора`);
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
        // Update canvas size based on outline and then load the image
        if (outline.canvasWidth && outline.canvasHeight) {
          setCanvasWidth(outline.canvasWidth);
          setCanvasHeight(outline.canvasHeight);
        }
        // Store outline for loading after canvas resize
        // The useEffect on canvasWidth/canvasHeight will handle loading
      } else {
        setModelOutline(null);
        removeOutlineFromCanvas();
      }
    } catch (error) {
      console.error('Error fetching outline:', error);
      setModelOutline(null);
    }
  };

  // Load outline when modelOutline changes or canvas resizes
  useEffect(() => {
    if (modelOutline && fabricRef.current) {
      // Small delay to ensure canvas is resized
      const timer = setTimeout(() => {
        loadOutlineToCanvas(modelOutline);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [modelOutline, canvasWidth, canvasHeight]);

  // Load outline image to canvas as background
  const loadOutlineToCanvas = useCallback((outline) => {
    if (!fabricRef.current || !outline?.imageUrl) return;
    
    const canvas = fabricRef.current;
    const currentCanvasWidth = canvas.getWidth();
    const currentCanvasHeight = canvas.getHeight();
    
    // Remove existing outline
    removeOutlineFromCanvas();
    
    let imageUrl = outline.imageUrl;
    if (imageUrl.startsWith('/api/')) {
      imageUrl = `${API_URL}${imageUrl}`;
    }
    
    fabric.Image.fromURL(imageUrl, (img) => {
      if (!img || !fabricRef.current) return;
      
      // Calculate scale based on real dimensions if available
      let scale;
      if (outline.outerLength && outline.outerWidth) {
        // Use real dimensions to calculate scale
        const targetWidthPx = outline.outerLength * pixelsPerCm;
        const targetHeightPx = outline.outerWidth * pixelsPerCm;
        
        const scaleX = targetWidthPx / img.width;
        const scaleY = targetHeightPx / img.height;
        scale = Math.min(scaleX, scaleY);
        
        // Ensure it fits in canvas (with 10% margin)
        const maxScale = Math.min(
          (currentCanvasWidth * 0.9) / img.width,
          (currentCanvasHeight * 0.9) / img.height
        );
        scale = Math.min(scale, maxScale);
      } else {
        // Fallback: scale to fit canvas
        const scaleX = currentCanvasWidth / img.width;
        const scaleY = currentCanvasHeight / img.height;
        scale = Math.min(scaleX, scaleY) * 0.85;
      }
      
      // Apply scale first
      img.scale(scale);
      
      // Calculate centered position (using scaled dimensions)
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const centerX = (currentCanvasWidth - scaledWidth) / 2;
      const centerY = (currentCanvasHeight - scaledHeight) / 2;
      
      img.set({
        left: centerX,
        top: centerY,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
        isOutline: true,
        opacity: 0.8,
      });
      
      fabricRef.current.add(img);
      // Send to back but above grid
      const gridLines = fabricRef.current.getObjects().filter(o => o.isGridLine);
      fabricRef.current.moveTo(img, gridLines.length);
      fabricRef.current.renderAll();
      
      console.log('Outline centered at:', centerX, centerY, 'scale:', scale);
    }, { crossOrigin: 'anonymous' });
  }, [pixelsPerCm]);

  // Load a template layout (saved layout as starting point)
  const loadTemplateLayout = useCallback(async (layout) => {
    if (!fabricRef.current || !layout) return;
    
    const canvas = fabricRef.current;
    
    // Clear existing user objects (keep grid)
    const objectsToRemove = canvas.getObjects().filter(obj => 
      !obj.isGridLine && !obj.isGridLabel
    );
    objectsToRemove.forEach(obj => canvas.remove(obj));
    
    // Load canvas state from the layout
    if (layout.canvasState) {
      try {
        const state = typeof layout.canvasState === 'string' 
          ? JSON.parse(layout.canvasState) 
          : layout.canvasState;
        
        canvas.loadFromJSON(state, () => {
          // Re-apply interactivity settings
          canvas.getObjects().forEach(obj => {
            if (obj.isGridLine || obj.isGridLabel || obj.isDimensionLabel) {
              obj.selectable = false;
              obj.evented = false;
            } else if (obj.isOutline) {
              obj.selectable = false;
              obj.evented = false;
            } else {
              obj.selectable = true;
              obj.evented = true;
              obj.hoverCursor = 'move';
            }
          });
          
          // Redraw grid
          drawGrid();
          canvas.requestRenderAll();
          
          // Set currentLayout so user can update the template
          setCurrentLayout(layout);
          
          toast.success(`Загружена планировка: "${layout.name}"`);
        });
      } catch (error) {
        console.error('Error loading template:', error);
        toast.error('Ошибка загрузки шаблона');
      }
    } else {
      toast.error('Шаблон не содержит данных планировки');
    }
  }, [drawGrid]);

  // Auto-load first layout when coming from calculator and layouts are fetched
  useEffect(() => {
    if (!calculatorSelections || !initialModelId) return;
    if (layoutLoadedForCalculator) return; // Already loaded
    if (!fabricRef.current) return;
    
    // Wait a bit for layouts to be fetched
    if (layouts.length === 0) {
      // Check if we've waited long enough
      const checkTimeout = setTimeout(() => {
        if (layouts.length === 0) {
          console.log('No layouts found for calculator integration. Need to create a layout first.');
          toast.info('Для этой модели нет сохранённых планировок. Создайте планировку вручную.', {
            duration: 5000,
          });
        }
      }, 2000);
      return () => clearTimeout(checkTimeout);
    }
    
    // Find a layout for this model (try with variant first, then without)
    let layoutForModel = initialVariantId 
      ? layouts.find(l => l.modelId === initialModelId && l.variantId === initialVariantId)
      : null;
    
    if (!layoutForModel) {
      layoutForModel = layouts.find(l => l.modelId === initialModelId);
    }
    
    if (layoutForModel) {
      console.log('Auto-loading layout for calculator integration:', layoutForModel.name);
      loadTemplateLayout(layoutForModel);
      setLayoutLoadedForCalculator(true);
    } else {
      console.log('No layout found for model:', initialModelId);
      toast.info('Для этой модели нет сохранённых планировок. Выберите планировку вручную во вкладке "Планировки".', {
        duration: 5000,
      });
    }
  }, [layouts, calculatorSelections, initialModelId, initialVariantId, layoutLoadedForCalculator, loadTemplateLayout]);

  // Save layout configuration to order
  const saveLayoutToOrder = async () => {
    if (!orderId) {
      toast.error('Не указан ID заказа');
      return;
    }
    
    if (!fabricRef.current) {
      toast.error('Ошибка: canvas не инициализирован');
      return;
    }
    
    setLoading(true);
    try {
      const canvas = fabricRef.current;
      
      // Export canvas to PNG
      const imageData = canvas.toDataURL({
        format: 'png',
        quality: 0.8,
        multiplier: 2, // Higher resolution
      }).split(',')[1]; // Get base64 part only
      
      // Get canvas JSON state
      const canvasJson = canvas.toJSON(['elementId', 'assetId', 'elementType', 'realWidthCm', 'realHeightCm', 'fixedHeight', 'isOutline', 'isRoom', 'roomData', 'instanceName', 'isHidden']);
      
      // Get selected variants
      const selectedVariantsCopy = { ...selectedVariants };
      
      // Send to backend
      const response = await fetch(`${API_URL}/api/sauna/orders/${orderId}/layout-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData,
          canvasJson,
          selectedVariants: selectedVariantsCopy,
          configuredBy: 'manager', // TODO: get from auth context
        }),
      });
      
      if (!response.ok) {
        const err = await response.json();
        toast.error(err.detail || 'Ошибка сохранения');
        return;
      }
      
      const result = await response.json();
      toast.success('Планировка сохранена в заказ');
      
      if (onLayoutSaved) {
        onLayoutSaved(result);
      }
    } catch (error) {
      console.error('Error saving layout to order:', error);
      toast.error('Ошибка сохранения планировки');
    } finally {
      setLoading(false);
    }
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
  const handleModelChange = async (modelId) => {
    const model = saunaModels.find(m => m.id === modelId);
    setSelectedModel(model);
    setSelectedVariant(null);
    // Reset selected layout options variants
    setSelectedVariants({});
    
    if (model) {
      // Reload layouts and options for this model
      fetchLayouts(modelId, null);
      fetchLayoutOptions(modelId, null);
      // Load template from API directly (don't rely on state)
      await loadTemplateForModelFromAPI(modelId, null);
    } else {
      // Load all layouts and options
      fetchLayouts();
      fetchLayoutOptions();
      setModelOutline(null);
      removeOutlineFromCanvas();
    }
  };

  // Handle variant selection change
  const handleVariantChange = async (variantId) => {
    if (!selectedModel) return;
    const variant = selectedModel.variants?.find(v => v.id === variantId);
    setSelectedVariant(variant);
    // Reset selected layout options variants
    setSelectedVariants({});
    
    // Reload layouts and options for this model+variant
    fetchLayouts(selectedModel.id, variantId);
    fetchLayoutOptions(selectedModel.id, variantId);
    
    // Load template from API directly
    await loadTemplateForModelFromAPI(selectedModel.id, variantId);
  };

  // Load template layout for model/variant from API (not from state)
  const loadTemplateForModelFromAPI = async (modelId, variantId) => {
    try {
      // Fetch layouts directly from API
      let url = `${API_URL}/api/layout-configurator/layouts?modelId=${modelId}`;
      if (variantId) url += `&variantId=${variantId}`;
      
      const res = await fetch(url);
      if (!res.ok) return;
      
      const data = await res.json();
      const layoutsList = data.layouts || [];
      
      // Find matching layout
      const matchingLayout = layoutsList.find(layout => {
        if (variantId) {
          return layout.modelId === modelId && layout.variantId === variantId;
        }
        return layout.modelId === modelId && !layout.variantId;
      });
      
      if (matchingLayout) {
        // Load the layout as template
        loadTemplateLayout(matchingLayout);
        toast.info(`Загружена планировка: ${matchingLayout.name}`);
      } else {
        // No saved layout, just load the outline
        fetchOutline(modelId, variantId);
      }
    } catch (error) {
      console.error('Error loading template for model:', error);
      fetchOutline(modelId, variantId);
    }
  };

  // Legacy function - kept for backwards compatibility
  const loadTemplateForModel = async (modelId, variantId) => {
    await loadTemplateForModelFromAPI(modelId, variantId);
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

  // ============ UNDO HISTORY ============
  
  // Save current canvas state to history
  const saveToHistory = useCallback(() => {
    if (!fabricRef.current || isUndoing.current) return;
    
    const canvas = fabricRef.current;
    
    // Get only user-created objects (exclude grid and labels)
    const userObjects = canvas.getObjects().filter(obj => 
      !obj.isGridLine && !obj.isGridLabel && !obj.isDimensionLabel
    );
    
    // Create a temporary canvas state with only user objects
    const tempCanvas = {
      version: '5.3.0',
      objects: userObjects.map(obj => obj.toObject([
        'elementId', 'elementType', 'isDrawnShape', 'strokeWidthCm', 
        'isMeasurement', 'isMeasurementPart', 'parentId', 'isRuler',
        'showDimensions', 'assetId', 'assetName', 'isGroup', 'isModelOutline',
        'isRoom', 'isRoomGroup', 'isOuterWall', 'isInnerRoom', 'isPartition', 'partitionType',
        'outerWidthCm', 'outerHeightCm', 'innerWidthCm', 'innerHeightCm',
        'wallLeftCm', 'wallRightCm', 'wallTopCm', 'wallBottomCm', 'wallThicknessCm',
        'showOuterDimensions', 'showInnerDimensions',
        'showElementSize', 'showDistances',
        'lockScalingY', 'fixedHeightCm',
        'left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'angle'
      ])),
      background: canvas.backgroundColor,
    };
    
    const stateStr = JSON.stringify(tempCanvas);
    
    setCanvasHistory(prev => {
      // Don't save duplicate states
      if (prev.length > 0 && prev[prev.length - 1] === stateStr) {
        return prev;
      }
      const newHistory = [...prev, stateStr];
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
      }
      return newHistory;
    });
  }, []);
  
  // Undo last action
  const handleUndo = useCallback(() => {
    if (canvasHistory.length <= 1 || !fabricRef.current) {
      toast.info('Нечего отменять');
      return;
    }
    
    isUndoing.current = true;
    const canvas = fabricRef.current;
    
    // Get previous state (second to last)
    const newHistory = canvasHistory.slice(0, -1);
    const previousStateStr = newHistory[newHistory.length - 1];
    
    if (previousStateStr) {
      const previousState = JSON.parse(previousStateStr);
      
      // Clear entire canvas
      canvas.clear();
      canvas.backgroundColor = '#f8fafc';
      
      // Load objects from previous state (this will restore user objects)
      canvas.loadFromJSON(previousState, () => {
        // Redraw grid on top
        drawGrid();
        
        // Re-apply interactivity settings to all objects
        canvas.getObjects().forEach(obj => {
          if (obj.isGridLine || obj.isGridLabel || obj.isDimensionLabel) {
            obj.selectable = false;
            obj.evented = false;
          } else if (activeToolRef.current === 'select') {
            obj.selectable = true;
            obj.evented = true;
            obj.hoverCursor = 'move';
          } else {
            obj.selectable = false;
            obj.evented = false;
            obj.hoverCursor = 'default';
          }
        });
        
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        
        setSelectedObject(null);
        isUndoing.current = false;
        toast.success('Действие отменено');
      });
    } else {
      isUndoing.current = false;
    }
    
    setCanvasHistory(newHistory);
  }, [canvasHistory, drawGrid]);

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
      
      // Make all existing objects non-interactive (except dimension lines which stay interactive)
      canvas.getObjects().forEach(obj => {
        if (!obj.isGridLine && !obj.isGridLabel && !obj.isDimensionLabel && !obj.isDimensionLine) {
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
      
      // Make all objects interactive again (including dimension lines)
      canvas.getObjects().forEach(obj => {
        if (!obj.isGridLine && !obj.isGridLabel) {
          // Dimension labels (text) stay non-selectable, but dimension lines (groups) are selectable
          if (obj.isDimensionLabel && !obj.isDimensionLine) {
            obj.selectable = false;
            obj.evented = false;
          } else {
            obj.selectable = true;
            obj.evented = true;
            obj.hoverCursor = 'move';
          }
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
    
    // Handle text tool differently - show dialog instead of drawing
    if (currentTool === 'text') {
      setTextClickPosition({ x, y });
      setTextInput('');
      setTextDialogOpen(true);
      return;
    }
    
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
        showDimensions: true, // Default: show dimensions
        showDistanceLeft: true,
        showDistanceRight: true,
        showDistanceTop: true,
        showDistanceBottom: true,
      });
    } else if (currentTool === 'wall') {
      // For Line: use absolute coordinates, fabric.js will calculate left/top
      obj = new fabric.Line([x, y, x, y], {
        stroke: drawingColorRef.current,
        strokeWidth: strokeWidthPx,
        strokeLineCap: 'round',
        strokeWidthCm: strokeWidthCmRef.current,
        elementId: `wall-${Date.now()}`,
        elementType: 'wall',
        isDrawnShape: true,
        showDimensions: true, // Default: show dimensions
        showDistanceLeft: true,
        showDistanceRight: true,
        showDistanceTop: true,
        showDistanceBottom: true,
      });
    } else if (currentTool === 'ruler') {
      // Create measurement line - use absolute coordinates
      obj = new fabric.Line([x, y, x, y], {
        stroke: '#dc2626',
        strokeWidth: 2,
        strokeDashArray: [5, 3],
        elementId: `ruler-${Date.now()}`,
        elementType: 'ruler',
        isMeasurement: true,
        isDrawnShape: true,
        showDimensions: true,
      });
    }
    
    if (obj) {
      canvas.add(obj);
      drawingObjectRef.current = obj;
      setDrawingObject(obj);
      canvas.renderAll();
    }
  }, [gridSizeCm]);
  
  // Find nearest snap point on existing objects
  const findNearestSnapPoint = useCallback((x, y, threshold = 20) => {
    if (!fabricRef.current) return null;
    
    const canvas = fabricRef.current;
    const objects = canvas.getObjects().filter(obj => 
      obj.isDrawnShape && !obj.isGridLine && !obj.isGridLabel && !obj.isDimensionLabel
    );
    
    let nearestPoint = null;
    let minDist = threshold;
    
    objects.forEach(obj => {
      if (obj.type === 'rect') {
        const corners = [
          { x: obj.left, y: obj.top }, // top-left
          { x: obj.left + obj.width * (obj.scaleX || 1), y: obj.top }, // top-right
          { x: obj.left, y: obj.top + obj.height * (obj.scaleY || 1) }, // bottom-left
          { x: obj.left + obj.width * (obj.scaleX || 1), y: obj.top + obj.height * (obj.scaleY || 1) }, // bottom-right
        ];
        
        corners.forEach(corner => {
          const dist = Math.sqrt(Math.pow(x - corner.x, 2) + Math.pow(y - corner.y, 2));
          if (dist < minDist) {
            minDist = dist;
            nearestPoint = corner;
          }
        });
        
        // Also check edge midpoints
        const midpoints = [
          { x: obj.left + obj.width * (obj.scaleX || 1) / 2, y: obj.top }, // top center
          { x: obj.left + obj.width * (obj.scaleX || 1) / 2, y: obj.top + obj.height * (obj.scaleY || 1) }, // bottom center
          { x: obj.left, y: obj.top + obj.height * (obj.scaleY || 1) / 2 }, // left center
          { x: obj.left + obj.width * (obj.scaleX || 1), y: obj.top + obj.height * (obj.scaleY || 1) / 2 }, // right center
        ];
        
        midpoints.forEach(mp => {
          const dist = Math.sqrt(Math.pow(x - mp.x, 2) + Math.pow(y - mp.y, 2));
          if (dist < minDist) {
            minDist = dist;
            nearestPoint = mp;
          }
        });
      }
    });
    
    return nearestPoint;
  }, []);
  
  // Mouse move - update drawing
  const handleCanvasMouseMove = useCallback((opt) => {
    if (!isDrawingRef.current || !drawingObjectRef.current || !drawStartPointRef.current) return;
    
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    const pointer = canvas.getPointer(opt.e);
    const pxPerCm = pixelsPerCmRef.current;
    // Snap to 1cm for precise positioning
    const snap = (v) => Math.round(v / pxPerCm) * pxPerCm;
    let x = snap(pointer.x);
    let y = snap(pointer.y);
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
    } else if (currentTool === 'wall' || currentTool === 'ruler') {
      // Force horizontal or vertical line based on dominant direction
      const dx = Math.abs(x - startPoint.x);
      const dy = Math.abs(y - startPoint.y);
      
      if (dx > dy) {
        // Horizontal line - lock Y to start position
        y = startPoint.y;
      } else {
        // Vertical line - lock X to start position
        x = startPoint.x;
      }
      
      // Try to snap endpoint to nearest object corner/edge
      const snapPoint = findNearestSnapPoint(x, y, 15 * pxPerCm);
      if (snapPoint) {
        // Only snap if it maintains horizontal/vertical constraint
        if (dx > dy) {
          // Horizontal: can snap X, but Y must stay same
          if (Math.abs(snapPoint.y - startPoint.y) < 5 * pxPerCm) {
            x = snapPoint.x;
          }
        } else {
          // Vertical: can snap Y, but X must stay same
          if (Math.abs(snapPoint.x - startPoint.x) < 5 * pxPerCm) {
            y = snapPoint.y;
          }
        }
      }
      
      // Update line using absolute coordinates
      obj.set({
        x1: startPoint.x,
        y1: startPoint.y,
        x2: x,
        y2: y,
      });
      obj.setCoords();
    }
    
    obj.setCoords();
    canvas.renderAll();
  }, [findNearestSnapPoint]);
  
  // Mouse up - finish drawing
  const handleCanvasMouseUp = useCallback((opt) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    if (!isDrawingRef.current) {
      return;
    }
    
    isDrawingRef.current = false;
    setIsDrawing(false);
    
    const obj = drawingObjectRef.current;
    const currentTool = activeToolRef.current;
    const pxPerCm = pixelsPerCmRef.current;
    // Minimum size is 5cm for shapes, 2cm for ruler
    const minSizePx = currentTool === 'ruler' ? 2 * pxPerCm : 5 * pxPerCm;
    
    if (obj) {
      // Check if shape is too small
      let isTooSmall = false;
      let lengthPx = 0;
      
      if (currentTool === 'rectangle') {
        isTooSmall = (obj.width || 0) < minSizePx || (obj.height || 0) < minSizePx;
      } else if (currentTool === 'wall' || currentTool === 'ruler') {
        const dx = (obj.x2 || 0) - (obj.x1 || 0);
        const dy = (obj.y2 || 0) - (obj.y1 || 0);
        lengthPx = Math.sqrt(dx * dx + dy * dy);
        isTooSmall = lengthPx < minSizePx;
      }
      
      if (isTooSmall) {
        canvas.remove(obj);
        toast.info('Слишком маленький объект');
      } else {
        // The new object should remain non-selectable because drawing tool is still active
        // It will become selectable when user switches to select tool
        obj.selectable = false;
        obj.evented = false;
        obj.setCoords();
        
        // Show dimensions in CM
        if (currentTool === 'rectangle') {
          const widthCm = (obj.width / pxPerCm).toFixed(0);
          const heightCm = (obj.height / pxPerCm).toFixed(0);
          toast.success(`Прямоугольник: ${widthCm} × ${heightCm} см`);
        } else if (currentTool === 'wall') {
          const dx = (obj.x2 || 0) - (obj.x1 || 0);
          const dy = (obj.y2 || 0) - (obj.y1 || 0);
          const lengthPxCalc = Math.sqrt(dx * dx + dy * dy);
          const lengthCm = (lengthPxCalc / pxPerCm).toFixed(0);
          toast.success(`Стена: ${lengthCm} см`);
        } else if (currentTool === 'ruler') {
          // Create measurement label that stays on canvas
          const lengthCm = Math.round(lengthPx / pxPerCm);
          
          // With absolute coordinates, x1, y1, x2, y2 ARE the actual positions
          const startX = obj.x1;
          const startY = obj.y1;
          const endX = obj.x2;
          const endY = obj.y2;
          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;
          
          // Determine if horizontal or vertical
          const isHorizontal = Math.abs(endX - startX) > Math.abs(endY - startY);
          
          // Create perpendicular end caps (small lines) instead of triangles
          const capLength = 8;
          
          // Start cap
          const cap1 = new fabric.Line(
            isHorizontal 
              ? [startX, startY - capLength, startX, startY + capLength]
              : [startX - capLength, startY, startX + capLength, startY],
            {
              stroke: '#dc2626',
              strokeWidth: 2,
              selectable: false,
              evented: false,
              isMeasurementPart: true,
              parentId: obj.elementId,
            }
          );
          canvas.add(cap1);
          
          // End cap
          const cap2 = new fabric.Line(
            isHorizontal
              ? [endX, endY - capLength, endX, endY + capLength]
              : [endX - capLength, endY, endX + capLength, endY],
            {
              stroke: '#dc2626',
              strokeWidth: 2,
              selectable: false,
              evented: false,
              isMeasurementPart: true,
              parentId: obj.elementId,
            }
          );
          canvas.add(cap2);
          
          // Label with white background - positioned above for horizontal, left for vertical
          const label = new fabric.Text(`${lengthCm} см`, {
            left: midX + (isHorizontal ? 0 : 10),
            top: midY + (isHorizontal ? -15 : 0),
            fontSize: 11,
            fill: '#dc2626',
            fontWeight: 'bold',
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: 2,
            originX: isHorizontal ? 'center' : 'left',
            originY: isHorizontal ? 'bottom' : 'center',
            selectable: false,
            evented: false,
            isMeasurementPart: true,
            parentId: obj.elementId,
          });
          canvas.add(label);
          
          toast.success(`Измерение: ${lengthCm} см`);
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
    
    // Handle fixedHeight elements - restore original scaleY
    if (obj.fixedHeightCm && obj.lockScalingY) {
      // Calculate original scaleY based on fixedHeightCm
      const originalHeightPx = obj.fixedHeightCm * pixelsPerCm;
      const originalScaleY = originalHeightPx / obj.height;
      obj.set({ scaleY: originalScaleY });
    }
    
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
  // Find inner room rect for distance calculations
  const findRoomRect = useCallback(() => {
    if (!fabricRef.current) return null;
    const canvas = fabricRef.current;
    
    // First try to find a room group (new room with walls)
    const roomGroups = canvas.getObjects().filter(o => o.isRoomGroup);
    if (roomGroups.length > 0) {
      const roomGroup = roomGroups[0];
      // Get wall thicknesses (support both old single thickness and new per-wall)
      const wallLeftPx = (roomGroup.wallLeftCm || roomGroup.wallThicknessCm || 0) * pixelsPerCm;
      const wallRightPx = (roomGroup.wallRightCm || roomGroup.wallThicknessCm || 0) * pixelsPerCm;
      const wallTopPx = (roomGroup.wallTopCm || roomGroup.wallThicknessCm || 0) * pixelsPerCm;
      const wallBottomPx = (roomGroup.wallBottomCm || roomGroup.wallThicknessCm || 0) * pixelsPerCm;
      
      const groupWidth = roomGroup.width * (roomGroup.scaleX || 1);
      const groupHeight = roomGroup.height * (roomGroup.scaleY || 1);
      
      return {
        left: roomGroup.left + wallLeftPx,
        top: roomGroup.top + wallTopPx,
        width: groupWidth - wallLeftPx - wallRightPx,
        height: groupHeight - wallTopPx - wallBottomPx,
        scaleX: 1,
        scaleY: 1,
        wallLeftPx,
        wallRightPx,
        wallTopPx,
        wallBottomPx,
        outerLeft: roomGroup.left,
        outerTop: roomGroup.top,
        outerWidth: groupWidth,
        outerHeight: groupHeight,
        isRoomGroup: true,
      };
    }
    
    // Fallback to finding largest rectangle
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
  }, [pixelsPerCm]);

  // Snap object position to room walls (inner walls) with tolerance
  const snapToRoomWalls = useCallback((obj, left, top) => {
    const room = findRoomRect();
    if (!room || !snapToObjects) return { left, top };
    
    const snapTolerance = 10; // pixels
    const objWidth = (obj.width || 0) * (obj.scaleX || 1);
    const objHeight = (obj.height || 0) * (obj.scaleY || 1);
    
    let newLeft = left;
    let newTop = top;
    
    // Room boundaries (inner walls)
    const roomLeft = room.left;
    const roomTop = room.top;
    const roomRight = roomLeft + room.width * (room.scaleX || 1);
    const roomBottom = roomTop + room.height * (room.scaleY || 1);
    
    // Snap to left inner wall
    if (Math.abs(left - roomLeft) < snapTolerance) {
      newLeft = roomLeft;
    }
    // Snap to right inner wall
    if (Math.abs(left + objWidth - roomRight) < snapTolerance) {
      newLeft = roomRight - objWidth;
    }
    // Snap to top inner wall
    if (Math.abs(top - roomTop) < snapTolerance) {
      newTop = roomTop;
    }
    // Snap to bottom inner wall
    if (Math.abs(top + objHeight - roomBottom) < snapTolerance) {
      newTop = roomBottom - objHeight;
    }
    
    // Also snap to outer walls if room has wall thickness
    if (room.isRoomGroup && room.wallThicknessPx) {
      const outerLeft = room.outerLeft;
      const outerTop = room.outerTop;
      const outerRight = outerLeft + room.outerWidth;
      const outerBottom = outerTop + room.outerHeight;
      
      // Snap to outer left wall
      if (Math.abs(left - outerLeft) < snapTolerance) {
        newLeft = outerLeft;
      }
      // Snap to outer right wall
      if (Math.abs(left + objWidth - outerRight) < snapTolerance) {
        newLeft = outerRight - objWidth;
      }
      // Snap to outer top wall
      if (Math.abs(top - outerTop) < snapTolerance) {
        newTop = outerTop;
      }
      // Snap to outer bottom wall
      if (Math.abs(top + objHeight - outerBottom) < snapTolerance) {
        newTop = outerBottom - objHeight;
      }
    }
    
    return { left: newLeft, top: newTop };
  }, [snapToObjects, findRoomRect]);

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
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    
    // Remove old dimension labels
    canvas.getObjects().filter(o => o.isDimensionLabel).forEach(o => canvas.remove(o));
    
    // Get all drawn shapes (except grid) that have showDimensions enabled
    const shapes = canvas.getObjects().filter(o => 
      (o.isDrawnShape || o.type === 'image') && !o.isGridLine && !o.isGridLabel && o.showDimensions !== false
    );
    
    // Find room (largest rectangle)
    const room = findRoomRect();
    
    // Helper to draw distance line with arrows and label (as a movable group)
    const drawDistanceLine = (x1, y1, x2, y2, labelText, isHorizontal = true, sourceObjId = null) => {
      const arrowSize = 4;
      const groupElements = [];
      
      // Calculate relative positions for group
      const minX = Math.min(x1, x2);
      const minY = Math.min(y1, y2);
      
      // Main line (relative to group origin)
      const line = new fabric.Line([x1 - minX, y1 - minY, x2 - minX, y2 - minY], {
        stroke: '#dc2626',
        strokeWidth: 1,
        strokeDashArray: [4, 2],
      });
      groupElements.push(line);
      
      // Arrow at start
      if (isHorizontal) {
        const arrow1 = new fabric.Triangle({
          left: x1 - minX,
          top: y1 - minY,
          width: arrowSize,
          height: arrowSize * 1.5,
          fill: '#dc2626',
          angle: -90,
          originX: 'center',
          originY: 'center',
        });
        groupElements.push(arrow1);
        
        const arrow2 = new fabric.Triangle({
          left: x2 - minX,
          top: y2 - minY,
          width: arrowSize,
          height: arrowSize * 1.5,
          fill: '#dc2626',
          angle: 90,
          originX: 'center',
          originY: 'center',
        });
        groupElements.push(arrow2);
      } else {
        const arrow1 = new fabric.Triangle({
          left: x1 - minX,
          top: y1 - minY,
          width: arrowSize,
          height: arrowSize * 1.5,
          fill: '#dc2626',
          angle: 0,
          originX: 'center',
          originY: 'center',
        });
        groupElements.push(arrow1);
        
        const arrow2 = new fabric.Triangle({
          left: x2 - minX,
          top: y2 - minY,
          width: arrowSize,
          height: arrowSize * 1.5,
          fill: '#dc2626',
          angle: 180,
          originX: 'center',
          originY: 'center',
        });
        groupElements.push(arrow2);
      }
      
      // Label
      const midX = (x1 + x2) / 2 - minX;
      const midY = (y1 + y2) / 2 - minY;
      const label = new fabric.Text(labelText, {
        left: midX + (isHorizontal ? 0 : 8),
        top: midY + (isHorizontal ? -12 : 0),
        fontSize: 9,
        fill: '#dc2626',
        fontWeight: 'bold',
        backgroundColor: 'rgba(255,255,255,0.9)',
        originX: 'center',
        originY: isHorizontal ? 'bottom' : 'center',
      });
      groupElements.push(label);
      
      // Create movable group
      const group = new fabric.Group(groupElements, {
        left: minX,
        top: minY,
        selectable: true,
        evented: true,
        hasControls: false,
        hasBorders: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        isDimensionLabel: true,
        isDimensionLine: true,
        sourceObjectId: sourceObjId,
        hoverCursor: 'move',
        borderColor: '#dc2626',
        cornerColor: '#dc2626',
      });
      
      canvas.add(group);
    };
    
    // First, add room dimension labels if it's a room group
    const roomGroups = canvas.getObjects().filter(o => o.isRoomGroup);
    roomGroups.forEach(roomGroup => {
      const outerWidth = roomGroup.width * (roomGroup.scaleX || 1);
      const outerHeight = roomGroup.height * (roomGroup.scaleY || 1);
      
      // Support individual wall thicknesses (new) or fallback to single thickness (legacy)
      const wallLeftPx = (roomGroup.wallLeftCm || roomGroup.wallThicknessCm || 0) * pixelsPerCm;
      const wallRightPx = (roomGroup.wallRightCm || roomGroup.wallThicknessCm || 0) * pixelsPerCm;
      const wallTopPx = (roomGroup.wallTopCm || roomGroup.wallThicknessCm || 0) * pixelsPerCm;
      const wallBottomPx = (roomGroup.wallBottomCm || roomGroup.wallThicknessCm || 0) * pixelsPerCm;
      
      const innerWidth = outerWidth - wallLeftPx - wallRightPx;
      const innerHeight = outerHeight - wallTopPx - wallBottomPx;
      
      const outerWidthCm = (outerWidth / pixelsPerCm).toFixed(1);
      const outerHeightCm = (outerHeight / pixelsPerCm).toFixed(1);
      const innerWidthCm = (innerWidth / pixelsPerCm).toFixed(1);
      const innerHeightCm = (innerHeight / pixelsPerCm).toFixed(1);
      
      // Check visibility settings
      const showOuter = roomGroup.showOuterDimensions !== false;
      const showInner = roomGroup.showInnerDimensions !== false;
      
      // Outer width label (top, outside)
      if (showOuter) {
        const outerWidthLabel = new fabric.Text(`zewn: ${outerWidthCm} cm`, {
          left: roomGroup.left + outerWidth / 2,
          top: roomGroup.top - 20,
          fontSize: 10,
          fill: '#8B4513',
          fontWeight: 'bold',
          originX: 'center',
          selectable: false,
          evented: false,
          isDimensionLabel: true,
        });
        canvas.add(outerWidthLabel);
      }
      
      // Inner width label (top, inside)
      if (showInner) {
        const innerWidthLabel = new fabric.Text(`wewn: ${innerWidthCm} cm`, {
          left: roomGroup.left + outerWidth / 2,
          top: roomGroup.top + wallTopPx + 5,
          fontSize: 9,
          fill: '#059669',
          fontWeight: 'bold',
          originX: 'center',
          selectable: false,
          evented: false,
          isDimensionLabel: true,
        });
        canvas.add(innerWidthLabel);
      }
      
      // Outer height label (left, outside)
      if (showOuter) {
        const outerHeightLabel = new fabric.Text(`zewn: ${outerHeightCm} cm`, {
          left: roomGroup.left - 25,
          top: roomGroup.top + outerHeight / 2,
          fontSize: 10,
          fill: '#8B4513',
          fontWeight: 'bold',
          originX: 'center',
          originY: 'center',
          angle: -90,
          selectable: false,
          evented: false,
          isDimensionLabel: true,
        });
        canvas.add(outerHeightLabel);
      }
      
      // Inner height label (left inside)
      if (showInner) {
        const innerHeightLabel = new fabric.Text(`wewn: ${innerHeightCm} cm`, {
          left: roomGroup.left + wallLeftPx + 8,
          top: roomGroup.top + outerHeight / 2,
          fontSize: 9,
          fill: '#059669',
          fontWeight: 'bold',
          originX: 'center',
          originY: 'center',
          angle: -90,
          selectable: false,
          evented: false,
          isDimensionLabel: true,
        });
        canvas.add(innerHeightLabel);
      }
    });
    
    shapes.forEach(obj => {
      // Skip room groups - they have special labels above
      if (obj.isRoomGroup) return;
      
      if (obj.type === 'rect' || obj.type === 'group' || obj.type === 'image') {
        // Get bounding rect to account for rotation
        const boundingRect = obj.getBoundingRect(true); // true = absolute coordinates
        const bboxWidth = boundingRect.width;
        const bboxHeight = boundingRect.height;
        const bboxLeft = boundingRect.left;
        const bboxTop = boundingRect.top;
        
        // Original dimensions (without rotation)
        const origWidth = obj.width * (obj.scaleX || 1);
        const origHeight = obj.height * (obj.scaleY || 1);
        
        // Normalize angle to 0-360
        const angle = ((obj.angle || 0) % 360 + 360) % 360;
        
        // Determine if rotated by approximately 90 or 270 degrees (swap width/height)
        const isRotated90 = (angle > 45 && angle < 135) || (angle > 225 && angle < 315);
        
        // For dimension labels, show dimensions relative to current orientation
        // If rotated 90°/270° - the "top" label shows original height, "left" label shows original width
        const topDimensionCm = isRotated90 
          ? (origHeight / pixelsPerCm).toFixed(1) 
          : (origWidth / pixelsPerCm).toFixed(1);
        const leftDimensionCm = isRotated90 
          ? (origWidth / pixelsPerCm).toFixed(1) 
          : (origHeight / pixelsPerCm).toFixed(1);
        
        // Only show element size labels if showElementSize is not false
        if (obj.showElementSize !== false) {
          // Width label (top center of bounding box) - shows dimension of top edge
          const widthLabel = new fabric.Text(`${topDimensionCm} cm`, {
            left: bboxLeft + bboxWidth / 2,
            top: bboxTop - 14,
            fontSize: 10,
            fill: '#1e40af',
            fontWeight: 'bold',
            originX: 'center',
            selectable: false,
            evented: false,
            isDimensionLabel: true,
          });
          canvas.add(widthLabel);
          
          // Height label (left center of bounding box, rotated) - shows dimension of left edge
          const heightLabel = new fabric.Text(`${leftDimensionCm} cm`, {
            left: bboxLeft - 6,
            top: bboxTop + bboxHeight / 2,
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
        }
        
        // Distance labels to room walls (if this is not the room itself and room exists)
        // Skip if obj is part of room group or is a room
        if (room && !obj.isRoomGroup && !obj.isRoom && !obj.isInnerRoom && !obj.isOuterWall) {
          // Use bounding box for distance calculations (accounts for rotation)
          const objLeft = bboxLeft;
          const objTop = bboxTop;
          const objRight = bboxLeft + bboxWidth;
          const objBottom = bboxTop + bboxHeight;
          
          // Get room boundaries - for room groups, use inner boundaries
          const roomLeft = room.left;
          const roomTop = room.top;
          const roomRight = roomLeft + room.width * (room.scaleX || 1);
          const roomBottom = roomTop + room.height * (room.scaleY || 1);
          
          // Find partitions that may affect distances
          const partitions = canvas.getObjects().filter(o => o.isPartition);
          
          // Find closest left boundary (room wall or partition)
          let leftBoundary = roomLeft;
          partitions.forEach(p => {
            if (p.partitionType === 'vertical') {
              const px = p.left || p.x1;
              if (px < objLeft && px > leftBoundary) {
                leftBoundary = px;
              }
            }
          });
          
          // Find closest right boundary (room wall or partition)
          let rightBoundary = roomRight;
          partitions.forEach(p => {
            if (p.partitionType === 'vertical') {
              const px = p.left || p.x1;
              if (px > objRight && px < rightBoundary) {
                rightBoundary = px;
              }
            }
          });
          
          // Find closest top boundary (room wall or partition)
          let topBoundary = roomTop;
          partitions.forEach(p => {
            if (p.partitionType === 'horizontal') {
              const py = p.top || p.y1;
              if (py < objTop && py > topBoundary) {
                topBoundary = py;
              }
            }
          });
          
          // Find closest bottom boundary (room wall or partition)
          let bottomBoundary = roomBottom;
          partitions.forEach(p => {
            if (p.partitionType === 'horizontal') {
              const py = p.top || p.y1;
              // If partition is below object and above current boundary
              if (py > objBottom && py < bottomBoundary) {
                bottomBoundary = py;
              }
            }
          });
          
          const distLeft = ((objLeft - leftBoundary) / pixelsPerCm).toFixed(1);
          const distRight = ((rightBoundary - objRight) / pixelsPerCm).toFixed(1);
          const distTop = ((objTop - topBoundary) / pixelsPerCm).toFixed(1);
          const distBottom = ((bottomBoundary - objBottom) / pixelsPerCm).toFixed(1);
          
          // Center of bounding box for line positioning
          const centerY = objTop + bboxHeight / 2;
          const centerX = objLeft + bboxWidth / 2;
          
          // Only draw distances if showDistances is not false
          if (obj.showDistances !== false) {
            // Left distance line + label (check showDistanceLeft)
            if (parseFloat(distLeft) > 0.5 && obj.showDistanceLeft !== false) {
              drawDistanceLine(leftBoundary, centerY, objLeft, centerY, `${distLeft}`, true, obj.id || obj._id);
            }
            
            // Right distance line + label (check showDistanceRight)
            if (parseFloat(distRight) > 0.5 && obj.showDistanceRight !== false) {
              drawDistanceLine(objRight, centerY, rightBoundary, centerY, `${distRight}`, true, obj.id || obj._id);
            }
            
            // Top distance line + label (check showDistanceTop)
            if (parseFloat(distTop) > 0.5 && obj.showDistanceTop !== false) {
              drawDistanceLine(centerX, topBoundary, centerX, objTop, `${distTop}`, false, obj.id || obj._id);
            }
            
            // Bottom distance line + label (check showDistanceBottom)
            if (parseFloat(distBottom) > 0.5 && obj.showDistanceBottom !== false) {
              drawDistanceLine(centerX, objBottom, centerX, bottomBoundary, `${distBottom}`, false, obj.id || obj._id);
            }
          }
        }
      } else if (obj.type === 'line' && !obj.isPartition) {
        // Line length label (but not for partitions)
        const dx = (obj.x2 || 0) - (obj.x1 || 0);
        const dy = (obj.y2 || 0) - (obj.y1 || 0);
        const length = Math.sqrt(dx * dx + dy * dy);
        const lengthCm = (length / pixelsPerCm).toFixed(1);
        
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
              const distCm = (distPx / pixelsPerCm).toFixed(1);
              const y = (c1y + c2y) / 2;
              drawDistanceLine(obj1.left + w1, y, obj2.left, y, `${distCm}`, true);
            }
          } else if (obj2.left + w2 < obj1.left) {
            // obj2 is to the left of obj1
            distPx = obj1.left - (obj2.left + w2);
            if (distPx > 10 * pixelsPerCm) {
              const distCm = (distPx / pixelsPerCm).toFixed(1);
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
  }, [pixelsPerCm, findRoomRect]);

  // Update dimension labels when showDimensions changes (global toggle)
  useEffect(() => {
    if (fabricRef.current) {
      if (showDimensions) {
        updateDimensionLabels();
      } else {
        // Remove all dimension labels when global toggle is off
        fabricRef.current.getObjects()
          .filter(o => o.isDimensionLabel)
          .forEach(o => fabricRef.current.remove(o));
        fabricRef.current.renderAll();
      }
    }
  }, [showDimensions, updateDimensionLabels]);

  // Update dimension labels when drawing finishes
  useEffect(() => {
    if (!isDrawing && fabricRef.current) {
      // Small delay to ensure the object is fully added
      const timer = setTimeout(() => {
        updateDimensionLabels();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isDrawing, updateDimensionLabels]);

  // Event handlers
  const handleObjectSelected = (e) => {
    const obj = e.selected?.[0];
    // Skip dimension lines - they should only be movable, not editable
    if (obj && obj.isDimensionLine) {
      setSelectedObject(null);
      return;
    }
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
        assetId: obj.assetId,
        assetName: obj.assetName,
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
        showDimensions: obj.showDimensions !== false, // Add showDimensions flag
        showDistanceLeft: obj.showDistanceLeft,
        showDistanceRight: obj.showDistanceRight,
        showDistanceTop: obj.showDistanceTop,
        showDistanceBottom: obj.showDistanceBottom,
        showElementSize: obj.showElementSize,
        showDistances: obj.showDistances,
        // Room group properties
        isRoomGroup: obj.isRoomGroup || false,
        outerWidthCm: obj.outerWidthCm || (obj.isRoomGroup ? Math.round((obj.width * (obj.scaleX || 1)) / pixelsPerCm) : null),
        outerHeightCm: obj.outerHeightCm || (obj.isRoomGroup ? Math.round((obj.height * (obj.scaleY || 1)) / pixelsPerCm) : null),
        wallLeftCm: obj.wallLeftCm,
        wallRightCm: obj.wallRightCm,
        wallTopCm: obj.wallTopCm,
        wallBottomCm: obj.wallBottomCm,
        showOuterDimensions: obj.showOuterDimensions,
        showInnerDimensions: obj.showInnerDimensions,
        // Visibility flag
        isHidden: obj.isHidden || false,
        visible: obj.visible !== false,
        // Instance identification
        instanceName: obj.instanceName || '',
      });
    }
  };

  const handleObjectModified = (e) => {
    const obj = e.target;
    if (obj && !obj.isGridLine && !obj.isDimensionLabel) {
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
      // Note: saveToHistory is called via useEffect subscription to object:modified
    }
  };

  const handleObjectMoving = (e) => {
    const obj = e.target;
    
    // Skip room groups for wall snapping
    if (obj.isRoomGroup) {
      obj.set({
        left: snapToGrid(obj.left),
        top: snapToGrid(obj.top),
      });
      updateDimensionLabels();
      return;
    }
    
    // First apply grid snap
    let newLeft = snapToGrid(obj.left);
    let newTop = snapToGrid(obj.top);
    
    // Then try to snap to room walls (inner/outer)
    const wallSnap = snapToRoomWalls(obj, newLeft, newTop);
    newLeft = wallSnap.left;
    newTop = wallSnap.top;
    
    obj.set({
      left: newLeft,
      top: newTop,
    });
    
    // Then apply object/wall snap if enabled
    if (snapToObjects) {
      const snapPoints = getSnapPoints(obj);
      applySnap(obj, snapPoints);
    }
    
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
        
        // Calculate scale based on real dimensions in CM (if provided)
        let scale = 1;
        if (asset.widthCm && asset.heightCm && pixelsPerCm) {
          // Scale to match real dimensions
          const targetWidthPx = asset.widthCm * pixelsPerCm;
          const targetHeightPx = asset.heightCm * pixelsPerCm;
          scale = Math.min(targetWidthPx / img.width, targetHeightPx / img.height);
        } else {
          // Fallback to pixel dimensions
          scale = Math.min(asset.width / img.width, asset.height / img.height, 1);
        }
        
        img.set({
          left: snapToGrid(canvasWidth / 2 - (img.width * scale) / 2),
          top: snapToGrid(canvasHeight / 2 - (img.height * scale) / 2),
          scaleX: scale,
          scaleY: scale,
          elementId: `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          elementType: asset.type,
          assetId: asset.id,
          assetName: asset.name,
          widthCm: asset.widthCm || null,
          heightCm: asset.heightCm || null,
          fixedHeightCm: asset.fixedHeight ? asset.heightCm : null,
          lockScalingY: asset.fixedHeight || false,
          lockUniScaling: !asset.fixedHeight, // If not fixed height, maintain aspect ratio
          isDrawnShape: true, // Enable dimensions for assets too
          showDimensions: true,
          showDistanceLeft: true,
          showDistanceRight: true,
          showDistanceTop: true,
          showDistanceBottom: true,
        });
        
        // Add controls - hide vertical scale controls if fixedHeight
        img.setControlsVisibility({
          mt: false,
          mb: false,
          ml: asset.fixedHeight ? true : false, // Allow horizontal resize for fixed height
          mr: asset.fixedHeight ? true : false, // Allow horizontal resize for fixed height
        });
        
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        updateDimensionLabels();
        
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

  // Flip selected object horizontally
  const flipHorizontal = () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const obj = canvas.getActiveObject();
    if (obj && !obj.isGridLine) {
      obj.set('flipX', !obj.flipX);
      canvas.renderAll();
      handleObjectSelected({ selected: [obj] });
    }
  };

  // Flip selected object vertically
  const flipVertical = () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const obj = canvas.getActiveObject();
    if (obj && !obj.isGridLine) {
      obj.set('flipY', !obj.flipY);
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
      // If this is a measurement/ruler, also delete associated parts (caps, label)
      if (obj.isMeasurement || obj.elementType === 'ruler') {
        const parentId = obj.elementId;
        const parts = canvas.getObjects().filter(o => o.parentId === parentId);
        parts.forEach(part => canvas.remove(part));
      }
      canvas.remove(obj);
      canvas.discardActiveObject();
      canvas.renderAll();
      setSelectedObject(null);
      toast.success('Элемент удален');
    }
  };

  // Add text to canvas
  const addTextToCanvas = () => {
    if (!fabricRef.current || !textInput.trim()) {
      toast.error('Введите текст');
      return;
    }
    
    const canvas = fabricRef.current;
    const text = new fabric.Text(textInput, {
      left: textClickPosition.x,
      top: textClickPosition.y,
      fontSize: textFontSize,
      fill: drawingColor,
      fontFamily: 'Arial',
      elementId: `text-${Date.now()}`,
      elementType: 'text',
      isDrawnShape: true,
      selectable: activeToolRef.current === 'select',
      evented: activeToolRef.current === 'select',
    });
    
    canvas.add(text);
    canvas.renderAll();
    setTextDialogOpen(false);
    setTextInput('');
    toast.success('Текст добавлен');
  };
  
  // Add room to canvas with specified dimensions (outer wall with thickness)
  const addRoomToCanvas = () => {
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    const { outerWidthCm, outerHeightCm, wallLeftCm, wallRightCm, wallTopCm, wallBottomCm } = roomForm;
    
    // Calculate inner dimensions
    const innerWidthCm = outerWidthCm - wallLeftCm - wallRightCm;
    const innerHeightCm = outerHeightCm - wallTopCm - wallBottomCm;
    
    // Convert to pixels
    const outerWidthPx = outerWidthCm * pixelsPerCm;
    const outerHeightPx = outerHeightCm * pixelsPerCm;
    const wallLeftPx = wallLeftCm * pixelsPerCm;
    const wallRightPx = wallRightCm * pixelsPerCm;
    const wallTopPx = wallTopCm * pixelsPerCm;
    const wallBottomPx = wallBottomCm * pixelsPerCm;
    
    // Center the room on canvas (don't snap to grid for precise positioning)
    const left = Math.round((canvasWidth - outerWidthPx) / 2);
    const top = Math.round((canvasHeight - outerHeightPx) / 2);
    
    // Create outer rectangle (wall)
    const outerRoom = new fabric.Rect({
      left,
      top,
      width: outerWidthPx,
      height: outerHeightPx,
      fill: '#8B4513', // Wall color
      stroke: '#5D3A1A',
      strokeWidth: 1,
      elementId: `room-outer-${Date.now()}`,
      elementType: 'room-outer',
      isDrawnShape: true,
      isRoom: true,
      isOuterWall: true,
      outerWidthCm,
      outerHeightCm,
      innerWidthCm,
      innerHeightCm,
      wallLeftCm,
      wallRightCm,
      wallTopCm,
      wallBottomCm,
      showDimensions: true,
      showDistanceLeft: false,
      showDistanceRight: false,
      showDistanceTop: false,
      showDistanceBottom: false,
      selectable: true,
      evented: true,
    });
    
    // Create inner rectangle (floor/interior)
    const innerRoom = new fabric.Rect({
      left: left + wallLeftPx,
      top: top + wallTopPx,
      width: outerWidthPx - wallLeftPx - wallRightPx,
      height: outerHeightPx - wallTopPx - wallBottomPx,
      fill: 'rgba(255, 248, 240, 0.7)',
      stroke: 'transparent',
      strokeWidth: 0,
      elementId: `room-inner-${Date.now()}`,
      elementType: 'room-inner',
      isDrawnShape: true,
      isRoom: true,
      isInnerRoom: true,
      parentOuterId: outerRoom.elementId,
      innerWidthCm,
      innerHeightCm,
      wallLeftCm,
      wallRightCm,
      wallTopCm,
      wallBottomCm,
      showDimensions: true,
      showDistanceLeft: true,
      showDistanceRight: true,
      showDistanceTop: true,
      showDistanceBottom: true,
      selectable: false, // Inner room moves with outer
      evented: false,
    });
    
    // Group outer and inner together
    const roomGroup = new fabric.Group([outerRoom, innerRoom], {
      left,
      top,
      elementId: `room-${Date.now()}`,
      elementType: 'room',
      isDrawnShape: true,
      isRoom: true,
      isRoomGroup: true,
      outerWidthCm,
      outerHeightCm,
      innerWidthCm,
      innerHeightCm,
      wallLeftCm,
      wallRightCm,
      wallTopCm,
      wallBottomCm,
      showDimensions: true,
      showDistanceLeft: false,
      showDistanceRight: false,
      showDistanceTop: false,
      showDistanceBottom: false,
    });
    
    canvas.add(roomGroup);
    canvas.setActiveObject(roomGroup);
    canvas.renderAll();
    updateDimensionLabels();
    
    setAddRoomDialogOpen(false);
    toast.success(`Комната: внешний ${outerWidthCm}×${outerHeightCm} см, внутренний ${innerWidthCm}×${innerHeightCm} см`);
  };
  
  // Add partition inside a room - splits room into two sections
  const addPartitionToRoom = () => {
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    
    // Find the main room (largest room or first room)
    const rooms = canvas.getObjects().filter(obj => obj.isRoom || obj.isBackground);
    if (rooms.length === 0) {
      toast.error('Сначала добавьте комнату');
      return;
    }
    
    // Use the first/main room
    const mainRoom = rooms[0];
    const roomLeft = mainRoom.left;
    const roomTop = mainRoom.top;
    const roomWidth = mainRoom.width * (mainRoom.scaleX || 1);
    const roomHeight = mainRoom.height * (mainRoom.scaleY || 1);
    
    const offsetPx = roomForm.partitionOffset * pixelsPerCm;
    const partitionThickness = 2; // Wall thickness in pixels
    
    if (roomForm.partitionPosition === 'vertical') {
      // Vertical partition - splits room left/right
      const partitionX = snapToGrid(roomLeft + offsetPx);
      
      // Create partition line
      const partition = new fabric.Line([partitionX, roomTop, partitionX, roomTop + roomHeight], {
        stroke: '#8B4513',
        strokeWidth: partitionThickness,
        elementId: `partition-${Date.now()}`,
        elementType: 'partition',
        isDrawnShape: true,
        isPartition: true,
        partitionType: 'vertical',
        offsetCm: roomForm.partitionOffset,
        selectable: true,
        hasControls: false,
        lockMovementY: true, // Can only move horizontally
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
      });
      
      canvas.add(partition);
      canvas.setActiveObject(partition);
      
      // Calculate room sizes
      const leftRoomCm = roomForm.partitionOffset;
      const rightRoomCm = Math.round(roomWidth / pixelsPerCm) - roomForm.partitionOffset;
      
      toast.success(`Перегородка добавлена: левая часть ${leftRoomCm} см, правая ${rightRoomCm} см`);
    } else {
      // Horizontal partition - splits room top/bottom
      const partitionY = snapToGrid(roomTop + offsetPx);
      
      const partition = new fabric.Line([roomLeft, partitionY, roomLeft + roomWidth, partitionY], {
        stroke: '#8B4513',
        strokeWidth: partitionThickness,
        elementId: `partition-${Date.now()}`,
        elementType: 'partition',
        isDrawnShape: true,
        isPartition: true,
        partitionType: 'horizontal',
        offsetCm: roomForm.partitionOffset,
        selectable: true,
        hasControls: false,
        lockMovementX: true, // Can only move vertically
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
      });
      
      canvas.add(partition);
      canvas.setActiveObject(partition);
      
      // Calculate room sizes
      const topRoomCm = roomForm.partitionOffset;
      const bottomRoomCm = Math.round(roomHeight / pixelsPerCm) - roomForm.partitionOffset;
      
      toast.success(`Перегородка добавлена: верхняя часть ${topRoomCm} см, нижняя ${bottomRoomCm} см`);
    }
    
    canvas.renderAll();
    updateDimensionLabels();
    setAddRoomDialogOpen(false);
  };

  // Toggle dimension display for selected object
  const toggleObjectDimensions = (value) => {
    if (!fabricRef.current) return;
    const obj = fabricRef.current.getActiveObject();
    if (obj && obj.isDrawnShape) {
      obj.showDimensions = value;
      updateDimensionLabels();
      // Update selected object state
      handleObjectSelected({ selected: [obj] });
    }
  };

  // Toggle individual distance line (left/right/top/bottom)
  const toggleDistanceLine = (direction, value) => {
    if (!fabricRef.current) return;
    const obj = fabricRef.current.getActiveObject();
    if (obj && obj.isDrawnShape) {
      const propName = `showDistance${direction.charAt(0).toUpperCase() + direction.slice(1)}`;
      obj[propName] = value;
      updateDimensionLabels();
      // Update selected object state
      handleObjectSelected({ selected: [obj] });
    }
  };

  // ============ COPY/PASTE FUNCTIONALITY ============
  const copySelected = useCallback(() => {
    if (!fabricRef.current) return;
    const activeObject = fabricRef.current.getActiveObject();
    if (!activeObject) {
      toast.error('Нет выделенного объекта');
      return;
    }
    
    // Clone the object(s) to clipboard
    activeObject.clone((cloned) => {
      clipboardRef.current = cloned;
      toast.success('Скопировано');
    });
  }, []);
  
  const pasteFromClipboard = useCallback(() => {
    if (!fabricRef.current || !clipboardRef.current) {
      toast.error('Буфер обмена пуст');
      return;
    }
    
    clipboardRef.current.clone((clonedObj) => {
      fabricRef.current.discardActiveObject();
      
      // Offset pasted object slightly
      clonedObj.set({
        left: clonedObj.left + 20,
        top: clonedObj.top + 20,
        evented: true,
      });
      
      if (clonedObj.type === 'activeSelection') {
        // Handle group paste
        clonedObj.canvas = fabricRef.current;
        clonedObj.forEachObject((obj) => {
          obj.set({
            elementId: `pasted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            selectable: true,
            evented: true,
          });
          fabricRef.current.add(obj);
        });
        clonedObj.setCoords();
      } else {
        // Single object paste
        clonedObj.set({
          elementId: `pasted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          selectable: true,
          evented: true,
        });
        fabricRef.current.add(clonedObj);
      }
      
      // Update clipboard for next paste (offset further)
      clipboardRef.current.top += 20;
      clipboardRef.current.left += 20;
      
      fabricRef.current.setActiveObject(clonedObj);
      fabricRef.current.requestRenderAll();
      updateDimensionLabels();
      saveToHistory();
      toast.success('Вставлено');
    });
  }, [updateDimensionLabels, saveToHistory]);

  // ============ GROUP/UNGROUP FUNCTIONALITY ============
  const groupSelected = useCallback(() => {
    if (!fabricRef.current) return;
    const activeObject = fabricRef.current.getActiveObject();
    
    if (!activeObject || activeObject.type !== 'activeSelection') {
      toast.error('Выделите несколько объектов для группировки');
      return;
    }
    
    // Create a group from the active selection
    const group = activeObject.toGroup();
    group.set({
      elementId: `group_${Date.now()}`,
      elementType: 'group',
      isGroup: true,
      selectable: true,
      evented: true,
    });
    
    fabricRef.current.requestRenderAll();
    saveToHistory();
    toast.success('Объекты сгруппированы');
  }, [saveToHistory]);
  
  const ungroupSelected = useCallback(() => {
    if (!fabricRef.current) return;
    const activeObject = fabricRef.current.getActiveObject();
    
    if (!activeObject || activeObject.type !== 'group') {
      toast.error('Выделите группу для разгруппировки');
      return;
    }
    
    // Ungroup
    const items = activeObject.toActiveSelection();
    fabricRef.current.requestRenderAll();
    saveToHistory();
    toast.success('Группа разбита');
  }, [saveToHistory]);

  // ============ SELECT ALL & DUPLICATE ============
  const selectAll = useCallback(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    
    // Get all selectable objects (excluding grid, dimension labels, dimension lines, etc.)
    const selectableObjects = canvas.getObjects().filter(obj => 
      !obj.isGridLine && !obj.isDimensionLabel && !obj.isDimensionLine && !obj.isGridLabel && obj.selectable !== false
    );
    
    if (selectableObjects.length === 0) {
      toast.error('Нет объектов для выделения');
      return;
    }
    
    // Create an active selection
    canvas.discardActiveObject();
    const selection = new fabric.ActiveSelection(selectableObjects, { canvas });
    canvas.setActiveObject(selection);
    canvas.requestRenderAll();
    toast.success(`Выделено ${selectableObjects.length} объектов`);
  }, []);

  const duplicateSelected = useCallback(() => {
    if (!fabricRef.current) return;
    const activeObject = fabricRef.current.getActiveObject();
    if (!activeObject) {
      toast.error('Нет выделенного объекта');
      return;
    }
    
    activeObject.clone((cloned) => {
      fabricRef.current.discardActiveObject();
      
      // Offset duplicated object
      cloned.set({
        left: cloned.left + 30,
        top: cloned.top + 30,
        evented: true,
      });
      
      if (cloned.type === 'activeSelection') {
        cloned.canvas = fabricRef.current;
        cloned.forEachObject((obj) => {
          obj.set({
            elementId: `dup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            selectable: true,
            evented: true,
          });
          fabricRef.current.add(obj);
        });
        cloned.setCoords();
      } else {
        cloned.set({
          elementId: `dup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          selectable: true,
          evented: true,
        });
        fabricRef.current.add(cloned);
      }
      
      fabricRef.current.setActiveObject(cloned);
      fabricRef.current.requestRenderAll();
      updateDimensionLabels();
      saveToHistory();
      toast.success('Продублировано');
    });
  }, [updateDimensionLabels, saveToHistory]);

  // ============ ALIGNMENT FUNCTIONS ============
  const alignObjects = useCallback((alignment) => {
    if (!fabricRef.current) return;
    const activeObject = fabricRef.current.getActiveObject();
    
    if (!activeObject || activeObject.type !== 'activeSelection') {
      toast.error('Выделите несколько объектов для выравнивания');
      return;
    }
    
    const objects = activeObject.getObjects();
    if (objects.length < 2) {
      toast.error('Нужно минимум 2 объекта');
      return;
    }
    
    // Get bounding box of all selected objects
    const bounds = activeObject.getBoundingRect();
    
    objects.forEach(obj => {
      const objBounds = obj.getBoundingRect(true);
      
      switch (alignment) {
        case 'left':
          obj.set('left', obj.left - (objBounds.left - bounds.left));
          break;
        case 'center-h':
          const centerX = bounds.left + bounds.width / 2;
          obj.set('left', obj.left + (centerX - (objBounds.left + objBounds.width / 2)));
          break;
        case 'right':
          obj.set('left', obj.left + ((bounds.left + bounds.width) - (objBounds.left + objBounds.width)));
          break;
        case 'top':
          obj.set('top', obj.top - (objBounds.top - bounds.top));
          break;
        case 'center-v':
          const centerY = bounds.top + bounds.height / 2;
          obj.set('top', obj.top + (centerY - (objBounds.top + objBounds.height / 2)));
          break;
        case 'bottom':
          obj.set('top', obj.top + ((bounds.top + bounds.height) - (objBounds.top + objBounds.height)));
          break;
        default:
          break;
      }
      obj.setCoords();
    });
    
    activeObject.setCoords();
    fabricRef.current.requestRenderAll();
    updateDimensionLabels();
    saveToHistory();
    
    const alignNames = {
      'left': 'по левому краю',
      'center-h': 'по центру горизонтально',
      'right': 'по правому краю',
      'top': 'по верхнему краю',
      'center-v': 'по центру вертикально',
      'bottom': 'по нижнему краю',
    };
    toast.success(`Выровнено ${alignNames[alignment]}`);
  }, [updateDimensionLabels, saveToHistory]);

  const distributeObjects = useCallback((direction) => {
    if (!fabricRef.current) return;
    const activeObject = fabricRef.current.getActiveObject();
    
    if (!activeObject || activeObject.type !== 'activeSelection') {
      toast.error('Выделите несколько объектов для распределения');
      return;
    }
    
    const objects = activeObject.getObjects();
    if (objects.length < 3) {
      toast.error('Нужно минимум 3 объекта для распределения');
      return;
    }
    
    // Sort objects by position
    const sorted = [...objects].sort((a, b) => {
      if (direction === 'horizontal') {
        return a.left - b.left;
      }
      return a.top - b.top;
    });
    
    // Calculate total space and distribute
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    
    if (direction === 'horizontal') {
      const firstCenter = first.left + (first.width * first.scaleX) / 2;
      const lastCenter = last.left + (last.width * last.scaleX) / 2;
      const totalSpace = lastCenter - firstCenter;
      const spacing = totalSpace / (sorted.length - 1);
      
      sorted.forEach((obj, index) => {
        if (index > 0 && index < sorted.length - 1) {
          const newCenter = firstCenter + spacing * index;
          obj.set('left', newCenter - (obj.width * obj.scaleX) / 2);
          obj.setCoords();
        }
      });
    } else {
      const firstCenter = first.top + (first.height * first.scaleY) / 2;
      const lastCenter = last.top + (last.height * last.scaleY) / 2;
      const totalSpace = lastCenter - firstCenter;
      const spacing = totalSpace / (sorted.length - 1);
      
      sorted.forEach((obj, index) => {
        if (index > 0 && index < sorted.length - 1) {
          const newCenter = firstCenter + spacing * index;
          obj.set('top', newCenter - (obj.height * obj.scaleY) / 2);
          obj.setCoords();
        }
      });
    }
    
    activeObject.setCoords();
    fabricRef.current.requestRenderAll();
    updateDimensionLabels();
    saveToHistory();
    toast.success(direction === 'horizontal' ? 'Распределено по горизонтали' : 'Распределено по вертикали');
  }, [updateDimensionLabels, saveToHistory]);

  // ============ SNAP TO OBJECTS ============
  const getSnapPoints = useCallback((movingObj) => {
    if (!fabricRef.current || !snapToObjects) return [];
    
    const canvas = fabricRef.current;
    const snapPoints = [];
    
    // Add canvas boundaries (walls)
    snapPoints.push(
      { x: 0, y: null, type: 'wall-left' },
      { x: canvasWidth, y: null, type: 'wall-right' },
      { x: null, y: 0, type: 'wall-top' },
      { x: null, y: canvasHeight, type: 'wall-bottom' },
    );
    
    // Add center lines
    snapPoints.push(
      { x: canvasWidth / 2, y: null, type: 'center-v' },
      { x: null, y: canvasHeight / 2, type: 'center-h' },
    );
    
    // Add snap points from other objects
    canvas.getObjects().forEach(obj => {
      if (obj === movingObj || obj.isGridLine || obj.isDimensionLabel || obj.isGridLabel) return;
      
      const bound = obj.getBoundingRect();
      
      // Left, center, right edges
      snapPoints.push(
        { x: bound.left, y: null, type: 'obj-left' },
        { x: bound.left + bound.width / 2, y: null, type: 'obj-center-x' },
        { x: bound.left + bound.width, y: null, type: 'obj-right' },
      );
      
      // Top, center, bottom edges
      snapPoints.push(
        { x: null, y: bound.top, type: 'obj-top' },
        { x: null, y: bound.top + bound.height / 2, type: 'obj-center-y' },
        { x: null, y: bound.top + bound.height, type: 'obj-bottom' },
      );
    });
    
    return snapPoints;
  }, [snapToObjects, canvasWidth, canvasHeight]);

  const applySnap = useCallback((obj, snapPoints) => {
    if (!snapToObjects || !obj) return { snappedX: false, snappedY: false };
    
    const bound = obj.getBoundingRect();
    const objEdges = {
      left: bound.left,
      centerX: bound.left + bound.width / 2,
      right: bound.left + bound.width,
      top: bound.top,
      centerY: bound.top + bound.height / 2,
      bottom: bound.top + bound.height,
    };
    
    let snappedX = false;
    let snappedY = false;
    let snapOffsetX = 0;
    let snapOffsetY = 0;
    
    // Check X snap
    for (const point of snapPoints) {
      if (point.x !== null) {
        for (const edge of ['left', 'centerX', 'right']) {
          const diff = Math.abs(objEdges[edge] - point.x);
          if (diff < snapDistance && !snappedX) {
            snapOffsetX = point.x - objEdges[edge];
            snappedX = true;
            break;
          }
        }
      }
    }
    
    // Check Y snap
    for (const point of snapPoints) {
      if (point.y !== null) {
        for (const edge of ['top', 'centerY', 'bottom']) {
          const diff = Math.abs(objEdges[edge] - point.y);
          if (diff < snapDistance && !snappedY) {
            snapOffsetY = point.y - objEdges[edge];
            snappedY = true;
            break;
          }
        }
      }
    }
    
    if (snappedX || snappedY) {
      obj.set({
        left: obj.left + snapOffsetX,
        top: obj.top + snapOffsetY,
      });
      obj.setCoords();
    }
    
    return { snappedX, snappedY };
  }, [snapToObjects, snapDistance]);

  // ============ KEYBOARD SHORTCUTS ============
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Ctrl+Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }
      
      // Ctrl+A - Select All
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }
      
      // Ctrl+D - Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      
      // Ctrl+C - Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        copySelected();
        return;
      }
      
      // Ctrl+V - Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteFromClipboard();
        return;
      }
      
      // Ctrl+G - Group
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        groupSelected();
        return;
      }
      
      // Ctrl+Shift+G - Ungroup
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        ungroupSelected();
        return;
      }
      
      // Delete or Backspace - Delete selected object
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
        return;
      }
      
      // Escape - Deselect / Switch to select tool
      if (e.key === 'Escape') {
        e.preventDefault();
        setActiveTool('select');
        if (fabricRef.current) {
          fabricRef.current.discardActiveObject();
          fabricRef.current.renderAll();
        }
        setSelectedObject(null);
        return;
      }
      
      // Tool shortcuts (only when not using Ctrl/Cmd)
      if (!e.ctrlKey && !e.metaKey) {
        if (e.key === 'v' || e.key === 'V') {
          setActiveTool('select');
        } else if (e.key === 'r' || e.key === 'R') {
          setActiveTool('rectangle');
        } else if (e.key === 'l' || e.key === 'L') {
          setActiveTool('wall');
        } else if (e.key === 'm' || e.key === 'M') {
          setActiveTool('ruler');
        } else if (e.key === 't' || e.key === 'T') {
          setActiveTool('text');
        } else if (e.key === 'g' || e.key === 'G') {
          // G without Ctrl - just group (not ungroup)
          groupSelected();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, deleteSelected, copySelected, pasteFromClipboard, groupSelected, ungroupSelected, selectAll, duplicateSelected]);

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
      // Add real dimensions in cm if provided
      if (uploadForm.widthCm) {
        formData.append('widthCm', uploadForm.widthCm);
      }
      if (uploadForm.heightCm) {
        formData.append('heightCm', uploadForm.heightCm);
      }
      // Add fixed height flag (for benches etc.)
      if (uploadForm.fixedHeight) {
        formData.append('fixedHeight', 'true');
      }
      
      const res = await fetch(`${API_URL}/api/layout-configurator/assets`, {
        method: 'POST',
        body: formData,
      });
      
      if (res.ok) {
        toast.success('Элемент загружен!');
        setUploadAssetDialogOpen(false);
        setUploadForm({ name: '', type: 'other', modelId: null, file: null, widthCm: '', heightCm: '', fixedHeight: false });
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
      if (selectedVariant) {
        formData.append('variantId', selectedVariant.id);
        formData.append('variantName', selectedVariant.nameRu || selectedVariant.namePl || selectedVariant.name);
      }
      formData.append('canvasWidth', canvasWidth.toString());
      formData.append('canvasHeight', canvasHeight.toString());
      // Get canvas state for template loading (excluding grid and dimension elements)
      const userObjects = canvas.getObjects().filter(obj => 
        !obj.isGridLine && !obj.isGridLabel && !obj.isDimensionLabel && !obj.isDimensionLine
      );
      const canvasState = {
        version: '5.3.0',
        objects: userObjects.map(obj => obj.toObject([
          'elementId', 'elementType', 'isDrawnShape', 'strokeWidthCm', 
          'isMeasurement', 'isMeasurementPart', 'parentId', 'isRuler',
          'showDimensions', 'showDistanceLeft', 'showDistanceRight', 'showDistanceTop', 'showDistanceBottom',
          'assetId', 'assetName', 'isGroup', 'isModelOutline', 'isOutline',
          'widthCm', 'heightCm', 'flipX', 'flipY',
          'isRoom', 'isRoomGroup', 'isOuterWall', 'isInnerRoom', 'isPartition', 'partitionType', 'offsetCm',
          'outerWidthCm', 'outerHeightCm', 'innerWidthCm', 'innerHeightCm',
          'wallLeftCm', 'wallRightCm', 'wallTopCm', 'wallBottomCm', 'wallThicknessCm',
          'showOuterDimensions', 'showInnerDimensions',
          'showElementSize', 'showDistances',
          'lockScalingY', 'fixedHeightCm',
          'left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'angle'
        ])),
        background: canvas.backgroundColor,
      };
      
      formData.append('elements', JSON.stringify(elements));
      formData.append('canvasState', JSON.stringify(canvasState));
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

  // Quick update current layout (without dialog)
  const handleQuickUpdateLayout = async () => {
    if (!fabricRef.current || !currentLayout) {
      toast.error('Нет загруженной планировки для обновления');
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
            isHidden: obj.isHidden || false,
          });
        }
      });
      
      // Get canvas state
      const userObjects = canvas.getObjects().filter(obj => 
        !obj.isGridLine && !obj.isGridLabel && !obj.isDimensionLabel && !obj.isDimensionLine
      );
      const canvasState = {
        version: '5.3.0',
        objects: userObjects.map(obj => obj.toObject([
          'elementId', 'elementType', 'isDrawnShape', 'strokeWidthCm', 
          'isMeasurement', 'isMeasurementPart', 'parentId', 'isRuler',
          'showDimensions', 'showDistanceLeft', 'showDistanceRight', 'showDistanceTop', 'showDistanceBottom',
          'assetId', 'assetName', 'isGroup', 'isModelOutline', 'isOutline',
          'widthCm', 'heightCm', 'flipX', 'flipY', 'isHidden',
          'isRoom', 'isRoomGroup', 'isOuterWall', 'isInnerRoom', 'isPartition', 'partitionType', 'offsetCm',
          'outerWidthCm', 'outerHeightCm', 'innerWidthCm', 'innerHeightCm',
          'wallLeftCm', 'wallRightCm', 'wallTopCm', 'wallBottomCm', 'wallThicknessCm',
          'showOuterDimensions', 'showInnerDimensions',
          'showElementSize', 'showDistances',
          'lockScalingY', 'fixedHeightCm',
          'left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'angle'
        ])),
        background: canvas.backgroundColor,
      };
      
      const updateData = {
        canvasWidth,
        canvasHeight,
        elements,
        canvasState,
      };
      
      const res = await fetch(`${API_URL}/api/layout-configurator/layouts/${currentLayout.id}/data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      
      if (res.ok) {
        toast.success('Планировка обновлена!');
        fetchLayouts(selectedModel?.id, selectedVariant?.id);
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Ошибка обновления');
      }
    } catch (error) {
      toast.error('Ошибка при обновлении');
    }
    setLoading(false);
  };

  // Clone layout to another model
  const handleCloneLayout = async () => {
    if (!cloneLayoutForm.sourceLayoutId || !cloneLayoutForm.targetModelId) {
      toast.error('Выберите исходную планировку и целевую модель');
      return;
    }
    
    setLoading(true);
    try {
      const targetModel = saunaModels.find(m => m.id === cloneLayoutForm.targetModelId);
      const targetVariant = targetModel?.variants?.find(v => v.id === cloneLayoutForm.targetVariantId);
      
      // Calculate scale if autoScale enabled
      let scaleX = cloneLayoutForm.scaleX;
      let scaleY = cloneLayoutForm.scaleY;
      
      if (cloneLayoutForm.autoScale && selectedModel && targetModel) {
        // Try to extract size from model name (e.g., "235x200" -> 235, 200)
        const sourceMatch = selectedModel.name?.match(/(\d+)[x×](\d+)/);
        const targetMatch = targetModel.name?.match(/(\d+)[x×](\d+)/);
        
        if (sourceMatch && targetMatch) {
          const sourceWidth = parseInt(sourceMatch[1]);
          const sourceHeight = parseInt(sourceMatch[2]);
          const targetWidth = parseInt(targetMatch[1]);
          const targetHeight = parseInt(targetMatch[2]);
          
          scaleX = targetWidth / sourceWidth;
          scaleY = targetHeight / sourceHeight;
        }
      }
      
      const formData = new FormData();
      formData.append('targetModelId', cloneLayoutForm.targetModelId);
      formData.append('targetModelName', targetModel?.name || '');
      if (cloneLayoutForm.targetVariantId) {
        formData.append('targetVariantId', cloneLayoutForm.targetVariantId);
        formData.append('targetVariantName', targetVariant?.nameRu || targetVariant?.namePl || targetVariant?.name || '');
      }
      if (cloneLayoutForm.newName) {
        formData.append('newName', cloneLayoutForm.newName);
      }
      formData.append('scaleX', scaleX.toString());
      formData.append('scaleY', scaleY.toString());
      
      const res = await fetch(`${API_URL}/api/layout-configurator/layouts/${cloneLayoutForm.sourceLayoutId}/clone`, {
        method: 'POST',
        body: formData,
      });
      
      if (res.ok) {
        const result = await res.json();
        toast.success(`Планировка клонирована! Масштаб: ${scaleX.toFixed(2)}x${scaleY.toFixed(2)}`);
        setCloneLayoutDialogOpen(false);
        setCloneLayoutForm({
          sourceLayoutId: '',
          sourceLayoutName: '',
          targetModelId: '',
          targetVariantId: '',
          newName: '',
          autoScale: true,
          scaleX: 1.0,
          scaleY: 1.0,
        });
        // Refresh layouts if we're viewing the target model
        if (selectedModel?.id === cloneLayoutForm.targetModelId) {
          fetchLayouts(selectedModel?.id, selectedVariant?.id);
        }
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Ошибка клонирования');
      }
    } catch (error) {
      console.error('Clone error:', error);
      toast.error('Ошибка при клонировании планировки');
    }
    setLoading(false);
  };

  // Open clone dialog with current layout
  const openCloneLayoutDialog = (layout = null) => {
    const sourceLayout = layout || currentLayout;
    if (!sourceLayout) {
      toast.error('Сначала загрузите или выберите планировку');
      return;
    }
    setCloneLayoutForm({
      sourceLayoutId: sourceLayout.id,
      sourceLayoutName: sourceLayout.name || sourceLayout.namePl || sourceLayout.nameRu,
      targetModelId: '',
      targetVariantId: '',
      newName: '',
      autoScale: true,
      scaleX: 1.0,
      scaleY: 1.0,
    });
    setCloneLayoutDialogOpen(true);
  };

  // Load layout
  const handleLoadLayout = async (layout) => {
    if (!fabricRef.current) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/layout-configurator/layouts/${layout.id}`);
      if (!res.ok) throw new Error('Layout not found');
      
      const data = await res.json();
      const canvas = fabricRef.current;
      
      // Set canvas size
      setCanvasWidth(data.canvasWidth || 800);
      setCanvasHeight(data.canvasHeight || 400);
      
      // Find and set model
      const model = saunaModels.find(m => m.id === data.modelId);
      if (model) setSelectedModel(model);
      
      // If we have canvasState, use it (includes rooms and all objects)
      if (data.canvasState) {
        // Clear existing user objects (keep grid)
        const objectsToRemove = canvas.getObjects().filter(obj => 
          !obj.isGridLine && !obj.isGridLabel
        );
        objectsToRemove.forEach(obj => canvas.remove(obj));
        
        const state = typeof data.canvasState === 'string' 
          ? JSON.parse(data.canvasState) 
          : data.canvasState;
        
        canvas.loadFromJSON(state, () => {
          // Re-apply interactivity settings
          canvas.getObjects().forEach(obj => {
            if (obj.isGridLine || obj.isGridLabel || obj.isDimensionLabel) {
              obj.selectable = false;
              obj.evented = false;
            } else if (obj.isOutline) {
              obj.selectable = false;
              obj.evented = false;
            } else {
              obj.selectable = true;
              obj.evented = true;
              obj.hoverCursor = 'move';
            }
          });
          
          // Redraw grid
          drawGrid();
          canvas.requestRenderAll();
        });
      } else {
        // Fallback: Load elements only (legacy layouts)
        clearCanvas();
        for (const el of data.elements || []) {
          const asset = assets.find(a => a.id === el.assetId);
          if (asset) {
            await loadElementToCanvas(asset, el);
          }
        }
      }
      
      setCurrentLayout(data);
      setLayoutName(data.name);
      setLoadDialogOpen(false);
      toast.success(`Загружена: "${data.name}"`);
    } catch (error) {
      console.error('Error loading layout:', error);
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
    
    // Temporarily fully hide elements with isHidden flag
    const hiddenElements = fabricRef.current.getObjects().filter(o => o.isHidden);
    const hiddenElementsState = hiddenElements.map(el => ({ el, opacity: el.opacity }));
    hiddenElements.forEach(el => el.set('opacity', 0));
    
    fabricRef.current.renderAll();
    
    // Export
    const dataURL = fabricRef.current.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
    });
    
    // Restore grid
    gridLines.forEach(line => line.set('visible', showGrid));
    
    // Restore hidden elements opacity
    hiddenElementsState.forEach(({ el, opacity }) => el.set('opacity', opacity));
    
    fabricRef.current.renderAll();
    
    // Download
    const link = document.createElement('a');
    link.download = `layout-${currentLayout?.name || 'export'}-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    
    toast.success('Изображение экспортировано');
  };

  // Export canvas to base64 for saving
  const exportCanvasToBase64 = () => {
    if (!fabricRef.current) return null;
    
    // Temporarily hide grid
    const gridLines = fabricRef.current.getObjects().filter(o => o.isGridLine || o.isGridLabel);
    gridLines.forEach(line => line.set('visible', false));
    
    // Temporarily fully hide elements with isHidden flag
    const hiddenElements = fabricRef.current.getObjects().filter(o => o.isHidden);
    const hiddenElementsState = hiddenElements.map(el => ({ el, opacity: el.opacity }));
    hiddenElements.forEach(el => el.set('opacity', 0));
    
    fabricRef.current.renderAll();
    
    // Export
    const dataURL = fabricRef.current.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
    });
    
    // Restore grid
    gridLines.forEach(line => line.set('visible', showGrid));
    
    // Restore hidden elements opacity
    hiddenElementsState.forEach(({ el, opacity }) => el.set('opacity', opacity));
    
    fabricRef.current.renderAll();
    
    // Return base64 without data:image/png;base64, prefix
    return dataURL.split(',')[1];
  };

  // Publish layout with export
  const handlePublishWithExport = async (layout) => {
    if (!layout) return;
    
    setLoading(true);
    try {
      // First export the image if this layout is currently loaded
      if (currentLayout?.id === layout.id && fabricRef.current) {
        const imageData = exportCanvasToBase64();
        if (imageData) {
          const formData = new FormData();
          formData.append('imageData', imageData);
          
          await fetch(`${API_URL}/api/layout-configurator/layouts/${layout.id}/export`, {
            method: 'POST',
            body: formData,
          });
        }
      }
      
      // Then publish
      const endpoint = layout.isPublished ? 'unpublish' : 'publish';
      const res = await fetch(`${API_URL}/api/layout-configurator/layouts/${layout.id}/${endpoint}`, {
        method: 'POST',
      });
      
      if (res.ok) {
        toast.success(layout.isPublished ? 'Планировка скрыта из каталога' : 'Планировка опубликована в каталог!');
        fetchLayouts();
      }
    } catch (error) {
      toast.error('Ошибка публикации');
    }
    setLoading(false);
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

  // Filter assets by selected model (show global + model-specific)
  const filteredAssets = assets.filter(asset => {
    // Show asset if:
    // 1. It's a global asset (no modelId)
    // 2. Or it belongs to the selected model
    if (!asset.modelId) return true;
    if (selectedModel && asset.modelId === selectedModel.id) return true;
    return false;
  });

  // Group assets by type
  const assetsByType = filteredAssets.reduce((acc, asset) => {
    if (!acc[asset.type]) acc[asset.type] = [];
    acc[asset.type].push(asset);
    return acc;
  }, {});

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4 overflow-hidden">
      {/* Left Panel - Settings & Elements - SCROLLABLE */}
      <div className="w-80 flex-shrink-0 overflow-y-auto h-full">
        <div className="flex flex-col gap-2 pr-1">
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
                        {variant.nameRu || variant.namePl || variant.name || `Вариант ${variant.id}`}
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
              
              {/* Current layout info & update button */}
              {currentLayout && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs bg-green-100 hover:bg-green-200 text-green-800"
                  onClick={handleQuickUpdateLayout}
                  disabled={loading}
                  title={`Обновить: ${currentLayout.name}`}
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Обновить
                </Button>
              )}
              
              <Button
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => {
                  if (selectedModel) {
                    setLayoutName(currentLayout?.name || `${selectedModel.name}${selectedVariant ? ` - ${selectedVariant.nameRu || selectedVariant.namePl || selectedVariant.name}` : ''} - Планировка`);
                    setSaveDialogOpen(true);
                  } else {
                    toast.error('Сначала выберите модель сауны');
                  }
                }}
              >
                <Save className="h-3 w-3 mr-1" />
                {currentLayout ? 'Сохранить как...' : 'Сохранить'}
              </Button>
              
              {/* Save to Order button - only when orderId is provided */}
              {orderId && (
                <Button
                  size="sm"
                  className="h-7 text-xs bg-green-600 hover:bg-green-700"
                  onClick={saveLayoutToOrder}
                  disabled={loading}
                  data-testid="save-layout-to-order-btn"
                >
                  {loading ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  В заказ
                </Button>
              )}
            </div>
            
            {/* Current layout indicator */}
            {currentLayout && (
              <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-blue-700">Редактируется:</span>
                  <span className="text-blue-600 truncate max-w-[150px]">{currentLayout.name}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 px-1 text-blue-600 hover:text-blue-800"
                  onClick={() => {
                    setCurrentLayout(null);
                    toast.info('Создание новой планировки');
                  }}
                  title="Создать новую планировку"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Elements Card */}
        <Card className="flex-1 flex flex-col overflow-hidden min-h-[500px]">
          <CardHeader className="py-3 px-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Элементы</CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={() => setUploadAssetDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Добавить
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 flex-1 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-3 mb-3 h-9">
                <TabsTrigger value="elements" className="text-xs">Библиотека</TabsTrigger>
                <TabsTrigger value="layouts" className="text-xs">Планировки</TabsTrigger>
                <TabsTrigger value="variants" className="text-xs">Варианты</TabsTrigger>
              </TabsList>
              
              <TabsContent value="elements" className="mt-0">
                {Object.entries(assetsByType).map(([type, typeAssets]) => (
                  <div key={type} className="mb-4">
                    <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                      <span className="text-lg">{ELEMENT_TYPES[type]?.icon}</span>
                      <span>{ELEMENT_TYPES[type]?.name || type}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {typeAssets.map(asset => (
                        <div
                          key={asset.id}
                          className={`group relative aspect-square bg-muted rounded-lg border-2 cursor-pointer hover:border-primary hover:shadow-md transition-all ${
                            asset.modelId ? 'ring-1 ring-blue-300' : ''
                          }`}
                          onClick={() => addElementToCanvas(asset)}
                          title={`Нажмите чтобы добавить: ${asset.name}${asset.modelId ? ' (для этой модели)' : ' (глобальный)'}`}
                        >
                          {asset.modelId && (
                            <div className="absolute top-1 left-1 bg-blue-500 text-white text-[8px] px-1 rounded z-10">
                              MODEL
                            </div>
                          )}
                          <img
                            src={asset.imageUrl.startsWith('http') ? asset.imageUrl : `${API_URL}${asset.imageUrl}`}
                            alt={asset.name}
                            className="w-full h-full object-contain p-2"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 rounded-b-lg truncate">
                            {asset.name}
                          </div>
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
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
                
                {/* Show filter status */}
                {selectedModel && filteredAssets.length > 0 && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 mb-2">
                    Elementy dla: <strong>{selectedModel.name}</strong> + globalne
                  </div>
                )}
                
                {filteredAssets.length === 0 && assets.length > 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <p>Brak elementów dla wybranego modelu</p>
                    <p className="text-xs mt-1">Globalne elementy i elementy dla "{selectedModel?.name || 'модели'}" będą widoczne</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setUploadAssetDialogOpen(true)}
                    >
                      Dodaj element
                    </Button>
                  </div>
                )}
                
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
                  {/* Show hint if no model selected */}
                  {!selectedModel && layouts.length > 0 && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                      Wybierz model, żeby zobaczyć planowki dla tego modelu
                    </div>
                  )}
                  
                  {/* Show current filter */}
                  {selectedModel && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 flex items-center justify-between">
                      <span>
                        Planowki dla: <strong>{selectedModel.name}</strong>
                        {selectedVariant && <> / {selectedVariant.nameRu || selectedVariant.namePl || selectedVariant.name}</>}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 text-xs px-1"
                        onClick={() => {
                          setSelectedModel(null);
                          setSelectedVariant(null);
                          fetchLayouts();
                          fetchLayoutOptions();
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  
                  {layouts.map(layout => (
                    <div
                      key={layout.id}
                      className="p-2 border rounded hover:bg-muted/50 group"
                    >
                      <div className="flex items-center justify-between">
                        <span 
                          className="text-sm font-medium truncate cursor-pointer hover:text-primary"
                          onClick={() => handleLoadLayout(layout)}
                          title="Редактировать планировку"
                        >
                          {layout.name}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            title="Использовать как шаблон"
                            onClick={(e) => {
                              e.stopPropagation();
                              loadTemplateLayout(layout);
                            }}
                          >
                            <FileInput className="h-3 w-3" />
                          </Button>
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
                          {isAdminMode && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-blue-600 hover:text-blue-700"
                              title="Клонировать для другой модели"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCloneLayoutDialog(layout);
                              }}
                            >
                              <CopyPlus className="h-3 w-3" />
                            </Button>
                          )}
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
              
              {/* Variants Tab */}
              <TabsContent value="variants" className="mt-0">
                <div className="space-y-3">
                  {/* Show hint if no model selected */}
                  {!selectedModel && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                      Wybierz model, żeby zobaczyć warianty dla tego modelu
                    </div>
                  )}
                  
                  {/* Show current filter */}
                  {selectedModel && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                      <span>
                        Warianty dla: <strong>{selectedModel.name}</strong>
                        {selectedVariant && <> / {selectedVariant.nameRu || selectedVariant.namePl || selectedVariant.name}</>}
                      </span>
                    </div>
                  )}
                  
                  {/* Apply all calculator variants button */}
                  {calculatorSelections && layoutOptions.some(opt => 
                    opt.variants?.some(v => v.calculatorMapping && 
                      calculatorSelections[v.calculatorMapping.categoryId] === v.calculatorMapping.optionId
                    )
                  ) && (
                    <Button
                      size="sm"
                      className="w-full h-8 text-xs bg-green-600 hover:bg-green-700"
                      onClick={applyAllCalculatorVariants}
                      data-testid="apply-all-calculator-variants-btn"
                    >
                      <Calculator className="h-3 w-3 mr-1" />
                      Применить все из калькулятора
                    </Button>
                  )}
                  
                  {/* Create new option button - ADMIN ONLY */}
                  {isAdminMode && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs"
                      onClick={() => setCreateOptionDialogOpen(true)}
                      disabled={!selectedModel}
                      title={!selectedModel ? 'Najpierw wybierz model' : 'Dodaj nową opcję'}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Nowa opcja
                    </Button>
                  )}
                  
                  {/* Save selected element as variant - ADMIN ONLY */}
                  {isAdminMode && selectedObject && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full h-8 text-xs"
                      onClick={() => {
                        if (layoutOptions.length === 0) {
                          toast.error('Сначала создайте опцию');
                          return;
                        }
                        setNewVariantForm({ ...newVariantForm, optionId: layoutOptions[0]?.id || '' });
                        setSaveVariantDialogOpen(true);
                      }}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Zapisz jako wariant
                    </Button>
                  )}
                  
                  {/* Copy option button - ADMIN ONLY */}
                  {isAdminMode && layoutOptions.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs"
                      onClick={() => {
                        setCopyOptionForm({ sourceOptionId: 'all', targetModelId: '', targetVariantId: '' });
                        setCopyOptionDialogOpen(true);
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Kopiuj opcje do innego modelu
                    </Button>
                  )}
                  
                  {/* Show hidden variants toggle - ADMIN ONLY */}
                  {isAdminMode && layoutOptions.some(opt => opt.variants?.some(v => !isVariantVisible(v))) && (
                    <Button
                      size="sm"
                      variant={showHiddenVariants ? "default" : "outline"}
                      className={`w-full h-8 text-xs ${showHiddenVariants ? 'bg-red-500 hover:bg-red-600' : 'text-red-500 border-red-200 hover:bg-red-50'}`}
                      onClick={() => setShowHiddenVariants(!showHiddenVariants)}
                    >
                      {showHiddenVariants ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                      {showHiddenVariants ? 'Ukryj niedostępne' : 'Pokaż ukryte warianty'}
                    </Button>
                  )}
                  
                  {/* Options list */}
                  {layoutOptions.map(option => (
                    <div key={option.id} className="border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between bg-muted px-2 py-1.5">
                        <span className="text-xs font-medium">{option.namePl || option.name}</span>
                        {/* Admin controls for option - ADMIN ONLY */}
                        {isAdminMode && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5"
                              title="Edytuj opcję"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditOptionForm({
                                  id: option.id,
                                  name: option.name,
                                  namePl: option.namePl || option.name,
                                  nameRu: option.nameRu || '',
                                });
                                setEditOptionDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-3 w-3 text-amber-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5"
                              title="Kopiuj opcję do innego modelu"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCopyOptionForm({ sourceOptionId: option.id, targetModelId: '', targetVariantId: '' });
                                setCopyOptionDialogOpen(true);
                              }}
                            >
                              <Copy className="h-3 w-3 text-blue-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5"
                              onClick={() => deleteLayoutOption(option.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="p-1.5 space-y-1">
                        {option.variants?.filter(v => showHiddenVariants || isVariantVisible(v)).map(variant => {
                          const isHiddenByConditions = !isVariantVisible(variant);
                          // Check if this variant matches calculator selection
                          const matchesCalculator = calculatorSelections && variant.calculatorMapping && 
                            calculatorSelections[variant.calculatorMapping.categoryId] === variant.calculatorMapping.optionId;
                          return (
                          <div
                            key={variant.id}
                            className={`flex items-center justify-between p-1.5 rounded text-xs cursor-pointer hover:bg-muted/80 transition-colors ${
                              selectedVariants[option.id] === variant.id ? 'bg-primary/10 border border-primary/30' : 
                              matchesCalculator ? 'bg-green-50 border border-green-300' :
                              isHiddenByConditions ? 'bg-red-50 border border-red-200 opacity-70' : 'bg-muted/30'
                            }`}
                            onClick={() => applyVariant(option.id, variant)}
                            title={matchesCalculator ? 'Соответствует выбору в калькуляторе' : ''}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                {matchesCalculator && (
                                  <Calculator className="h-3 w-3 text-green-600 flex-shrink-0" />
                                )}
                                {isHiddenByConditions && (
                                  <EyeOff className="h-3 w-3 text-red-400 flex-shrink-0" />
                                )}
                                <span className="truncate block">{variant.namePl || variant.name}</span>
                              </div>
                              {variant.conditions?.length > 0 && (
                                <span className={`text-[9px] truncate block ${isHiddenByConditions ? 'text-red-500' : 'text-amber-600'}`}>
                                  {variant.conditions.map(c => {
                                    const opt = layoutOptions.find(o => o.id === c.optionId);
                                    const v = opt?.variants?.find(v => v.id === c.variantId);
                                    const conditionMet = selectedVariants[c.optionId] === c.variantId;
                                    return (
                                      <span key={`${c.optionId}-${c.variantId}`} className={conditionMet ? 'text-green-600' : ''}>
                                        {v?.namePl || v?.name || '???'}
                                      </span>
                                    );
                                  }).reduce((prev, curr, i) => i === 0 ? [curr] : [...prev, ' + ', curr], [])}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 ml-1">
                              <span className="text-[10px] text-muted-foreground">
                                {variant.elementConfigs?.length || 0}
                              </span>
                              {/* Variant edit/delete buttons - ADMIN ONLY */}
                              {isAdminMode && (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-4 w-4"
                                    title="Edytuj wariant"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Apply variant first to load its configuration
                                      applyVariant(option.id, variant);
                                      // Open edit dialog
                                      setEditVariantForm({
                                        optionId: option.id,
                                        variantId: variant.id,
                                        name: variant.name,
                                        namePl: variant.namePl || variant.name,
                                        nameRu: variant.nameRu || '',
                                        elementConfigs: variant.elementConfigs || [],
                                        conditions: variant.conditions || [],
                                        calculatorMapping: variant.calculatorMapping || null,
                                      });
                                      setEditVariantDialogOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-2.5 w-2.5 text-amber-600" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-4 w-4"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteVariant(option.id, variant.id);
                                    }}
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        )})}
                        {/* Show hidden variants toggle - ADMIN ONLY */}
                        {isAdminMode && !showHiddenVariants && option.variants?.filter(v => !isVariantVisible(v)).length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-6 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setShowHiddenVariants(true)}
                          >
                            <EyeOff className="h-3 w-3 mr-1" />
                            Pokaż {option.variants.filter(v => !isVariantVisible(v)).length} ukrytych
                          </Button>
                        )}
                        {(!option.variants || option.variants.length === 0) && (
                          <div className="text-[10px] text-muted-foreground text-center py-2">
                            Brak wariantów
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {layoutOptions.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      <p className="mb-2">Brak opcji konfiguracji</p>
                      <p className="text-[10px]">
                        Utwórz opcję (np. "Typ pieca"), potem zapisz warianty dla elementów
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        </div>
      </div>
      
      {/* Center - Canvas - FIXED HEIGHT */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Drawing Toolbar - Two rows */}
        <Card className="mb-2">
          <CardContent className="p-2 space-y-2">
            {/* Row 1: Drawing tools and options */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {/* Undo button */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2"
                onClick={handleUndo}
                disabled={canvasHistory.length <= 1}
                title="Отменить (Ctrl+Z)"
              >
                <Undo2 className="h-4 w-4" />
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
                      title={`${tool.name} (${tool.shortcut})`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </Button>
                  );
                })}
              </div>
              
              {/* Room & Partition */}
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => {
                    setRoomForm({ ...roomForm, isPartition: false });
                    setAddRoomDialogOpen(true);
                  }}
                  title="Добавить комнату с заданными размерами"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Комната
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => {
                    setRoomForm({ ...roomForm, isPartition: true });
                    setAddRoomDialogOpen(true);
                  }}
                  title="Добавить перегородку внутри комнаты"
                >
                  <SplitSquareVertical className="h-3.5 w-3.5" />
                  Перегородка
                </Button>
              </div>
              
              {/* Drawing options (when drawing tool is active and not ruler) */}
              {activeTool !== 'select' && activeTool !== 'ruler' && activeTool !== 'text' && (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={drawingColor}
                    onChange={(e) => setDrawingColor(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer border"
                    title="Цвет"
                  />
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="20"
                    value={drawingStrokeWidthCm}
                    onChange={(e) => setDrawingStrokeWidthCm(parseFloat(e.target.value) || 1)}
                    className="w-14 h-7 text-xs"
                    title="Толщина (см)"
                  />
                  {activeTool === 'rectangle' && (
                    <Button
                      size="sm"
                      variant={drawingFill !== 'transparent' ? 'default' : 'outline'}
                      className="h-7 text-xs px-2"
                      onClick={() => setDrawingFill(drawingFill === 'transparent' ? drawingColor + '20' : 'transparent')}
                    >
                      Заливка
                    </Button>
                  )}
                </div>
              )}
              
              {/* Tool hints */}
              {activeTool === 'ruler' && (
                <span className="text-xs text-muted-foreground">Линейка</span>
              )}
              {activeTool === 'text' && (
                <span className="text-xs text-muted-foreground">Кликните для текста</span>
              )}
            </div>
            
            {/* Row 2: Actions, alignment, snap */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {/* Duplicate */}
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={duplicateSelected}
                title="Дублировать (Ctrl+D)"
                data-testid="duplicate-button"
              >
                <CopyPlus className="h-3 w-3 mr-1" />
                Дубль
              </Button>
              
              {/* Group/Ungroup */}
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={groupSelected}
                  title="Сгруппировать (Ctrl+G)"
                  data-testid="group-button"
                >
                  <Layers className="h-3 w-3 mr-1" />
                  Группа
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={ungroupSelected}
                  title="Разгруппировать (Ctrl+Shift+G)"
                  data-testid="ungroup-button"
                >
                  <GripVertical className="h-3 w-3" />
                </Button>
              </div>
              
              <div className="h-5 w-px bg-border" />
              
              {/* Snap toggle */}
              <Button
                size="sm"
                variant={snapToObjects ? 'default' : 'outline'}
                className="h-7 px-2 text-xs"
                onClick={() => setSnapToObjects(!snapToObjects)}
                title={snapToObjects ? 'Привязка включена' : 'Привязка выключена'}
                data-testid="snap-toggle"
              >
                <Magnet className="h-3 w-3 mr-1" />
                Snap
              </Button>
              
              {/* Copy/Paste */}
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={copySelected}
                  title="Копировать (Ctrl+C)"
                  data-testid="copy-button"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={pasteFromClipboard}
                  title="Вставить (Ctrl+V)"
                  data-testid="paste-button"
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
              
              {/* Keyboard hints */}
              <span className="text-xs text-muted-foreground hidden lg:inline">
                Ctrl+A/D/G | Del
              </span>
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
      
      {/* Right Panel - Properties - FIXED HEIGHT */}
      <div className="w-64 flex-shrink-0 h-full">
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
                
                {/* Element ID and Instance Name */}
                {selectedObject.id && !selectedObject.isRoomGroup && (
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">ID:</span>
                      <code className="text-[10px] font-mono bg-slate-200 px-1 rounded">{selectedObject.id?.slice(-8)}</code>
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500">Nazwa instancji (opcjonalnie)</Label>
                      <Input
                        value={selectedObject.instanceName || ''}
                        onChange={(e) => {
                          const obj = fabricRef.current?.getActiveObject();
                          if (obj) {
                            obj.set('instanceName', e.target.value);
                            handleObjectSelected({ selected: [obj] });
                          }
                        }}
                        placeholder="np. Lewa lawa, Prawa lawa..."
                        className="h-6 text-xs mt-1"
                      />
                      <p className="text-[9px] text-slate-400 mt-1">
                        Nazwa pomaga rozróżnić identyczne elementy
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Element Visibility Toggle */}
                {!selectedObject.isRoomGroup && !selectedObject.isGridLine && !selectedObject.isGridLabel && (
                  <div className="p-2 bg-gray-50 border border-gray-200 rounded">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs font-medium flex items-center gap-1">
                        {selectedObject.isHidden ? (
                          <EyeOff className="h-3 w-3 text-gray-400" />
                        ) : (
                          <Eye className="h-3 w-3 text-green-600" />
                        )}
                        Widoczność elementu
                      </span>
                      <Switch
                        checked={!selectedObject.isHidden}
                        onCheckedChange={(checked) => {
                          const obj = fabricRef.current?.getActiveObject();
                          if (obj) {
                            const isHidden = !checked;
                            obj.set('isHidden', isHidden);
                            obj.set('opacity', isHidden ? 0.25 : 1);
                            // Keep object selectable!
                            obj.set('selectable', true);
                            obj.set('evented', true);
                            fabricRef.current.renderAll();
                            handleObjectSelected({ selected: [obj] });
                            updateDimensionLabels();
                            saveToHistory();
                            toast.success(checked ? 'Element widoczny' : 'Element ukryty');
                          }
                        }}
                      />
                    </label>
                    {selectedObject.isHidden && (
                      <p className="text-[10px] text-amber-600 mt-1">
                        Element jest ukryty (półprzezroczysty). Kliknij aby wybrać i włączyć widoczność.
                      </p>
                    )}
                  </div>
                )}
                
                {/* Room properties - wall thickness and visibility */}
                {selectedObject.isRoomGroup && (
                  <div className="space-y-3">
                    {/* Room outer dimensions */}
                    <div className="p-2 bg-green-50 border border-green-200 rounded">
                      <Label className="text-xs font-medium text-green-800">Wymiary zewnętrzne (cm)</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Szerokość</Label>
                          <Input
                            type="number"
                            step="1"
                            min="20"
                            value={selectedObject.outerWidthCm || 200}
                            onChange={(e) => {
                              const obj = fabricRef.current?.getActiveObject();
                              if (obj && obj.isRoomGroup) {
                                const newWidthCm = parseFloat(e.target.value) || 200;
                                const newWidthPx = newWidthCm * pixelsPerCm;
                                // Scale the group to new size
                                const currentWidth = obj.width * (obj.scaleX || 1);
                                const scale = newWidthPx / obj.width;
                                obj.set({ 
                                  scaleX: scale,
                                  outerWidthCm: newWidthCm,
                                });
                                obj.setCoords();
                                fabricRef.current.renderAll();
                                handleObjectSelected({ selected: [obj] });
                                updateDimensionLabels();
                              }
                            }}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Wysokość</Label>
                          <Input
                            type="number"
                            step="1"
                            min="20"
                            value={selectedObject.outerHeightCm || 150}
                            onChange={(e) => {
                              const obj = fabricRef.current?.getActiveObject();
                              if (obj && obj.isRoomGroup) {
                                const newHeightCm = parseFloat(e.target.value) || 150;
                                const newHeightPx = newHeightCm * pixelsPerCm;
                                // Scale the group to new size
                                const scale = newHeightPx / obj.height;
                                obj.set({ 
                                  scaleY: scale,
                                  outerHeightCm: newHeightCm,
                                });
                                obj.setCoords();
                                fabricRef.current.renderAll();
                                handleObjectSelected({ selected: [obj] });
                                updateDimensionLabels();
                              }
                            }}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                      {/* Show calculated inner dimensions */}
                      <div className="mt-2 p-2 bg-white/50 rounded text-xs">
                        <span className="text-green-700 font-medium">Wewnętrzne: </span>
                        <span className="text-green-900">
                          {((selectedObject.outerWidthCm || 200) - (selectedObject.wallLeftCm || 4.4) - (selectedObject.wallRightCm || 4.4)).toFixed(1)} × {((selectedObject.outerHeightCm || 150) - (selectedObject.wallTopCm || 4.4) - (selectedObject.wallBottomCm || 4.4)).toFixed(1)} cm
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded">
                      <Label className="text-xs font-medium text-amber-800">Grubość ścian (cm)</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Lewa</Label>
                          <Input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="50"
                            value={selectedObject.wallLeftCm || 4.4}
                            onChange={(e) => {
                              const obj = fabricRef.current?.getActiveObject();
                              if (obj && obj.isRoomGroup) {
                                const newVal = parseFloat(e.target.value) || 4.4;
                                obj.set('wallLeftCm', newVal);
                                fabricRef.current.renderAll();
                                handleObjectSelected({ selected: [obj] });
                                updateDimensionLabels();
                              }
                            }}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Prawa</Label>
                          <Input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="50"
                            value={selectedObject.wallRightCm || 4.4}
                            onChange={(e) => {
                              const obj = fabricRef.current?.getActiveObject();
                              if (obj && obj.isRoomGroup) {
                                const newVal = parseFloat(e.target.value) || 4.4;
                                obj.set('wallRightCm', newVal);
                                fabricRef.current.renderAll();
                                handleObjectSelected({ selected: [obj] });
                                updateDimensionLabels();
                              }
                            }}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Górna</Label>
                          <Input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="50"
                            value={selectedObject.wallTopCm || 4.4}
                            onChange={(e) => {
                              const obj = fabricRef.current?.getActiveObject();
                              if (obj && obj.isRoomGroup) {
                                const newVal = parseFloat(e.target.value) || 4.4;
                                obj.set('wallTopCm', newVal);
                                fabricRef.current.renderAll();
                                handleObjectSelected({ selected: [obj] });
                                updateDimensionLabels();
                              }
                            }}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Dolna</Label>
                          <Input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="50"
                            value={selectedObject.wallBottomCm || 4.4}
                            onChange={(e) => {
                              const obj = fabricRef.current?.getActiveObject();
                              if (obj && obj.isRoomGroup) {
                                const newVal = parseFloat(e.target.value) || 4.4;
                                obj.set('wallBottomCm', newVal);
                                fabricRef.current.renderAll();
                                handleObjectSelected({ selected: [obj] });
                                updateDimensionLabels();
                              }
                            }}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Room dimension visibility toggles */}
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded space-y-2">
                      <Label className="text-xs font-medium text-blue-800">Widoczność wymiarów</Label>
                      <div className="space-y-1">
                        <label className="flex items-center justify-between text-xs cursor-pointer">
                          <span className="text-amber-700">zewn. (zewnętrzne)</span>
                          <Switch
                            checked={selectedObject.showOuterDimensions !== false}
                            onCheckedChange={(checked) => {
                              const obj = fabricRef.current?.getActiveObject();
                              if (obj && obj.isRoomGroup) {
                                obj.set('showOuterDimensions', checked);
                                fabricRef.current.renderAll();
                                handleObjectSelected({ selected: [obj] });
                                updateDimensionLabels();
                              }
                            }}
                          />
                        </label>
                        <label className="flex items-center justify-between text-xs cursor-pointer">
                          <span className="text-green-700">wewn. (wewnętrzne)</span>
                          <Switch
                            checked={selectedObject.showInnerDimensions !== false}
                            onCheckedChange={(checked) => {
                              const obj = fabricRef.current?.getActiveObject();
                              if (obj && obj.isRoomGroup) {
                                obj.set('showInnerDimensions', checked);
                                fabricRef.current.renderAll();
                                handleObjectSelected({ selected: [obj] });
                                updateDimensionLabels();
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
                
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
                    {/* Visibility toggles for dimensions */}
                    <div className="space-y-2 p-2 bg-muted/50 rounded">
                      <Label className="text-xs font-medium">Widoczność:</Label>
                      
                      {/* Element size labels toggle */}
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-xs text-blue-700">Wymiary elementu</span>
                        <Switch
                          checked={selectedObject.showElementSize !== false}
                          onCheckedChange={(checked) => {
                            const obj = fabricRef.current?.getActiveObject();
                            if (obj) {
                              obj.set('showElementSize', checked);
                              fabricRef.current.renderAll();
                              handleObjectSelected({ selected: [obj] });
                              updateDimensionLabels();
                            }
                          }}
                        />
                      </label>
                      
                      {/* Distance lines toggle */}
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-xs text-red-700">Odległości do obiektów</span>
                        <Switch
                          checked={selectedObject.showDistances !== false}
                          onCheckedChange={(checked) => {
                            const obj = fabricRef.current?.getActiveObject();
                            if (obj) {
                              obj.set('showDistances', checked);
                              // Also update individual distance flags
                              obj.set('showDistanceLeft', checked);
                              obj.set('showDistanceRight', checked);
                              obj.set('showDistanceTop', checked);
                              obj.set('showDistanceBottom', checked);
                              fabricRef.current.renderAll();
                              handleObjectSelected({ selected: [obj] });
                              updateDimensionLabels();
                            }
                          }}
                        />
                      </label>
                    </div>
                    
                    {/* Individual distance line toggles - only if distances enabled */}
                    {selectedObject.showDistances !== false && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded space-y-2">
                        <Label className="text-xs font-medium text-red-700">Linie odległości:</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedObject.showDistanceLeft !== false}
                              onChange={(e) => toggleDistanceLine('left', e.target.checked)}
                              className="rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span>← Lewa</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedObject.showDistanceRight !== false}
                              onChange={(e) => toggleDistanceLine('right', e.target.checked)}
                              className="rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span>Prawa →</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedObject.showDistanceTop !== false}
                              onChange={(e) => toggleDistanceLine('top', e.target.checked)}
                              className="rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span>↑ Górna</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedObject.showDistanceBottom !== false}
                              onChange={(e) => toggleDistanceLine('bottom', e.target.checked)}
                              className="rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span>Dolna ↓</span>
                          </label>
                        </div>
                      </div>
                    )}
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
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => rotateSelected(-90)} title="Повернуть на -90°">
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => rotateSelected(-15)}>
                      -15°
                    </Button>
                    <Button size="sm" variant="default" className="h-7 px-2 text-xs font-bold" onClick={() => {
                      const obj = fabricRef.current?.getActiveObject();
                      if (obj) {
                        obj.set('angle', 90);
                        fabricRef.current.renderAll();
                        handleObjectSelected({ selected: [obj] });
                      }
                    }} title="Установить точно 90°">
                      90°
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => rotateSelected(15)}>
                      +15°
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => rotateSelected(90)} title="Повернуть на +90°">
                      <RotateCw className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => {
                      const obj = fabricRef.current?.getActiveObject();
                      if (obj) {
                        obj.set('angle', 0);
                        fabricRef.current.renderAll();
                        handleObjectSelected({ selected: [obj] });
                      }
                    }}>0°</Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => {
                      const obj = fabricRef.current?.getActiveObject();
                      if (obj) {
                        obj.set('angle', 90);
                        fabricRef.current.renderAll();
                        handleObjectSelected({ selected: [obj] });
                      }
                    }}>90°</Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => {
                      const obj = fabricRef.current?.getActiveObject();
                      if (obj) {
                        obj.set('angle', 180);
                        fabricRef.current.renderAll();
                        handleObjectSelected({ selected: [obj] });
                      }
                    }}>180°</Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => {
                      const obj = fabricRef.current?.getActiveObject();
                      if (obj) {
                        obj.set('angle', 270);
                        fabricRef.current.renderAll();
                        handleObjectSelected({ selected: [obj] });
                      }
                    }}>270°</Button>
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs">Отражение</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 px-3 text-xs flex-1"
                      onClick={flipHorizontal}
                    >
                      ↔ По горизонтали
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 px-3 text-xs flex-1"
                      onClick={flipVertical}
                    >
                      ↕ По вертикали
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
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ширина (см)</Label>
                <Input
                  type="number"
                  value={uploadForm.widthCm}
                  onChange={(e) => setUploadForm({ ...uploadForm, widthCm: e.target.value })}
                  placeholder="60"
                />
              </div>
              <div>
                <Label>Высота (см)</Label>
                <Input
                  type="number"
                  value={uploadForm.heightCm}
                  onChange={(e) => setUploadForm({ ...uploadForm, heightCm: e.target.value })}
                  placeholder="80"
                />
              </div>
            </div>
            
            {/* Fixed height option for benches etc */}
            <div className="flex items-center space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Switch
                id="fixedHeight"
                checked={uploadForm.fixedHeight}
                onCheckedChange={(checked) => setUploadForm({ ...uploadForm, fixedHeight: checked })}
              />
              <div className="flex-1">
                <Label htmlFor="fixedHeight" className="text-sm font-medium cursor-pointer">
                  Фиксированная высота
                </Label>
                <p className="text-xs text-muted-foreground">
                  Для лавок и элементов, где меняется только ширина
                </p>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Укажите фактические размеры элемента для корректного масштабирования
            </p>
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
                {selectedVariant && <p><strong>Вариант:</strong> {selectedVariant.nameRu || selectedVariant.namePl || selectedVariant.name}</p>}
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
      
      {/* Text Input Dialog */}
      {/* Add Room Dialog */}
      <Dialog open={addRoomDialogOpen} onOpenChange={setAddRoomDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {roomForm.isPartition ? 'Добавить перегородку' : 'Добавить комнату'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Toggle between room and partition */}
            <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
              <Button
                variant={!roomForm.isPartition ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRoomForm({ ...roomForm, isPartition: false })}
                className="flex-1"
              >
                Новая комната
              </Button>
              <Button
                variant={roomForm.isPartition ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRoomForm({ ...roomForm, isPartition: true })}
                className="flex-1"
              >
                Перегородка
              </Button>
            </div>
            
            {!roomForm.isPartition ? (
              /* Room dimensions with wall thickness */
              <>
                <div>
                  <Label className="font-medium">Внешние размеры (см)</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Ширина</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="20"
                        value={roomForm.outerWidthCm}
                        onChange={(e) => setRoomForm({ ...roomForm, outerWidthCm: parseFloat(e.target.value) || 0 })}
                        placeholder="200"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Высота</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="20"
                        value={roomForm.outerHeightCm}
                        onChange={(e) => setRoomForm({ ...roomForm, outerHeightCm: parseFloat(e.target.value) || 0 })}
                        placeholder="150"
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label className="font-medium">Толщина стен (см)</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Левая</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="50"
                        value={roomForm.wallLeftCm}
                        onChange={(e) => setRoomForm({ ...roomForm, wallLeftCm: parseFloat(e.target.value) || 4.4 })}
                        placeholder="4.4"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Правая</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="50"
                        value={roomForm.wallRightCm}
                        onChange={(e) => setRoomForm({ ...roomForm, wallRightCm: parseFloat(e.target.value) || 4.4 })}
                        placeholder="4.4"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Верхняя</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="50"
                        value={roomForm.wallTopCm}
                        onChange={(e) => setRoomForm({ ...roomForm, wallTopCm: parseFloat(e.target.value) || 4.4 })}
                        placeholder="4.4"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Нижняя</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="50"
                        value={roomForm.wallBottomCm}
                        onChange={(e) => setRoomForm({ ...roomForm, wallBottomCm: parseFloat(e.target.value) || 4.4 })}
                        placeholder="4.4"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Show calculated inner dimensions */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Label className="text-xs font-medium text-blue-700">Внутренние размеры (авто):</Label>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-sm font-bold text-blue-900">
                      {(roomForm.outerWidthCm - roomForm.wallLeftCm - roomForm.wallRightCm).toFixed(1)} × {(roomForm.outerHeightCm - roomForm.wallTopCm - roomForm.wallBottomCm).toFixed(1)} см
                    </span>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  На холсте будут показаны внешний и внутренний размеры комнаты
                </p>
              </>
            ) : (
              /* Partition settings */
              <>
                <div>
                  <Label>Направление перегородки</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant={roomForm.partitionPosition === 'vertical' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRoomForm({ ...roomForm, partitionPosition: 'vertical' })}
                      className="flex-1"
                    >
                      │ Вертикальная
                    </Button>
                    <Button
                      variant={roomForm.partitionPosition === 'horizontal' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRoomForm({ ...roomForm, partitionPosition: 'horizontal' })}
                      className="flex-1"
                    >
                      ─ Горизонтальная
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>
                    Отступ от {roomForm.partitionPosition === 'vertical' ? 'левого края' : 'верха'} (см)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={roomForm.partitionOffset}
                    onChange={(e) => setRoomForm({ ...roomForm, partitionOffset: parseFloat(e.target.value) || 0 })}
                    placeholder="50"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Перегородка разделит основную комнату на две части. 
                  {roomForm.partitionPosition === 'vertical' 
                    ? ` Левая часть: ${roomForm.partitionOffset} см` 
                    : ` Верхняя часть: ${roomForm.partitionOffset} см`}
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRoomDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={roomForm.isPartition ? addPartitionToRoom : addRoomToCanvas}>
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Добавить текст</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Текст</Label>
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Введите текст..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && textInput.trim()) {
                    addTextToCanvas();
                  }
                }}
              />
            </div>
            <div>
              <Label>Размер шрифта</Label>
              <div className="flex items-center gap-2 mt-1">
                <Slider
                  value={[textFontSize]}
                  min={8}
                  max={72}
                  step={1}
                  onValueChange={([val]) => setTextFontSize(val)}
                  className="flex-1"
                />
                <span className="text-sm w-8">{textFontSize}</span>
              </div>
            </div>
            <div>
              <Label>Цвет</Label>
              <input
                type="color"
                value={drawingColor}
                onChange={(e) => setDrawingColor(e.target.value)}
                className="w-full h-8 rounded cursor-pointer border mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTextDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={addTextToCanvas} disabled={!textInput.trim()}>
              Добавить
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
      
      {/* Create Option Dialog */}
      <Dialog open={createOptionDialogOpen} onOpenChange={setCreateOptionDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nowa opcja konfiguracji</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label className="text-xs">Nazwa (PL)</Label>
              <Input
                value={newOptionForm.namePl}
                onChange={(e) => setNewOptionForm({ ...newOptionForm, namePl: e.target.value, name: e.target.value })}
                placeholder="np. Strona wejścia"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Nazwa (RU)</Label>
              <Input
                value={newOptionForm.nameRu}
                onChange={(e) => setNewOptionForm({ ...newOptionForm, nameRu: e.target.value })}
                placeholder="напр. Сторона входа"
                className="h-8 text-sm"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Opcja grupuje warianty konfiguracji. Np. opcja "Strona wejścia" może mieć warianty "Prosto" i "Z boku".
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOptionDialogOpen(false)}>
              Anuluj
            </Button>
            <Button size="sm" onClick={createLayoutOption}>
              Utwórz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Option Dialog */}
      <Dialog open={editOptionDialogOpen} onOpenChange={setEditOptionDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edytuj opcję</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label className="text-xs">Nazwa (PL)</Label>
              <Input
                value={editOptionForm.namePl}
                onChange={(e) => setEditOptionForm({ ...editOptionForm, namePl: e.target.value, name: e.target.value })}
                placeholder="np. Strona wejścia"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Nazwa (RU)</Label>
              <Input
                value={editOptionForm.nameRu}
                onChange={(e) => setEditOptionForm({ ...editOptionForm, nameRu: e.target.value })}
                placeholder="напр. Сторона входа"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOptionDialogOpen(false)}>
              Anuluj
            </Button>
            <Button size="sm" onClick={updateLayoutOption}>
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Variant Dialog */}
      <Dialog open={editVariantDialogOpen} onOpenChange={setEditVariantDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edytuj wariant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {/* Move to different option */}
            <div className="p-2 bg-slate-50 border border-slate-200 rounded">
              <Label className="text-xs font-medium text-slate-700">Opcja</Label>
              <Select
                value={editVariantForm.optionId}
                onValueChange={(val) => setEditVariantForm({ ...editVariantForm, newOptionId: val })}
              >
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {layoutOptions.map(opt => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.namePl || opt.name}
                      {opt.id === editVariantForm.optionId && ' (obecna)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editVariantForm.newOptionId && editVariantForm.newOptionId !== editVariantForm.optionId && (
                <p className="text-[10px] text-amber-600 mt-1">
                  ⚠️ Wariant zostanie przeniesiony do innej opcji
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Nazwa (PL)</Label>
                <Input
                  value={editVariantForm.namePl}
                  onChange={(e) => setEditVariantForm({ ...editVariantForm, namePl: e.target.value, name: e.target.value })}
                  placeholder="np. Lewa strona"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Nazwa (RU)</Label>
                <Input
                  value={editVariantForm.nameRu}
                  onChange={(e) => setEditVariantForm({ ...editVariantForm, nameRu: e.target.value })}
                  placeholder="напр. Левая сторона"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            
            <div className="p-2 bg-blue-50 border border-blue-200 rounded">
              <Label className="text-xs font-medium text-blue-800">Konfiguracje elementów ({editVariantForm.elementConfigs.length})</Label>
              <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                {editVariantForm.elementConfigs.map((config, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[10px] bg-white p-1 rounded">
                    <span className="truncate">
                      {config.assetName || config.elementType}
                      {config.instanceName && <span className="text-blue-500 ml-1">({config.instanceName})</span>}
                    </span>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span>x:{config.properties?.left}</span>
                      <span>y:{config.properties?.top}</span>
                      {config.properties?.isHidden && <EyeOff className="h-2.5 w-2.5 text-amber-500" />}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-4 w-4"
                        onClick={() => {
                          const updated = editVariantForm.elementConfigs.filter((_, i) => i !== idx);
                          setEditVariantForm({ ...editVariantForm, elementConfigs: updated });
                        }}
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {editVariantForm.elementConfigs.length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-2">Brak elementów</p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2 h-7 text-xs"
                onClick={updateVariantElementFromCanvas}
              >
                <Plus className="h-3 w-3 mr-1" />
                Dodaj/aktualizuj z canvasu
              </Button>
              <p className="text-[9px] text-blue-600 mt-1">
                Wybierz element na canvasie i kliknij przycisk aby zaktualizować jego pozycję
              </p>
            </div>
            
            {/* Conditions section */}
            <div className="p-2 bg-amber-50 border border-amber-200 rounded">
              <Label className="text-xs font-medium text-amber-800">Warunki widoczności (opcjonalnie)</Label>
              <p className="text-[9px] text-amber-600 mb-2">
                Wariant będzie widoczny tylko gdy wybrane zostaną wskazane opcje
              </p>
              
              {/* List of conditions */}
              {editVariantForm.conditions?.map((cond, idx) => {
                const condOpt = layoutOptions.find(o => o.id === cond.optionId);
                const condVar = condOpt?.variants?.find(v => v.id === cond.variantId);
                return (
                  <div key={idx} className="flex items-center gap-1 mb-1 text-[10px] bg-white/50 p-1 rounded">
                    <span className="text-amber-700">
                      {condOpt?.namePl || condOpt?.name}: {condVar?.namePl || condVar?.name}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-4 w-4 ml-auto"
                      onClick={() => {
                        const newConds = [...editVariantForm.conditions];
                        newConds.splice(idx, 1);
                        setEditVariantForm({ ...editVariantForm, conditions: newConds });
                      }}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                );
              })}
              
              {/* Add condition */}
              <div className="flex gap-1 mt-2">
                <Select
                  value=""
                  onValueChange={(val) => {
                    // val format: "optionId:variantId"
                    const [optId, varId] = val.split(':');
                    if (optId && varId) {
                      // Don't add same option twice
                      if (!editVariantForm.conditions?.find(c => c.optionId === optId)) {
                        setEditVariantForm({
                          ...editVariantForm,
                          conditions: [...(editVariantForm.conditions || []), { optionId: optId, variantId: varId }]
                        });
                      }
                    }
                  }}
                >
                  <SelectTrigger className="h-7 text-[10px] flex-1">
                    <SelectValue placeholder="+ Dodaj warunek" />
                  </SelectTrigger>
                  <SelectContent>
                    {layoutOptions
                      .filter(o => o.id !== editVariantForm.optionId) // Can't add condition from same option
                      .map(opt => (
                        <React.Fragment key={opt.id}>
                          <SelectItem value={`header-${opt.id}`} disabled className="text-[10px] font-medium">
                            {opt.namePl || opt.name}
                          </SelectItem>
                          {opt.variants?.map(v => (
                            <SelectItem key={v.id} value={`${opt.id}:${v.id}`} className="text-[10px] pl-4">
                              → {v.namePl || v.name}
                            </SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Calculator Mapping - ADMIN ONLY */}
            {isAdminMode && calculatorCategories.length > 0 && (
              <div className="p-2 bg-green-50 border border-green-200 rounded">
                <Label className="text-xs font-medium text-green-800">Привязка к калькулятору (опционально)</Label>
                <p className="text-[9px] text-green-600 mb-2">
                  Вариант автоматически применится, когда в калькуляторе выбрана указанная опция
                </p>
                
                {/* Current mapping display */}
                {editVariantForm.calculatorMapping && (
                  <div className="flex items-center gap-1 mb-2 text-[10px] bg-white/50 p-1.5 rounded">
                    <span className="text-green-700">
                      {calculatorCategories.find(c => c.id === editVariantForm.calculatorMapping?.categoryId)?.namePl || editVariantForm.calculatorMapping?.categoryId}
                      {' → '}
                      {calculatorCategories
                        .find(c => c.id === editVariantForm.calculatorMapping?.categoryId)
                        ?.options?.find(o => o.id === editVariantForm.calculatorMapping?.optionId)?.namePl || editVariantForm.calculatorMapping?.optionId}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-4 w-4 ml-auto"
                      onClick={() => setEditVariantForm({ ...editVariantForm, calculatorMapping: null })}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                )}
                
                {/* Set mapping */}
                {!editVariantForm.calculatorMapping && (
                  <Select
                    value=""
                    onValueChange={(val) => {
                      // val format: "categoryId:optionId"
                      const [catId, optId] = val.split(':');
                      if (catId && optId) {
                        setEditVariantForm({
                          ...editVariantForm,
                          calculatorMapping: { categoryId: catId, optionId: optId }
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-[10px]">
                      <SelectValue placeholder="+ Выберите опцию калькулятора" />
                    </SelectTrigger>
                    <SelectContent>
                      {calculatorCategories.map(cat => (
                        <React.Fragment key={cat.id}>
                          <SelectItem value={`header-${cat.id}`} disabled className="text-[10px] font-medium text-green-700">
                            {cat.namePl || cat.name}
                          </SelectItem>
                          {cat.options?.map(opt => (
                            <SelectItem key={opt.id} value={`${cat.id}:${opt.id}`} className="text-[10px] pl-4">
                              → {opt.namePl || opt.name}
                            </SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditVariantDialogOpen(false)}>
              Anuluj
            </Button>
            <Button size="sm" onClick={updateVariant}>
              Zapisz zmiany
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Copy Option to Model Dialog */}
      <Dialog open={copyOptionDialogOpen} onOpenChange={setCopyOptionDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Kopiuj opcję do innego modelu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label className="text-xs">Co skopiować?</Label>
              <Select
                value={copyOptionForm.sourceOptionId || "all"}
                onValueChange={(val) => setCopyOptionForm({ ...copyOptionForm, sourceOptionId: val === "all" ? "all" : val })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Wybierz opcję" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-medium text-blue-600">
                    🔄 Wszystkie opcje ({layoutOptions.length} opcji, {layoutOptions.reduce((sum, o) => sum + (o.variants?.length || 0), 0)} wariantów)
                  </SelectItem>
                  <div className="border-t my-1" />
                  {layoutOptions.map(opt => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.namePl || opt.name} ({opt.variants?.length || 0} wariantów)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-xs">Model docelowy</Label>
              <Select
                value={copyOptionForm.targetModelId}
                onValueChange={(val) => setCopyOptionForm({ ...copyOptionForm, targetModelId: val, targetVariantId: '' })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Wybierz model" />
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
            
            {copyOptionForm.targetModelId && (
              <div>
                <Label className="text-xs">Podmodel docelowy (opcjonalnie)</Label>
                <Select
                  value={copyOptionForm.targetVariantId || "all"}
                  onValueChange={(val) => setCopyOptionForm({ ...copyOptionForm, targetVariantId: val === "all" ? "" : val })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Wszystkie podmodele" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie podmodele</SelectItem>
                    {saunaModels.find(m => m.id === copyOptionForm.targetModelId)?.variants?.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.namePl || v.nameRu || v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              <p className="font-medium mb-1">Co zostanie skopiowane:</p>
              <ul className="list-disc list-inside text-[10px] space-y-0.5">
                <li>Nazwa opcji (PL + RU)</li>
                <li>Wszystkie warianty z konfiguracjami elementów</li>
                <li>Warunki widoczności wariantów</li>
              </ul>
              <p className="mt-1 text-amber-600">Pozycje elementów pozostaną takie same - dostosuj je po skopiowaniu.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCopyOptionDialogOpen(false)}>
              Anuluj
            </Button>
            <Button size="sm" onClick={copyOptionToModel} disabled={loading}>
              {loading ? 'Kopiowanie...' : 'Kopiuj'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Clone Layout to Another Model Dialog */}
      <Dialog open={cloneLayoutDialogOpen} onOpenChange={setCloneLayoutDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Клонировать планировку для другой модели</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Source layout info */}
            <div className="p-3 bg-slate-50 border rounded">
              <Label className="text-xs text-muted-foreground">Исходная планировка:</Label>
              <p className="font-medium">{cloneLayoutForm.sourceLayoutName}</p>
              {selectedModel && (
                <p className="text-xs text-muted-foreground">
                  Модель: {selectedModel.name}
                </p>
              )}
            </div>
            
            {/* Target model */}
            <div>
              <Label className="text-sm font-medium">Целевая модель</Label>
              <Select
                value={cloneLayoutForm.targetModelId}
                onValueChange={(val) => setCloneLayoutForm({ 
                  ...cloneLayoutForm, 
                  targetModelId: val, 
                  targetVariantId: '',
                  // Auto-generate new name
                  newName: `Планировка ${saunaModels.find(m => m.id === val)?.name || val}`
                })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Выберите модель" />
                </SelectTrigger>
                <SelectContent>
                  {saunaModels.filter(m => m.id !== selectedModel?.id).map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Target submodel (variant) */}
            {cloneLayoutForm.targetModelId && (
              <div>
                <Label className="text-sm font-medium">Подмодель (опционально)</Label>
                <Select
                  value={cloneLayoutForm.targetVariantId || "none"}
                  onValueChange={(val) => setCloneLayoutForm({ 
                    ...cloneLayoutForm, 
                    targetVariantId: val === "none" ? "" : val 
                  })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Все подмодели" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Для всех подмоделей</SelectItem>
                    {saunaModels.find(m => m.id === cloneLayoutForm.targetModelId)?.variants?.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.nameRu || v.namePl || v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* New name */}
            <div>
              <Label className="text-sm font-medium">Название новой планировки</Label>
              <Input
                className="mt-1"
                value={cloneLayoutForm.newName}
                onChange={(e) => setCloneLayoutForm({ ...cloneLayoutForm, newName: e.target.value })}
                placeholder="Название планировки"
              />
            </div>
            
            {/* Auto-scale option */}
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
              <div>
                <Label className="text-sm font-medium">Автомасштабирование</Label>
                <p className="text-xs text-muted-foreground">
                  Автоматически подогнать позиции элементов под размер модели
                </p>
              </div>
              <Switch
                checked={cloneLayoutForm.autoScale}
                onCheckedChange={(checked) => setCloneLayoutForm({ ...cloneLayoutForm, autoScale: checked })}
              />
            </div>
            
            {/* Manual scale (if not auto) */}
            {!cloneLayoutForm.autoScale && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Масштаб X</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="5"
                    value={cloneLayoutForm.scaleX}
                    onChange={(e) => setCloneLayoutForm({ ...cloneLayoutForm, scaleX: parseFloat(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Масштаб Y</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="5"
                    value={cloneLayoutForm.scaleY}
                    onChange={(e) => setCloneLayoutForm({ ...cloneLayoutForm, scaleY: parseFloat(e.target.value) || 1 })}
                  />
                </div>
              </div>
            )}
            
            {/* Info box */}
            <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
              <p className="font-medium mb-1">Что будет скопировано:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Все элементы планировки (печь, лавки, и т.д.)</li>
                <li>Размеры и контур комнаты</li>
                <li>Позиции элементов (с масштабированием)</li>
              </ul>
              <p className="mt-2 font-medium text-blue-600">
                После клонирования проверьте и подкорректируйте позиции элементов!
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneLayoutDialogOpen(false)}>
              Отмена
            </Button>
            <Button 
              onClick={handleCloneLayout} 
              disabled={loading || !cloneLayoutForm.targetModelId}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Клонирование...
                </>
              ) : (
                <>
                  <CopyPlus className="h-4 w-4 mr-2" />
                  Клонировать
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Save Variant Dialog */}
      <Dialog open={saveVariantDialogOpen} onOpenChange={setSaveVariantDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Zapisz wariant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label className="text-xs">Opcja</Label>
              <Select
                value={newVariantForm.optionId}
                onValueChange={(val) => setNewVariantForm({ ...newVariantForm, optionId: val })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Wybierz opcję" />
                </SelectTrigger>
                <SelectContent>
                  {layoutOptions.map(opt => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.namePl || opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Nazwa wariantu (PL)</Label>
              <Input
                value={newVariantForm.namePl}
                onChange={(e) => setNewVariantForm({ ...newVariantForm, namePl: e.target.value, name: e.target.value })}
                placeholder="np. Piec zewn. lewy - zakładka 1"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Nazwa wariantu (RU)</Label>
              <Input
                value={newVariantForm.nameRu}
                onChange={(e) => setNewVariantForm({ ...newVariantForm, nameRu: e.target.value })}
                placeholder="напр. Внеш. печь слева - закладка 1"
                className="h-8 text-sm"
              />
            </div>
            
            {/* Conditions section */}
            <div className="p-2 bg-amber-50 border border-amber-200 rounded">
              <Label className="text-xs font-medium text-amber-800">Warunki widoczności (opcjonalnie)</Label>
              <p className="text-[9px] text-amber-600 mb-2">
                Wariant będzie widoczny tylko gdy wybrane zostaną wskazane opcje
              </p>
              
              {/* List of conditions */}
              {newVariantForm.conditions?.map((cond, idx) => {
                const condOpt = layoutOptions.find(o => o.id === cond.optionId);
                const condVar = condOpt?.variants?.find(v => v.id === cond.variantId);
                return (
                  <div key={idx} className="flex items-center gap-1 mb-1 text-[10px] bg-white/50 p-1 rounded">
                    <span className="text-amber-700">
                      {condOpt?.namePl || condOpt?.name}: {condVar?.namePl || condVar?.name}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-4 w-4 ml-auto"
                      onClick={() => {
                        const newConds = [...newVariantForm.conditions];
                        newConds.splice(idx, 1);
                        setNewVariantForm({ ...newVariantForm, conditions: newConds });
                      }}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                );
              })}
              
              {/* Add condition */}
              <div className="flex gap-1 mt-2">
                <Select
                  value=""
                  onValueChange={(val) => {
                    // val format: "optionId:variantId"
                    const [optId, varId] = val.split(':');
                    if (optId && varId) {
                      // Don't add same option twice
                      if (!newVariantForm.conditions?.find(c => c.optionId === optId)) {
                        setNewVariantForm({
                          ...newVariantForm,
                          conditions: [...(newVariantForm.conditions || []), { optionId: optId, variantId: varId }]
                        });
                      }
                    }
                  }}
                >
                  <SelectTrigger className="h-7 text-[10px] flex-1">
                    <SelectValue placeholder="+ Dodaj warunek" />
                  </SelectTrigger>
                  <SelectContent>
                    {layoutOptions
                      .filter(o => o.id !== newVariantForm.optionId) // Can't add condition from same option
                      .map(opt => (
                        <React.Fragment key={opt.id}>
                          <SelectItem value={`header-${opt.id}`} disabled className="text-[10px] font-medium">
                            {opt.namePl || opt.name}
                          </SelectItem>
                          {opt.variants?.map(v => (
                            <SelectItem key={v.id} value={`${opt.id}:${v.id}`} className="text-[10px] pl-4">
                              → {v.namePl || v.name}
                            </SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Elements to save in variant */}
            <div className="p-2 bg-green-50 border border-green-200 rounded">
              <Label className="text-xs font-medium text-green-800">Elementy w wariancie:</Label>
              
              {/* List of accumulated elements */}
              {newVariantForm.elements?.length > 0 ? (
                <div className="space-y-1 mt-2">
                  {newVariantForm.elements.map((el, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-[10px] bg-white/50 p-1 rounded">
                      <span className="text-green-700 flex-1 truncate">
                        {el.assetName || el.elementType} @ ({el.properties.left}, {el.properties.top})
                      </span>
                      <span className="text-green-600 text-[9px]">
                        {el.properties.angle}° {Math.round(el.properties.scaleX * 100)}%
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-4 w-4"
                        onClick={() => {
                          const updated = [...newVariantForm.elements];
                          updated.splice(idx, 1);
                          setNewVariantForm({ ...newVariantForm, elements: updated });
                        }}
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[9px] text-green-600 mt-1">
                  Brak elementów. Wybierz element na płótnie i kliknij "Dodaj element".
                </p>
              )}
              
              {/* Add current element button */}
              {selectedObject && (
                <div className="mt-2 p-2 bg-white/50 rounded">
                  <p className="text-[9px] text-green-700 mb-1">Aktualnie wybrany:</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-green-800 flex-1 truncate">
                      {selectedObject.assetName || selectedObject.type} @ ({selectedObject.x}, {selectedObject.y})
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2"
                      onClick={addElementToVariantForm}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Dodaj
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            <p className="text-[10px] text-muted-foreground">
              Dodaj wiele elementów (np. drzwi + ławka) aby zapisać ich pozycje jako jeden wariant.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => {
              setSaveVariantDialogOpen(false);
              setNewVariantForm({ optionId: '', name: '', namePl: '', nameRu: '', conditions: [], elements: [] });
            }}>
              Anuluj
            </Button>
            <Button size="sm" onClick={saveAsVariant} disabled={newVariantForm.elements.length === 0 && !selectedObject}>
              Zapisz ({newVariantForm.elements.length || 1} el.)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LayoutConfiguratorPage;
