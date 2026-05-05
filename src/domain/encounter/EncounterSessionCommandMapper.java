package src.domain.encounter;

import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.application.ApplyEncounterSessionUseCase;
import src.domain.encounter.published.ApplyEncounterSessionCommand;
import src.domain.encounter.published.EncounterDifficultyBand;
import src.domain.encounter.published.EncounterGenerationTuning;
import src.domain.encounter.published.EncounterSessionSnapshot;
import src.domain.encounter.published.GenerateEncounterCommand;
import src.domain.encounter.session.entity.EncounterSession;

final class EncounterSessionCommandMapper {

    private EncounterSessionCommandMapper() {
    }

    static ApplyEncounterSessionUseCase.Command toInternalCommand(
            @Nullable ApplyEncounterSessionCommand command
    ) {
        if (command == null) {
            return ApplyEncounterSessionUseCase.Command.refresh();
        }
        return new ApplyEncounterSessionUseCase.Command(
                ApplyEncounterSessionUseCase.Action.valueOf(command.action().name()),
                command.generation() == null
                        ? Optional.empty()
                        : Optional.of(toInternalGenerateRequest(command.generation())),
                toInternalBuilderInputs(command.builderInputs()),
                command.creatureId(),
                command.planId(),
                command.delta(),
                command.token(),
                command.initiativeInputs().stream()
                        .map(entry -> new EncounterSession.InitiativeInputData(entry.id(), entry.initiative()))
                        .toList(),
                command.combatantId(),
                command.initiative(),
                command.partyMemberId(),
                command.amount(),
                command.healing());
    }

    private static EncounterSession.BuilderInputsData toInternalBuilderInputs(
            EncounterSessionSnapshot.BuilderInputs builderInputs
    ) {
        EncounterSessionSnapshot.BuilderInputs safeInputs = builderInputs == null
                ? EncounterSessionSnapshot.BuilderInputs.empty()
                : builderInputs;
        return new EncounterSession.BuilderInputsData(
                safeInputs.creatureTypes(),
                safeInputs.creatureSubtypes(),
                safeInputs.biomes(),
                toInternalDifficultyBand(safeInputs.targetDifficulty()),
                toInternalTuningData(safeInputs.tuning()),
                safeInputs.encounterTableIds());
    }

    private static EncounterSession.GenerateRequestData toInternalGenerateRequest(
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
        return new EncounterSession.GenerateRequestData(
                safeRequest.creatureTypes(),
                safeRequest.creatureSubtypes(),
                safeRequest.biomes(),
                toInternalDifficultyBand(safeRequest.targetDifficulty()),
                safeRequest.alternativeCount(),
                toInternalTuningData(safeRequest.tuning()),
                safeRequest.generationSeed(),
                safeRequest.encounterTableIds());
    }

    private static EncounterSession.DifficultyBand toInternalDifficultyBand(EncounterDifficultyBand band) {
        EncounterDifficultyBand effectiveBand = band == null ? EncounterDifficultyBand.defaultBand() : band;
        return switch (effectiveBand) {
            case AUTO -> EncounterSession.DifficultyBand.AUTO;
            case EASY -> EncounterSession.DifficultyBand.EASY;
            case MEDIUM -> EncounterSession.DifficultyBand.MEDIUM;
            case HARD -> EncounterSession.DifficultyBand.HARD;
            case DEADLY -> EncounterSession.DifficultyBand.DEADLY;
        };
    }

    private static EncounterSession.TuningData toInternalTuningData(EncounterGenerationTuning tuning) {
        EncounterGenerationTuning effective = tuning == null
                ? EncounterGenerationTuning.autoTuning()
                : tuning;
        return new EncounterSession.TuningData(
                effective.balanceLevel(),
                effective.amountValue(),
                effective.diversityLevel());
    }
}
