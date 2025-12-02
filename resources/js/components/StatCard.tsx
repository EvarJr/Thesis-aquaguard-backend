

import React from 'react';
import { useTranslation } from '@/i18n';
import { ChevronUpIcon, ChevronDownIcon } from '@/components/icons/IconComponents';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  }
}

const trendStyles: { [key in 'up' | 'down' | 'neutral']: { icon: React.ReactNode; color: string } } = {
    up: {
        icon: <ChevronUpIcon className="w-4 h-4" />,
        color: 'text-green-600',
    },
    down: {
        icon: <ChevronDownIcon className="w-4 h-4" />,
        color: 'text-red-600',
    },
    neutral: {
        icon: <span className="font-bold text-lg leading-4">-</span>,
        color: 'text-gray-500',
    }
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend }) => {
  const { t } = useTranslation();
  
  return (
    <div className="bg-brand-light p-5 rounded-xl shadow-md flex items-center justify-between transition-transform transform hover:-translate-y-1 h-full">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-brand-dark">{value}</p>
        {trend && (
            <div className={`flex items-center gap-1 text-sm font-semibold mt-1 ${trendStyles[trend.direction].color}`}>
                {trendStyles[trend.direction].icon}
                <span>{trend.value}</span>
                <span className="text-xs text-gray-400 font-normal ml-1">{t('statCard.trendPeriod')}</span>
            </div>
        )}
      </div>
      <div className="p-3 bg-gray-100 rounded-full self-start">
        {icon}
      </div>
    </div>
  );
};

export default StatCard;
