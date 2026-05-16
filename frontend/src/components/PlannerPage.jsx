import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { ArrowLeft, LayoutGrid, Table as TableIcon, Loader2, ClipboardList, AlertTriangle, Archive, Lightbulb, User as UserIcon, LayoutDashboard } from 'lucide-react';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { toast } from 'sonner';
import { getApiUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';

import PlannerDashboard from './planner/PlannerDashboard';
import PlannerFilters from './planner/PlannerFilters';
import TasksTable from './planner/TasksTable';
import TasksBoard from './planner/TasksBoard';
import TaskDrawer from './planner/TaskDrawer';
import QuickCreate from './planner/QuickCreate';
import { getAuthHeaders, isOverdue } from './planner/constants';

const API = getApiUrl();

const VIEWS = {
  table: { label: 'Таблица', icon: TableIcon },
  board: { label: 'Доска',   icon: LayoutGrid },
};

const TABS = [
  { key: 'dashboard', label: 'Дашборд',     icon: LayoutDashboard },
  { key: 'all',       label: 'Все задачи',  icon: ClipboardList },
  { key: 'mine',      label: 'Мои задачи',  icon: UserIcon },
  { key: 'overdue',   label: 'Просрочено',  icon: AlertTriangle },
  { key: 'ideas',     label: 'Идеи',        icon: Lightbulb },
  { key: 'archive',   label: 'Архив',       icon: Archive },
];

export default function PlannerPage({ onBack }) {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [view, setView] = useState('table');
  const [tasks, setTasks] = useState([]);
  const [directions, setDirections] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openTask, setOpenTask] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', direction: '', assignee: '' });

  // ---------- LOAD ----------
  const loadDirections = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/planner/directions`, { headers: getAuthHeaders() });
      setDirections(r.data.items || []);
    } catch { /* ignore */ }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/users`, { headers: getAuthHeaders() });
      const seen = new Set();
      const deduped = (r.data || []).filter((u) => {
        if (!u?.id || seen.has(u.id)) return false;
        seen.add(u.id);
        return u.isActive !== false;
      });
      setUsers(deduped);
    } catch { /* ignore */ }
  }, []);

  const loadTasks = useCallback(async (tabKey, currentFilters) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tabKey === 'mine') params.set('mine', 'true');
    if (tabKey === 'overdue') params.set('overdue', 'true');
    if (tabKey === 'ideas') params.set('status', 'idea,planned');
    if (tabKey === 'archive') params.set('archived', 'true');
    if (currentFilters.search) params.set('search', currentFilters.search);
    if (currentFilters.status) params.set('status', currentFilters.status);
    if (currentFilters.priority) params.set('priority', currentFilters.priority);
    if (currentFilters.direction) params.set('direction', currentFilters.direction);
    if (currentFilters.assignee) params.set('assignee', currentFilters.assignee === '__none__' ? '' : currentFilters.assignee);
    try {
      const r = await axios.get(`${API}/api/planner/tasks?${params}`, { headers: getAuthHeaders() });
      setTasks(r.data.items || []);
    } catch (e) {
      toast.error('Не удалось загрузить задачи');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/planner/dashboard`, { headers: getAuthHeaders() });
      setStats(r.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadDirections(); loadUsers(); }, [loadDirections, loadUsers]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard();
      loadTasks('all', filters);
    } else {
      loadTasks(activeTab, filters);
    }
  }, [activeTab, filters, loadTasks, loadDashboard]);

  // ---------- ACTIONS ----------
  const patchTask = async (id, patch) => {
    // optimistic
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    try {
      const r = await axios.put(`${API}/api/planner/tasks/${id}`, patch, { headers: getAuthHeaders() });
      setTasks((prev) => prev.map((t) => (t.id === id ? r.data : t)));
      if (openTask?.id === id) setOpenTask(r.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка обновления');
      // re-fetch on error to undo optimistic
      loadTasks(activeTab, filters);
    }
  };

  const onTaskChanged = (updated) => {
    if (updated === null) {
      // task deleted
      setTasks((prev) => prev.filter((t) => t.id !== openTask?.id));
      setOpenTask(null);
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const onCreated = (task) => {
    setTasks((prev) => [task, ...prev]);
    if (activeTab === 'dashboard') loadDashboard();
  };

  // Counts for tab badges (derived from current tasks would be misleading
  // since each tab has different filters; use a simple display only).
  const overdueCount = useMemo(
    () => tasks.filter((t) => isOverdue(t)).length,
    [tasks],
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack} data-testid="planner-back">
              <ArrowLeft className="w-4 h-4 mr-1" /> Назад
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Планнер</h1>
            <p className="text-xs text-muted-foreground">Внутренние задачи команды</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1 bg-slate-100 rounded-md p-0.5">
          {Object.entries(VIEWS).map(([k, v]) => {
            const Icon = v.icon;
            return (
              <button
                key={k}
                onClick={() => setView(k)}
                className={`px-3 py-1 text-xs rounded inline-flex items-center gap-1 ${view === k ? 'bg-white shadow' : 'text-muted-foreground hover:text-foreground'}`}
                data-testid={`view-${k}`}
              >
                <Icon className="w-3.5 h-3.5" />{v.label}
              </button>
            );
          })}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.key} value={t.key} className="gap-1" data-testid={`tab-${t.key}`}>
                <Icon className="w-4 h-4" />
                {t.label}
                {t.key === 'overdue' && overdueCount > 0 && (
                  <span className="ml-1 bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded-full">{overdueCount}</span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Dashboard tab */}
        <TabsContent value="dashboard" className="space-y-4">
          <PlannerDashboard stats={stats} directions={directions} />
          <QuickCreate users={users} directions={directions} onCreated={onCreated} />
        </TabsContent>

        {/* All other tabs share the same body */}
        {TABS.filter((t) => t.key !== 'dashboard').map((t) => (
          <TabsContent key={t.key} value={t.key} className="space-y-3">
            <QuickCreate users={users} directions={directions} onCreated={onCreated} />
            <PlannerFilters filters={filters} setFilters={setFilters} directions={directions} users={users} />
            {loading ? (
              <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
            ) : view === 'board' ? (
              <TasksBoard tasks={tasks} directions={directions} onOpen={setOpenTask} onPatch={patchTask} />
            ) : (
              <TasksTable tasks={tasks} directions={directions} users={users} onOpen={setOpenTask} onPatch={patchTask} />
            )}
          </TabsContent>
        ))}
      </Tabs>

      {openTask && (
        <TaskDrawer
          task={openTask}
          users={users}
          directions={directions}
          currentUser={user}
          isAdmin={isAdmin ? isAdmin() : false}
          onClose={() => setOpenTask(null)}
          onChanged={onTaskChanged}
        />
      )}
    </div>
  );
}
