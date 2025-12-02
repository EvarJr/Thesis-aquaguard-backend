import React from 'react';
import { useTranslation } from '@/i18n';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose} aria-modal="true" role="dialog">
      <div className="bg-brand-light rounded-lg shadow-xl w-full max-w-md transform transition-all" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-lg font-bold text-brand-dark">{title}</h3>
          <p className="mt-2 text-sm text-gray-600">{message}</p>
        </div>
        <div className="bg-gray-50 px-6 py-3 flex justify-end gap-3 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
            aria-label={t('alertsTable.cancelButton')}
          >
            {t('alertsTable.cancelButton')}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-brand-primary text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            aria-label={t('alertsTable.confirmButton')}
          >
            {t('alertsTable.confirmButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
