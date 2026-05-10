package saltmarcher.quality.errorprone.view;

import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;

public record ViewSourceDescriptor(
        String packageName,
        String topLevelSimpleName,
        String qualifiedTopLevelTypeName,
        ViewUnitKind unitKind,
        String group,
        ViewRole role
) {

    private static final Set<String> ACTIVE_AREAS = Set.of("leftbartabs", "statetabs", "dropdowns");
    private static final Set<String> SLOTCONTENT_SLOTS = Set.of(
            "controls", "main", "state", "details", "topbar", "primitives");

    public static ViewSourceDescriptor describe(CompilationUnitTree tree) {
        String packageName = tree.getPackageName() == null ? "" : tree.getPackageName().toString();
        String topLevelSimpleName = topLevelSimpleName(tree);
        String qualifiedTopLevelTypeName = packageName.isBlank()
                ? topLevelSimpleName
                : packageName + "." + topLevelSimpleName;
        return describeQualifiedTypeName(packageName, topLevelSimpleName, qualifiedTopLevelTypeName);
    }

    public static ViewSourceDescriptor describeQualifiedType(String qualifiedTypeName) {
        if (qualifiedTypeName == null || qualifiedTypeName.isBlank()) {
            return new ViewSourceDescriptor("", "", "", null, null, ViewRole.UNKNOWN);
        }
        String topLevelTypeName = qualifiedTypeName.replaceFirst("\\$.*$", "");
        int separator = topLevelTypeName.lastIndexOf('.');
        String packageName = separator < 0 ? "" : topLevelTypeName.substring(0, separator);
        String topLevelSimpleName = separator < 0 ? topLevelTypeName : topLevelTypeName.substring(separator + 1);
        return describeQualifiedTypeName(packageName, topLevelSimpleName, topLevelTypeName);
    }

    public boolean isRecognizedViewSource() {
        return unitKind != null;
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

    private static String topLevelSimpleName(CompilationUnitTree tree) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        String name = tree.getSourceFile().getName().replace('\\', '/');
        int separator = name.lastIndexOf('/');
        String sourceFileName = separator < 0 ? name : name.substring(separator + 1);
        return sourceFileName.endsWith(".java")
                ? sourceFileName.substring(0, sourceFileName.length() - ".java".length())
                : sourceFileName;
    }

    private static ViewSourceDescriptor describeQualifiedTypeName(
            String packageName,
            String topLevelSimpleName,
            String qualifiedTopLevelTypeName
    ) {
        ViewRole role = ViewRole.fromFileName(topLevelSimpleName + ".java");
        if (!packageName.startsWith("src.view.")) {
            return new ViewSourceDescriptor(
                    packageName,
                    topLevelSimpleName,
                    qualifiedTopLevelTypeName,
                    null,
                    null,
                    role);
        }
        String[] segments = packageName.split("\\.");
        if (segments.length == 4 && ACTIVE_AREAS.contains(segments[2])) {
            return new ViewSourceDescriptor(
                    packageName,
                    topLevelSimpleName,
                    qualifiedTopLevelTypeName,
                    ViewUnitKind.ACTIVE_ROOT,
                    segments[2],
                    role);
        }
        if (segments.length == 5
                && "slotcontent".equals(segments[2])
                && SLOTCONTENT_SLOTS.contains(segments[3])) {
            return new ViewSourceDescriptor(
                    packageName,
                    topLevelSimpleName,
                    qualifiedTopLevelTypeName,
                    ViewUnitKind.REUSABLE_SLOTCONTENT,
                    segments[3],
                    role);
        }
        return new ViewSourceDescriptor(
                packageName,
                topLevelSimpleName,
                qualifiedTopLevelTypeName,
                null,
                null,
                role);
    }
}
