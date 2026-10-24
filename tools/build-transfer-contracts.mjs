import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

// The compiler supplies structure, never identity semantics. Every open string,
// dictionary and opaque value needs an explicit, reviewed domain declaration.
const input='src/app/transfer/models.ts', output='src/app/transfer/contracts.json', tableOutput='src/app/transfer/tables.json';
const cfg=ts.readConfigFile('tsconfig.json',ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(cfg.config,ts.sys,'.');
const program=ts.createProgram([input],parsed.options),checker=program.getTypeChecker();
const roles={},tables={},used=new Set(),missing={};
function validateRole(role,key){
 const strings=['opaque','external','text','local','shared','mixed','definition','token','history-row'];
 if(typeof role==='string'){if(!strings.includes(role))throw Error('Unknown transfer role '+key+': '+role);return;}
 if(!role||typeof role!=='object'||Array.isArray(role))throw Error('Invalid transfer role '+key);
 let fields;
 if('keep'in role){fields=['keep','otherwise'];if(!Array.isArray(role.keep)||role.keep.some(v=>typeof v!=='string'))throw Error('Invalid fixed values '+key);validateRole(role.otherwise,key);}
 else if('by'in role){fields=['by','cases','otherwise'];if(typeof role.by!=='string'||!role.cases||typeof role.cases!=='object')throw Error('Invalid discriminator '+key);for(const v of Object.values(role.cases))validateRole(v,key);validateRole(role.otherwise,key);}
 else if('fields'in role){fields=['fields','values'];for(const v of Object.values(role.fields))validateRole(v,key);validateRole(role.values,key);}
 else if('json'in role){fields=['json','invalid'];if(typeof role.json!=='string'||role.invalid!=='preserve')throw Error('Invalid embedded JSON '+key);}
 else if('reference'in role){fields=['reference','historical'];if(!['local','shared','mixed'].includes(role.reference)||typeof role.historical!=='string')throw Error('Invalid historical alias '+key);}
 else throw Error('Unknown transfer descriptor '+key);
 if(Object.keys(role).some(k=>!fields.includes(k)))throw Error('Unknown descriptor field '+key);
}
for(const file of fs.readdirSync('src',{recursive:true}).filter(f=>f.endsWith('.transfer.json')).sort()){
 const body=JSON.parse(fs.readFileSync(path.join('src',file),'utf8'));
 const prefix=file==='app/transfer/models.transfer.json'?'':file.replace(/\.transfer\.json$/,'.ts')+'#';
 for(const [field,role]of Object.entries(body.roles??{})){
  const key=prefix+field;if(Object.hasOwn(roles,key))throw Error('Duplicate transfer role '+key);validateRole(role,key);roles[key]=role;
 }
 for(const [table,contract]of Object.entries(body.tables??{})){
  if(Object.hasOwn(tables,table))throw Error('Duplicate table owner '+table);
  if(!fs.existsSync(contract.owner))throw Error('Missing table owner '+table+': '+contract.owner);
  tables[table]=contract;
 }
}
const canonical=JSON.parse(fs.readFileSync('src/app/data-format.json','utf8')).tables;
if(JSON.stringify([...canonical].sort())!==JSON.stringify(Object.keys(tables).sort()))throw Error('Every canonical table needs exactly one transfer owner.');
const nodes=[],seen=new Map(),roots={};
function role(key,kind){used.add(key);if(!Object.hasOwn(roles,key)){missing[key]=kind;return kind==='unknown'?'opaque':'text';}return roles[key];}
function wholeValue(role){return ['opaque','history-row'].includes(role)||typeof role==='object'&&'fields'in role;}
function build(type,location){
 if(type.flags&ts.TypeFlags.Undefined)return {literal:null};
 if(type.flags&ts.TypeFlags.Null)return {literal:null};
 if(type.isStringLiteral()||type.isNumberLiteral())return {literal:type.value};
 if(type.flags&ts.TypeFlags.BooleanLiteral)return {literal:type.intrinsicName==='true'};
 // Branded domain strings are strings too; do not expand String's methods.
 if(type.flags&(ts.TypeFlags.String|ts.TypeFlags.TemplateLiteral)||type.isIntersection()&&type.types.some(t=>t.flags&ts.TypeFlags.String))return {role:role(location,'string')};
 if(type.flags&ts.TypeFlags.Number)return {scalar:'number'};
 if(type.flags&ts.TypeFlags.Boolean)return {scalar:'boolean'};
 if(type.flags&(ts.TypeFlags.Any|ts.TypeFlags.Unknown))return {role:role(location,'unknown')};
 if(type.flags&ts.TypeFlags.Never)return {union:[]};
 if(type.isUnion())return {union:type.types.filter(t=>!(t.flags&ts.TypeFlags.Undefined)).map(t=>build(t,location))};
 if(checker.isArrayType(type)||checker.isTupleType(type))return {array:build(checker.getIndexTypeOfType(type,ts.IndexKind.Number),location+'[]')};
 const symbol=type.getSymbol(),decl=symbol?.declarations?.[0];
 const name=symbol?.getName();
 const own=decl&&name&&!['__type','__object','Array','ReadonlyArray'].includes(name)?path.relative('src',decl.getSourceFile().fileName).replaceAll('\\','/')+'#'+name:location;
 if(Object.hasOwn(roles,own)&&wholeValue(roles[own])){used.add(own);return {role:roles[own]};}
 const cacheKey=own+":"+type.id;
 if(seen.has(cacheKey))return {node:seen.get(cacheKey)};
 const id=nodes.length;seen.set(cacheKey,id);nodes.push(null);
 const fields={};for(const prop of checker.getPropertiesOfType(type)){
  const declaration=prop.valueDeclaration??prop.declarations?.[0];
  
  const child=own+'.'+prop.name;
  if(Object.hasOwn(roles,child)&&wholeValue(roles[child])){used.add(child);fields[prop.name]={role:roles[child]};}
  else fields[prop.name]=build(checker.getTypeOfSymbolAtLocation(prop,declaration??program.getSourceFile(input)),child);
 }
 const index=checker.getIndexTypeOfType(type,ts.IndexKind.String);
 nodes[id]={name:own,fields,...(index?{keys:role(own+'{}','keys'),values:build(index,own+'{}value')}:{} )};
 return {node:id};
}
for(const s of program.getSourceFile(input).statements)if(ts.isTypeAliasDeclaration(s)&&s.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))roots[s.name.text]=build(checker.getTypeAtLocation(s),s.name.text);
for(const [table,contract]of Object.entries(tables))for(const column of Object.values(contract.columns)){
 const rule=column.transfer;if(typeof rule!=='object'||'fixed'in rule)continue;
 for(const model of 'model'in rule?[rule.model]:Object.values(rule.models))if(!Object.hasOwn(roots,model))throw Error('Unknown model '+table+': '+model);
}
if(process.argv.includes('--inventory')){fs.writeFileSync('.build/transfer-role-inventory.json',JSON.stringify(missing,null,2)+'\n');fs.writeFileSync('.build/transfer-used-roles.json',JSON.stringify([...used].sort(),null,2)+'\n');console.log(Object.keys(missing).length+' unclassified slots');process.exit(0);}
if(Object.keys(missing).length)throw Error('Transfer roles missing: '+Object.keys(missing).join(', '));
const unused=Object.keys(roles).filter(key=>!used.has(key));
if(unused.length)throw Error('Stale transfer roles: '+unused.join(', '));
const serialized='{\n "roots": '+JSON.stringify(roots)+',\n "nodes": [\n'+nodes.map(n=>'  '+JSON.stringify(n)).join(',\n')+'\n ]\n}\n';
const tableBytes='{\n'+Object.entries(tables).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>' '+JSON.stringify(k)+': '+JSON.stringify(v)).join(',\n')+'\n}\n';
for(const [file,bytes]of [[output,serialized],[tableOutput,tableBytes]]){
 if(process.argv.includes('--write'))fs.writeFileSync(file,bytes);
 else if(fs.readFileSync(file,'utf8')!==bytes)throw Error('Transfer model changed: '+file+'. Review domain declarations and run node tools/build-transfer-contracts.mjs --write.');
}
console.log('Transfer contracts: '+Object.keys(roots).length+' models, '+nodes.length+' shapes.');
