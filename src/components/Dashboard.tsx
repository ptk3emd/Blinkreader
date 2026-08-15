import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { storage } from '../lib/storage';

interface DashboardProps {
  onBack: () => void;
}

interface ChartData {
  date: string;
  wpm: number;
}

export default function Dashboard({ onBack }: DashboardProps) {
  const [data, setData] = useState<ChartData[]>([]);
  const [averageWpm, setAverageWpm] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      const history = await storage.getWpmHistory();
      
      // Group by day and calculate average WPM for that day
      const grouped = history.reduce((acc, curr) => {
        const dateStr = new Date(curr.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!acc[dateStr]) {
          acc[dateStr] = { sum: 0, count: 0 };
        }
        acc[dateStr].sum += curr.wpm;
        acc[dateStr].count += 1;
        return acc;
      }, {} as Record<string, { sum: number; count: number }>);

      const chartData: ChartData[] = Object.entries(grouped).map(([date, { sum, count }]) => ({
        date,
        wpm: Math.round(sum / count)
      }));

      setData(chartData);
      
      if (history.length > 0) {
        const totalWpm = history.reduce((sum, entry) => sum + entry.wpm, 0);
        setAverageWpm(Math.round(totalWpm / history.length));
      }

      setLoading(false);
    };

    loadHistory();
  }, []);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg shadow-xl">
          <p className="text-zinc-400 text-sm mb-1">{label}</p>
          <p className="text-amber-500 font-bold font-mono">
            {payload[0].value} <span className="text-xs text-zinc-500">WPM</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-zinc-500">Loading dashboard...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-5 sm:p-8 md:p-12 w-full">
      <header className="flex items-center gap-4 mb-8 md:mb-12 pb-6 border-b border-[#33333c]">
        <button 
          onClick={onBack}
          className="p-2.5 text-[#9a9aa3] hover:text-[#e8e8ec] hover:bg-[#2a2a32] rounded-[11px] border border-[#33333c] transition-all cursor-pointer"
          title="Voltar para a biblioteca"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#9a9aa3]">
              Desempenho & Métricas
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] text-[#e8e8ec]">
            Histórico de Leitura
          </h1>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 mb-8 md:mb-12">
        <div className="bg-[#222228] border border-[#33333c] rounded-[24px] p-6 shadow-none flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-[#9a9aa3]">
              Velocidade Média
            </span>
            <div className="w-8 h-8 rounded-[8px] bg-[#35325f] text-[#c5c5ef] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-[-0.04em] text-[#e8e8ec]">
            {averageWpm || '--'} <span className="text-sm font-semibold text-[#9a9aa3] font-sans">WPM</span>
          </div>
        </div>

        <div className="bg-[#222228] border border-[#33333c] rounded-[24px] p-6 shadow-none flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-[#9a9aa3]">
              Sessões Registradas
            </span>
            <div className="w-8 h-8 rounded-[8px] bg-[#28342b] text-[#5fa777] flex items-center justify-center">
              <span className="text-xs font-bold font-mono">#</span>
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-[-0.04em] text-[#e8e8ec]">
            {data.length}
          </div>
        </div>
      </div>

      <div className="bg-[#222228] border border-[#33333c] rounded-[24px] p-6 sm:p-8 h-[420px] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-extrabold text-[#e8e8ec] tracking-[-0.02em]">
            Evolução de Velocidade (WPM)
          </h2>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#c5c5ef] bg-[#35325f] px-3 py-1 rounded-[30px]">
            Fluxo Contínuo
          </span>
        </div>
        
        {data.length > 0 ? (
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#33333c" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#9a9aa3" 
                  tick={{ fill: '#9a9aa3', fontSize: 12, fontFamily: 'Urbanist' }} 
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#9a9aa3" 
                  tick={{ fill: '#9a9aa3', fontSize: 12, fontFamily: 'monospace' }} 
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="wpm" 
                  stroke="#FCFD76" 
                  strokeWidth={3}
                  dot={{ fill: '#FCFD76', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#212121', stroke: '#FCFD76', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-[#9a9aa3] pb-6">
            <TrendingUp className="w-10 h-10 mb-3 text-[#33333c]" />
            <p className="text-base font-bold text-[#c2c2c9]">Nenhum histórico registrado ainda</p>
            <p className="text-xs text-[#9a9aa3] mt-1">Conclua leituras na biblioteca para gerar o gráfico de evolução.</p>
          </div>
        )}
      </div>
    </div>
  );
}
