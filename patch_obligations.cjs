const fs = require('fs');
let code = fs.readFileSync('src/components/ObligationsAuditModule.tsx', 'utf-8');

code = code.replace(
  "import { ListTodo, CheckSquare, Search, History, CalendarDays, ClipboardCheck, ArrowRight } from 'lucide-react';",
  "import { ListTodo, CheckSquare, Search, History, CalendarDays, ClipboardCheck, ArrowRight, Briefcase, Plus, Trash2 } from 'lucide-react';"
);

code = code.replace(
  "const ROLE_OBLIGATIONS = {",
  "const DEFAULT_ROLE_OBLIGATIONS = {"
);

code = code.replace(
  "export type RoleType = keyof typeof ROLE_OBLIGATIONS;\n\ninterface AuditRecord {",
  "export interface JobRole {\n  id: string;\n  name: string;\n  obligations: string[];\n}\n\ninterface AuditRecord {"
);

code = code.replace(
  "const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');",
  "const [activeTab, setActiveTab] = useState<'new' | 'history' | 'roles'>('new');"
);

code = code.replace(
  "const [audits, setAudits] = useState<AuditRecord[]>([]);\n  const [isLoading, setIsLoading] = useState(true);",
  "const [audits, setAudits] = useState<AuditRecord[]>([]);\n  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);\n  const [isLoading, setIsLoading] = useState(true);"
);

code = code.replace(
  "const [role, setRole] = useState<RoleType | ''>('');",
  "const [role, setRole] = useState<string>('');\n  const [newRoleName, setNewRoleName] = useState('');\n  const [newRoleObligations, setNewRoleObligations] = useState<string[]>(['']);\n  const [isSavingRole, setIsSavingRole] = useState(false);"
);

const fetchFunctionReplacement = `useEffect(() => {
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
  };`;

// replace from `useEffect` to the end of `toggleCheck` (we'll keep toggleCheck)
const regexFetch = /useEffect\(\(\) => \{[\s\S]*?const toggleCheck = \(index: number\) => \{/;
code = code.replace(regexFetch, `${fetchFunctionReplacement}\n\n  const toggleCheck = (index: number) => {`);

// fix handleSubmit
code = code.replace(
  "const selectedUser = users.find(u => u.id === userId);\n    if (!selectedUser) return;\n\n    setIsSubmitting(true);\n\n    const obligations = ROLE_OBLIGATIONS[role].map((desc, i) => ({\n      description: desc,\n      completed: checks[i]\n    }));",
  "const selectedUser = users.find(u => u.id === userId);\n    const selectedJobRole = jobRoles.find(r => r.id === role);\n    if (!selectedUser || !selectedJobRole) return;\n\n    setIsSubmitting(true);\n\n    const obligations = selectedJobRole.obligations.map((desc, i) => ({\n      description: desc,\n      completed: checks[i]\n    }));"
);

code = code.replace(
  "role,\n      obligations,",
  "role: selectedJobRole.name,\n      obligations,"
);

// tabs UI
code = code.replace(
  `<button
              onClick={() => setActiveTab('history')}
              className={\`px-4 py-2 text-sm font-semibold rounded-md transition-colors flex items-center gap-2 \${activeTab === 'history' ? 'bg-teal-50 text-teal-700' : 'text-neutral-500 hover:bg-neutral-100'}\`}
            >
              <History size={16} /> Historial
            </button>`,
  `<button
              onClick={() => setActiveTab('history')}
              className={\`px-4 py-2 text-sm font-semibold rounded-md transition-colors flex items-center gap-2 \${activeTab === 'history' ? 'bg-teal-50 text-teal-700' : 'text-neutral-500 hover:bg-neutral-100'}\`}
            >
              <History size={16} /> Historial
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={\`px-4 py-2 text-sm font-semibold rounded-md transition-colors flex items-center gap-2 \${activeTab === 'roles' ? 'bg-teal-50 text-teal-700' : 'text-neutral-500 hover:bg-neutral-100'}\`}
            >
              <Briefcase size={16} /> Cargos
            </button>`
);

// Form UI role options
code = code.replace(
  "{Object.keys(ROLE_OBLIGATIONS).map(r => (\n                        <option key={r} value={r}>{r}</option>\n                      ))}",
  "{jobRoles.map(r => (\n                        <option key={r.id} value={r.id}>{r.name}</option>\n                      ))}"
);

code = code.replace(
  "{ROLE_OBLIGATIONS[role].map((desc, i) => (",
  "{jobRoles.find(r => r.id === role)?.obligations.map((desc, i) => ("
);

// Add the Roles view
code = code.replace(
  "          </motion.div>\n        ) : (\n          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className=\"space-y-4\">",
  `          </motion.div>
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
                            placeholder={\`Obligación \${idx + 1}\`} 
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
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">`
);

fs.writeFileSync('src/components/ObligationsAuditModule.tsx', code);
