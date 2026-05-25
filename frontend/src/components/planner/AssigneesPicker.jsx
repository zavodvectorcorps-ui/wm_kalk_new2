import React, { useMemo, useState } from 'react';
import { Check, X, Users, ChevronDown } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Input } from '../ui/input';

/**
 * AssigneesPicker — popover-based multi-select for task assignees.
 *
 * Props:
 *  - value: string[]    — selected user ids
 *  - users: User[]      — full user list ({id, username, ...})
 *  - onChange(ids[])    — fires after each toggle/clear
 *  - placeholder, size ('sm'|'md'), buttonClassName, testId
 *
 * Renders a button that shows initials of up to 3 selected users + a "+N"
 * overflow badge. Opening the popover reveals a searchable checkbox list.
 */
export default function AssigneesPicker({
  value = [],
  users = [],
  onChange,
  placeholder = 'Ответственные',
  size = 'md',
  buttonClassName = '',
  testId = 'assignees-picker',
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedSet = useMemo(() => new Set(value || []), [value]);
  const selectedUsers = useMemo(
    () => (value || []).map((id) => users.find((u) => u.id === id)).filter(Boolean),
    [value, users],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.username || '').toLowerCase().includes(q));
  }, [search, users]);

  const toggle = (id) => {
    const cur = new Set(value || []);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    onChange?.([...cur]);
  };

  const clearAll = (e) => {
    e?.stopPropagation();
    onChange?.([]);
  };

  const heightCls = size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-1.5 px-2 rounded-md border bg-background hover:bg-accent transition-colors ${heightCls} ${buttonClassName}`}
          data-testid={testId}
        >
          {selectedUsers.length === 0 ? (
            <>
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground truncate">{placeholder}</span>
            </>
          ) : (
            <span className="flex items-center gap-1 truncate">
              <span className="flex -space-x-1.5">
                {selectedUsers.slice(0, 3).map((u) => (
                  <span
                    key={u.id}
                    title={u.username}
                    className="w-5 h-5 rounded-full bg-slate-200 ring-1 ring-white inline-flex items-center justify-center text-[10px] text-slate-700 font-bold"
                  >
                    {(u.username?.[0] || '?').toUpperCase()}
                  </span>
                ))}
              </span>
              {selectedUsers.length > 3 && (
                <span className="ml-1 text-[10px] text-muted-foreground">+{selectedUsers.length - 3}</span>
              )}
              <span className="ml-1 truncate max-w-[120px]">
                {selectedUsers.length === 1
                  ? selectedUsers[0].username
                  : `${selectedUsers.length} чел.`}
              </span>
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Ответственные {value.length > 0 && `(${value.length})`}
            </span>
            {value.length > 0 && (
              <button
                onClick={clearAll}
                className="text-[10px] text-muted-foreground hover:text-red-600 inline-flex items-center gap-1"
                data-testid={`${testId}-clear`}
              >
                <X className="w-3 h-3" /> Снять всех
              </button>
            )}
          </div>
          <Input
            placeholder="Поиск пользователя…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
            data-testid={`${testId}-search`}
          />
          <div className="max-h-[260px] overflow-y-auto -mx-1 space-y-0.5">
            {filtered.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">Никого не найдено</div>
            ) : filtered.map((u) => {
              const checked = selectedSet.has(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggle(u.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-left ${
                    checked ? 'bg-orange-50/60' : ''
                  }`}
                  data-testid={`${testId}-option-${u.id}`}
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      checked ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-300'
                    }`}
                  >
                    {checked && <Check className="w-3 h-3" />}
                  </span>
                  <span className="w-6 h-6 rounded-full bg-slate-200 inline-flex items-center justify-center text-[10px] text-slate-700 font-bold shrink-0">
                    {(u.username?.[0] || '?').toUpperCase()}
                  </span>
                  <span className="text-sm truncate">{u.username}</span>
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
