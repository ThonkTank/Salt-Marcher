import runpy
v=runpy.run_path('/tmp/kampagnenwerkstatt-nb-source-recovery/compare.py',run_name='resume')
globals().update(v)
original={s:nb('show',s,'--print','--no-color') for s in ['nera.md','siegel.md','torwache.md','zeugin.md','alter-abend.md']}
history=nb('history','aufzug.md');commits=__import__('re').findall(r'^commit ([0-9a-f]{40})$',history,__import__('re').M);assert len(commits)==3,commits
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
