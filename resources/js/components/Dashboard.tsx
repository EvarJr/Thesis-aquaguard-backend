import React, { useState, useCallback, useEffect } from 'react';
import { User, Severity } from '@/types';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import StatCard from '@/components/StatCard';
import AlertsTable from '@/components/AlertsTable';
import HistoryChart from '@/components/HistoryChart';
import SensorManagement from '@/components/SensorManagement';
import HouseholdManagement from '@/components/HouseholdManagement';
import PumpManagement from '@/components/PumpManagement';
import UserManagement from '@/components/UserManagement';
import AIStatusSummary from '@/components/AIStatusSummary';
import PipelineMap from '@/components/PipelineMap';
import Forum from '@/components/Forum';
import MLTraining from '@/components/MLTraining';
import LogViewer from '@/components/LogViewer';
import SystemHealthScore from '@/components/SystemHealthScore';
import {
  WaterDropIcon,
  AlertTriangleIcon,
  BarChartIcon,
  SettingsIcon,
  HomeModernIcon,
} from '@/components/icons/IconComponents';
import { useTranslation } from '@/i18n';
import {
  addLog,
  fetchActiveAlerts,
  fetchHistoryData,
  fetchSensors,
  fetchHouseholds,
} from '@/services/apiService';
import FullScreenError from '@/components/FullScreenError';
import useAuthGuard from '@/hooks/useAuthGuard';

declare global {
    interface Window { Echo: any; }
}

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

interface Trend {
  direction: 'up' | 'down' | 'neutral';
  value: string;
}

interface Stat {
  value: string;
  trend?: Trend;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  useAuthGuard(user);

  const [activeView, setActiveView] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { t } = useTranslation();

  const [stats, setStats] = useState<Record<
    'alerts' | 'pressure' | 'flowRate' | 'sensors' | 'households',
    Stat
  >>({
    alerts: { value: '0' },
    pressure: { value: '0 PSI' },
    flowRate: { value: '0 L/min' },
    sensors: { value: '0' },
    households: { value: '0' },
  });

  const [healthScore, setHealthScore] = useState(100);
  const [statsLoading, setStatsLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Helper: Calculate Averages
  const calculateRowAverage = (row: any, type: 'pressure' | 'flow') => {
    const pressureCols = ['p_main', 'p_dma1', 'p_dma2', 'p_dma3'];
    const flowCols = ['f_main', 'f_1', 'f_2', 'f_3'];
    const targetCols = type === 'pressure' ? pressureCols : flowCols;
    
    let sum = 0;
    let count = 0;

    targetCols.forEach(col => {
        const val = Number(row[col]);
        if (!isNaN(val) && row[col] !== null && row[col] !== undefined) {
            sum += val;
            count++;
        }
    });

    if (count === 0) {
        if (type === 'pressure' && row.pressure) return Number(row.pressure);
        if (type === 'flow' && row.flowRate) return Number(row.flowRate);
        if (type === 'pressure' && row.p_main) return Number(row.p_main);
        if (type === 'flow' && row.f_main) return Number(row.f_main);
    }

    return count > 0 ? sum / count : 0;
  };

  // 1. Load Initial Stats
  const loadStats = useCallback(async () => {
    try {
      const [alertsData, historyData, sensorsData, householdsData] = await Promise.all([
        fetchActiveAlerts(),
        fetchHistoryData(),
        fetchSensors(),
        fetchHouseholds(),
      ]);

      const criticalCount = alertsData.filter((a) => a.severity === Severity.Critical).length;
      const highCount = alertsData.filter((a) => a.severity === Severity.High).length;
      const mediumCount = alertsData.filter((a) => a.severity === Severity.Medium).length;
      const score = 100 - criticalCount * 15 - highCount * 5 - mediumCount * 2;
      setHealthScore(Math.max(0, score));

      let totalSystemPressure = 0;
      let totalSystemFlow = 0;
      const dataCount = historyData.length;
      
      let finalAvgPressure = '0';
      let finalAvgFlow = '0';

      if (dataCount > 0) {
          historyData.forEach((row: any) => {
              totalSystemPressure += calculateRowAverage(row, 'pressure');
              totalSystemFlow += calculateRowAverage(row, 'flow');
          });

          finalAvgPressure = (totalSystemPressure / dataCount).toFixed(1);
          finalAvgFlow = (totalSystemFlow / dataCount).toFixed(0);
      }

      setStats(prev => ({
        ...prev,
        alerts: { value: alertsData.length.toString() },
        pressure: { value: `${finalAvgPressure} PSI`, trend: prev.pressure.trend },
        flowRate: { value: `${finalAvgFlow} L/min`, trend: prev.flowRate.trend },
        sensors: { value: sensorsData.length.toString() },
        households: { value: householdsData.length.toString() },
      }));
    } catch (error: any) {
      if (error.response?.status === 401) {
        onLogout(); 
        return;
      }
      console.error('Failed to load dashboard stats:', error);
      setDashboardError('errors.loadDashboard');
    }
  }, [onLogout]);

  // 2. Real-time Listener
  useEffect(() => {
    if (!window.Echo) return;

    const sensorChannel = window.Echo.channel('sensors');
    sensorChannel.listen('.sensor.updated', (event: any) => {
      if (event) {
        const payload = event.data || event;
        const currentAvgPressure = calculateRowAverage(payload, 'pressure');
        const currentAvgFlow = calculateRowAverage(payload, 'flow');

        setStats((prev) => ({
          ...prev,
          pressure: { ...prev.pressure, value: `${currentAvgPressure.toFixed(1)} PSI` },
          flowRate: { ...prev.flowRate, value: `${currentAvgFlow.toFixed(0)} L/min` },
        }));
      }
    });

    const alertChannel = window.Echo.channel('alerts-channel');
    alertChannel.listen('.leak.detected', (event: any) => {
        loadStats(); 
    });

    return () => {
      window.Echo.leave('sensors');
      window.Echo.leave('alerts-channel');
    };
  }, [loadStats]);

  
  // 3. View Management
  useEffect(() => {
    const refreshOverview = async () => {
      setStatsLoading(true);
      setDashboardError(null);
      await loadStats();
      setStatsLoading(false);
    };
    if (activeView === 'overview') refreshOverview();
  }, [activeView, loadStats]);


  const handleSetActiveView = useCallback((view: string) => {
    addLog('Navigate View', `Navigated to ${view} page.`);
    setActiveView(view);
    setIsSidebarOpen(false);
  }, []);

  const handleRetry = () => {
    setDashboardError(null);
    setStatsLoading(true);
    loadStats().finally(() => setStatsLoading(false));
  };

  const renderActiveView = () => {
    if (dashboardError && activeView === 'overview')
      return <FullScreenError messageKey={dashboardError} onRetry={handleRetry} />;

    switch (activeView) {
      case 'pipeline': return <PipelineMap user={user} />;
      case 'sensors': return <SensorManagement user={user} onDataChange={loadStats} />;
      case 'households': return <HouseholdManagement user={user} onDataChange={loadStats} />;
      case 'pumps': return <PumpManagement user={user} onDataChange={loadStats} />;
      case 'users': return <UserManagement user={user} />;
      case 'ml': return <MLTraining user={user} />;
      case 'logs': return <LogViewer />;
      case 'forum': return <Forum user={user} />;
      case 'reports':
        return (
          <div className="p-6 bg-brand-surface rounded-lg shadow-md border border-brand-border">
            <h2 className="text-2xl font-bold text-brand-text mb-4">{t('sidebar.reports')}</h2>
            <p className="mb-4 text-brand-muted">Generate a full PDF report of all detected leaks and system anomalies.</p>
            <a 
                href={`${import.meta.env.VITE_BACKEND_URL}/api/reports/download`} 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-brand-primary text-brand-primary-text px-4 py-2 rounded hover:bg-brand-primary-hover font-bold flex items-center gap-2 w-fit transition-colors"
            >
                📄 Download PDF Report
            </a>
          </div>
        );
      default:
        return (
          <div className="space-y-6">
            {/* STATUS ROW 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 bg-brand-surface p-6 rounded-lg shadow border border-brand-border flex flex-col justify-center">
                <SystemHealthScore score={statsLoading ? 0 : healthScore} />
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <StatCard
                  title={t('statCard.avgPressure')}
                  value={statsLoading ? '...' : stats.pressure.value}
                  icon={<BarChartIcon className="w-8 h-8 text-brand-primary" />}
                  trend={stats.pressure.trend}
                />
                <StatCard
                  title={t('statCard.avgFlowRate')}
                  value={statsLoading ? '...' : stats.flowRate.value}
                  icon={<WaterDropIcon className="w-8 h-8 text-blue-500" />}
                  trend={stats.flowRate.trend}
                />
              </div>
            </div>

            {/* STATUS ROW 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <StatCard
                title={t('statCard.activeAlerts')}
                value={statsLoading ? '...' : stats.alerts.value}
                icon={<AlertTriangleIcon className="w-8 h-8 text-alert-critical" />}
              />
              <StatCard
                title={t('statCard.sensorsOnline')}
                value={statsLoading ? '...' : stats.sensors.value}
                icon={<SettingsIcon className="w-8 h-8 text-green-500" />}
              />
              <StatCard
                title={t('statCard.totalHouseholds')}
                value={statsLoading ? '...' : stats.households.value}
                icon={<HomeModernIcon className="w-8 h-8 text-yellow-500" />}
              />
            </div>

            {/* ALERTS & CHARTS */}
            <div className="mb-6">
              <AIStatusSummary />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-brand-surface rounded-lg shadow border border-brand-border overflow-hidden">
                 <AlertsTable user={user} onAlertChange={loadStats} />
              </div>
              <div className="bg-brand-surface rounded-lg shadow border border-brand-border p-4">
                 <HistoryChart />
              </div>
            </div>
          </div>
        );
    }
  };

  if (!user) {
    onLogout();
    return null;
  }

  return (
    // ✅ Main Wrapper uses bg-brand-bg for full page theme
    <div className="flex h-screen bg-brand-bg transition-colors duration-300">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar
        user={user}
        activeView={activeView}
        setActiveView={handleSetActiveView}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} onLogout={onLogout} onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-7xl mx-auto">
             {renderActiveView()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;