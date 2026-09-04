const fs = require('fs');
let code = fs.readFileSync('src/components/Scanner.tsx', 'utf-8');

code = code.replace(
  '<img \n                      src={recognizedUser.image} \n                      alt="" \n                      className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white shadow-xl" \n                    />',
  `{recognizedUser.image ? (
                      <img 
                        src={recognizedUser.image} 
                        alt="" 
                        className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white shadow-xl" 
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-white ring-4 ring-white shadow-xl flex items-center justify-center text-primary font-bold text-4xl uppercase">
                        {recognizedUser.name[0]}
                      </div>
                    )}`
);

code = code.replace(
  '<img \n                            src={selectedUser.image} \n                            alt="" \n                            className="w-16 h-16 rounded-xl object-cover border border-neutral-200" \n                          />',
  `{selectedUser.image ? (
                            <img 
                              src={selectedUser.image} 
                              alt="" 
                              className="w-16 h-16 rounded-xl object-cover border border-neutral-200" 
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-500 font-bold text-2xl uppercase">
                              {selectedUser.name[0]}
                            </div>
                          )}`
);

fs.writeFileSync('src/components/Scanner.tsx', code);
