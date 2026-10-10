import { campaignLocalId } from "../../src/features/campaign/campaign-contracts";
import { ManualPlanner } from "../../src/features/planner/manual-planner";
import { ManualPlannerPanel } from "../../src/ui/manual-planner-panel";

// Deliberately memory-only: no Campaign, filesystem, network or browser storage port.
let nextId = 0;
const planner = new ManualPlanner(
  () => campaignLocalId(`00000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`),
  () => {},
);
planner.create();
const host = document.getElementById("planner");
if (!host) throw new Error("Planer-Testhost fehlt.");
new ManualPlannerPanel(host, planner);
