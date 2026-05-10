package saltmarcher.quality.errorprone.view;

import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import com.sun.tools.javac.code.Type;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.function.Predicate;
import javax.lang.model.element.Element;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.lang.model.type.ArrayType;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.ErrorType;
import javax.lang.model.type.ExecutableType;
import javax.lang.model.type.IntersectionType;
import javax.lang.model.type.NoType;
import javax.lang.model.type.NullType;
import javax.lang.model.type.PrimitiveType;
import javax.lang.model.type.TypeMirror;
import javax.lang.model.type.TypeVariable;
import javax.lang.model.type.UnionType;
import javax.lang.model.type.WildcardType;
import javax.lang.model.util.ElementFilter;
import javax.lang.model.util.SimpleTypeVisitor14;

public final class ViewArchitectureSupport {

    private static final Set<String> BINDER_ALLOWED_SHELL_TYPES = Set.of(
            "shell.api.ContributionKey", "shell.api.InspectorEntrySpec", "shell.api.InspectorSink",
            "shell.api.NavigationGraphicResource", "shell.api.NavigationGroupSpec", "shell.api.ShellBinding",
            "shell.api.ShellContributionSpec", "shell.api.ShellLeftBarTabMode", "shell.api.ShellLeftBarTabSpec",
            "shell.api.ShellRuntimeContext", "shell.api.ShellSlot", "shell.api.ShellStateTabSpec",
            "shell.api.ServiceRegistry", "shell.api.ShellTopBarSpec");
    private static final Set<String> CONTRIBUTION_ALLOWED_SHELL_TYPES = Set.of(
            "shell.api.ContributionKey", "shell.api.InspectorEntrySpec", "shell.api.InspectorSink",
            "shell.api.NavigationGraphicResource", "shell.api.NavigationGroupSpec", "shell.api.ShellBinding",
            "shell.api.ShellContribution", "shell.api.ShellContributionSpec", "shell.api.ShellLeftBarTabMode",
            "shell.api.ShellLeftBarTabSpec", "shell.api.ShellRuntimeContext", "shell.api.ShellStateTabSpec",
            "shell.api.ShellTopBarSpec");
    private static final Set<String> FORBIDDEN_VIEW_JDK_INFRASTRUCTURE_TYPES = Set.of(
            "java.lang.ClassLoader", "java.lang.Process", "java.lang.ProcessBuilder", "java.lang.Runtime",
            "java.lang.Thread", "java.lang.ThreadGroup", "java.util.Timer", "java.util.TimerTask");

    private ViewArchitectureSupport() {
    }

    public static ClassTree topLevelClass(CompilationUnitTree tree) {
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

    public static Set<String> collectReferencedTypes(CompilationUnitTree tree) {
        Set<String> referencedTypes = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void scan(Tree currentTree, Void unused) {
                if (currentTree != null) {
                    collectReferencedTypes(currentTree, referencedTypes);
                }
                return super.scan(currentTree, unused);
            }

            @Override
            public Void visitMemberSelect(MemberSelectTree memberSelectTree, Void unused) {
                collectReferencedTypes(memberSelectTree.getExpression(), referencedTypes);
                return super.visitMemberSelect(memberSelectTree, unused);
            }
        }.scan(tree, null);
        return referencedTypes;
    }

    public static void collectReferencedTypes(Tree tree, Set<String> referencedTypes) {
        Symbol symbol = ASTHelpers.getSymbol(tree);
        if (symbol != null) {
            addReference(getQualifiedTypeName(symbol), referencedTypes);
            addReference(getQualifiedOwnerTypeName(symbol), referencedTypes);
        }
        collectTypeReferences(ASTHelpers.getType(tree), referencedTypes);
    }

    public static String getQualifiedTypeName(Symbol symbol) {
        if (symbol instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        if (symbol != null && symbol.type != null && symbol.type.tsym instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }

    public static String getQualifiedOwnerTypeName(Symbol symbol) {
        if (symbol == null || symbol.owner == null) {
            return null;
        }
        if (symbol.owner instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }

    public static String qualifiedTypeNameOf(NewClassTree newClassTree) {
        Type instantiatedType = ASTHelpers.getType(newClassTree);
        if (instantiatedType != null && instantiatedType.tsym instanceof Symbol.ClassSymbol classSymbol) {
            String qualifiedName = classSymbol.getQualifiedName().toString();
            if (!qualifiedName.isBlank()) {
                return qualifiedName;
            }
        }
        Symbol symbol = ASTHelpers.getSymbol(newClassTree);
        if (symbol == null) {
            return instantiatedType == null ? "" : instantiatedType.toString();
        }
        String qualifiedTypeName = getQualifiedTypeName(symbol);
        if (qualifiedTypeName != null && !qualifiedTypeName.isBlank()) {
            return qualifiedTypeName;
        }
        return instantiatedType == null ? "" : instantiatedType.toString();
    }

    public static boolean isAllowedViewModelDomainBoundary(String referencedType) {
        return isApplicationServiceReference(referencedType)
                || referencedType.matches("^src\\.domain\\.[^.]+\\.published\\..+");
    }

    public static boolean isAllowedPresentationModelDomainBoundary(String referencedType) {
        return referencedType != null
                && referencedType.matches("^src\\.domain\\.[^.]+\\.published\\..+")
                && !isDomainWriteCarrier(referencedType);
    }

    public static boolean isAllowedIntentHandlerDomainBoundary(String sourcePackageName, String referencedType) {
        return isApplicationServiceReference(referencedType);
    }

    public static boolean isApplicationServiceReference(String referencedType) {
        return referencedType != null
                && referencedType.matches("^src\\.domain\\.[^.]+\\.[^.]+ApplicationService((\\$|\\.).*)?$");
    }

    public static boolean isAllowedViewModelJavafxType(String referencedType) {
        return referencedType.startsWith("javafx.beans.")
                || referencedType.startsWith("javafx.collections.");
    }

    public static boolean isAllowedModelJavafxType(String referencedType) {
        return isAllowedViewModelJavafxType(referencedType)
                || "javafx.scene.Node".equals(referencedType);
    }

    public static boolean isForbiddenViewInfrastructureJdkType(String referencedType) {
        if (referencedType == null) {
            return false;
        }
        return referencedType.startsWith("java.io.")
                || referencedType.startsWith("java.lang.invoke.")
                || referencedType.startsWith("java.lang.reflect.")
                || referencedType.startsWith("java.net.")
                || referencedType.startsWith("java.nio.file.")
                || referencedType.startsWith("java.sql.")
                || referencedType.startsWith("java.util.concurrent.")
                || FORBIDDEN_VIEW_JDK_INFRASTRUCTURE_TYPES.contains(referencedType)
                || FORBIDDEN_VIEW_JDK_INFRASTRUCTURE_TYPES.stream()
                        .anyMatch(forbiddenType -> referencedType.startsWith(forbiddenType + "$"));
    }

    public static boolean isRecognizedViewReference(String referencedType) {
        return referencedViewSource(referencedType).isRecognizedViewSource();
    }

    public static boolean isTargetViewModelReference(String referencedType) {
        return isProjectionModelRole(referencedViewSource(referencedType).role());
    }

    public static boolean isTargetPanelViewReference(String referencedType) {
        return referencedViewSource(referencedType).role() == ViewRole.VIEW;
    }

    public static boolean isTargetViewInputEventReference(String referencedType) {
        return referencedViewSource(referencedType).role() == ViewRole.VIEW_INPUT_EVENT;
    }

    public static boolean isTargetPublishedEventReference(String referencedType) {
        return referencedViewSource(referencedType).role() == ViewRole.PUBLISHED_EVENT;
    }

    public static boolean isIntentHandlerReference(String referencedType) {
        return referencedViewSource(referencedType).role() == ViewRole.INTENT_HANDLER;
    }

    public static boolean isSameStemViewInputEventReference(
            String sourcePackageName,
            String viewSimpleName,
            String referencedType
    ) {
        if (viewSimpleName == null || viewSimpleName.isBlank()) {
            return false;
        }
        return isOwnTopLevelOrNestedTypeReference(sourcePackageName, viewSimpleName + "InputEvent", referencedType);
    }

    public static boolean isOwnTopLevelOrNestedTypeReference(
            String sourcePackageName,
            String topLevelSimpleName,
            String referencedType
    ) {
        String qualifiedTopLevelType = sourcePackageName + "." + topLevelSimpleName;
        return referencedType != null
                && (referencedType.equals(qualifiedTopLevelType)
                || referencedType.startsWith(qualifiedTopLevelType + "$")
                || referencedType.startsWith(qualifiedTopLevelType + "."));
    }

    public static boolean isSameViewRootReference(String sourcePackageName, String referencedType) {
        return packageNameOf(referencedType).equals(sourcePackageName);
    }

    public static String topLevelQualifiedTypeNameOf(String referencedType) {
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
        if (segments.length >= 5 && Set.of("leftbartabs", "statetabs", "dropdowns").contains(segments[2])) {
            return String.join(".", segments[0], segments[1], segments[2], segments[3], segments[4]);
        }
        return normalizedType;
    }

    public static boolean isSameViewUnitReference(String leftReferencedType, String rightReferencedType) {
        return packageNameOf(leftReferencedType).equals(packageNameOf(rightReferencedType));
    }

    public static boolean isSlotcontentModelReference(String referencedType) {
        ViewSourceDescriptor source = referencedViewSource(referencedType);
        return source.isSlotcontentSource() && isProjectionModelRole(source.role());
    }

    public static boolean isDetailEntryReference(String referencedType) {
        ViewSourceDescriptor source = referencedViewSource(referencedType);
        return source.isSlotcontentSource()
                && "details".equals(source.group())
                && (source.role() == ViewRole.VIEW
                || source.role() == ViewRole.INSPECTOR_ENTRY
                || isProjectionModelRole(source.role()));
    }

    public static boolean isSameViewRootOrReusablePassiveViewReference(String sourcePackageName, String referencedType) {
        return isSameViewRootReference(sourcePackageName, referencedType)
                || isReusableSlotcontentReference(referencedType, ViewRole.VIEW);
    }

    public static boolean isSameViewRootOrReusableSlotcontentViewInputEventReference(
            String sourcePackageName,
            String referencedType
    ) {
        return isSameViewRootReference(sourcePackageName, referencedType)
                || isReusableSlotcontentReference(referencedType, ViewRole.VIEW_INPUT_EVENT);
    }

    public static boolean isSameViewRootOrReusableSlotcontentModelReference(
            String sourcePackageName,
            String referencedType
    ) {
        return isSameViewRootReference(sourcePackageName, referencedType)
                || isSlotcontentModelReference(referencedType);
    }

    public static boolean isSameViewRootModelReference(String sourcePackageName, String referencedType) {
        return isTargetViewModelReference(referencedType) && isSameViewRootReference(sourcePackageName, referencedType);
    }

    public static boolean isSameViewRootIntentHandlerReference(String sourcePackageName, String referencedType) {
        return isIntentHandlerReference(referencedType)
                && isSameViewRootReference(sourcePackageName, referencedType);
    }

    public static boolean isConsumerOfSameRootViewInputEvent(TypeMirror typeMirror, String sourcePackageName) {
        return consumerTypeMatches(typeMirror, referencedType ->
                isTargetViewInputEventReference(referencedType)
                        && isSameViewRootReference(sourcePackageName, referencedType));
    }

    public static boolean isConsumerOfSameStemViewInputEvent(
            TypeMirror typeMirror,
            String sourcePackageName,
            String viewSimpleName
    ) {
        return consumerTypeMatches(typeMirror, referencedType ->
                isSameStemViewInputEventReference(sourcePackageName, viewSimpleName, referencedType));
    }

    public static boolean isCallbackOrResultProtocolType(TypeMirror typeMirror) {
        if (typeMirror == null) {
            return false;
        }
        if (isCallbackSurfaceType(typeMirror)) {
            return true;
        }
        Set<String> referencedTypes = collectTypeReferences(typeMirror);
        return referencedTypes.stream().anyMatch(ViewArchitectureSupport::isKnownAsyncProtocolType);
    }

    public static boolean isAllowedBinderShellType(String referencedType) {
        return isAllowedShellType(referencedType, BINDER_ALLOWED_SHELL_TYPES);
    }

    public static boolean isAllowedContributionShellType(String referencedType) {
        return isAllowedShellType(referencedType, CONTRIBUTION_ALLOWED_SHELL_TYPES);
    }

    public static void collectTypeReferences(TypeMirror typeMirror, Set<String> referencedTypes) {
        if (typeMirror == null) {
            return;
        }
        typeMirror.accept(new SimpleTypeVisitor14<Void, Void>() {
            @Override
            public Void visitDeclared(DeclaredType declaredType, Void unused) {
                Element element = declaredType.asElement();
                if (element instanceof TypeElement typeElement) {
                    addReference(typeElement.getQualifiedName().toString(), referencedTypes);
                }
                for (TypeMirror typeArgument : declaredType.getTypeArguments()) {
                    typeArgument.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitArray(ArrayType arrayType, Void unused) {
                arrayType.getComponentType().accept(this, null);
                return null;
            }

            @Override
            public Void visitTypeVariable(TypeVariable typeVariable, Void unused) {
                typeVariable.getUpperBound().accept(this, null);
                TypeMirror lowerBound = typeVariable.getLowerBound();
                if (lowerBound != null) {
                    lowerBound.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitWildcard(WildcardType wildcardType, Void unused) {
                if (wildcardType.getExtendsBound() != null) {
                    wildcardType.getExtendsBound().accept(this, null);
                }
                if (wildcardType.getSuperBound() != null) {
                    wildcardType.getSuperBound().accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitExecutable(ExecutableType executableType, Void unused) {
                executableType.getReturnType().accept(this, null);
                for (TypeMirror thrownType : executableType.getThrownTypes()) {
                    thrownType.accept(this, null);
                }
                for (TypeMirror typeVariable : executableType.getTypeVariables()) {
                    typeVariable.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitIntersection(IntersectionType intersectionType, Void unused) {
                for (TypeMirror bound : intersectionType.getBounds()) {
                    bound.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitUnion(UnionType unionType, Void unused) {
                for (TypeMirror alternative : unionType.getAlternatives()) {
                    alternative.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitError(ErrorType errorType, Void unused) {
                Element element = errorType.asElement();
                if (element instanceof TypeElement typeElement) {
                    addReference(typeElement.getQualifiedName().toString(), referencedTypes);
                }
                return null;
            }

            @Override
            protected Void defaultAction(TypeMirror ignored, Void unused) {
                return null;
            }

            @Override
            public Void visitNoType(NoType noType, Void unused) {
                return null;
            }

            @Override
            public Void visitPrimitive(PrimitiveType primitiveType, Void unused) {
                return null;
            }

            @Override
            public Void visitNull(NullType nullType, Void unused) {
                return null;
            }
        }, null);
    }

    public static Set<String> collectTypeReferences(TypeMirror typeMirror) {
        Set<String> referencedTypes = new LinkedHashSet<>();
        collectTypeReferences(typeMirror, referencedTypes);
        return referencedTypes;
    }

    private static void addReference(String qualifiedName, Set<String> referencedTypes) {
        if (qualifiedName != null && !qualifiedName.isBlank()) {
            referencedTypes.add(qualifiedName);
        }
    }

    private static boolean isFunctionalInterface(TypeMirror typeMirror) {
        if (!(typeMirror instanceof DeclaredType declaredType)) {
            return false;
        }
        Element element = declaredType.asElement();
        if (!(element instanceof TypeElement typeElement) || !typeElement.getKind().isInterface()) {
            return false;
        }
        int abstractMethodCount = 0;
        for (ExecutableElement method : ElementFilter.methodsIn(typeElement.getEnclosedElements())) {
            Set<Modifier> modifiers = method.getModifiers();
            if (modifiers.contains(Modifier.DEFAULT) || modifiers.contains(Modifier.STATIC)) {
                continue;
            }
            if (isJavaLangObjectMethod(method)) {
                continue;
            }
            abstractMethodCount++;
            if (abstractMethodCount > 1) {
                return false;
            }
        }
        return abstractMethodCount == 1;
    }

    private static boolean isCallbackSurfaceType(TypeMirror typeMirror) {
        if (typeMirror == null) {
            return false;
        }
        if (isFunctionalInterface(typeMirror)) {
            return true;
        }
        Set<String> referencedTypes = collectTypeReferences(typeMirror);
        return referencedTypes.stream().anyMatch(ViewArchitectureSupport::isKnownCallbackSurfaceType);
    }

    private static boolean isKnownCallbackSurfaceType(String referencedType) {
        if (referencedType == null || referencedType.isBlank()) {
            return false;
        }
        return referencedType.startsWith("javafx.event.") || Set.of(
                "javafx.beans.InvalidationListener", "javafx.beans.WeakInvalidationListener",
                "javafx.beans.value.ChangeListener", "javafx.beans.value.WeakChangeListener",
                "javafx.collections.ListChangeListener", "javafx.collections.MapChangeListener",
                "javafx.collections.SetChangeListener", "javafx.collections.WeakListChangeListener",
                "javafx.collections.WeakMapChangeListener", "javafx.collections.WeakSetChangeListener")
                .contains(referencedType);
    }

    private static boolean isKnownAsyncProtocolType(String referencedType) {
        if (referencedType == null || referencedType.isBlank()) {
            return false;
        }
        return referencedType.equals("java.util.concurrent.Future") || referencedType.equals("java.util.concurrent.CompletableFuture")
                || referencedType.equals("java.util.concurrent.CompletionStage");
    }

    private static boolean isJavaLangObjectMethod(ExecutableElement method) {
        Element enclosingElement = method.getEnclosingElement();
        if (!(enclosingElement instanceof TypeElement typeElement)) {
            return false;
        }
        return "java.lang.Object".contentEquals(typeElement.getQualifiedName());
    }

    private static boolean consumerTypeMatches(TypeMirror typeMirror, Predicate<String> predicate) {
        if (!(typeMirror instanceof DeclaredType declaredType)) {
            return false;
        }
        Element element = declaredType.asElement();
        if (!(element instanceof TypeElement typeElement) || !"java.util.function.Consumer".contentEquals(typeElement.getQualifiedName())
                || declaredType.getTypeArguments().size() != 1) {
            return false;
        }
        Set<String> referencedTypes = new LinkedHashSet<>();
        collectTypeReferences(declaredType.getTypeArguments().get(0), referencedTypes);
        return referencedTypes.stream().anyMatch(predicate);
    }

    private static String packageNameOf(String referencedType) {
        if (referencedType == null || referencedType.isBlank()) {
            return "";
        }
        ViewSourceDescriptor source = referencedViewSource(referencedType);
        if (source.isRecognizedViewSource()) {
            return source.packageName();
        }
        String topLevelType = topLevelQualifiedTypeNameOf(referencedType);
        int separator = topLevelType.lastIndexOf('.');
        return separator < 0 ? "" : topLevelType.substring(0, separator);
    }

    private static boolean isReusableSlotcontentReference(String referencedType, ViewRole role) {
        ViewSourceDescriptor source = referencedViewSource(referencedType);
        return source.isSlotcontentSource() && source.role() == role;
    }

    private static ViewSourceDescriptor referencedViewSource(String referencedType) {
        return ViewSourceDescriptor.describeQualifiedType(topLevelQualifiedTypeNameOf(referencedType));
    }

    private static boolean isProjectionModelRole(ViewRole role) {
        return role == ViewRole.LEGACY_VIEW_MODEL || role == ViewRole.CONTRIBUTION_MODEL || role == ViewRole.CONTENT_MODEL;
    }

    private static boolean isDomainWriteCarrier(String referencedType) {
        return referencedType.matches("^src\\.domain\\.[^.]+\\.published\\..*(Command|Query|Operation|Edit)(\\$.*)?$");
    }

    private static boolean isAllowedShellType(String referencedType, Set<String> allowedTypes) {
        if (referencedType == null || !referencedType.startsWith("shell.")) {
            return true;
        }
        for (String allowedType : allowedTypes) {
            if (referencedType.equals(allowedType) || referencedType.startsWith(allowedType + "$")
                    || referencedType.startsWith(allowedType + ".")) {
                return true;
            }
        }
        return false;
    }
}
