package src.domain.hex.model.map.usecase;

import java.util.Objects;

public final class LoadHexEditorUseCase {

    private final LoadHexEditorStateUseCase loadEditorStateUseCase;

    public LoadHexEditorUseCase(LoadHexEditorStateUseCase loadEditorStateUseCase) {
        this.loadEditorStateUseCase = Objects.requireNonNull(loadEditorStateUseCase, "loadEditorStateUseCase");
    }

    public void execute() {
        loadEditorStateUseCase.execute();
    }
}
