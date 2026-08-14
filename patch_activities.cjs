const fs = require('fs');
let code = fs.readFileSync('src/components/DailyLog.tsx', 'utf-8');

const morningTarget = `                          {isEditing && (
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 rounded-lg" onClick={() => removeItem('activities', a.id)}>
                                <Trash2 size={14} />
                              </Button>
                            </TableCell>
                          )}`;

const morningReplacement = `                          {isEditing && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500 hover:text-indigo-600 rounded-lg" onClick={() => moveItem('activities', a.id, 'up')}>
                                  <ArrowUp size={14} />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500 hover:text-indigo-600 rounded-lg" onClick={() => moveItem('activities', a.id, 'down')}>
                                  <ArrowDown size={14} />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg shrink-0" onClick={() => removeItem('activities', a.id)}>
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </TableCell>
                          )}`;

code = code.split(morningTarget).join(morningReplacement);

fs.writeFileSync('src/components/DailyLog.tsx', code);
