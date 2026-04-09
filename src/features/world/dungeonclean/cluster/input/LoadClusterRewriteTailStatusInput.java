package features.world.dungeonclean.cluster.input;

@SuppressWarnings("unused")
public record LoadClusterRewriteTailStatusInput() {

    public record StatusInput(
            long roomCount,
            long roomLevelCount,
            long roomNarrationCount,
            String errorMessage
    ) {

        public StatusInput(
                features.world.dungeonclean.cluster.state.LoadClusterRewriteTailStatusState state
        ) {
            this(
                    state == null ? 0L : state.roomCount(),
                    state == null ? 0L : state.roomLevelCount(),
                    state == null ? 0L : state.roomNarrationCount(),
                    "");
        }
    }
}
