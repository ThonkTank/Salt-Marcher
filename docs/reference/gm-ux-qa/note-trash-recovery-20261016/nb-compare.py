import os,subprocess,pathlib,json,shlex,re
base=pathlib.Path('/tmp/kampagnenwerkstatt-nb-trash-recovery');exe='/tmp/kampagnenwerkstatt-nb-comparison/vendor/nb'
env=os.environ.copy();env.update(NB_DIR=str(base/'data'),NBRC_PATH=str(base/'nbrc'),GIT_AUTHOR_NAME='GM QA',GIT_AUTHOR_EMAIL='gm-qa@example.invalid',GIT_COMMITTER_NAME='GM QA',GIT_COMMITTER_EMAIL='gm-qa@example.invalid',NO_COLOR='1',PAGER='cat')
def nb(*args,allow_failure=False):
 p=subprocess.run([exe,*args],env=env,cwd=base,capture_output=True,text=True,timeout=30);row=dict(command=['nb',*args],exit=p.returncode,stdout=p.stdout,stderr=p.stderr)
 with(base/'transcript.jsonl').open('a')as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
 print('$ '+shlex.join(['nb',*args]));print(p.stdout,p.stderr,sep='')
 if p.returncode and not allow_failure:raise RuntimeError(p.returncode)
 return p.stdout
link='[[nera.md|Nera]]'
root='# Die Aufzug-Verschwörung\n\nAuftrag: Den Auftraggeber identifizieren.\nQuelle: '+link+'\n\n## Beziehungen\n- Quelle: '+link+'\n- Quelle: [[siegel.md|Das blaue Siegel]]\n'
later=root+'\nSpätere Erkenntnis: Der Auftraggeber kommt über das Nordtor.\n'
if __name__=='__main__':
 nb('--version');nb('init');nb('notebooks','add','Originalquelle-wiederfinden');nb('notebooks','use','Originalquelle-wiederfinden')
 nb('add','nera.md','--title','Nera die Quartiermeisterin','--content','Neras Originalwissen: Die Nachtwache zahlt mit kupfernen Marken.')
 nb('add','nera-sued.md','--title','Nera die Quartiermeisterin','--content','Unabhängige Figur aus der Südstadt. Hat keine Verbindung zur Nachtwache.')
 nb('add','siegel.md','--title','Das blaue Siegel','--content','Offen: Wer führt die Küfergilde?')
 nb('add','aufzug.md','--content',root)
 nb('add','torwache.md','--title','Die Torwache','--content','Andere Verwendung bleibt.\n\n- kennt: '+link)
 nb('add','wachstube.md','--title','Wachstube','--content','Nera erwartet die Gruppe. Den Sold erfragen.\n\n## Kampagnenreferenzen\n'+link)
 nb('add','abend-12.md','--title','Abend 12 · Die Nachtwache','--content','## Nera nach dem Auftraggeber fragen\n\nAlten Besuch erhalten.\n\n[[aufzug.md|Die Aufzug-Verschwörung]]\n'+link+'\n[[siegel.md|Das blaue Siegel]]')
 original={name:nb('show',name,'--print','--no-color')for name in ['nera.md','nera-sued.md','siegel.md','torwache.md','wachstube.md','abend-12.md']}
 original_id=nb('show','nera.md','--id')
 nb('delete','nera.md','--force');nb('edit','aufzug.md','--overwrite','--content',later)
 unavailable=nb('show','nera.md','--print','--no-color',allow_failure=True)
 nb('show','aufzug.md','--print','--no-color');nb('show','abend-12.md','--print','--no-color')
 history=nb('history');file_history=nb('git','log','--','nera.md');commits=re.findall(r'^commit ([0-9a-f]{40})$',file_history,re.M);assert len(commits)==2,commits
 nb('git','show',commits[1]+':nera.md')
 nb('git','checkout',commits[1],'--','nera.md')
 recovered=nb('show','nera.md','--print','--no-color');assert recovered==original['nera.md']
 recovered_id=nb('show','nera.md','--id')
 for name,value in original.items():assert nb('show',name,'--print','--no-color')==value,name
 current=nb('show','aufzug.md','--print','--no-color');assert current.strip()==later.strip();nb('show','abend-12.md','--print','--no-color');nb('show','wachstube.md','--print','--no-color');nb('git','status','--short')
 result={'product':'nb','version':'7.25.5','interface':'Public CLI deletion/history/git checkout recovery, plus subsequent own browser reading','originalSourceRecoveredAtSameFilename':True,'numericIdBefore':original_id.strip(),'numericIdAfter':recovered_id.strip(),'sameNamedIndependentNoteUnchanged':True,'oldRoomAndSessionLinkFilesUnchanged':True,'laterRootWorkRetained':True,'originalsAndOtherUsageUnchanged':True,'root':current,'history':history,'fileHistory':file_history,'method':'Recover the original file through nb git checkout at its recorded creation commit. Retained filename-based links in original room and session.'}
 (base/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('COMPLETE TRASH COUNTERPART VERIFIED')
