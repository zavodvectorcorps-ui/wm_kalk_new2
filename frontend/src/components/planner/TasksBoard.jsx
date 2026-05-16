import React, { useState } from 'react';
import { MessageSquare, ListChecks, AlertTriangle, Calendar, UserX, GripVertical } from 'lucide-react';
import { STATUSES, STATUS_MAP, PRIORITY_MAP, isOverdue, formatDate, dirById } from './constants';

/**
 * TasksBoard — Kanban-style board grouped by status with native HTML5 drag-and-drop.
 */
export default function TasksBoard({ tasks, directions, onOpen, onPatch }) {
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const groups = STATUSES.map((s) => ({
    ...s,
    items: tasks.filter((t) => t.status === s.key),
  }));

  const handleDrop = (toStatus) => {
    if (draggingId) {
      const task = tasks.find((t) => t.id === draggingId);
      if (task && task.status !== toStatus) {
        onPatch(draggingId, { status: toStatus });
      }
    }
    setDraggingId(null);
    setDragOverCol(null);
  };

  return (
    <div className="grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-3 overflow-x-auto pb-2" data-testid="tasks-board">
      {groups.map((g) => (
        <div
          key={g.key}
          onDragOver={(e) => { e.preventDefault(); setDragOverCol(g.key); }}
          onDragLeave={() => setDragOverCol((c) => (c === g.key ? null : c))}
          onDrop={() => handleDrop(g.key)}
          className={`flex flex-col rounded-lg border ${g.bgSoft} ${dragOverCol === g.key ? 'ring-2 ring-orange-400' : ''}`}
          data-testid={`board-col-${g.key}`}
        >
          <div className="px-3 py-2 border-b flex items-center justify-between sticky top-0 bg-inherit z-10 rounded-t-lg">
            <span className={`inline-flex items-center gap-2 text-xs px-2 py-0.5 rounded border ${g.color}`}>
              {g.label}
            </span>
            <span className="text-xs text-muted-foreground">{g.items.length}</span>
          </div>
          <div className="p-2 space-y-2 min-h-[80px] flex-1">
            {g.items.length === 0 && (
              <div className="text-[11px] text-muted-foreground text-center py-3">
                {dragOverCol === g.key ? 'Отпустите задачу здесь' : '—'}
              </div>
            )}
            {g.items.map((t) => (
              <BoardCard
                key={t.id}
                task={t}
                directions={directions}
                onOpen={onOpen}
                onDragStart={() => setDraggingId(t.id)}
                onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                isDragging={draggingId === t.id}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BoardCard({ task, directions, onOpen, onDragStart, onDragEnd, isDragging }) {
  const prio = PRIORITY_MAP[task.priority];
  const dir = dirById(directions, task.businessDirection);
  const overdue = isOverdue(task);
  const checklistDone = (task.checklist || []).filter((c) => c.done).length;
  const checklistTotal = (task.checklist || []).length;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(task)}
      className={`bg-white border rounded-md p-2.5 shadow-sm cursor-pointer hover:shadow-md transition-shadow group ${
        isDragging ? 'opacity-40' : ''
      } ${overdue ? 'border-red-300' : ''}`}
      data-testid={`board-card-${task.id}`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0 group-hover:text-slate-500" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-tight">{task.title}</div>
          <div className="flex flex-wrap gap-1 mt-2">
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: dir.color, color: dir.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dir.color }} />
              {dir.name}
            </span>
            {prio && (
              <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border ${prio.color}`}>
                {prio.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
            {task.assigneeUsername ? (
              <span className="inline-flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-slate-200 inline-flex items-center justify-center text-[9px] text-slate-700 font-bold">
                  {(task.assigneeUsername[0] || '?').toUpperCase()}
                </span>
                {task.assigneeUsername}
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-amber-600"><UserX className="w-3 h-3" />не назначен</span>
            )}
            {task.dueDate && (
              <span className={`inline-flex items-center gap-0.5 ${overdue ? 'text-red-600 font-medium' : ''}`}>
                {overdue && <AlertTriangle className="w-3 h-3" />}
                <Calendar className="w-3 h-3" />{formatDate(task.dueDate)}
              </span>
            )}
            {(task.comments || []).length > 0 && (
              <span className="inline-flex items-center gap-0.5"><MessageSquare className="w-3 h-3" />{task.comments.length}</span>
            )}
            {checklistTotal > 0 && (
              <span className="inline-flex items-center gap-0.5"><ListChecks className="w-3 h-3" />{checklistDone}/{checklistTotal}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
