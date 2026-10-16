import os,subprocess,pathlib,json,shlex
base=pathlib.Path('/tmp/kampagnenwerkstatt-nb-source-recovery');script='/tmp/kampagnenwerkstatt-nb-comparison/vendor/nb'
env=os.environ.copy();env.update(NB_DIR=str(base/'data'),NBRC_PATH=str(base/'nbrc'),GIT_AUTHOR_NAME='GM QA',GIT_AUTHOR_EMAIL='gm-qa@example.invalid',GIT_COMMITTER_NAME='GM QA',GIT_COMMITTER_EMAIL='gm-qa@example.invalid',NO_COLOR='1',PAGER='cat')
def nb(*args, allow_failure=False):
 p=subprocess.run([script,*args],env=env,cwd=base,capture_output=True,text=True,timeout=30)
 row=dict(command=['nb',*args],exit=p.returncode,stdout=p.stdout,stderr=p.stderr)
 with (base/'transcript.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
 print('$ '+shlex.join(['nb',*args]));print(p.stdout,p.stderr,sep='')
 if p.returncode and not allow_failure:raise RuntimeError(p.returncode)
 return p.stdout

link='[[nera.md|Nera]]'
root='# Die Aufzug-Verschwörung\n\n## Zum Vorlesen\n  Ein Aushang erwähnt '+link+'.\n\n## GM-Notizen\n  Ziel: Die Übergabe stoppen.\nEin alter Verweis auf '+link+' gehört nicht zu diesem Auftrag.\n\nBeispielcode: `'+link+'` bleibt unverändert.\n\n## Beziehungen\n- Quelle: '+link+'\n- kennt: '+link+'\n- Quelle: [[siegel.md|Das blaue Siegel]]\n'
cleaned=root.replace(link,'Nera',2).replace('- Quelle: '+link+'\n','').replace('- kennt: '+link+'\n','')
later=cleaned.replace('# Die Aufzug-Verschwörung\n','# Die Aufzug-Verschwörung · geprüft\n',1).replace('  Ein Aushang erwähnt Nera.','  Ein Aushang erwähnt Nera.\n\nEin neues Wachssiegel hängt am Brett.').replace('Ziel: Die Übergabe stoppen.','Ziel: Den Auftraggeber identifizieren.').replace('\n## Beziehungen','\nSpätere Erkenntnis: Die Lieferung kommt über das Nordtor.\n\n## Beziehungen')+'- Neue Quelle: [[zeugin.md|Die neue Zeugin]]\n'
if __name__=='__main__':
 nb('--version');nb('init');nb('notebooks','add','Zuordnung-wiederherstellen');nb('notebooks','use','Zuordnung-wiederherstellen')
 nb('add','nera.md','--title','Nera die Quartiermeisterin','--content','Neras Originalwissen: Die Nachtwache zahlt mit kupfernen Marken.')
 nb('add','siegel.md','--title','Das blaue Siegel','--content','Offen: Wer führt die Küfergilde?')
 nb('add','aufzug.md','--content',root)
 nb('add','torwache.md','--title','Die Torwache','--content','Nera wird am Nordtor gebraucht.\n\nQuelle: '+link)
 nb('add','zeugin.md','--title','Die neue Zeugin','--content','Die Lieferung kommt über das Nordtor.')
 nb('add','alter-abend.md','--title','Bisheriger Abend','--content','Alter Plan bleibt.\n\n[[torwache.md|Die Torwache]]\n'+link)
 original={s:nb('show',s,'--print','--no-color') for s in ['nera.md','siegel.md','torwache.md','zeugin.md','alter-abend.md']}
 nb('edit','aufzug.md','--overwrite','--content',cleaned)
 nb('edit','aufzug.md','--overwrite','--content',later)
 # Return after later edits and discover the old source change through the user-facing history.
 history=nb('history','aufzug.md');commits=nb('git','log','--format=%H','--','aufzug.md').splitlines();assert len(commits)==3,commits
 deletion=commits[1];shown=nb('git','show',deletion,'--','aufzug.md');assert '-'+root.splitlines()[3] in shown or '[[nera.md|Nera]]' in shown
 nb('git','revert','--no-edit',deletion,allow_failure=True)
 status=nb('git','status','--short')
 if status.strip():
  conflict=nb('show','aufzug.md','--print','--no-color');assert '<<<<<<<' in conflict
  nb('git','revert','--abort')
  # Author the selective reconstruction using the recovered old text; leave the later title, facts and relationship in place.
  restored=later.replace('Ein Aushang erwähnt Nera.','Ein Aushang erwähnt '+link+'.').replace('Ein alter Verweis auf Nera','Ein alter Verweis auf '+link).replace('## Beziehungen\n','## Beziehungen\n- Quelle: '+link+'\n- kennt: '+link+'\n')
  nb('edit','aufzug.md','--overwrite','--content',restored)
  method='Git revert conflicted with adjacent later edits; aborted, then reconstructed only source links through nb edit using history.'
 else:
  restored=nb('show','aufzug.md','--print','--no-color').strip();method='nb git revert preserved the later changes.'
 current=nb('show','aufzug.md','--print','--no-color')
 assert 'Die Aufzug-Verschwörung · geprüft' in current and 'Ziel: Den Auftraggeber identifizieren.' in current and 'Ein neues Wachssiegel hängt am Brett.' in current and 'Spätere Erkenntnis: Die Lieferung kommt über das Nordtor.' in current
 assert current.count(link)==5 and '- Neue Quelle: [[zeugin.md|Die neue Zeugin]]' in current
 assert '`'+link+'`' in current
 for s,before in original.items():assert nb('show',s,'--print','--no-color')==before,s
 nb('add','abend-11.md','--title','Abend 11 · Die neue Zeugin','--content','## Nera und die Lieferung befragen\n\n[[aufzug.md|Die Aufzug-Verschwörung]]\n[[nera.md|Nera]]\n[[siegel.md|Das blaue Siegel]]\n[[zeugin.md|Die neue Zeugin]]')
 nb('show','abend-11.md','--print','--no-color');nb('show','aufzug.md','--print','--no-color');nb('git','status','--short')
 result={'product':'nb','version':'7.25.5','interface':'Public CLI including nb history/git and ordinary nb edit; browser reading separately','method':method,'originalsAndOldPlanUnchanged':True,'laterTitleFactsAndNewRelationshipRetained':True,'originalSourceLinksRestored':True,'literalExamplePreserved':True,'newSessionPreparedAndRead':True,'root':current,'history':history}
 (base/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('COMPLETE RECOVERY COUNTERPART VERIFIED')
