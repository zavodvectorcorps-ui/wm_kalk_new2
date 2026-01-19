import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { 
  HelpCircle, 
  Book, 
  Package, 
  Link2, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Download,
  Image as ImageIcon,
  Video,
  ChevronDown,
  Search,
  MessageSquareQuote,
  ThumbsUp
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Category labels - products first as requested
const CATEGORY_LABELS = {
  products: { label: 'Товары и опции', icon: Package },
  calculator_guide: { label: 'Работа с калькулятором', icon: Book },
  amocrm_integration: { label: 'Интеграция с amoCRM', icon: Link2 },
  objections: { label: 'Возражения клиентов', icon: MessageSquareQuote }
};

const OBJECTION_CATEGORIES = {
  general: 'Общее',
  price: 'Цена',
  quality: 'Качество',
  delivery: 'Доставка',
  warranty: 'Гарантия',
  competitors: 'Конкуренты'
};

const CALCULATOR_LABELS = {
  sauna: 'Сауна',
  balia: 'Купель',
  both: 'Общее'
};

// FAQ View Component (for managers)
export const FAQView = ({ calculatorType = 'both' }) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [objections, setObjections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('products');
  const [showObjectionDialog, setShowObjectionDialog] = useState(false);
  const [newObjection, setNewObjection] = useState({ question: '', context: '', category: 'general' });

  const isAdmin = user?.role === 'admin';
  const userId = user?.id || user?.username;
  const username = user?.username;

  useEffect(() => {
    fetchItems();
    fetchObjections();
  }, [calculatorType]);

  const fetchItems = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/faq?calculator_type=${calculatorType}`);
      setItems(response.data.filter(item => item.isActive));
    } catch (error) {
      console.error('Error fetching FAQ:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchObjections = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/training/objections?status=answered`);
      setObjections(response.data.filter(obj => obj.status === 'answered'));
    } catch (error) {
      console.error('Error fetching objections:', error);
    }
  };

  const handleMarkHelpful = async (id) => {
    try {
      await axios.post(`${API_URL}/api/training/objections/${id}/helpful`);
      toast.success('Спасибо за оценку!');
      fetchObjections();
    } catch (error) {
      console.error('Error marking helpful:', error);
    }
  };

  // Submit new objection
  const handleSubmitObjection = async () => {
    if (!newObjection.question.trim()) {
      toast.error('Введите текст возражения');
      return;
    }

    try {
      await axios.post(`${API_URL}/api/training/objections?user_id=${userId}&username=${username}`, newObjection);
      toast.success('Возражение отправлено! Администратор скоро ответит.');
      setNewObjection({ question: '', context: '', category: 'general' });
      setShowObjectionDialog(false);
      fetchObjections();
    } catch (error) {
      console.error('Error submitting objection:', error);
      toast.error('Ошибка отправки');
    }
  };

  // Print objections as memo
  const handlePrintObjections = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Памятка: Возражения клиентов</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; margin-bottom: 30px; font-size: 24px; }
          .objection { 
            display: flex; 
            margin-bottom: 20px; 
            border: 1px solid #ddd; 
            border-radius: 8px;
            overflow: hidden;
          }
          .left { 
            width: 40%; 
            background: #fff3cd; 
            padding: 15px;
            border-right: 2px solid #ddd;
          }
          .right { 
            width: 60%; 
            background: #d4edda; 
            padding: 15px;
          }
          .label { 
            font-weight: bold; 
            font-size: 12px; 
            color: #666;
            margin-bottom: 8px;
            text-transform: uppercase;
          }
          .question { font-weight: bold; font-size: 14px; }
          .answer { font-size: 14px; white-space: pre-wrap; }
          .script { 
            margin-top: 10px; 
            padding-top: 10px; 
            border-top: 1px dashed #aaa;
            font-size: 13px;
            color: #555;
          }
          .category { 
            display: inline-block;
            background: #e9ecef;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            margin-top: 8px;
          }
          @media print {
            .objection { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <h1>📋 Памятка: Работа с возражениями клиентов</h1>
        ${objections.map(obj => `
          <div class="objection">
            <div class="left">
              <div class="label">❓ Возражение клиента:</div>
              <div class="question">${obj.question}</div>
              <div class="category">${OBJECTION_CATEGORIES[obj.category] || obj.category}</div>
            </div>
            <div class="right">
              <div class="label">✅ Ответ:</div>
              <div class="answer">${obj.answer || ''}</div>
              ${obj.script ? `<div class="script"><strong>📝 Скрипт:</strong><br/>${obj.script}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const filteredItems = items.filter(item => {
    const matchesCategory = item.category === activeTab;
    const matchesSearch = !searchQuery || 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Get YouTube embed URL
  const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по FAQ..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          {Object.entries(CATEGORY_LABELS).map(([key, { label, icon: Icon }]) => (
            <TabsTrigger key={key} value={key} className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
              {key === 'objections' && objections.length > 0 && (
                <Badge variant="secondary" className="ml-1 hidden sm:inline">{objections.length}</Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Regular FAQ categories */}
        {Object.keys(CATEGORY_LABELS).filter(k => k !== 'objections').map(category => (
          <TabsContent key={category} value={category} className="mt-4">
            {filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <HelpCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Нет вопросов в этой категории</p>
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-2">
                {filteredItems.map((item) => (
                  <AccordionItem 
                    key={item.id} 
                    value={item.id}
                    className="border rounded-lg px-4 bg-card"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <span className="text-left font-medium">{item.question}</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      <div className="space-y-4">
                        {/* Answer text with preserved line breaks */}
                        <div className="whitespace-pre-wrap text-muted-foreground">
                          {item.answer}
                        </div>
                        
                        {/* Image */}
                        {item.imageUrl && (
                          <div className="mt-4">
                            <img 
                              src={item.imageUrl} 
                              alt={item.question}
                              className="max-w-full h-auto rounded-lg border"
                            />
                          </div>
                        )}
                        
                        {/* Video */}
                        {item.videoUrl && (
                          <div className="mt-4">
                            {getYouTubeEmbedUrl(item.videoUrl) ? (
                              <iframe
                                width="100%"
                                height="315"
                                src={getYouTubeEmbedUrl(item.videoUrl)}
                                title={item.question}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="rounded-lg"
                              />
                            ) : (
                              <video 
                                src={item.videoUrl} 
                                controls 
                                className="max-w-full rounded-lg"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>
        ))}

        {/* Objections tab */}
        <TabsContent value="objections" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquareQuote className="h-5 w-5 text-orange-500" />
                    Возражения клиентов и ответы на них
                  </CardTitle>
                  <CardDescription>
                    Готовые скрипты для работы с типичными возражениями
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {objections.length > 0 && (
                    <Button variant="outline" size="sm" onClick={handlePrintObjections}>
                      <Download className="h-4 w-4 mr-2" />
                      Печать памятки
                    </Button>
                  )}
                  {!isAdmin && (
                    <Button size="sm" onClick={() => setShowObjectionDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {objections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquareQuote className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Пока нет ответов на возражения</p>
                  {!isAdmin && (
                    <Button className="mt-4" variant="outline" onClick={() => setShowObjectionDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить первое возражение
                    </Button>
                  )}
                </div>
              ) : (
                <Accordion type="single" collapsible className="space-y-2">
                  {objections.map((obj) => (
                    <AccordionItem 
                      key={obj.id} 
                      value={obj.id}
                      className="border rounded-lg px-4 bg-card"
                    >
                      <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-start gap-3 text-left flex-1">
                          <MessageSquareQuote className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium">{obj.question}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {OBJECTION_CATEGORIES[obj.category] || obj.category}
                              </Badge>
                              {obj.helpful > 0 && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <ThumbsUp className="h-3 w-3" /> {obj.helpful}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4">
                        <div className="space-y-4 pt-2">
                          {/* Answer */}
                          <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4">
                            <Label className="text-xs text-green-600 font-medium mb-2 block">💬 Ответ клиенту:</Label>
                            <p className="text-sm whitespace-pre-wrap">{obj.answer}</p>
                          </div>
                          
                          {/* Script */}
                          {obj.script && (
                            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
                              <Label className="text-xs text-blue-600 font-medium mb-2 block">📋 Скрипт обработки:</Label>
                              <p className="text-sm whitespace-pre-wrap">{obj.script}</p>
                            </div>
                          )}
                          
                          {/* Footer */}
                          <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-xs text-muted-foreground">
                              Добавлено: {new Date(obj.answeredAt).toLocaleDateString()}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkHelpful(obj.id)}
                            >
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              Полезно
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// FAQ Admin Component (for admins)
export const FAQAdmin = ({ calculatorType = null }) => {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterCalculator, setFilterCalculator] = useState(calculatorType || 'all');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/faq/all`);
      setItems(response.data);
    } catch (error) {
      console.error('Error fetching FAQ:', error);
      toast.error('Ошибка загрузки FAQ');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (item) => {
    try {
      if (item.id) {
        await axios.put(`${API_URL}/api/faq/${item.id}`, item);
        toast.success('Вопрос обновлён');
      } else {
        await axios.post(`${API_URL}/api/faq`, item);
        toast.success('Вопрос добавлен');
      }
      fetchItems();
      setIsDialogOpen(false);
      setEditItem(null);
    } catch (error) {
      console.error('Error saving FAQ:', error);
      toast.error('Ошибка сохранения');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить этот вопрос?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/faq/${id}`);
      toast.success('Вопрос удалён');
      fetchItems();
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      toast.error('Ошибка удаления');
    }
  };

  const handleImportHints = async () => {
    try {
      const calcType = calculatorType || 'both';
      const response = await axios.post(`${API_URL}/api/faq/import-hints/${calcType}`);
      toast.success(`Импортировано ${response.data.imported_count} подсказок`);
      fetchItems();
    } catch (error) {
      console.error('Error importing hints:', error);
      toast.error('Ошибка импорта');
    }
  };

  const handleSeedDefaults = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/faq/seed-defaults`);
      toast.success(`Добавлено ${response.data.created_count} стандартных вопросов`);
      fetchItems();
    } catch (error) {
      console.error('Error seeding defaults:', error);
      toast.error('Ошибка добавления');
    }
  };

  const filteredItems = items.filter(item => {
    const matchesCalculator = filterCalculator === 'all' || 
      item.calculator_type === filterCalculator || 
      item.calculator_type === 'both';
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesCalculator && matchesCategory;
  });

  if (!isAdmin || !isAdmin()) {
    return <div className="p-4 text-center text-muted-foreground">Доступ запрещён</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Управление FAQ</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleSeedDefaults}>
            <Download className="h-4 w-4 mr-2" />
            Добавить стандартные
          </Button>
          <Button variant="outline" size="sm" onClick={handleImportHints}>
            <Download className="h-4 w-4 mr-2" />
            Импорт из подсказок
          </Button>
          <Button size="sm" onClick={() => { setEditItem(null); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить вопрос
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Label>Калькулятор:</Label>
          <Select value={filterCalculator} onValueChange={setFilterCalculator}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="sauna">Сауна</SelectItem>
              <SelectItem value="balia">Купель</SelectItem>
              <SelectItem value="both">Общее</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label>Категория:</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Items list */}
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <HelpCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Нет вопросов. Добавьте первый!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <Card key={item.id} className={!item.isActive ? 'opacity-50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{CALCULATOR_LABELS[item.calculator_type]}</Badge>
                      <Badge variant="secondary">{CATEGORY_LABELS[item.category]?.label}</Badge>
                      {!item.isActive && <Badge variant="destructive">Скрыт</Badge>}
                    </div>
                    <h3 className="font-medium truncate">{item.question}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {item.answer}
                    </p>
                    {(item.imageUrl || item.videoUrl) && (
                      <div className="flex gap-2 mt-2">
                        {item.imageUrl && <Badge variant="outline"><ImageIcon className="h-3 w-3 mr-1" />Фото</Badge>}
                        {item.videoUrl && <Badge variant="outline"><Video className="h-3 w-3 mr-1" />Видео</Badge>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => { setEditItem(item); setIsDialogOpen(true); }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <FAQEditDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        item={editItem}
        onSave={handleSave}
        defaultCalculatorType={calculatorType}
      />
    </div>
  );
};

// Edit Dialog Component
const FAQEditDialog = ({ open, onOpenChange, item, onSave, defaultCalculatorType }) => {
  const [formData, setFormData] = useState({
    calculator_type: defaultCalculatorType || 'both',
    category: 'calculator_guide',
    question: '',
    answer: '',
    imageUrl: '',
    videoUrl: '',
    order: 0,
    isActive: true
  });

  useEffect(() => {
    if (item) {
      setFormData({
        calculator_type: item.calculator_type || defaultCalculatorType || 'both',
        category: item.category || 'calculator_guide',
        question: item.question || '',
        answer: item.answer || '',
        imageUrl: item.imageUrl || '',
        videoUrl: item.videoUrl || '',
        order: item.order || 0,
        isActive: item.isActive !== false
      });
    } else {
      setFormData({
        calculator_type: defaultCalculatorType || 'both',
        category: 'calculator_guide',
        question: '',
        answer: '',
        imageUrl: '',
        videoUrl: '',
        order: 0,
        isActive: true
      });
    }
  }, [item, defaultCalculatorType]);

  const handleSubmit = () => {
    if (!formData.question.trim() || !formData.answer.trim()) {
      toast.error('Заполните вопрос и ответ');
      return;
    }
    onSave({
      ...formData,
      ...(item?.id && { id: item.id })
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Редактировать вопрос' : 'Добавить вопрос'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Калькулятор</Label>
              <Select 
                value={formData.calculator_type} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, calculator_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sauna">Сауна</SelectItem>
                  <SelectItem value="balia">Купель</SelectItem>
                  <SelectItem value="both">Общее (оба)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Категория</Label>
              <Select 
                value={formData.category} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Вопрос</Label>
            <Input
              value={formData.question}
              onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
              placeholder="Введите вопрос..."
            />
          </div>

          <div>
            <Label>Ответ</Label>
            <Textarea
              value={formData.answer}
              onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
              placeholder="Введите ответ..."
              rows={8}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>URL изображения (опционально)</Label>
              <Input
                value={formData.imageUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>URL видео (опционально)</Label>
              <Input
                value={formData.videoUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, videoUrl: e.target.value }))}
                placeholder="https://youtube.com/..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Порядок сортировки</Label>
              <Input
                type="number"
                value={formData.order}
                onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4"
              />
              <Label htmlFor="isActive">Активен (виден менеджерам)</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSubmit}>
            <Save className="h-4 w-4 mr-2" />
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FAQView;
