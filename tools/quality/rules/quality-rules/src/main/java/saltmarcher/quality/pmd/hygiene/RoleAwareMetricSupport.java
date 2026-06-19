package saltmarcher.quality.pmd.hygiene;

import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.ast.ASTTypeDeclaration;
import saltmarcher.architecture.policy.view.ViewRole;
import saltmarcher.architecture.policy.view.ViewSourceDescriptor;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

final class RoleAwareMetricSupport {

    private RoleAwareMetricSupport() {
    }

    static boolean isViewRoleShapeMetricSource(ASTCompilationUnit compilationUnit) {
        ViewSourceDescriptor descriptor = ViewSourceDescriptor.describeQualifiedType(topLevelTypeName(compilationUnit));
        return descriptor.isRecognizedViewSource()
                && isMetricOwnedViewRole(descriptor.role());
    }

    static boolean isTopLevelViewRoleShapeMetricSource(ASTTypeDeclaration typeDeclaration) {
        return typeDeclaration.isTopLevel()
                && isViewRoleShapeMetricSource((ASTCompilationUnit) typeDeclaration.getRoot());
    }

    static boolean isViewRoleShapeMetricType(ASTTypeDeclaration typeDeclaration) {
        return isViewRoleShapeMetricSource((ASTCompilationUnit) typeDeclaration.getRoot());
    }

    static boolean isTopLevelDomainPublishedBoundarySource(ASTTypeDeclaration typeDeclaration) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from((ASTCompilationUnit) typeDeclaration.getRoot());
        return typeDeclaration.isTopLevel() && sourceFacts.isDomainPublishedSource();
    }

    static boolean isFeatureRuntimeOperationsMetricSource(ASTCompilationUnit compilationUnit) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(compilationUnit);
        return sourceFacts.isFeatureRuntimeOperationsBoundarySource()
                || sourceFacts.isFeatureShellOperationsAdapterSource();
    }

    private static boolean isMetricOwnedViewRole(ViewRole role) {
        return role == ViewRole.BINDER
                || role == ViewRole.CONTENT_MODEL
                || role == ViewRole.CONTENT_PART_MODEL
                || role == ViewRole.CONTRIBUTION
                || role == ViewRole.CONTRIBUTION_MODEL
                || role == ViewRole.INTENT_HANDLER
                || role == ViewRole.PUBLISHED_EVENT
                || role == ViewRole.VIEW
                || role == ViewRole.VIEW_INPUT_EVENT;
    }

    private static String topLevelTypeName(ASTCompilationUnit compilationUnit) {
        String packageName = compilationUnit.getPackageName();
        String simpleName = compilationUnit.getTypeDeclarations()
                .filter(ASTTypeDeclaration::isTopLevel)
                .firstOpt()
                .map(ASTTypeDeclaration::getSimpleName)
                .orElse("");
        if (simpleName.isBlank()) {
            return "";
        }
        return packageName == null || packageName.isBlank() ? simpleName : packageName + "." + simpleName;
    }
}
