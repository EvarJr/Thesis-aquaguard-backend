import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LogEntry, Role } from '@/types';
import { fetchLogs } from '@/services/apiService';
import { useTranslation } from '@/i18n';
import ErrorDisplay from '@/components/ErrorDisplay';
import { ChevronDownIcon } from '@/components/icons/IconComponents';

const LogViewer: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [openUserIds, setOpenUserIds] = useState<Set<string>>(new Set());
    const { t } = useTranslation();

    const loadLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchLogs();
            setLogs(data);
        } catch (e) {
            setError(t('errors.loadData'));
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    const filteredGroupedLogs = useMemo(() => {
        type GroupedLogs = Record<string, { userName: string, userRole: Role, logs: LogEntry[] }>;
        
        const grouped = logs.reduce<GroupedLogs>((acc, log) => {
            if (!acc[log.userId]) {
                acc[log.userId] = { userName: log.userName, userRole: log.userRole, logs: [] };
            }
            acc[log.userId].logs.push(log);
            return acc;
        }, {});

        if (!searchTerm) return grouped;
        
        const lowercasedFilter = searchTerm.toLowerCase();
        const result: GroupedLogs = {};

        for (const userId in grouped) {
            const userData = grouped[userId];
            const userLogs = userData.logs;

            const filteredLogs = userLogs.filter(log => 
                log.action.toLowerCase().includes(lowercasedFilter) ||
                log.details.toLowerCase().includes(lowercasedFilter)
            );

            if (userData.userName.toLowerCase().includes(lowercasedFilter) || filteredLogs.length > 0) {
                result[userId] = {
                    ...userData,
                    logs: userData.userName.toLowerCase().includes(lowercasedFilter) ? userLogs : filteredLogs
                };
            }
        }
        return result;
    }, [logs, searchTerm]);


    const roleColor: { [key in Role]: string } = {
        [Role.Admin]: 'text-red-700 bg-red-100',
        [Role.User]: 'text-gray-700 bg-gray-100',
    };

    const toggleUserAccordion = (userId: string) => {
        setOpenUserIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
    };

    return (
        <div className="bg-brand-light p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-brand-dark">{t('logViewer.title')}</h2>
                <input
                    type="text"
                    placeholder={t('logViewer.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-1/3 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                />
            </div>
            
            {error && <ErrorDisplay message={error} />}

            {loading ? (
                <div className="text-center py-8">{t('logViewer.loading')}</div>
            ) : Object.keys(filteredGroupedLogs).length === 0 ? (
                <div className="text-center py-8">{t('logViewer.noLogs')}</div>
            ) : (
                <div className="space-y-3">
                    {Object.entries(filteredGroupedLogs).map(([userId, { userName, userRole, logs: userLogs }]) => (
                        <div key={userId} className="border border-gray-200 rounded-lg overflow-hidden">
                            <button
                                onClick={() => toggleUserAccordion(userId)}
                                className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary"
                                aria-expanded={openUserIds.has(userId)}
                                aria-controls={`logs-for-${userId}`}
                            >
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-brand-dark">{userName}</span>
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleColor[userRole]}`}>{userRole}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-gray-500">{userLogs.length} {t(userLogs.length === 1 ? 'logViewer.logEntry' : 'logViewer.logEntries')}</span>
                                    <ChevronDownIcon className={`w-5 h-5 text-gray-500 transition-transform ${openUserIds.has(userId) ? 'rotate-180' : ''}`} />
                                </div>
                            </button>
                            {openUserIds.has(userId) && (
                                <div id={`logs-for-${userId}`} className="overflow-x-auto">
                                    <table className="min-w-full bg-white">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('logViewer.header.timestamp')}</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('logViewer.header.action')}</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('logViewer.header.details')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {userLogs.map(log => (
                                                <tr key={log.id}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(log.timestamp).toLocaleString()}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-brand-dark">{log.action}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{log.details}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LogViewer;
