package src.view.mapcanvas.View;
import javafx.scene.control.Label;
final class MapWorkspaceHeaderLabels {
    private final Label titleLabel;
    private final Label subtitleLabel;
    private final Label modeBadge;
    private final Label statusLabel;
    MapWorkspaceHeaderLabels(Label titleLabel, Label subtitleLabel, Label modeBadge, Label statusLabel) {
        this.titleLabel = titleLabel;
        this.subtitleLabel = subtitleLabel;
        this.modeBadge = modeBadge;
        this.statusLabel = statusLabel;
    }
    Label titleLabel() {
        return titleLabel;
    }
    Label subtitleLabel() {
        return subtitleLabel;
    }
    Label modeBadge() {
        return modeBadge;
    }
    Label statusLabel() {
        return statusLabel;
    }
}
