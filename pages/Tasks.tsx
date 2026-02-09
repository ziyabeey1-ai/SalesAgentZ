import React, { useState, useEffect } from 'react';
import { Calendar, CheckSquare, Clock, AlertTriangle, Check, Loader2, Plus, ArrowRight, Bell } from 'lucide-react';
import { api } from '../services/api';
import { Task } from '../types';
import { STATUS_COLORS } from '../constants';
import EmptyState from '../components/EmptyState';

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskInput, setNewTaskInput] = useState('');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
        const data = await api.tasks.getAll();
        setTasks(data);
    } catch (e) {
        console.error("Task fetch error", e);
    } finally {
        setLoading(false);
    }
  };

  const toggleTask = async (task: Task) => {
    const updatedStatus = task.durum === 'açık' ? 'tamamlandı' : 'açık';
    const updatedTask = { ...task, durum: updatedStatus as any };

    setTasks(prevTasks => prevTasks.map(t => t.id === task.id ? updatedTask : t));
    
    try {
        await api.tasks.update(updatedTask);
        await api.dashboard.logAction('Görev Güncellendi', `${task.aciklama}: ${updatedStatus}`, 'info');
    } catch (error) {
        setTasks(prevTasks => prevTasks.map(t => t.id === task.id ? task : t));
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTaskInput.trim()) return;

      const newTask: Task = {
          id: Math.random().toString(36).substr(2, 9),
          firma_adi: 'Genel',
          lead_durumu: 'takipte',
          gorev_tipi: 'follow_up',
          aciklama: newTaskInput,
          oncelik: 'Orta',
          son_tarih: new Date().toISOString().slice(0, 10),
          durum: 'açık'
      };

      setTasks([newTask, ...tasks]);
      setNewTaskInput('');
      await api.tasks.create(newTask);
  };

  // Grouping Logic
  const today = new Date().toISOString().slice(0, 10);
  
  const overdueTasks = tasks.filter(t => t.durum === 'açık' && t.son_tarih < today);
  const todayTasks = tasks.filter(t => t.durum === 'açık' && t.son_tarih === today);
  const upcomingTasks = tasks.filter(t => t.durum === 'açık' && t.son_tarih > today);
  const completedTasks = tasks.filter(t => t.durum === 'tamamlandı');

  if (loading) {
      return (
          <div className="flex items-center justify-center h-[500px]">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
      );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
        {/* Header with Quick Add */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
                <div>
                    <h2 className="text-3xl font-bold mb-2">Bugünün Planı</h2>
                    <p className="text-indigo-100 text-sm opacity-90">
                        {todayTasks.length} görev seni bekliyor. {overdueTasks.length > 0 && <span className="text-red-200 font-bold">{overdueTasks.length} tanesi gecikmiş!</span>}
                    </p>
                </div>
                
                <form onSubmit={handleQuickAdd} className="w-full md:w-96 relative">
                    <input 
                        type="text" 
                        value={newTaskInput}
                        onChange={(e) => setNewTaskInput(e.target.value)}
                        placeholder="Hızlı görev ekle..."
                        className="w-full pl-4 pr-12 py-3 rounded-xl bg-white/20 border border-white/30 backdrop-blur-md text-white placeholder-indigo-200 focus:bg-white/30 outline-none transition-all"
                    />
                    <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
                        <Plus size={18} />
                    </button>
                </form>
            </div>
        </div>

        {/* Task Sections */}
        <div className="grid grid-cols-1 gap-8">
            
            {/* OVERDUE SECTION */}
            {overdueTasks.length > 0 && (
                <section>
                    <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <AlertTriangle size={16} /> Gecikenler
                    </h3>
                    <div className="space-y-3">
                        {overdueTasks.map(task => (
                            <TaskCard key={task.id} task={task} onToggle={toggleTask} isOverdue />
                        ))}
                    </div>
                </section>
            )}

            {/* TODAY SECTION */}
            <section>
                <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Clock size={16} /> Bugün
                </h3>
                {todayTasks.length > 0 ? (
                    <div className="space-y-3">
                        {todayTasks.map(task => (
                            <TaskCard key={task.id} task={task} onToggle={toggleTask} />
                        ))}
                    </div>
                ) : (
                    <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 bg-slate-50/50">
                        <CheckSquare size={32} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">Bugün için planlanmış görev yok.</p>
                    </div>
                )}
            </section>

            {/* UPCOMING SECTION */}
            <section>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Calendar size={16} /> Gelecek
                </h3>
                {upcomingTasks.length > 0 ? (
                    <div className="space-y-3">
                        {upcomingTasks.map(task => (
                            <TaskCard key={task.id} task={task} onToggle={toggleTask} isUpcoming />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 italic">Yaklaşan görev yok.</p>
                )}
            </section>

            {/* COMPLETED SECTION (Collapsed by default logic could be added) */}
            {completedTasks.length > 0 && (
                <section className="pt-8 border-t border-slate-200">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Tamamlananlar</h3>
                    <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity">
                        {completedTasks.map(task => (
                            <TaskCard key={task.id} task={task} onToggle={toggleTask} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    </div>
  );
};

// Sub-component for Cleaner Code
const TaskCard: React.FC<{ task: Task, onToggle: (t: Task) => void, isOverdue?: boolean, isUpcoming?: boolean }> = ({ task, onToggle, isOverdue, isUpcoming }) => {
    return (
        <div className={`group bg-white p-4 rounded-xl border transition-all hover:shadow-md flex items-center gap-4 ${
            isOverdue ? 'border-red-100 bg-red-50/30' : 
            task.durum === 'tamamlandı' ? 'border-slate-100 bg-slate-50' : 'border-slate-200'
        }`}>
            <button 
                onClick={() => onToggle(task)}
                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    task.durum === 'tamamlandı' 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : isOverdue ? 'border-red-300 hover:bg-red-100' : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50'
                }`}
            >
                {task.durum === 'tamamlandı' && <Check size={14} strokeWidth={3} />}
            </button>
            
            <div className="flex-1">
                <div className="flex justify-between items-start">
                    <span className={`font-medium text-sm ${task.durum === 'tamamlandı' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                        {task.aciklama}
                    </span>
                    {task.oncelik === 'Yüksek' && task.durum !== 'tamamlandı' && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">ACİL</span>
                    )}
                </div>
                
                <div className="flex items-center gap-3 mt-1.5">
                    <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                        <Calendar size={12} />
                        {isUpcoming ? new Date(task.son_tarih).toLocaleDateString('tr-TR', {day: 'numeric', month: 'long'}) : task.son_tarih}
                    </span>
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {task.firma_adi}
                    </span>
                    <span className={`text-[10px] uppercase font-bold text-slate-400 ${task.durum === 'tamamlandı' ? 'hidden' : ''}`}>
                        {task.gorev_tipi.replace('_', ' ')}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default Tasks;