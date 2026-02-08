import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Legend, Cell
} from 'recharts';
import { Download, Calendar, Filter, Loader2, TrendingUp, Users, DollarSign, Target } from 'lucide-react';
import { api } from '../services/api';

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
        try {
            const reportData = await api.reports.getPerformanceData();
            setData(reportData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, []);

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
              <Loader2 size={32} className="animate-spin mb-4 text-indigo-600" />
              <p>Raporlar hazırlanıyor...</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Detaylı Raporlar</h2>
          <p className="text-slate-500 mt-1">Dönüşüm hunisi ve performans metrikleri.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
            <Calendar size={16} /> Bu Ay
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm">
            <Download size={16} /> PDF İndir
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Users size={20}/></div>
                  <span className="text-sm text-slate-500 font-medium">Toplam Lead</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">450</div>
              <div className="text-xs text-green-600 mt-1 flex items-center">
                  <TrendingUp size={12} className="mr-1"/> Geçen aya göre +%12
              </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Target size={20}/></div>
                  <span className="text-sm text-slate-500 font-medium">Dönüşüm</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">%2.6</div>
              <div className="text-xs text-green-600 mt-1 flex items-center">
                  <TrendingUp size={12} className="mr-1"/> Hedefin üzerinde
              </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><DollarSign size={20}/></div>
                  <span className="text-sm text-slate-500 font-medium">Beklenen Ciro</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">₺280K</div>
              <div className="text-xs text-slate-400 mt-1">
                  12 aktif satıştan
              </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Filter size={20}/></div>
                  <span className="text-sm text-slate-500 font-medium">Yanıt Oranı</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">%22</div>
              <div className="text-xs text-red-500 mt-1 flex items-center">
                   Sektör ortalaması %25
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-6">Satış Hunisi (Funnel)</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={data.funnel}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}} />
                <Bar dataKey="value" barSize={30} radius={[0, 4, 4, 0]}>
                    {
                        data.funnel.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))
                    }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar Chart (Sector Performance) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-6">Sektörel Performans Analizi</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data.sectorSuccessRate}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#64748b' }} />
                <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} />
                <Radar
                  name="Mail Açılma"
                  dataKey="A"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.6}
                />
                <Radar
                  name="Dönüşüm"
                  dataKey="B"
                  stroke="#82ca9d"
                  fill="#82ca9d"
                  fillOpacity={0.6}
                />
                <Legend />
                <Tooltip contentStyle={{borderRadius: '8px'}} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Area Chart (Weekly Trend) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-6">Haftalık Gönderim vs Yanıt Trendi</h3>
        <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart
                data={data.weeklyTrend}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
                <defs>
                <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorResponse" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis tick={{fontSize: 12}} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <Tooltip contentStyle={{borderRadius: '8px'}} />
                <Area type="monotone" dataKey="sent" stroke="#8884d8" fillOpacity={1} fill="url(#colorSent)" name="Gönderilen Mail" />
                <Area type="monotone" dataKey="response" stroke="#82ca9d" fillOpacity={1} fill="url(#colorResponse)" name="Gelen Yanıt" />
            </AreaChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Reports;