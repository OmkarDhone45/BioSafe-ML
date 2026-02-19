
export enum DrugCategory {
  ANTIBIOTIC = 'Antibiotic',
  PAINKILLER = 'Painkiller',
  STATIN = 'Statin',
  ANTIHISTAMINE = 'Antihistamine',
  ANTIDEPRESSANT = 'Antidepressant',
  BETABLOCKER = 'Beta-Blocker'
}

export enum BiologicalSex {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHER = 'Other'
}

export enum BPStatus {
  NORMAL = 'Normal',
  ELEVATED = 'Elevated',
  HIGH = 'High'
}

export enum DosageLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High'
}

export enum RiskLevel {
  LOW = 'Low Risk',
  MEDIUM = 'Moderate Risk',
  HIGH = 'High Risk'
}

export interface PatientProfile {
  drugCategory: DrugCategory;
  dosageLevel: DosageLevel;
  age: number;
  weight: number;
  sex: BiologicalSex;
  bpStatus: BPStatus;
  frequencyPerDay: number;
  lifestyleFactors: string[];
  allergies: string;
  specificConditions: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface SensitivityPoint {
  label: string;
  probability: number;
  riskLevel: RiskLevel;
}

export interface PredictionResult {
  riskLevel: RiskLevel;
  probability: number;
  explanation?: string;
  timestamp: number;
  mapLinks?: GroundingSource[];
  mitigations?: string[];
  sensitivityData?: SensitivityPoint[];
}

export interface ModelMetrics {
  accuracy: number;
  f1Score: number;
  trainingSize: number;
  testSize: number;
  featureImportance: number[];
}

export interface HistoryItem extends PredictionResult {
  id: string;
  profile: PatientProfile;
}
