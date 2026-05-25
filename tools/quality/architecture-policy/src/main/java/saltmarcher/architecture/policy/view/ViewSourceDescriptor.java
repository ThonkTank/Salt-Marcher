package saltmarcher.architecture.policy.view;

import com.sun.source.tree.CompilationUnitTree;

public record ViewSourceDescriptor(
        String packageName,
        String topLevelSimpleName,
        String qualifiedTopLevelTypeName,
        ViewUnitDescriptor unit,
        ViewRole role,
        ViewReuseTier reuseTier
) {

    public static ViewSourceDescriptor describe(CompilationUnitTree tree) {
        String packageName = tree.getPackageName() == null ? "" : tree.getPackageName().toString();
        String topLevelSimpleName = topLevelSimpleName(tree);
        return ViewPolicy.describeJavaType(packageName, topLevelSimpleName);
    }

    public static ViewSourceDescriptor describeQualifiedType(String qualifiedTypeName) {
        return ViewPolicy.describeQualifiedType(qualifiedTypeName);
    }

    public static ViewSourceDescriptor describeReferencedType(String referencedType) {
        return describeQualifiedType(topLevelQualifiedTypeName(referencedType));
    }

    public static String topLevelQualifiedTypeName(String referencedType) {
        return ViewPolicy.topLevelQualifiedTypeName(referencedType);
    }

    public ViewUnitKind unitKind() {
        return unit == null ? null : unit.kind();
    }

    public String group() {
        return unit == null ? null : unit.group();
    }

    public String entry() {
        return unit == null ? null : unit.entry();
    }

    public boolean isRecognizedViewSource() {
        return unit != null;
    }

    public boolean isActiveRootSource() {
        return unitKind() == ViewUnitKind.ACTIVE_ROOT;
    }

    public boolean isSlotcontentSource() {
        return unitKind() == ViewUnitKind.REUSABLE_SLOTCONTENT;
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
                && "details".equals(group())
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
}
