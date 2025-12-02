import React, { useState, useEffect } from 'react';
import { Alert, AiAnalysis } from '@/types';
import { getAlertAnalysis } from '@/services/apiService';
import { LightBulbIcon, ExclamationIcon, CheckCircleIcon, SparklesIcon } from '@/components/icons/IconComponents';
import { useTranslation } from '@/i18n';
import ErrorDisplay from '@/components/ErrorDisplay';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: Alert;
}

const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, alert }) => {
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      const performAnalysis = async () => {
          setLoading(true);
          setError(null);
          setAnalysis(null);
          try {
              const result = await getAlertAnalysis(alert);
              setAnalysis(result);
          } catch (e) {
              setError(t('errors.actionFailed'));
              console.error(e);
          } finally {
              setLoading(false);
          }
      };
      performAnalysis();
    }
  }, [isOpen, alert, t]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-brand-light rounded-xl shadow-2xl w-full max-w-2xl transform transition-all" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <SparklesIcon className="w-6 h-6 text-purple-600"/>
            <h2 className="text-xl font-bold text-brand-dark">{t('analysisModal.title')}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="font-semibold text-brand-dark">{t('analysisModal.alertDetails')}</h3>
            <p className="text-gray-600"><span className="font-medium">{t('analysisModal.messageLabel')}:</span> {alert.message}</p>
            <p className="text-gray-600"><span className="font-medium">{t('analysisModal.severityLabel')}:</span> {alert.severity}</p>
            <p className="text-gray-600"><span className="font-medium">{t('analysisModal.sensorLabel')}:</span> {alert.sensorId}</p>
          </div>

          {error && <ErrorDisplay message={error} />}

          {loading && (
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
              <p className="mt-4 text-gray-600">{t('analysisModal.loading')}</p>
            </div>
          )}

          {analysis && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-brand-dark flex items-center gap-2 mb-2"><LightBulbIcon className="w-5 h-5 text-yellow-500"/> {t('analysisModal.summaryTitle')}</h3>
                <p className="text-gray-700 bg-yellow-50 p-3 rounded-md">{analysis.summary}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-brand-dark flex items-center gap-2 mb-2"><ExclamationIcon className="w-5 h-5 text-red-500"/> {t('analysisModal.causesTitle')}</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 pl-2">
                  {analysis.potentialCauses.map((cause, index) => <li key={index}>{cause}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-brand-dark flex items-center gap-2 mb-2"><CheckCircleIcon className="w-5 h-5 text-green-500"/> {t('analysisModal.actionsTitle')}</h3>
                 <ul className="list-decimal list-inside space-y-2 text-gray-700 pl-2">
                  {analysis.suggestedActions.map((action, index) => <li key={index} className="bg-green-50 p-2 rounded-md">{action}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 text-right">
          <button onClick={onClose} className="px-4 py-2 bg-brand-primary text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            {t('analysisModal.closeButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;
