import React from 'react';
import { AlertTriangleIcon } from '@/components/icons/IconComponents';
import { useTranslation } from '@/i18n';

interface FullScreenErrorProps {
  titleKey?: string;
  messageKey: string;
  onRetry: () => void;
}

const FullScreenError: React.FC<FullScreenErrorProps> = ({
  titleKey = 'errors.loadDashboardTitle',
  messageKey,
  onRetry
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-brand-secondary p-6 h-full text-center">
        <div className="inline-block p-4 bg-red-100 rounded-full">
          <AlertTriangleIcon className="w-12 h-12 text-alert-critical" />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-brand-dark">{t(titleKey)}</h2>
        <p className="mt-2 text-gray-600 max-w-md">{t(messageKey)}</p>
        <button
          onClick={onRetry}
          className="mt-6 px-6 py-2 bg-brand-primary text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition duration-300"
        >
          {t('errors.retryButton')}
        </button>
    </div>
  );
};

export default FullScreenError;
