export type Role = 'chef' | 'chauffeur';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  licenseExpiry?: string;
  ykbExpiry?: string;
  adrExpiry?: string;
}

export interface Vehicle {
  id: string;
  regNr: string;
  brand: string;
  model: string;
  lengthM: number;
  heightM?: number;
  widthM?: number;
  weightKg: number;
  maxLoadKg: number;
  axleWeightKg: number;
  inspectionDate: string;
  nextInspectionDate: string;
  taxDate: string;
  insuranceCompany: string;
  insuranceNumber?: string;
  insuranceExpiry: string;
  driverId?: string;
  createdBy: string;
}

export interface Document {
  id: string;
  type: 'registration' | 'license' | 'insurance' | 'cmr' | 'inspection';
  title: string;
  fileUrl?: string;
  fileName?: string;
  expiryDate?: string;
  userId?: string;
  vehicleId?: string;
  uploadedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  deadline: string;
  status: 'pending' | 'in_progress' | 'completed';
  assignedTo: string;
  vehicleId?: string;
  createdBy: string;
  completedAt?: string;
  completionComment?: string;
  completionImageUrl?: string;
}

export interface Trip {
  id: string;
  startLocation: string;
  endLocation: string;
  waypoints: string[];
  vehicleId: string;
  driverId: string;
  totalWeightKg: number;
  loadWeightKg: number;
  routeType: 'fastest' | 'normal';
  startTime: string;
  endTime?: string;
  totalDistanceKm: number;
  totalDriveTimeH: number;
  timeline: TimelineEntry[];
  createdAt: string;
}

export interface TimelineEntry {
  type: 'drive' | 'rest' | 'overnight' | 'stop' | 'arrival';
  label: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  location?: string;
  restStop?: RestStopInfo;
}

export type RestStopSuitability = 'perfect' | 'good' | 'warning' | 'unsuitable';

export interface RestStopFacilities {
  toilet: boolean;
  food: boolean;
  shower: boolean;
  fuel: boolean;
  truckParking: boolean;
}

export interface RestStopInfo {
  name: string;
  lat: number;
  lng: number;
  distance?: string;
  category?: string;
  address?: string;
  facilities?: RestStopFacilities;
  alternatives?: RestStopInfo[];
  suitability?: RestStopSuitability;
  suitabilityNote?: string;
}

export interface Reminder {
  id: string;
  type: 'inspection' | 'tax' | 'license' | 'ykb' | 'adr' | 'maintenance' | 'insurance';
  title: string;
  message: string;
  dueDate: string;
  relatedType: 'vehicle' | 'user';
  relatedId: string;
  status: 'active' | 'dismissed';
}

export interface SignScan {
  id: string;
  userId: string;
  vehicleId: string;
  manualText: string;
  restriction: SignRestriction;
  result: 'allowed' | 'denied';
  resultMessage: string;
  location?: string;
  scannedAt: string;
}

export interface SignRestriction {
  type: 'weight' | 'height' | 'length' | 'width' | 'no_entry' | 'no_parking' | 'other';
  value?: number;
  unit?: string;
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  userId: string;
  date: string;
  odometerKm: number;
  liters: number;
  pricePerLiter: number;
  location?: string;
}

export interface CommunityWarning {
  id: string;
  type: 'roadwork' | 'accident' | 'police' | 'bad_restarea';
  description: string;
  lat: number;
  lng: number;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface RestAreaReview {
  id: string;
  name: string;
  rating: number;
  comment: string;
  userId: string;
  maxLengthM?: number;
  createdAt: string;
}

export type BKClass = 'BK1' | 'BK2' | 'BK3' | 'BK4';

export const BK_LIMITS: Record<BKClass, number> = {
  BK1: 64000,
  BK2: 51400,
  BK3: 37500,
  BK4: 32000,
};

export type ReminderStatus = 'green' | 'yellow' | 'red';

export function getReminderStatus(dueDate: string): ReminderStatus {
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return 'red';
  if (diffDays <= 30) return 'yellow';
  return 'green';
}

export function getDaysUntil(dueDate: string): number {
  const now = new Date();
  const due = new Date(dueDate);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
