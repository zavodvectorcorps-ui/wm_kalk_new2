import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Users, Plus, Pencil, Trash2, Waves, Flame, Shield, Save, X, Eye, Truck, Package, Kanban, GraduationCap, BarChart3, Phone, Building2, ClipboardList } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';

// Smart API URL - auto-detect on production
const getApiUrl = () => { 
  if (typeof window !== 'undefined') { 
    const o = window.location.origin; 
    if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
  } 
  return process.env.REACT_APP_BACKEND_URL || ''; 
};
const API_URL = getApiUrl();

export const UserManagement = () => {
  const { i18n } = useTranslation();
  const { token, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({ username: '', password: '', access: ['balia', 'sauna', 'logistics'], role: 'employee', amocrm_name: '' });
  
  // Check if current user is super-admin (can assign admin role)
  const canAssignAdminRole = isSuperAdmin && isSuperAdmin();

  const texts = {
    ru: {
      title: 'Управление сотрудниками',
      addEmployee: 'Добавить сотрудника',
      username: 'Имя пользователя',
      password: 'Пароль',
      newPassword: 'Новый пароль (оставьте пустым, чтобы не менять)',
      access: 'Доступ к разделам',
      accessBalia: 'Balia (Купели)',
      accessSauna: 'Sauna (Сауны)',
      accessLogistics: 'Логистика',
      accessDriver: 'Кабинет водителя',
      accessWarehouse: 'Склад',
      accessSaunaCrm: 'CRM саун',
      accessSaunaProduction: 'Производство саун',
      accessTraining: 'Обучение',
      accessAnalytics: 'Аналитика лидов',
      accessCallAnalytics: 'Аналитика звонков',
      accessDealers: 'Дилеры',
      accessPlanner: 'Планнер',
      accessAll: 'Все разделы',
      role: 'Роль',
      admin: 'Администратор',
      employee: 'Сотрудник',
      observer: 'Наблюдатель',
      driver: 'Водитель',
      storekeeper: 'Кладовщик',
      marketer: 'Маркетолог',
      roleAdmin: 'Администратор (полный доступ и скидки)',
      roleEmployee: 'Сотрудник (может создавать заказы)',
      roleObserver: 'Наблюдатель (только просмотр)',
      roleDriver: 'Водитель (доступ к кабинету водителя)',
      roleStorekeeper: 'Кладовщик (склад + логистика просмотр)',
      roleMarketer: 'Маркетолог (цены, модели, опции)',
      actions: 'Действия',
      edit: 'Редактировать',
      delete: 'Удалить',
      save: 'Сохранить',
      cancel: 'Отмена',
      addTitle: 'Добавить сотрудника',
      addDesc: 'Создайте новую учетную запись сотрудника',
      editTitle: 'Редактировать сотрудника',
      editDesc: 'Измените данные сотрудника',
      deleteTitle: 'Удалить сотрудника',
      deleteDesc: 'Вы уверены, что хотите удалить этого сотрудника?',
      deleteConfirm: 'Удалить',
      noUsers: 'Сотрудники не найдены',
      created: 'Создан',
      userAdded: 'Сотрудник добавлен!',
      userUpdated: 'Сотрудник обновлен!',
      userDeleted: 'Сотрудник удален!',
      error: 'Произошла ошибка',
      usernameExists: 'Имя пользователя уже существует',
    },
    pl: {
      title: 'Zarządzanie pracownikami',
      addEmployee: 'Dodaj pracownika',
      username: 'Nazwa użytkownika',
      password: 'Hasło',
      newPassword: 'Nowe hasło (pozostaw puste, aby nie zmieniać)',
      access: 'Dostęp do sekcji',
      accessBalia: 'Balia',
      accessSauna: 'Sauna',
      accessLogistics: 'Logistyka',
      accessDriver: 'Panel kierowcy',
      accessWarehouse: 'Magazyn',
      accessSaunaCrm: 'CRM saun',
      accessSaunaProduction: 'Produkcja saun',
      accessTraining: 'Szkolenia',
      accessAnalytics: 'Analityka leadów',
      accessCallAnalytics: 'Analityka połączeń',
      accessDealers: 'Dilerzy',
      accessPlanner: 'Planer zadań',
      accessAll: 'Wszystkie sekcje',
      role: 'Rola',
      admin: 'Administrator',
      employee: 'Pracownik',
      observer: 'Obserwator',
      driver: 'Kierowca',
      storekeeper: 'Magazynier',
      marketer: 'Marketer',
      roleAdmin: 'Administrator (pełny dostęp i rabaty)',
      roleEmployee: 'Pracownik (może tworzyć zamówienia)',
      roleObserver: 'Obserwator (tylko podgląd)',
      roleDriver: 'Kierowca (dostęp do panelu kierowcy)',
      roleStorekeeper: 'Magazynier (magazyn + logistyka podgląd)',
      roleMarketer: 'Marketer (ceny, modele, opcje)',
      actions: 'Akcje',
      edit: 'Edytuj',
      delete: 'Usuń',
      save: 'Zapisz',
      cancel: 'Anuluj',
      addTitle: 'Dodaj pracownika',
      addDesc: 'Utwórz nowe konto pracownika',
      editTitle: 'Edytuj pracownika',
      editDesc: 'Zmień dane pracownika',
      deleteTitle: 'Usuń pracownika',
      deleteDesc: 'Czy na pewno chcesz usunąć tego pracownika?',
      deleteConfirm: 'Usuń',
      noUsers: 'Nie znaleziono pracowników',
      created: 'Utworzono',
      userAdded: 'Pracownik dodany!',
      userUpdated: 'Pracownik zaktualizowany!',
      userDeleted: 'Pracownik usunięty!',
      error: 'Wystąpił błąd',
      usernameExists: 'Nazwa użytkownika już istnieje',
    },
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  // Single source of truth — adding a new section here makes it appear in
  // both Add+Edit dialogs and in the access badges automatically.
  const ACCESS_SECTIONS = [
    { key: 'balia', label: txt.accessBalia, icon: Waves, iconClass: 'text-blue-500', badgeClass: '' },
    { key: 'sauna', label: txt.accessSauna, icon: Flame, iconClass: 'text-orange-500', badgeClass: 'bg-orange-100 text-orange-700' },
    { key: 'logistics', label: txt.accessLogistics, icon: Truck, iconClass: 'text-teal-500', badgeClass: 'bg-teal-100 text-teal-700' },
    { key: 'driver', label: txt.accessDriver, icon: Truck, iconClass: 'text-green-500', badgeClass: 'bg-green-100 text-green-700' },
    { key: 'warehouse', label: txt.accessWarehouse, icon: Package, iconClass: 'text-amber-500', badgeClass: 'bg-amber-100 text-amber-700' },
    { key: 'sauna_crm', label: txt.accessSaunaCrm, icon: Flame, iconClass: 'text-rose-500', badgeClass: 'bg-rose-100 text-rose-700' },
    { key: 'sauna_production', label: txt.accessSaunaProduction, icon: Kanban, iconClass: 'text-pink-500', badgeClass: 'bg-pink-100 text-pink-700' },
    { key: 'training', label: txt.accessTraining, icon: GraduationCap, iconClass: 'text-indigo-500', badgeClass: 'bg-indigo-100 text-indigo-700' },
    { key: 'analytics', label: txt.accessAnalytics, icon: BarChart3, iconClass: 'text-indigo-600', badgeClass: 'bg-indigo-100 text-indigo-700' },
    { key: 'call_analytics', label: txt.accessCallAnalytics, icon: Phone, iconClass: 'text-teal-600', badgeClass: 'bg-teal-100 text-teal-700' },
    { key: 'dealers', label: txt.accessDealers, icon: Building2, iconClass: 'text-orange-600', badgeClass: 'bg-orange-100 text-orange-700' },
    { key: 'planner', label: txt.accessPlanner, icon: ClipboardList, iconClass: 'text-rose-600', badgeClass: 'bg-rose-100 text-rose-700' },
  ];

  const toggleAccess = (key, checked) => {
    const cur = Array.isArray(formData.access) ? formData.access : [formData.access];
    const next = checked
      ? [...cur.filter((a) => a !== 'all' && a !== key), key]
      : cur.filter((a) => a !== key);
    setFormData({ ...formData, access: next });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      toast.error(txt.error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(txt.userAdded);
        setIsAddDialogOpen(false);
        setFormData({ username: '', password: '', access: ['balia', 'sauna', 'logistics'], role: 'employee', amocrm_name: '' });
        fetchUsers();
      } else {
        const error = await response.json();
        if (error.detail?.includes('exists')) {
          toast.error(txt.usernameExists);
        } else {
          toast.error(txt.error);
        }
      }
    } catch (err) {
      toast.error(txt.error);
    }
  };

  const handleEditUser = async () => {
    try {
      const updateData = {
        username: formData.username,
        access: formData.access,
        role: formData.role,
        amocrm_name: formData.amocrm_name || ''
      };
      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await fetch(`${API_URL}/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        toast.success(txt.userUpdated);
        setIsEditDialogOpen(false);
        setSelectedUser(null);
        setFormData({ username: '', password: '', access: ['balia', 'sauna', 'logistics'], role: 'employee', amocrm_name: '' });
        fetchUsers();
      } else {
        const error = await response.json();
        if (error.detail?.includes('exists')) {
          toast.error(txt.usernameExists);
        } else {
          toast.error(txt.error);
        }
      }
    } catch (err) {
      toast.error(txt.error);
    }
  };

  const handleDeleteUser = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/${selectedUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success(txt.userDeleted);
        setIsDeleteDialogOpen(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        toast.error(txt.error);
      }
    } catch (err) {
      toast.error(txt.error);
    }
  };

  const openEditDialog = (user) => {
    setSelectedUser(user);
    // Convert legacy string access to array
    let accessArray = user.access;
    if (typeof user.access === 'string') {
      if (user.access === 'all') {
        accessArray = ['balia', 'sauna', 'logistics'];
      } else {
        accessArray = [user.access];
      }
    }
    setFormData({ username: user.username, password: '', access: accessArray, role: user.role, amocrm_name: user.amocrm_name || '' });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (user) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const getAccessBadge = (access) => {
    // Handle array access
    if (Array.isArray(access)) {
      if (access.length === 3 && access.includes('balia') && access.includes('sauna') && access.includes('logistics')) {
        return (
          <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700">
            <Shield className="w-3 h-3" />
            {txt.accessAll}
          </Badge>
        );
      }
      return (
        <div className="flex flex-wrap gap-1">
          {ACCESS_SECTIONS.filter((s) => access.includes(s.key)).map((s) => {
            const Icon = s.icon;
            return (
              <Badge key={s.key} variant="secondary" className={`gap-1 ${s.badgeClass}`}>
                <Icon className="w-3 h-3" />
                {s.label}
              </Badge>
            );
          })}
        </div>
      );
    }
    
    // Legacy string access
    switch (access) {
      case 'balia':
        return (
          <Badge variant="secondary" className="gap-1">
            <Waves className="w-3 h-3" />
            Balia
          </Badge>
        );
      case 'sauna':
        return (
          <Badge variant="secondary" className="gap-1 bg-orange-100 text-orange-700">
            <Flame className="w-3 h-3" />
            Sauna
          </Badge>
        );
      case 'logistics':
        return (
          <Badge variant="secondary" className="gap-1 bg-teal-100 text-teal-700">
            <Truck className="w-3 h-3" />
            Logistics
          </Badge>
        );
      case 'all':
        return (
          <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700">
            <Shield className="w-3 h-3" />
            {txt.accessAll}
          </Badge>
        );
      default:
        return null;
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return (
          <Badge variant="secondary" className="gap-1 bg-purple-100 text-purple-700">
            <Shield className="w-3 h-3" />
            {txt.admin}
          </Badge>
        );
      case 'employee':
        return (
          <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-700">
            {txt.employee}
          </Badge>
        );
      case 'observer':
        return (
          <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700">
            {txt.observer}
          </Badge>
        );
      case 'driver':
        return (
          <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700">
            <Truck className="w-3 h-3" />
            {txt.driver}
          </Badge>
        );
      case 'storekeeper':
        return (
          <Badge variant="secondary" className="gap-1 bg-teal-100 text-teal-700">
            <Package className="w-3 h-3" />
            {txt.storekeeper}
          </Badge>
        );
      case 'marketer':
        return (
          <Badge variant="secondary" className="gap-1 bg-pink-100 text-pink-700">
            <BarChart3 className="w-3 h-3" />
            {txt.marketer}
          </Badge>
        );
      default:
        return null;
    }
  };

  // Show employees, observers, drivers and admins (except the main 'admin' account)
  const employees = users.filter(u => u.role === 'employee' || u.role === 'observer' || u.role === 'driver' || u.role === 'storekeeper' || u.role === 'marketer' || (u.role === 'admin' && u.username !== 'admin'));

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-xl">{txt.title}</CardTitle>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            {txt.addEmployee}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {txt.noUsers}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{txt.username}</TableHead>
                    <TableHead>amoCRM</TableHead>
                    <TableHead>{txt.role}</TableHead>
                    <TableHead>{txt.access}</TableHead>
                    <TableHead>{txt.created}</TableHead>
                    <TableHead className="text-right">{txt.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{user.amocrm_name || '—'}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{getAccessBadge(user.access)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {/* Hide edit/delete for admin users if current user is not super-admin */}
                        {(user.role !== 'admin' || canAssignAdminRole) && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(user)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => openDeleteDialog(user)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{txt.addTitle}</DialogTitle>
            <DialogDescription>{txt.addDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{txt.username}</Label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder={txt.username}
              />
            </div>
            <div className="space-y-2">
              <Label>{txt.password}</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={txt.password}
              />
            </div>
            <div className="space-y-2">
              <Label>Имя в amoCRM</Label>
              <Input
                value={formData.amocrm_name}
                onChange={(e) => setFormData({ ...formData, amocrm_name: e.target.value })}
                placeholder="Имя ответственного в amoCRM"
                data-testid="user-amocrm-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>{txt.role}</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Admin role - only visible for super-admin */}
                  {canAssignAdminRole && (
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-purple-600" />
                        {txt.roleAdmin}
                      </div>
                    </SelectItem>
                  )}
                  <SelectItem value="employee">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {txt.roleEmployee}
                    </div>
                  </SelectItem>
                  <SelectItem value="observer">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      {txt.roleObserver}
                    </div>
                  </SelectItem>
                  <SelectItem value="driver">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-green-600" />
                      {txt.roleDriver}
                    </div>
                  </SelectItem>
                  <SelectItem value="storekeeper">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-teal-600" />
                      {txt.roleStorekeeper}
                    </div>
                  </SelectItem>
                  <SelectItem value="marketer">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-pink-600" />
                      {txt.roleMarketer}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{txt.access}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border rounded-md">
                {ACCESS_SECTIONS.map((s) => {
                  const Icon = s.icon;
                  const isChecked = Array.isArray(formData.access) && formData.access.includes(s.key);
                  return (
                    <div key={s.key} className="flex items-center gap-3">
                      <Checkbox
                        id={`add-access-${s.key}`}
                        checked={isChecked}
                        onCheckedChange={(c) => toggleAccess(s.key, c)}
                        data-testid={`add-access-${s.key}`}
                      />
                      <label htmlFor={`add-access-${s.key}`} className="flex items-center gap-2 cursor-pointer text-sm">
                        <Icon className={`w-4 h-4 ${s.iconClass}`} />
                        {s.label}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              {txt.cancel}
            </Button>
            <Button onClick={handleAddUser} disabled={!formData.username || !formData.password || formData.access.length === 0}>
              <Save className="w-4 h-4 mr-2" />
              {txt.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{txt.editTitle}</DialogTitle>
            <DialogDescription>{txt.editDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{txt.username}</Label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder={txt.username}
              />
            </div>
            <div className="space-y-2">
              <Label>{txt.newPassword}</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>Имя в amoCRM</Label>
              <Input
                value={formData.amocrm_name}
                onChange={(e) => setFormData({ ...formData, amocrm_name: e.target.value })}
                placeholder="Имя ответственного в amoCRM"
                data-testid="edit-user-amocrm-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>{txt.role}</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Admin role - only visible for super-admin */}
                  {canAssignAdminRole && (
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-purple-600" />
                        {txt.roleAdmin}
                      </div>
                    </SelectItem>
                  )}
                  <SelectItem value="employee">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {txt.roleEmployee}
                    </div>
                  </SelectItem>
                  <SelectItem value="observer">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      {txt.roleObserver}
                    </div>
                  </SelectItem>
                  <SelectItem value="driver">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-green-600" />
                      {txt.roleDriver}
                    </div>
                  </SelectItem>
                  <SelectItem value="storekeeper">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-teal-600" />
                      {txt.roleStorekeeper}
                    </div>
                  </SelectItem>
                  <SelectItem value="marketer">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-pink-600" />
                      {txt.roleMarketer}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{txt.access}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border rounded-md">
                {ACCESS_SECTIONS.map((s) => {
                  const Icon = s.icon;
                  const isChecked = Array.isArray(formData.access) && formData.access.includes(s.key);
                  return (
                    <div key={s.key} className="flex items-center gap-3">
                      <Checkbox
                        id={`edit-access-${s.key}`}
                        checked={isChecked}
                        onCheckedChange={(c) => toggleAccess(s.key, c)}
                        data-testid={`edit-access-${s.key}`}
                      />
                      <label htmlFor={`edit-access-${s.key}`} className="flex items-center gap-2 cursor-pointer text-sm">
                        <Icon className={`w-4 h-4 ${s.iconClass}`} />
                        {s.label}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              {txt.cancel}
            </Button>
            <Button onClick={handleEditUser} disabled={!formData.username || (Array.isArray(formData.access) && formData.access.length === 0)}>
              <Save className="w-4 h-4 mr-2" />
              {txt.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{txt.deleteTitle}</DialogTitle>
            <DialogDescription>
              {txt.deleteDesc}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <p className="font-medium">{selectedUser.username}</p>
              <p className="text-sm text-muted-foreground">{getAccessBadge(selectedUser.access)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {txt.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              <Trash2 className="w-4 h-4 mr-2" />
              {txt.deleteConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
