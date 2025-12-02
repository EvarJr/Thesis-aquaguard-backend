import axios from 'axios';
import {
  Sensor, SensorData, Alert, AiAnalysis,
  Household, Pipeline, WaterPump, WaterPumpStatus,
  User, Role, ForumTopic, ForumPost, ForumCategory,
  MLModelInfo, MLTrainingResult, LogEntry
} from '../types';

// 🌍 Laravel backend base URL
const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

// ✅ Configure axios for Sanctum
axios.defaults.withCredentials = true;

// ⚙️ Axios instance
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// ======================================================
// 🧩 GLOBAL INTERCEPTOR (Handles expired sessions)
// ======================================================
let isRedirecting = false;
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isRedirecting) {
      console.warn('⚠️ Session expired — redirecting to login...');
      isRedirecting = true;
      localStorage.removeItem('user');

      // Auto-redirect to login if session is invalid
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ======================================================
// 🧩 CSRF INITIALIZATION
// ======================================================
export const csrf = async (): Promise<void> => {
  try {
    await api.get('/sanctum/csrf-cookie', { withCredentials: true });
  } catch (error) {
    console.error('❌ Failed to initialize CSRF cookie:', error);
    throw error;
  }
};

// ======================================================
// 🧩 AUTHENTICATION
// ======================================================
export const loginUser = async (email: string, password: string): Promise<User> => {
  await csrf();
  const res = await api.post('/api/login', { email, password }, { withCredentials: true });
  const user = res.data.user || res.data;

  // Allow Sanctum cookie to fully sync
  await new Promise((resolve) => setTimeout(resolve, 400));

  if (user) localStorage.setItem('user', JSON.stringify(user));
  return user;
};

export const logoutUser = async (): Promise<void> => {
  try {
    await api.post('/api/logout', {}, { withCredentials: true });
  } catch {
    console.warn('⚠️ Logout failed or already invalid.');
  } finally {
    localStorage.removeItem('user');
  }
};

/**
 * ✅ Resilient getCurrentUser()
 */
export const getCurrentUser = async (): Promise<User | null> => {
  const cachedUser = localStorage.getItem('user');
  if (cachedUser) {
    try {
      const parsed = JSON.parse(cachedUser);
      if (parsed?.id && parsed?.role) return parsed;
    } catch {
      console.warn('⚠️ Failed to parse cached user.');
    }
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await api.get('/api/user', { withCredentials: true });
      if (res.data && res.data.id) {
        localStorage.setItem('user', JSON.stringify(res.data));
        return res.data as User;
      }
      return null;
    } catch (error: any) {
      if (error.response?.status === 401) {
        if (attempt === 1) {
          console.warn('🔄 Retrying CSRF refresh before next attempt...');
          await csrf();
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }

  console.warn('❌ No valid session found, redirecting...');
  localStorage.removeItem('user');
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }

  return null;
};

// ======================================================
// 🧩 LOGGING
// ======================================================
export const addLog = async (action: string, details: string): Promise<void> =>
  api.post('/api/logs', { action, details });

export const fetchLogs = async (): Promise<LogEntry[]> =>
  (await api.get('/api/logs')).data;

// ======================================================
// 🧩 USER MANAGEMENT
// ======================================================
export const fetchUsers = async (): Promise<User[]> =>
  (await api.get('/api/users')).data;

export const addUserWithRole = async (
  email: string,
  password: string,
  name: string,
  role: Role
): Promise<User> => {
  const formattedRole =
    typeof role === 'string'
      ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
      : role;

  try {
    const res = await api.post(
      '/api/users',
      { name, email, password, role: formattedRole },
      { withCredentials: true }
    );
    return res.data;
  } catch (error: any) {
    console.error('❌ Failed to add user:', error.response?.data || error.message);
    throw error;
  }
};

export const updateUser = async (id: string, name: string, role: Role): Promise<User> => {
  const formattedRole =
    typeof role === 'string'
      ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
      : role;

  try {
    const res = await api.put(
      `/api/users/${id}`,
      { name, role: formattedRole },
      { withCredentials: true }
    );
    return res.data;
  } catch (error: any) {
    console.error('❌ Failed to update user:', error.response?.data || error.message);
    throw error;
  }
};

export const removeUser = async (id: string): Promise<void> =>
  api.delete(`/api/users/${id}`);

export const updateProfile = async (name: string, email: string, password?: string, password_confirmation?: string): Promise<User> => {
  const payload: any = { name, email };
  if (password) {
    payload.password = password;
    payload.password_confirmation = password_confirmation;
  }
  const res = await api.put('/api/profile', payload);
  return res.data.user;
};

// ======================================================
// 🧩 SENSOR MANAGEMENT
// ======================================================
export const fetchSensors = async (): Promise<Sensor[]> =>
  (await api.get('/api/sensors')).data;

export const addSensor = async (location: string, description: string, connectedTo?: string[]): Promise<Sensor> =>
  (await api.post('/api/sensors', { location, description, connectedTo })).data;

export const updateSensor = async (id: string, location: string, description: string, connectedTo?: string[]): Promise<Sensor> =>
  (await api.put(`/api/sensors/${id}`, { location, description, connectedTo })).data;

export const removeSensor = async (id: string): Promise<void> =>
  api.delete(`/api/sensors/${id}`);

// ======================================================
// 🧩 HOUSEHOLD
// ======================================================
export const fetchHouseholds = async (): Promise<Household[]> =>
  (await api.get('/api/households')).data;

export const addHousehold = async (address: string, connectedTo?: string[]): Promise<Household> =>
  (await api.post('/api/households', { address, connectedTo })).data;

export const updateHousehold = async (id: string, address: string, connectedTo?: string[]): Promise<Household> =>
  (await api.put(`/api/households/${id}`, { address, connectedTo })).data;

export const removeHousehold = async (id: string): Promise<void> =>
  api.delete(`/api/households/${id}`);

// ======================================================
// 🧩 WATER PUMPS
// ======================================================
export const fetchPumps = async (): Promise<WaterPump[]> =>
  (await api.get('/api/pumps')).data;

export const addPump = async (location: string, status: string, connectedTo?: string[]): Promise<WaterPump> =>
  (await api.post('/api/pumps', { location, status, connectedTo })).data;

export const updatePump = async (id: string, location: string, status: string, connectedTo?: string[]): Promise<WaterPump> =>
  (await api.put(`/api/pumps/${id}`, { location, status, connectedTo })).data;

export const removePump = async (id: string): Promise<void> =>
  api.delete(`/api/pumps/${id}`);

// ======================================================
// 🧩 MAP POSITION UPDATES
// ======================================================
export const updateSensorPosition = async (id: string, x: number, y: number): Promise<void> =>
  api.put(`/api/sensors/${id}`, { x, y });

export const updateHouseholdPosition = async (id: string, x: number, y: number): Promise<void> =>
  api.put(`/api/households/${id}`, { x, y });

export const updatePumpPosition = async (id: string, x: number, y: number): Promise<void> =>
  api.put(`/api/pumps/${id}`, { x, y });

// ======================================================
// 🧩 ALERTS
// ======================================================
export const fetchActiveAlerts = async (): Promise<Alert[]> =>
  (await api.get('/api/alerts')).data;

export const fetchAllAlerts = async (): Promise<Alert[]> =>
  (await api.get('/api/alerts?all=true')).data;

export const resolveAlert = async (alertId: string): Promise<Alert> =>
  (await api.post(`/api/alerts/${alertId}/resolve`)).data;

export const markAlertAsFalse = async (alertId: string): Promise<Alert> =>
  (await api.post(`/api/alerts/${alertId}/mark-false`)).data;

// ======================================================
// 🧩 SENSOR DATA
// ======================================================
export const fetchHistoryData = async (): Promise<SensorData[]> =>
  (await api.get('/api/sensor-data')).data;

// ======================================================
// 🧩 AI ANALYSIS
// ======================================================
export const getAlertAnalysis = async (alert: Alert): Promise<AiAnalysis> =>
  (await api.post('/api/analysis', { alert })).data;

// ======================================================
// 🧩 PIPELINES
// ======================================================
export const fetchPipelines = async (): Promise<Pipeline[]> =>
  (await api.get('/api/pipelines')).data;

export const addPipeline = async (from: string, to: string): Promise<Pipeline | null> =>
  (await api.post('/api/pipelines', { from, to })).data;

export const removePipeline = async (id: string): Promise<void> =>
  api.delete(`/api/pipelines/${id}`);

export const updatePipelineJoints = async (
  pipelineId: string,
  joints: { x: number; y: number }[]
): Promise<void> =>
  api.put(`/api/pipelines/${pipelineId}`, { joints });

// ======================================================
// 🧩 FORUM
// ======================================================
export const fetchTopics = async (category: ForumCategory): Promise<ForumTopic[]> =>
  (await api.get(`/api/forum-topics?category=${category}`)).data;

export const fetchTopicById = async (topicId: string): Promise<ForumTopic | undefined> =>
  (await api.get(`/api/forum-topics/${topicId}`)).data;

export const addTopic = async (title: string, content: string, category: ForumCategory): Promise<ForumTopic> =>
  (await api.post('/api/forum-topics', { title, content, category })).data;

export const addPost = async (topicId: string, content: string): Promise<ForumPost> =>
  (await api.post('/api/forum-posts', { topic_id: topicId, content })).data;


// ======================================================
// 🧩 MACHINE LEARNING (TRAINING & PROGRESS)
// ======================================================
export const fetchMLModelInfo = async (): Promise<MLModelInfo> => {
  const res = await api.get('/api/ml-model');
  return res.data;
};

export const startTrainingProcess = async (): Promise<MLTrainingResult> => {
  await csrf();
  const res = await api.post('/api/ml-model/train', {}, { withCredentials: true });
  return res.data;
};

export const fetchTrainingProgress = async (): Promise<{
  progress: number;
  status: string;
  message: string;
  timestamp?: string;
}> => {
  try {
    const res = await api.get('/api/ml-model/progress');
    return res.data;
  } catch (err: any) {
    console.warn('⚠️ Failed to fetch training progress:', err.response?.data || err.message);
    return { progress: 0, status: 'error', message: 'Unable to read progress' };
  }
};

export const retrainWithGA = async (): Promise<{ status: string; message: string }> => {
  await csrf();
  const res = await api.post('/api/ml-model/manual-retrain', {}, { withCredentials: true });
  return res.data;
};

export const pollTrainingProgress = async (
  intervalMs = 5000,
  onUpdate?: (data: any) => void
): Promise<() => void> => {
  let active = true;
  const poll = async () => {
    while (active) {
      try {
        const data = await fetchTrainingProgress();
        if (onUpdate) onUpdate(data);
      } catch (err) {
        console.error('Polling error:', err);
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  };
  poll();
  return () => {
    active = false;
  };
};

// ======================================================
// ⚙️ ML SETTINGS (Auto-Training Configuration)
// ======================================================
export const fetchMLSettings = async (): Promise<{ mode: string; target: number }> => {
  const res = await api.get('/api/ml-model/settings');
  return res.data;
};

export const saveMLSettings = async (mode: string, target: number): Promise<void> => {
  await csrf();
  await api.post('/api/ml-model/settings', { mode, target }, { withCredentials: true });
};

// ====================================================== 
// 🧩 ML MODEL VERSION MANAGEMENT
// ======================================================
export const fetchAllModels = async (): Promise<{
  models: MLModelInfo[];
  active: MLModelInfo | null;
}> => {
  try {
    const res = await api.get('/api/ml-models');
    return res.data;
  } catch (err: any) {
    console.error('❌ Failed to fetch ML models:', err.response?.data || err.message);
    return { models: [], active: null };
  }
};

export const activateModelVersion = async (
  id: number
): Promise<{ status: string; message: string }> => {
  await csrf();
  try {
    const res = await api.post(
      `/api/ml-models/${id}/activate`,
      {},
      { withCredentials: true }
    );
    return res.data;
  } catch (err: any) {
    console.error('❌ Failed to activate ML model version:', err.response?.data || err.message);
    throw err;
  }
};

export const registerBaseModel = async (): Promise<{
  status: string;
  version: string;
  message: string;
}> => {
  await csrf();
  try {
    const res = await api.post(
      '/api/ml-models/register-base',
      {},
      { withCredentials: true }
    );
    return res.data;
  } catch (err: any) {
    console.error('❌ Failed to register base model:', err.response?.data || err.message);
    throw err;
  }
};

// ======================================================
// 📄 REPORTS (New Report Generation Function)
// ======================================================
export const downloadSystemReport = async () => {
  try {
    // We must set responseType to 'blob' to handle PDF binary data correctly
    const response = await api.get('/api/reports/download', {
      responseType: 'blob',
    });

    // Create a virtual link to trigger the download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // Name the file with today's date
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `AquaGuard_System_Report_${dateStr}.pdf`);
    
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('❌ Error downloading report:', error);
    throw error;
  }
};




export const collectLabeledData = async (
  sensorData: any, 
  label: 'safe' | 'leak', 
  pipelineId?: string | null 
): Promise<void> => {
  await api.post('/api/ml-model/collect', {
    ...sensorData,
    manual_label: label,
    manual_pipeline_id: pipelineId
  });
};



export const updateTopic = async (id: string, title: string, category: string): Promise<void> => {
  await api.put(`/api/forum-topics/${id}`, { title, category });
};

export const deleteTopic = async (id: string): Promise<void> => {
  await api.delete(`/api/forum-topics/${id}`);
};



// ======================================================
// 🗺️ MAP SETTINGS (Background & Config)
// ======================================================
export const saveMapSettings = async (formData: FormData) => {
  // We use FormData to handle Image Uploads + JSON data together
  const res = await api.post('/api/map/settings', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data.config;
};

export const fetchMapSettings = async () => {
  const res = await api.get('/api/map/settings');
  return res.data;
};


// AI Analysis
export const fetchAiAnalysis = async (): Promise<{ analysis: string; timestamp: string }> => {
  const res = await api.get('/api/analysis/generate');
  return res.data;
};



export default api;