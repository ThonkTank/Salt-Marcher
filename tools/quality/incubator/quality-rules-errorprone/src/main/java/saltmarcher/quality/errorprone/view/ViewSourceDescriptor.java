package saltmarcher.quality.errorprone.view;

import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;

public record ViewSourceDescriptor(
        String packageName,
        String sourceFileName,
        String topLevelSimpleName,
        String qualifiedTopLevelTypeName,
        ViewUnitKind unitKind,
        String area,
        String slot,
        String entry,
        ViewRole role,
        boolean recognizedDirectory
) {

    private static final Set<String> ACTIVE_AREAS = Set.of("leftbartabs", "statetabs", "dropdowns");
    private static final Set<String> SLOTCONTENT_SLOTS = Set.of(
            "controls", "main", "state", "details", "topbar", "primitives");

    public static ViewSourceDescriptor describe(CompilationUnitTree tree) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        String sourceFileName = sourceFileName(tree);
        String topLevelSimpleName = topLevelSimpleName(sourceFileName);
        String qualifiedTopLevelTypeName = packageName.isBlank()
                ? topLevelSimpleName
                : packageName + "." + topLevelSimpleName;
        ViewRole role = ViewRole.fromFileName(sourceFileName);
        if (!packageName.startsWith("src.view.")) {
            return new ViewSourceDescriptor(
                    packageName,
                    sourceFileName,
                    topLevelSimpleName,
                    qualifiedTopLevelTypeName,
                    null,
                    null,
                    null,
                    null,
                    role,
                    false);
        }
        String[] segments = packageName.split("\\.");
        if (segments.length == 4 && ACTIVE_AREAS.contains(segments[2])) {
            return new ViewSourceDescriptor(
                    packageName,
                    sourceFileName,
                    topLevelSimpleName,
                    qualifiedTopLevelTypeName,
                    ViewUnitKind.ACTIVE_ROOT,
                    segments[2],
                    null,
                    segments[3],
                    role,
                    true);
        }
        if (segments.length == 5
                && "slotcontent".equals(segments[2])
                && SLOTCONTENT_SLOTS.contains(segments[3])) {
            return new ViewSourceDescriptor(
                    packageName,
                    sourceFileName,
                    topLevelSimpleName,
                    qualifiedTopLevelTypeName,
                    ViewUnitKind.REUSABLE_SLOTCONTENT,
                    "slotcontent",
                    segments[3],
                    segments[4],
                    role,
                    true);
        }
        return new ViewSourceDescriptor(
                packageName,
                sourceFileName,
                topLevelSimpleName,
                qualifiedTopLevelTypeName,
                null,
                null,
                null,
                null,
                role,
                false);
    }

    public boolean isViewSource() {
        return packageName.startsWith("src.view.");
    }

    public boolean isRecognizedViewSource() {
        return recognizedDirectory && unitKind != null;
    }

    public boolean isActiveRootSource() {
        return unitKind == ViewUnitKind.ACTIVE_ROOT;
    }

    public boolean isSlotcontentSource() {
        return unitKind == ViewUnitKind.REUSABLE_SLOTCONTENT;
    }

    public boolean isPassiveViewSource() {
        return isRecognizedViewSource() && role == ViewRole.VIEW;
    }

    public boolean isPrimitiveReusableViewSource() {
        return isSlotcontentSource() && "primitives".equals(slot) && role == ViewRole.VIEW;
    }

    private static String sourceFileName(CompilationUnitTree tree) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        String name = tree.getSourceFile().getName().replace('\\', '/');
        int separator = name.lastIndexOf('/');
        return separator < 0 ? name : name.substring(separator + 1);
    }

    private static String topLevelSimpleName(String sourceFileName) {
        if (sourceFileName.endsWith(".java")) {
            return sourceFileName.substring(0, sourceFileName.length() - ".java".length());
        }
        return sourceFileName;
    }
}
