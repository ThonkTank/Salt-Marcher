package features.world.dungeonmap.model.structures.corridor.planning;

record PlannerConfig(
        int maxExitCandidatesPerRoom,
        int maxTargetedExitCandidatesPerRoom,
        int baseExactExitPairEvaluations,
        int roomTargetExactPairEvaluations,
        int complexExactExitPairEvaluations
) {
}
