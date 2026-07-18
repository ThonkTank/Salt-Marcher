package features.creatures.application;

import features.creatures.CreaturesServiceAssembly;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import features.creatures.domain.catalog.CreatureCatalogData;
import features.creatures.domain.catalog.CreatureCatalogData.CatalogPageData;
import features.creatures.domain.catalog.CreatureCatalogData.CatalogRowData;
import features.creatures.domain.catalog.CreatureCatalogData.CatalogSearchSpec;
import features.creatures.domain.catalog.CreatureCatalogData.CreatureAbilities;
import features.creatures.domain.catalog.CreatureCatalogData.CreatureActionData;
import features.creatures.domain.catalog.CreatureCatalogData.CreatureIdentity;
import features.creatures.domain.catalog.CreatureCatalogData.CreatureProfile;
import features.creatures.domain.catalog.CreatureCatalogData.CreatureTraits;
import features.creatures.domain.catalog.CreatureCatalogData.CreatureVitals;
import features.creatures.domain.catalog.CreatureCatalogData.DistinctFilterValues;
import features.creatures.domain.catalog.CreatureCatalogData.EncounterCandidateProfile;
import features.creatures.domain.catalog.CreatureCatalogData.EncounterCandidateSpec;
import features.creatures.domain.catalog.port.CreatureCatalogPort;
import features.creatures.api.CreatureCatalogQuery;
import features.creatures.api.CreatureCatalogQueryApi;
import features.creatures.api.CreatureCatalogPageResult;
import features.creatures.api.CreatureDetail;
import features.creatures.api.CreatureDetailModel;
import features.creatures.api.CreatureEncounterCandidate;
import features.creatures.api.CreatureEncounterCandidatesModel;
import features.creatures.api.CreatureEncounterCandidatesResult;
import features.creatures.api.CreatureFilterOptionsResult;
import features.creatures.api.CreatureLookupStatus;
import features.creatures.api.CreatureQueryStatus;
import features.creatures.api.CreatureReadStatus;
import features.creatures.api.CreaturesApi;
import features.creatures.api.RefreshCreatureEncounterCandidatesCommand;
import features.creatures.api.SelectCreatureDetailCommand;
import org.junit.jupiter.api.Test;

public final class CreatureCatalogTest {

    @Test
    void CREATURE_CATALOG_001() {
        TestRuntime runtime = runtimeWithAshImp();
        assertFilterOptions(runtime.queries.loadFilterOptions());
    }

    @Test
    void CREATURE_CATALOG_002() {
        TestRuntime runtime = runtimeWithAshImp();
        runtime.queries.search(filteredCatalogCommand());
        assertFilteredCatalogReadback(runtime.queries.current(), runtime.port.lastSearchSpec);
    }

    @Test
    void CREATURE_CATALOG_003() {
        TestRuntime runtime = runtimeWithAshImp();
        runtime.service.selectCreatureDetail(new SelectCreatureDetailCommand(101L));
        assertAshImpDetail(runtime.detail.current().detail());
    }

    @Test
    void CREATURE_CATALOG_004() {
        TestRuntime runtime = runtimeWithAshImp();
        runtime.queries.search(filteredCatalogCommand());
        runtime.service.selectCreatureDetail(new SelectCreatureDetailCommand(101L));

        runtime.port.replaceCreature(ashImpEdited());
        runtime.queries.search(editedCatalogCommand());
        runtime.service.selectCreatureDetail(new SelectCreatureDetailCommand(101L));
        assertEditedCreatureReadback(runtime.queries.current(), runtime.detail.current().detail());
    }

    @Test
    void CREATURE_CATALOG_005() {
        TestRuntime runtime = runtimeAfterEditedCatalogReadback();
        assertEditedCatalogPrecondition(runtime);
        assertInvalidCatalogQueryDoesNotHitLookup(runtime);
    }

    @Test
    void CREATURE_CATALOG_006() {
        TestRuntime runtime = runtimeAfterEditedCatalogReadback();
        assertEditedDetailPrecondition(runtime.detail.current().detail());
        assertMissingAndBrokenDetailsPublishLookupStatus(runtime);
    }

    @Test
    void CREATURE_CATALOG_007() {
        TestRuntime runtime = runtimeWithEncounterCandidates();
        runtime.service.refreshEncounterCandidates(new RefreshCreatureEncounterCandidatesCommand(
                List.of(" Fiend ", "Fiend", ""),
                List.of("Devil"),
                List.of("Cavern"),
                "Cinder",
                "1/2",
                "1/2",
                List.of("Tiny"),
                List.of("LE"),
                0,
                1_000,
                0));
        assertEncounterCandidateReadback(runtime.encounterCandidates.current(), runtime.port.lastEncounterSpec);
    }

    @Test
    void CREATURE_CATALOG_008() {
        TestRuntime runtime = runtimeWithEncounterCandidates();
        runtime.service.refreshEncounterCandidates(new RefreshCreatureEncounterCandidatesCommand(
                List.of(" Fiend ", "Fiend", ""),
                List.of("Devil"),
                List.of("Cavern"),
                0,
                1_000,
                0));
        assertInvalidEncounterCandidateQueryDoesNotHitLookup(runtime);
    }

    @Test
    void CREATURE_CATALOG_009() {
        TestRuntime runtime = runtimeWithEditedAshImp();
        runtime.queries.search(new CreatureCatalogQuery(
                "",
                "2",
                "1",
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                null,
                null,
                25,
                3));
        assertCatalogStorageFailurePublishesEmptyErrorPage(runtime);
    }

    private static TestRuntime runtime() {
        MutableCreatureCatalogPort port = new MutableCreatureCatalogPort();
        CreaturesServiceAssembly.Component services = CreaturesServiceAssembly.create(port);
        return new TestRuntime(
                port,
                services.application(),
                new QueryHarness(services.catalogQueries()),
                services.detail(),
                services.encounterCandidates());
    }

    private static TestRuntime runtimeWithAshImp() {
        TestRuntime runtime = runtime();
        runtime.port.createCreature(ashImp());
        return runtime;
    }

    private static TestRuntime runtimeWithEditedAshImp() {
        TestRuntime runtime = runtimeWithAshImp();
        runtime.port.replaceCreature(ashImpEdited());
        return runtime;
    }

    private static TestRuntime runtimeWithEncounterCandidates() {
        TestRuntime runtime = runtimeWithEditedAshImp();
        runtime.port.createCreature(mireOgre());
        return runtime;
    }

    private static TestRuntime runtimeAfterEditedCatalogReadback() {
        TestRuntime runtime = runtimeWithAshImp();
        runtime.queries.search(filteredCatalogCommand());
        runtime.service.selectCreatureDetail(new SelectCreatureDetailCommand(101L));
        runtime.port.replaceCreature(ashImpEdited());
        runtime.queries.search(editedCatalogCommand());
        runtime.service.selectCreatureDetail(new SelectCreatureDetailCommand(101L));
        return runtime;
    }

    private static CreatureCatalogQuery filteredCatalogCommand() {
        return new CreatureCatalogQuery(
                " Ash ",
                "1/8",
                "1",
                List.of("Tiny"),
                List.of(" Fiend ", "Fiend", ""),
                List.of("Devil"),
                List.of("Cavern"),
                List.of("LE"),
                "XP",
                "DESCENDING",
                0,
                -4);
    }

    private static CreatureCatalogQuery editedCatalogCommand() {
        return new CreatureCatalogQuery(
                "Cinder",
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                null,
                null,
                10,
                0);
    }

    private static void assertFilterOptions(CreatureFilterOptionsResult result) {
        assertEquals(CreatureReadStatus.SUCCESS, result.status(), "CREATURE-CATALOG-001 filter status");
        assertEquals(List.of("Tiny"), result.options().sizes(), "CREATURE-CATALOG-001 filter sizes");
        assertEquals(List.of("Fiend"), result.options().types(), "CREATURE-CATALOG-001 filter types");
        assertEquals(List.of("Devil"), result.options().subtypes(), "CREATURE-CATALOG-001 filter subtypes");
        assertEquals(List.of("Cavern"), result.options().biomes(), "CREATURE-CATALOG-001 filter biomes");
        assertEquals(List.of("LE"), result.options().alignments(), "CREATURE-CATALOG-001 filter alignments");
        assertTrue(result.options().challengeRatings().contains("1/8"),
                "CREATURE-CATALOG-001 filter includes fractional CR");
        assertTrue(result.options().challengeRatings().contains("30"),
                "CREATURE-CATALOG-001 filter includes high CR");
    }

    private static void assertFilteredCatalogReadback(
            CreatureCatalogPageResult result,
            CatalogSearchSpec lastSearchSpec
    ) {
        assertEquals(CreatureQueryStatus.SUCCESS, result.status(), "CREATURE-CATALOG-002 catalog status");
        assertEquals(1, result.page().rows().size(), "CREATURE-CATALOG-002 filtered row count");
        assertEquals(1, result.page().totalCount(), "CREATURE-CATALOG-002 filtered total count");
        assertEquals(101L, result.page().rows().getFirst().id(), "CREATURE-CATALOG-002 filtered row id");
        assertEquals("Ash Imp", result.page().rows().getFirst().name(), "CREATURE-CATALOG-002 filtered row name");
        assertEquals("Tiny", result.page().rows().getFirst().size(), "CREATURE-CATALOG-002 filtered row size");
        assertEquals("Fiend", result.page().rows().getFirst().creatureType(), "CREATURE-CATALOG-002 filtered row type");
        assertEquals(100, result.page().rows().getFirst().xp(), "CREATURE-CATALOG-002 filtered row xp");
        assertEquals(7, result.page().rows().getFirst().hitPoints(), "CREATURE-CATALOG-002 filtered row hp");
        assertEquals(13, result.page().rows().getFirst().armorClass(), "CREATURE-CATALOG-002 filtered row ac");
        assertEquals(50, result.page().pageSize(), "CREATURE-CATALOG-002 default page size");
        assertEquals(0, result.page().pageOffset(), "CREATURE-CATALOG-002 clamped page offset");
        assertEquals("Ash", lastSearchSpec.nameQuery(), "CREATURE-CATALOG-002 trimmed query");
        assertEquals(Integer.valueOf(25), lastSearchSpec.minimumXp(), "CREATURE-CATALOG-002 min CR XP");
        assertEquals(Integer.valueOf(200), lastSearchSpec.maximumXp(), "CREATURE-CATALOG-002 max CR XP");
        assertEquals(List.of("Fiend"), lastSearchSpec.types(), "CREATURE-CATALOG-002 normalized type filter");
        assertEquals("XP", lastSearchSpec.sortField(), "CREATURE-CATALOG-002 XP sort field");
        assertEquals(false, lastSearchSpec.sortAscending(), "CREATURE-CATALOG-002 descending sort");
    }

    private static void assertAshImpDetail(CreatureDetail detail) {
        assertEquals(101L, detail.id(), "CREATURE-CATALOG-003 detail id");
        assertEquals("Ash Imp", detail.name(), "CREATURE-CATALOG-003 detail name");
        assertEquals("Tiny", detail.size(), "CREATURE-CATALOG-003 detail size");
        assertEquals("Fiend", detail.creatureType(), "CREATURE-CATALOG-003 detail type");
        assertEquals(List.of("Devil"), detail.subtypes(), "CREATURE-CATALOG-003 detail subtype");
        assertEquals("1/2", detail.challengeRating(), "CREATURE-CATALOG-003 detail CR");
        assertEquals(100, detail.xp(), "CREATURE-CATALOG-003 detail XP");
        assertEquals(7, detail.hitPoints(), "CREATURE-CATALOG-003 detail HP");
        assertEquals(13, detail.armorClass(), "CREATURE-CATALOG-003 detail AC");
        assertEquals("Claw", detail.actions().getFirst().name(), "CREATURE-CATALOG-003 action name");
        assertEquals(Integer.valueOf(5), detail.actions().getFirst().toHitBonus(), "CREATURE-CATALOG-003 action hit");
    }

    private static void assertEditedCreatureReadback(CreatureCatalogPageResult page, CreatureDetail detail) {
        assertEquals(CreatureQueryStatus.SUCCESS, page.status(), "CREATURE-CATALOG-004 edited catalog status");
        assertEquals(1, page.page().totalCount(), "CREATURE-CATALOG-004 edited total count");
        assertEquals("Cinder Imp", page.page().rows().getFirst().name(), "CREATURE-CATALOG-004 edited row name");
        assertEquals(11, page.page().rows().getFirst().hitPoints(), "CREATURE-CATALOG-004 edited row hp");
        assertEquals("Cinder Imp", detail.name(), "CREATURE-CATALOG-004 edited detail name");
        assertEquals(11, detail.hitPoints(), "CREATURE-CATALOG-004 edited detail hp");
        assertEquals("Cinder Claw", detail.actions().getFirst().name(), "CREATURE-CATALOG-004 edited action");
        assertTrue(!"Ash Imp".equals(detail.name()), "CREATURE-CATALOG-004 old detail name absent");
    }

    private static void assertEditedCatalogPrecondition(TestRuntime runtime) {
        CreatureCatalogPageResult page = runtime.queries.current();
        assertEquals(CreatureQueryStatus.SUCCESS, page.status(), "setup edited catalog status");
        assertEquals(1, page.page().totalCount(), "setup edited catalog total count");
        assertEquals("Cinder Imp", page.page().rows().getFirst().name(), "setup edited catalog row name");
        assertEquals(2, runtime.port.searchCount, "setup edited catalog search count");
    }

    private static void assertEditedDetailPrecondition(CreatureDetail detail) {
        assertEquals("Cinder Imp", detail.name(), "setup edited detail name");
        assertEquals(11, detail.hitPoints(), "setup edited detail hp");
    }

    private static void assertInvalidCatalogQueryDoesNotHitLookup(TestRuntime runtime) {
        int before = runtime.port.searchCount;
        runtime.queries.search(new CreatureCatalogQuery(
                "",
                "2",
                "1",
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                null,
                null,
                25,
                3));
        CreatureCatalogPageResult result = runtime.queries.current();
        assertEquals(CreatureQueryStatus.INVALID_QUERY, result.status(), "CREATURE-CATALOG-005 invalid CR status");
        assertEquals(0, result.page().rows().size(), "CREATURE-CATALOG-005 invalid CR empty page");
        assertEquals(25, result.page().pageSize(), "CREATURE-CATALOG-005 invalid CR page size");
        assertEquals(3, result.page().pageOffset(), "CREATURE-CATALOG-005 invalid CR page offset");
        assertEquals(before, runtime.port.searchCount, "CREATURE-CATALOG-005 invalid CR bypasses lookup");
    }

    private static void assertMissingAndBrokenDetailsPublishLookupStatus(TestRuntime runtime) {
        runtime.service.selectCreatureDetail(new SelectCreatureDetailCommand(404L));
        assertEquals(CreatureLookupStatus.NOT_FOUND, runtime.detail.current().status(),
                "CREATURE-CATALOG-006 missing detail status");
        assertEquals(null, runtime.detail.current().detail(), "CREATURE-CATALOG-006 missing detail payload");

        runtime.service.selectCreatureDetail(null);
        assertEquals(CreatureLookupStatus.NOT_FOUND, runtime.detail.current().status(),
                "CREATURE-CATALOG-006 null detail command status");

        runtime.port.failNextDetail = true;
        runtime.service.selectCreatureDetail(new SelectCreatureDetailCommand(101L));
        assertEquals(CreatureLookupStatus.STORAGE_ERROR, runtime.detail.current().status(),
                "CREATURE-CATALOG-006 detail storage error status");
        assertEquals(null, runtime.detail.current().detail(), "CREATURE-CATALOG-006 detail storage error payload");
    }

    private static void assertEncounterCandidateReadback(
            CreatureEncounterCandidatesResult result,
            EncounterCandidateSpec lastEncounterSpec
    ) {
        assertEquals(CreatureQueryStatus.SUCCESS, result.status(), "CREATURE-CATALOG-007 candidate status");
        assertEquals(List.of("Fiend"), lastEncounterSpec.types(), "CREATURE-CATALOG-007 normalized candidate type");
        assertEquals("Cinder", lastEncounterSpec.nameQuery(), "CREATURE-CATALOG-007 candidate name filter");
        assertEquals(List.of("Tiny"), lastEncounterSpec.sizes(), "CREATURE-CATALOG-007 candidate size filter");
        assertEquals(List.of("LE"), lastEncounterSpec.alignments(), "CREATURE-CATALOG-007 candidate alignment filter");
        assertEquals(100, lastEncounterSpec.minimumXp(), "CREATURE-CATALOG-007 CR minimum");
        assertEquals(100, lastEncounterSpec.maximumXp(), "CREATURE-CATALOG-007 CR maximum");
        assertEquals(250, lastEncounterSpec.limit(), "CREATURE-CATALOG-007 default candidate limit");
        assertEquals(1, result.candidates().size(), "CREATURE-CATALOG-007 candidate count");
        CreatureEncounterCandidate candidate = result.candidates().getFirst();
        assertEquals(101L, candidate.id(), "CREATURE-CATALOG-007 candidate id");
        assertEquals("Cinder Imp", candidate.name(), "CREATURE-CATALOG-007 candidate name");
        assertEquals(1, candidate.selectionWeight(), "CREATURE-CATALOG-007 default selection weight");
    }

    private static void assertInvalidEncounterCandidateQueryDoesNotHitLookup(TestRuntime runtime) {
        int before = runtime.port.encounterSearchCount;
        runtime.service.refreshEncounterCandidates(new RefreshCreatureEncounterCandidatesCommand(
                List.of(),
                List.of(),
                List.of(),
                900,
                100,
                10));
        assertEquals(CreatureQueryStatus.INVALID_QUERY, runtime.encounterCandidates.current().status(),
                "CREATURE-CATALOG-008 invalid candidate query status");
        assertEquals(0, runtime.encounterCandidates.current().candidates().size(),
                "CREATURE-CATALOG-008 invalid candidate query empty");
        assertEquals(before, runtime.port.encounterSearchCount,
                "CREATURE-CATALOG-008 invalid candidate query bypasses lookup");
    }

    private static void assertCatalogStorageFailurePublishesEmptyErrorPage(TestRuntime runtime) {
        runtime.port.failNextSearch = true;
        runtime.queries.search(null);
        CreatureCatalogPageResult result = runtime.queries.current();
        assertEquals(CreatureQueryStatus.STORAGE_ERROR, result.status(),
                "CREATURE-CATALOG-009 catalog storage error status");
        assertEquals(0, result.page().rows().size(), "CREATURE-CATALOG-009 catalog storage error empty page");
        assertEquals(50, result.page().pageSize(), "CREATURE-CATALOG-009 catalog storage error default page size");
        assertEquals(0, result.page().pageOffset(), "CREATURE-CATALOG-009 catalog storage error default offset");
    }

    private static CreatureProfile ashImp() {
        return creature(
                101L,
                "Ash Imp",
                "Tiny",
                "Fiend",
                List.of("Devil"),
                List.of("Cavern"),
                "LE",
                "1/2",
                100,
                7,
                13,
                "Claw",
                5);
    }

    private static CreatureProfile ashImpEdited() {
        return creature(
                101L,
                "Cinder Imp",
                "Tiny",
                "Fiend",
                List.of("Devil"),
                List.of("Cavern"),
                "LE",
                "1/2",
                100,
                11,
                14,
                "Cinder Claw",
                6);
    }

    private static CreatureProfile mireOgre() {
        return creature(
                202L,
                "Mire Ogre",
                "Large",
                "Giant",
                List.of("Ogre"),
                List.of("Swamp"),
                "CE",
                "2",
                450,
                59,
                11,
                "Club",
                6);
    }

    private static CreatureProfile creature(
            long id,
            String name,
            String size,
            String creatureType,
            List<String> subtypes,
            List<String> biomes,
            String alignment,
            String challengeRating,
            int xp,
            int hitPoints,
            int armorClass,
            String actionName,
            int toHitBonus
    ) {
        return new CreatureProfile(
                new CreatureIdentity(id, name, size, creatureType, subtypes, biomes, alignment, challengeRating, xp),
                new CreatureVitals(hitPoints, "2d6", 2, 6, 0, armorClass, null, 30, 0, 0, 0, 0),
                new CreatureAbilities(10, 14, 10, 8, 10, 8, 2, 2),
                new CreatureTraits(null, "Stealth +4", null, null, null, null, "darkvision 60 ft.", 10, "Infernal", 0),
                List.of(new CreatureActionData("ACTION", actionName, "A stable catalog action.", toHitBonus)));
    }

    private static void assertEquals(Object expected, Object actual, String label) {
        if (!Objects.equals(expected, actual)) {
            throw new AssertionError(label + ": expected <" + expected + "> but was <" + actual + ">");
        }
    }

    private static void assertTrue(boolean condition, String label) {
        if (!condition) {
            throw new AssertionError(label);
        }
    }

    private record TestRuntime(
            MutableCreatureCatalogPort port,
            CreaturesApi service,
            QueryHarness queries,
            CreatureDetailModel detail,
            CreatureEncounterCandidatesModel encounterCandidates
    ) {
    }

    private static final class QueryHarness {
        private final CreatureCatalogQueryApi api;
        private CreatureCatalogPageResult current;

        private QueryHarness(CreatureCatalogQueryApi api) {
            this.api = api;
        }

        private CreatureCatalogPageResult search(CreatureCatalogQuery query) {
            current = api.search(query).toCompletableFuture().join();
            return current;
        }

        private CreatureFilterOptionsResult loadFilterOptions() {
            return api.loadFilterOptions().toCompletableFuture().join();
        }

        private CreatureCatalogPageResult current() {
            return current;
        }
    }

    private static final class MutableCreatureCatalogPort implements CreatureCatalogPort {

        private final Map<Long, CreatureProfile> profiles = new LinkedHashMap<>();
        private CatalogSearchSpec lastSearchSpec;
        private EncounterCandidateSpec lastEncounterSpec;
        private int searchCount;
        private int encounterSearchCount;
        private boolean failNextSearch;
        private boolean failNextDetail;

        void createCreature(CreatureProfile profile) {
            if (profiles.containsKey(profile.id())) {
                throw new IllegalStateException("fixture creature already exists: " + profile.id());
            }
            profiles.put(profile.id(), profile);
        }

        void replaceCreature(CreatureProfile profile) {
            profiles.put(profile.id(), profile);
        }

        @Override
        public DistinctFilterValues loadFilterValues() {
            return new DistinctFilterValues(
                    distinct(profiles.values().stream().map(CreatureProfile::size).toList()),
                    distinct(profiles.values().stream().map(CreatureProfile::creatureType).toList()),
                    distinct(profiles.values().stream().flatMap(profile -> profile.subtypes().stream()).toList()),
                    distinct(profiles.values().stream().flatMap(profile -> profile.biomes().stream()).toList()),
                    distinct(profiles.values().stream().map(CreatureProfile::alignment).toList()));
        }

        @Override
        public CatalogPageData searchCatalog(CatalogSearchSpec spec) {
            searchCount++;
            lastSearchSpec = spec;
            if (failNextSearch) {
                failNextSearch = false;
                throw new IllegalStateException("fixture search failure");
            }
            List<CreatureProfile> matches = profiles.values().stream()
                    .filter(profile -> matchesSearch(spec, profile))
                    .sorted(sorter(spec))
                    .toList();
            List<CatalogRowData> rows = matches.stream()
                    .skip(spec.pageOffset())
                    .limit(spec.pageSize())
                    .map(MutableCreatureCatalogPort::row)
                    .toList();
            return new CatalogPageData(rows, matches.size(), spec.pageSize(), spec.pageOffset());
        }

        @Override
        public CreatureProfile loadCreatureDetail(long creatureId) {
            if (failNextDetail) {
                failNextDetail = false;
                throw new IllegalStateException("fixture detail failure");
            }
            return profiles.get(creatureId);
        }

        @Override
        public List<EncounterCandidateProfile> loadEncounterCandidates(EncounterCandidateSpec spec) {
            encounterSearchCount++;
            lastEncounterSpec = spec;
            return profiles.values().stream()
                    .filter(profile -> matchesEncounter(spec, profile))
                    .limit(spec.limit())
                    .map(MutableCreatureCatalogPort::candidate)
                    .toList();
        }

        @Override
        public List<EncounterCandidateProfile> loadCreatureFacts(CreatureCatalogData.CreatureFactsSpec spec) {
            return profiles.values().stream()
                    .filter(profile -> spec.mode() == CreatureCatalogData.CreatureFactsSpec.FactsMode.CREATURE_IDS
                            ? spec.values().contains(Long.valueOf(profile.id()))
                            : spec.values().contains(Long.valueOf(profile.xp())))
                    .map(MutableCreatureCatalogPort::candidate)
                    .toList();
        }

        private static List<String> distinct(List<String> values) {
            return values.stream()
                    .filter(value -> value != null && !value.isBlank())
                    .distinct()
                    .toList();
        }

        private static boolean matchesSearch(CatalogSearchSpec spec, CreatureProfile profile) {
            return containsName(profile, spec.nameQuery())
                    && withinXp(profile, spec.minimumXp(), spec.maximumXp())
                    && matchesAny(spec.sizes(), List.of(profile.size()))
                    && matchesAny(spec.types(), List.of(profile.creatureType()))
                    && matchesAny(spec.subtypes(), profile.subtypes())
                    && matchesAny(spec.biomes(), profile.biomes())
                    && matchesAny(spec.alignments(), List.of(profile.alignment()));
        }

        private static boolean matchesEncounter(EncounterCandidateSpec spec, CreatureProfile profile) {
            return containsName(profile, spec.nameQuery())
                    && withinXp(profile, spec.minimumXp(), spec.maximumXp())
                    && matchesAny(spec.sizes(), List.of(profile.size()))
                    && matchesAny(spec.types(), List.of(profile.creatureType()))
                    && matchesAny(spec.subtypes(), profile.subtypes())
                    && matchesAny(spec.biomes(), profile.biomes())
                    && matchesAny(spec.alignments(), List.of(profile.alignment()));
        }

        private static boolean containsName(CreatureProfile profile, String query) {
            return query == null || profile.name().toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT));
        }

        private static boolean withinXp(CreatureProfile profile, Integer minimumXp, Integer maximumXp) {
            return (minimumXp == null || profile.xp() >= minimumXp)
                    && (maximumXp == null || profile.xp() <= maximumXp);
        }

        private static boolean matchesAny(List<String> filters, List<String> values) {
            return filters.isEmpty() || values.stream().anyMatch(filters::contains);
        }

        private static Comparator<CreatureProfile> sorter(CatalogSearchSpec spec) {
            Comparator<CreatureProfile> comparator = switch (spec.sortField()) {
                case "XP" -> Comparator.comparingInt(CreatureProfile::xp);
                case "CHALLENGE_RATING" -> Comparator.comparingInt(CreatureProfile::xp);
                default -> Comparator.comparing(CreatureProfile::name);
            };
            return spec.sortAscending() ? comparator : comparator.reversed();
        }

        private static CatalogRowData row(CreatureProfile profile) {
            return new CatalogRowData(
                    profile.id(),
                    profile.name(),
                    profile.size(),
                    profile.creatureType(),
                    profile.alignment(),
                    profile.challengeRating(),
                    profile.xp(),
                    profile.hitPoints(),
                    profile.armorClass());
        }

        private static EncounterCandidateProfile candidate(CreatureProfile profile) {
            return new EncounterCandidateProfile(
                    profile.id(),
                    profile.name(),
                    profile.creatureType(),
                    profile.challengeRating(),
                    profile.xp(),
                    profile.hitPoints(),
                    profile.hitDiceCount(),
                    profile.hitDiceSides(),
                    profile.hitDiceModifier(),
                    profile.armorClass(),
                    profile.initiativeBonus(),
                    profile.legendaryActionCount());
        }
    }
}
