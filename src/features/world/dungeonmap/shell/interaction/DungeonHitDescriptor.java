package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.interaction.DungeonHitKind;

import java.util.List;
import java.util.Objects;

public record DungeonHitDescriptor(
        DungeonHitSubject subject,
        List<DungeonHitSurface> surfaces
) {

    public DungeonHitDescriptor {
        subject = Objects.requireNonNull(subject, "subject");
        surfaces = surfaces == null ? List.of() : List.copyOf(surfaces);
        if (surfaces.isEmpty()) {
            throw new IllegalArgumentException("Hit descriptors require at least one surface");
        }
        if (surfaces.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("Hit descriptor surfaces must not contain null");
        }
    }

    public DungeonHitKind kind() {
        return subject.kind();
    }
}
