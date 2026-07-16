package src.domain.encounter;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import src.domain.encounter.model.generation.EncounterCandidateProfile;
import src.domain.encounter.model.generation.EncounterRole;
import src.domain.encounter.model.plan.EncounterPlan;
import src.domain.encounter.model.plan.EncounterPlanCreature;
import src.domain.encounter.model.plan.EncounterPlanSummary;
import src.domain.encounter.model.reference.EncounterCreatureCandidateCriteria;
import src.domain.encounter.model.session.PlanOutcome;
import src.domain.encounter.published.GeneratedEncounterImportResult;
import src.domain.encounter.published.GeneratedEncounterImportResult.ImportedEncounterPlan;
import src.domain.encounter.published.GeneratedEncounterImportResult.Status;
import src.domain.encounter.published.ImportGeneratedEncounterPlansCommand;
import src.domain.encounter.published.ImportGeneratedEncounterPlansCommand.GeneratedCreatureBlock;
import src.domain.encounter.published.ImportGeneratedEncounterPlansCommand.GeneratedEncounterDraft;

final class GeneratedEncounterPlanImporter {

    private final EncounterForeignFacts facts;
    private final EncounterPlanGateway plans;

    GeneratedEncounterPlanImporter(EncounterForeignFacts facts, EncounterPlanGateway plans) {
        this.facts = java.util.Objects.requireNonNull(facts, "facts");
        this.plans = java.util.Objects.requireNonNull(plans, "plans");
    }

    GeneratedEncounterImportResult importPlans(ImportGeneratedEncounterPlansCommand command) {
        if (command == null || command.encounters().isEmpty()) {
            return GeneratedEncounterImportResult.unavailable("No generated encounters were supplied.");
        }
        List<ResolvedDraft> resolved = new ArrayList<>();
        List<String> unresolved = new ArrayList<>();
        for (GeneratedEncounterDraft draft : command.encounters()) {
            ResolvedDraft resolution = resolve(command, draft, unresolved);
            if (resolution != null) resolved.add(resolution);
        }
        if (!unresolved.isEmpty()) {
            return new GeneratedEncounterImportResult(
                    Status.UNRESOLVED_CREATURES, List.of(), unresolved,
                    "Not every generated CR slot could be resolved.");
        }
        List<ImportedEncounterPlan> imported = new ArrayList<>();
        for (ResolvedDraft draft : resolved) {
            Optional<EncounterPlan> existing = existingPlan(draft.generatedLabel());
            PlanOutcome outcome = existing.isPresent()
                    ? new PlanOutcome(existing, "Generated encounter already exists.")
                    : plans.savePlan(new EncounterPlan(0L, draft.name(), draft.generatedLabel(), draft.creatures()));
            if (!outcome.success()) {
                return new GeneratedEncounterImportResult(Status.FAILED, imported, List.of(), outcome.message());
            }
            EncounterPlan plan = outcome.plan().orElseThrow();
            imported.add(new ImportedEncounterPlan(draft.encounterNumber(), plan.id(), plan.name()));
        }
        return new GeneratedEncounterImportResult(Status.SUCCESS, imported, List.of(), "Generated encounters imported.");
    }

    private ResolvedDraft resolve(
            ImportGeneratedEncounterPlansCommand command,
            GeneratedEncounterDraft draft,
            List<String> unresolved
    ) {
        int unresolvedBefore = unresolved.size();
        Map<Long, Integer> quantities = new LinkedHashMap<>();
        for (int index = 0; index < draft.blocks().size(); index++) {
            GeneratedCreatureBlock block = draft.blocks().get(index);
            List<EncounterCandidateProfile> candidates = facts.loadCreatureCandidates(
                    new EncounterCreatureCandidateCriteria(List.of(), List.of(), List.of(), block.unitXp(), block.unitXp(), 1000));
            List<EncounterCandidateProfile> exactRole = candidates.stream()
                    .filter(candidate -> roleMatches(block.role(), candidate.role()))
                    .sorted(Comparator.comparingLong(EncounterCandidateProfile::id)).toList();
            List<EncounterCandidateProfile> pool = exactRole.isEmpty()
                    ? candidates.stream().sorted(Comparator.comparingLong(EncounterCandidateProfile::id)).toList()
                    : exactRole;
            if (pool.isEmpty()) {
                unresolved.add("Encounter " + draft.encounterNumber() + ": " + block.quantity()
                        + "x CR " + block.challengeRating() + " (" + block.role() + ")");
                continue;
            }
            int pick = (int) Math.floorMod(
                    command.seed() + draft.encounterNumber() * 719L + (index + 1L) * 1009L, pool.size());
            EncounterCandidateProfile selected = pool.get(pick);
            quantities.merge(selected.id(), block.quantity(), Integer::sum);
        }
        if (unresolved.size() > unresolvedBefore) return null;
        List<EncounterPlanCreature> creatures = quantities.entrySet().stream()
                .map(entry -> new EncounterPlanCreature(entry.getKey(), entry.getValue())).toList();
        String label = generatedLabel(command.generationId(), draft.encounterNumber(), draft.compatibilityLine());
        return new ResolvedDraft(draft.encounterNumber(), draft.name(), label, creatures);
    }

    private Optional<EncounterPlan> existingPlan(String generatedLabel) {
        return plans.listPlans().plans().stream()
                .filter(summary -> generatedLabel.equals(summary.generatedLabel()))
                .map(EncounterPlanSummary::id)
                .findFirst()
                .flatMap(id -> plans.loadPlan(id).plan());
    }

    private static String generatedLabel(long generationId, int encounterNumber, String line) {
        return "sheet-v1 run:" + generationId + " encounter:" + encounterNumber
                + (line.isBlank() ? "" : " · " + line);
    }

    private static boolean roleMatches(String sheetRole, EncounterRole role) {
        return switch (sheetRole) {
            case "Boss" -> role == EncounterRole.BOSS;
            case "Elite" -> role == EncounterRole.ELITE;
            case "Minion" -> role == EncounterRole.MINION;
            case "Standard" -> role == EncounterRole.STANDARD;
            default -> false;
        };
    }

    private record ResolvedDraft(
            int encounterNumber, String name, String generatedLabel, List<EncounterPlanCreature> creatures
    ) {
    }
}
