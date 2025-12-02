import React, { useState, useEffect } from 'react';
import { User, Pipeline } from '@/types'; // ✅ Import Pipeline Type
import {
  fetchMLModelInfo,
  startTrainingProcess,
  pollTrainingProgress,
  fetchTrainingProgress,
  fetchMLSettings,
  saveMLSettings,
  collectLabeledData,
  fetchAllModels,
  activateModelVersion,
  fetchPipelines // ✅ Import Pipeline Fetcher
} from '@/services/apiService';
import {
  PlayIcon,
  CpuChipIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@/components/icons/IconComponents';
import { useTranslation } from '@/i18n';

interface MLTrainingProps {
  user: User;
}

declare global {
    interface Window { Echo: any; }
}

const MLTraining: React.FC<MLTrainingProps> = ({ user }) => {
  const { t } = useTranslation();
  
  const [modelInfo, setModelInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isTraining, setIsTraining] = useState(false);

  const [autoMode, setAutoMode] = useState('manual');
  const [threshold, setThreshold] = useState(100);
  
  // Live Data & Pipelines
  const [liveData, setLiveData] = useState<any>(null);
  const [collecting, setCollecting] = useState(false);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]); // ✅ List of pipelines from DB
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(''); // ✅ Selected Pipe

  const [allModels, setAllModels] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  useEffect(() => {
    loadInitialData();
    
    if (window.Echo) {
        const channel = window.Echo.channel('sensors');
        channel.listen('.sensor.updated', (event: any) => {
            const data = event.data || event;
            setLiveData(data);
        });
        return () => { window.Echo.leave('sensors'); };
    }
  }, []);

  const loadInitialData = async () => {
    try {
      const info = await fetchMLModelInfo() as any;
      setModelInfo({
          version: info.version || 'v0.0',
          accuracy: info.accuracy || 'N/A',
          status: info.status || 'Idle',
          updated_at: info.updated_at || 'Never'
      });

      const settings = await fetchMLSettings();
      setAutoMode(settings.mode);
      setThreshold(settings.target);

      const modelsData = await fetchAllModels();
      const list = modelsData.models || []; 
      setAllModels(list);
      
      const active = list.find((m: any) => m.status === 'ACTIVE');
      if (active) setSelectedModelId(String(active.id));

      // ✅ LOAD REAL PIPELINES FROM DB
      const pipes = await fetchPipelines();
      setPipelines(pipes);
      // Optional: Default to first pipeline if available
      // if (pipes.length > 0) setSelectedPipelineId(pipes[0].id);

      const currentProgress = await fetchTrainingProgress();
      if (currentProgress.status === 'training') {
        setIsTraining(true);
        monitorTraining();
      }
    } catch (e) {
      console.error("Failed to load data", e);
    }
  };

  const handleStartTraining = async () => {
    setLoading(true);
    try {
      await startTrainingProcess();
      setIsTraining(true);
      monitorTraining();
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const monitorTraining = () => {
    pollTrainingProgress(2000, (data) => {
      setProgress(data.progress);
      setStatusMessage(data.message);
      if (data.progress >= 100 || data.status === 'error' || data.status === 'success') {
        setIsTraining(false);
        setLoading(false);
        loadInitialData(); 
      }
    });
  };

  const handleSaveSettings = async () => {
    await saveMLSettings(autoMode, threshold);
    alert("Settings Saved!");
  };

  // ✅ LOGIC: Handle "Safe" vs "Leak"
  const handleLabelData = async (label: 'safe' | 'leak') => {
      if (!liveData) return;
      
      // If reporting a leak, user MUST select a pipeline first
      if (label === 'leak' && !selectedPipelineId) {
          alert("Please select the affected pipeline from the list first.");
          return;
      }

      setCollecting(true);
      try {
          // If Safe, pipelineId is null. If Leak, use selected pipeline.
          const pipelineToSend = label === 'leak' ? selectedPipelineId : null;
          
          await collectLabeledData(liveData, label, pipelineToSend);
          
          setStatusMessage(`✅ Recorded: ${label.toUpperCase()} ${pipelineToSend ? `on ${pipelineToSend}` : ''}`);
          setTimeout(() => setStatusMessage(''), 2000);
      } catch (e) {
          console.error(e);
      } finally {
          setCollecting(false);
      }
  };

  const handleActivateModel = async () => {
      if (!selectedModelId) return;
      setLoading(true);
      try {
          await activateModelVersion(Number(selectedModelId));
          alert("Model Activated Successfully!");
          await loadInitialData();
      } catch (e) {
          alert("Failed to activate model.");
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. SUPERVISED COLLECTOR (The "Teacher" Interface) */}
      <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-500">
        <h3 className="text-lg font-bold text-brand-dark mb-4 flex items-center gap-2">
            📡 Supervised Data Collector (Live Training)
        </h3>
        <p className="text-sm text-gray-600 mb-4">
            Watch the live readings. If you create a physical leak, select the pipeline and report it. If the system is normal, mark it as safe.
        </p>

        {liveData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Live Readings */}
                <div className="bg-gray-100 p-4 rounded-lg font-mono text-sm shadow-inner">
                    <div className="flex justify-between border-b border-gray-200 pb-1 mb-1">
                        <span>Pressure (Main):</span> <span className="font-bold text-blue-600">{Number(liveData.p_main).toFixed(2)} PSI</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-1 mb-1">
                        <span>Flow (Main):</span> <span className="font-bold text-blue-600">{Number(liveData.f_main).toFixed(2)} L/m</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-1 mb-1">
                        <span>Pressure (DMA1):</span> <span className="font-bold text-purple-600">{Number(liveData.p_dma1).toFixed(2)} PSI</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Flow (DMA1):</span> <span className="font-bold text-purple-600">{Number(liveData.f_1).toFixed(2)} L/m</span>
                    </div>
                </div>

                {/* Right: Teacher Controls */}
                <div className="flex flex-col gap-3">
                    {/* Green Button: Everything is OK */}
                    <button 
                        onClick={() => handleLabelData('safe')}
                        disabled={collecting}
                        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg shadow transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <CheckCircleIcon className="w-5 h-5" />
                        MARK SYSTEM AS SAFE
                    </button>
                    
                    <div className="relative border-t pt-3 mt-1">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Report Specific Leak</p>
                        <div className="flex gap-2">
                            {/* Pipeline Selector (From Database) */}
                            <select 
                                value={selectedPipelineId}
                                onChange={(e) => setSelectedPipelineId(e.target.value)}
                                className="flex-1 p-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-red-500 outline-none"
                            >
                                <option value="" disabled>Select Affected Pipeline</option>
                                {pipelines.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.id} ({p.from} → {p.to})
                                    </option>
                                ))}
                            </select>

                            {/* Red Button: Report Leak */}
                            <button 
                                onClick={() => handleLabelData('leak')} 
                                disabled={collecting || !selectedPipelineId} 
                                className="bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold px-4 rounded-lg shadow active:scale-95 text-sm whitespace-nowrap"
                            >
                                🚨 REPORT LEAK
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        ) : (
            <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed">
                <div className="animate-pulse">Waiting for live sensor data...</div>
                <div className="text-xs mt-2">Ensure simulator or ESP32 is running.</div>
            </div>
        )}
      </div>

      {/* 2. MODEL SELECTION */}
      <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="font-bold text-brand-dark mb-3">Select ML Model Version</h3>
          <div className="flex flex-col md:flex-row gap-4">
              <select 
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  className="flex-1 p-3 border rounded-lg bg-gray-50 font-medium text-gray-700"
              >
                  {allModels.map((m) => (
                      <option key={m.id} value={m.id}>
                          {m.name} (v{m.version}) - {m.accuracy ? `${m.accuracy}%` : 'N/A'} {m.status === 'ACTIVE' ? '(Active)' : ''}
                      </option>
                  ))}
                  {allModels.length === 0 && <option>No models available</option>}
              </select>
              <button 
                  onClick={handleActivateModel}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-lg shadow-md transition-colors"
              >
                  Activate Selected Model
              </button>
          </div>
      </div>

      {/* 3. CURRENT MODEL STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-brand-light p-6 rounded-xl shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <CpuChipIcon className="w-6 h-6 text-purple-600" />
            <h3 className="font-bold text-brand-dark">{t('mlTraining.currentVersion')}</h3>
          </div>
          <p className="text-3xl font-bold text-brand-primary">{modelInfo?.version || 'v0.0'}</p>
          <p className="text-sm text-gray-500">{t('mlTraining.status')}: {modelInfo?.status || 'Idle'}</p>
        </div>

        <div className="bg-brand-light p-6 rounded-xl shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircleIcon className="w-6 h-6 text-green-600" />
            <h3 className="font-bold text-brand-dark">{t('mlTraining.accuracy')}</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{modelInfo?.accuracy ? `${modelInfo.accuracy}%` : 'N/A'}</p>
          <p className="text-sm text-gray-500">{t('mlTraining.lastTrained')}: {modelInfo?.updated_at || 'Never'}</p>
        </div>

        <div className="bg-brand-light p-6 rounded-xl shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <ClockIcon className="w-6 h-6 text-blue-600" />
            <h3 className="font-bold text-brand-dark">{t('mlTraining.nextTraining')}</h3>
          </div>
          <p className="text-lg font-bold text-brand-dark">
             {autoMode === 'auto' ? `Auto (Target: ${threshold} rows)` : 'Manual Mode'}
          </p>
        </div>
      </div>

      {/* 4. TRAINING CONTROLS */}
      <div className="bg-white p-6 rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-brand-dark">{t('mlTraining.title')}</h2>
          {isTraining && <span className="text-blue-600 font-bold animate-pulse">{t('mlTraining.trainingInProgress')}</span>}
        </div>

        {/* Progress Bar */}
        {isTraining && (
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
              <div className="bg-blue-600 h-4 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-sm text-center text-gray-600">{statusMessage}</p>
          </div>
        )}

        <button
          onClick={handleStartTraining}
          disabled={isTraining || loading}
          className={`w-full py-4 rounded-lg font-bold text-white text-lg flex items-center justify-center gap-3 transition-all ${
            isTraining ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand-primary hover:bg-blue-700 shadow-lg hover:shadow-xl'
          }`}
        >
          {isTraining ? (
            <CpuChipIcon className="w-6 h-6 animate-spin" />
          ) : (
            <PlayIcon className="w-6 h-6" />
          )}
          {isTraining ? t('mlTraining.trainingButton') + '...' : t('mlTraining.startTrainingButton')}
        </button>
      </div>

      {/* 5. CONFIGURATION */}
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
        <h3 className="font-bold text-gray-700 mb-4">⚙️ Auto-Training Configuration</h3>
        <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
                <label className="block text-sm font-bold text-gray-600 mb-1">Training Mode</label>
                <select 
                    value={autoMode} 
                    onChange={(e) => setAutoMode(e.target.value)}
                    className="w-full p-2 border rounded"
                >
                    <option value="manual">Manual Only</option>
                    <option value="auto">Automatic (Data Threshold)</option>
                </select>
            </div>
            <div className="flex-1">
                <label className="block text-sm font-bold text-gray-600 mb-1">Data Threshold (Rows)</label>
                <input 
                    type="number" 
                    value={threshold} 
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full p-2 border rounded"
                />
            </div>
            <button onClick={handleSaveSettings} className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-2 rounded font-bold">
                Save Config
            </button>
        </div>
      </div>
    </div>
  );
};

export default MLTraining;