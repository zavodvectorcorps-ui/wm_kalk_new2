import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { 
  GraduationCap, Play, CheckCircle2, Circle, Lock, Plus, Trash2, 
  Edit, ChevronRight, Award, Clock, Users, BookOpen, Video,
  FileQuestion, Save, X, ArrowLeft, BarChart3, Settings, Grip,
  ChevronDown, ChevronUp, PlayCircle, CheckCircle, XCircle, RefreshCw, FileImage,
  MessageSquareQuote, HelpCircle, Send, ThumbsUp, Search, Filter
} from 'lucide-react';

const API_URL = (() => { 
  if (typeof window !== 'undefined') { 
    const o = window.location.origin; 
    if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
  } 
  return process.env.REACT_APP_BACKEND_URL || ''; 
})();

// ============= Training Page Component =============

const TrainingPage = ({ user }) => {
  const [courses, setCourses] = useState([]);
  const [userProgress, setUserProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('courses');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [showTest, setShowTest] = useState(false);
  const [testAnswers, setTestAnswers] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [submittingTest, setSubmittingTest] = useState(false);
  
  // Admin states
  const [editingCourse, setEditingCourse] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [showCourseDialog, setShowCourseDialog] = useState(false);
  const [showLessonDialog, setShowLessonDialog] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [usersStats, setUsersStats] = useState([]);
  
  // Objections states
  const [objections, setObjections] = useState([]);
  const [showObjectionDialog, setShowObjectionDialog] = useState(false);
  const [newObjection, setNewObjection] = useState({ question: '', context: '', category: 'general' });
  const [editingObjection, setEditingObjection] = useState(null);
  const [objectionFilter, setObjectionFilter] = useState('all'); // all, pending, answered
  const [objectionSearch, setObjectionSearch] = useState('');
  
  const isAdmin = user?.role === 'admin';
  const userId = user?.id || user?.username;
  const username = user?.username;

  // Fetch courses
  const fetchCourses = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/training/courses?include_inactive=${isAdmin}`);
      if (response.ok) {
        const data = await response.json();
        setCourses(data);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast.error('Ошибка загрузки курсов');
    }
  }, [isAdmin]);

  // Fetch user progress
  const fetchProgress = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await fetch(`${API_URL}/api/training/progress/${userId}`);
      if (response.ok) {
        const data = await response.json();
        const progressMap = {};
        data.forEach(p => { progressMap[p.courseId] = p; });
        setUserProgress(progressMap);
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    }
  }, [userId]);

  // Fetch statistics (admin)
  const fetchStatistics = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/training/statistics`),
        fetch(`${API_URL}/api/training/statistics/users`)
      ]);
      
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStatistics(data);
      }
      
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsersStats(usersData);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }, [isAdmin]);

  // Fetch objections
  const fetchObjections = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/training/objections`);
      if (response.ok) {
        const data = await response.json();
        setObjections(data);
      }
    } catch (error) {
      console.error('Error fetching objections:', error);
    }
  }, []);

  // Submit new objection (manager)
  const handleSubmitObjection = async () => {
    if (!newObjection.question.trim()) {
      toast.error('Введите текст возражения');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/training/objections?user_id=${userId}&username=${username}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newObjection)
      });

      if (response.ok) {
        toast.success('Возражение отправлено! Администратор скоро ответит.');
        setNewObjection({ question: '', context: '', category: 'general' });
        setShowObjectionDialog(false);
        await fetchObjections();
      }
    } catch (error) {
      console.error('Error submitting objection:', error);
      toast.error('Ошибка отправки');
    }
  };

  // Answer objection (admin)
  const handleAnswerObjection = async () => {
    if (!editingObjection?.answer?.trim()) {
      toast.error('Введите ответ');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/training/objections/${editingObjection.id}/answer?admin_username=${username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer: editingObjection.answer,
          script: editingObjection.script
        })
      });

      if (response.ok) {
        toast.success('Ответ сохранён');
        setEditingObjection(null);
        await fetchObjections();
      }
    } catch (error) {
      console.error('Error answering objection:', error);
      toast.error('Ошибка сохранения');
    }
  };

  // Delete objection (admin)
  const handleDeleteObjection = async (id) => {
    if (!confirm('Удалить это возражение?')) return;

    try {
      const response = await fetch(`${API_URL}/api/training/objections/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Удалено');
        await fetchObjections();
      }
    } catch (error) {
      console.error('Error deleting objection:', error);
      toast.error('Ошибка удаления');
    }
  };

  // Mark as helpful
  const handleMarkHelpful = async (id) => {
    try {
      await fetch(`${API_URL}/api/training/objections/${id}/helpful`, { method: 'POST' });
      toast.success('Спасибо за оценку!');
      await fetchObjections();
    } catch (error) {
      console.error('Error marking helpful:', error);
    }
  };
        setUsersStats(usersData);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }, [isAdmin]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchCourses(), fetchProgress(), fetchStatistics(), fetchObjections()]);
      setLoading(false);
    };
    loadData();
  }, [fetchCourses, fetchProgress, fetchStatistics, fetchObjections]);

  // Course progress calculation
  const getCourseProgress = (course) => {
    const progress = userProgress[course.id];
    if (!progress) return 0;
    
    const lessons = course.lessons?.filter(l => l.isActive !== false) || [];
    if (lessons.length === 0) return 0;
    
    const completed = lessons.filter(l => 
      progress.lessons?.[l.id]?.completed
    ).length;
    
    return Math.round((completed / lessons.length) * 100);
  };

  // Check if lesson is unlocked
  const isLessonUnlocked = (course, lessonIndex) => {
    if (lessonIndex === 0) return true;
    
    const progress = userProgress[course.id];
    if (!progress) return false;
    
    const lessons = course.lessons?.filter(l => l.isActive !== false) || [];
    const prevLesson = lessons[lessonIndex - 1];
    
    return progress.lessons?.[prevLesson.id]?.completed || false;
  };

  // Start lesson
  const handleStartLesson = async (course, lesson) => {
    setSelectedCourse(course);
    setSelectedLesson(lesson);
    setShowTest(false);
    setTestAnswers({});
    setTestResult(null);
    
    // Mark as started
    try {
      await fetch(`${API_URL}/api/training/progress/${userId}/${course.id}/lessons/${lesson.id}/start`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Error starting lesson:', error);
    }
  };

  // Submit test
  const handleSubmitTest = async () => {
    if (!selectedCourse || !selectedLesson) return;
    
    const questions = selectedLesson.questions || [];
    const unanswered = questions.filter(q => testAnswers[q.id] === undefined);
    
    if (unanswered.length > 0) {
      toast.error(`Ответьте на все вопросы (осталось ${unanswered.length})`);
      return;
    }
    
    setSubmittingTest(true);
    
    try {
      const response = await fetch(
        `${API_URL}/api/training/progress/${userId}/${selectedCourse.id}/lessons/${selectedLesson.id}/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: testAnswers })
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        setTestResult(result);
        
        if (result.passed) {
          toast.success(`Тест пройден! Результат: ${result.score}%`);
          await fetchProgress();
        } else {
          toast.error(`Тест не пройден. Результат: ${result.score}% (нужно ${result.requiredScore}%)`);
        }
      }
    } catch (error) {
      console.error('Error submitting test:', error);
      toast.error('Ошибка отправки теста');
    } finally {
      setSubmittingTest(false);
    }
  };

  // Retry test
  const handleRetryTest = () => {
    setTestAnswers({});
    setTestResult(null);
  };

  // Complete lesson without test
  const handleCompleteLesson = async () => {
    if (!selectedCourse || !selectedLesson) return;
    
    try {
      // Mark lesson as completed on backend
      const response = await fetch(
        `${API_URL}/api/training/progress/${userId}/${selectedCourse.id}/lessons/${selectedLesson.id}/complete`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        toast.success('Урок завершён!');
        await fetchProgress();
        handleNextLesson();
      } else {
        toast.error('Ошибка сохранения прогресса');
      }
    } catch (error) {
      console.error('Error completing lesson:', error);
      toast.error('Ошибка сохранения прогресса');
    }
  };

  // Go to next lesson
  const handleNextLesson = () => {
    if (!selectedCourse) return;
    
    const lessons = selectedCourse.lessons?.filter(l => l.isActive !== false) || [];
    const currentIndex = lessons.findIndex(l => l.id === selectedLesson.id);
    
    if (currentIndex < lessons.length - 1) {
      handleStartLesson(selectedCourse, lessons[currentIndex + 1]);
    } else {
      // Course completed
      setSelectedLesson(null);
      setSelectedCourse(null);
      toast.success('Поздравляем! Курс завершён!');
    }
  };

  // ============= Admin Functions =============

  const handleSaveCourse = async () => {
    if (!editingCourse?.title) {
      toast.error('Введите название курса');
      return;
    }
    
    try {
      const method = editingCourse.id ? 'PUT' : 'POST';
      const url = editingCourse.id 
        ? `${API_URL}/api/training/courses/${editingCourse.id}`
        : `${API_URL}/api/training/courses`;
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCourse)
      });
      
      if (response.ok) {
        toast.success(editingCourse.id ? 'Курс обновлён' : 'Курс создан');
        setShowCourseDialog(false);
        setEditingCourse(null);
        await fetchCourses();
      }
    } catch (error) {
      console.error('Error saving course:', error);
      toast.error('Ошибка сохранения курса');
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!confirm('Удалить курс и весь прогресс пользователей?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/training/courses/${courseId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        toast.success('Курс удалён');
        await fetchCourses();
      }
    } catch (error) {
      console.error('Error deleting course:', error);
      toast.error('Ошибка удаления курса');
    }
  };

  const handleSaveLesson = async () => {
    if (!editingLesson?.title || !editingCourse) {
      toast.error('Введите название урока');
      return;
    }
    
    try {
      const method = editingLesson.id && courses.find(c => 
        c.id === editingCourse.id && c.lessons?.some(l => l.id === editingLesson.id)
      ) ? 'PUT' : 'POST';
      
      const url = method === 'PUT'
        ? `${API_URL}/api/training/courses/${editingCourse.id}/lessons/${editingLesson.id}`
        : `${API_URL}/api/training/courses/${editingCourse.id}/lessons`;
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingLesson)
      });
      
      if (response.ok) {
        toast.success(method === 'PUT' ? 'Урок обновлён' : 'Урок добавлен');
        setShowLessonDialog(false);
        setEditingLesson(null);
        await fetchCourses();
      }
    } catch (error) {
      console.error('Error saving lesson:', error);
      toast.error('Ошибка сохранения урока');
    }
  };

  const handleDeleteLesson = async (courseId, lessonId) => {
    if (!confirm('Удалить урок?')) return;
    
    try {
      const response = await fetch(
        `${API_URL}/api/training/courses/${courseId}/lessons/${lessonId}`,
        { method: 'DELETE' }
      );
      
      if (response.ok) {
        toast.success('Урок удалён');
        await fetchCourses();
      }
    } catch (error) {
      console.error('Error deleting lesson:', error);
      toast.error('Ошибка удаления урока');
    }
  };

  // Add question to lesson
  const addQuestion = () => {
    if (!editingLesson) return;
    
    const newQuestion = {
      id: `q-${Date.now()}`,
      text: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      explanation: ''
    };
    
    setEditingLesson({
      ...editingLesson,
      questions: [...(editingLesson.questions || []), newQuestion]
    });
  };

  const updateQuestion = (index, field, value) => {
    if (!editingLesson) return;
    
    const questions = [...(editingLesson.questions || [])];
    questions[index] = { ...questions[index], [field]: value };
    
    setEditingLesson({ ...editingLesson, questions });
  };

  const updateQuestionOption = (qIndex, optIndex, value) => {
    if (!editingLesson) return;
    
    const questions = [...(editingLesson.questions || [])];
    const options = [...questions[qIndex].options];
    options[optIndex] = value;
    questions[qIndex] = { ...questions[qIndex], options };
    
    setEditingLesson({ ...editingLesson, questions });
  };

  const removeQuestion = (index) => {
    if (!editingLesson) return;
    
    const questions = editingLesson.questions.filter((_, i) => i !== index);
    setEditingLesson({ ...editingLesson, questions });
  };

  // ============= Render Functions =============

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // Lesson view
  if (selectedLesson) {
    const progress = userProgress[selectedCourse?.id];
    const lessonProgress = progress?.lessons?.[selectedLesson.id];
    const hasQuestions = selectedLesson.questions?.length > 0;
    const isCompleted = lessonProgress?.completed;
    
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => { setSelectedLesson(null); setShowTest(false); setTestResult(null); }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад к курсу
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{selectedLesson.title}</h1>
            <p className="text-muted-foreground">{selectedCourse?.title}</p>
          </div>
          {isCompleted && (
            <Badge className="bg-green-500">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Пройден
            </Badge>
          )}
        </div>

        {/* Video or Test */}
        {!showTest ? (
          <div className="space-y-6">
            {/* Video embed */}
            {selectedLesson.videoEmbed && (
              <Card>
                <CardContent className="p-0">
                  <div 
                    className="w-full aspect-video"
                    dangerouslySetInnerHTML={{ __html: selectedLesson.videoEmbed }}
                  />
                </CardContent>
              </Card>
            )}

            {/* Video URL fallback */}
            {!selectedLesson.videoEmbed && selectedLesson.videoUrl && (
              <Card>
                <CardContent className="p-0">
                  <video 
                    src={selectedLesson.videoUrl} 
                    controls 
                    className="w-full aspect-video"
                  />
                </CardContent>
              </Card>
            )}

            {/* Content */}
            {selectedLesson.content && (
              <Card>
                <CardContent className="p-6 prose prose-sm max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: selectedLesson.content }} />
                </CardContent>
              </Card>
            )}

            {/* Description */}
            {selectedLesson.description && (
              <Card>
                <CardContent className="p-6">
                  <p className="text-muted-foreground">{selectedLesson.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              {hasQuestions ? (
                <Button onClick={() => setShowTest(true)}>
                  <FileQuestion className="h-4 w-4 mr-2" />
                  Пройти тест ({selectedLesson.questions.length} вопросов)
                </Button>
              ) : isCompleted ? (
                <Button onClick={handleNextLesson}>
                  Следующий урок
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleCompleteLesson}>
                  Завершить урок
                  <CheckCircle2 className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* Test view */
          <div className="space-y-6">
            {testResult ? (
              /* Test results */
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {testResult.passed ? (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-500" />
                    )}
                    {testResult.passed ? 'Тест пройден!' : 'Тест не пройден'}
                  </CardTitle>
                  <CardDescription>
                    Результат: {testResult.score}% ({testResult.correctAnswers} из {testResult.totalQuestions})
                    {!testResult.passed && ` • Нужно минимум ${testResult.requiredScore}%`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {testResult.results.map((r, i) => (
                    <div key={i} className={`p-4 rounded-lg border ${r.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-start gap-2">
                        {r.isCorrect ? (
                          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{r.questionText}</p>
                          {!r.isCorrect && (
                            <p className="text-sm text-red-600 mt-1">
                              Правильный ответ: {selectedLesson.questions[i]?.options[r.correctAnswer]}
                            </p>
                          )}
                          {r.explanation && (
                            <p className="text-sm text-muted-foreground mt-1">{r.explanation}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
                <div className="p-6 pt-0 flex justify-end gap-3">
                  {!testResult.passed && (
                    <Button variant="outline" onClick={handleRetryTest}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Попробовать снова
                    </Button>
                  )}
                  {testResult.passed && (
                    <Button onClick={handleNextLesson}>
                      Следующий урок
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              </Card>
            ) : (
              /* Test questions */
              <Card>
                <CardHeader>
                  <CardTitle>Тест по уроку</CardTitle>
                  <CardDescription>
                    Ответьте на все вопросы. Для прохождения нужно набрать минимум {selectedLesson.passingScore || 100}%
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {selectedLesson.questions?.map((q, qIndex) => (
                    <div key={q.id} className="space-y-3">
                      <p className="font-medium">{qIndex + 1}. {q.text}</p>
                      <div className="space-y-2 pl-4">
                        {q.options.map((opt, optIndex) => (
                          <label 
                            key={optIndex}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              testAnswers[q.id] === optIndex 
                                ? 'bg-primary/10 border-primary' 
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              checked={testAnswers[q.id] === optIndex}
                              onChange={() => setTestAnswers({ ...testAnswers, [q.id]: optIndex })}
                              className="w-4 h-4"
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
                <div className="p-6 pt-0 flex justify-between">
                  <Button variant="ghost" onClick={() => setShowTest(false)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Вернуться к уроку
                  </Button>
                  <Button onClick={handleSubmitTest} disabled={submittingTest}>
                    {submittingTest ? 'Проверка...' : 'Отправить ответы'}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    );
  }

  // Course detail view
  if (selectedCourse) {
    const progress = userProgress[selectedCourse.id];
    const courseProgress = getCourseProgress(selectedCourse);
    const lessons = selectedCourse.lessons?.filter(l => l.isActive !== false) || [];
    
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setSelectedCourse(null)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Все курсы
          </Button>
        </div>

        {/* Course info */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{selectedCourse.title}</CardTitle>
                {selectedCourse.description && (
                  <CardDescription className="mt-2">{selectedCourse.description}</CardDescription>
                )}
              </div>
              {progress?.isCompleted && (
                <Badge className="bg-green-500">
                  <Award className="h-3 w-3 mr-1" />
                  Завершён
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BookOpen className="h-4 w-4" />
                {lessons.length} уроков
              </div>
              <div className="flex-1">
                <Progress value={courseProgress} className="h-2" />
              </div>
              <span className="text-sm font-medium">{courseProgress}%</span>
            </div>
          </CardHeader>
        </Card>

        {/* Lessons list */}
        <div className="space-y-3">
          {lessons.map((lesson, index) => {
            const lessonProgress = progress?.lessons?.[lesson.id];
            const isUnlocked = isLessonUnlocked(selectedCourse, index);
            const isCompleted = lessonProgress?.completed;
            
            return (
              <Card 
                key={lesson.id}
                className={`transition-all ${
                  isUnlocked 
                    ? 'cursor-pointer hover:shadow-md hover:border-primary/50' 
                    : 'opacity-60'
                }`}
                onClick={() => isUnlocked && handleStartLesson(selectedCourse, lesson)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  {/* Thumbnail or status icon */}
                  {lesson.thumbnailUrl ? (
                    <div className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted relative">
                      <img 
                        src={lesson.thumbnailUrl} 
                        alt={lesson.title}
                        className="w-full h-full object-cover"
                      />
                      {isCompleted && (
                        <div className="absolute inset-0 bg-green-500/80 flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6 text-white" />
                        </div>
                      )}
                      {!isUnlocked && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Lock className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCompleted 
                        ? 'bg-green-500 text-white' 
                        : isUnlocked 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : isUnlocked ? (
                        <PlayCircle className="h-5 w-5" />
                      ) : (
                        <Lock className="h-5 w-5" />
                      )}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium">{lesson.title}</h3>
                    {lesson.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{lesson.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {lesson.questions?.length > 0 && (
                      <Badge variant="outline">
                        <FileQuestion className="h-3 w-3 mr-1" />
                        {lesson.questions.length}
                      </Badge>
                    )}
                    {lessonProgress?.score !== null && lessonProgress?.score !== undefined && (
                      <Badge variant={isCompleted ? 'default' : 'secondary'}>
                        {lessonProgress.score}%
                      </Badge>
                    )}
                    
                    {/* Admin buttons */}
                    {isAdmin && (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setEditingCourse(selectedCourse);
                            setEditingLesson(lesson);
                            setShowLessonDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                          onClick={() => handleDeleteLesson(selectedCourse.id, lesson.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    {isUnlocked && !isAdmin && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {/* Admin: Add lesson button */}
        {isAdmin && (
          <Button
            className="w-full mt-4"
            variant="outline"
            onClick={() => {
              setEditingCourse(selectedCourse);
              setEditingLesson({ title: '', description: '', isActive: true, passingScore: 100, questions: [] });
              setShowLessonDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Добавить урок
          </Button>
        )}
      </div>
    );
  }

  // Main view - courses list
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            Обучение
          </h1>
          <p className="text-muted-foreground mt-1">
            Обучающие курсы для менеджеров
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditingCourse({ title: '', description: '', isActive: true }); setShowCourseDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Создать курс
          </Button>
        )}
      </div>

      {/* Admin tabs */}
      {isAdmin ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="courses">
              <BookOpen className="h-4 w-4 mr-2" />
              Курсы
            </TabsTrigger>
            <TabsTrigger value="objections">
              <MessageSquareQuote className="h-4 w-4 mr-2" />
              Возражения
            </TabsTrigger>
            <TabsTrigger value="statistics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Статистика
            </TabsTrigger>
          </TabsList>

          <TabsContent value="objections" className="mt-6">
            {renderObjectionsTab()}
          </TabsContent>

          <TabsContent value="statistics" className="mt-6">
            {statistics && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{statistics.totalCourses}</div>
                    <div className="text-sm text-muted-foreground">Курсов</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{statistics.totalLessons}</div>
                    <div className="text-sm text-muted-foreground">Уроков</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{statistics.totalEnrollments}</div>
                    <div className="text-sm text-muted-foreground">Записей на курсы</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{statistics.completedCourses}</div>
                    <div className="text-sm text-muted-foreground">Завершённых курсов</div>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Users progress table */}
            {usersStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Прогресс сотрудников
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">Сотрудник</th>
                          <th className="text-left py-3 px-4 font-medium">Роль</th>
                          <th className="text-center py-3 px-4 font-medium">Пройдено курсов</th>
                          <th className="text-center py-3 px-4 font-medium">В процессе</th>
                          <th className="text-center py-3 px-4 font-medium">Прогресс</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersStats
                          .filter(u => u.role === 'employee' || u.role === 'admin')
                          .map(userStat => (
                          <tr key={userStat.userId} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-3 px-4">
                              <div className="font-medium">{userStat.username}</div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline">
                                {userStat.role === 'admin' ? 'Админ' : 'Менеджер'}
                              </Badge>
                            </td>
                            <td className="text-center py-3 px-4">
                              <span className="font-medium text-green-600">{userStat.completedCourses}</span>
                              <span className="text-muted-foreground"> / {userStat.totalCourses}</span>
                            </td>
                            <td className="text-center py-3 px-4">
                              <span className="text-orange-500">{userStat.inProgressCourses}</span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Progress value={userStat.completionRate} className="h-2 flex-1" />
                                <span className="text-sm font-medium w-12 text-right">{userStat.completionRate}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {usersStats.filter(u => u.role === 'employee' || u.role === 'admin').length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Нет данных о прогрессе сотрудников
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Courses grid */}
      {(activeTab === 'courses' || !isAdmin) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.filter(c => isAdmin || c.isActive).map(course => {
            const courseProgress = getCourseProgress(course);
            const progress = userProgress[course.id];
            const lessonsCount = course.lessons?.filter(l => l.isActive !== false).length || 0;
            
            return (
              <Card 
                key={course.id}
                className="group cursor-pointer transition-all hover:shadow-lg hover:border-primary/50"
                onClick={() => setSelectedCourse(course)}
              >
                {course.coverImage && (
                  <div className="aspect-video bg-muted rounded-t-lg overflow-hidden">
                    <img src={course.coverImage} alt={course.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{course.title}</CardTitle>
                    {!course.isActive && <Badge variant="secondary">Скрыт</Badge>}
                  </div>
                  {course.description && (
                    <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{lessonsCount} уроков</span>
                    {progress?.isCompleted && (
                      <Badge className="bg-green-500">
                        <Award className="h-3 w-3 mr-1" />
                        Пройден
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Progress value={courseProgress} className="h-2" />
                    <div className="text-xs text-muted-foreground text-right">{courseProgress}% завершено</div>
                  </div>
                  
                  {/* Admin buttons */}
                  {isAdmin && (
                    <div className="flex gap-2 pt-2" onClick={e => e.stopPropagation()}>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => { setEditingCourse(course); setShowCourseDialog(true); }}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Редактировать
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => { setEditingCourse(course); setEditingLesson({ title: '', description: '', isActive: true, passingScore: 100, questions: [] }); setShowLessonDialog(true); }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleDeleteCourse(course.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {courses.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Пока нет доступных курсов</p>
            </div>
          )}
        </div>
      )}

      {/* Course Dialog */}
      <Dialog open={showCourseDialog} onOpenChange={setShowCourseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCourse?.id ? 'Редактировать курс' : 'Новый курс'}</DialogTitle>
            <DialogDescription>Заполните информацию о курсе</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Название курса *</Label>
              <Input
                value={editingCourse?.title || ''}
                onChange={e => setEditingCourse({ ...editingCourse, title: e.target.value })}
                placeholder="Введите название"
              />
            </div>
            <div className="space-y-2">
              <Label>Описание</Label>
              <Textarea
                value={editingCourse?.description || ''}
                onChange={e => setEditingCourse({ ...editingCourse, description: e.target.value })}
                placeholder="Описание курса"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>URL обложки</Label>
              <Input
                value={editingCourse?.coverImage || ''}
                onChange={e => setEditingCourse({ ...editingCourse, coverImage: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editingCourse?.isActive !== false}
                onCheckedChange={checked => setEditingCourse({ ...editingCourse, isActive: checked })}
              />
              <Label>Курс активен</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCourseDialog(false)}>Отмена</Button>
            <Button onClick={handleSaveCourse}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={showLessonDialog} onOpenChange={setShowLessonDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{editingLesson?.id && courses.find(c => c.id === editingCourse?.id)?.lessons?.some(l => l.id === editingLesson.id) ? 'Редактировать урок' : 'Новый урок'}</DialogTitle>
            <DialogDescription>Курс: {editingCourse?.title}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 180px)' }}>
            <div className="space-y-6 py-4">
              {/* Basic info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Название урока *</Label>
                  <Input
                    value={editingLesson?.title || ''}
                    onChange={e => setEditingLesson({ ...editingLesson, title: e.target.value })}
                    placeholder="Введите название"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Описание</Label>
                  <Textarea
                    value={editingLesson?.description || ''}
                    onChange={e => setEditingLesson({ ...editingLesson, description: e.target.value })}
                    placeholder="Краткое описание урока"
                    rows={2}
                  />
                </div>
              </div>

              {/* Thumbnail / Cover */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <FileImage className="h-4 w-4" />
                  Обложка урока
                </h3>
                <div className="space-y-2">
                  <Label>URL изображения или GIF</Label>
                  <Input
                    value={editingLesson?.thumbnailUrl || ''}
                    onChange={e => setEditingLesson({ ...editingLesson, thumbnailUrl: e.target.value })}
                    placeholder="https://... (можно вставить GIF из Synthesia)"
                  />
                  {editingLesson?.thumbnailUrl && (
                    <div className="mt-2 rounded-lg overflow-hidden border max-w-xs">
                      <img 
                        src={editingLesson.thumbnailUrl} 
                        alt="Превью" 
                        className="w-full h-auto"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Video */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Видео
                </h3>
                <div className="space-y-2">
                  <Label>Embed код (Synthesia)</Label>
                  <Textarea
                    value={editingLesson?.videoEmbed || ''}
                    onChange={e => setEditingLesson({ ...editingLesson, videoEmbed: e.target.value })}
                    placeholder='<iframe src="..." ...></iframe>'
                    rows={3}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              {/* Test settings */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <FileQuestion className="h-4 w-4" />
                  Тест
                </h3>
                <div className="space-y-2">
                  <Label>Проходной балл: {editingLesson?.passingScore || 100}%</Label>
                  <Slider
                    value={[editingLesson?.passingScore || 100]}
                    onValueChange={([v]) => setEditingLesson({ ...editingLesson, passingScore: v })}
                    min={10}
                    max={100}
                    step={10}
                  />
                </div>
              </div>

              {/* Questions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Вопросы ({editingLesson?.questions?.length || 0})</h3>
                  <Button variant="outline" size="sm" onClick={addQuestion}>
                    <Plus className="h-4 w-4 mr-1" />
                    Добавить вопрос
                  </Button>
                </div>

                {editingLesson?.questions?.map((q, qIndex) => (
                  <Card key={q.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-sm mt-2">{qIndex + 1}.</span>
                        <div className="flex-1 space-y-2">
                          <Input
                            value={q.text}
                            onChange={e => updateQuestion(qIndex, 'text', e.target.value)}
                            placeholder="Текст вопроса"
                          />
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeQuestion(qIndex)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>

                      <div className="pl-6 space-y-2">
                        <Label className="text-xs">Варианты ответов (выберите правильный)</Label>
                        {q.options.map((opt, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${q.id}`}
                              checked={q.correctAnswer === optIndex}
                              onChange={() => updateQuestion(qIndex, 'correctAnswer', optIndex)}
                              className="w-4 h-4"
                            />
                            <Input
                              value={opt}
                              onChange={e => updateQuestionOption(qIndex, optIndex, e.target.value)}
                              placeholder={`Вариант ${optIndex + 1}`}
                              className="flex-1"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="pl-6">
                        <Input
                          value={q.explanation || ''}
                          onChange={e => updateQuestion(qIndex, 'explanation', e.target.value)}
                          placeholder="Пояснение (опционально)"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Active switch */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingLesson?.isActive !== false}
                  onCheckedChange={checked => setEditingLesson({ ...editingLesson, isActive: checked })}
                />
                <Label>Урок активен</Label>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowLessonDialog(false)}>Отмена</Button>
            <Button onClick={handleSaveLesson}>Сохранить урок</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrainingPage;
