import runpy
v=runpy.run_path('/tmp/kampagnenwerkstatt-nb-source-recovery/compare.py',run_name='resume')
globals().update(v)
original={s:nb('show',s,'--print','--no-color') for s in ['nera.md','siegel.md','torwache.md','zeugin.md','alter-abend.md']}
history=nb('history','aufzug.md')
restored=later.replace('Ein Aushang erwähnt Nera.','Ein Aushang erwähnt '+link+'.').replace('Ein alter Verweis auf Nera','Ein alter Verweis auf '+link).replace('## Beziehungen\n','## Beziehungen\n- Quelle: '+link+'\n- kennt: '+link+'\n')
nb('edit','aufzug.md','--overwrite','--content',restored)
method='nb git revert produced merge conflicts beside later edits; nb git revert --abort reported no revert in progress. Reconstructed only source links through ordinary nb edit from visible history.'
current=nb('show','aufzug.md','--print','--no-color')
assert 'Die Aufzug-Verschwörung · geprüft' in current and 'Ziel: Den Auftraggeber identifizieren.' in current and 'Ein neues Wachssiegel hängt am Brett.' in current and 'Spätere Erkenntnis: Die Lieferung kommt über das Nordtor.' in current
assert current.count(link)==5 and '- Neue Quelle: [[zeugin.md|Die neue Zeugin]]' in current
assert '`'+link+'`' in current
for s,before in original.items():assert nb('show',s,'--print','--no-color')==before,s
nb('add','abend-11.md','--title','Abend 11 · Die neue Zeugin','--content','## Nera und die Lieferung befragen\n\n[[aufzug.md|Die Aufzug-Verschwörung]]\n[[nera.md|Nera]]\n[[siegel.md|Das blaue Siegel]]\n[[zeugin.md|Die neue Zeugin]]')
nb('show','abend-11.md','--print','--no-color');nb('show','aufzug.md','--print','--no-color');nb('git','status','--short')
result={'product':'nb','version':'7.25.5','interface':'Public CLI including nb history/git and ordinary nb edit; browser reading separately','method':method,'originalsAndOldPlanUnchanged':True,'laterTitleFactsAndNewRelationshipRetained':True,'originalSourceLinksRestored':True,'literalExamplePreserved':True,'newSessionPreparedAndRead':True,'root':current,'history':history}
(base/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('COMPLETE RECOVERY COUNTERPART VERIFIED')
