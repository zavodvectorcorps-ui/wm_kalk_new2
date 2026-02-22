import { useCallback } from 'react';
import { fabric } from 'fabric';
import { toast } from 'sonner';
import { API_URL } from '../constants';

/**
 * Custom hook for canvas operations (add elements, rooms, partitions)
 */
export const useCanvasOperations = (fabricRef, pixelsPerCm, canvasWidth, canvasHeight, snapToGrid, updateDimensionLabels) => {
  
  // Add room to canvas with specified dimensions
  const addRoomToCanvas = useCallback((roomForm) => {
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
    
    // Center the room on canvas
    const left = Math.round((canvasWidth - outerWidthPx) / 2);
    const top = Math.round((canvasHeight - outerHeightPx) / 2);
    
    // Create outer rectangle (wall)
    const outerRoom = new fabric.Rect({
      left,
      top,
      width: outerWidthPx,
      height: outerHeightPx,
      fill: '#8B4513',
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
      selectable: false,
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
    if (updateDimensionLabels) updateDimensionLabels();
    
    toast.success(`Комната: внешний ${outerWidthCm}×${outerHeightCm} см, внутренний ${innerWidthCm.toFixed(1)}×${innerHeightCm.toFixed(1)} см`);
    return roomGroup;
  }, [fabricRef, pixelsPerCm, canvasWidth, canvasHeight, updateDimensionLabels]);

  // Add partition inside a room
  const addPartitionToRoom = useCallback((roomForm) => {
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    
    // Find the main room
    const rooms = canvas.getObjects().filter(obj => obj.isRoom || obj.isBackground);
    if (rooms.length === 0) {
      toast.error('Сначала добавьте комнату');
      return;
    }
    
    const mainRoom = rooms[0];
    const roomLeft = mainRoom.left;
    const roomTop = mainRoom.top;
    const roomWidth = mainRoom.width * (mainRoom.scaleX || 1);
    const roomHeight = mainRoom.height * (mainRoom.scaleY || 1);
    
    const offsetPx = roomForm.partitionOffset * pixelsPerCm;
    const partitionThickness = 2;
    
    let partition;
    if (roomForm.partitionPosition === 'vertical') {
      const partitionX = snapToGrid(roomLeft + offsetPx);
      partition = new fabric.Line([partitionX, roomTop, partitionX, roomTop + roomHeight], {
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
        lockMovementY: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
      });
      
      const leftRoomCm = roomForm.partitionOffset;
      const rightRoomCm = Math.round(roomWidth / pixelsPerCm) - roomForm.partitionOffset;
      toast.success(`Перегородка добавлена: левая часть ${leftRoomCm} см, правая ${rightRoomCm} см`);
    } else {
      const partitionY = snapToGrid(roomTop + offsetPx);
      partition = new fabric.Line([roomLeft, partitionY, roomLeft + roomWidth, partitionY], {
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
        lockMovementX: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
      });
      
      const topRoomCm = roomForm.partitionOffset;
      const bottomRoomCm = Math.round(roomHeight / pixelsPerCm) - roomForm.partitionOffset;
      toast.success(`Перегородка добавлена: верхняя часть ${topRoomCm} см, нижняя ${bottomRoomCm} см`);
    }
    
    canvas.add(partition);
    canvas.setActiveObject(partition);
    canvas.renderAll();
    if (updateDimensionLabels) updateDimensionLabels();
    
    return partition;
  }, [fabricRef, pixelsPerCm, snapToGrid, updateDimensionLabels]);

  // Add element (asset) to canvas
  const addElementToCanvas = useCallback(async (asset) => {
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    
    try {
      let imageUrl = asset.imageUrl;
      if (imageUrl.startsWith('/api/')) {
        imageUrl = `${API_URL}${imageUrl}`;
      }
      
      fabric.Image.fromURL(imageUrl, (img) => {
        if (!img) {
          toast.error('Не удалось загрузить изображение');
          return;
        }
        
        // Calculate scale based on real dimensions
        let scale = 1;
        if (asset.widthCm && asset.heightCm && pixelsPerCm) {
          const targetWidthPx = asset.widthCm * pixelsPerCm;
          const targetHeightPx = asset.heightCm * pixelsPerCm;
          scale = Math.min(targetWidthPx / img.width, targetHeightPx / img.height);
        } else {
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
          lockUniScaling: !asset.fixedHeight,
          isDrawnShape: true,
          showDimensions: true,
          showDistanceLeft: true,
          showDistanceRight: true,
          showDistanceTop: true,
          showDistanceBottom: true,
        });
        
        img.setControlsVisibility({
          mt: false,
          mb: false,
          ml: asset.fixedHeight ? true : false,
          mr: asset.fixedHeight ? true : false,
        });
        
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        if (updateDimensionLabels) updateDimensionLabels();
        
        toast.success(`Добавлен: ${asset.name}`);
      }, { crossOrigin: 'anonymous' });
    } catch (error) {
      console.error('Error adding element:', error);
      toast.error('Ошибка при добавлении элемента');
    }
  }, [fabricRef, pixelsPerCm, canvasWidth, canvasHeight, snapToGrid, updateDimensionLabels]);

  // Rotate selected object
  const rotateSelectedObject = useCallback((degrees) => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const obj = canvas.getActiveObject();
    if (obj) {
      const newAngle = ((obj.angle || 0) + degrees) % 360;
      obj.set('angle', newAngle);
      obj.setCoords();
      canvas.renderAll();
      if (updateDimensionLabels) updateDimensionLabels();
      toast.success(`Поворот: ${newAngle}°`);
    }
  }, [fabricRef, updateDimensionLabels]);

  // Flip selected object
  const flipSelectedObject = useCallback((direction) => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const obj = canvas.getActiveObject();
    if (obj) {
      if (direction === 'horizontal') {
        obj.set('flipX', !obj.flipX);
      } else {
        obj.set('flipY', !obj.flipY);
      }
      canvas.renderAll();
      if (updateDimensionLabels) updateDimensionLabels();
      toast.success(`Отражено ${direction === 'horizontal' ? 'горизонтально' : 'вертикально'}`);
    }
  }, [fabricRef, updateDimensionLabels]);

  // Delete selected object
  const deleteSelectedObject = useCallback(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const obj = canvas.getActiveObject();
    if (obj) {
      // Also delete associated measurement parts
      if (obj.elementId) {
        canvas.getObjects().filter(o => o.parentId === obj.elementId).forEach(o => canvas.remove(o));
      }
      canvas.remove(obj);
      canvas.discardActiveObject();
      canvas.renderAll();
      if (updateDimensionLabels) updateDimensionLabels();
      toast.success('Объект удалён');
    }
  }, [fabricRef, updateDimensionLabels]);

  // Duplicate selected object
  const duplicateSelectedObject = useCallback(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const obj = canvas.getActiveObject();
    if (obj) {
      obj.clone((cloned) => {
        cloned.set({
          left: (obj.left || 0) + 20,
          top: (obj.top || 0) + 20,
          elementId: `${obj.elementType || 'obj'}-${Date.now()}`,
        });
        canvas.add(cloned);
        canvas.setActiveObject(cloned);
        canvas.renderAll();
        if (updateDimensionLabels) updateDimensionLabels();
        toast.success('Объект дублирован');
      });
    }
  }, [fabricRef, updateDimensionLabels]);

  return {
    addRoomToCanvas,
    addPartitionToRoom,
    addElementToCanvas,
    rotateSelectedObject,
    flipSelectedObject,
    deleteSelectedObject,
    duplicateSelectedObject,
  };
};

export default useCanvasOperations;
