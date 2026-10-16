import os,json,pathlib,subprocess,shlex,re
base=pathlib.Path('/tmp/kampagnenwerkstatt-joplin');exe=str(base/'vendor/node_modules/.bin/joplin');profile=str(base/'map-overlap-profile');env=os.environ.copy();env.update(NO_COLOR='1',TERM='dumb')
def jp(*args):
 p=subprocess.run([exe,'--profile',profile,*args],env=env,capture_output=True,text=True,timeout=60)
 row={'command':['joplin','--profile',profile,*args],'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr}
 with(base/'map-overlap-transcript.jsonl').open('a')as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
 print('$ '+shlex.join(row['command']));print(p.stdout,p.stderr,sep='',flush=True)
 if p.returncode:raise RuntimeError(p.returncode)
 return p.stdout

def link(id,title):return '['+title+'](:/'+id+')'
def links(text):return re.findall(r'\]\(:/([0-9a-f]{32})\)',text)
if __name__=='__main__':
 titles={'nera':'Nera die Quartiermeisterin','clue':'Das blaue Siegel','closed':'Die verlorenen Fässer','irrelevant':'Die Fährmannspur','personal':'Eigene Spielnotiz','mapA':'Die Nachtwache','mapB':'Die Lieferlisten','other':'Andere Verwendung','old':'Abend 01 · Alte Lieferung','plan':'Abend 14 · Die doppelte Spur'}
 jp('version');batch=base/'map-overlap-seed.txt';batch.write_text('\n'.join(['mkbook '+shlex.quote('Zwei Mappen in einem bestehenden Besuch'),'use '+shlex.quote('Zwei Mappen in einem bestehenden Besuch')]+['mknote '+shlex.quote(t)for t in titles.values()])+'\n');jp('batch',str(batch));items=json.loads(jp('ls','--format','json'));ids={k:next(n['id']for n in items if n['title']==title)for k,title in titles.items()};assert len(set(ids.values()))==10
 bodies={'nera':'Nera kennt die Nachtwache am Lastenaufzug.','clue':'Das blaue Siegel gehört dem Auftraggeber.','closed':'Status: Geschlossen\nDiese Fasssuche ist abgeschlossen.','irrelevant':'Diese Spur soll heute nicht verwendet werden.','personal':'Die Gruppe will den Zeugen zuerst allein sprechen.'}
 bodies['mapA']='Die Befragung der Wachen vorbereiten.\n\n## Quellen\n'+'\n'.join(link(ids[k],titles[k])for k in ['nera','clue','closed'])
 bodies['mapB']='Den Siegelbesitzer in den Listen finden.\n\n## Quellen\n'+'\n'.join(link(ids[k],titles[k])for k in ['nera','clue','irrelevant'])
 bodies['other']='Dieser Auftrag bleibt unangetastet.\n\n'+link(ids['nera'],titles['nera'])
 own='  Eigene Besuchsnotizen\r\nbleiben unverändert.\r\n'
 bodies['old']='## Die alte Lieferung prüfen\n'+own+'\n  Bestehende Begrüßung\r\n\n'+link(ids['personal'],titles['personal'])
 first='## Vorher am Kai\n'+own
 target='## Listen und Nachtwache zusammenführen\n'+own+'\n  Bestehende Begrüßung\r\n\n'+link(ids['personal'],titles['personal'])
 bodies['plan']=first+'\n'+target
 for k,body in bodies.items():jp('set',ids[k],'body',body)
 originals={k:jp('cat',id)for k,id in ids.items()}
 initialTargetId=ids['plan'];stages=[]
 for mapkey,chosen in [('mapA',['nera','clue','mapA']),('mapB',['nera','clue','mapB'])]:
  source=jp('cat',ids[mapkey]);assert links(source)==[ids[k]for k in (['nera','clue','closed']if mapkey=='mapA'else ['nera','clue','irrelevant'])]
  # Read actual originals before choosing; closed and deliberately irrelevant source remain out.
  for k in (['nera','clue','closed']if mapkey=='mapA'else ['nera','clue','irrelevant']):jp('cat',ids[k])
  current=jp('cat',initialTargetId);currentBody=current.split('\n\n',1)[1].rstrip('\n');oldIds=links(currentBody);add=[k for k in chosen if ids[k]not in oldIds]
  jp('set',initialTargetId,'body',currentBody+'\n'+'\n'.join(link(ids[k],titles[k])for k in add)+'\n')
  result=jp('cat',initialTargetId);stages.append({'map':mapkey,'targetId':initialTargetId,'addedIds':[ids[k]for k in add],'links':links(result)})
 assert stages[1]['addedIds']==[ids['mapB']]
 newNera=bodies['nera']+' Sie verlangt jetzt eine Kupfermarke für die Auskunft.';jp('set',ids['nera'],'body',newNera)
 fresh=jp('cat',initialTargetId);assert fresh.startswith(titles['plan']+'\n\n');assert first.replace('\r\n','\n')in fresh;assert 'Bestehende Begrüßung'in fresh;linked=links(fresh);assert linked==[ids[k]for k in ['personal','nera','clue','mapA','mapB']];assert len(linked)==len(set(linked))==5
 readings={id:jp('cat',id)for id in linked};assert newNera in readings[ids['nera']];assert ids['closed']not in linked and ids['irrelevant']not in linked
 for k in ids:
  if k not in ['plan','nera']:assert jp('cat',ids[k])==originals[k],k
 assert len(json.loads(jp('ls','--format','json')))==10
 result={'product':'Joplin Terminal','version':'3.7.1','interface':'Actual official public shell-mode CLI, including public batch for initial seed; no graphical UI claim.','ids':ids,'stages':stages,'initialTargetId':initialTargetId,'freshPlan':fresh,'linkedOriginalReadings':readings,'sharedOriginalDeduplicatedManually':True,'originalsOtherUsesAndOldPlanUnchanged':True,'existingVisitSectionsAndPersonalNotePreserved':True,'liveChangedOriginalReadInFreshProcess':True}
 (base/'map-overlap-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('COMPLETE JOPLIN OVERLAPPING MAPS VERIFIED',flush=True)
