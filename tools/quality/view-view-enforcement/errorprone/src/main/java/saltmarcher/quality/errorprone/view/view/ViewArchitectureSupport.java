package saltmarcher.quality.errorprone.view.view;

import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.type.TypeMirror;

final class ViewArchitectureSupport {

    private ViewArchitectureSupport() {
    }

    static String packageName(CompilationUnitTree tree) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.packageName(tree);
    }

    static boolean isPanelViewSource(CompilationUnitTree tree) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.isPanelViewSource(tree);
    }

    static String topLevelSimpleName(CompilationUnitTree tree) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.topLevelSimpleName(tree);
    }

    static String qualifiedTopLevelTypeName(CompilationUnitTree tree) {
        String packageName = packageName(tree);
        String simpleName = topLevelSimpleName(tree);
        return packageName.isBlank() ? simpleName : packageName + "." + simpleName;
    }

    static ClassTree topLevelClass(CompilationUnitTree tree) {
        ClassTree[] result = {null};
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitClass(ClassTree classTree, Void unused) {
                if (result[0] == null) {
                    result[0] = classTree;
                }
                return null;
            }
        }.scan(tree, null);
        return result[0];
    }

    static Set<String> collectReferencedTypes(CompilationUnitTree tree) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.collectReferencedTypes(tree);
    }

    static void collectReferencedTypes(Tree tree, Set<String> referencedTypes) {
        saltmarcher.quality.errorprone.view.ViewArchitectureSupport.collectReferencedTypes(tree, referencedTypes);
    }

    static String getQualifiedTypeName(Symbol symbol) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.getQualifiedTypeName(symbol);
    }

    static String getQualifiedOwnerTypeName(Symbol symbol) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
    }

    static boolean isApplicationServiceReference(String referencedType) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.isApplicationServiceReference(
                referencedType);
    }

    static boolean isForbiddenViewInfrastructureJdkType(String referencedType) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.isForbiddenViewInfrastructureJdkType(
                referencedType);
    }

    static boolean isTopLevelViewModelReference(String referencedType) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.isTopLevelViewModelReference(
                referencedType);
    }

    static boolean isSameStemViewInputEventReference(
            String sourcePackageName,
            String viewSimpleName,
            String referencedType
    ) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.isSameStemViewInputEventReference(
                sourcePackageName,
                viewSimpleName,
                referencedType);
    }

    static ViewTypeInfo parseViewType(String referencedType) {
        saltmarcher.quality.errorprone.view.ViewArchitectureSupport.ViewTypeInfo viewType =
                saltmarcher.quality.errorprone.view.ViewArchitectureSupport.parseViewType(referencedType);
        if (viewType == null) {
            return null;
        }
        return new ViewTypeInfo(viewType.component(), viewType.bucket());
    }

    static boolean isSameViewRootReference(String sourcePackageName, String referencedType) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.isSameViewRootReference(
                sourcePackageName,
                referencedType);
    }

    static boolean isSameViewRootOrReusablePassiveViewReference(String sourcePackageName, String referencedType) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport
                .isSameViewRootOrReusablePassiveViewReference(sourcePackageName, referencedType);
    }

    static boolean isSameViewRootModelReference(String sourcePackageName, String referencedType) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.isSameViewRootModelReference(
                sourcePackageName,
                referencedType);
    }

    static boolean isConsumerOfSameRootViewInputEvent(TypeMirror typeMirror, String sourcePackageName) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.isConsumerOfSameRootViewInputEvent(
                typeMirror,
                sourcePackageName);
    }

    static boolean isConsumerOfSameStemViewInputEvent(
            TypeMirror typeMirror,
            String sourcePackageName,
            String viewSimpleName
    ) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.isConsumerOfSameStemViewInputEvent(
                typeMirror,
                sourcePackageName,
                viewSimpleName);
    }

    static boolean isTopLevelViewInputEventReference(String referencedType) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.isTopLevelViewInputEventReference(
                referencedType);
    }

    static boolean isTargetPublishedEventReference(String referencedType) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.isTargetPublishedEventReference(
                referencedType);
    }

    static String topLevelQualifiedTypeNameOf(String referencedType) {
        if (referencedType == null || referencedType.isBlank()) {
            return "";
        }
        String sanitizedType = referencedType.replaceFirst("\\$.*$", "");
        int nestedSeparator = sanitizedType.indexOf('.', packageNameOf(sanitizedType).length() + 1);
        if (nestedSeparator < 0) {
            return sanitizedType;
        }
        return sanitizedType.substring(0, nestedSeparator);
    }

    static Set<String> collectTypeReferences(TypeMirror typeMirror) {
        Set<String> referencedTypes = new LinkedHashSet<>();
        saltmarcher.quality.errorprone.view.ViewArchitectureSupport.collectTypeReferences(typeMirror, referencedTypes);
        return referencedTypes;
    }

    static boolean isCallbackSurfaceType(TypeMirror typeMirror) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.isCallbackSurfaceType(typeMirror);
    }

    static boolean isCallbackOrResultProtocolType(TypeMirror typeMirror) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.isCallbackOrResultProtocolType(typeMirror);
    }

    static boolean isObservableReadSurfaceType(TypeMirror typeMirror) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.isObservableReadSurfaceType(typeMirror);
    }

    static boolean isObservableMutableSurfaceType(TypeMirror typeMirror) {
        return saltmarcher.quality.errorprone.view.ViewArchitectureSupport.isObservableMutableSurfaceType(typeMirror);
    }

    private static String packageNameOf(String referencedType) {
        if (referencedType == null || referencedType.isBlank()) {
            return "";
        }
        String topLevelType = referencedType.replaceFirst("\\$.*$", "");
        if (topLevelType.startsWith("src.view.")) {
            String[] segments = topLevelType.split("\\.");
            if (segments.length >= 6 && "slotcontent".equals(segments[2])) {
                return String.join(".", segments[0], segments[1], segments[2], segments[3], segments[4]);
            }
            if (segments.length >= 4
                    && Set.of("leftbartabs", "statetabs", "dropdowns").contains(segments[2])) {
                return String.join(".", segments[0], segments[1], segments[2], segments[3]);
            }
        }
        int separator = topLevelType.lastIndexOf('.');
        return separator < 0 ? "" : topLevelType.substring(0, separator);
    }

    record ViewTypeInfo(String component, String bucket) {
    }
}
