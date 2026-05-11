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
        String topLevelTypeName = topLevelQualifiedTypeName(qualifiedTypeName);
        int separator = topLevelTypeName.lastIndexOf('.');
        String packageName = separator < 0 ? "" : topLevelTypeName.substring(0, separator);
        String topLevelSimpleName = separator < 0 ? topLevelTypeName : topLevelTypeName.substring(separator + 1);
        return describeQualifiedTypeName(packageName, topLevelSimpleName, topLevelTypeName);
    }

    public static ViewSourceDescriptor describeReferencedType(String referencedType) {
        return describeQualifiedType(topLevelQualifiedTypeName(referencedType));
    }

    public static String topLevelQualifiedTypeName(String referencedType) {
        if (referencedType == null || referencedType.isBlank()) {
            return "";
        }
        String normalizedType = referencedType.replaceFirst("\\$.*$", "");
        if (!normalizedType.startsWith("src.view.")) {
            return normalizedType;
        }
        String[] segments = normalizedType.split("\\.");
        if (segments.length >= 6 && "slotcontent".equals(segments[2])) {
            return String.join(".", segments[0], segments[1], segments[2], segments[3], segments[4], segments[5]);
        }
        if (segments.length >= 5 && ACTIVE_AREAS.contains(segments[2])) {
            return String.join(".", segments[0], segments[1], segments[2], segments[3], segments[4]);
        }
        return normalizedType;
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

    public boolean hasRole(ViewRole expectedRole) {
        return role == expectedRole;
    }

    public boolean isProjectionModelSource() {
        return role.isProjectionModel();
    }

    public boolean isSameViewUnitAs(ViewSourceDescriptor other) {
        return other != null && packageName.equals(other.packageName);
    }

    public boolean isSameViewUnitPackage(String otherPackageName) {
        return packageName.equals(otherPackageName);
    }

    public boolean isReusableSlotcontentRole(ViewRole expectedRole) {
        return isSlotcontentSource() && role == expectedRole;
    }

    public boolean isReusableProjectionModelSource() {
        return isSlotcontentSource() && role.isProjectionModel();
    }

    public boolean isSameViewUnitOrReusableSlotcontent(ViewSourceDescriptor other, ViewRole reusableRole) {
        return isSameViewUnitAs(other) || (other != null && other.isReusableSlotcontentRole(reusableRole));
    }

    public boolean isSameViewUnitOrReusableProjectionModel(ViewSourceDescriptor other) {
        return isSameViewUnitAs(other) || (other != null && other.isReusableProjectionModelSource());
    }

    public boolean isDetailEntrySource() {
        return isSlotcontentSource()
                && "details".equals(group)
                && (role == ViewRole.VIEW
                || role == ViewRole.INSPECTOR_ENTRY
                || role.isProjectionModel());
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
