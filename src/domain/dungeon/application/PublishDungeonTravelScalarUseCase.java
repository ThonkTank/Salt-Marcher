package src.domain.dungeon.application;

final class PublishDungeonTravelScalarUseCase {

    private PublishDungeonTravelScalarUseCase() {
    }

    static int revision(long revision) {
        if (revision > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return Math.max(0, (int) revision);
    }
}
