package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Pattern;
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

final class ViewArchitectureSupport {

    private static final Pattern VIEW_PANEL_PACKAGE = Pattern.compile(
            "^src\\.view\\.slotcontent\\.(controls|main|state|details|topbar|primitives)\\.[^.]+$");
    private static final Pattern VIEW_SLOT_PACKAGE = Pattern.compile(
            "^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$");
    private static final Set<String> ROOT_VIEW_AREAS = Set.of("leftbartabs", "statetabs", "dropdowns");
    private static final Set<String> REUSABLE_VIEW_COMPONENTS = Set.of(
            "controls", "main", "state", "details", "topbar", "primitives");
    private static final Set<String> FORBIDDEN_VIEW_JDK_INFRASTRUCTURE_TYPES = Set.of(
            "java.lang.ClassLoader",
            "java.lang.Process",
            "java.lang.ProcessBuilder",
            "java.lang.Runtime",
            "java.lang.Thread",
            "java.lang.ThreadGroup",
            "java.util.Timer",
            "java.util.TimerTask");

    private ViewArchitectureSupport() {
    }

    static String packageName(CompilationUnitTree tree) {
        return tree.getPackageName() == null ? "" : tree.getPackageName().toString();
    }

    static boolean isPanelViewSource(CompilationUnitTree tree) {
        String packageName = packageName(tree);
        String sourceFileName = sourceFileName(tree);
        return (VIEW_PANEL_PACKAGE.matcher(packageName).matches()
                || VIEW_SLOT_PACKAGE.matcher(packageName).matches())
                && sourceFileName.endsWith("View.java")
                && !sourceFileName.endsWith("ViewModel.java")
                && !sourceFileName.endsWith("PresentationModel.java")
                && !sourceFileName.endsWith("ContributionModel.java")
                && !sourceFileName.endsWith("ContentModel.java");
    }

    static String topLevelSimpleName(CompilationUnitTree tree) {
        String sourceFileName = sourceFileName(tree);
        if (sourceFileName.endsWith(".java")) {
            return sourceFileName.substring(0, sourceFileName.length() - ".java".length());
        }
        return sourceFileName;
    }

    private static String sourceFileName(CompilationUnitTree tree) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        String name = tree.getSourceFile().getName().replace('\\', '/');
        int separator = name.lastIndexOf('/');
        return separator < 0 ? name : name.substring(separator + 1);
    }

    static Set<String> collectReferencedTypes(CompilationUnitTree tree) {
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

    static void collectReferencedTypes(Tree tree, Set<String> referencedTypes) {
        Symbol symbol = ASTHelpers.getSymbol(tree);
        if (symbol != null) {
            addReference(getQualifiedTypeName(symbol), referencedTypes);
            addReference(getQualifiedOwnerTypeName(symbol), referencedTypes);
        }
        collectTypeReferences(ASTHelpers.getType(tree), referencedTypes);
    }

    private static void addReference(String qualifiedName, Set<String> referencedTypes) {
        if (qualifiedName != null && !qualifiedName.isBlank()) {
            referencedTypes.add(qualifiedName);
        }
    }

    private static String getQualifiedTypeName(Symbol symbol) {
        if (symbol instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        if (symbol != null && symbol.type != null && symbol.type.tsym instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }

    static String getQualifiedOwnerTypeName(Symbol symbol) {
        if (symbol == null || symbol.owner == null) {
            return null;
        }
        if (symbol.owner instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }

    static boolean isPrimitiveViewPackage(String packageName) {
        return packageName != null && packageName.matches("^src\\.view\\.slotcontent\\.primitives\\.[^.]+$");
    }

    static boolean isPrimitiveModelReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null && "primitives".equals(viewType.component()) && "MODEL".equals(viewType.bucket());
    }

    static boolean isForbiddenViewInfrastructureJdkType(String referencedType) {
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

    static boolean isTopLevelViewModelReference(String referencedType) {
        if (!isTargetViewModelReference(referencedType)) {
            return false;
        }
        String packageName = packageNameOf(referencedType);
        if (packageName.isBlank() || !referencedType.startsWith(packageName + ".")) {
            return false;
        }
        String remainder = referencedType.substring(packageName.length() + 1).replaceFirst("\\$.*$", "");
        return !remainder.contains(".");
    }

    private static boolean isTargetViewModelReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null && "MODEL".equals(viewType.bucket());
    }

    static boolean isSameStemViewInputEventReference(
            String sourcePackageName,
            String viewSimpleName,
            String referencedType
    ) {
        return isOwnTopLevelOrNestedTypeReference(
                sourcePackageName,
                expectedViewInputEventSimpleName(viewSimpleName),
                referencedType);
    }

    private static boolean isOwnTopLevelOrNestedTypeReference(
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

    private static String expectedViewInputEventSimpleName(String viewSimpleName) {
        if (viewSimpleName == null || viewSimpleName.isBlank()) {
            return "";
        }
        return viewSimpleName + "InputEvent";
    }

    static ViewTypeInfo parseViewType(String referencedType) {
        if (referencedType == null || !referencedType.startsWith("src.view.")) {
            return null;
        }
        String remainder = referencedType.substring("src.view.".length());
        String[] segments = remainder.split("\\.");
        if (segments.length == 0) {
            return new ViewTypeInfo("VIEW_ROOT", "LEGACY");
        }
        if ("slotcontent".equals(segments[0]) && segments.length >= 4) {
            String topLevelSimpleName = segments[3].replaceFirst("\\$.*$", "");
            if (topLevelSimpleName.endsWith("ViewModel")
                    || topLevelSimpleName.endsWith("PresentationModel")
                    || topLevelSimpleName.endsWith("ContentModel")
                    || topLevelSimpleName.endsWith("ContributionModel")) {
                return new ViewTypeInfo(segments[1], "MODEL");
            }
            if (topLevelSimpleName.endsWith("IntentHandler")) {
                return new ViewTypeInfo(segments[1], "HANDLER");
            }
            if (topLevelSimpleName.endsWith("ViewInputEvent")) {
                return new ViewTypeInfo(segments[1], "VIEW_INPUT_EVENT");
            }
            if (topLevelSimpleName.endsWith("PublishedEvent")) {
                return new ViewTypeInfo(segments[1], "PUBLISHED_EVENT");
            }
            if (topLevelSimpleName.endsWith("CanvasPointerEvent")
                    || topLevelSimpleName.endsWith("MapRenderScene")) {
                return new ViewTypeInfo(segments[1], "SUPPORT_VALUE");
            }
            return new ViewTypeInfo(segments[1], "VIEW");
        }
        if (ROOT_VIEW_AREAS.contains(segments[0]) && segments.length >= 3) {
            for (int index = 2; index < segments.length; index++) {
                String simpleName = segments[index].replaceFirst("\\$.*$", "");
                if (simpleName.endsWith("ViewModel")
                        || simpleName.endsWith("PresentationModel")
                        || simpleName.endsWith("ContributionModel")
                        || simpleName.endsWith("ContentModel")) {
                    return new ViewTypeInfo(segments[0], "MODEL");
                }
                if (simpleName.endsWith("IntentHandler")) {
                    return new ViewTypeInfo(segments[0], "HANDLER");
                }
                if (simpleName.endsWith("ViewInputEvent")) {
                    return new ViewTypeInfo(segments[0], "VIEW_INPUT_EVENT");
                }
                if (simpleName.endsWith("PublishedEvent")) {
                    return new ViewTypeInfo(segments[0], "PUBLISHED_EVENT");
                }
                if (simpleName.endsWith("View")) {
                    return new ViewTypeInfo(segments[0], "VIEW");
                }
            }
        }
        return new ViewTypeInfo(segments[0], "LEGACY");
    }

    static boolean isSameViewRootReference(String sourcePackageName, String referencedType) {
        return packageNameOf(referencedType).equals(sourcePackageName);
    }

    static boolean isSupportValueReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null && "SUPPORT_VALUE".equals(viewType.bucket());
    }

    static boolean isSameViewRootOrReusablePassiveViewReference(String sourcePackageName, String referencedType) {
        return isSameViewRootReference(sourcePackageName, referencedType)
                || isReusablePassiveViewReference(referencedType);
    }

    private static boolean isReusablePassiveViewReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null
                && REUSABLE_VIEW_COMPONENTS.contains(viewType.component())
                && "VIEW".equals(viewType.bucket());
    }

    static boolean isPrimitiveViewReferenceAllowedFromPrimitiveView(String sourcePackageName, String referencedType) {
        return isPrimitiveViewPackage(sourcePackageName)
                && isPrimitiveViewReference(referencedType);
    }

    private static boolean isPrimitiveViewReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null && "primitives".equals(viewType.component()) && "VIEW".equals(viewType.bucket());
    }

    static boolean isPrimitiveModelReferenceAllowedFromPrimitiveView(String sourcePackageName, String referencedType) {
        return isPrimitiveViewPackage(sourcePackageName)
                && isPrimitiveModelReference(referencedType)
                && isSameViewRootReference(sourcePackageName, referencedType);
    }

    static boolean isSameViewRootModelReference(String sourcePackageName, String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null
                && "MODEL".equals(viewType.bucket())
                && isSameViewRootReference(sourcePackageName, referencedType);
    }

    static boolean isConsumerOfSameRootViewInputEvent(TypeMirror typeMirror, String sourcePackageName) {
        return isConsumerOfSameRootCarrier(typeMirror, sourcePackageName);
    }

    static boolean isConsumerOfSameStemViewInputEvent(
            TypeMirror typeMirror,
            String sourcePackageName,
            String viewSimpleName
    ) {
        if (!(typeMirror instanceof DeclaredType declaredType)) {
            return false;
        }
        Element element = declaredType.asElement();
        if (!(element instanceof TypeElement typeElement)
                || !"java.util.function.Consumer".contentEquals(typeElement.getQualifiedName())) {
            return false;
        }
        if (declaredType.getTypeArguments().size() != 1) {
            return false;
        }
        Set<String> referencedTypes = new LinkedHashSet<>();
        collectTypeReferences(declaredType.getTypeArguments().get(0), referencedTypes);
        return referencedTypes.stream()
                .anyMatch(referencedType -> isSameStemViewInputEventReference(
                        sourcePackageName,
                        viewSimpleName,
                        referencedType));
    }

    private static boolean isConsumerOfSameRootCarrier(TypeMirror typeMirror, String sourcePackageName) {
        if (!(typeMirror instanceof DeclaredType declaredType)) {
            return false;
        }
        Element element = declaredType.asElement();
        if (!(element instanceof TypeElement typeElement)
                || !"java.util.function.Consumer".contentEquals(typeElement.getQualifiedName())) {
            return false;
        }
        if (declaredType.getTypeArguments().size() != 1) {
            return false;
        }
        Set<String> referencedTypes = new LinkedHashSet<>();
        collectTypeReferences(declaredType.getTypeArguments().get(0), referencedTypes);
        return referencedTypes.stream()
                .filter(ViewArchitectureSupport::isTargetViewInputEventReference)
                .anyMatch(referencedType -> isSameViewRootReference(sourcePackageName, referencedType));
    }

    private static boolean isTargetViewInputEventReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null && "VIEW_INPUT_EVENT".equals(viewType.bucket());
    }

    static boolean isFunctionalInterface(TypeMirror typeMirror) {
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

    static boolean isCallbackSurfaceType(TypeMirror typeMirror) {
        if (typeMirror == null) {
            return false;
        }
        if (isFunctionalInterface(typeMirror)) {
            return true;
        }
        Set<String> referencedTypes = new LinkedHashSet<>();
        collectTypeReferences(typeMirror, referencedTypes);
        return referencedTypes.stream().anyMatch(ViewArchitectureSupport::isKnownCallbackSurfaceType);
    }

    static boolean isCallbackOrResultProtocolType(TypeMirror typeMirror) {
        if (typeMirror == null) {
            return false;
        }
        if (isCallbackSurfaceType(typeMirror)) {
            return true;
        }
        Set<String> referencedTypes = new LinkedHashSet<>();
        collectTypeReferences(typeMirror, referencedTypes);
        return referencedTypes.stream().anyMatch(ViewArchitectureSupport::isKnownAsyncProtocolType);
    }

    static boolean isObservableReadSurfaceType(TypeMirror typeMirror) {
        if (typeMirror == null) {
            return false;
        }
        String qualifiedName = typeMirror.toString();
        return qualifiedName.startsWith("javafx.beans.property.")
                || qualifiedName.startsWith("javafx.beans.value.")
                || qualifiedName.startsWith("javafx.beans.binding.")
                || qualifiedName.startsWith("javafx.collections.ObservableList")
                || qualifiedName.startsWith("javafx.collections.ObservableMap")
                || qualifiedName.startsWith("javafx.collections.ObservableSet");
    }

    static boolean isObservableMutableSurfaceType(TypeMirror typeMirror) {
        if (typeMirror == null) {
            return false;
        }
        String qualifiedName = typeMirror.toString();
        return qualifiedName.startsWith("javafx.beans.property.")
                || qualifiedName.equals("javafx.beans.value.WritableValue")
                || qualifiedName.startsWith("javafx.beans.value.WritableValue<")
                || qualifiedName.startsWith("javafx.collections.ObservableList")
                || qualifiedName.startsWith("javafx.collections.ObservableMap")
                || qualifiedName.startsWith("javafx.collections.ObservableSet");
    }

    private static boolean isKnownCallbackSurfaceType(String referencedType) {
        if (referencedType == null || referencedType.isBlank()) {
            return false;
        }
        return referencedType.startsWith("javafx.event.")
                || referencedType.equals("javafx.beans.InvalidationListener")
                || referencedType.equals("javafx.beans.value.ChangeListener")
                || referencedType.equals("javafx.collections.ListChangeListener")
                || referencedType.equals("javafx.collections.MapChangeListener")
                || referencedType.equals("javafx.collections.SetChangeListener")
                || referencedType.equals("javafx.collections.WeakListChangeListener")
                || referencedType.equals("javafx.collections.WeakMapChangeListener")
                || referencedType.equals("javafx.collections.WeakSetChangeListener")
                || referencedType.equals("javafx.beans.WeakInvalidationListener")
                || referencedType.equals("javafx.beans.value.WeakChangeListener");
    }

    private static boolean isKnownAsyncProtocolType(String referencedType) {
        if (referencedType == null || referencedType.isBlank()) {
            return false;
        }
        return referencedType.equals("java.util.concurrent.Future")
                || referencedType.equals("java.util.concurrent.CompletableFuture")
                || referencedType.equals("java.util.concurrent.CompletionStage");
    }

    private static boolean isJavaLangObjectMethod(ExecutableElement method) {
        Element enclosingElement = method.getEnclosingElement();
        if (!(enclosingElement instanceof TypeElement typeElement)) {
            return false;
        }
        return "java.lang.Object".contentEquals(typeElement.getQualifiedName());
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
            if (segments.length >= 4 && ROOT_VIEW_AREAS.contains(segments[2])) {
                return String.join(".", segments[0], segments[1], segments[2], segments[3]);
            }
        }
        int separator = topLevelType.lastIndexOf('.');
        return separator < 0 ? "" : topLevelType.substring(0, separator);
    }

    private static void collectTypeReferences(TypeMirror typeMirror, Set<String> referencedTypes) {
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

    record ViewTypeInfo(String component, String bucket) {
    }
}
