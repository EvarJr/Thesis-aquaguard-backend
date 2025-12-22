import React, { useState, useEffect } from 'react';
import { User, Pipeline } from '@/types';
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
  fetchPipelines
} from '@/services/apiService';
import {
  PlayIcon,
  CpuChipIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@/components/icons/IconComponents';
import { useTranslation } from '@/i18n';
import echo from '@/lib/echo'; 

interface MLTrainingProps {
  user: User;
}

const MLTraining: React.FC<MLTrainingProps> = ({ user }) => {
  const { t } = useTranslation();
  
  // State
  const [modelInfo, setModelInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isTraining, setIsTraining] = useState(false);

  // Settings
  const [autoMode, setAutoMode] = useState('manual');
  const [threshold, setThreshold] = useState(100);
  
  // Live Data & Collector
  const [liveData, setLiveData] = useState<any>(null);
  const [collecting, setCollecting] = useState(false);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');

  // Model Management
  const [allModels, setAllModels] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  useEffect(() => {
    loadInitialData();
    
    // ✅ REAL-TIME LISTENER
    if (echo) {
        const channel = echo.channel('sensors');
        channel.listen('.sensor.updated', (event: any) => {
            const data = event.data || event;
            setLiveData(data);
        });

        return () => { 
            echo.leave('sensors'); 
        };
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

      // Load Models
      const modelsData = await fetchAllModels();
      const list = modelsData.models || []; 
      setAllModels(list);
      
      const active = list.find((m: any) => m.status === 'ACTIVE');
      if (active) setSelectedModelId(String(active.id));

      // Load Pipelines
      const pipes = await fetchPipelines();
      setPipelines(pipes);

      // Check Training Status
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

  // ✅ SUPERVISED LEARNING LOGIC
  const handleLabelData = async (label: 'safe' | 'leak') => {
      if (!liveData) return;
      
      // Validation
      if (label === 'leak' && !selectedPipelineId) {
          alert("Please select the affected pipeline from the list first.");
          return;
      }

      setCollecting(true);
      try {
          // If safe, pipeline is null. If leak, use selected ID.
          // Explicitly cast null to string | null to satisfy TypeScript if needed
          const pipelineToSend: string | null = label === 'leak' ? selectedPipelineId : null;
          
          await collectLabeledData(liveData, label, pipelineToSend);
          
          setStatusMessage(`✅ Recorded: ${label.toUpperCase()}`);
          setTimeout(() => setStatusMessage(''), 2000);
      } catch (e) {
          console.error(e);
          alert("Failed to save data point.");
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
      
      {/* 1. SUPERVISED COLLECTOR */}
      <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-500">
        <h3 className="text-lg font-bold text-brand-dark mb-4 flex items-center gap-2">
            📡 Supervised Data Collector (Live Training)
        </h3>
        <p className="text-sm text-gray-600 mb-4">
            Watch the live readings. If you create a physical leak, select the pipeline and report it.
        </p>

        {liveData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Live Readings */}
                <div className="bg-gray-100 p-4 rounded-lg font-mono text-sm shadow-inner">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-gray-500 text-xs">Main Pipe</div>
                            <div className="font-bold text-blue-700">{Number(liveData.p_main).toFixed(1)} PSI / {Number(liveData.f_main).toFixed(1)} L/m</div>
                        </div>
                        <div>
                            <div className="text-gray-500 text-xs">DMA-1</div>
                            <div className="font-bold text-purple-700">{Number(liveData.p_dma1).toFixed(1)} PSI / {Number(liveData.f_1).toFixed(1)} L/m</div>
                        </div>
                        <div>
                            <div className="text-gray-500 text-xs">DMA-2</div>
                            <div className="font-bold text-teal-700">{Number(liveData.p_dma2).toFixed(1)} PSI / {Number(liveData.f_2).toFixed(1)} L/m</div>
                        </div>
                        <div>
                            <div className="text-gray-500 text-xs">DMA-3</div>
                            <div className="font-bold text-orange-700">{Number(liveData.p_dma3).toFixed(1)} PSI / {Number(liveData.f_3).toFixed(1)} L/m</div>
                        </div>
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={() => handleLabelData('safe')}
                        disabled={collecting}
                        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg shadow transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <CheckCircleIcon className="w-5 h-5" />
                        MARK SYSTEM AS SAFE
                    </button>
                    
                    <div className="relative border-t pt-3 mt-1">
                        <div className="flex gap-2">
                            <select 
                                value={selectedPipelineId}
                                onChange={(e) => setSelectedPipelineId(e.target.value)}
                                className="flex-1 p-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-red-500 outline-none"
                            >
                                <option value="" disabled>Select Pipeline</option>
                                {pipelines.map(p => (
                                    <option key={p.id} value={p.id}>{p.id} ({p.from} → {p.to})</option>
                                ))}
                            </select>

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
          {isTraining ? <CpuChipIcon className="w-6 h-6 animate-spin" /> : <PlayIcon className="w-6 h-6" />}
          {isTraining ? t('mlTraining.trainingButton') + '...' : t('mlTraining.startTrainingButton')}
        </button>
      </div>
    </div>
  );
};

export default MLTraining;