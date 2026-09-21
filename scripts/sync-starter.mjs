import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=[
 ['skills/prd-maker/SKILL.md','.claude/skills/prd-maker/SKILL.md'],
 ['skills/safe-push/SKILL.md','.claude/skills/safe-push/SKILL.md'],
 ['skills/safe-push/config/ignore-list.json','.claude/skills/safe-push/config/ignore-list.json'],
 ['templates/claude-settings.json','.claude/settings.json'],
 ['templates/gitignore','.gitignore'],
 ['templates/env.example','.env.example'],
];
const check=process.argv.includes('--check');
for(const [source,target] of files){
 const expected=await readFile(resolve(root,source));
 const path=resolve(root,target);
 if(check){
  const actual=await readFile(path);
  if(!actual.equals(expected))throw new Error(`Starter out of sync: ${target}`);
 }else{await mkdir(dirname(path),{recursive:true});await writeFile(path,expected);}
}
console.log(check?'Starter files match their sources.':'Starter files synchronized.');
