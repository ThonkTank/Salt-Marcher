from pathlib import Path
import json,hashlib,subprocess,datetime,sys
q=Path('/home/aaron/.cache/dungeon-native-qa/hex-04/room-copy-committed-journal-c01-20261011');w=Path('/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean');stage=sys.argv[1];assert stage in ('fault','fresh')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
dirs=[p.parent for p in (q/'evidence').glob('*/committed-copy-'+stage+'-probe.json')];assert len(dirs)==1
d=dirs[0];r=json.loads((d/'result.json').read_text());l=json.loads((d/'process-lifecycle.json').read_text());p=json.loads((d/('committed-copy-'+stage+'-probe.json')).read_text());b=json.loads((d/'build.json').read_text());inv=json.loads((q/'invocation.json').read_text())
assert r['passed'] and r['errors']==[] and r.get('failure') is None and r.get('shutdownFailure') is None
assert p['outcome']==('actual_native_committed_Copy_cleanup_interruption_retained_PASS' if stage=='fault' else 'native_actual_committed_Copy_fresh_visible_Recovery_same_After_and_IDs_PASS')
assert l['exit']['requestedNormalQuit'] and l['exit']['normalExitObserved'] and l['exit']['forcedTerminationPids']==[]
pids=[x['pid'] for x in l['app']['processes']];assert pids and all(not Path('/proc/'+str(pid)).exists() for pid in pids)
props=subprocess.check_output(['systemctl','--user','show',l['unit'],'--property=ActiveState,SubState,MainPID,ExecMainStatus'],text=True);assert all(v in props.splitlines() for v in ('ActiveState=inactive','SubState=dead','MainPID=0','ExecMainStatus=0'))
assert b['sourceRevision']==inv['source'] and not b['dirty']
assert all(sha(w/n)==h and sha(q/'vault/.obsidian/plugins/dungeon-editor'/n)==h for n,h in inv['triplet'].items())
assert all(sha(q/f)==h for f,h in inv['helpers'].items())
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()==inv['source'];assert not subprocess.check_output(['git','status','--porcelain'],cwd=w,text=True).strip()
protected=json.loads((q/'protected-inputs-before.json').read_text());assert all(sha(Path(f))==h for f,h in protected.items())
original=json.loads((q/'input-native-hashes.json').read_text());assert all(sha(q/'vault'/f)==h for f,h in original.items());lineage=json.loads((q/'input-lineage.json').read_text());assert sha(q/'vault/Atlanten/Gemeinsamer-Testatlas.overworld.draft')==lineage['actualDraftSha256']
assert len(p['copyNativeHashes'])==7 and all(sha(q/'vault'/f)==h for f,h in p['copyNativeHashes'].items());assert p['copyNative']['closure']['localIdsRemapped']==23
receipt={'stage':stage,'runnerExit':0,'normalQuit':True,'pidsGone':True,'pids':pids,'unit':l['unit'],'systemdCurrent':props,'rawDirectory':str(d),'resultPassed':True,'originalNativeHashes':original,'originalDraftSha256':lineage['actualDraftSha256'],'copyNativeHashes':p['copyNativeHashes'],'helpersUnchanged':True,'allHistoricalC01C02C03R03P01FilesUnchanged':True,'foreignCheckoutFilesUnchanged':True,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'fixtureVersion':p['fixtureVersion'],'sourceRevision':inv['source']}
if stage=='fault':
 assert p['actualJournal']['state']=='committed' and len(p['actualJournal']['writes'])==7 and p['nativeFault']['cleanupFailures']==2
 assert sha(q/'vault'/p['actualJournal']['journalPath'])==p['actualJournalSha256']
 for row in p['actualJournal']['writes']:assert (q/'vault'/row['path']).read_text()==row['after'] and row['before'] is None
 receipt.update(actualJournal=p['actualJournal'],actualJournalSha256=p['actualJournalSha256'])
else:
 prior=json.loads((q/'fault-after-normal-quit.json').read_text());assert not set(prior['pids']).intersection(pids)
 assert prior['copyNativeHashes']==p['copyNativeHashes'] and p['preRecoveryJournalSha256']==prior['actualJournalSha256']
 assert not (q/'vault'/prior['actualJournal']['journalPath']).exists()
 assert p['recoveredByVisibleModal'] and p['sameCopyWorldAndOwnerIds'] and p['sevenCommittedAfterFilesPreserved'] and not p['copyRetried']
 receipt.update(sameSevenAfterFilesAndIds=True,fullCurrentWorldAndTypedSpatialAndDungeonExact=True,closedFreshIds=23,recoveredByVisibleModal=True,copyRetried=False)
target=q/(stage+'-after-normal-quit.json');assert not target.exists();target.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'stage':stage,'run':r['run'],'passed':True,'pidsGone':pids,'normalQuit':True,'source':inv['source'],'originalAndHistoricalBytesPreserved':True,'nativeBoundary':p['outcome']},ensure_ascii=False))
