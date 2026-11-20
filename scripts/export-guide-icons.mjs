// Preserve the exact Lucide vector nodes shipped with the app, without rasterizing.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const names = ['square-pen','grid-2x2','file','library-big','download','glasses',
  'undo-2','redo-2','pen','image','move','trash-2','plus','eye-off','rotate-cw',
  'maximize-2','blend','check','settings-2','mail','printer','eraser','lasso-select','palette','zoom-in','zoom-out','eye'];
const result = {};
for (const name of names) {
  const source = fs.readFileSync(path.join(root,'node_modules/lucide-react-native/dist/esm/icons',`${name}.mjs`),'utf8');
  const match = source.match(/createLucideIcon\("[^"]+",\s*(\[[\s\S]*\])\s*\);/);
  if (!match) throw new Error(`Cannot find original vector nodes: ${name}`);
  result[name] = Function(`"use strict"; return (${match[1]});`)();
}
fs.writeFileSync(path.join(root,'docs/manual/app-icons.json'),JSON.stringify(result,null,2)+'\n');
fs.copyFileSync(path.join(root,'node_modules/lucide-react-native/LICENSE'),path.join(root,'docs/manual/lucide-LICENSE.txt'));
console.log(`Exported ${names.length} original vector icons.`);
