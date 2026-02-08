import React from 'react';
import { 
  Building2, 
  Mail, 
  MessageCircle, 
  Flame,
  ArrowUpRight,
  MoreHorizontal
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { getStats, MOCK_LOGS } from '../services/mockService';

const Dashboard: React.FC = () => {
  const stats = getStats();

  const sectorData = [
    { name: 'Sağlık', value: 35 },
    { name: 'Restoran', value: 25 },
    { name: 'Emlak', value: 20 },
    { name: 'Güzellik', value: 15 },
    { name: 'Diğer', value: 5 },
  ];

  const dailyData = [
    { name: 'Pzt', lead: 40, mail: 35 },
    { name: 'Sal', lead: 30, mail: 25 },
    { name: 'Çar', lead: 50, mail: 45 },
    { name: 'Per', lead: 42, mail: 38 },
    { name: 'Cum', lead: 35, mail: 30 },
  ];

  const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#94a3b8'];

  return (
    <div className="space-y-6">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
              <Building2 size={24} />
            </div>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
              <ArrowUpRight size={14} /> %85
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-slate-500 text-sm font-medium">Taranan Firma</h3>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.taranan_firma}<span className="text-slate-400 text-sm font-normal">/100</span></p>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${stats.hedef_orani}%` }}></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
              <Mail size={24} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-slate-500 text-sm font-medium">Mail Gönderildi</h3>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.mail_gonderildi}</p>
          </div>
          <p className="text-sm text-slate-400 mt-4">Bugün {stats.lead_sayisi} lead bulundu</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
              <MessageCircle size={24} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-slate-500 text-sm font-medium">Geri Dönüş</h3>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.geri_donus}</p>
          </div>
          <p className="text-sm text-emerald-600 mt-4 font-medium">%7.8 Dönüşüm Oranı</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm relative overflow-hidden group hover:border-orange-200 transition-colors cursor-pointer">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-100 rounded-full -mr-8 -mt-8 opacity-20 group-hover:opacity-40 transition-opacity"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="p-3 bg-orange-50 rounded-lg text-orange-600">
              <Flame size={24} />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <h3 className="text-slate-500 text-sm font-medium">Sıcak Lead</h3>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.sicak_leadler}</p>
          </div>
          <p className="text-sm text-orange-600 mt-4 font-medium relative z-10">Hemen aksiyon al</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-slate-800">Günlük Aktivite</h3>
            <select className="text-sm border border-slate-200 rounded-lg px-3 py-1 text-slate-600 bg-slate-50 outline-none">
              <option>Son 7 Gün</option>
              <option>Bu Ay</option>
            </select>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="lead" fill="#6366f1" radius={[4, 4, 0, 0]} name="Leadler" barSize={32} />
                <Bar dataKey="mail" fill="#93c5fd" radius={[4, 4, 0, 0]} name="Mailler" barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">Sektör Dağılımı</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sectorData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sectorData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {sectorData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-medium text-slate-900">%{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Action Log */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75"></div>
            </div>
            <h3 className="font-semibold text-slate-800">Canlı Ajan Aktiviteleri</h3>
          </div>
          <button className="text-slate-400 hover:text-slate-600">
            <MoreHorizontal size={20} />
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {MOCK_LOGS.map((log) => (
            <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
              <span className="text-xs font-mono text-slate-400 mt-1">{log.timestamp}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">
                  {log.action}
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    log.type === 'success' ? 'bg-green-100 text-green-700' :
                    log.type === 'error' ? 'bg-red-100 text-red-700' :
                    log.type === 'warning' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {log.type.toUpperCase()}
                  </span>
                </p>
                <p className="text-sm text-slate-500 mt-1">{log.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 bg-slate-50 text-center border-t border-slate-200">
          <button className="text-sm text-indigo-600 font-medium hover:text-indigo-700">Tüm Kayıtları Gör</button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;