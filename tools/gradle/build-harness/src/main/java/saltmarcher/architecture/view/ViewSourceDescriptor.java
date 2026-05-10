package saltmarcher.architecture.view;

import saltmarcher.architecture.SourceFile;

public record ViewSourceDescriptor(
        SourceFile sourceFile,
        ViewUnitDescriptor unit,
        ViewRole role
) {

    public boolean isRecognizedViewSource() {
        return unit != null;
    }

    public boolean isActiveRootSource() {
        return isRecognizedViewSource() && unit.kind() == ViewUnitKind.ACTIVE_ROOT;
    }

    public boolean isSlotcontentSource() {
        return isRecognizedViewSource() && unit.kind() == ViewUnitKind.REUSABLE_SLOTCONTENT;
    }

    public String source() {
        return sourceFile.relativePath();
    }

    public String stem() {
        return role.stem(sourceFile.fileName());
    }
}
