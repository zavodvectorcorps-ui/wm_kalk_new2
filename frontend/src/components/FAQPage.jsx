import React, { useState, useEffect, useRef } from 'react';
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
  ThumbsUp,
  Clock,
  Folder,
  FolderPlus,
  Upload,
  Youtube,
  Copy,
  ExternalLink,
  RefreshCw,
  Eye
} from 'lucide-react';
import axios from 'axios';

const API_URL = (() => { 
  const e = process.env.REACT_APP_BACKEND_URL;
  if (e) {
    const o = window.location.origin;
    if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
  }
  return e || '';
})();

// Category labels - products first as requested
const CATEGORY_LABELS = {
  products: { label: 'Товары и опции', icon: Package },
  layout_variants: { label: 'Варианты планировок', icon: Table },
  calculator_guide: { label: 'Работа с калькулятором', icon: Book },
  amocrm_integration: { label: 'Интеграция с amoCRM', icon: Link2 },
  objections: { label: 'Возражения', icon: MessageSquareQuote },
  content: { label: 'Контент', icon: Folder }
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

// FolderCard Component for hierarchical folder display
const FolderCard = ({ 
  folder, 
  level, 
  isAdmin, 
  expandedFolders, 
  toggleFolderExpand, 
  copyPublicLink, 
  setEditingFolder, 
  handleDeleteFolder, 
  handleUploadContent, 
  uploadingContent, 
  uploadingFolderId, 
  setSelectedFolderId, 
  setShowYoutubeDialog, 
  handleDeleteContentItem, 
  formatFileSize, 
  API_URL,
  setNewFolderParentId,
  setShowFolderDialog
}) => {
  const hasChildren = folder.children && folder.children.length > 0;
  const isExpanded = expandedFolders.has(folder.id);
  
  return (
    <div className="space-y-2">
      <Card style={{ marginLeft: `${level * 20}px` }}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                {hasChildren && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => toggleFolderExpand(folder.id)}
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </Button>
                )}
                <Folder className="h-4 w-4 text-amber-500" />
                {folder.name}
                <Badge variant="outline" className="ml-2">
                  {folder.items?.length || 0} файлов
                </Badge>
              </CardTitle>
              {folder.description && (
                <CardDescription className="mt-1">{folder.description}</CardDescription>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyPublicLink(folder)}
                title="Скопировать публичную ссылку"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`${API_URL}/api/content/public/${folder.publicId}`, '_blank')}
                title="Открыть публичную страницу"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              {isAdmin && (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setNewFolderParentId(folder.id);
                      setShowFolderDialog(true);
                    }}
                    title="Создать подпапку"
                  >
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingFolder(folder)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteFolder(folder.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Upload buttons for admin */}
          {isAdmin && (
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
              <input
                type="file"
                id={`file-upload-${folder.id}`}
                onChange={(e) => handleUploadContent(e, folder.id)}
                className="hidden"
                accept="image/*,video/*"
                multiple
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  document.getElementById(`file-upload-${folder.id}`)?.click();
                }}
                disabled={uploadingContent && uploadingFolderId === folder.id}
              >
                {uploadingContent && uploadingFolderId === folder.id ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Загрузить фото/видео
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedFolderId(folder.id);
                  setShowYoutubeDialog(true);
                }}
              >
                <Youtube className="h-4 w-4 mr-2 text-red-500" />
                Добавить YouTube
              </Button>
            </div>
          )}

          {/* Content items grid */}
          {folder.items?.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {folder.items.map(item => (
                <div key={item.id} className="relative group bg-gray-50 rounded-lg overflow-hidden">
                  {item.type === 'image' && (
                    <a href={`${API_URL}${item.url}`} target="_blank" rel="noopener noreferrer">
                      <img
                        src={`${API_URL}${item.url}`}
                        alt={item.name}
                        className="w-full h-32 object-cover"
                      />
                    </a>
                  )}
                  {item.type === 'video' && (
                    <video
                      src={`${API_URL}${item.url}`}
                      className="w-full h-32 object-cover bg-black"
                      controls
                    />
                  )}
                  {item.type === 'youtube' && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={item.thumbnailUrl}
                        alt={item.name}
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-red-600 rounded-full p-2">
                          <Youtube className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </a>
                  )}
                  <div className="p-2">
                    <p className="text-xs truncate" title={item.name}>{item.name}</p>
                    {item.size && (
                      <p className="text-xs text-muted-foreground">{formatFileSize(item.size)}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteContentItem(folder.id, item.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-6 text-muted-foreground">В этой папке пока нет контента</p>
          )}
        </CardContent>
      </Card>
      
      {/* Render children if expanded */}
      {hasChildren && isExpanded && (
        <div className="space-y-2">
          {folder.children.map(childFolder => (
            <FolderCard
              key={childFolder.id}
              folder={childFolder}
              level={level + 1}
              isAdmin={isAdmin}
              expandedFolders={expandedFolders}
              toggleFolderExpand={toggleFolderExpand}
              copyPublicLink={copyPublicLink}
              setEditingFolder={setEditingFolder}
              handleDeleteFolder={handleDeleteFolder}
              handleUploadContent={handleUploadContent}
              uploadingContent={uploadingContent}
              uploadingFolderId={uploadingFolderId}
              setSelectedFolderId={setSelectedFolderId}
              setShowYoutubeDialog={setShowYoutubeDialog}
              handleDeleteContentItem={handleDeleteContentItem}
              formatFileSize={formatFileSize}
              API_URL={API_URL}
              setNewFolderParentId={setNewFolderParentId}
              setShowFolderDialog={setShowFolderDialog}
            />
          ))}
        </div>
      )}
    </div>
  );
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
  const [newObjection, setNewObjection] = useState({ question: '', context: '', category: 'general', calculator_type: calculatorType || 'both' });
  
  // Content states
  const [contentFolders, setContentFolders] = useState([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState(null);
  const [showYoutubeDialog, setShowYoutubeDialog] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeName, setYoutubeName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [uploadingContent, setUploadingContent] = useState(false);
  const [uploadingFolderId, setUploadingFolderId] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  const isAdmin = user?.role === 'admin';
  const userId = user?.id || user?.username;
  const username = user?.username;

  // Build folder tree from flat list
  const buildFolderTree = (folders) => {
    const rootFolders = folders.filter(f => !f.parentId);
    const getChildren = (parentId) => folders.filter(f => f.parentId === parentId);
    
    const addChildren = (folder) => ({
      ...folder,
      children: getChildren(folder.id).map(addChildren)
    });
    
    return rootFolders.map(addChildren);
  };

  const toggleFolderExpand = (folderId) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    fetchItems();
    fetchObjections();
  }, [calculatorType]);

  useEffect(() => {
    if (activeTab === 'content') {
      fetchContentFolders();
    }
  }, [activeTab, calculatorType]);

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
      // Fetch objections filtered by calculator type
      const response = await axios.get(`${API_URL}/api/training/objections?calculator_type=${calculatorType || 'all'}`);
      setObjections(response.data);
    } catch (error) {
      console.error('Error fetching objections:', error);
    }
  };

  // Answer objection (admin)
  const [editingObjection, setEditingObjection] = useState(null);

  const handleAnswerObjection = async () => {
    if (!editingObjection?.answer?.trim()) {
      toast.error('Введите ответ');
      return;
    }

    try {
      await axios.put(`${API_URL}/api/training/objections/${editingObjection.id}/answer?admin_username=${username}`, {
        answer: editingObjection.answer,
        script: editingObjection.script
      });
      toast.success('Ответ сохранён');
      setEditingObjection(null);
      fetchObjections();
    } catch (error) {
      console.error('Error answering objection:', error);
      toast.error('Ошибка сохранения');
    }
  };

  // Delete objection (admin)
  const handleDeleteObjection = async (id) => {
    if (!window.confirm('Удалить это возражение?')) return;

    try {
      await axios.delete(`${API_URL}/api/training/objections/${id}`);
      toast.success('Удалено');
      fetchObjections();
    } catch (error) {
      console.error('Error deleting objection:', error);
      toast.error('Ошибка удаления');
    }
  };

  // ==================== Content Functions ====================

  const fetchContentFolders = async () => {
    setLoadingContent(true);
    try {
      const type = calculatorType === 'both' ? '' : calculatorType;
      const response = await axios.get(`${API_URL}/api/content/folders${type ? `?calculator_type=${type}` : ''}`);
      setContentFolders(response.data);
    } catch (error) {
      console.error('Error fetching content folders:', error);
      toast.error('Ошибка загрузки контента');
    } finally {
      setLoadingContent(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Введите название папки');
      return;
    }

    const formData = new FormData();
    formData.append('name', newFolderName.trim());
    formData.append('description', newFolderDescription.trim());
    formData.append('calculator_type', calculatorType === 'both' ? 'balia' : calculatorType);
    if (newFolderParentId) {
      formData.append('parentId', newFolderParentId);
    }

    try {
      await axios.post(`${API_URL}/api/content/folders`, formData);
      toast.success('Папка создана');
      setShowFolderDialog(false);
      setNewFolderName('');
      setNewFolderDescription('');
      setNewFolderParentId(null);
      fetchContentFolders();
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Ошибка создания папки');
    }
  };

  const handleUpdateFolder = async () => {
    if (!editingFolder || !editingFolder.name.trim()) {
      toast.error('Введите название папки');
      return;
    }

    const formData = new FormData();
    formData.append('name', editingFolder.name.trim());
    formData.append('description', editingFolder.description || '');
    formData.append('isPublic', editingFolder.isPublic);

    try {
      await axios.put(`${API_URL}/api/content/folders/${editingFolder.id}`, formData);
      toast.success('Папка обновлена');
      setEditingFolder(null);
      fetchContentFolders();
    } catch (error) {
      console.error('Error updating folder:', error);
      toast.error('Ошибка обновления');
    }
  };

  const handleDeleteFolder = async (folderId) => {
    if (!window.confirm('Удалить эту папку и весь её контент?')) return;

    try {
      await axios.delete(`${API_URL}/api/content/folders/${folderId}`);
      toast.success('Папка удалена');
      fetchContentFolders();
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Ошибка удаления');
    }
  };

  const handleUploadContent = async (e, folderId) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingContent(true);
    setUploadingFolderId(folderId);
    let uploaded = 0;
    let errors = 0;

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        await axios.post(`${API_URL}/api/content/folders/${folderId}/upload`, formData);
        uploaded++;
      } catch (error) {
        console.error('Error uploading file:', error);
        errors++;
      }
    }

    setUploadingContent(false);
    setUploadingFolderId(null);
    // Reset the input
    e.target.value = '';

    if (uploaded > 0) {
      toast.success(`Загружено файлов: ${uploaded}`);
      fetchContentFolders();
    }
    if (errors > 0) {
      toast.error(`Ошибок: ${errors}`);
    }
  };

  const handleAddYoutubeLink = async () => {
    if (!youtubeUrl.trim() || !selectedFolderId) {
      toast.error('Введите ссылку на YouTube');
      return;
    }

    const formData = new FormData();
    formData.append('url', youtubeUrl.trim());
    formData.append('name', youtubeName.trim() || 'YouTube видео');

    try {
      await axios.post(`${API_URL}/api/content/folders/${selectedFolderId}/youtube`, formData);
      toast.success('Ссылка добавлена');
      setShowYoutubeDialog(false);
      setYoutubeUrl('');
      setYoutubeName('');
      setSelectedFolderId(null);
      fetchContentFolders();
    } catch (error) {
      console.error('Error adding YouTube link:', error);
      toast.error(error.response?.data?.detail || 'Ошибка добавления ссылки');
    }
  };

  const handleDeleteContentItem = async (folderId, itemId) => {
    if (!window.confirm('Удалить этот элемент?')) return;

    try {
      await axios.delete(`${API_URL}/api/content/folders/${folderId}/items/${itemId}`);
      toast.success('Удалено');
      fetchContentFolders();
    } catch (error) {
      console.error('Error deleting content item:', error);
      toast.error('Ошибка удаления');
    }
  };

  const copyPublicLink = (folder) => {
    const link = `${window.location.origin}/api/content/public/${folder.publicId}`;
    navigator.clipboard.writeText(link);
    toast.success('Ссылка скопирована');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Split objections
  const answeredObjections = objections.filter(obj => obj.status === 'answered');
  const pendingObjections = objections.filter(obj => obj.status === 'pending');

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
        ${answeredObjections.map(obj => `
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
        <TabsList className="grid w-full grid-cols-5">
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
        {Object.keys(CATEGORY_LABELS).filter(k => k !== 'objections' && k !== 'content').map(category => (
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
          <div className="space-y-6">
            {/* Pending objections for admin */}
            {isAdmin && pendingObjections.length > 0 && (
              <Card className="border-orange-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-600">
                    <Clock className="h-5 w-5" />
                    Ожидают ответа
                    <Badge variant="secondary">{pendingObjections.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingObjections.map(obj => (
                    <Card key={obj.id} className="border-orange-200">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-medium">{obj.question}</p>
                            {obj.context && (
                              <p className="text-sm text-muted-foreground mt-1">{obj.context}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {OBJECTION_CATEGORIES[obj.category] || obj.category}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                От: {obj.submittedBy} • {new Date(obj.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={() => setEditingObjection({ ...obj, answer: '', script: '' })}>
                              <Edit className="h-4 w-4 mr-1" />
                              Ответить
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteObjection(obj.id)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Answered objections */}
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
                    {answeredObjections.length > 0 && (
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
                {answeredObjections.length === 0 ? (
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
                  {answeredObjections.map((obj) => (
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
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkHelpful(obj.id)}
                              >
                                <ThumbsUp className="h-4 w-4 mr-1" />
                                Полезно
                              </Button>
                              {isAdmin && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => setEditingObjection(obj)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDeleteObjection(obj.id)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="mt-4">
          <div className="space-y-4">
            {/* Header with create button */}
            {isAdmin && (
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Папки с контентом</h3>
                <Button onClick={() => setShowFolderDialog(true)}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Создать папку
                </Button>
              </div>
            )}

            {/* Folders grid */}
            {loadingContent ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : contentFolders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Нет папок с контентом</p>
                  {isAdmin && (
                    <Button className="mt-4" onClick={() => setShowFolderDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Создать первую папку
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {buildFolderTree(contentFolders).map(folder => (
                  <FolderCard 
                    key={folder.id} 
                    folder={folder} 
                    level={0}
                    isAdmin={isAdmin}
                    expandedFolders={expandedFolders}
                    toggleFolderExpand={toggleFolderExpand}
                    copyPublicLink={copyPublicLink}
                    setEditingFolder={setEditingFolder}
                    handleDeleteFolder={handleDeleteFolder}
                    handleUploadContent={handleUploadContent}
                    uploadingContent={uploadingContent}
                    uploadingFolderId={uploadingFolderId}
                    setSelectedFolderId={setSelectedFolderId}
                    setShowYoutubeDialog={setShowYoutubeDialog}
                    handleDeleteContentItem={handleDeleteContentItem}
                    formatFileSize={formatFileSize}
                    API_URL={API_URL}
                    setNewFolderParentId={setNewFolderParentId}
                    setShowFolderDialog={setShowFolderDialog}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* New Objection Dialog */}
      <Dialog open={showObjectionDialog} onOpenChange={setShowObjectionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareQuote className="h-5 w-5 text-orange-500" />
              Новое возражение клиента
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Возражение / Вопрос клиента *</Label>
              <Textarea
                value={newObjection.question}
                onChange={e => setNewObjection({ ...newObjection, question: e.target.value })}
                placeholder="Например: 'Почему так дорого?' или 'У конкурентов дешевле'"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Контекст (необязательно)</Label>
              <Textarea
                value={newObjection.context}
                onChange={e => setNewObjection({ ...newObjection, context: e.target.value })}
                placeholder="Дополнительная информация о ситуации..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Категория</Label>
              <Select 
                value={newObjection.category} 
                onValueChange={v => setNewObjection({ ...newObjection, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Общее</SelectItem>
                  <SelectItem value="price">Цена</SelectItem>
                  <SelectItem value="quality">Качество</SelectItem>
                  <SelectItem value="delivery">Доставка</SelectItem>
                  <SelectItem value="warranty">Гарантия</SelectItem>
                  <SelectItem value="competitors">Конкуренты</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowObjectionDialog(false)}>Отмена</Button>
            <Button onClick={handleSubmitObjection}>
              <Plus className="h-4 w-4 mr-2" />
              Отправить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Answer Objection Dialog (for admins) */}
      <Dialog open={!!editingObjection} onOpenChange={(open) => !open && setEditingObjection(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              {editingObjection?.status === 'answered' ? 'Редактировать ответ' : 'Ответить на возражение'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Question display */}
            <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4">
              <Label className="text-xs text-orange-600 font-medium mb-2 block">Возражение клиента:</Label>
              <p className="font-medium">{editingObjection?.question}</p>
              {editingObjection?.context && (
                <p className="text-sm text-muted-foreground mt-2">{editingObjection?.context}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  {OBJECTION_CATEGORIES[editingObjection?.category] || editingObjection?.category}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  От: {editingObjection?.submittedBy}
                </span>
              </div>
            </div>

            {/* Answer */}
            <div className="space-y-2">
              <Label>Ответ клиенту *</Label>
              <Textarea
                value={editingObjection?.answer || ''}
                onChange={e => setEditingObjection({ ...editingObjection, answer: e.target.value })}
                placeholder="Напишите ответ для менеджера..."
                rows={4}
              />
            </div>

            {/* Script */}
            <div className="space-y-2">
              <Label>Скрипт обработки (необязательно)</Label>
              <Textarea
                value={editingObjection?.script || ''}
                onChange={e => setEditingObjection({ ...editingObjection, script: e.target.value })}
                placeholder="Пошаговый скрипт..."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingObjection(null)}>Отмена</Button>
            <Button onClick={handleAnswerObjection}>
              <Save className="h-4 w-4 mr-2" />
              Сохранить ответ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={showFolderDialog} onOpenChange={(open) => {
        setShowFolderDialog(open);
        if (!open) {
          setNewFolderParentId(null);
          setNewFolderName('');
          setNewFolderDescription('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-amber-500" />
              {newFolderParentId ? 'Создать подпапку' : 'Создать папку'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {newFolderParentId && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-800">
                  <Folder className="h-4 w-4 inline mr-1" />
                  Подпапка в: <strong>{contentFolders.find(f => f.id === newFolderParentId)?.name}</strong>
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Название {newFolderParentId ? 'подпапки' : 'папки'} *</Label>
              <Input
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder={newFolderParentId ? "Например: Внешний вид" : "Например: Сауна 4 метра"}
              />
            </div>
            <div className="space-y-2">
              <Label>Описание (необязательно)</Label>
              <Textarea
                value={newFolderDescription}
                onChange={e => setNewFolderDescription(e.target.value)}
                placeholder="Краткое описание содержимого"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowFolderDialog(false);
              setNewFolderParentId(null);
            }}>
              Отмена
            </Button>
            <Button onClick={handleCreateFolder}>
              <Plus className="h-4 w-4 mr-2" />
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Folder Dialog */}
      <Dialog open={!!editingFolder} onOpenChange={() => setEditingFolder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-500" />
              Редактировать папку
            </DialogTitle>
          </DialogHeader>
          {editingFolder && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Название папки *</Label>
                <Input
                  value={editingFolder.name}
                  onChange={e => setEditingFolder({ ...editingFolder, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea
                  value={editingFolder.description || ''}
                  onChange={e => setEditingFolder({ ...editingFolder, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <Label>Публичный доступ</Label>
                  <p className="text-xs text-muted-foreground">Разрешить просмотр по ссылке</p>
                </div>
                <input
                  type="checkbox"
                  checked={editingFolder.isPublic}
                  onChange={e => setEditingFolder({ ...editingFolder, isPublic: e.target.checked })}
                  className="h-4 w-4"
                />
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <Label className="text-xs text-blue-600">Публичная ссылка:</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs bg-white px-2 py-1 rounded flex-1 overflow-hidden text-ellipsis">
                    {window.location.origin}/api/content/public/{editingFolder.publicId}
                  </code>
                  <Button size="sm" variant="ghost" onClick={() => copyPublicLink(editingFolder)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFolder(null)}>
              Отмена
            </Button>
            <Button onClick={handleUpdateFolder}>
              <Save className="h-4 w-4 mr-2" />
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* YouTube Dialog */}
      <Dialog open={showYoutubeDialog} onOpenChange={setShowYoutubeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Youtube className="h-5 w-5 text-red-500" />
              Добавить YouTube видео
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ссылка на YouTube *</Label>
              <Input
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
            <div className="space-y-2">
              <Label>Название (необязательно)</Label>
              <Input
                value={youtubeName}
                onChange={e => setYoutubeName(e.target.value)}
                placeholder="Название видео"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowYoutubeDialog(false);
              setYoutubeUrl('');
              setYoutubeName('');
            }}>
              Отмена
            </Button>
            <Button onClick={handleAddYoutubeLink}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
