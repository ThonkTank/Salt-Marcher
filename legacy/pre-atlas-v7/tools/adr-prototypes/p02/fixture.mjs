import { commandDigest, SCHEMA_VERSION } from "../contracts/p02-v1/contract.mjs";
import { FIXTURE } from "./store.mjs";

export function request(sequence = 1, expectedRevision = sequence - 1) {
  const command = {
    kind: "rename_campaign_object",
    campaignId: FIXTURE.campaignId,
    objectId: FIXTURE.targetId,
    newName: `Renamed Object ${sequence}`,
    historyFact: `GM renamed the target object in command ${sequence}`,
  };
  return {
    schemaVersion: SCHEMA_VERSION,
    commandId: `p02_command_${String(sequence).padStart(12, "0")}`,
    commandDigest: commandDigest(command),
    expectedRevision,
    command,
  };
}
