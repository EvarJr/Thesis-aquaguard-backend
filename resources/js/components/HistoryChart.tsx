import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchHistoryData } from '@/services/apiService';
import { useTranslation } from '@/i18n';
import ErrorDisplay from '@/components/ErrorDisplay';
// @ts-ignore
import Echo from 'laravel-echo'; 

// ✅ Updated Interface to hold ALL sensor data
interface ChartPoint {
  timestamp: string;
  // Averages
  pressure_avg: number;
  flow_avg: number;
  // Individual Pressure
  p_main: number;
  p_dma1: number;
  p_dma2: number;
  p_dma3: number;
  // Individual Flow
  f_main: number;
  f_1: number;
  f_2: number;
  f_3: number;
}

const HistoryChart: React.FC = () => {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  // 🛠 HELPER: Calculate Average
  const calculateAverage = useCallback((row: any, type: 'pressure' | 'flow') => {
    const pressureCols = ['p_main', 'p_dma1', 'p_dma2', 'p_dma3'];
    const flowCols = ['f_main', 'f_1', 'f_2', 'f_3'];
    const targetCols = type === 'pressure' ? pressureCols : flowCols;
    
    let sum = 0;
    let count = 0;

    targetCols.forEach(col => {
        const val = Number(row[col]);
        if (!isNaN(val) && row[col] !== null) {
            sum += val;
            count++;
        }
    });
    return count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
  }, []);

  // 🛠 HELPER: Format Raw Data Row into ChartPoint
  const formatDataPoint = useCallback((row: any): ChartPoint => {
      return {
          timestamp: row.created_at || row.timestamp || new Date().toISOString(),
          
          // Averages
          pressure_avg: calculateAverage(row, 'pressure'),
          flow_avg: calculateAverage(row, 'flow'),

          // Individual Pressure (Handle missing values safely)
          p_main: Number(row.p_main || row.pressure || 0),
          p_dma1: Number(row.p_dma1 || 0),
          p_dma2: Number(row.p_dma2 || 0),
          p_dma3: Number(row.p_dma3 || 0),

          // Individual Flow
          f_main: Number(row.f_main || row.flowRate || 0),
          f_1: Number(row.f_1 || 0),
          f_2: Number(row.f_2 || 0),
          f_3: Number(row.f_3 || 0),
      };
  }, [calculateAverage]);

  // 1. LOAD INITIAL DATA
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const rawHistory = await fetchHistoryData();
        const processedData = rawHistory.map(formatDataPoint);
        // Take last 20 and reverse for chart order
        setData(processedData.reverse().slice(-20));
      } catch (e) {
        setError(t('errors.loadData'));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [formatDataPoint, t]);

  // 2. REAL-TIME LISTENER
  useEffect(() => {
    if (!window.Echo) return;
    const channel = window.Echo.channel('sensors');

    channel.listen('.sensor.updated', (event: any) => {
      if (event) {
        const payload = event.data || event;
        const newPoint = formatDataPoint(payload);

        setData((prevData) => {
          const newData = [...prevData, newPoint];
          if (newData.length > 20) return newData.slice(newData.length - 20);
          return newData;
        });
      }
    });

    return () => { window.Echo.leave('sensors'); };
  }, [formatDataPoint]);
  
  const formatXAxis = (tickItem: string) => {
    if (!tickItem) return '';
    return new Date(tickItem).toLocaleTimeString('en-US', { hour12: false, minute: '2-digit', second: '2-digit' });
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      
      {/* ==========================
          MAIN AVERAGE CHART 
      ========================== */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-gray-800">⚡ System Overview (Averages)</h2>
        <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
      </div>
      
      {loading && <div className="flex items-center justify-center h-64 text-gray-400">Loading Live Data...</div>}
      {error && <div className="flex items-center justify-center h-64"><ErrorDisplay message={error} /></div>}
      
      {!loading && !error && (
        <>
            <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="timestamp" tickFormatter={formatXAxis} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" stroke="#0ea5e9" fontSize={12} label={{ value: 'PSI', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={12} label={{ value: 'L/min', angle: 90, position: 'insideRight' }} />
                <Tooltip labelFormatter={(l) => new Date(l).toLocaleTimeString()} />
                <Legend verticalAlign="top" height={36}/>
                <Line yAxisId="left" type="monotone" dataKey="pressure_avg" stroke="#0ea5e9" strokeWidth={3} dot={false} isAnimationActive={false} name="Avg Pressure" />
                <Line yAxisId="right" type="monotone" dataKey="flow_avg" stroke="#10b981" strokeWidth={3} dot={false} isAnimationActive={false} name="Avg Flow" />
            </LineChart>
            </ResponsiveContainer>

            {/* ==========================
                SPACER / MARGIN
            ========================== */}
            <div className="mt-8 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Individual Sensor Telemetry</h3>
            </div>

            {/* ==========================
                DETAILED CHARTS (SIDE BY SIDE)
            ========================== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Detailed Pressure */}
                <div className="h-48">
                    <p className="text-xs font-bold text-center text-blue-600 mb-2">Pressure Sensors (PSI)</p>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f9ff" />
                            <XAxis dataKey="timestamp" hide />
                            <YAxis domain={[0, 'auto']} fontSize={10} width={30} />
                            <Tooltip labelFormatter={() => ''} contentStyle={{ fontSize: '12px' }} />
                            <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                            
                            <Line type="monotone" dataKey="p_main" stroke="#1e3a8a" strokeWidth={2} dot={false} isAnimationActive={false} name="Main" />
                            <Line type="monotone" dataKey="p_dma1" stroke="#3b82f6" strokeWidth={1} dot={false} isAnimationActive={false} name="DMA-1" />
                            <Line type="monotone" dataKey="p_dma2" stroke="#60a5fa" strokeWidth={1} dot={false} isAnimationActive={false} name="DMA-2" />
                            <Line type="monotone" dataKey="p_dma3" stroke="#93c5fd" strokeWidth={1} dot={false} isAnimationActive={false} name="DMA-3" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* 2. Detailed Flow */}
                <div className="h-48">
                    <p className="text-xs font-bold text-center text-green-600 mb-2">Flow Sensors (L/min)</p>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
                            <XAxis dataKey="timestamp" hide />
                            <YAxis domain={[0, 'auto']} fontSize={10} width={30} />
                            <Tooltip labelFormatter={() => ''} contentStyle={{ fontSize: '12px' }} />
                            <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />

                            <Line type="monotone" dataKey="f_main" stroke="#064e3b" strokeWidth={2} dot={false} isAnimationActive={false} name="Main" />
                            <Line type="monotone" dataKey="f_1" stroke="#10b981" strokeWidth={1} dot={false} isAnimationActive={false} name="F-1" />
                            <Line type="monotone" dataKey="f_2" stroke="#34d399" strokeWidth={1} dot={false} isAnimationActive={false} name="F-2" />
                            <Line type="monotone" dataKey="f_3" stroke="#6ee7b7" strokeWidth={1} dot={false} isAnimationActive={false} name="F-3" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </>
      )}
    </div>
  );
};

export default HistoryChart;