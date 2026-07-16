package features.encounter.application;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.jspecify.annotations.Nullable;
import platform.execution.ExecutionLane;
import features.encounter.api.GeneratedEncounterPlanImportApi;
import features.encounter.api.GeneratedEncounterPlanImportCommand;
import features.encounter.api.GeneratedEncounterPlanImportResult;
import features.encounter.api.GeneratedEncounterPlanRole;
import features.encounter.api.GeneratedEncounterPlanSlotSpec;
import features.encounter.api.GeneratedEncounterPlanSpec;
import features.encounter.domain.generation.EncounterCandidateProfile;
import features.encounter.domain.generation.EncounterRole;
import features.encounter.domain.plan.EncounterPlanCreature;

public final class GeneratedEncounterPlanImportService implements GeneratedEncounterPlanImportApi {

    private final GeneratedEncounterPlanCandidateSource candidates;
    private final GeneratedEncounterPlanBatchRepository plans;
    private final ExecutionLane executionLane;

    public GeneratedEncounterPlanImportService(
            GeneratedEncounterPlanCandidateSource candidates,
            GeneratedEncounterPlanBatchRepository plans,
            ExecutionLane executionLane
    ) {
        this.candidates = java.util.Objects.requireNonNull(candidates, "candidates");
        this.plans = java.util.Objects.requireNonNull(plans, "plans");
        this.executionLane = java.util.Objects.requireNonNull(executionLane, "executionLane");
    }

    @Override
    public CompletionStage<GeneratedEncounterPlanImportResult> importGeneratedPlans(
            GeneratedEncounterPlanImportCommand command
    ) {
        CompletableFuture<GeneratedEncounterPlanImportResult> result = new CompletableFuture<>();
        try {
            executionLane.execute(() -> completeImport(result, command));
        } catch (RuntimeException exception) {
            result.complete(GeneratedEncounterPlanImportResult.storageFailure());
        }
        return result;
    }

    private void completeImport(
            CompletableFuture<GeneratedEncounterPlanImportResult> result,
            GeneratedEncounterPlanImportCommand command
    ) {
        try {
            result.complete(importOnLane(command));
        } catch (RuntimeException exception) {
            result.complete(GeneratedEncounterPlanImportResult.storageFailure());
        }
    }

    private GeneratedEncounterPlanImportResult importOnLane(GeneratedEncounterPlanImportCommand command) {
        String invalidMessage = invalidMessage(command);
        if (!invalidMessage.isEmpty()) {
            return GeneratedEncounterPlanImportResult.invalidRequest(invalidMessage);
        }
        try {
            return importWithMappings(command);
        } catch (IllegalStateException exception) {
            return GeneratedEncounterPlanImportResult.storageFailure();
        }
    }

    private GeneratedEncounterPlanImportResult importWithMappings(GeneratedEncounterPlanImportCommand command) {
        List<PreparedSpec> prepared = command.encounters().stream()
                .map(GeneratedEncounterPlanImportService::prepare)
                .toList();
        String batchFingerprint = batchFingerprint(prepared);
        Optional<GeneratedEncounterPlanBatchRepository.StoredBatch> existing =
                plans.loadGeneratedBatch(command.source());
        if (existing.isPresent()) {
            return retryResult(batchFingerprint, prepared, existing.orElseThrow());
        }
        List<GeneratedEncounterPlanBatchRepository.ResolvedPlan> resolved = resolve(prepared);
        if (resolved.size() != prepared.size()) {
            return GeneratedEncounterPlanImportResult.unresolvable(
                    "Every generated encounter slot must have an exact-XP creature candidate.");
        }
        GeneratedEncounterPlanBatchRepository.StoredBatch stored = plans.saveGeneratedBatch(
                command.source(),
                batchFingerprint,
                resolved);
        requireMatchingBatch(batchFingerprint, prepared, stored);
        return GeneratedEncounterPlanImportResult.success(toImportedPlans(stored.mappings()));
    }

    private static GeneratedEncounterPlanImportResult retryResult(
            String batchFingerprint,
            List<PreparedSpec> prepared,
            GeneratedEncounterPlanBatchRepository.StoredBatch existing
    ) {
        if (!matches(batchFingerprint, prepared, existing)) {
            return GeneratedEncounterPlanImportResult.invalidRequest(
                    "Generated encounter retry does not match one complete stored batch.");
        }
        return GeneratedEncounterPlanImportResult.success(toImportedPlans(existing.mappings()));
    }

    private List<GeneratedEncounterPlanBatchRepository.ResolvedPlan> resolve(
            List<PreparedSpec> encounters
    ) {
        Map<Long, List<EncounterCandidateProfile>> candidatesByXp = new LinkedHashMap<>();
        List<GeneratedEncounterPlanBatchRepository.ResolvedPlan> resolved = new ArrayList<>();
        for (PreparedSpec prepared : encounters) {
            GeneratedEncounterPlanSpec encounter = prepared.spec();
            List<EncounterPlanCreature> creatures = resolveSlots(encounter.slots(), candidatesByXp);
            if (creatures.size() != encounter.slots().size()) {
                return List.of();
            }
            resolved.add(new GeneratedEncounterPlanBatchRepository.ResolvedPlan(
                    encounter.encounterNumber(),
                    encounter.displayLabel(),
                    prepared.fingerprint(),
                    aggregateCreatures(creatures)));
        }
        return List.copyOf(resolved);
    }

    private List<EncounterPlanCreature> resolveSlots(
            List<GeneratedEncounterPlanSlotSpec> slots,
            Map<Long, List<EncounterCandidateProfile>> candidatesByXp
    ) {
        List<EncounterPlanCreature> resolved = new ArrayList<>();
        for (GeneratedEncounterPlanSlotSpec slot : slots) {
            List<EncounterCandidateProfile> exactCandidates = candidatesByXp.computeIfAbsent(
                    Long.valueOf(slot.xp()),
                    ignored -> exactCandidates(slot.xp()));
            EncounterCandidateProfile selected = select(exactCandidates, slot.requestedRole());
            if (selected == null) {
                return List.of();
            }
            resolved.add(new EncounterPlanCreature(selected.id(), 1));
        }
        return List.copyOf(resolved);
    }

    private List<EncounterCandidateProfile> exactCandidates(long xp) {
        if (xp > Integer.MAX_VALUE) {
            return List.of();
        }
        List<EncounterCandidateProfile> loaded = candidates.loadExactXpCandidates((int) xp);
        if (loaded == null) {
            return List.of();
        }
        return loaded.stream()
                .filter(candidate -> candidate != null && candidate.id() > 0 && candidate.xp() == xp)
                .toList();
    }

    private static EncounterCandidateProfile select(
            List<EncounterCandidateProfile> candidates,
            GeneratedEncounterPlanRole requestedRole
    ) {
        EncounterRole preferredRole = preferredRole(requestedRole);
        for (EncounterCandidateProfile candidate : candidates) {
            if (preferredRole != null && candidate.role() == preferredRole) {
                return candidate;
            }
        }
        return candidates.isEmpty() ? null : candidates.getFirst();
    }

    private static @Nullable EncounterRole preferredRole(GeneratedEncounterPlanRole requestedRole) {
        return switch (requestedRole) {
            case BOSS -> EncounterRole.BOSS;
            case BRUTE -> EncounterRole.BRUTE;
            case MINION -> EncounterRole.MINION;
            case SKIRMISHER -> EncounterRole.SKIRMISHER;
            case ELITE -> EncounterRole.ELITE;
            case STANDARD -> EncounterRole.STANDARD;
            case SUPPORT -> null;
        };
    }

    private static List<EncounterPlanCreature> aggregateCreatures(List<EncounterPlanCreature> slots) {
        Map<Long, Integer> quantities = new LinkedHashMap<>();
        for (EncounterPlanCreature slot : slots) {
            quantities.merge(Long.valueOf(slot.creatureId()), Integer.valueOf(1), Integer::sum);
        }
        return quantities.entrySet().stream()
                .map(entry -> new EncounterPlanCreature(entry.getKey().longValue(), entry.getValue().intValue()))
                .toList();
    }

    private static String invalidMessage(GeneratedEncounterPlanImportCommand command) {
        if (command == null || command.encounters().isEmpty()) {
            return "At least one generated encounter is required.";
        }
        Set<Integer> encounterNumbers = new LinkedHashSet<>();
        for (GeneratedEncounterPlanSpec encounter : command.encounters()) {
            if (encounter == null || !encounterNumbers.add(Integer.valueOf(encounter.encounterNumber()))) {
                return "Generated encounter numbers must be present and unique within the batch.";
            }
            if (encounter.slots().isEmpty()) {
                return "Every generated encounter needs at least one requested slot.";
            }
        }
        return "";
    }

    private static PreparedSpec prepare(GeneratedEncounterPlanSpec spec) {
        StringBuilder normalized = new StringBuilder().append(spec.encounterNumber());
        for (GeneratedEncounterPlanSlotSpec slot : spec.slots()) {
            normalized.append('|')
                    .append(slot.xp())
                    .append(':')
                    .append(slot.requestedRole().name());
        }
        return new PreparedSpec(spec, sha256(normalized.toString()));
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    private static String batchFingerprint(List<PreparedSpec> prepared) {
        StringBuilder normalized = new StringBuilder().append(prepared.size());
        for (PreparedSpec spec : prepared) {
            normalized.append('|')
                    .append(spec.spec().encounterNumber())
                    .append(':')
                    .append(spec.fingerprint());
        }
        return sha256(normalized.toString());
    }

    private static boolean matches(
            String batchFingerprint,
            List<PreparedSpec> prepared,
            GeneratedEncounterPlanBatchRepository.StoredBatch storedBatch
    ) {
        List<GeneratedEncounterPlanBatchRepository.StoredMapping> mappings = storedBatch.mappings();
        if (!batchFingerprint.equals(storedBatch.batchFingerprint())
                || storedBatch.declaredEncounterCount() != prepared.size()) {
            return false;
        }
        if (prepared.size() != mappings.size()) {
            return false;
        }
        for (int index = 0; index < prepared.size(); index++) {
            PreparedSpec requested = prepared.get(index);
            GeneratedEncounterPlanBatchRepository.StoredMapping stored = mappings.get(index);
            if (requested.spec().encounterNumber() != stored.encounterNumber()
                    || !requested.fingerprint().equals(stored.specFingerprint())) {
                return false;
            }
        }
        return true;
    }

    private static void requireMatchingBatch(
            String batchFingerprint,
            List<PreparedSpec> prepared,
            GeneratedEncounterPlanBatchRepository.StoredBatch storedBatch
    ) {
        if (!matches(batchFingerprint, prepared, storedBatch)) {
            throw new IllegalStateException("Generated encounter import returned an inconsistent mapping batch.");
        }
    }

    private static List<GeneratedEncounterPlanImportResult.ImportedPlan> toImportedPlans(
            List<GeneratedEncounterPlanBatchRepository.StoredMapping> mappings
    ) {
        return mappings.stream()
                .map(mapping -> new GeneratedEncounterPlanImportResult.ImportedPlan(
                        mapping.encounterNumber(),
                        mapping.planId()))
                .toList();
    }

    private record PreparedSpec(GeneratedEncounterPlanSpec spec, String fingerprint) {
    }
}
