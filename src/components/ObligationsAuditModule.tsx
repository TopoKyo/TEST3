import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { firestoreService } from '../lib/firestoreService';
import { toast } from 'sonner';
import { ListTodo, CheckSquare, Search, History, CalendarDays, ClipboardCheck, ArrowRight, Briefcase, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const DEFAULT_ROLE_OBLIGATIONS = {
  'Maestro / Jefe de Cuadrilla': [
    'Revisar asistencia y estado de la cuadrilla al inicio del turno',
    'Distribuir tareas, herramientas y metas del día',
    'Verificar uso de EPP del personal a cargo',
    'Inspeccionar calidad de los trabajos realizados',
    'Reportar avances diarios y problemas en la bitácora'
  ],
  'Obrero / Albañil / Ayudante': [
    'Uso correcto y permanente de EPP (casco, botas, chaleco, lentes)',
    'Mantener limpia, despejada y ordenada su área de trabajo',
    'Cuidar, limpiar y devolver herramientas prestadas de bodega',
    'Cumplir estrictamente con las instrucciones de seguridad',
    'Alcanzar la tarea diaria o metros asignados'
  ],
  'Almacenista / Bodeguero': [
    'Registrar todas las salidas y entradas en sistema/kardex',
    'Mantener la bodega limpia, inventariada y ordenada',
    'Reportar inmediatamente herramientas dañadas o no devueltas',
    'Emitir alertas tempranas de materiales por agotarse',
    'Mantener la bodega con candado/llave cuando no esté presente'
  ],
  'Prevencionista (SST)': [
    'Realizar charla de seguridad de 5 minutos a primera hora',
    'Validar y firmar permisos de trabajo especiales (altura, caliente)',
    'Inspeccionar andamios, arneses y líneas de vida (Checklist SPDC)',
    'Dar rondas constantes corrigiendo actos y condiciones inseguras',
    'Dejar registro fotográfico de incumplimientos graves'
  ],
  'Operador de Maquinaria': [
    'Realizar checklist de pre-uso (niveles de fluidos, frenos, luces)',
    'Respetar límites de velocidad y áreas acordonadas en obra',
    'Mantener la cabina limpia y portar extintor vigente',
    'Aparcar la máquina en el lugar designado al final del turno',
    'Portar su EPP básico siempre que baje de la cabina'
  ]
};

export interface JobRole {
  id: string;
  name: string;
  obligations: string[];
}

interface AuditRecord {
  id?: string;
  userId: string;
  userName: string;
  date: string;
  role: string;
  obligations: { description: string; completed: boolean }[];
  comments: string;
  score: number;
  createdAt: string;
}

export default function ObligationsAuditModule({ users }: { users: User[] }) {
  const [activeTab, setActiveTab] = useState<'new' | 'history' | 'roles'>('new');
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [userId, setUserId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [role, setRole] = useState<string>('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleObligations, setNewRoleObligations] = useState<string[]>(['']);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [checks, setChecks] = useState<boolean[]>([]);
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const auditsData = await firestoreService.getAll<AuditRecord>('obligation_audits');
      setAudits(auditsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

      let rolesData = await firestoreService.getAll<JobRole>('job_roles');
      if (rolesData.length === 0) {
        const seededRoles = [];
        for (const [name, obligations] of Object.entries(DEFAULT_ROLE_OBLIGATIONS)) {
          const newRole = { id: crypto.randomUUID(), name, obligations };
          const added = await firestoreService.add('job_roles', newRole as JobRole);
          seededRoles.push(added);
        }
        rolesData = seededRoles;
      }
      setJobRoles(rolesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = (roleId: string) => {
    setRole(roleId);
    const selectedJobRole = jobRoles.find(r => r.id === roleId);
    if (selectedJobRole) {
      setChecks(new Array(selectedJobRole.obligations.length).fill(false));
    } else {
      setChecks([]);
    }
  };

  const handleSaveRole = async () => {
    if (!newRoleName.trim() || newRoleObligations.some(o => !o.trim())) return;
    setIsSavingRole(true);
    try {
      const newRole = {
        id: crypto.randomUUID(),
        name: newRoleName.trim(),
        obligations: newRoleObligations.map(o => o.trim())
      };
      const added = await firestoreService.add('job_roles', newRole as JobRole);
      setJobRoles([...jobRoles, added]);
      setNewRoleName('');
      setNewRoleObligations(['']);
      toast.success('Cargo creado exitosamente');
    } catch (error) {
      console.error('Error saving role:', error);
      toast.error('Error al crear cargo');
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm('¿Seguro que desea eliminar este cargo?')) return;
    try {
      await firestoreService.delete('job_roles', id);
      setJobRoles(jobRoles.filter(r => r.id !== id));
      if (role === id) {
        setRole('');
        setChecks([]);
      }
      toast.success('Cargo eliminado');
    } catch (e) {
      console.error(e);
      toast.error('Error al eliminar cargo');
    }
  };

  const toggleCheck = (index: number) => {
    const newChecks = [...checks];
    newChecks[index] = !newChecks[index];
    setChecks(newChecks);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !role) {
      toast.error('Por favor seleccione un empleado y su cargo');
      return;
    }

    const selectedUser = users.find(u => u.id === userId);
    const selectedJobRole = jobRoles.find(r => r.id === role);
    if (!selectedUser || !selectedJobRole) return;

    setIsSubmitting(true);

    const obligations = selectedJobRole.obligations.map((desc, i) => ({
      description: desc,
      completed: checks[i]
    }));

    const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    const newAudit: AuditRecord = {
      id: crypto.randomUUID(),
      userId: selectedUser.id,
      userName: selectedUser.name,
      date,
      role: selectedJobRole.name,
      obligations,
      comments: comments.trim(),
      score,
      createdAt: new Date().toISOString()
    };

    try {
      const added = await firestoreService.add('obligation_audits', newAudit as AuditRecord & { id: string });
      setAudits([added, ...audits]);
      
      // Reset form
      setUserId('');
      setRole('');
      setChecks([]);
      setComments('');
      toast.success(`Evaluación guardada. Cumplimiento: ${score}%`);
      setActiveTab('history');
    } catch (error) {
      console.error('Error saving audit:', error);
      toast.error('Error al guardar la evaluación');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 50) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className="flex-1 overflow-auto bg-neutral-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-100 rounded-xl">
              <ListTodo className="text-teal-600" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Fiscalización de Obligaciones</h1>
              <p className="text-neutral-500">Evaluación diaria de cumplimiento por cargo</p>
            </div>
          </div>
          <div className="flex bg-white rounded-lg p-1 border border-neutral-200 shadow-sm">
            <button
              onClick={() => setActiveTab('new')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === 'new' ? 'bg-teal-50 text-teal-700' : 'text-neutral-500 hover:bg-neutral-100'}`}
            >
              Nueva Evaluación
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'bg-teal-50 text-teal-700' : 'text-neutral-500 hover:bg-neutral-100'}`}
            >
              <History size={16} /> Historial
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors flex items-center gap-2 ${activeTab === 'roles' ? 'bg-teal-50 text-teal-700' : 'text-neutral-500 hover:bg-neutral-100'}`}
            >
              <Briefcase size={16} /> Cargos
            </button>
          </div>
        </header>

        {activeTab === 'new' ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Datos del Trabajador</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Fecha de Evaluación</Label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Empleado</Label>
                    <select 
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">Seleccione un empleado...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Cargo / Rol en Obra</Label>
                    <select 
                      value={role}
                      onChange={(e) => handleRoleChange(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">Seleccione el cargo...</option>
                      {jobRoles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>

              {role && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Resumen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-4">
                      <div className="text-4xl font-black text-teal-600 mb-2">
                        {checks.filter(Boolean).length} / {checks.length}
                      </div>
                      <p className="text-sm font-medium text-neutral-500 uppercase tracking-wider">
                        Obligaciones Cumplidas
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="lg:col-span-2">
              {!role ? (
                <div className="bg-white rounded-xl border-2 border-dashed border-neutral-200 p-12 text-center text-neutral-500 h-full flex flex-col items-center justify-center">
                  <ClipboardCheck size={48} className="text-neutral-300 mb-4" />
                  <p className="font-semibold text-lg text-neutral-700">Seleccione un Cargo</p>
                  <p className="text-sm max-w-sm mt-2">La lista de obligaciones diarias se generará automáticamente según el cargo seleccionado.</p>
                </div>
              ) : (
                <Card className="h-full flex flex-col shadow-md border-teal-100">
                  <CardHeader className="bg-teal-50 rounded-t-xl border-b border-teal-100">
                    <CardTitle className="flex items-center gap-2 text-teal-800">
                      <CheckSquare size={20} /> Lista de Verificación Diaria
                    </CardTitle>
                    <CardDescription className="text-teal-600/80">Marque las tareas y obligaciones que el trabajador cumplió hoy.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 overflow-auto">
                    <div className="divide-y divide-neutral-100">
                      {jobRoles.find(r => r.id === role)?.obligations.map((desc, i) => (
                        <label 
                          key={i} 
                          className={`flex items-start gap-4 p-4 cursor-pointer transition-colors hover:bg-neutral-50 ${checks[i] ? 'bg-teal-50/30' : ''}`}
                        >
                          <div className="pt-0.5">
                            <input 
                              type="checkbox"
                              checked={checks[i]}
                              onChange={() => toggleCheck(i)}
                              className="w-5 h-5 rounded border-neutral-300 text-teal-600 focus:ring-teal-500 mt-1 cursor-pointer"
                            />
                          </div>
                          <div className={`flex-1 ${checks[i] ? 'text-teal-900 line-through opacity-70' : 'text-neutral-700'}`}>
                            {desc}
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="p-4 border-t border-neutral-100 bg-neutral-50 space-y-2 mt-auto">
                      <Label>Observaciones adicionales (Opcional)</Label>
                      <Textarea 
                        value={comments} 
                        onChange={e => setComments(e.target.value)}
                        placeholder="Escriba comentarios sobre el desempeño hoy..."
                        className="bg-white resize-none"
                      />
                      <Button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting} 
                        className="w-full mt-4 bg-teal-600 hover:bg-teal-700 text-white font-bold"
                      >
                        {isSubmitting ? 'Guardando...' : 'Guardar Evaluación de Cumplimiento'}
                        <ArrowRight size={16} className="ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </motion.div>
        ) : activeTab === 'roles' ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Nuevo Cargo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nombre del Cargo</Label>
                    <Input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="Ej: Soldador, Supervisor..." />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex justify-between items-center">
                      Obligaciones
                      <Button type="button" variant="ghost" size="sm" onClick={() => setNewRoleObligations([...newRoleObligations, ''])} className="h-6 px-2 text-xs">
                        <Plus size={14} className="mr-1" /> Añadir
                      </Button>
                    </Label>
                    <div className="space-y-3">
                      {newRoleObligations.map((obs, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Textarea 
                            value={obs} 
                            onChange={e => {
                              const newObs = [...newRoleObligations];
                              newObs[idx] = e.target.value;
                              setNewRoleObligations(newObs);
                            }} 
                            placeholder={`Obligación ${idx + 1}`} 
                            className="resize-none min-h-[60px]"
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="icon" 
                            className="text-red-500 shrink-0 mt-1" 
                            onClick={() => {
                              const newObs = newRoleObligations.filter((_, i) => i !== idx);
                              setNewRoleObligations(newObs.length ? newObs : ['']);
                            }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button 
                    onClick={handleSaveRole} 
                    disabled={isSavingRole || !newRoleName.trim() || newRoleObligations.some(o => !o.trim())} 
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                  >
                    {isSavingRole ? 'Guardando...' : 'Guardar Cargo'}
                  </Button>
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-lg">Cargos Registrados</CardTitle>
                  <CardDescription>Gestione los cargos y sus respectivas obligaciones de cumplimiento</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {jobRoles.length === 0 ? (
                    <div className="text-center p-8 border-2 border-dashed border-neutral-200 rounded-xl">
                      <p className="text-neutral-500">No hay cargos registrados.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {jobRoles.map(r => (
                        <div key={r.id} className="p-4 rounded-xl border border-neutral-200 bg-white shadow-sm flex flex-col">
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="font-bold text-neutral-800 text-base">{r.name}</h3>
                            <Button variant="ghost" size="sm" className="text-red-500 h-8 w-8 p-0 shrink-0 ml-2" onClick={() => handleDeleteRole(r.id)}>
                              <Trash2 size={16} />
                            </Button>
                          </div>
                          <ul className="space-y-2 text-sm text-neutral-600 flex-1">
                            {r.obligations.map((obs, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                                <span>{obs}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-teal-600"></div>
              </div>
            ) : audits.length === 0 ? (
              <div className="text-center p-12 border-2 border-dashed border-neutral-200 rounded-xl bg-white text-neutral-500">
                <ListTodo size={48} className="mx-auto mb-4 text-neutral-300" />
                <p className="font-semibold text-lg text-neutral-700">Sin registros</p>
                <p className="text-sm mt-1">Aún no se han evaluado obligaciones de los trabajadores.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {audits.map(audit => (
                  <Card key={audit.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-neutral-900 line-clamp-1">{audit.userName}</h3>
                          <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-1">
                            <CalendarDays size={12} />
                            {new Date(audit.date).toLocaleDateString()}
                          </div>
                        </div>
                        <span className={cn('px-2.5 py-1 rounded-full text-xs font-bold border', getScoreColor(audit.score))}>
                          {audit.score}%
                        </span>
                      </div>
                      
                      <div className="text-xs font-medium text-teal-700 bg-teal-50 px-2.5 py-1.5 rounded-md inline-block mb-4">
                        {audit.role}
                      </div>
                      
                      <div className="space-y-1.5 mb-4">
                        {audit.obligations.slice(0, 3).map((obl, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            {obl.completed ? (
                              <CheckSquare size={12} className="text-teal-500 shrink-0 mt-0.5" />
                            ) : (
                              <div className="w-3 h-3 rounded-sm border border-neutral-300 shrink-0 mt-0.5 bg-neutral-100" />
                            )}
                            <span className={obl.completed ? 'text-neutral-500 line-through' : 'text-neutral-700 line-clamp-1'}>
                              {obl.description}
                            </span>
                          </div>
                        ))}
                        {audit.obligations.length > 3 && (
                          <div className="text-xs text-neutral-400 pl-5">
                            + {audit.obligations.length - 3} tareas más...
                          </div>
                        )}
                      </div>
                      
                      {audit.comments && (
                        <p className="text-xs text-neutral-600 bg-neutral-50 p-2 rounded border border-neutral-100 italic line-clamp-2">
                          "{audit.comments}"
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
