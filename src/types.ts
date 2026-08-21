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
  isEpp?: boolean;
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
  isEppDelivery?: boolean;
  eppSize?: string;
  eppCondition?: string;
}

export interface EPPDelivery {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  recipientId: string;
  recipientName: string;
  deliveredById?: string;
  deliveredByName?: string;
  timestamp: string;
  size?: string;
  condition?: string;
  observation?: string;
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
  generalObservations?: string;
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
  operator?: string;
  operators?: string[];
  tower: string;
  side: 'A' | 'B' | '-';
  status: 'pendiente' | 'en proceso' | 'listo';
  image?: string;
  period: 'morning' | 'afternoon';
}

export interface SafetyTicket {
  id: string;
  number: number;
  type: 'observacion' | 'hallazgo' | 'incidente' | 'condicion_insegura' | 'epp_faltante' | 'felicitacion';
  title: string;
  description: string;
  severity: 'Baja' | 'Media' | 'Alta' | 'Crítica';
  responsible?: string;
  status: 'Abierto' | 'En Proceso' | 'Corregido' | 'Cerrado';
  actionRequired?: string;
  image?: string;
  createdAt?: string;
}

export interface EppAuditedPerson {
  id: string;
  name: string;
  company?: string;
  status: 'cumple' | 'no_cumple' | 'parcial';
  details?: string;
}

export interface EppInspection {
  id: string;
  number: number;
  time?: string;
  sector?: string;
  inspector?: string;
  auditedPeople: EppAuditedPerson[];
  summaryNote?: string;
  image?: string;
  createdAt?: string;
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
  tickets?: SafetyTicket[];
  eppInspections?: EppInspection[];
}

export interface ProblemEntry {
  id: string;
  number: number;
  date: string;
  description: string;
  impact: string;
  correctiveAction: string;
  responsible: string;
  image?: string;
}

export interface PlanEntry {
  id: string;
  number: number;
  activity: string;
  responsible: string;
  tower: string;
  side: 'A' | 'B' | '-';
}

export interface WishListItem {
  id: string;
  item: string;
  category: 'material' | 'herramienta' | 'tarea' | 'otro';
  targetDate: string;
  status: 'pendiente' | 'listo';
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface ProjectContext {
  id: string;
  name: string;
  technicalSpecs: string;
  objectives: string;
  generalDescription: string;
  updatedAt: string;
}

export type SkillCategory = 
  | 'puntualidad'
  | 'trabajo_equipo'
  | 'seguridad_industrial'
  | 'comunicacion'
  | 'iniciativa'
  | 'productividad'
  | 'limpieza_orden';

export const SKILL_LABELS: Record<SkillCategory, string> = {
  puntualidad: 'Puntualidad y Asistencia',
  trabajo_equipo: 'Trabajo en Equipo',
  seguridad_industrial: 'Seguridad Industrial',
  comunicacion: 'Comunicación Efectiva',
  iniciativa: 'Iniciativa y Proactividad',
  productividad: 'Productividad y Calidad',
  limpieza_orden: 'Orden y Limpieza'
};

export interface SkillEvaluation {
  id: string;
  userId: string;
  userName: string;
  supervisorId: string;
  supervisorName: string;
  date: string;
  scores: Record<SkillCategory, number>; // 1-5 scale
  average: number;
  positiveObservations: string;
  negativeObservations: string;
  generalComments: string;
  timestamp: string;
}

export interface WeeklyReportTask {
  id: string;
  name: string;
  date: string;
  responsible: string;
  status: 'pendiente' | 'en proceso' | 'listo' | string;
  priority: 'Baja' | 'Media' | 'Alta';
  observations: string;
  selected: boolean;
  photos?: string[];
  tower?: string;
  side?: string;
}

export interface TowerImpact {
  id: string;
  towerLabel: string;
  side: 'A' | 'B' | 'Ambos' | '-';
  status: 'Intacta' | 'Daños Menores' | 'Daños Severos' | 'Derrumbe';
  comments: string;
  photo?: string;
}

export interface ExceptionalReport {
  id: string;
  date: string;
  eventType: string; // Terremoto, Inundación, etc.
  project: string;
  description: string;
  impactAnalysis: TowerImpact[];
  photos: string[];
  createdAt: string;
  createdBy: string;
}

export interface WeeklyReportIncident {

  id: string;
  description: string;
  date: string;
  impact?: string;
  correctiveAction?: string;
  responsible?: string;
  gravity: 'Baja' | 'Media' | 'Alta' | 'Crítica';
  selected: boolean;
  isManual?: boolean;
  image?: string;
}

export interface WeeklyReport {
  id: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  area: string;
  project: string;
  responsibleName: string;
  createdAt: string;
  createdBy: string;
  status: 'Excelente' | 'Bueno' | 'Regular' | 'Crítico';
  aiSummary?: {
    executiveSummary: string;
    generalProgressAnalysis: string;
    progressPercentage: number;
    recommendations: string[];
    suggestedStatus: 'Excelente' | 'Bueno' | 'Regular' | 'Crítico';
    taskObservations?: Array<{ taskId: string; observation: string }>;
  };
  tasks: WeeklyReportTask[];
  incidents: WeeklyReportIncident[];
  productivityScore: number;
}

export interface ArchFinding {
  id: string;
  element: string;
  location: string;
  description: string;
  state: string;
  deteriorationLevel: string;
  probableCause: string;
  riskLevel: string;
  photo?: string;
  sketch?: string;
  observations: string;
}

export interface ArchPhoto {
  id: string;
  title: string;
  description: string;
  location: string;
  findingId?: string;
  url: string;
}

export interface ArchReport {
  id: string;
  number: string;
  date: string;
  client: string;
  professional: string;
  address: string;
  commune: string;
  region: string;
  role: string;
  propertyType: string;
  use: string;
  approximateYear: string;
  area: string;
  observations: string;
  
  inspectionReasons: string[];
  inspectionReasonPdf?: string;

  inspectionDate: string;
  inspectionTime: string;
  presentProfessionals: string;
  weatherConditions: string;
  inspectedSectors: string;
  inspectionMethod: string;
  limitations: string;

  findings: ArchFinding[];
  photos: ArchPhoto[];
  
  regulations: string[];
  otherRegulation?: string;
  recommendations: string;
  conclusions: string;

  aiContent?: {
    antecedentes: string;
    objetivo: string;
    metodologia: string;
    descripcion: string;
    observaciones: string;
    analisis: string;
    evaluacion: string;
    conclusiones: string;
    recomendaciones: string;
    anexos: string;
  };

  architectSignature?: string;

  civilEngineerName?: string;
  civilEngineerReg?: string;
  civilEngineerSignature?: string;

  riskPrevName?: string;
  riskPrevReg?: string;
  riskPrevSignature?: string;

  status: 'draft' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface IncidentReportPhoto {
  id: string;
  url: string;
  description: string;
}

export interface IncidentReport {
  id: string;
  projectId: string;
  projectName: string;
  date: string;
  time: string;
  reporter: string;
  area: string;
  location: string;
  description: string;
  severity: 'Baja' | 'Media' | 'Alta' | 'Crítica';
  type: 'Seguridad' | 'Calidad' | 'Medio Ambiente' | 'Operacional' | 'Otro';
  immediateAction: string;
  photos: IncidentReportPhoto[];
  status: 'Abierto' | 'En proceso' | 'Resuelto' | 'Cerrado';
  createdAt: string;
  updatedAt: string;
}
