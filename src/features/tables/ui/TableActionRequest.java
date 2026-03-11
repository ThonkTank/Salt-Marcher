package features.tables.ui;

import javafx.scene.Node;

public record TableActionRequest<T>(T table, Node anchor) {
}
