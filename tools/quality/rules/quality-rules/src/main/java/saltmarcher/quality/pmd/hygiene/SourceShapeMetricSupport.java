package saltmarcher.quality.pmd.hygiene;

import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.ast.ASTTypeDeclaration;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

final class SourceShapeMetricSupport {

    private SourceShapeMetricSupport() {
    }

    static boolean isViewShapeMetricSource(ASTCompilationUnit compilationUnit) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(compilationUnit);
        return sourceFacts.isViewMetricCarrierSource();
    }

    static boolean isTopLevelViewShapeMetricSource(ASTTypeDeclaration typeDeclaration) {
        return typeDeclaration.isTopLevel()
                && isViewShapeMetricSource((ASTCompilationUnit) typeDeclaration.getRoot());
    }

    static boolean isViewShapeMetricType(ASTTypeDeclaration typeDeclaration) {
        return isViewShapeMetricSource((ASTCompilationUnit) typeDeclaration.getRoot());
    }

    static boolean isTopLevelDomainPublishedBoundarySource(ASTTypeDeclaration typeDeclaration) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from((ASTCompilationUnit) typeDeclaration.getRoot());
        return typeDeclaration.isTopLevel() && sourceFacts.isDomainPublishedSource();
    }

    static boolean isFeatureRuntimeArchitectureMetricSource(ASTCompilationUnit compilationUnit) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(compilationUnit);
        return sourceFacts.isFeatureRuntimeOperationsBoundarySource()
                || sourceFacts.isFeatureRuntimeAssemblySource()
                || sourceFacts.isFeatureRuntimeRootSource()
                || sourceFacts.isFeatureShellOperationsAdapterSource();
    }

    static boolean isTopLevelFeatureRuntimeArchitectureMetricSource(ASTTypeDeclaration typeDeclaration) {
        return typeDeclaration.isTopLevel()
                && isFeatureRuntimeArchitectureMetricSource((ASTCompilationUnit) typeDeclaration.getRoot());
    }

}
