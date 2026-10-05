const fs = require("node:fs");
const path = require("node:path");

function createGroupRecord(group, out, build, phase) {
  const allowed = new Set(group.caseIds);
  const records = new Map();
  const add = (caseId, state, observation, evidence = [], gap = null) => {
    if (!allowed.has(caseId)) throw new Error(`${group.id}: unknown case ${caseId}`);
    if (records.has(caseId)) throw new Error(`${group.id}: duplicate result ${caseId}`);
    if (!["pass", "fail", "deviation", "open", "not_applicable"].includes(state))
      throw new Error(`${group.id}: invalid state ${state}`);
    if (state === "open" && !gap)
      throw new Error(`${group.id}: open case ${caseId} needs a gap`);
    if (state === "deviation" && (!observation || !evidence.length || !gap))
      throw new Error(`${group.id}: deviation ${caseId} needs observation, evidence and gap`);
    if (state === "pass" && (!observation || !evidence.length))
      throw new Error(`${group.id}: passed case ${caseId} needs observation and evidence`);
    records.set(caseId, { caseId, state, observation, evidence, gap });
  };
  const finish = () => {
    for (const caseId of group.caseIds)
      if (!records.has(caseId))
        add(caseId, "open", null, [], "Für diesen Pflichtfall wurde in dieser Gruppensitzung noch kein Hostvergleich durchgeführt.");
    const cases = group.caseIds.map((caseId) => records.get(caseId));
    const counts = Object.fromEntries(["pass", "fail", "deviation", "open", "not_applicable"].map((state) =>
      [state, cases.filter((item) => item.state === state).length]));
    const result = {
      schemaVersion: 1,
      groupId: group.id,
      title: group.title,
      phase,
      build,
      complete: counts.fail === 0 && counts.deviation === 0 && counts.open === 0,
      counts,
      cases,
    };
    fs.writeFileSync(path.join(out, "group-cases.json"), JSON.stringify(result, null, 2) + "\n");
    return result;
  };
  return { add, finish };
}

module.exports = { createGroupRecord };
