from pathlib import Path
import json, hashlib, subprocess, datetime, sys
qa=Path('/home/aaron/.cache/dungeon-native-qa/hex-04/room-copy-journal-p01-20261011')
repo=Path('/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean')
stage=sys.argv[1];assert stage in ('fault','fresh')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
dirs=[p.parent for p in (qa/'evidence').glob('*/copy-journal-'+stage+'-probe.json')];assert len(dirs)==1
out=dirs[0];r=json.loads((out/'result.json').read_text());l=json.loads((out/'process-lifecycle.json').read_text());p=json.loads((out/('copy-journal-'+stage+'-probe.json')).read_text());b=json.loads((out/'build.json').read_text());inv=json.loads((qa/'invocation.json').read_text())
assert r['passed'] and r['errors']==[] and r.get('failure') is None and r.get('shutdownFailure') is None
assert p['outcome']==('actual_native_prepared_Copy_interruption_retained_PASS' if stage=='fault' else 'native_actual_prepared_Copy_fresh_visible_Recovery_and_retry_PASS')
assert l['exit']['requestedNormalQuit'] and l['exit']['normalExitObserved'] and l['exit']['forcedTerminationPids']==[]
pids=[x['pid'] for x in l['app']['processes']];assert pids and all(not Path('/proc/'+str(pid)).exists() for pid in pids)
props=subprocess.check_output(['systemctl','--user','show',l['unit'],'--property=ActiveState,SubState,MainPID,ExecMainStatus'],text=True)
assert all(v in props.splitlines() for v in ('ActiveState=inactive','SubState=dead','MainPID=0','ExecMainStatus=0'))
assert b['sourceRevision']==inv['source'] and b['dirty']==False
assert all(sha(repo/n)==h and sha(qa/'vault/.obsidian/plugins/dungeon-editor'/n)==h for n,h in inv['triplet'].items())
assert all(sha(qa/f)==h for f,h in inv['helpers'].items())
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()==inv['source']
assert not subprocess.check_output(['git','status','--porcelain'],cwd=repo,text=True).strip()
protected=json.loads((qa/'protected-inputs-before.json').read_text());assert all(sha(Path(f))==h for f,h in protected.items())
original=json.loads((qa/'input-native-hashes.json').read_text());assert all(sha(qa/'vault'/f)==h for f,h in original.items())
lineage=json.loads((qa/'input-lineage.json').read_text());assert sha(qa/'vault/Atlanten/Gemeinsamer-Testatlas.overworld.draft')==lineage['actualDraftSha256']
receipt={'stage':stage,'runnerExit':0,'normalQuit':True,'pidsGone':True,'pids':pids,'unit':l['unit'],'systemdCurrent':props,'rawDirectory':str(out),'resultPassed':True,'originalNativeHashes':original,'originalDraftSha256':lineage['actualDraftSha256'],'helpersUnchanged':True,'historicalC01C02C03AndR03FilesUnchanged':True,'foreignCheckoutFilesUnchanged':True,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'fixtureVersion':p['fixtureVersion'],'sourceRevision':inv['source']}
if stage=='fault':
 assert p['actualJournal']['state']=='prepared' and len(p['actualJournal']['writes'])==7
 assert p['nativeFault']['createFailures']==1 and p['nativeFault']['rollbackFailures']==1 and len(p['nativeFault']['created'])==1
 for f,h in p['partialNativeHashes'].items():assert (sha(qa/'vault'/f) if (qa/'vault'/f).exists() else None)==h
 receipt.update(partialNativeHashes=p['partialNativeHashes'],actualJournal=p['actualJournal'],actualJournalSha256=p['actualJournalSha256'])
else:
 prior=json.loads((qa/'fault-after-normal-quit.json').read_text());assert not set(prior['pids']).intersection(pids)
 assert len(p['copyNativeHashes'])==7 and p['copyNative']['closure']['localIdsRemapped']==23
 assert all(sha(qa/'vault'/f)==h for f,h in p['copyNativeHashes'].items())
 assert not (qa/'vault'/p['copyPath']).with_suffix('.overworld.journal').exists()
 # The successful visible retry intentionally reuses only the root filename.
 # The GUI-stage oracle proved all seven targets absent before retry.
 assert all(not (qa/'vault'/row['path']).exists() for row in prior['actualJournal']['writes'] if row['path']!=p['copyPath'])
 old_root=next(row for row in prior['actualJournal']['writes'] if row['path']==p['copyPath'])
 assert json.loads(old_root['after'])['id']!=p['copyNative']['world']['id']
 assert p['preparedTargetsRolledBack']==[row['path'] for row in prior['actualJournal']['writes']]
 assert p['preRecoveryJournalSha256']==prior['actualJournalSha256']
 receipt.update(copyNativeHashes=p['copyNativeHashes'],rolledBackTargets=p['preparedTargetsRolledBack'],visibleRecovery=p['visibleRecovery'],fullCurrentWorldAndTypedSpatialAndDungeonExact=True,closedFreshIds=23)
target=qa/(stage+'-after-normal-quit.json');assert not target.exists();target.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'stage':stage,'run':r['run'],'passed':True,'pidsGone':pids,'normalQuit':True,'source':inv['source'],'originalAndHistoricalBytesPreserved':True,'nativeBoundary':p['outcome']},ensure_ascii=False))
