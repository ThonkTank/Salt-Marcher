package saltmarcher.architecture.policy.view;

import java.util.List;
import java.util.Set;

public final class ViewPolicy {

    private static final Set<String> ACTIVE_AREAS = Set.of("leftbartabs", "statetabs", "dropdowns");
    private static final Set<String> SLOTCONTENT_SLOTS = Set.of(
            "controls", "main", "state", "details", "topbar", "primitives");

    private ViewPolicy() {
    }

    public static boolean isViewSourcePath(String relativePath) {
        List<String> segments = pathSegments(relativePath);
        return segments.size() >= 4
                && "src".equals(segments.get(0))
                && "view".equals(segments.get(1));
    }

    public static ViewSourceDescriptor describePath(String relativePath) {
        List<String> segments = pathSegments(relativePath);
        String fileName = segments.isEmpty() ? "" : segments.getLast();
        ViewRole role = ViewRole.fromFileName(fileName);
        String topLevelSimpleName = fileName.endsWith(".java")
                ? fileName.substring(0, fileName.length() - ".java".length())
                : fileName;
        ViewUnitDescriptor unit = describePathUnit(segments);
        String packageName = packageNameFromPath(segments);
        String qualifiedTopLevelTypeName = packageName.isBlank()
                ? topLevelSimpleName
                : packageName + "." + topLevelSimpleName;
        return new ViewSourceDescriptor(
                packageName,
                topLevelSimpleName,
                qualifiedTopLevelTypeName,
                unit,
                role,
                reuseTier(segments));
    }

    public static ViewSourceDescriptor describeJavaType(String packageName, String topLevelSimpleName) {
        String qualifiedTopLevelTypeName = packageName == null || packageName.isBlank()
                ? topLevelSimpleName
                : packageName + "." + topLevelSimpleName;
        return describeQualifiedTypeName(packageName == null ? "" : packageName, topLevelSimpleName, qualifiedTopLevelTypeName);
    }

    public static ViewSourceDescriptor describeQualifiedType(String qualifiedTypeName) {
        if (qualifiedTypeName == null || qualifiedTypeName.isBlank()) {
            return new ViewSourceDescriptor("", "", "", null, ViewRole.UNKNOWN, ViewReuseTier.OTHER);
        }
        String topLevelTypeName = topLevelQualifiedTypeName(qualifiedTypeName);
        int separator = topLevelTypeName.lastIndexOf('.');
        String packageName = separator < 0 ? "" : topLevelTypeName.substring(0, separator);
        String topLevelSimpleName = separator < 0 ? topLevelTypeName : topLevelTypeName.substring(separator + 1);
        return describeQualifiedTypeName(packageName, topLevelSimpleName, topLevelTypeName);
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

    public static ViewUnitDescriptor describePathUnit(List<String> segments) {
        if (segments.size() == 5 && ACTIVE_AREAS.contains(segments.get(2))) {
            return new ViewUnitDescriptor(ViewUnitKind.ACTIVE_ROOT, segments.get(2), segments.get(3));
        }
        if (segments.size() == 6
                && "slotcontent".equals(segments.get(2))
                && SLOTCONTENT_SLOTS.contains(segments.get(3))) {
            return new ViewUnitDescriptor(ViewUnitKind.REUSABLE_SLOTCONTENT, segments.get(3), segments.get(4));
        }
        return null;
    }

    public static ViewReuseTier reuseTier(List<String> segments) {
        if (segments.size() >= 4 && "slotcontent".equals(segments.get(2)) && "primitives".equals(segments.get(3))) {
            return ViewReuseTier.PRIMITIVE;
        }
        if (segments.size() >= 3 && "slotcontent".equals(segments.get(2))) {
            return ViewReuseTier.REUSABLE;
        }
        if (segments.size() >= 4 && ACTIVE_AREAS.contains(segments.get(2))) {
            return ViewReuseTier.FEATURE;
        }
        return ViewReuseTier.OTHER;
    }

    public static List<String> pathSegments(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            return List.of();
        }
        return List.of(relativePath.replace('\\', '/').split("/"));
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
                    role,
                    ViewReuseTier.OTHER);
        }
        List<String> packageSegments = List.of(packageName.split("\\."));
        ViewUnitDescriptor unit = describePackageUnit(packageSegments);
        return new ViewSourceDescriptor(
                packageName,
                topLevelSimpleName,
                qualifiedTopLevelTypeName,
                unit,
                role,
                reuseTier(packageSegments));
    }

    private static ViewUnitDescriptor describePackageUnit(List<String> segments) {
        if (segments.size() == 4 && ACTIVE_AREAS.contains(segments.get(2))) {
            return new ViewUnitDescriptor(ViewUnitKind.ACTIVE_ROOT, segments.get(2), segments.get(3));
        }
        if (segments.size() == 5
                && "slotcontent".equals(segments.get(2))
                && SLOTCONTENT_SLOTS.contains(segments.get(3))) {
            return new ViewUnitDescriptor(ViewUnitKind.REUSABLE_SLOTCONTENT, segments.get(3), segments.get(4));
        }
        return null;
    }

    private static String packageNameFromPath(List<String> segments) {
        if (segments.isEmpty()) {
            return "";
        }
        int fileIndex = segments.size() - 1;
        if (!segments.get(fileIndex).endsWith(".java")) {
            return "";
        }
        return String.join(".", segments.subList(0, fileIndex));
    }
}
