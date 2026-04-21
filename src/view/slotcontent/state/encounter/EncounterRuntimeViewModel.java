package src.view.slotcontent.state.encounter;

import java.util.List;
import java.util.Objects;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import src.domain.encounter.published.EncounterDifficultyBand;
import src.domain.encounter.published.EncounterGenerationTuning;

public final class EncounterRuntimeViewModel {

    private final ReadOnlyObjectWrapper<EncounterFilters> filters =
            new ReadOnlyObjectWrapper<>(EncounterFilters.empty());
    private final ReadOnlyObjectWrapper<EncounterDifficultyBand> difficulty =
            new ReadOnlyObjectWrapper<>(EncounterDifficultyBand.autoBand());
    private final ReadOnlyObjectWrapper<EncounterGenerationTuning> tuning =
            new ReadOnlyObjectWrapper<>(EncounterGenerationTuning.autoTuning());
    private final ReadOnlyObjectWrapper<List<Long>> encounterTableIds =
            new ReadOnlyObjectWrapper<>(List.of());
    private final ReadOnlyObjectWrapper<CreatureAddRequest> creatureAddRequest =
            new ReadOnlyObjectWrapper<>();
    private final ReadOnlyStringWrapper partyRefreshToken = new ReadOnlyStringWrapper("");

    private long nextRequestId;
    private long nextPartyRefreshId;

    public ReadOnlyObjectProperty<EncounterFilters> filtersProperty() {
        return filters.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<EncounterDifficultyBand> difficultyProperty() {
        return difficulty.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<EncounterGenerationTuning> tuningProperty() {
        return tuning.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<List<Long>> encounterTableIdsProperty() {
        return encounterTableIds.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<CreatureAddRequest> creatureAddRequestProperty() {
        return creatureAddRequest.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty partyRefreshTokenProperty() {
        return partyRefreshToken.getReadOnlyProperty();
    }

    public EncounterFilters filters() {
        return filters.get();
    }

    public EncounterDifficultyBand difficulty() {
        EncounterDifficultyBand current = difficulty.get();
        return current == null ? EncounterDifficultyBand.autoBand() : current;
    }

    public EncounterGenerationTuning tuning() {
        EncounterGenerationTuning current = tuning.get();
        return current == null ? EncounterGenerationTuning.autoTuning() : current;
    }

    public List<Long> encounterTableIds() {
        List<Long> current = encounterTableIds.get();
        return current == null ? List.of() : List.copyOf(current);
    }

    public void updateFilters(List<String> types, List<String> subtypes, List<String> biomes) {
        filters.set(new EncounterFilters(types, subtypes, biomes));
    }

    public void selectDifficulty(EncounterDifficultyBand nextDifficulty) {
        difficulty.set(nextDifficulty == null ? EncounterDifficultyBand.autoBand() : nextDifficulty);
    }

    public void updateTuning(int balanceLevel, double amountValue, int diversityLevel) {
        tuning.set(new EncounterGenerationTuning(balanceLevel, amountValue, diversityLevel));
    }

    public void updateEncounterTables(List<Long> tableIds) {
        encounterTableIds.set(copyIds(tableIds));
    }

    public void requestCreatureAdd(long creatureId) {
        if (creatureId <= 0) {
            return;
        }
        creatureAddRequest.set(new CreatureAddRequest(++nextRequestId, creatureId));
    }

    public void partyChanged() {
        partyRefreshToken.set("party:" + ++nextPartyRefreshId);
    }

    public record EncounterFilters(
            List<String> types,
            List<String> subtypes,
            List<String> biomes
    ) {
        public EncounterFilters {
            types = copyValues(types);
            subtypes = copyValues(subtypes);
            biomes = copyValues(biomes);
        }

        public static EncounterFilters empty() {
            return new EncounterFilters(List.of(), List.of(), List.of());
        }

        private static List<String> copyValues(List<String> values) {
            if (values == null || values.isEmpty()) {
                return List.of();
            }
            return values.stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(value -> !value.isEmpty())
                    .distinct()
                    .toList();
        }
    }

    private static List<Long> copyIds(List<Long> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return values.stream()
                .filter(Objects::nonNull)
                .filter(value -> value > 0)
                .distinct()
                .toList();
    }

    public record CreatureAddRequest(
            long requestId,
            long creatureId
    ) {
    }
}
