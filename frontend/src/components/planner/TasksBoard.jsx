import React, { useState, useMemo } from 'react';
import { MessageSquare, ListChecks, AlertTriangle, Calendar, UserX, GripVertical, CheckCircle2, Circle, Users } from 'lucide-react';
import { PRIORITY_MAP, isOverdue, formatDate, dirById } from './constants';

/**
 * TasksBoard — Kanban-style board grouped by business DIRECTION (category).
 * Tasks are moved between directions via drag-and-drop. A standalone checkbox
 * on each card toggles the "done" status without needing to open the drawer.
 */
export default function TasksBoard({ tasks, directions, onOpen, onPatch }) {
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  // Build groups: one column per direction (in stored sortOrder).
  const groups = useMemo(() => {
    const dirs = (directions && directions.length > 0)
      ? [...directions].sort((a, b) => (a.sortOrder || 100) - (b.sortOrder || 100))
      : [{ id: 'other', name: 'Другое', color: '#94a3b8' }];
    return dirs.map((d) => ({
      ...d,
      items: tasks.filter((t) => (t.businessDirection || 'other') === d.id),
    }));
  }, [tasks, directions]);

  const handleDrop = (toDirectionId) => {
    if (draggingId) {
      const task = tasks.find((t) => t.id === draggingId);
      if (task && (task.businessDirection || 'other') !== toDirectionId) {
        onPatch(draggingId, { businessDirection: toDirectionId });
      }
    }
    setDraggingId(null);
    setDragOverCol(null);
  };

  return (
    <div
      className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-3 overflow-x-auto pb-2"
      data-testid="tasks-board"
    >
      {groups.map((g) => (
        <div
          key={g.id}
          onDragOver={(e) => { e.preventDefault(); setDragOverCol(g.id); }}
          onDragLeave={() => setDragOverCol((c) => (c === g.id ? null : c))}
          onDrop={() => handleDrop(g.id)}
          className={`flex flex-col rounded-lg border bg-slate-50/40 ${dragOverCol === g.id ? 'ring-2 ring-orange-400' : ''}`}
          data-testid={`board-col-${g.id}`}
          style={{ borderTopColor: g.color, borderTopWidth: '3px' }}
        >
          <div className="px-3 py-2 border-b flex items-center justify-between sticky top-0 bg-white/80 z-10 rounded-t-lg backdrop-blur">
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
              {g.name}
            </span>
            <span className="text-xs text-muted-foreground">{g.items.length}</span>
          </div>
          <div className="p-2 space-y-2 min-h-[80px] flex-1">
            {g.items.length === 0 && (
              <div className="text-[11px] text-muted-foreground text-center py-3">
                {dragOverCol === g.id ? 'Отпустите задачу здесь' : '—'}
              </div>
            )}
            {g.items.map((t) => (
              <BoardCard
                key={t.id}
                task={t}
                directions={directions}
                onOpen={onOpen}
                onPatch={onPatch}
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

function BoardCard({ task, directions, onOpen, onPatch, onDragStart, onDragEnd, isDragging }) {
  const prio = PRIORITY_MAP[task.priority];
  const dir = dirById(directions, task.businessDirection);
  const overdue = isOverdue(task);
  const checklistDone = (task.checklist || []).filter((c) => c.done).length;
  const checklistTotal = (task.checklist || []).length;
  const isDone = task.status === 'done';
  const isCancelled = task.status === 'cancelled';
  // Normalise assignees: support both new array fields and legacy single ones.
  const assigneeNames = (task.assigneeUsernames && task.assigneeUsernames.length)
    ? task.assigneeUsernames
    : (task.assigneeUsername ? [task.assigneeUsername] : []);
  const isGeneral = assigneeNames.length === 0;

  const toggleDone = (e) => {
    e.stopPropagation();
    onPatch(task.id, { status: isDone ? 'planned' : 'done' });
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(task)}
      className={`bg-white border rounded-md p-2.5 shadow-sm cursor-pointer hover:shadow-md transition-shadow group ${
        isDragging ? 'opacity-40' : ''
      } ${overdue ? 'border-red-300' : ''} ${isDone ? 'opacity-70 bg-emerald-50/40 border-emerald-200' : ''} ${isCancelled ? 'opacity-60' : ''}`}
      data-testid={`board-card-${task.id}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={toggleDone}
          className={`mt-0.5 shrink-0 transition-colors ${isDone ? 'text-emerald-600' : 'text-slate-300 hover:text-orange-500'}`}
          title={isDone ? 'Снять отметку «выполнено»' : 'Отметить как выполнено'}
          data-testid={`board-card-toggle-${task.id}`}
        >
          {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
        </button>
        <GripVertical className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0 group-hover:text-slate-500" />
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium leading-tight ${isDone ? 'line-through text-muted-foreground' : ''}`}>
            {task.title}
          </div>
          {task.description && (
            <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
              {task.description}
            </div>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {prio && (
              <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border ${prio.color}`}>
                {prio.label}
              </span>
            )}
            {!isDone && (
              <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200">
                {task.status === 'idea' && 'Идея'}
                {task.status === 'planned' && 'Запланировано'}
                {task.status === 'in_progress' && 'В работе'}
                {task.status === 'review' && 'На проверке'}
                {task.status === 'cancelled' && 'Отменено'}
              </span>
            )}
          </div>
          <div className="flex items-center flex-wrap gap-2 mt-2 text-[11px] text-muted-foreground">
            {isGeneral ? (
              <span className="inline-flex items-center gap-1 text-slate-500" title="Общая задача">
                <Users className="w-3 h-3" /> Общая задача
              </span>
            ) : (
              <span className="inline-flex items-center gap-1" title={assigneeNames.join(', ')}>
                <span className="flex -space-x-1">
                  {assigneeNames.slice(0, 3).map((nm, i) => (
                    <span
                      key={i}
                      className="w-4 h-4 rounded-full bg-slate-200 ring-1 ring-white inline-flex items-center justify-center text-[9px] text-slate-700 font-bold"
                    >
                      {(nm?.[0] || '?').toUpperCase()}
                    </span>
                  ))}
                </span>
                {assigneeNames.length === 1 ? (
                  <span className="ml-1">{assigneeNames[0]}</span>
                ) : (
                  <span className="ml-1">{assigneeNames.length} чел.</span>
                )}
                {assigneeNames.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">(+{assigneeNames.length - 3})</span>
                )}
              </span>
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
