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
    <div className="max-w-4xl mx-auto p-4 md:p-12 w-full">
      <header className="flex items-center gap-4 mb-8 md:mb-12">
        <button 
          onClick={onBack}
          className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Performance</h1>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-8 md:mb-12">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 text-zinc-400 mb-2">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            <h2 className="font-medium">Average Speed</h2>
          </div>
          <div className="text-4xl font-bold font-mono text-zinc-100">
            {averageWpm || '--'} <span className="text-lg text-zinc-500">WPM</span>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="text-zinc-400 mb-2 font-medium">Sessions Tracked</div>
          <div className="text-4xl font-bold font-mono text-zinc-100">
            {data.length}
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 h-[400px]">
        <h2 className="text-xl font-bold text-zinc-100 mb-6">WPM Over Time</h2>
        
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#52525b" 
                tick={{ fill: '#71717a', fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#52525b" 
                tick={{ fill: '#71717a', fontSize: 12, fontFamily: 'monospace' }} 
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="wpm" 
                stroke="#f59e0b" 
                strokeWidth={3}
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#fff', stroke: '#f59e0b', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 pb-12">
            <TrendingUp className="w-12 h-12 mb-4 text-zinc-800" />
            <p className="text-lg font-medium text-zinc-400">No reading history yet</p>
            <p className="text-sm">Read a document to track your progress</p>
          </div>
        )}
      </div>
    </div>
  );
}
