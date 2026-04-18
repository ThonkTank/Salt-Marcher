package src.domain.encounter.usecase;

import src.domain.encounter.api.EncounterDifficultyBand;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class EncounterDraftFactory {

    private EncounterDraftFactory() {
    }

    static List<EncounterDraft> createDrafts(EncounterDraftRequest request) {
        List<EncounterCandidateProfile> pool = buildSearchPool(
                request.unlockedProfiles(),
                request.thresholds(),
                request.targetDifficulty());
        return enumerateDrafts(new DraftBuildRequest(
                request.targetDifficulty(),
                request.thresholds(),
                request.partySize(),
                request.lockedProfiles(),
                request.lockedQuantities(),
                pool));
    }

    private static List<EncounterCandidateProfile> buildSearchPool(
            List<EncounterCandidateProfile> unlockedProfiles,
            EncounterDifficultyMath.Thresholds thresholds,
            EncounterDifficultyBand targetDifficulty
    ) {
        int targetXp = EncounterDifficultyTargets.targetAdjustedXp(targetDifficulty, thresholds);
        List<EncounterCandidateProfile> byFit = unlockedProfiles.stream()
                .sorted(Comparator.comparingInt(profile -> profile.componentDistance(targetXp)))
                .limit(24)
                .toList();
        List<EncounterCandidateProfile> byLowXp = unlockedProfiles.stream()
                .sorted(Comparator.comparingInt(EncounterCandidateProfile::xp)
                        .thenComparing(EncounterCandidateProfile::name, String.CASE_INSENSITIVE_ORDER))
                .limit(16)
                .toList();
        LinkedHashMap<Long, EncounterCandidateProfile> merged = new LinkedHashMap<>();
        for (EncounterCandidateProfile profile : byFit) {
            merged.put(profile.id(), profile);
        }
        for (EncounterCandidateProfile profile : byLowXp) {
            merged.put(profile.id(), profile);
        }
        return List.copyOf(merged.values());
    }

    private static List<EncounterDraft> enumerateDrafts(DraftBuildRequest request) {
        LinkedHashMap<Long, EncounterCandidateProfile> profileLookup = new LinkedHashMap<>();
        for (EncounterCandidateProfile locked : request.lockedProfiles()) {
            profileLookup.put(locked.id(), locked);
        }
        for (EncounterCandidateProfile profile : request.pool()) {
            profileLookup.put(profile.id(), profile);
        }

        LinkedHashMap<String, EncounterDraft> drafts = new LinkedHashMap<>();
        LinkedHashMap<Long, Integer> baseCounts = new LinkedHashMap<>(request.lockedQuantities());
        maybeAddDraft(drafts, baseCounts, profileLookup, request);
        appendSingleCreatureDrafts(drafts, baseCounts, profileLookup, request);
        appendDualCreatureDrafts(drafts, baseCounts, profileLookup, request);
        return drafts.values().stream()
                .sorted(Comparator.comparingInt(EncounterDraft::score).reversed()
                        .thenComparingInt(draft -> Math.abs(draft.adjustedXp() - draft.targetAdjustedXp()))
                        .thenComparing(EncounterDraft::title, String.CASE_INSENSITIVE_ORDER))
                .limit(30)
                .toList();
    }

    private static void appendSingleCreatureDrafts(
            Map<String, EncounterDraft> drafts,
            Map<Long, Integer> baseCounts,
            Map<Long, EncounterCandidateProfile> profileLookup,
            DraftBuildRequest request
    ) {
        for (EncounterCandidateProfile first : request.pool()) {
            for (int firstCount = 1; firstCount <= maxAdditionalCopies(first); firstCount++) {
                LinkedHashMap<Long, Integer> single = new LinkedHashMap<>(baseCounts);
                single.merge(first.id(), firstCount, Integer::sum);
                maybeAddDraft(drafts, single, profileLookup, request);
            }
        }
    }

    private static void appendDualCreatureDrafts(
            Map<String, EncounterDraft> drafts,
            Map<Long, Integer> baseCounts,
            Map<Long, EncounterCandidateProfile> profileLookup,
            DraftBuildRequest request
    ) {
        for (int i = 0; i < request.pool().size(); i++) {
            EncounterCandidateProfile first = request.pool().get(i);
            for (int j = i + 1; j < request.pool().size(); j++) {
                EncounterCandidateProfile second = request.pool().get(j);
                for (int firstCount = 1; firstCount <= Math.min(3, maxAdditionalCopies(first)); firstCount++) {
                    for (int secondCount = 1; secondCount <= Math.min(4, maxAdditionalCopies(second)); secondCount++) {
                        LinkedHashMap<Long, Integer> dual = new LinkedHashMap<>(baseCounts);
                        dual.merge(first.id(), firstCount, Integer::sum);
                        dual.merge(second.id(), secondCount, Integer::sum);
                        maybeAddDraft(drafts, dual, profileLookup, request);
                    }
                }
            }
        }
    }

    private static void maybeAddDraft(
            Map<String, EncounterDraft> drafts,
            Map<Long, Integer> counts,
            Map<Long, EncounterCandidateProfile> profiles,
            DraftBuildRequest request
    ) {
        DraftComposition composition = DraftComposition.from(counts, profiles);
        if (!composition.valid()) {
            return;
        }

        double multiplier = EncounterDifficultyTargets.multiplierFor(composition.creatureCount(), request.partySize());
        int adjustedXp = (int) Math.round(composition.totalBaseXp() * multiplier);
        int maxAllowedAdjustedXp = EncounterDifficultyTargets.maxAdjustedXp(EncounterDifficultyBand.DEADLY, request.thresholds());
        if (adjustedXp > maxAllowedAdjustedXp * 2) {
            return;
        }

        int targetAdjustedXp = EncounterDifficultyTargets.targetAdjustedXp(request.targetDifficulty(), request.thresholds());
        EncounterDifficultyBand achievedDifficulty = EncounterDifficultyTargets.bandFor(adjustedXp, request.thresholds());
        int score = EncounterDraftScorer.score(new EncounterDraftScorer.ScoreInput(
                composition.entries(),
                request.targetDifficulty(),
                achievedDifficulty,
                adjustedXp,
                request.thresholds(),
                targetAdjustedXp,
                composition.creatureCount(),
                composition.bossCount(),
                composition.roles()));

        List<EncounterDraftEntry> sortedEntries = composition.entries().stream()
                .sorted(Comparator.comparingInt((EncounterDraftEntry entry) -> entry.profile().xp()).reversed()
                        .thenComparing(entry -> entry.profile().name(), String.CASE_INSENSITIVE_ORDER))
                .toList();
        drafts.put(normalizedKey(sortedEntries), new EncounterDraft(
                titleFor(sortedEntries),
                achievedDifficulty,
                composition.creatureCount(),
                composition.totalBaseXp(),
                adjustedXp,
                multiplier,
                score,
                targetAdjustedXp,
                sortedEntries));
    }

    private static int maxAdditionalCopies(EncounterCandidateProfile profile) {
        if ("Boss".equals(profile.role()) || profile.legendaryActionCount() > 0) {
            return 1;
        }
        if (profile.xp() >= 1_800) {
            return 2;
        }
        if (profile.xp() >= 450) {
            return 3;
        }
        if (profile.xp() >= 100) {
            return 4;
        }
        return 6;
    }

    private static String normalizedKey(List<EncounterDraftEntry> entries) {
        return entries.stream()
                .sorted(Comparator.comparingLong(entry -> entry.profile().id()))
                .map(entry -> entry.profile().id() + "x" + entry.quantity())
                .reduce((left, right) -> left + "|" + right)
                .orElse("");
    }

    private static String titleFor(List<EncounterDraftEntry> entries) {
        return entries.stream()
                .map(entry -> entry.quantity() + "x " + entry.profile().name())
                .reduce((left, right) -> left + " + " + right)
                .orElse("Encounter");
    }

    private record DraftBuildRequest(
            EncounterDifficultyBand targetDifficulty,
            EncounterDifficultyMath.Thresholds thresholds,
            int partySize,
            Collection<EncounterCandidateProfile> lockedProfiles,
            Map<Long, Integer> lockedQuantities,
            List<EncounterCandidateProfile> pool
    ) {
    }

    record EncounterDraftRequest(
            EncounterDifficultyBand targetDifficulty,
            EncounterDifficultyMath.Thresholds thresholds,
            int partySize,
            Collection<EncounterCandidateProfile> lockedProfiles,
            Map<Long, Integer> lockedQuantities,
            List<EncounterCandidateProfile> unlockedProfiles
    ) {
    }

    private record DraftComposition(
            boolean valid,
            List<EncounterDraftEntry> entries,
            int totalBaseXp,
            int creatureCount,
            int bossCount,
            Set<String> roles
    ) {

        private static DraftComposition from(
                Map<Long, Integer> counts,
                Map<Long, EncounterCandidateProfile> profiles
        ) {
            if (counts.isEmpty()) {
                return invalid();
            }
            List<EncounterDraftEntry> entries = new ArrayList<>();
            int totalBaseXp = 0;
            int creatureCount = 0;
            int bossCount = 0;
            Set<String> roles = new LinkedHashSet<>();
            for (Map.Entry<Long, Integer> countEntry : counts.entrySet()) {
                EncounterCandidateProfile profile = profiles.get(countEntry.getKey());
                if (profile == null) {
                    return invalid();
                }
                int quantity = Math.max(1, countEntry.getValue());
                creatureCount += quantity;
                totalBaseXp += profile.xp() * quantity;
                if ("Boss".equals(profile.role())) {
                    bossCount += quantity;
                }
                roles.add(profile.role());
                entries.add(new EncounterDraftEntry(profile, quantity));
            }
            boolean valid = creatureCount <= 8 && bossCount <= 1 && totalBaseXp > 0;
            return new DraftComposition(valid, entries, totalBaseXp, creatureCount, bossCount, roles);
        }

        private static DraftComposition invalid() {
            return new DraftComposition(false, List.of(), 0, 0, 0, Set.of());
        }
    }
}
