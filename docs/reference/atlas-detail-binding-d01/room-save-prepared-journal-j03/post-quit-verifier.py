from pathlib import Path
import json, hashlib, subprocess, datetime, sys

q = Path('/home/aaron/.cache/dungeon-native-qa/hex-04/room-save-prepared-journal-j03-20261011')
w = Path('/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean')
stage = sys.argv[1]
assert stage in ('fault', 'fresh')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
dirs = [p.parent for p in (q / 'evidence').glob('*/room-save-prepared-' + stage + '-probe.json')]
assert len(dirs) == 1
d = dirs[0]
r = json.loads((d / 'result.json').read_text())
l = json.loads((d / 'process-lifecycle.json').read_text())
p = json.loads((d / ('room-save-prepared-' + stage + '-probe.json')).read_text())
b = json.loads((d / 'build.json').read_text())
inv = json.loads((q / 'invocation.json').read_text())
lineage = json.loads((q / 'input-lineage.json').read_text())
assert r['passed'] and r['errors'] == [] and r.get('failure') is None and r.get('shutdownFailure') is None
assert p['outcome'] == ('actual_native_prepared_Room_Save_partial_After_retained_PASS' if stage == 'fault' else 'native_actual_prepared_Room_Save_fresh_Before_and_unsaved_Draft_PASS')
assert l['exit']['requestedNormalQuit'] and l['exit']['normalExitObserved'] and l['exit']['forcedTerminationPids'] == []
pids = [x['pid'] for x in l['app']['processes']]
assert pids and all(not Path('/proc/' + str(pid)).exists() for pid in pids)
props = subprocess.check_output(['systemctl', '--user', 'show', l['unit'], '--property=ActiveState,SubState,MainPID,ExecMainStatus'], text=True)
assert all(v in props.splitlines() for v in ('ActiveState=inactive', 'SubState=dead', 'MainPID=0', 'ExecMainStatus=0'))
assert b['sourceRevision'] == inv['source'] and not b['dirty']
assert all(sha(w / n) == h and sha(q / 'vault/.obsidian/plugins/dungeon-editor' / n) == h for n, h in inv['triplet'].items())
assert all(sha(q / f) == h for f, h in inv['helpers'].items())
assert sha(Path(__file__)) == inv['postQuitVerifierSha256']
assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=w, text=True).strip() == inv['source']
assert not subprocess.check_output(['git', 'status', '--porcelain'], cwd=w, text=True).strip()
protected = json.loads((q / 'protected-inputs-before.json').read_text())
assert len(protected) == inv['protectedFileCount']
assert all(sha(Path(f)) == h for f, h in protected.items())
original = json.loads((q / 'input-native-hashes.json').read_text())
assert len(original) == len(p['afterNativeHashes']) == 8
assert p['finalNativeHashes'] == p['afterNativeHashes']
assert all(sha(q / 'vault' / f) == h for f, h in p['afterNativeHashes'].items())
originalPath = 'Atlanten/Gemeinsamer-Testatlas.overworld'
dungeonPath = 'Dungeons/E2E-01-Testdungeon/Karte.dungeon'
campaignPath = 'Kampagnen/SaltMarcher/E2E-01-Atlas-Save.campaign.json'
draftPath = originalPath + '.draft'
changed = [f for f in original if original[f] != p['afterNativeHashes'][f]]
assert sha(q / 'vault' / draftPath) == lineage['actualDraftSha256']
assert p['before']['dirty'] and p['before']['draft']
assert p['before']['depth'] == 0 and not p['before']['canRedo'] and not p['before']['pending']
room = next(e for e in p['expectedDungeon']['entities'] if e['id'] == '00000000-0000-4000-8000-000000000031')
assert room['key']['sections'][0]['markdown'] == p['expectedExactText']
receipt = {
    'stage': stage, 'runnerExit': 0, 'normalQuit': True, 'pidsGone': True, 'pids': pids,
    'unit': l['unit'], 'systemdCurrent': props, 'rawDirectory': str(d), 'resultPassed': True,
    'beforeNativeHashes': original, 'afterNativeHashes': p['afterNativeHashes'],
    'canonicalChangedPaths': changed, 'originalDraftByteExact': True,
    'originalDraftSha256': lineage['actualDraftSha256'], 'helpersUnchanged': True,
    'allHistoricalFilesUnchanged': True, 'foreignCheckoutFilesUnchanged': True,
    'protectedFileCount': len(protected), 'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'fixtureVersion': p['fixtureVersion'], 'sourceRevision': inv['source'],
    'world': p['before']['world'], 'spatial': p['before']['spatial'], 'dungeon': p['expectedDungeon'],
    'exactRoomText': p['expectedExactText']
}
if stage == 'fault':
    assert changed == [dungeonPath]
    assert p['visibleFailure'] == 'Entwurf erhalten; Bearbeitung angehalten.' and p['retainedStatusVisibleInSeparateImage']
    assert p['visibleRetainedName'] == room['name'] and p['visibleRetainedNumber'] == room['number']
    assert p['visibleRetainedExactMarkdown'] == p['expectedExactText']
    j = p['actualJournal']
    assert j['state'] == 'prepared' and len(j['writes']) == 3
    assert [row['path'] for row in j['writes']] == [dungeonPath, draftPath, campaignPath]
    assert p['nativeFault']['draftDeleteFailures'] == 1 and p['nativeFault']['rollbackFailures'] >= 1
    assert sha(q / 'vault' / j['journalPath']) == p['actualJournalSha256']
    assert sha(d / 'actual-prepared-room-save-journal.json') == p['actualJournalSha256']
    for row in j['writes']:
        target = q / 'vault' / row['path']
        actual = target.read_text() if target.exists() else None
        assert actual == (row['after'] if row['path'] == dungeonPath else row['before'])
    assert json.loads((q / 'vault' / dungeonPath).read_text()) == p['expectedDungeon']
    assert p['afterFault']['kind'] == 'unavailable' and not p['afterFault']['currentManaged'] and not p['afterFault']['currentRepository']
    for key in ['camera', 'world', 'spatial', 'dungeon', 'depth', 'canRedo', 'dirty', 'draft', 'pending', 'oneRetainedRepository', 'oneRetainedHistory']:
        assert p['afterFault'][key] == p['before'][key]
    receipt.update(actualJournal=j, actualJournalSha256=p['actualJournalSha256'], oldMountUnavailable=True, retainedOldRoomExact=True, visibleSaveStatus=p['visibleFailure'], visibleUnavailableReason=p['visibleUnavailableReason'])
else:
    prior = json.loads((q / 'fault-after-normal-quit.json').read_text())
    assert not set(prior['pids']).intersection(pids)
    assert changed == [] and p['afterNativeHashes'] == original
    assert not (q / 'vault' / prior['actualJournal']['journalPath']).exists()
    assert p['actualFreshManagedEntry'] and p['journalAbsentAfterNormalEntry'] and p['originalDraftRetainedAfterRollback']
    assert p['originalDraftSha256'] == lineage['actualDraftSha256']
    assert p['before']['kind'] == 'active' and p['before']['currentManaged'] and p['before']['currentRepository'] and p['before']['currentHistory'] and p['before']['currentRenderer']
    assert p['visibleName'] == room['name'] and p['visibleNumber'] == room['number'] and p['visibleExactMarkdown'] == p['expectedExactText']
    for key in ['world', 'spatial', 'dungeon']:
        assert p['before'][key] == prior[key]
    assert json.loads((q / 'vault' / dungeonPath).read_text()) != p['expectedDungeon']
    receipt.update(sameEightOriginalNativeFilesAndIds=True, freshManagedEntry=True, journalAbsent=True, unsavedDraftWithHistory0=True, dirty=True, hasDraft=True, recoveredBeforeScenario=p['recoveredBeforeScenario'])
target = q / (stage + '-after-normal-quit.json')
assert not target.exists()
target.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'stage': stage, 'run': r['run'], 'passed': True, 'pidsGone': pids, 'normalQuit': True, 'source': inv['source'], 'historicalBytesPreserved': True, 'nativeBoundary': p['outcome']}, ensure_ascii=False))
