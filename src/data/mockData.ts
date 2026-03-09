import { User, Vehicle, Document, Task, Trip, Reminder, TimelineEntry } from '@/types';

export const mockUsers: User[] = [
  {
    id: 'user-chef',
    name: 'Anna Lindberg',
    email: 'chef@demo.se',
    role: 'chef',
    phone: '070-123 45 67',
  },
  {
    id: 'user-chauffeur',
    name: 'Erik Johansson',
    email: 'chauffeur@demo.se',
    role: 'chauffeur',
    phone: '070-987 65 43',
    licenseExpiry: '2027-03-15',
    ykbExpiry: '2026-09-01',
    adrExpiry: '2026-12-20',
  },
];

export const mockVehicles: Vehicle[] = [
  {
    id: 'v1',
    regNr: 'ABC 123',
    brand: 'Volvo',
    model: 'FH16',
    lengthM: 18,
    weightKg: 15000,
    maxLoadKg: 25000,
    axleWeightKg: 10000,
    inspectionDate: '2024-06-01',
    nextInspectionDate: '2025-06-01',
    taxDate: '2025-03-15',
    insuranceCompany: 'IF Försäkring',
    insuranceNumber: 'IF-2024-78901',
    insuranceExpiry: '2025-12-31',
    driverId: 'user-chauffeur',
    createdBy: 'user-chef',
  },
  {
    id: 'v2',
    regNr: 'DEF 456',
    brand: 'Scania',
    model: 'R500',
    lengthM: 16.5,
    weightKg: 14500,
    maxLoadKg: 22000,
    axleWeightKg: 9500,
    inspectionDate: '2024-04-20',
    nextInspectionDate: '2025-04-20',
    taxDate: '2025-02-10',
    insuranceCompany: 'Trygg-Hansa',
    insuranceNumber: 'TH-2024-45678',
    insuranceExpiry: '2025-08-15',
    createdBy: 'user-chef',
  },
];

export const mockDocuments: Document[] = [
  {
    id: 'doc1',
    type: 'registration',
    title: 'Registreringsbevis – Volvo FH16',
    vehicleId: 'v1',
    uploadedAt: '2024-01-15',
  },
  {
    id: 'doc2',
    type: 'insurance',
    title: 'Försäkringsbrev – IF Försäkring',
    vehicleId: 'v1',
    expiryDate: '2025-12-31',
    uploadedAt: '2024-01-15',
  },
  {
    id: 'doc3',
    type: 'license',
    title: 'Körkort – Erik Johansson',
    userId: 'user-chauffeur',
    expiryDate: '2027-03-15',
    uploadedAt: '2024-02-01',
  },
  {
    id: 'doc4',
    type: 'inspection',
    title: 'Besiktningsprotokoll – Scania R500',
    vehicleId: 'v2',
    expiryDate: '2025-04-20',
    uploadedAt: '2024-04-20',
  },
];

export const mockTasks: Task[] = [
  {
    id: 'task1',
    title: 'Kontrollera däcktryck',
    description: 'Kontrollera däcktryck på lastbil inför morgondagens resa till Göteborg.',
    deadline: '2026-03-10',
    status: 'pending',
    assignedTo: 'user-chauffeur',
    vehicleId: 'v1',
    createdBy: 'user-chef',
  },
  {
    id: 'task2',
    title: 'Boka besiktning Scania R500',
    description: 'Besiktningen för DEF 456 går ut 2025-04-20. Boka tid hos närmaste besiktningsstation.',
    deadline: '2026-04-01',
    status: 'pending',
    assignedTo: 'user-chauffeur',
    createdBy: 'user-chef',
    vehicleId: 'v2',
  },
];

const mockTimeline: TimelineEntry[] = [
  { type: 'drive', label: 'Körning Stockholm → Norrköping', startTime: '2026-03-10T06:00', endTime: '2026-03-10T08:00', durationMinutes: 120, location: 'E4' },
  { type: 'rest', label: 'Rast', startTime: '2026-03-10T08:00', endTime: '2026-03-10T08:45', durationMinutes: 45, location: 'Rasta Nyköping' },
  { type: 'stop', label: 'Lossning i Norrköping', startTime: '2026-03-10T09:30', endTime: '2026-03-10T10:00', durationMinutes: 30, location: 'Norrköping' },
  { type: 'drive', label: 'Körning Norrköping → Jönköping', startTime: '2026-03-10T10:00', endTime: '2026-03-10T12:30', durationMinutes: 150, location: 'E4/Rv40' },
  { type: 'rest', label: 'Rast', startTime: '2026-03-10T12:30', endTime: '2026-03-10T13:15', durationMinutes: 45, location: 'Rasta Gränna' },
  { type: 'drive', label: 'Körning Jönköping → Göteborg', startTime: '2026-03-10T13:15', endTime: '2026-03-10T16:15', durationMinutes: 180, location: 'Rv40' },
  { type: 'arrival', label: 'Ankomst Göteborg', startTime: '2026-03-10T16:15', endTime: '2026-03-10T16:15', durationMinutes: 0, location: 'Göteborg' },
];

export const mockTrips: Trip[] = [
  {
    id: 'trip1',
    startLocation: 'Stockholm',
    endLocation: 'Göteborg',
    waypoints: ['Norrköping'],
    vehicleId: 'v1',
    driverId: 'user-chauffeur',
    totalWeightKg: 35000,
    loadWeightKg: 20000,
    routeType: 'normal',
    startTime: '2026-03-10T06:00',
    totalDistanceKm: 470,
    totalDriveTimeH: 7.5,
    timeline: mockTimeline,
    createdAt: '2026-03-08',
  },
];

export const mockReminders: Reminder[] = [
  {
    id: 'rem1',
    type: 'inspection',
    title: 'Besiktning – Scania R500',
    message: 'DEF 456 ska besiktigas senast 2025-04-20',
    dueDate: '2025-04-20',
    relatedType: 'vehicle',
    relatedId: 'v2',
    status: 'active',
  },
  {
    id: 'rem2',
    type: 'tax',
    title: 'Fordonsskatt – Volvo FH16',
    message: 'ABC 123 skatt ska betalas senast 2025-03-15',
    dueDate: '2025-03-15',
    relatedType: 'vehicle',
    relatedId: 'v1',
    status: 'active',
  },
  {
    id: 'rem3',
    type: 'ykb',
    title: 'YKB – Erik Johansson',
    message: 'YKB-bevis går ut 2026-09-01',
    dueDate: '2026-09-01',
    relatedType: 'user',
    relatedId: 'user-chauffeur',
    status: 'active',
  },
  {
    id: 'rem4',
    type: 'adr',
    title: 'ADR-intyg – Erik Johansson',
    message: 'ADR-intyg går ut 2026-12-20',
    dueDate: '2026-12-20',
    relatedType: 'user',
    relatedId: 'user-chauffeur',
    status: 'active',
  },
  {
    id: 'rem5',
    type: 'insurance',
    title: 'Försäkring – Scania R500',
    message: 'Försäkringen för DEF 456 går ut 2025-08-15',
    dueDate: '2025-08-15',
    relatedType: 'vehicle',
    relatedId: 'v2',
    status: 'active',
  },
  {
    id: 'rem6',
    type: 'license',
    title: 'Körkort – Erik Johansson',
    message: 'Körkort går ut 2027-03-15',
    dueDate: '2027-03-15',
    relatedType: 'user',
    relatedId: 'user-chauffeur',
    status: 'active',
  },
];

export function getVehicleById(id: string) {
  return mockVehicles.find(v => v.id === id);
}

export function getUserById(id: string) {
  return mockUsers.find(u => u.id === id);
}

export function getDriverForVehicle(vehicleId: string) {
  const vehicle = getVehicleById(vehicleId);
  if (!vehicle?.driverId) return undefined;
  return getUserById(vehicle.driverId);
}

export function getVehiclesForDriver(driverId: string) {
  return mockVehicles.filter(v => v.driverId === driverId);
}

export function getRemindersForVehicle(vehicleId: string) {
  return mockReminders.filter(r => r.relatedType === 'vehicle' && r.relatedId === vehicleId);
}

export function getDocumentsForVehicle(vehicleId: string) {
  return mockDocuments.filter(d => d.vehicleId === vehicleId);
}

export function getDocumentsForUser(userId: string) {
  return mockDocuments.filter(d => d.userId === userId);
}
