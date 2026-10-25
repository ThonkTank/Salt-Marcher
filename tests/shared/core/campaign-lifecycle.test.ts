import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignContext,
  campaignContextToken,
  campaignId,
  campaignNamespace,
  campaignRevision,
  campaignSnapshot,
} from "../../../src/features/campaign/campaign-contracts";

test("snapshots and contexts reject malformed values and contain no session state", () => {
  const raw = campaignSnapshot({
    schemaVersion: 1,
    campaignId: campaignId("00000000-0000-4000-8000-000000000001"),
    namespace: campaignNamespace("00000000-0000-4000-8000-000000000002"),
    revision: campaignRevision(1),
    name: "Immutable",
    lifecycle: "active",
  });
  const context = campaignContext(raw, campaignContextToken("context:1"));
  assert.equal(Object.isFrozen(context), true);
  assert.equal("liveSession" in context, false);
  assert.throws(() => campaignSnapshot({ ...raw, revision: 0 }), /Revision/);
  assert.throws(() => campaignSnapshot({ ...raw, extra: true }), /Snapshot/);
});
