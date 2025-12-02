// ✅ Global Type Definitions for AquaGuard System

// ======================================================
// 🧩 ROLE & USER
// ======================================================
export enum Role {
  Admin = 'Admin',
  User = 'User',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at?: string;
  updated_at?: string;
}

// ======================================================
// 🧩 SENSORS, HOUSEHOLDS, WATER PUMPS
// ======================================================
export interface Sensor {
  id: string;
  location: string;
  description: string;
  x: number;
  y: number;
}

export interface Household {
  id: string;
  address: string;
  x: number;
  y: number;
}

export enum WaterPumpStatus {
  Active = 'Active',
  Inactive = 'Inactive',
  Error = 'Error',
}

export interface WaterPump {
  id: string;
  location: string;
  status: WaterPumpStatus;
  x: number;
  y: number;
}

// ======================================================
// 🧩 PIPELINES
// ======================================================
export interface Pipeline {
  id: string;
  from: string; // ID of a Sensor, Pump, or another node
  to: string;   // ID of a Sensor, Pump, or Household
  joints?: { x: number; y: number }[];
}

// ======================================================
// 🧩 SENSOR DATA
// ======================================================
export interface SensorData {
  id: string;
  sensorId: string;
  pressure: number;
  flowRate: number;
  leakageStatus: boolean;
  timestamp: string;
}

// ======================================================
// 🧩 ALERTS & ANALYTICS
// ======================================================
export enum Severity {
  Critical = 'Critical',
  High = 'High',
  Medium = 'Medium',
}

export interface Alert {
  id: string;
  sensorId: string;
  pipelineId?: string;
  message: string;
  severity: Severity;
  createdAt: string;
  resolvedAt: string | null;
  falsePositive?: boolean;
}

export interface AiAnalysis {
  summary: string;
  suggestedActions: string[];
  potentialCauses: string[];
}

// ======================================================
// 🧩 LOGS
// ======================================================
export interface LogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: Role;
  action: string;
  details: string;
}

// ======================================================
// 🧩 COMMUNITY FORUM
// ======================================================
export enum ForumCategory {
  Announcements = 'Announcements',
  Community = 'Community',
  Admin = 'Admin',
}

export interface ForumPost {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface ForumTopic {
  id: string;
  title: string;
  category: ForumCategory;
  authorId: string;
  authorName: string;
  createdAt: string;
  posts: ForumPost[];
}

// ======================================================
// 🧩 MACHINE LEARNING
// ======================================================
export enum MLModelStatus {
  NOT_TRAINED = 'Not Trained',
  TRAINING = 'Training',
  TRAINED = 'Trained',
  FAILED = 'Failed',
}

export interface MLTrainingResult {
  accuracy: number;
  confusionMatrix: [[number, number], [number, number]]; // [[TP, FN], [FP, TN]]
  trainedAt: string;
  message?: string;
}

/**
 * ✅ Unified ML Model Info — supports versioned models
 */
export interface MLModelInfo {
  id?: number;                       // Database ID
  version?: string;                  // e.g. "1.0", "1.1"
  name?: string;                     // Optional descriptive name
  description?: string | null;       // Optional longer notes
  status: MLModelStatus;             // Model status (Trained, etc.)
  is_active?: boolean;               // Whether this model is currently active
  result: MLTrainingResult | null;   // Accuracy, confusion matrix, etc.
  files?: {
    detect_model_exists?: boolean;
    locate_model_exists?: boolean;
    last_trained?: string | null;
  };
  last_origin?: string | null;       // e.g. 'manual' or 'auto_ga'
  last_trained?: string | null;      // Last trained timestamp
  created_at?: string | null;        // Laravel timestamps
  updated_at?: string | null;
}

/**
 * ✅ Result returned by backend when starting training
 */
export interface MLTrainingProcessResult {
  status: string;          // e.g. "in_progress", "error", "ok"
  message?: string;
  origin?: string;
}

/**
 * ✅ Model list + active model (used in dropdown selection)
 */
export interface MLModelListResponse {
  models: MLModelInfo[];
  active: MLModelInfo | null;
}
