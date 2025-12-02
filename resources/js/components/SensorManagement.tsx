import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sensor, User, Pipeline, Household, WaterPump } from '@/types';
import { 
    fetchSensors, addSensor, removeSensor, updateSensor, addLog, 
    fetchPipelines, fetchHouseholds, fetchPumps, addPipeline, removePipeline 
} from '@/services/apiService';
import { PlusIcon, TrashIcon, PencilIcon, CheckIcon } from '@/components/icons/IconComponents';
import { useTranslation } from '@/i18n';
import ErrorDisplay from '@/components/ErrorDisplay';

interface SensorManagementProps {
    user: User;
    onDataChange: () => void;
}

const SensorManagement: React.FC<SensorManagementProps> = ({ user, onDataChange }) => {
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [households, setHouseholds] = useState<Household[]>([]);
    const [pumps, setPumps] = useState<WaterPump[]>([]);
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({ location: '', description: '' });
    const [editingSensor, setEditingSensor] = useState<Sensor | null>(null);
    const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const { t } = useTranslation();

    // 1. Load ALL data types (Sensors, Households, Pumps, Pipelines)
    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [sensorData, householdData, pumpData, pipelineData] = await Promise.all([
                fetchSensors(),
                fetchHouseholds(),
                fetchPumps(),
                fetchPipelines()
            ]);
            setSensors(sensorData);
            setHouseholds(householdData);
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
    
    // 2. Combine all nodes into one list for the "Connect To" dropdown
    const allNodes = useMemo(() => {
        const s = sensors.map(i => ({ id: i.id, name: `${i.id} (Sensor)`, type: 'sensor' }));
        const h = households.map(i => ({ id: i.id, name: `${i.id} (Household)`, type: 'household' }));
        const p = pumps.map(i => ({ id: i.id, name: `${i.id} (Pump)`, type: 'pump' }));
        
        // Filter out the sensor currently being edited (can't connect to itself)
        return [...s, ...h, ...p].filter(node => node.id !== editingSensor?.id);
    }, [sensors, households, pumps, editingSensor]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleConnectionToggle = (nodeId: string) => {
        setSelectedConnections(prev =>
            prev.includes(nodeId)
                ? prev.filter(id => id !== nodeId)
                : [...prev, nodeId]
        );
    };

    const handleEditClick = (sensor: Sensor) => {
        setEditingSensor(sensor);
        setFormData({ location: sensor.location, description: sensor.description });
        
        // Find existing connections for this sensor
        const currentConnections = pipelines
            .filter(p => p.from === sensor.id || p.to === sensor.id)
            .map(p => p.from === sensor.id ? p.to : p.from);
            
        setSelectedConnections(currentConnections);
        setError(null);
    };

    const handleCancelEdit = () => {
        setEditingSensor(null);
        setFormData({ location: '', description: '' });
        setSelectedConnections([]);
        setError(null);
    };

    // 3. Handle Submit (Create/Update with Connections)
    const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!formData.location || !formData.description) return;
            setError(null);

            try {
                if (editingSensor) {
                    // ✅ Update: Send connections to backend
                    await updateSensor(
                        editingSensor.id, 
                        formData.location, 
                        formData.description, 
                        selectedConnections
                    );
                    addLog('Update Sensor', `Updated sensor ID: ${editingSensor.id}`);
                } else {
                    // ✅ Create: Send connections to backend (Backend handles pipeline creation)
                    const newSensor = await addSensor(
                        formData.location, 
                        formData.description, 
                        selectedConnections
                    );
                    addLog('Add Sensor', `Added new sensor ID: ${newSensor.id}`);
                    
                    // ❌ REMOVED: The manual addPipeline loop. 
                    // The backend's 'store' method now handles this automatically.
                }

                handleCancelEdit();
                await loadData(); // Reload to show the new lines on the map
                onDataChange();
            } catch (e) {
                setError(t('errors.saveData'));
                console.error(e);
            }
        };
    
    const handleRemoveSensor = async (id: string) => {
        if (window.confirm(t('sensorManagement.deleteConfirm'))) {
            setError(null);
            try {
                const sensorToRemove = sensors.find(s => s.id === id);
                await removeSensor(id);
                if(sensorToRemove) {
                    addLog('Remove Sensor', `Removed sensor ID: ${id} from location: ${sensorToRemove.location}`);
                }
                await loadData();
                onDataChange();
            } catch (e) {
                setError(t('errors.actionFailed'));
                console.error(e);
            }
        }
    };

    const isFormInvalid = !formData.location || !formData.description;

    return (
        <div className="bg-brand-light p-6 rounded-xl shadow-md">
            <h2 className="text-2xl font-bold text-brand-dark mb-6">{t('sensorManagement.title')}</h2>
            
            {error && <ErrorDisplay message={error} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* LEFT COLUMN: LIST */}
                <div>
                    <h3 className="text-lg font-semibold text-brand-dark mb-4">{t('sensorManagement.existingSensors')}</h3>
                    {loading ? <p>{t('sensorManagement.loading')}</p> : (
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                            {sensors.map(sensor => {
                                const connections = pipelines
                                    .filter(p => p.from === sensor.id || p.to === sensor.id)
                                    .map(p => (p.from === sensor.id ? p.to : p.from));

                                return (
                                    <li key={sensor.id} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg border">
                                        <div className="flex-1">
                                            <p className="font-bold text-brand-dark">{sensor.id}: {sensor.location}</p>
                                            <p className="text-sm text-gray-600">{sensor.description}</p>
                                            <div className="mt-2">
                                                <p className="text-xs font-semibold text-gray-500">{t('sensorManagement.connectedTo')}:</p>
                                                {connections.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {connections.map(connId => (
                                                            <span key={connId} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full font-mono">{connId}</span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-500 italic">{t('sensorManagement.noConnections')}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 pl-2">
                                            <button onClick={() => handleEditClick(sensor)} className="p-2 text-blue-500 hover:bg-blue-100 rounded-full transition-colors" aria-label={t('sensorManagement.editButton')}>
                                                <PencilIcon className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => handleRemoveSensor(sensor.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full transition-colors" aria-label={t('sensorManagement.deleteButton')}>
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: FORM */}
                <div>
                    <h3 className="text-lg font-semibold text-brand-dark mb-4">
                        {editingSensor ? t('sensorManagement.editSensorTitle') : t('sensorManagement.addSensorTitle')}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-gray-50">
                        <div>
                            <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                                {t('sensorManagement.locationLabel')} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="location"
                                name="location"
                                value={formData.location}
                                onChange={handleInputChange}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                                placeholder={t('sensorManagement.locationPlaceholder')}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                                {t('sensorManagement.descriptionLabel')} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                                placeholder={t('sensorManagement.descriptionPlaceholder')}
                                required
                            />
                        </div>
                        
                        {/* CONNECTED TO DROPDOWN */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('managementShared.connectToLabel')}</label>
                            <p className="text-xs text-gray-500 mb-1">{t('managementShared.connectToDescription')}</p>
                            <div className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm h-48 overflow-y-auto bg-white p-2 space-y-1">
                                {allNodes.length > 0 ? allNodes.map(node => {
                                    const isSelected = selectedConnections.includes(node.id);
                                    return (
                                        <button
                                            type="button"
                                            key={node.id}
                                            onClick={() => handleConnectionToggle(node.id)}
                                            className={`w-full flex justify-between items-center text-left px-3 py-2 border rounded-md transition-colors text-sm ${
                                                isSelected 
                                                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500' 
                                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                            }`}
                                        >
                                            <span>{node.name}</span>
                                            {isSelected && <CheckIcon className="w-5 h-5 text-blue-600" />}
                                        </button>
                                    )
                                }) : <p className="text-sm text-gray-500 text-center pt-10">No other nodes found.</p>}
                            </div>
                        </div>

                        <div className="flex items-center gap-4 pt-2">
                            <button
                                type="submit"
                                disabled={isFormInvalid}
                                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-brand-primary text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition duration-300 disabled:bg-blue-300 disabled:cursor-not-allowed"
                            >
                                {editingSensor ? t('sensorManagement.saveButton') : <><PlusIcon className="w-5 h-5" /> {t('sensorManagement.addButton')}</>}
                            </button>
                            {editingSensor && (
                                <button type="button" onClick={handleCancelEdit} className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors">
                                    {t('sensorManagement.cancelButton')}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SensorManagement;
