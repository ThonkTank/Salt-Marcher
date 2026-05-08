package saltmarcher.architecture.view;

import saltmarcher.architecture.SourceFile;

public record ViewSourceDescriptor(
        SourceFile sourceFile,
        ViewUnitDescriptor unit,
        ViewRole role,
        boolean recognizedDirectory
) {

    public boolean isRecognizedViewSource() {
        return recognizedDirectory && unit != null;
    }

    public boolean isActiveRootSource() {
        return unit != null && unit.kind() == ViewUnitKind.ACTIVE_ROOT;
    }

    public boolean isSlotcontentSource() {
        return unit != null && unit.kind() == ViewUnitKind.REUSABLE_SLOTCONTENT;
    }

    public String source() {
        return sourceFile.relativePath();
    }

    public String stem() {
        return role.stem(sourceFile.fileName());
    }
}
