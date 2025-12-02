import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WaterPump, User, Pipeline, Sensor, Household } from '@/types';
import { fetchPumps, addPump, updatePump, removePump, addLog, fetchPipelines, fetchSensors, fetchHouseholds } from '@/services/apiService';
import { PlusIcon, TrashIcon, PencilIcon, CheckIcon } from '@/components/icons/IconComponents';
import { useTranslation } from '@/i18n';
import ErrorDisplay from '@/components/ErrorDisplay';

interface PumpManagementProps {
  user: User;
  onDataChange: () => void;
}

const PumpManagement: React.FC<PumpManagementProps> = ({ user, onDataChange }) => {
  const [pumps, setPumps] = useState<WaterPump[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<{ location: string; status: string }>({
    location: '',
    status: 'active',
  });
  const [editingPump, setEditingPump] = useState<WaterPump | null>(null);
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pumpData, sensorData, householdData, pipelineData] = await Promise.all([
        fetchPumps(),
        fetchSensors(),
        fetchHouseholds(),
        fetchPipelines(),
      ]);
      setPumps(pumpData);
      setSensors(sensorData);
      setHouseholds(householdData);
      setPipelines(pipelineData);
    } catch (e) {
      setError(t('errors.loadData'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allNodes = useMemo(() => {
    const s = sensors.map((i) => ({ id: i.id, name: `${i.id} (Sensor)`, type: 'sensor' }));
    const h = households.map((i) => ({ id: i.id, name: `${i.id} (Household)`, type: 'household' }));
    const p = pumps.map((i) => ({ id: i.id, name: `${i.id} (Pump)`, type: 'pump' }));
    return [...s, ...h, ...p].filter((node) => node.id !== editingPump?.id);
  }, [sensors, households, pumps, editingPump]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleConnectionToggle = (nodeId: string) => {
    setSelectedConnections((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
    );
  };

  const handleEditClick = (pump: WaterPump) => {
    setEditingPump(pump);
    setFormData({ location: pump.location, status: pump.status.toLowerCase() });
    const currentConnections = pipelines
      .filter((p) => p.from === pump.id || p.to === pump.id)
      .map((p) => (p.from === pump.id ? p.to : p.from));
    setSelectedConnections(currentConnections);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingPump(null);
    setFormData({ location: '', status: 'active' });
    setSelectedConnections([]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.location) return;
    setError(null);

    try {
      const normalizedStatus = formData.status.toLowerCase();

      if (editingPump) {
        // ✅ Update: Send connections to backend
        await updatePump(editingPump.id, formData.location, normalizedStatus, selectedConnections);
        addLog('Update Pump', `Updated pump ID: ${editingPump.id}`);
      } else {
        // ✅ Create: Send connections directly
        const newPump = await addPump(formData.location, normalizedStatus, selectedConnections);
        addLog('Add Pump', `Added new pump ID: ${newPump.id}`);
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
    if (window.confirm(t('pumpManagement.deleteConfirm'))) {
      setError(null);
      try {
        const pumpToRemove = pumps.find((p) => p.id === id);
        await removePump(id);
        if (pumpToRemove) addLog('Remove Pump', `Removed pump ID: ${id}`);
        loadData();
        onDataChange();
      } catch (e) {
        setError(t('errors.actionFailed'));
      }
    }
  };

  const statusColor: Record<string, string> = {
    active: 'text-green-700 bg-green-100',
    inactive: 'text-gray-700 bg-gray-100',
    error: 'text-red-700 bg-red-100',
  };

  return (
    <div className="bg-brand-light p-6 rounded-xl shadow-md">
      <h2 className="text-2xl font-bold text-brand-dark mb-6">{t('pumpManagement.title')}</h2>

      {error && <ErrorDisplay message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Existing Pumps */}
        <div>
          <h3 className="text-lg font-semibold text-brand-dark mb-4">{t('pumpManagement.existingPumps')}</h3>
          {loading ? <p>{t('pumpManagement.loading')}</p> : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {pumps.map((item) => {
                const connections = pipelines
                  .filter((p) => p.from === item.id || p.to === item.id)
                  .map((p) => (p.from === item.id ? p.to : p.from));

                return (
                  <li key={item.id} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg border">
                    <div className="flex-1">
                      <p className="font-bold text-brand-dark">{item.id}: {item.location}</p>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[item.status.toLowerCase()]}`}>
                        {item.status}
                      </span>
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-gray-500">{t('pumpManagement.connectedTo')}:</p>
                        {connections.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {connections.map((connId) => (
                              <span key={connId} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full font-mono">{connId}</span>
                            ))}
                          </div>
                        ) : <p className="text-xs text-gray-500 italic">{t('pumpManagement.noConnections')}</p>}
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
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Add/Edit Form */}
        <div>
          <h3 className="text-lg font-semibold text-brand-dark mb-4">
            {editingPump ? t('pumpManagement.editPumpTitle') : t('pumpManagement.addPumpTitle')}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-gray-50">
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                {t('pumpManagement.locationLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                placeholder={t('pumpManagement.locationPlaceholder')}
                required
              />
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">{t('pumpManagement.statusLabel')}</label>
              <select name="status" value={formData.status} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="error">Error</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">{t('managementShared.connectToLabel')}</label>
              <div className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm h-32 overflow-y-auto bg-white p-2 space-y-1">
                {allNodes.length > 0 ? allNodes.map((node) => {
                    const isSelected = selectedConnections.includes(node.id);
                    return (
                      <button
                        type="button"
                        key={node.id}
                        onClick={() => handleConnectionToggle(node.id)}
                        className={`w-full flex justify-between items-center text-left px-3 py-2 border rounded-md transition-colors text-sm ${
                          isSelected ? 'bg-blue-100 border-blue-500 text-blue-900 font-semibold' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span>{node.name}</span>
                        {isSelected && <CheckIcon className="w-5 h-5 text-blue-600" />}
                      </button>
                    );
                }) : <p className="text-sm text-gray-500 text-center pt-10">No nodes found.</p>}
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <button type="submit" className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-brand-primary text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">
                {editingPump ? t('pumpManagement.saveButton') : <><PlusIcon className="w-5 h-5" /> {t('pumpManagement.addButton')}</>}
              </button>
              {editingPump && (
                <button type="button" onClick={handleCancelEdit} className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300">
                  {t('pumpManagement.cancelButton')}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PumpManagement;