package saltmarcher.quality.errorprone.view.intenthandler;

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

final class ViewIntentHandlerArchitectureSupport {

    private static final Pattern INTENT_HANDLER_PACKAGE = Pattern.compile(
            "^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$"
                    + "|^src\\.view\\.slotcontent\\.(controls|main|state|details|topbar|primitives)\\.[^.]+$");

    private static final Set<String> FORBIDDEN_VIEW_JDK_INFRASTRUCTURE_TYPES = Set.of(
            "java.lang.ClassLoader",
            "java.lang.Process",
            "java.lang.ProcessBuilder",
            "java.lang.Runtime",
            "java.lang.Thread",
            "java.lang.ThreadGroup",
            "java.util.Timer",
            "java.util.TimerTask");

    private ViewIntentHandlerArchitectureSupport() {
    }

    static boolean isIntentHandlerSource(CompilationUnitTree tree) {
        return INTENT_HANDLER_PACKAGE.matcher(packageName(tree)).matches()
                && sourceFileName(tree).endsWith("IntentHandler.java");
    }

    static String packageName(CompilationUnitTree tree) {
        return tree.getPackageName() == null ? "" : tree.getPackageName().toString();
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

    static boolean isApplicationServiceReference(String referencedType) {
        return referencedType != null
                && referencedType.matches("^src\\.domain\\.[^.]+\\.[^.]+ApplicationService((\\$|\\.).*)?$");
    }

    static boolean isTargetViewInputEventReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null && "VIEW_INPUT_EVENT".equals(viewType.bucket());
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

    static boolean isSameViewRootReference(String sourcePackageName, String referencedType) {
        return packageNameOf(referencedType).equals(sourcePackageName);
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
            return new ViewTypeInfo(segments[1], "VIEW");
        }
        if (Set.of("leftbartabs", "statetabs", "dropdowns").contains(segments[0]) && segments.length >= 3) {
            for (int index = 2; index < segments.length; index++) {
                String simpleName = segments[index].replaceFirst("\\$.*$", "");
                if (simpleName.endsWith("Contribution")) {
                    return new ViewTypeInfo(segments[0], "CONTRIBUTION");
                }
                if (simpleName.endsWith("Binder")) {
                    return new ViewTypeInfo(segments[0], "BINDER");
                }
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

    private static String sourceFileName(CompilationUnitTree tree) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        String name = tree.getSourceFile().getName().replace('\\', '/');
        int separator = name.lastIndexOf('/');
        return separator < 0 ? name : name.substring(separator + 1);
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

    private static String getQualifiedOwnerTypeName(Symbol symbol) {
        if (symbol == null || symbol.owner == null) {
            return null;
        }
        if (symbol.owner instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }

    private static String packageNameOf(String referencedType) {
        if (referencedType == null || referencedType.isBlank()) {
            return "";
        }
        String normalized = referencedType.replace('$', '.');
        String[] segments = normalized.split("\\.");
        if (segments.length < 4 || !"src".equals(segments[0]) || !"view".equals(segments[1])) {
            return normalized.contains(".") ? normalized.substring(0, normalized.lastIndexOf('.')) : "";
        }
        if ("slotcontent".equals(segments[2]) && segments.length >= 5) {
            return String.join(".", segments[0], segments[1], segments[2], segments[3], segments[4]);
        }
        if (Set.of("leftbartabs", "statetabs", "dropdowns").contains(segments[2]) && segments.length >= 4) {
            return String.join(".", segments[0], segments[1], segments[2], segments[3]);
        }
        return normalized.contains(".") ? normalized.substring(0, normalized.lastIndexOf('.')) : "";
    }

    private static void collectTypeReferences(TypeMirror typeMirror, Set<String> referencedTypes) {
        if (typeMirror == null) {
            return;
        }
        typeMirror.accept(new SimpleTypeVisitor14<Void, Set<String>>() {
            @Override
            protected Void defaultAction(TypeMirror e, Set<String> references) {
                return null;
            }

            @Override
            public Void visitDeclared(DeclaredType type, Set<String> references) {
                Element element = type.asElement();
                if (element instanceof TypeElement typeElement) {
                    addReference(typeElement.getQualifiedName().toString(), references);
                    for (ExecutableElement method : ElementFilter.methodsIn(typeElement.getEnclosedElements())) {
                        if (method.getModifiers().contains(Modifier.STATIC)) {
                            addReference(typeElement.getQualifiedName().toString(), references);
                            break;
                        }
                    }
                }
                for (TypeMirror argument : type.getTypeArguments()) {
                    argument.accept(this, references);
                }
                return null;
            }

            @Override
            public Void visitArray(ArrayType type, Set<String> references) {
                type.getComponentType().accept(this, references);
                return null;
            }

            @Override
            public Void visitTypeVariable(TypeVariable type, Set<String> references) {
                type.getUpperBound().accept(this, references);
                type.getLowerBound().accept(this, references);
                return null;
            }

            @Override
            public Void visitWildcard(WildcardType type, Set<String> references) {
                TypeMirror extendsBound = type.getExtendsBound();
                if (extendsBound != null) {
                    extendsBound.accept(this, references);
                }
                TypeMirror superBound = type.getSuperBound();
                if (superBound != null) {
                    superBound.accept(this, references);
                }
                return null;
            }

            @Override
            public Void visitExecutable(ExecutableType type, Set<String> references) {
                type.getReturnType().accept(this, references);
                for (TypeMirror parameterType : type.getParameterTypes()) {
                    parameterType.accept(this, references);
                }
                for (TypeMirror thrownType : type.getThrownTypes()) {
                    thrownType.accept(this, references);
                }
                for (TypeMirror typeVariable : type.getTypeVariables()) {
                    typeVariable.accept(this, references);
                }
                return null;
            }

            @Override
            public Void visitIntersection(IntersectionType type, Set<String> references) {
                for (TypeMirror bound : type.getBounds()) {
                    bound.accept(this, references);
                }
                return null;
            }

            @Override
            public Void visitUnion(UnionType type, Set<String> references) {
                for (TypeMirror alternative : type.getAlternatives()) {
                    alternative.accept(this, references);
                }
                return null;
            }

            @Override
            public Void visitPrimitive(PrimitiveType type, Set<String> references) {
                return null;
            }

            @Override
            public Void visitNoType(NoType type, Set<String> references) {
                return null;
            }

            @Override
            public Void visitNull(NullType type, Set<String> references) {
                return null;
            }

            @Override
            public Void visitError(ErrorType type, Set<String> references) {
                Element element = type.asElement();
                if (element instanceof TypeElement typeElement) {
                    addReference(typeElement.getQualifiedName().toString(), references);
                }
                for (TypeMirror argument : type.getTypeArguments()) {
                    argument.accept(this, references);
                }
                return null;
            }
        }, referencedTypes);
    }

    record ViewTypeInfo(String component, String bucket) {
    }
}
