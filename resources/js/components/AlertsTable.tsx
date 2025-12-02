import React, { useState, useEffect, useCallback } from 'react';
// ✅ Import Alert as BaseAlert so we can extend it locally
import { Alert as BaseAlert, Severity, User, Role, Pipeline } from '@/types';
import {
  fetchActiveAlerts,
  resolveAlert,
  addLog,
  fetchPipelines,
  markAlertAsFalse,
} from '@/services/apiService';
import AnalysisModal from '@/components/AnalysisModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import ErrorDisplay from '@/components/ErrorDisplay';
import {
  CheckCircleIcon,
  SparklesIcon,
  XCircleIcon,
} from '@/components/icons/IconComponents';
import { useTranslation } from '@/i18n';

declare global {
    interface Window { Echo: any; }
}

interface Alert extends BaseAlert {
    accuracy?: number;
}

interface AlertsTableProps {
  user: User;
  onAlertChange?: () => void; 
}

const severityStyles: Record<Severity, string> = {
  [Severity.Critical]: 'bg-red-100 text-red-800 border-red-500',
  [Severity.High]: 'bg-yellow-100 text-yellow-800 border-yellow-500',
  [Severity.Medium]: 'bg-blue-100 text-blue-800 border-blue-500',
};

const AlertsTable: React.FC<AlertsTableProps> = ({ user, onAlertChange }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  // ✅ NEW: Track IDs that are currently animating out
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<{
    onConfirm: () => void;
    title: string;
    message: string;
  } | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [activeAlerts, pipelineData] = await Promise.all([
        fetchActiveAlerts(),
        fetchPipelines(),
      ]);
      setAlerts(activeAlerts as Alert[]);
      setPipelines(pipelineData);
    } catch (e) {
      setError(t('errors.loadData'));
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAlerts();

    if (!window.Echo) return;

    const channel = window.Echo.channel('alerts-channel');

    channel.listen('.leak.detected', (event: any) => {
      console.log("🚨 TABLE: New Alert Received", event);
      
      if (event.alert) {
        setAlerts((prevAlerts) => {
            if (prevAlerts.some(a => a.id === event.alert.id)) return prevAlerts;
            return [event.alert, ...prevAlerts];
        });
        if (onAlertChange) onAlertChange(); 
      }
    });

    return () => {
      window.Echo.leave('alerts-channel');
    };
  }, [loadAlerts, onAlertChange]);

  // ✅ HELPER: Handle the exit animation
  const animateAndRemove = (alertId: string, action: () => Promise<void>) => {
      // 1. Trigger Animation
      setRemovingIds(prev => new Set(prev).add(alertId));

      // 2. Perform Action & Remove from State after delay
      setTimeout(async () => {
          try {
              await action();
              // Actually remove from list
              setAlerts(prev => prev.filter(a => a.id !== alertId));
              if (onAlertChange) onAlertChange();
          } catch (e) {
              setError(t('errors.actionFailed'));
              // If failed, bring it back
              setRemovingIds(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(alertId);
                  return newSet;
              });
          }
      }, 500); // Match duration-500 in CSS
  };

  const handleResolveClick = (alertId: string) => {
    setActionToConfirm({
      title: t('alertsTable.resolveConfirmTitle'),
      message: t('alertsTable.resolveConfirmMessage'),
      onConfirm: async () => {
          setIsConfirmModalOpen(false);
          animateAndRemove(alertId, async () => {
              await resolveAlert(alertId);
              addLog('Resolve Alert', `Resolved alert ID: ${alertId}`);
          });
      },
    });
    setIsConfirmModalOpen(true);
  };

  const handleFalseAlertClick = (alertId: string) => {
    setActionToConfirm({
      title: t('alertsTable.falseAlertConfirmTitle'),
      message: t('alertsTable.falseAlertConfirmMessage'),
      onConfirm: async () => {
          setIsConfirmModalOpen(false);
          animateAndRemove(alertId, async () => {
              await markAlertAsFalse(alertId);
              addLog('Mark False Alert', `Marked alert ID: ${alertId} as false positive.`);
          });
      },
    });
    setIsConfirmModalOpen(true);
  };

  const handleAnalyze = (alert: Alert) => {
    addLog('Analyze Alert', `Initiated AI analysis for alert ID: ${alert.id}`);
    setSelectedAlert(alert);
    setIsAnalysisModalOpen(true);
  };

  const timeSince = (date: string) => {
    const seconds = Math.floor(
      (new Date().getTime() - new Date(date).getTime()) / 1000
    );
    let interval = seconds / 31536000;
    if (interval > 1) return t('alertsTable.timeAgo.year', { count: Math.floor(interval) });
    interval = seconds / 2592000;
    if (interval > 1) return t('alertsTable.timeAgo.month', { count: Math.floor(interval) });
    interval = seconds / 86400;
    if (interval > 1) return t('alertsTable.timeAgo.day', { count: Math.floor(interval) });
    interval = seconds / 3600;
    if (interval > 1) return t('alertsTable.timeAgo.hour', { count: Math.floor(interval) });
    interval = seconds / 60;
    if (interval > 1) return t('alertsTable.timeAgo.minute', { count: Math.floor(interval) });
    return t('alertsTable.timeAgo.second');
  };

  const getPipelineInfo = (pipelineId: string) => {
    const pipeline = pipelines.find((p) => p.id === pipelineId);
    return pipeline ? `${pipeline.from} → ${pipeline.to}` : pipelineId;
  };

  return (
    <div className="bg-brand-light p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-bold text-brand-dark mb-4">
        {t('alertsTable.title')}
      </h2>
      {error && <ErrorDisplay message={error} />}
      {loading ? (
        <div className="text-center py-8">{t('alertsTable.loading')}</div>
      ) : (
        // 🔥 SCROLLABLE CONTAINER with hidden scrollbar logic
        <div className="space-y-4 max-h-[450px] overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar relative">
          {alerts.length === 0 ? (
            <p className="text-gray-500">{t('alertsTable.noAlerts')}</p>
          ) : (
            alerts.map((alert) => {
                const isRemoving = removingIds.has(alert.id);
                return (
                  <div
                    key={alert.id}
                    // ✅ ANIMATION CLASSES
                    className={`
                        p-4 rounded-lg border-l-4 ${severityStyles[alert.severity]} 
                        transform transition-all duration-500 ease-in-out
                        ${isRemoving ? 'translate-x-full opacity-0 h-0 py-0 overflow-hidden' : 'translate-x-0 opacity-100 h-auto'}
                    `}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold">{alert.message}</p>
                        <p className="text-sm">
                          {t('alertsTable.sensorLabel')}: {alert.sensorId} •{' '}
                          {timeSince(alert.createdAt)}
                        </p>
                        
                        {/* AI Confidence */}
                        {alert.accuracy !== undefined && alert.accuracy !== null && (
                            <p className="text-xs font-bold text-blue-700 mt-1 flex items-center gap-1">
                                 🎯 AI Confidence: {alert.accuracy}%
                            </p>
                        )}

                        {alert.pipelineId && (
                          <p className="text-sm font-semibold mt-1 text-red-700">
                            {t('alertsTable.affectedPipeline')}:{' '}
                            {getPipelineInfo(alert.pipelineId)}
                          </p>
                        )}
                      </div>
                      <span className="font-semibold text-sm px-2 py-1 rounded-full">
                        {alert.severity}
                      </span>
                    </div>

                    {user.role === Role.Admin && (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => handleAnalyze(alert)}
                          className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 font-semibold py-1 px-2 rounded-md bg-purple-100 hover:bg-purple-200 transition-colors"
                        >
                          <SparklesIcon className="w-4 h-4" />
                          {t('alertsTable.analyzeButton')}
                        </button>

                        <button
                          onClick={() => handleFalseAlertClick(alert.id)}
                          className="flex items-center gap-1 text-sm text-yellow-600 hover:text-yellow-800 font-semibold py-1 px-2 rounded-md bg-yellow-100 hover:bg-yellow-200 transition-colors"
                        >
                          <XCircleIcon className="w-4 h-4" />
                          {t('alertsTable.falseAlertButton')}
                        </button>

                        <button
                          onClick={() => handleResolveClick(alert.id)}
                          className="flex items-center gap-1 text-sm text-green-600 hover:text-green-800 font-semibold py-1 px-2 rounded-md bg-green-100 hover:bg-green-200 transition-colors"
                        >
                          <CheckCircleIcon className="w-4 h-4" />
                          {t('alertsTable.resolveButton')}
                        </button>
                      </div>
                    )}
                  </div>
                );
            })
          )}
        </div>
      )}

      {selectedAlert && (
        <AnalysisModal
          isOpen={isAnalysisModalOpen}
          onClose={() => setIsAnalysisModalOpen(false)}
          alert={selectedAlert}
        />
      )}

      {actionToConfirm && (
        <ConfirmationModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={actionToConfirm.onConfirm}
          title={actionToConfirm.title}
          message={actionToConfirm.message}
        />
      )}
    </div>
  );
};

export default AlertsTable;