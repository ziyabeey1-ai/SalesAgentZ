import React, { useState } from 'react';
import { Calendar, CheckSquare, Clock, AlertTriangle, Check } from 'lucide-react';
import { MOCK_TASKS } from '../services/mockService';
import { STATUS_COLORS } from '../constants';

const Tasks: React.FC = () => {
  // Local state for tasks to make UI interactive
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const [filterMode, setFilterMode] = useState<'all' | 'today'>('all');

  const toggleTask = (taskId: string) => {
    setTasks(prevTasks => prevTasks.map(task => 
      task.id === taskId 
        ? { ...task, durum: task.durum === 'açık' ? 'tamamlandı' : 'açık' } 
        : task
    ));
  };

  const getFilteredTasks = () => {
      let filtered = tasks;
      if (filterMode === 'today') {
          const today = new Date().toISOString().slice(0, 10);
          // For demo purposes, let's assume '2024-05-21' is roughly today in our mock data context, 
          // or just filter mostly upcoming. Since mock dates are hardcoded, let's just 
          // show a subset or assume today is 2024-05-21.
          filtered = tasks.filter(t => t.son_tarih === '2024-05-21' || t.son_tarih === '2024-05-22');
      }
      return filtered;
  };

  const filteredTasks = getFilteredTasks();
  const activeTasks = filteredTasks.filter(t => t.durum === 'açık');
  const completedTasks = filteredTasks.filter(t => t.durum === 'tamamlandı');

  // Sorted: Active first, then by priority
  const displayTasks = [...activeTasks, ...completedTasks];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Task List */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Bekleyen Görevler</h2>
          <div className="flex gap-2">
             <button 
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 text-sm rounded-lg border font-medium transition-colors ${
                    filterMode === 'all' 
                    ? 'bg-white border-slate-200 shadow-sm text-slate-900' 
                    : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                }`}
             >
                 Tümü
             </button>
             <button 
                onClick={() => setFilterMode('today')}
                className={`px-3 py-1 text-sm rounded-lg border font-medium transition-colors ${
                    filterMode === 'today' 
                    ? 'bg-white border-slate-200 shadow-sm text-slate-900' 
                    : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                }`}
             >
                 Bugün
             </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {displayTasks.length > 0 ? displayTasks.map((task) => (
              <div 
                key={task.id} 
                className={`p-4 transition-colors group ${
                    task.durum === 'tamamlandı' ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <button 
                        onClick={() => toggleTask(task.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            task.durum === 'tamamlandı' 
                            ? 'bg-indigo-600 border-indigo-600 text-white' 
                            : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50'
                        }`}
                    >
                      {task.durum === 'tamamlandı' && <Check size={14} />}
                    </button>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-medium ${task.durum === 'tamamlandı' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                          {task.aciklama}
                      </h3>
                      {task.durum === 'açık' && (
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            task.oncelik === 'Yüksek' ? 'bg-red-50 text-red-600' : 
                            task.oncelik === 'Orta' ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                            {task.oncelik}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {task.son_tarih}
                      </span>
                      <span className="flex items-center gap-1 text-indigo-600 font-medium">
                        {task.firma_adi}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${STATUS_COLORS[task.lead_durumu]}`}>
                        {task.lead_durumu}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )) : (
                <div className="p-8 text-center text-slate-500 italic">
                    Bu filtreye uygun görev bulunamadı.
                </div>
            )}
            
            {/* Additional dummy task to illustrate completed state initially if none exist */}
            {filterMode === 'all' && (
                <div className="p-4 hover:bg-slate-50 transition-colors group opacity-60">
                    <div className="flex items-start gap-4">
                    <div className="mt-1">
                        <div className="w-5 h-5 rounded bg-indigo-600 border border-indigo-600 flex items-center justify-center text-white">
                            <CheckSquare size={14} />
                        </div>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-medium text-slate-900 line-through">Günlük Lead Taraması Kontrolü</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            Bugün
                        </span>
                        <span className="text-slate-400">Sistem Görevi</span>
                        </div>
                    </div>
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Mini Calendar / Summary */}
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">Günün Özeti</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-red-50 text-red-700 rounded-lg border border-red-100">
              <AlertTriangle size={20} />
              <div>
                <p className="font-medium text-sm">3 Kritik Görev</p>
                <p className="text-xs opacity-80">Bugün tamamlanmalı</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
              <Clock size={20} />
              <div>
                <p className="font-medium text-sm">5 Follow-up</p>
                <p className="text-xs opacity-80">Otomatik gönderim bekliyor</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4">Takvim</h3>
            {/* Simple CSS Grid Calendar Visualization */}
            <div className="grid grid-cols-7 gap-1 text-center text-sm mb-2">
                <div className="text-slate-400 text-xs">Pt</div>
                <div className="text-slate-400 text-xs">Sa</div>
                <div className="text-slate-400 text-xs">Ça</div>
                <div className="text-slate-400 text-xs">Pe</div>
                <div className="text-slate-400 text-xs">Cu</div>
                <div className="text-slate-400 text-xs">Ct</div>
                <div className="text-slate-400 text-xs">Pa</div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
                <div className="p-2 text-slate-300">29</div>
                <div className="p-2 text-slate-300">30</div>
                <div className="p-2 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">1</div>
                <div className="p-2 text-slate-700 hover:bg-slate-50 rounded cursor-pointer">2</div>
                <div className="p-2 text-slate-700 hover:bg-slate-50 rounded cursor-pointer">3</div>
                <div className="p-2 text-slate-700 hover:bg-slate-50 rounded cursor-pointer">4</div>
                <div className="p-2 text-slate-700 hover:bg-slate-50 rounded cursor-pointer">5</div>
                
                <div className="p-2 text-slate-700 hover:bg-slate-50 rounded cursor-pointer relative">
                    6
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full"></span>
                </div>
                <div className="p-2 text-slate-700 hover:bg-slate-50 rounded cursor-pointer">7</div>
                <div className="p-2 text-slate-700 hover:bg-slate-50 rounded cursor-pointer">8</div>
                <div className="p-2 text-slate-700 hover:bg-slate-50 rounded cursor-pointer">9</div>
                <div className="p-2 text-slate-700 hover:bg-slate-50 rounded cursor-pointer">10</div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Tasks;