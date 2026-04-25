export interface User {
  id: string;
  name: string;
  faceDescriptor: number[];
  image: string;
}

export type AttendanceType = 'arrival' | 'break_start' | 'break_end' | 'departure';

export const ATTENDANCE_LABELS: Record<AttendanceType, string> = {
  arrival: 'Llegada',
  break_start: 'Inicio de Descanso',
  break_end: 'Fin de Descanso',
  departure: 'Salida'
};

export interface AttendanceLog {
  id: string;
  userId: string;
  userName: string;
  type: AttendanceType;
  timestamp: string;
}

export interface Product {
  id: string;
  name: string;
  category?: string;
  description?: string;
  unit: string;
  lowStockThreshold: number;
  location?: string;
}

export type MovementType = 'entry' | 'exit';

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  type: MovementType;
  quantity: number;
  userId: string;
  userName: string;
  timestamp: string;
  observation?: string;
  reason?: string;
}

export interface WorkLog {
  id: string;
  date: string;
  reportNumber: number;
  project: string;
  client: string;
  residentHead: string;
  workAddress: string;
  dayOfWeek: string;
  processItem: string;
  advancePercentage: number;
  advanceM2: number;
  weather: {
    morningTemp: number;
    afternoonTemp: number;
    avgTemp: number;
    rain: string;
    wind: number;
    affectedWork: boolean;
  };
  personnel: PersonnelEntry[];
  activities: ActivityEntry[];
  safety: SafetyChecklist;
  problems: ProblemEntry[];
  nextDayPlan: PlanEntry[];
  photos?: string[];
}

export interface PersonnelEntry {
  id: string;
  name: string;
  role: string;
  arrivalTime: string;
  departureTime: string;
}

export interface ActivityEntry {
  id: string;
  item: number;
  description: string;
  unit: string;
  planned: number;
  executedToday: number;
  accumulated: number;
  status: 'pendiente' | 'en proceso' | 'listo';
}

export interface SafetyChecklist {
  morningTalk: boolean;
  eppUsage: boolean;
  attendanceReview: boolean;
  taskCoordination: boolean;
  reportCompleted: boolean;
  orderAndCleanliness: boolean;
  correctionsDone: boolean;
  observations: string;
  incidents: string;
}

export interface ProblemEntry {
  id: string;
  number: number;
  description: string;
  impact: string;
  correctiveAction: string;
  responsible: string;
}

export interface PlanEntry {
  id: string;
  number: number;
  activity: string;
  responsible: string;
}
