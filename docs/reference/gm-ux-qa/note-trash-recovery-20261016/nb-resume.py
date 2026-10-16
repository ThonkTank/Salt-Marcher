import runpy
v=runpy.run_path('/tmp/kampagnenwerkstatt-nb-trash-recovery/compare.py',run_name='resume');globals().update(v)
rows=[json.loads(s) for s in (base/'transcript.jsonl').read_text().splitlines()]
original={name:next(r['stdout'] for r in rows if r['command']==['nb','show',name,'--print','--no-color'] and r['exit']==0) for name in ['nera.md','nera-sued.md','siegel.md','torwache.md','wachstube.md','abend-12.md']}
original_id=next(r['stdout'] for r in rows if r['command']==['nb','show','nera.md','--id'] and r['exit']==0)
history=nb('history');blocks=re.split(r'(?=^commit )',history,flags=re.M);created=next(b for b in blocks if re.search(r'^    \[nb\] Add: nera\.md$',b,re.M));commit=re.search(r'^commit ([0-9a-f]{40})',created).group(1)
nb('git','show',commit)
nb('git','restore','--source',commit,'nera.md')
recovered=nb('show','nera.md','--print','--no-color');assert recovered==original['nera.md']
recovered_id=nb('show','nera.md','--id')
for name,value in original.items():assert nb('show',name,'--print','--no-color')==value,name
current=nb('show','aufzug.md','--print','--no-color');assert current.strip()==later.strip();nb('show','abend-12.md','--print','--no-color');nb('show','wachstube.md','--print','--no-color');nb('git','status','--short')
result={'product':'nb','version':'7.25.5','interface':'Public CLI deletion/history/git restore recovery, plus subsequent own browser reading','originalSourceRecoveredAtSameFilename':True,'numericIdBefore':original_id.strip(),'numericIdAfter':recovered_id.strip(),'sameNamedIndependentNoteUnchanged':True,'oldRoomAndSessionLinkFilesUnchanged':True,'laterRootWorkRetained':True,'originalsAndOtherUsageUnchanged':True,'root':current,'history':history,'sourceCreationCommit':commit,'method':'Recover the original file through nb git restore --source at its recorded creation commit. Filename-based links in original room and session retained. nb consumes -- and drops following arguments, so the earlier path-filtered history probe returned the whole notebook log.'}
(base/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('COMPLETE TRASH COUNTERPART VERIFIED')
