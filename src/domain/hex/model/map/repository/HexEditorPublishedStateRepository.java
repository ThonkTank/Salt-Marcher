package src.domain.hex.model.map.repository;

import src.domain.hex.model.map.HexEditorState;

public interface HexEditorPublishedStateRepository {

    void publish(HexEditorState state);
}
