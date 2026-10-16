from pathlib import Path
import json,hashlib,subprocess,datetime,sys
q=Path('/home/aaron/.cache/dungeon-native-qa/hex-04/room-save-committed-journal-j01-20261011');w=Path('/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean');stage=sys.argv[1];assert stage in ('fault','fresh')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
dirs=[p.parent for p in (q/'evidence').glob('*/room-save-committed-'+stage+'-probe.json')];assert len(dirs)==1
d=dirs[0];r=json.loads((d/'result.json').read_text());l=json.loads((d/'process-lifecycle.json').read_text());p=json.loads((d/('room-save-committed-'+stage+'-probe.json')).read_text());b=json.loads((d/'build.json').read_text());inv=json.loads((q/'invocation.json').read_text())
assert r['passed'] and r['errors']==[] and r.get('failure') is None and r.get('shutdownFailure') is None
assert p['outcome']==('actual_native_committed_Room_Save_cleanup_interruption_retained_PASS' if stage=='fault' else 'native_actual_committed_Room_Save_fresh_normal_entry_same_After_and_IDs_PASS')
assert l['exit']['requestedNormalQuit'] and l['exit']['normalExitObserved'] and l['exit']['forcedTerminationPids']==[]
pids=[x['pid'] for x in l['app']['processes']];assert pids and all(not Path('/proc/'+str(pid)).exists() for pid in pids)
props=subprocess.check_output(['systemctl','--user','show',l['unit'],'--property=ActiveState,SubState,MainPID,ExecMainStatus'],text=True);assert all(v in props.splitlines() for v in ('ActiveState=inactive','SubState=dead','MainPID=0','ExecMainStatus=0'))
assert b['sourceRevision']==inv['source'] and not b['dirty']
assert all(sha(w/n)==h and sha(q/'vault/.obsidian/plugins/dungeon-editor'/n)==h for n,h in inv['triplet'].items())
assert all(sha(q/f)==h for f,h in inv['helpers'].items())
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()==inv['source'];assert not subprocess.check_output(['git','status','--porcelain'],cwd=w,text=True).strip()
protected=json.loads((q/'protected-inputs-before.json').read_text());assert len(protected)==inv['protectedFileCount'];assert all(sha(Path(f))==h for f,h in protected.items())
original=json.loads((q/'input-native-hashes.json').read_text());assert len(original)==len(p['afterNativeHashes'])==8;assert all(sha(q/'vault'/f)==h for f,h in p['afterNativeHashes'].items())
originalPath='Atlanten/Gemeinsamer-Testatlas.overworld';dungeonPath='Dungeons/E2E-01-Testdungeon/Karte.dungeon';campaignPath='Kampagnen/SaltMarcher/E2E-01-Atlas-Save.campaign.json'
changed=[f for f in original if original[f]!=p['afterNativeHashes'][f]];assert set(changed)=={dungeonPath,campaignPath}
assert not (q/'vault'/(originalPath+'.draft')).exists();assert json.loads((q/'vault'/dungeonPath).read_text())==p['expectedDungeon']
receipt={'stage':stage,'runnerExit':0,'normalQuit':True,'pidsGone':True,'pids':pids,'unit':l['unit'],'systemdCurrent':props,'rawDirectory':str(d),'resultPassed':True,'beforeNativeHashes':original,'afterNativeHashes':p['afterNativeHashes'],'canonicalChangedPaths':changed,'draftAbsent':True,'helpersUnchanged':True,'allHistoricalFilesUnchanged':True,'foreignCheckoutFilesUnchanged':True,'protectedFileCount':len(protected),'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'fixtureVersion':p['fixtureVersion'],'sourceRevision':inv['source'],'world':p['before']['world'],'spatial':p['before']['spatial'],'dungeon':p['expectedDungeon'],'exactRoomText':p['expectedExactText']}
if stage=='fault':
 j=p['actualJournal'];assert j['state']=='committed' and len(j['writes'])==3 and p['nativeFault']['cleanupFailures']==2
 assert sha(q/'vault'/j['journalPath'])==p['actualJournalSha256']
 for row in j['writes']:assert ((q/'vault'/row['path']).read_text() if (q/'vault'/row['path']).exists() else None)==row['after']
 receipt.update(actualJournal=j,actualJournalSha256=p['actualJournalSha256'],oldMountUnavailable=True,retainedOldRoomExact=True,visibleSaveStatus=p['visibleFailure'],visibleUnavailableReason=p['visibleUnavailableReason'])
else:
 prior=json.loads((q/'fault-after-normal-quit.json').read_text());assert not set(prior['pids']).intersection(pids);assert p['afterNativeHashes']==prior['afterNativeHashes']
 assert not (q/'vault'/prior['actualJournal']['journalPath']).exists();assert p['actualFreshManagedEntry'] and p['journalAbsentAfterNormalEntry'] and p['draftAbsentAfterCommittedSave']
 for k in ['world','spatial','dungeon']:assert p['before'][k]==prior[k]
 receipt.update(sameEightAfterNativeFilesAndIds=True,freshManagedEntry=True,journalAbsent=True,cleanHistory0=True,recoveredBeforeScenario=p['recoveredBeforeScenario'])
target=q/(stage+'-after-normal-quit.json');assert not target.exists();target.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'stage':stage,'run':r['run'],'passed':True,'pidsGone':pids,'normalQuit':True,'source':inv['source'],'historicalBytesPreserved':True,'nativeBoundary':p['outcome']},ensure_ascii=False))
