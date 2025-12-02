import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Household, User, Pipeline, Sensor, WaterPump } from '@/types';
import { fetchHouseholds, addHousehold, updateHousehold, removeHousehold, addLog, fetchPipelines, fetchSensors, fetchPumps } from '@/services/apiService';
import { PlusIcon, TrashIcon, PencilIcon, CheckIcon } from '@/components/icons/IconComponents';
import { useTranslation } from '@/i18n';
import ErrorDisplay from '@/components/ErrorDisplay';

interface HouseholdManagementProps {
    user: User;
    onDataChange: () => void;
}

const HouseholdManagement: React.FC<HouseholdManagementProps> = ({ user, onDataChange }) => {
    const [households, setHouseholds] = useState<Household[]>([]);
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [pumps, setPumps] = useState<WaterPump[]>([]);
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [loading, setLoading] = useState(true);
    const [newAddress, setNewAddress] = useState('');
    const [editingHousehold, setEditingHousehold] = useState<Household | null>(null);
    const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const { t } = useTranslation();

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [householdData, sensorData, pumpData, pipelineData] = await Promise.all([
                fetchHouseholds(),
                fetchSensors(),
                fetchPumps(),
                fetchPipelines()
            ]);
            setHouseholds(householdData);
            setSensors(sensorData);
            setPumps(pumpData);
            setPipelines(pipelineData);
        } catch (e) {
            setError(t('errors.loadData'));
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadData();
    }, [loadData]);
    
    const allNodes = useMemo(() => {
        const s = sensors.map(i => ({ id: i.id, name: `${i.id} (Sensor)`, type: 'sensor' }));
        const p = pumps.map(i => ({ id: i.id, name: `${i.id} (Pump)`, type: 'pump' }));
        // ✅ ADDED: Households can now connect to other Households
        const h = households.map(i => ({ id: i.id, name: `${i.id} (Household)`, type: 'household' }));
        
        // Combine ALL types, but exclude self (can't connect H01 to H01)
        return [...s, ...p, ...h].filter(node => node.id !== editingHousehold?.id);
    }, [sensors, pumps, households, editingHousehold]);

    const handleConnectionToggle = (nodeId: string) => {
        setSelectedConnections(prev =>
            prev.includes(nodeId)
                ? prev.filter(id => id !== nodeId)
                : [...prev, nodeId]
        );
    };

    const handleEditClick = (household: Household) => {
        setEditingHousehold(household);
        setNewAddress(household.address);
        const currentConnections = pipelines
            .filter(p => p.from === household.id || p.to === household.id)
            .map(p => p.from === household.id ? p.to : p.from);
        setSelectedConnections(currentConnections);
        setError(null);
    };

    const handleCancelEdit = () => {
        setEditingHousehold(null);
        setNewAddress('');
        setSelectedConnections([]);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAddress) return;
        setError(null);

        try {
            if (editingHousehold) {
                // ✅ Update: Send connections to backend logic
                await updateHousehold(editingHousehold.id, newAddress, selectedConnections);
                addLog('Update Household', `Updated household ID: ${editingHousehold.id}`);
            } else {
                // ✅ Create: Send connections to backend logic (No manual pipeline loop needed)
                const newHousehold = await addHousehold(newAddress, selectedConnections);
                addLog('Add Household', `Added new household ID: ${newHousehold.id}`);
            }
            
            handleCancelEdit();
            await loadData();
            onDataChange();
        } catch (e) {
            setError(t('errors.saveData'));
            console.error(e);
        }
    };
    
    const handleRemove = async (id: string) => {
        if (window.confirm(t('householdManagement.deleteConfirm'))) {
            setError(null);
            try {
                const householdToRemove = households.find(h => h.id === id);
                await removeHousehold(id);
                if (householdToRemove) {
                    addLog('Remove Household', `Removed household ID: ${id}`);
                }
                loadData();
                onDataChange();
            } catch (e) {
                setError(t('errors.actionFailed'));
                console.error(e);
            }
        }
    };

    const isFormInvalid = !newAddress;

    return (
        <div className="bg-brand-light p-6 rounded-xl shadow-md">
            <h2 className="text-2xl font-bold text-brand-dark mb-6">{t('householdManagement.title')}</h2>

            {error && <ErrorDisplay message={error} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-lg font-semibold text-brand-dark mb-4">{t('householdManagement.existingHouseholds')}</h3>
                    {loading ? <p>{t('householdManagement.loading')}</p> : (
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                            {households.map(item => {
                                const connections = pipelines
                                    .filter(p => p.from === item.id || p.to === item.id)
                                    .map(p => (p.from === item.id ? p.to : p.from));

                                return (
                                <li key={item.id} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg border">
                                    <div className="flex-1">
                                        <p className="font-bold text-brand-dark">{item.id}</p>
                                        <p className="text-sm text-gray-600">{item.address}</p>
                                        <div className="mt-2">
                                            <p className="text-xs font-semibold text-gray-500">{t('householdManagement.connectedTo')}:</p>
                                            {connections.length > 0 ? (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {connections.map(connId => (
                                                        <span key={connId} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full font-mono">{connId}</span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-500 italic">{t('householdManagement.noConnections')}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pl-2">
                                        <button onClick={() => handleEditClick(item)} className="p-2 text-blue-500 hover:bg-blue-100 rounded-full transition-colors">
                                            <PencilIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleRemove(item.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full transition-colors">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </li>
                            )})}
                        </div>
                    )}
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-brand-dark mb-4">
                        {editingHousehold ? t('householdManagement.editHouseholdTitle') : t('householdManagement.addHouseholdTitle')}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-gray-50">
                        <div>
                            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                                {t('householdManagement.addressLabel')} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="address"
                                value={newAddress}
                                onChange={(e) => setNewAddress(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                                placeholder={t('householdManagement.addressPlaceholder')}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('managementShared.connectToLabel')}</label>
                             <p className="text-xs text-gray-500 mb-1">{t('managementShared.connectToDescription')}</p>
                            <div className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm h-32 overflow-y-auto bg-white p-2 space-y-2">
                                {allNodes.length > 0 ? allNodes.map(node => {
                                    const isSelected = selectedConnections.includes(node.id);
                                    return (
                                        <button
                                            type="button"
                                            key={node.id}
                                            onClick={() => handleConnectionToggle(node.id)}
                                            className={`w-full flex justify-between items-center text-left px-3 py-2 border rounded-md transition-colors text-sm ${
                                                isSelected 
                                                    ? 'bg-blue-100 border-blue-500 text-blue-900 font-semibold' 
                                                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                            <span>{node.name}</span>
                                            {isSelected && <CheckIcon className="w-5 h-5 text-blue-600" />}
                                        </button>
                                    )
                                }) : <p className="text-sm text-gray-500 text-center pt-10">No other nodes to connect to.</p>}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                type="submit"
                                disabled={isFormInvalid}
                                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-brand-primary text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition duration-300 disabled:bg-blue-300 disabled:cursor-not-allowed"
                            >
                                {editingHousehold ? t('householdManagement.saveButton') : <><PlusIcon className="w-5 h-5" /> {t('householdManagement.addButton')}</>}
                            </button>
                            {editingHousehold && (
                                <button type="button" onClick={handleCancelEdit} className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors">
                                    {t('householdManagement.cancelButton')}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default HouseholdManagement;