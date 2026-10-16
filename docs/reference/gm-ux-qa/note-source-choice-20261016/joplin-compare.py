import os,json,pathlib,subprocess,shlex,re
base=pathlib.Path('/tmp/kampagnenwerkstatt-joplin');exe=str(base/'vendor/node_modules/.bin/joplin');profile=str(base/'source-choice-profile');env=os.environ.copy();env.update(NO_COLOR='1',TERM='dumb')
def jp(*args):
 p=subprocess.run([exe,'--profile',profile,*args],env=env,capture_output=True,text=True,timeout=45)
 row={'command':['joplin','--profile',profile,*args],'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr}
 with(base/'source-choice-transcript.jsonl').open('a')as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
 print('$ '+shlex.join(row['command']));print(p.stdout,p.stderr,sep='',flush=True)
 if p.returncode:raise RuntimeError(p.returncode)
 return p.stdout

def items():
 value=json.loads(jp('ls','--format','json'))
 assert isinstance(value,list),value
 return value

def add(title,body):
 previous={n['id']for n in items()};jp('mknote',title);created=[n for n in items()if n['id']not in previous];assert len(created)==1,created
 id=created[0]['id'];assert re.fullmatch('[0-9a-f]{32}',id),id;jp('set',id,'body',body)
 return id

def link(id,title):return '['+title+'](:/'+id+')'

if __name__=='__main__':
 jp('version');jp('mkbook','Nordtor-Kampagne');jp('use','Nordtor-Kampagne')
 common='Nera verwaltet Listen und verlangt ihren ausstehenden Sold.\r\n'+9*'  Ihr alter Dienst führte sie zwischen Nordtor und Südstadt; die üblichen Gerüchte widersprechen einander.\r\n'
 bodies={'north':common+'\r\nAktueller Einsatz: Nordtor. Sie führt die Nachtwache.\r\nEntscheidender Hinweis: Kupfermarken öffnen den Lastenaufzug.\r\n','south':common+'\r\nAktueller Einsatz: Südstadt. Sie führt das Gildenlager.\r\nSie kennt den Lastenaufzug nicht.\r\n','east':common+'\r\nAktueller Einsatz: Flusshafen. Sie verwaltet die Fähren.\r\nSie kennt den Lastenaufzug nicht.\r\n'}
 ids={name:add('Nera die Quartiermeisterin',body)for name,body in bodies.items()}
 ids['clue']=add('Das blaue Siegel','Die Nachtwache meldet ein blaues Siegel.');ids['irrelevant']=add('Die alte Fährte','Diese Spur soll nicht mit in den neuen Abend.')
 root='Ziel: Den Auftraggeber am Nordtor befragen.\n\n## Quellen\n'+link(ids['clue'],'Das blaue Siegel')+'\n'+link(ids['irrelevant'],'Die alte Fährte')+'\n'
 ids['overview']=add('Die Aufzug-Verschwörung',root);ids['other']=add('Die Südstadt-Lieferung','Andere Verwendung bleibt erhalten.\n\n'+link(ids['south'],'Nera die Quartiermeisterin'));ids['old-evening']=add('Bisheriger Abend','## Das Gildenlager befragen\n\nAlter Plan bleibt.\n\n'+link(ids['other'],'Die Südstadt-Lieferung')+'\n'+link(ids['south'],'Nera die Quartiermeisterin'))
 originals={name:jp('cat',id)for name,id in ids.items()if name!='overview'}
 ids['new-evening']=add('Abend 13 · Die richtige Nera','## Die Nachtwache am Nordtor befragen\n')
 listed=items();candidates=[n for n in listed if n['title']=='Nera die Quartiermeisterin'];assert len(candidates)==3
 inspected=[];chosen=None
 for candidate in candidates:
  shown=jp('cat',candidate['id']);inspected.append({'id':candidate['id'],'text':shown})
  if 'Aktueller Einsatz: Nordtor.'in shown:assert 'Kupfermarken'in shown;chosen=candidate['id'];break
 assert chosen==ids['north']
 linked=root+link(chosen,'Nera die Quartiermeisterin')+'\n';jp('set',ids['overview'],'body',linked)
 evening='## Die Nachtwache am Nordtor befragen\n\n'+link(ids['overview'],'Die Aufzug-Verschwörung')+'\n'+link(ids['clue'],'Das blaue Siegel')+'\n'+link(chosen,'Nera die Quartiermeisterin')+'\n';jp('set',ids['new-evening'],'body',evening)
 # Each command starts a fresh Joplin process; read the prepared evening and follow its actual ID links.
 prepared=jp('cat',ids['new-evening']);targets=re.findall(r'\]\(:/([0-9a-f]{32})\)',prepared);assert set(targets)=={ids['overview'],ids['clue'],chosen},prepared
 read={id:jp('cat',id)for id in targets};assert 'Aktueller Einsatz: Nordtor.'in read[chosen]and 'Kupfermarken'in read[chosen]
 assert 'Aktueller Einsatz: Südstadt.'not in '\n'.join(read.values());assert 'Aktueller Einsatz: Flusshafen.'not in '\n'.join(read.values())
 for name,shown in originals.items():assert jp('cat',ids[name])==shown,name
 final=items();assert len(final)==9;assert {n['id']for n in final}==set(ids.values());jp('cat',ids['overview']);jp('cat',ids['new-evening'])
 result={'product':'Joplin Terminal','version':'3.7.1','interface':'Official public shell commands; CLI reading and writing, no graphical UI claim','ids':ids,'candidateList':candidates,'inspected':inspected,'selectedId':chosen,'preparedEvening':prepared,'linkedReadings':read,'onlyReviewedSameNameSourceLinked':True,'allOriginalsOtherUsesAndOldEveningPreserved':True,'newEveningOriginalLinksReadInFreshProcesses':True,'noDuplicateNotesCreated':True}
 (base/'source-choice-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('COMPLETE JOPLIN SOURCE CHOICE VERIFIED')
