import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert as BaseAlert, Severity, User, Role, Pipeline } from '@/types';
import {
  fetchActiveAlerts,
  resolveAlert,
  resolveAlertGroup,
  markAlertGroupAsFalse,
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
  ChevronDownIcon,
  ChevronUpIcon
} from '@/components/icons/IconComponents';
import { useTranslation } from '@/i18n';

declare global {
    interface Window { Echo: any; }
}

interface Alert extends BaseAlert {
    accuracy?: number | string;
}

interface AlertsTableProps {
  user: User;
  onAlertChange?: () => void; 
}

const severityStyles: Record<Severity, string> = {
  [Severity.Critical]: 'bg-red-50 border-red-500 dark:bg-red-900/20 dark:border-red-500',
  [Severity.High]: 'bg-yellow-50 border-yellow-500 dark:bg-yellow-900/20 dark:border-yellow-500',
  [Severity.Medium]: 'bg-blue-50 border-blue-500 dark:bg-blue-900/20 dark:border-blue-500',
};

const AlertsTable: React.FC<AlertsTableProps> = ({ user, onAlertChange }) => {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States for Modals
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  
  // Resolve Logic
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [idsToResolve, setIdsToResolve] = useState<string[]>([]); // Array for bulk
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');

  // Confirmation Logic (False Alerts)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<{
    onConfirm: () => void;
    title: string;
    message: string;
  } | null>(null);

  // Group Expansion State
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // ✅ NEW: Track IDs that are currently animating out
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

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
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAlerts();
    if (!window.Echo) return;
    const channel = window.Echo.channel('alerts-channel');
    channel.listen('.leak.detected', (event: any) => {
      if (event.alert) {
        setAlerts((prev) => {
            if (prev.some(a => a.id === event.alert.id)) return prev;
            return [event.alert, ...prev];
        });
        if (onAlertChange) onAlertChange(); 
      }
    });
    return () => { window.Echo.leave('alerts-channel'); };
  }, [loadAlerts, onAlertChange]);

  // ✅ HELPER: Handle the exit animation
  const animateAndRemove = (alertId: string, action: () => Promise<void>) => {
      setRemovingIds(prev => new Set(prev).add(alertId));
      setTimeout(async () => {
          try {
              await action();
              setAlerts(prev => prev.filter(a => a.id !== alertId));
              if (onAlertChange) onAlertChange();
          } catch (e) {
              setError(t('errors.actionFailed'));
              setRemovingIds(prev => { const newSet = new Set(prev); newSet.delete(alertId); return newSet; });
          }
      }, 500); 
  };

  // ✅ GROUPING LOGIC
  const groupedAlerts = useMemo(() => {
      const groups: { [key: string]: Alert[] } = {};
      
      alerts.forEach(alert => {
          const key = `${alert.sensorId}-${alert.pipelineId || 'unknown'}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(alert);
      });

      return Object.entries(groups).sort((a, b) => {
          const dateA = new Date(a[1][0].createdAt).getTime();
          const dateB = new Date(b[1][0].createdAt).getTime();
          return dateB - dateA; // Newest first
      });
  }, [alerts]);

  const toggleGroup = (groupKey: string) => {
      setExpandedGroups(prev => {
          const next = new Set(prev);
          if (next.has(groupKey)) next.delete(groupKey);
          else next.add(groupKey);
          return next;
      });
  };

  // ---------------------------------------------
  // 🟢 RESOLVE LOGIC (Real Leak)
  // ---------------------------------------------
  const handleResolveAction = (items: Alert[]) => {
      const ids = items.map(a => a.id);
      setIdsToResolve(ids);
      setSelectedPipelineId(items[0].pipelineId || '');
      setIsResolveModalOpen(true);
  };

  const confirmResolve = async () => {
      setIsResolveModalOpen(false);
      try {
          if (idsToResolve.length === 1) {
              await resolveAlert(idsToResolve[0], selectedPipelineId);
          } else {
              await resolveAlertGroup(idsToResolve, selectedPipelineId);
          }
          
          addLog('Resolve', `Resolved ${idsToResolve.length} alerts on ${selectedPipelineId}`);
          
          setAlerts(prev => prev.filter(a => !idsToResolve.includes(a.id)));
          if (onAlertChange) onAlertChange();
      } catch (e) {
          setError(t('errors.actionFailed'));
      }
  };

  // ---------------------------------------------
  // 🟡 FALSE ALERT LOGIC (Safe)
  // ---------------------------------------------
  const handleFalseAction = (items: Alert[]) => {
      const ids = items.map(a => a.id);
      
      setActionToConfirm({
          title: items.length > 1 ? "Mark Group as False Alert?" : "Mark as False Alert?",
          message: `This will mark ${items.length} alert(s) as False Positives. The AI will learn that this sensor pattern is SAFE.`,
          onConfirm: async () => {
              setIsConfirmModalOpen(false);
              try {
                  if (items.length === 1) {
                      await markAlertAsFalse(ids[0]);
                  } else {
                      await markAlertGroupAsFalse(ids);
                  }

                  addLog('Mark False', `Marked ${ids.length} alerts as false positive.`);
                  
                  setAlerts(prev => prev.filter(a => !ids.includes(a.id)));
                  if (onAlertChange) onAlertChange();
              } catch (e) {
                  setError(t('errors.actionFailed'));
              }
          }
      });
      setIsConfirmModalOpen(true);
  };

  const timeSince = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getPipelineInfo = (pipelineId: string) => {
    const pipeline = pipelines.find((p) => p.id === pipelineId);
    return pipeline ? `${pipeline.from} → ${pipeline.to}` : pipelineId;
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md transition-colors duration-200">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        {t('alertsTable.title')}
      </h2>
      {error && <ErrorDisplay message={error} />}
      
      {loading ? (
        <div className="text-center py-8 text-gray-500">{t('alertsTable.loading')}</div>
      ) : (
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar relative">
          {groupedAlerts.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">{t('alertsTable.noAlerts')}</p>
          ) : (
            groupedAlerts.map(([groupKey, group]) => {
                const head = group[0];
                const count = group.length;
                const isExpanded = expandedGroups.has(groupKey);
                // Check if ANY alert in this group is currently animating out
                const isGroupRemoving = group.every(a => removingIds.has(a.id));
                
                return (
                  <div key={groupKey} className={`rounded-lg border-l-4 ${severityStyles[head.severity]} bg-white dark:bg-gray-700 shadow-sm mb-3 transition-all duration-500 ${isGroupRemoving ? 'opacity-0 translate-x-full' : 'opacity-100'}`}>
                    
                    {/* --- PARENT ROW --- */}
                    <div className="p-4 flex justify-between items-start cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors" onClick={() => toggleGroup(groupKey)}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-gray-900 dark:text-white text-lg">
                                {count > 1 ? `Multiple Leak Alerts (${count})` : head.message}
                            </span>
                            {count > 1 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">{count} Events</span>}
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {t('alertsTable.sensorLabel')}: <strong>{head.sensorId}</strong>
                          {head.pipelineId && <> • Pipe: <strong>{getPipelineInfo(head.pipelineId)}</strong></>}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Latest: {timeSince(head.createdAt)}</p>
                      </div>

                      {/* Right Side Actions */}
                      <div className="flex items-center gap-2">
                          {user.role === Role.Admin && (
                              <>
                                {/* ✅ BUTTON 1: BULK FALSE ALERT */}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleFalseAction(group); }}
                                    className="flex items-center gap-1 text-sm bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-md hover:bg-yellow-200 font-bold border border-yellow-200 transition-colors"
                                    title="Mark all as False Positive"
                                >
                                    <XCircleIcon className="w-4 h-4" /> 
                                    {count > 1 ? 'False All' : 'False'}
                                </button>

                                {/* ✅ BUTTON 2: BULK RESOLVE */}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleResolveAction(group); }}
                                    className="flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-md hover:bg-green-200 font-bold border border-green-200 transition-colors"
                                    title="Resolve entire group"
                                >
                                    <CheckCircleIcon className="w-4 h-4" /> 
                                    {count > 1 ? 'Resolve All' : 'Resolve'}
                                </button>
                              </>
                          )}
                          
                          {/* Expand Icon */}
                          {count > 1 && (
                              <div className="text-gray-400 ml-2">
                                  {isExpanded ? <ChevronUpIcon className="w-5 h-5"/> : <ChevronDownIcon className="w-5 h-5"/>}
                              </div>
                          )}
                      </div>
                    </div>

                    {/* --- CHILDREN ROWS (Expanded) --- */}
                    {isExpanded && count > 1 && (
                        <div className="border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-2 pl-6 space-y-2">
                            {group.map((child) => (
                                <div key={child.id} className="flex justify-between items-center text-sm p-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-300">{timeSince(child.createdAt)}</span>
                                        <span className="mx-2 text-gray-300">|</span>
                                        <span className="font-medium">Confidence: {child.accuracy || 'N/A'}%</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => { setSelectedAlert(child); setIsAnalysisModalOpen(true); }}
                                            className="text-purple-600 hover:underline text-xs flex items-center gap-1"
                                        >
                                            <SparklesIcon className="w-3 h-3"/> Analyze
                                        </button>
                                        
                                        {/* Individual Buttons for Child Row */}
                                        <button onClick={() => handleResolveAction([child])} className="text-green-600 hover:underline text-xs font-bold">Resolve</button>
                                        <button onClick={() => handleFalseAction([child])} className="text-yellow-600 hover:underline text-xs font-bold">False</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                  </div>
                );
            })
          )}
        </div>
      )}

      {selectedAlert && <AnalysisModal isOpen={isAnalysisModalOpen} onClose={() => setIsAnalysisModalOpen(false)} alert={selectedAlert} />}

      {actionToConfirm && (
        <ConfirmationModal 
            isOpen={isConfirmModalOpen} 
            onClose={() => setIsConfirmModalOpen(false)} 
            onConfirm={actionToConfirm.onConfirm} 
            title={actionToConfirm.title} 
            message={actionToConfirm.message} 
        />
      )}

      {/* ✅ RESOLVE MODAL */}
      {isResolveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md animate-fade-in-up">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                      Resolve {idsToResolve.length > 1 ? `${idsToResolve.length} Alerts` : 'Alert'}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Confirming this leak will validate <strong>{idsToResolve.length}</strong> alert(s) and update the AI model logic for this location.
                  </p>
                  
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">Confirm Pipeline Location</label>
                  <select 
                      value={selectedPipelineId} 
                      onChange={(e) => setSelectedPipelineId(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded mb-6 focus:ring-2 focus:ring-green-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                  >
                      <option value="">Select Pipeline...</option>
                      {pipelines.map(p => (
                          <option key={p.id} value={p.id}>{p.id} ({p.from} → {p.to})</option>
                      ))}
                  </select>

                  <div className="flex justify-end gap-3">
                      <button onClick={() => setIsResolveModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
                      <button onClick={confirmResolve} disabled={!selectedPipelineId} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold shadow-md disabled:opacity-50">Confirm & Resolve</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AlertsTable;