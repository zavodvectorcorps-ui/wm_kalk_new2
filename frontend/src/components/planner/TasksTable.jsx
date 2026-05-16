import React from 'react';
import { MessageSquare, ListChecks, AlertTriangle, Calendar, UserX } from 'lucide-react';
import { STATUS_MAP, PRIORITY_MAP, isOverdue, formatDate, dirById } from './constants';

/**
 * TasksTable — fast overview with inline edit for status/priority/assignee.
 */
export default function TasksTable({ tasks, directions, users, onOpen, onPatch }) {
  return (
    <div className="border rounded-lg bg-card overflow-auto" data-testid="tasks-table">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 sticky top-0 z-10">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Название</th>
            <th className="px-3 py-2 font-medium w-36">Направление</th>
            <th className="px-3 py-2 font-medium w-40">Ответственный</th>
            <th className="px-3 py-2 font-medium w-32">Постановщик</th>
            <th className="px-3 py-2 font-medium w-36">Статус</th>
            <th className="px-3 py-2 font-medium w-32">Приоритет</th>
            <th className="px-3 py-2 font-medium w-28">Дедлайн</th>
            <th className="px-3 py-2 font-medium w-32">Обновлено</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr><td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">Нет задач по выбранным фильтрам</td></tr>
          ) : tasks.map((t) => (
            <TaskRow key={t.id} task={t} directions={directions} users={users} onOpen={onOpen} onPatch={onPatch} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskRow({ task, directions, users, onOpen, onPatch }) {
  const status = STATUS_MAP[task.status];
  const prio = PRIORITY_MAP[task.priority];
  const dir = dirById(directions, task.businessDirection);
  const overdue = isOverdue(task);
  const checklistDone = (task.checklist || []).filter((c) => c.done).length;
  const checklistTotal = (task.checklist || []).length;
  const commentsCount = (task.comments || []).length;

  return (
    <tr
      className={`border-t hover:bg-slate-50/70 cursor-pointer ${overdue ? 'bg-red-50/40' : ''}`}
      onClick={() => onOpen?.(task)}
      data-testid={`task-row-${task.id}`}
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {prio?.dot && <span className={`inline-block w-1.5 h-6 rounded ${prio.dot}`} title={prio.label} />}
          <div className="min-w-0">
            <div className="font-medium truncate max-w-[400px]">{task.title}</div>
            <div className="flex gap-2 mt-0.5 text-[11px] text-muted-foreground">
              {commentsCount > 0 && (
                <span className="inline-flex items-center gap-0.5"><MessageSquare className="w-3 h-3" />{commentsCount}</span>
              )}
              {checklistTotal > 0 && (
                <span className="inline-flex items-center gap-0.5"><ListChecks className="w-3 h-3" />{checklistDone}/{checklistTotal}</span>
              )}
              {!task.assigneeUserId && <span className="inline-flex items-center gap-0.5 text-amber-600"><UserX className="w-3 h-3" />без ответственного</span>}
              {!task.dueDate && <span className="text-slate-400">без срока</span>}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: dir.color }} />
          {dir.name}
        </span>
      </td>
      <td className="px-3 py-2 text-xs">
        <InlineSelect
          value={task.assigneeUserId || ''}
          options={[{ value: '', label: '— не назначен —' }, ...(users || []).map((u) => ({ value: u.id, label: u.username }))]}
          onChange={(v) => onPatch(task.id, { assigneeUserId: v })}
        />
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{task.createdByUsername || '—'}</td>
      <td className="px-3 py-2">
        <InlineSelect
          value={task.status}
          options={Object.values(STATUS_MAP).map((s) => ({ value: s.key, label: s.label, className: s.color }))}
          onChange={(v) => onPatch(task.id, { status: v })}
          renderAsBadge
        />
      </td>
      <td className="px-3 py-2">
        <InlineSelect
          value={task.priority}
          options={Object.values(PRIORITY_MAP).map((p) => ({ value: p.key, label: p.label, className: p.color }))}
          onChange={(v) => onPatch(task.id, { priority: v })}
          renderAsBadge
        />
      </td>
      <td className="px-3 py-2 text-xs">
        {task.dueDate ? (
          <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-600 font-semibold' : ''}`}>
            {overdue && <AlertTriangle className="w-3 h-3" />}
            <Calendar className="w-3 h-3" />
            {formatDate(task.dueDate)}
          </span>
        ) : <span className="text-slate-400">—</span>}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(task.updatedAt)}</td>
    </tr>
  );
}

function InlineSelect({ value, options, onChange, renderAsBadge }) {
  const current = options.find((o) => o.value === value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={`w-full bg-transparent border rounded px-1.5 py-0.5 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-400 ${
        renderAsBadge && current?.className ? current.className : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
