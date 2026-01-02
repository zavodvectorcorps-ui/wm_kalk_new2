import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '../../lib/utils';

// Sortable Item wrapper component
export const SortableItem = ({ id, children, disabled = false, className }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative',
        isDragging && 'shadow-lg ring-2 ring-primary/20 rounded-lg',
        className
      )}
    >
      {!disabled && (
        <div
          {...attributes}
          {...listeners}
          className="absolute left-0 top-1/2 -translate-y-1/2 p-1.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors z-10"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      <div className={cn(!disabled && 'pl-8')}>{children}</div>
    </div>
  );
};

// Main sortable list container
export const SortableList = ({
  items,
  onReorder,
  renderItem,
  keyExtractor = (item) => item.id,
  disabled = false,
  className,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => keyExtractor(item) === active.id);
      const newIndex = items.findIndex((item) => keyExtractor(item) === over.id);
      
      const newItems = arrayMove(items, oldIndex, newIndex);
      // Update sortOrder for all items
      const updatedItems = newItems.map((item, index) => ({
        ...item,
        sortOrder: index,
      }));
      
      onReorder(updatedItems);
    }
  };

  const itemIds = items.map((item) => keyExtractor(item));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className={cn('space-y-2', className)}>
          {items.map((item, index) => (
            <SortableItem
              key={keyExtractor(item)}
              id={keyExtractor(item)}
              disabled={disabled}
            >
              {renderItem(item, index)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default SortableList;
