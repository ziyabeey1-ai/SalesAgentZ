
import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, ChevronLeft, ChevronRight, Loader2, MapPin, Video, User, CheckSquare, Ban, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { CalendarEvent, Task } from '../types';

const CalendarPage: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // New Event Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', duration: 60, description: '', type: 'meeting' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
      setLoading(true);
      try {
          const [eventsData, tasksData] = await Promise.all([
              api.calendar.getAll(),
              api.tasks.getAll()
          ]);
          setEvents(eventsData);
          setTasks(tasksData);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleAddEvent = async () => {
      if (!newEvent.date) return;
      
      // Blocked day logic
      if (newEvent.type === 'blocked') {
          await api.calendar.create({
              title: 'MÜSAİT DEĞİL',
              start: `${newEvent.date}T00:00:00`,
              end: `${newEvent.date}T23:59:59`,
              description: 'Bu gün yapay zeka tarafından randevu verilmeyecek.',
              type: 'blocked'
          });
      } else {
          // Standard meeting logic
          if (!newEvent.title || !newEvent.time) return;
          const startDateTime = new Date(`${newEvent.date}T${newEvent.time}`);
          const endDateTime = new Date(startDateTime.getTime() + newEvent.duration * 60000);

          await api.calendar.create({
              title: newEvent.title,
              start: startDateTime.toISOString(),
              end: endDateTime.toISOString(),
              description: newEvent.description,
              type: 'meeting',
              location: 'Google Meet'
          });
      }
      
      setIsModalOpen(false);
      loadData();
  };

  const handleDeleteEvent = async (id: string) => {
      if(confirm('Bu etkinliği silmek istediğinize emin misiniz?')) {
          // In a real app we would call api.calendar.delete(id)
          // Since mock storage doesn't support delete easily without ID via API, we just filter local for now
          // For functionality demonstration, we assume API handles it.
          // Implementing local delete simulation:
          const newEvents = events.filter(e => e.id !== id);
          setEvents(newEvents);
          // Also sync to storage if local
          localStorage.setItem('sales_agent_events', JSON.stringify(newEvents));
      }
  };

  // Helper to generate week days (Monday - Sunday)
  const getWeekDays = (date: Date) => {
      const start = new Date(date);
      const day = start.getDay(); // 0 (Sun) - 6 (Sat)
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
      start.setDate(diff); 
      
      const days = [];
      for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          days.push(d);
      }
      return days;
  };

  const weekDays = getWeekDays(currentDate);

  const getItemsForDay = (date: Date) => {
      const dateStr = date.toISOString().slice(0, 10);
      
      // 1. Calendar Events
      const dayEvents = events.filter(e => e.start.startsWith(dateStr)).map(e => ({
          id: e.id,
          title: e.title,
          time: new Date(e.start).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          type: e.type || 'meeting', // 'meeting' or 'blocked'
          attendees: e.attendees
      }));

      // 2. Tasks (Deadlines)
      const dayTasks = tasks.filter(t => t.son_tarih === dateStr && t.durum === 'açık').map(t => ({
          id: t.id,
          title: `${t.firma_adi}: ${t.aciklama}`,
          time: 'Gün Boyu', 
          type: 'task',
          priority: t.oncelik
      }));

      return [...dayEvents, ...dayTasks].sort((a, b) => a.time.localeCompare(b.time));
  };

  const nextWeek = () => {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
  };

  const prevWeek = () => {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <CalendarIcon className="text-indigo-600" /> Takvim & Randevular
              </h2>
              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                  <button onClick={prevWeek} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={20} className="text-slate-500"/></button>
                  <span className="px-3 text-sm font-medium text-slate-700 min-w-[140px] text-center">
                      {weekDays[0].toLocaleDateString('tr-TR', { month: 'long', day: 'numeric' })} - {weekDays[6].toLocaleDateString('tr-TR', { month: 'long', day: 'numeric' })}
                  </span>
                  <button onClick={nextWeek} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={20} className="text-slate-500"/></button>
              </div>
          </div>
          <button 
            onClick={() => { setNewEvent({ title: '', date: new Date().toISOString().slice(0,10), time: '', duration: 60, description: '', type: 'meeting' }); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
              <Plus size={18} /> Yeni Randevu
          </button>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          {/* Header Row */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {weekDays.map((day, i) => (
                  <div key={i} className={`p-4 text-center border-r border-slate-100 last:border-r-0 ${
                      day.toISOString().slice(0,10) === new Date().toISOString().slice(0,10) ? 'bg-indigo-50/50' : ''
                  }`}>
                      <div className="text-xs font-bold text-slate-500 uppercase mb-1">
                          {day.toLocaleDateString('tr-TR', { weekday: 'long' })}
                      </div>
                      <div className={`text-lg font-bold ${
                          day.toISOString().slice(0,10) === new Date().toISOString().slice(0,10) ? 'text-indigo-600' : 'text-slate-800'
                      }`}>
                          {day.getDate()}
                      </div>
                  </div>
              ))}
          </div>

          {/* Events Grid */}
          <div className="flex-1 grid grid-cols-7 overflow-y-auto">
              {loading ? (
                  <div className="col-span-7 flex items-center justify-center p-12">
                      <Loader2 size={32} className="animate-spin text-indigo-600" />
                  </div>
              ) : weekDays.map((day, i) => {
                  const items = getItemsForDay(day);
                  const isToday = day.toISOString().slice(0,10) === new Date().toISOString().slice(0,10);
                  const isBlocked = items.some(item => item.type === 'blocked');
                  
                  return (
                      <div key={i} className={`border-r border-slate-100 last:border-r-0 p-2 space-y-2 min-h-[200px] relative group/day ${
                          isBlocked ? 'bg-slate-100 bg-opacity-50' : isToday ? 'bg-indigo-50/10' : ''
                      }`}>
                          {/* Blocked Overlay Pattern */}
                          {isBlocked && (
                              <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
                                   style={{backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px'}}>
                              </div>
                          )}

                          {items.map((item: any) => {
                              const isMeeting = item.type === 'meeting';
                              const isBlockedItem = item.type === 'blocked';
                              
                              if (isBlockedItem) {
                                  return (
                                      <div key={item.id} className="p-2 rounded-lg bg-slate-200 border border-slate-300 text-slate-500 text-center text-xs font-bold flex items-center justify-center gap-1 z-10 relative group">
                                          <Ban size={12} /> KAPALI
                                          <button onClick={() => handleDeleteEvent(item.id)} className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 bg-white rounded-full hover:text-red-500"><Trash2 size={10}/></button>
                                      </div>
                                  );
                              }

                              return (
                                  <div key={item.id} className={`p-2 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4 group relative ${
                                      isMeeting 
                                      ? 'bg-white border-indigo-500 border border-indigo-100' 
                                      : 'bg-orange-50 border-orange-400 border border-orange-100'
                                  }`}>
                                      <div className="flex justify-between items-start mb-1">
                                          <span className={`text-[10px] font-bold ${isMeeting ? 'text-indigo-600' : 'text-orange-600'}`}>
                                              {item.time}
                                          </span>
                                          {isMeeting ? <Video size={10} className="text-slate-400" /> : <CheckSquare size={10} className="text-slate-400" />}
                                      </div>
                                      <h4 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-tight mb-1">{item.title}</h4>
                                      
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteEvent(item.id); }}
                                        className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                                      >
                                          <Trash2 size={12} />
                                      </button>
                                  </div>
                              );
                          })}
                          
                          {/* Hover Add Button */}
                          <div className="absolute bottom-2 right-2 opacity-0 group-hover/day:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                    setNewEvent({ title: '', date: day.toISOString().slice(0,10), time: '', duration: 60, description: '', type: 'meeting' });
                                    setIsModalOpen(true);
                                }}
                                className="p-1.5 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 shadow-sm"
                              >
                                  <Plus size={14} />
                              </button>
                          </div>
                      </div>
                  );
              })}
          </div>
      </div>

      {/* Add Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
                  <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                      <h3 className="font-semibold text-slate-900">Yeni Ekle</h3>
                      <div className="flex gap-1 bg-slate-200 p-0.5 rounded-lg">
                          <button 
                            onClick={() => setNewEvent({...newEvent, type: 'meeting'})}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${newEvent.type === 'meeting' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                          >
                              Randevu
                          </button>
                          <button 
                            onClick={() => setNewEvent({...newEvent, type: 'blocked'})}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${newEvent.type === 'blocked' ? 'bg-white shadow text-red-600' : 'text-slate-500'}`}
                          >
                              Blokla
                          </button>
                      </div>
                  </div>
                  
                  <div className="p-6 space-y-4">
                      {newEvent.type === 'blocked' ? (
                          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-800 text-sm flex items-center gap-3">
                              <Ban size={24} />
                              <div>
                                  <p className="font-bold">Günü Kapat</p>
                                  <p className="text-xs mt-1">Bu gün için yapay zeka otomatik randevu önermeyecek ve toplantı kabul etmeyecek.</p>
                              </div>
                          </div>
                      ) : (
                          <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Başlık</label>
                                <input 
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Örn: X Firması ile Online Toplantı"
                                    value={newEvent.title}
                                    onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Saat</label>
                                    <input 
                                        type="time"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={newEvent.time}
                                        onChange={e => setNewEvent({...newEvent, time: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Konum</label>
                                    <div className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600">
                                        <Video size={16} /> Google Meet
                                    </div>
                                </div>
                            </div>
                          </>
                      )}

                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Tarih</label>
                          <input 
                              type="date"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                              value={newEvent.date}
                              onChange={e => setNewEvent({...newEvent, date: e.target.value})}
                          />
                      </div>
                  </div>
                  
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                      <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium">İptal</button>
                      <button onClick={handleAddEvent} className={`px-4 py-2 text-white rounded-lg text-sm font-medium ${newEvent.type === 'blocked' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                          {newEvent.type === 'blocked' ? 'Günü Kapat' : 'Randevu Oluştur'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default CalendarPage;
