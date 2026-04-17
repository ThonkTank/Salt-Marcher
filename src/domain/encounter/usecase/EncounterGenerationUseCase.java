package src.domain.encounter.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.api.EncounterCandidate;
import src.domain.creatures.api.EncounterCandidateQuery;
import src.domain.creatures.creaturesAPI;
import src.domain.encounter.api.EncounterBudgetSummary;
import src.domain.encounter.api.EncounterCreature;
import src.domain.encounter.api.EncounterDifficultyBand;
import src.domain.encounter.api.EncounterGenerationRequest;
import src.domain.encounter.api.EncounterLock;
import src.domain.encounter.api.GeneratedEncounter;
import src.domain.party.partyAPI;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class EncounterGenerationUseCase {

    private static final int SEARCH_LIMIT = 240;

    private final partyAPI party;
    private final creaturesAPI creatures;

    public EncounterGenerationUseCase(partyAPI party, creaturesAPI creatures) {
        this.party = Objects.requireNonNull(party, "party");
        this.creatures = Objects.requireNonNull(creatures, "creatures");
    }

    public GenerateResult execute(EncounterGenerationRequest request) {
        partyAPI.ActivePartyCompositionResult compositionResult = party.loadActivePartyComposition();
        partyAPI.AdventuringDayResult dayResult = party.loadAdventuringDaySummary();
        if (compositionResult.status() != partyAPI.ReadStatus.SUCCESS || dayResult.status() != partyAPI.ReadStatus.SUCCESS) {
            return new GenerateResult(GenerateStatus.STORAGE_ERROR, null, List.of(), "Party data could not be loaded.");
        }
        List<Integer> partyLevels = compositionResult.composition().activePartyLevels();
        if (partyLevels.isEmpty()) {
            return new GenerateResult(GenerateStatus.NO_ACTIVE_PARTY, null, List.of(), "No active party is available.");
        }

        EncounterDifficultyMath.Thresholds thresholds = EncounterDifficultyMath.thresholdsFor(partyLevels);
        EncounterBudgetSummary budget = EncounterDifficultyMath.summarizeBudget(partyLevels, dayResult.summary());

        Map<Long, Integer> lockedQuantities = toLockedQuantityMap(request.lockedCreatures());
        Map<Long, CandidateProfile> lockedProfiles = loadLockedProfiles(lockedQuantities);
        if (lockedProfiles.size() != lockedQuantities.size()) {
            return new GenerateResult(GenerateStatus.INVALID_REQUEST, budget, List.of(), "A locked creature could not be loaded.");
        }

        LinkedHashSet<Long> excludedCreatureIds = new LinkedHashSet<>(request.excludedCreatureIds());
        excludedCreatureIds.removeAll(lockedProfiles.keySet());

        creaturesAPI.EncounterCandidatesResult candidateResult = creatures.loadEncounterCandidates(new EncounterCandidateQuery(
                request.creatureTypes(),
                request.creatureSubtypes(),
                request.biomes(),
                0,
                EncounterDifficultyMath.candidateMaxXp(thresholds),
                SEARCH_LIMIT));
        if (candidateResult.status() == creaturesAPI.QueryStatus.INVALID_QUERY) {
            return new GenerateResult(GenerateStatus.INVALID_REQUEST, budget, List.of(), "Encounter filters are invalid.");
        }
        if (candidateResult.status() != creaturesAPI.QueryStatus.SUCCESS) {
            return new GenerateResult(GenerateStatus.STORAGE_ERROR, budget, List.of(), "Creature data could not be loaded.");
        }

        List<CandidateProfile> unlockedProfiles = candidateResult.candidates().stream()
                .filter(candidate -> !excludedCreatureIds.contains(candidate.id()))
                .filter(candidate -> !lockedProfiles.containsKey(candidate.id()))
                .map(candidate -> CandidateProfile.fromCandidate(candidate, null))
                .toList();

        if (lockedProfiles.isEmpty() && unlockedProfiles.isEmpty()) {
            return new GenerateResult(GenerateStatus.NO_CREATURES, budget, List.of(), "No creatures matched the current filters.");
        }

        List<CandidateProfile> searchPool = buildSearchPool(unlockedProfiles, thresholds, request.targetDifficulty());
        List<EncounterDraft> drafts = enumerateDrafts(
                request.targetDifficulty(),
                thresholds,
                partyLevels.size(),
                lockedProfiles.values(),
                lockedQuantities,
                searchPool);
        if (drafts.isEmpty()) {
            return new GenerateResult(GenerateStatus.NO_CREATURES, budget, List.of(), "No encounter compositions fit the current request.");
        }

        List<GeneratedEncounter> generatedEncounters = finalizeDrafts(drafts, request.alternativeCount());
        return new GenerateResult(GenerateStatus.SUCCESS, budget, generatedEncounters, "Encounter options generated.");
    }

    private static Map<Long, Integer> toLockedQuantityMap(List<EncounterLock> locks) {
        LinkedHashMap<Long, Integer> quantities = new LinkedHashMap<>();
        for (EncounterLock lock : locks) {
            if (lock == null || lock.creatureId() <= 0) {
                continue;
            }
            quantities.merge(lock.creatureId(), Math.max(1, lock.quantity()), Integer::sum);
        }
        return quantities;
    }

    private Map<Long, CandidateProfile> loadLockedProfiles(Map<Long, Integer> lockedQuantities) {
        LinkedHashMap<Long, CandidateProfile> profiles = new LinkedHashMap<>();
        for (Long creatureId : lockedQuantities.keySet()) {
            creaturesAPI.CreatureDetailResult detailResult = creatures.loadCreatureDetail(creatureId);
            if (detailResult.status() != creaturesAPI.LookupStatus.SUCCESS || detailResult.detail() == null) {
                continue;
            }
            CreatureDetail detail = detailResult.detail();
            profiles.put(creatureId, CandidateProfile.fromDetail(detail));
        }
        return profiles;
    }

    private static List<CandidateProfile> buildSearchPool(
            List<CandidateProfile> unlockedProfiles,
            EncounterDifficultyMath.Thresholds thresholds,
            EncounterDifficultyBand targetDifficulty
    ) {
        int targetXp = EncounterDifficultyMath.targetAdjustedXp(targetDifficulty, thresholds);
        List<CandidateProfile> byFit = unlockedProfiles.stream()
                .sorted(Comparator.comparingInt(profile -> profile.componentDistance(targetXp)))
                .limit(24)
                .toList();
        List<CandidateProfile> byLowXp = unlockedProfiles.stream()
                .sorted(Comparator.comparingInt(CandidateProfile::xp).thenComparing(CandidateProfile::name, String.CASE_INSENSITIVE_ORDER))
                .limit(16)
                .toList();
        LinkedHashMap<Long, CandidateProfile> merged = new LinkedHashMap<>();
        for (CandidateProfile profile : byFit) {
            merged.put(profile.id(), profile);
        }
        for (CandidateProfile profile : byLowXp) {
            merged.put(profile.id(), profile);
        }
        return List.copyOf(merged.values());
    }

    private List<EncounterDraft> enumerateDrafts(
            EncounterDifficultyBand targetDifficulty,
            EncounterDifficultyMath.Thresholds thresholds,
            int partySize,
            Collection<CandidateProfile> lockedProfiles,
            Map<Long, Integer> lockedQuantities,
            List<CandidateProfile> pool
    ) {
        LinkedHashMap<Long, CandidateProfile> profileLookup = new LinkedHashMap<>();
        for (CandidateProfile locked : lockedProfiles) {
            profileLookup.put(locked.id(), locked);
        }
        for (CandidateProfile profile : pool) {
            profileLookup.put(profile.id(), profile);
        }

        LinkedHashMap<Long, Integer> baseCounts = new LinkedHashMap<>(lockedQuantities);
        LinkedHashMap<String, EncounterDraft> drafts = new LinkedHashMap<>();
        maybeAddDraft(drafts, baseCounts, profileLookup, targetDifficulty, thresholds, partySize);

        for (CandidateProfile first : pool) {
            for (int firstCount = 1; firstCount <= maxAdditionalCopies(first); firstCount++) {
                LinkedHashMap<Long, Integer> single = new LinkedHashMap<>(baseCounts);
                single.merge(first.id(), firstCount, Integer::sum);
                maybeAddDraft(drafts, single, profileLookup, targetDifficulty, thresholds, partySize);
            }
        }

        for (int i = 0; i < pool.size(); i++) {
            CandidateProfile first = pool.get(i);
            for (int j = i + 1; j < pool.size(); j++) {
                CandidateProfile second = pool.get(j);
                for (int firstCount = 1; firstCount <= Math.min(3, maxAdditionalCopies(first)); firstCount++) {
                    for (int secondCount = 1; secondCount <= Math.min(4, maxAdditionalCopies(second)); secondCount++) {
                        LinkedHashMap<Long, Integer> dual = new LinkedHashMap<>(baseCounts);
                        dual.merge(first.id(), firstCount, Integer::sum);
                        dual.merge(second.id(), secondCount, Integer::sum);
                        maybeAddDraft(drafts, dual, profileLookup, targetDifficulty, thresholds, partySize);
                    }
                }
            }
        }

        return drafts.values().stream()
                .sorted(Comparator.comparingInt(EncounterDraft::score).reversed()
                        .thenComparingInt(draft -> Math.abs(draft.adjustedXp() - draft.targetAdjustedXp()))
                        .thenComparing(EncounterDraft::title, String.CASE_INSENSITIVE_ORDER))
                .limit(30)
                .toList();
    }

    private static int maxAdditionalCopies(CandidateProfile profile) {
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

    private static void maybeAddDraft(
            Map<String, EncounterDraft> drafts,
            Map<Long, Integer> counts,
            Map<Long, CandidateProfile> profiles,
            EncounterDifficultyBand targetDifficulty,
            EncounterDifficultyMath.Thresholds thresholds,
            int partySize
    ) {
        if (counts.isEmpty()) {
            return;
        }

        List<DraftEntry> entries = new ArrayList<>();
        int totalBaseXp = 0;
        int creatureCount = 0;
        int bossCount = 0;
        Set<String> roles = new LinkedHashSet<>();
        for (Map.Entry<Long, Integer> countEntry : counts.entrySet()) {
            CandidateProfile profile = profiles.get(countEntry.getKey());
            if (profile == null) {
                return;
            }
            int quantity = Math.max(1, countEntry.getValue());
            creatureCount += quantity;
            totalBaseXp += profile.xp() * quantity;
            if ("Boss".equals(profile.role())) {
                bossCount += quantity;
            }
            roles.add(profile.role());
            entries.add(new DraftEntry(profile, quantity));
        }
        if (creatureCount > 8 || bossCount > 1 || totalBaseXp <= 0) {
            return;
        }

        double multiplier = EncounterDifficultyMath.multiplierFor(creatureCount, partySize);
        int adjustedXp = (int) Math.round(totalBaseXp * multiplier);
        int maxAllowedAdjustedXp = EncounterDifficultyMath.maxAdjustedXp(EncounterDifficultyBand.DEADLY, thresholds);
        if (adjustedXp > maxAllowedAdjustedXp * 2) {
            return;
        }

        int targetAdjustedXp = EncounterDifficultyMath.targetAdjustedXp(targetDifficulty, thresholds);
        EncounterDifficultyBand achievedDifficulty = EncounterDifficultyMath.bandFor(adjustedXp, thresholds);
        int score = scoreEncounter(entries, targetDifficulty, achievedDifficulty, adjustedXp, thresholds, targetAdjustedXp, creatureCount, bossCount, roles);

        entries.sort(Comparator.comparingInt((DraftEntry entry) -> entry.profile().xp()).reversed()
                .thenComparing(entry -> entry.profile().name(), String.CASE_INSENSITIVE_ORDER));
        drafts.put(normalizedKey(entries), new EncounterDraft(
                titleFor(entries),
                achievedDifficulty,
                creatureCount,
                totalBaseXp,
                adjustedXp,
                multiplier,
                score,
                targetAdjustedXp,
                entries));
    }

    private static int scoreEncounter(
            List<DraftEntry> entries,
            EncounterDifficultyBand targetDifficulty,
            EncounterDifficultyBand achievedDifficulty,
            int adjustedXp,
            EncounterDifficultyMath.Thresholds thresholds,
            int targetAdjustedXp,
            int creatureCount,
            int bossCount,
            Set<String> roles
    ) {
        int minXp = EncounterDifficultyMath.minAdjustedXp(targetDifficulty, thresholds);
        int maxXp = EncounterDifficultyMath.maxAdjustedXp(targetDifficulty, thresholds);
        int score = 0;

        if (adjustedXp >= minXp && adjustedXp <= maxXp) {
            score += 700;
        } else {
            int miss = adjustedXp < minXp ? minXp - adjustedXp : adjustedXp - maxXp;
            score += Math.max(0, 500 - miss * 400 / Math.max(1, targetAdjustedXp));
        }

        score += Math.max(0, 250 - Math.abs(adjustedXp - targetAdjustedXp) * 250 / Math.max(1, targetAdjustedXp));
        score += achievedDifficulty == targetDifficulty ? 140 : 0;
        score += switch (entries.size()) {
            case 1 -> 40;
            case 2 -> 90;
            case 3 -> 70;
            default -> 50;
        };
        score += roles.size() * 25;
        if (roles.contains("Boss") && roles.size() > 1) {
            score += 90;
        }
        if (roles.contains("Brute") && roles.contains("Skirmisher")) {
            score += 70;
        }
        if (bossCount > 0 && creatureCount > 4) {
            score -= 120;
        }
        if (creatureCount >= 6) {
            score -= 30;
        }
        for (DraftEntry entry : entries) {
            if (entry.quantity() > 4) {
                score -= (entry.quantity() - 4) * 35;
            }
            if ("Minion".equals(entry.profile().role()) && creatureCount <= 2) {
                score -= 40;
            }
        }
        return score;
    }

    private List<GeneratedEncounter> finalizeDrafts(List<EncounterDraft> drafts, int alternativeCount) {
        Map<Long, CreatureDetail> detailCache = new LinkedHashMap<>();
        List<GeneratedEncounter> encounters = new ArrayList<>();
        for (EncounterDraft draft : drafts.stream().limit(alternativeCount).toList()) {
            List<EncounterCreature> creatures = new ArrayList<>();
            for (DraftEntry entry : draft.entries()) {
                CreatureDetail detail = detailCache.computeIfAbsent(entry.profile().id(), this::loadCreatureDetailOrNull);
                EncounterRoleClassifier.Classification classification = EncounterRoleClassifier.classify(entry.profile().toCandidate(), detail);
                creatures.add(new EncounterCreature(
                        entry.profile().id(),
                        entry.profile().name(),
                        entry.profile().challengeRating(),
                        entry.profile().xp(),
                        entry.quantity(),
                        classification.role(),
                        classification.tags()));
            }
            encounters.add(new GeneratedEncounter(
                    draft.title(),
                    draft.achievedDifficulty(),
                    draft.creatureCount(),
                    draft.totalBaseXp(),
                    draft.adjustedXp(),
                    draft.multiplier(),
                    highlightsFor(draft, creatures),
                    creatures));
        }
        return encounters;
    }

    private @Nullable CreatureDetail loadCreatureDetailOrNull(long creatureId) {
        creaturesAPI.CreatureDetailResult result = creatures.loadCreatureDetail(creatureId);
        if (result.status() != creaturesAPI.LookupStatus.SUCCESS) {
            return null;
        }
        return result.detail();
    }

    private static List<String> highlightsFor(EncounterDraft draft, List<EncounterCreature> creatures) {
        List<String> highlights = new ArrayList<>();
        highlights.add("Adjusted XP " + draft.adjustedXp() + " vs target " + draft.targetAdjustedXp());
        if (creatures.stream().anyMatch(creature -> "Boss".equals(creature.role()))) {
            highlights.add("Includes a boss-style anchor.");
        }
        long distinctRoles = creatures.stream().map(EncounterCreature::role).distinct().count();
        if (distinctRoles >= 2) {
            highlights.add("Blends " + distinctRoles + " combat roles.");
        }
        if (draft.creatureCount() >= 5) {
            highlights.add("Leans on action economy through numbers.");
        }
        if (highlights.size() == 1) {
            highlights.add("Compact composition that stays close to the requested band.");
        }
        return highlights;
    }

    private static String normalizedKey(List<DraftEntry> entries) {
        return entries.stream()
                .sorted(Comparator.comparingLong(entry -> entry.profile().id()))
                .map(entry -> entry.profile().id() + "x" + entry.quantity())
                .reduce((left, right) -> left + "|" + right)
                .orElse("");
    }

    private static String titleFor(List<DraftEntry> entries) {
        return entries.stream()
                .map(entry -> entry.quantity() + "x " + entry.profile().name())
                .reduce((left, right) -> left + " + " + right)
                .orElse("Encounter");
    }

    public record GenerateResult(
            GenerateStatus status,
            @Nullable EncounterBudgetSummary budget,
            List<GeneratedEncounter> encounters,
            String message
    ) {

        public GenerateResult {
            encounters = encounters == null ? List.of() : List.copyOf(encounters);
            message = message == null ? "" : message;
        }
    }

    public enum GenerateStatus {
        SUCCESS,
        NO_ACTIVE_PARTY,
        NO_CREATURES,
        INVALID_REQUEST,
        STORAGE_ERROR
    }

    private record EncounterDraft(
            String title,
            EncounterDifficultyBand achievedDifficulty,
            int creatureCount,
            int totalBaseXp,
            int adjustedXp,
            double multiplier,
            int score,
            int targetAdjustedXp,
            List<DraftEntry> entries
    ) {
    }

    private record DraftEntry(
            CandidateProfile profile,
            int quantity
    ) {
    }

    private record CandidateProfile(
            long id,
            String name,
            String challengeRating,
            int xp,
            int hitPoints,
            int armorClass,
            int initiativeBonus,
            int legendaryActionCount,
            String role
    ) {

        static CandidateProfile fromCandidate(EncounterCandidate candidate, @Nullable CreatureDetail detail) {
            EncounterRoleClassifier.Classification classification = EncounterRoleClassifier.classify(candidate, detail);
            return new CandidateProfile(
                    candidate.id(),
                    candidate.name(),
                    candidate.challengeRating(),
                    candidate.xp(),
                    candidate.hitPoints(),
                    candidate.armorClass(),
                    candidate.initiativeBonus(),
                    candidate.legendaryActionCount(),
                    classification.role());
        }

        static CandidateProfile fromDetail(CreatureDetail detail) {
            EncounterCandidate candidate = new EncounterCandidate(
                    detail.id(),
                    detail.name(),
                    detail.creatureType(),
                    detail.challengeRating(),
                    detail.xp(),
                    detail.hitPoints(),
                    detail.hitDiceCount(),
                    detail.hitDiceSides(),
                    detail.hitDiceModifier(),
                    detail.armorClass(),
                    detail.initiativeBonus(),
                    detail.legendaryActionCount());
            return fromCandidate(candidate, detail);
        }

        EncounterCandidate toCandidate() {
            return new EncounterCandidate(
                    id,
                    name,
                    "",
                    challengeRating,
                    xp,
                    hitPoints,
                    null,
                    null,
                    null,
                    armorClass,
                    initiativeBonus,
                    legendaryActionCount);
        }

        int componentDistance(int targetXp) {
            int half = Math.max(1, targetXp / 2);
            int third = Math.max(1, targetXp / 3);
            return Math.min(
                    Math.abs(xp - targetXp),
                    Math.min(Math.abs(xp - half), Math.abs(xp - third)));
        }
    }
}
