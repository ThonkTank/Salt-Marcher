import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, settle, deferred, ok } from '../helpers/session-owners.mjs';

test('a handoff awaiting its visit callback loses authority across a campaign switch', async (t) => {
  const x = fixture(t),
    held = deferred(),
    calls = [];
  x.setHistory([{ sessionMarker: 'end', handoff: 'Originale Übergabe' }]);
  x.callbacks.visit = async (_plan, seed, current) => {
    calls.push({ seed, current });
    await held.promise;
    if (current()) x.calls.push('prepared');
  };
  x.render();
  [...x.document.querySelectorAll('.session-resume-briefing button')]
    .find((button) => button.textContent === 'Einstieg aus Übergabe vorbereiten…')
    .click();
  await settle();
  x.document.getElementById('handoff-visit-form').onsubmit({ preventDefault() {} });
  await settle();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].current(), true);
  x.setOwner({ token: 'other-token', campaign: { id: 'other-campaign' } }, x.v, { plans: [] });
  assert.equal(calls[0].current(), false);
  held.resolve();
  await settle();
  assert.deepEqual(x.calls, []);
  assert.deepEqual(x.messages, []);
  assert.equal(calls[0].seed.notes, 'Originale Übergabe');
});

test('the displayed handoff reuses visit preparation and places it before the displayed opening', async (t) => {
  const x = fixture(t),
    calls = [];
  x.setHistory([
    { id: 'end', sessionMarker: 'end', handoff: 'Nächster Einstieg: Nordtor\n- Frist bleibt' },
  ]);
  Object.assign(x.callbacks, {
    visit: async (plan, seed, current) => {
      if (current()) calls.push({ plan, seed });
    },
  });
  x.render();
  const button = [...x.document.querySelectorAll('.session-resume-briefing button')].find(
    (b) => b.textContent === 'Einstieg aus Übergabe vorbereiten…',
  );
  assert(button);
  button.onclick();
  await settle();
  assert.equal(x.dialog.open, false);
  await submitHandoff(x);
  assert.deepEqual(calls, [
    {
      plan: 'plan-0',
      seed: {
        title: 'Nordtor',
        notes: 'Nächster Einstieg: Nordtor\n- Frist bleibt',
        locationId: null,
        readAloud: '',
        noteIds: [],
        newPlan: false,
        beforeVisitId: 'visit-0',
      },
    },
  ]);
});
test('a detached handoff button cannot prepare a visit after dismissal', async (t) => {
  const x = fixture(t),
    calls = [];
  x.setHistory([{ id: 'end', sessionMarker: 'end', handoff: 'Weiter am Tor' }]);
  Object.assign(x.callbacks, { visit: async (...args) => calls.push(args) });
  x.render();
  const button = [...x.document.querySelectorAll('.session-resume-briefing button')].find(
    (b) => b.textContent === 'Einstieg aus Übergabe vorbereiten…',
  );
  assert(button);
  x.dialog.close();
  button.onclick();
  await settle();
  assert.deepEqual(calls, []);
});

test('handoff preparation retains all 10000 original characters including whitespace and CRLF', async (t) => {
  const x = fixture(t),
    raw = '  Nächster Einstieg: Tor\r\n' + '.'.repeat(9966) + '\r\nENDE  ',
    calls = [];
  assert.equal(raw.length, 10000);
  x.setHistory([{ id: 'end', sessionMarker: 'end', handoff: raw }]);
  Object.assign(x.callbacks, {
    visit: async (_plan, seed, current) => {
      if (current()) calls.push(seed);
    },
  });
  x.render();
  const button = [...x.document.querySelectorAll('.session-resume-briefing button')].find(
    (b) => b.textContent === 'Einstieg aus Übergabe vorbereiten…',
  );
  assert(button);
  button.onclick();
  await settle();
  assert.equal(x.document.getElementById('handoff-visit-notes').value, raw);
  await submitHandoff(x);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].notes, raw);
});

async function submitHandoff(x) {
  x.document.getElementById('handoff-visit-form').onsubmit({ preventDefault() {} });
  await settle();
}

test('the handoff dialog distinguishes an explicit new plan and retains entered read-aloud text', async (t) => {
  const x = fixture(t),
    calls = [];
  x.setHistory([{ sessionMarker: 'end', handoff: 'Weiter am Tor' }]);
  Object.assign(x.callbacks, {
    visit: async (plan, seed, current) => {
      assert(current());
      calls.push({ plan, seed });
    },
  });
  x.render();
  [...x.document.querySelectorAll('.session-resume-briefing button')]
    .find((b) => b.textContent === 'Einstieg aus Übergabe vorbereiten…')
    .click();
  await settle();
  x.document.getElementById('handoff-visit-plan').value = '';
  x.document.getElementById('handoff-visit-read-aloud').value = '  Willkommen\r\n';
  await submitHandoff(x);
  assert.equal(calls[0].plan, null);
  assert.equal(calls[0].seed.newPlan, true);
  assert.equal(calls[0].seed.beforeVisitId, null);
  assert.equal(calls[0].seed.readAloud, '  Willkommen\r\n');
});

test('a handoff review submits once and cancellation revokes its pending context', async (t) => {
  const x = fixture(t),
    calls = [];
  let release;
  const gate = new Promise((r) => (release = r));
  x.setHistory([{ sessionMarker: 'end', handoff: 'Nächster Einstieg: Nordtor' }]);
  Object.assign(x.callbacks, {
    visit: async (planId, seed, current) => {
      calls.push({ planId, seed, current });
      await gate;
    },
  });
  x.render();
  const button = [...x.document.querySelectorAll('#live-session-resume-groups button')].find(
    (b) => b.textContent === 'Einstieg aus Übergabe vorbereiten…',
  );
  button.onclick();
  await settle();
  const form = x.document.getElementById('handoff-visit-form');
  form.onsubmit(new x.window.Event('submit', { cancelable: true }));
  form.onsubmit(new x.window.Event('submit', { cancelable: true }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].current(), true);
  x.document.getElementById('handoff-visit-cancel').onclick();
  assert.equal(calls[0].current(), false);
  release();
  await settle();
  assert.equal(x.document.getElementById('handoff-visit-dialog').open, false);
  assert.ok(!x.messages.some((m) => m.text.includes('vollständiger nächster Besuch vorbereitet')));
});

test('an unlisted recommended plan stays explicit and cannot silently become a new plan', async (t) => {
  const x = fixture(t),
    calls = [];
  x.plans.splice(0, 1);
  x.setHistory([{ sessionMarker: 'end', handoff: 'Weiter am Tor' }]);
  Object.assign(x.callbacks, {
    visit: async (plan, seed, current) => {
      assert(current());
      calls.push({ plan, seed });
    },
  });
  x.render();
  [...x.document.querySelectorAll('.session-resume-briefing button')]
    .find((b) => b.textContent === 'Einstieg aus Übergabe vorbereiten…')
    .click();
  await settle();
  const select = x.document.getElementById('handoff-visit-plan');
  assert.equal(select.value, 'plan-0');
  assert(select.selectedIndex >= 0);
  await submitHandoff(x);
  assert.equal(calls[0].plan, 'plan-0');
  assert.equal(calls[0].seed.newPlan, false);
  assert.equal(calls[0].seed.beforeVisitId, 'visit-0');
});
test('a plan select without any selected option cannot submit a new-plan request', async (t) => {
  const x = fixture(t),
    calls = [];
  x.setHistory([{ sessionMarker: 'end', handoff: 'Weiter' }]);
  Object.assign(x.callbacks, { visit: async () => calls.push('write') });
  x.render();
  [...x.document.querySelectorAll('.session-resume-briefing button')]
    .find((b) => b.textContent === 'Einstieg aus Übergabe vorbereiten…')
    .click();
  await settle();
  x.document.getElementById('handoff-visit-plan').value = 'missing-option';
  await submitHandoff(x);
  assert.deepEqual(calls, []);
  assert.match(x.document.getElementById('handoff-visit-status').textContent, /Zielplan auswählen/);
});
test('a late cancelled submission cannot close or unlock a newer handoff draft', async (t) => {
  const x = fixture(t),
    old = deferred();
  let count = 0;
  x.setHistory([{ sessionMarker: 'end', handoff: 'Erste Übergabe' }]);
  Object.assign(x.callbacks, {
    visit: async () => {
      if (++count === 1) await old.promise;
      else throw new Error('Zweiter Auftrag offen');
    },
  });
  const open = async () => {
    x.render();
    [...x.document.querySelectorAll('.session-resume-briefing button')]
      .find((b) => b.textContent === 'Einstieg aus Übergabe vorbereiten…')
      .click();
    await settle();
  };
  await open();
  x.document.getElementById('handoff-visit-form').onsubmit({ preventDefault() {} });
  await settle();
  x.document.getElementById('handoff-visit-cancel').click();
  x.dialog.showModal();
  x.setHistory([{ sessionMarker: 'end', handoff: 'Zweite Übergabe' }]);
  await open();
  x.document.getElementById('handoff-visit-notes').value = '  Zweiter Text\r\n';
  old.resolve();
  await settle();
  assert.equal(x.document.getElementById('handoff-visit-dialog').open, true);
  assert.equal(x.document.getElementById('handoff-visit-notes').value, '  Zweiter Text\r\n');
  assert.equal(x.document.getElementById('handoff-visit-form').inert, false);
  await submitHandoff(x);
  assert.equal(count, 2);
  assert.match(
    x.document.getElementById('handoff-visit-status').textContent,
    /Zweiter Auftrag offen/,
  );
});
