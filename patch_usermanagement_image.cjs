const fs = require('fs');
let code = fs.readFileSync('src/components/UserManagement.tsx', 'utf-8');

code = code.replace(
  '<img src={user.image} alt="" className="w-10 h-10 rounded-xl object-cover ring-2 ring-transparent group-hover:ring-neutral-200 transition-all" />',
  `{user.image ? (
                        <img src={user.image} alt="" className="w-10 h-10 rounded-xl object-cover ring-2 ring-transparent group-hover:ring-neutral-200 transition-all" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-400 ring-2 ring-transparent group-hover:ring-neutral-200 transition-all">
                          <User size={20} />
                        </div>
                      )}`
);

fs.writeFileSync('src/components/UserManagement.tsx', code);
