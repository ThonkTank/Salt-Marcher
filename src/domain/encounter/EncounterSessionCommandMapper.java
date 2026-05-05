package src.domain.encounter;

import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.generation.value.EncounterGenerationInputs;
import src.domain.encounter.generation.value.EncounterGenerationRequest;
import src.domain.encounter.generation.value.EncounterRequestedDifficulty;
import src.domain.encounter.generation.value.EncounterTuningIntent;
import src.domain.encounter.published.ApplyEncounterSessionCommand;
import src.domain.encounter.published.EncounterDifficultyBand;
import src.domain.encounter.published.EncounterGenerationTuning;
import src.domain.encounter.published.EncounterSessionSnapshot;
import src.domain.encounter.published.GenerateEncounterCommand;
import src.domain.encounter.session.entity.EncounterSessionViewState;
import src.domain.encounter.session.service.EncounterSessionCommand;

final class EncounterSessionCommandMapper {

    private EncounterSessionCommandMapper() {
    }

    static EncounterSessionCommand toInternalCommand(
            @Nullable ApplyEncounterSessionCommand command
    ) {
        if (command == null) {
            return EncounterSessionCommand.refresh();
        }
        return new EncounterSessionCommand(
                EncounterSessionCommand.Action.valueOf(command.action().name()),
                command.generation() == null
                        ? Optional.empty()
                        : Optional.of(toInternalGenerateRequest(command.generation())),
                toInternalBuilderInputs(command.builderInputs()),
                command.creatureId(),
                command.planId(),
                command.delta(),
                command.token(),
                command.initiativeInputs().stream()
                        .map(entry -> new EncounterSessionViewState.InitiativeInputData(entry.id(), entry.initiative()))
                        .toList(),
                command.combatantId(),
                command.initiative(),
                command.partyMemberId(),
                command.amount(),
                command.healing());
    }

    private static EncounterGenerationInputs toInternalBuilderInputs(
            EncounterSessionSnapshot.BuilderInputs builderInputs
    ) {
        EncounterSessionSnapshot.BuilderInputs safeInputs = builderInputs == null
                ? EncounterSessionSnapshot.BuilderInputs.empty()
                : builderInputs;
        return new EncounterGenerationInputs(
                safeInputs.creatureTypes(),
                safeInputs.creatureSubtypes(),
                safeInputs.biomes(),
                toInternalDifficultyBand(safeInputs.targetDifficulty()),
                toInternalTuningData(safeInputs.tuning()),
                safeInputs.encounterTableIds());
    }

    private static EncounterGenerationRequest toInternalGenerateRequest(
            @Nullable GenerateEncounterCommand request
    ) {
        GenerateEncounterCommand safeRequest = request == null
                ? new GenerateEncounterCommand(
                        List.of(),
                        List.of(),
                        List.of(),
                        EncounterDifficultyBand.defaultBand(),
                        5,
                        List.of(),
                        List.of())
                : request;
        return new EncounterGenerationRequest(
                new EncounterGenerationInputs(
                        safeRequest.creatureTypes(),
                        safeRequest.creatureSubtypes(),
                        safeRequest.biomes(),
                        toInternalDifficultyBand(safeRequest.targetDifficulty()),
                        toInternalTuningData(safeRequest.tuning()),
                        safeRequest.encounterTableIds()),
                safeRequest.alternativeCount(),
                safeRequest.generationSeed(),
                List.of(),
                List.of());
    }

    private static EncounterRequestedDifficulty toInternalDifficultyBand(EncounterDifficultyBand band) {
        EncounterDifficultyBand effectiveBand = band == null ? EncounterDifficultyBand.defaultBand() : band;
        return switch (effectiveBand) {
            case AUTO -> EncounterRequestedDifficulty.AUTO;
            case EASY -> EncounterRequestedDifficulty.EASY;
            case MEDIUM -> EncounterRequestedDifficulty.MEDIUM;
            case HARD -> EncounterRequestedDifficulty.HARD;
            case DEADLY -> EncounterRequestedDifficulty.DEADLY;
        };
    }

    private static EncounterTuningIntent toInternalTuningData(EncounterGenerationTuning tuning) {
        EncounterGenerationTuning effective = tuning == null
                ? EncounterGenerationTuning.autoTuning()
                : tuning;
        return new EncounterTuningIntent(
                effective.balanceLevel(),
                effective.amountValue(),
                effective.diversityLevel());
    }
}
