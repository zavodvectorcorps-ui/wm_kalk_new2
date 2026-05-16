import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { STATUSES, PRIORITIES } from './constants';

const ALL = '__all__';

export default function PlannerFilters({ filters, setFilters, directions, users }) {
  const set = (k, v) => setFilters({ ...filters, [k]: v });
  const clearAll = () => setFilters({ search: '', status: '', priority: '', direction: '', assignee: '' });
  const hasActive =
    !!filters.search || !!filters.status || !!filters.priority || !!filters.direction || !!filters.assignee;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="planner-filters">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Поиск..."
          value={filters.search || ''}
          onChange={(e) => set('search', e.target.value)}
          className="pl-8 h-9"
          data-testid="planner-search"
        />
      </div>

      <Select value={filters.status || ALL} onValueChange={(v) => set('status', v === ALL ? '' : v)}>
        <SelectTrigger className="w-[150px] h-9" data-testid="filter-status"><SelectValue placeholder="Статус" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Все статусы</SelectItem>
          {STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.priority || ALL} onValueChange={(v) => set('priority', v === ALL ? '' : v)}>
        <SelectTrigger className="w-[140px] h-9" data-testid="filter-priority"><SelectValue placeholder="Приоритет" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Все приоритеты</SelectItem>
          {PRIORITIES.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.direction || ALL} onValueChange={(v) => set('direction', v === ALL ? '' : v)}>
        <SelectTrigger className="w-[170px] h-9" data-testid="filter-direction"><SelectValue placeholder="Направление" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Все направления</SelectItem>
          {(directions || []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.assignee || ALL} onValueChange={(v) => set('assignee', v === ALL ? '' : v)}>
        <SelectTrigger className="w-[170px] h-9" data-testid="filter-assignee"><SelectValue placeholder="Ответственный" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Все ответственные</SelectItem>
          <SelectItem value="__none__">— Без ответственного —</SelectItem>
          {(users || []).map((u) => <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>)}
        </SelectContent>
      </Select>

      {hasActive && (
        <Button variant="ghost" size="sm" onClick={clearAll} data-testid="filter-clear">
          <X className="w-4 h-4 mr-1" /> Сбросить
        </Button>
      )}
    </div>
  );
}
