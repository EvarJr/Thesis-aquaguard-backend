import React from 'react';
import { useTranslation } from '@/i18n';

interface SystemHealthScoreProps {
  score: number;
}

const SystemHealthScore: React.FC<SystemHealthScoreProps> = ({ score }) => {
    const { t } = useTranslation();
    const size = 180;
    const strokeWidth = 16;
    const center = size / 2;
    const radius = center - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    let scoreColor = 'stroke-green-500';
    let textColor = 'text-green-600';
    let statusTextKey = 'healthScore.operational';

    if (score < 90) {
        scoreColor = 'stroke-yellow-500';
        textColor = 'text-yellow-600';
        statusTextKey = 'healthScore.warning';
    }
    if (score < 70) {
        scoreColor = 'stroke-red-500';
        textColor = 'text-red-600';
        statusTextKey = 'healthScore.critical';
    }
    
    return (
        <div className="bg-brand-light p-5 rounded-xl shadow-md flex flex-col items-center justify-center h-full">
            <h3 className="text-lg font-semibold text-brand-dark mb-4">{t('healthScore.title')}</h3>
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="-rotate-90">
                    <circle
                        className="text-gray-200"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        r={radius}
                        cx={center}
                        cy={center}
                    />
                    <circle
                        className={`transition-all duration-1000 ease-in-out ${scoreColor}`}
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        fill="transparent"
                        r={radius}
                        cx={center}
                        cy={center}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-4xl font-bold ${textColor}`}>{Math.round(score)}%</span>
                    <span className="text-sm font-semibold text-gray-500">{t(statusTextKey)}</span>
                </div>
            </div>
        </div>
    );
};

export default SystemHealthScore;
