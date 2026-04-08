package buildlogic.conventions.hygiene

import buildlogic.conventions.heuristic.owner.OwnerConventionParsedJavaSource
import buildlogic.conventions.heuristic.owner.OwnerConventionParsedJavaSources
import buildlogic.conventions.heuristic.owner.parseOwnerConventionJavaSources
import com.sun.source.tree.AnnotationTree
import com.sun.source.tree.BlockTree
import com.sun.source.tree.ClassTree
import com.sun.source.tree.IdentifierTree
import com.sun.source.tree.LiteralTree
import com.sun.source.tree.MemberReferenceTree
import com.sun.source.tree.MemberSelectTree
import com.sun.source.tree.MethodInvocationTree
import com.sun.source.tree.MethodTree
import com.sun.source.tree.Tree
import com.sun.source.tree.VariableTree
import com.sun.source.util.TreePath
import com.sun.source.util.TreePathScanner
import java.io.File
import java.util.ArrayDeque
import javax.lang.model.element.Element
import javax.lang.model.element.ElementKind
import javax.lang.model.element.ExecutableElement
import javax.lang.model.element.Modifier
import javax.lang.model.element.TypeElement
import javax.lang.model.element.VariableElement
import javax.lang.model.type.DeclaredType
import javax.lang.model.type.TypeMirror
import org.gradle.api.GradleException
import org.gradle.api.Project

private enum class DeadDeclarationKind(val label: String) {
    TYPE("type"),
    FIELD("field"),
    METHOD("method"),
    CONSTRUCTOR("constructor")
}

private data class DeadDeclaration(
    val element: Element,
    val kind: DeadDeclarationKind,
    val path: String,
    val ownerType: TypeElement?,
    val displayName: String,
    val touched: Boolean,
    val suppressed: Boolean
)

internal fun Project.deadDeclarationReasons(): List<String> {
    val touchedPaths = touchedJavaPaths()
    if (touchedPaths.isEmpty()) {
        return emptyList()
    }
    val projectRoot = layout.projectDirectory.asFile.toPath()
    val parsedSources = parseOwnerConventionJavaSources(
        projectRoot = projectRoot,
        files = mainJavaSourceFiles(),
        classpath = mainJavaCompileClasspath()
    )
    return DeadDeclarationAnalyzer(
        project = this,
        touchedPaths = touchedPaths,
        parsedSources = parsedSources
    ).deadReasons()
}

private class DeadDeclarationAnalyzer(
    private val project: Project,
    private val touchedPaths: Set<String>,
    private val parsedSources: OwnerConventionParsedJavaSources
) {
    private val trees = parsedSources.semanticModel.trees
    private val elements = parsedSources.semanticModel.elements
    private val types = parsedSources.semanticModel.types
    private val projectTopLevelTypeNames = parsedSources.sourcesByPath.values
        .flatMap { parsedSource ->
            val packageName = parsedSource.packageName ?: return@flatMap emptyList()
            parsedSource.topLevelTypes.map { topLevelType -> "$packageName.${topLevelType.name}" }
        }
        .toSet()

    private val declarationsByElement = linkedMapOf<Element, DeadDeclaration>()
    private val directEdges = linkedMapOf<Element, MutableSet<Element>>()
    private val reflectiveTypeEdges = linkedMapOf<Element, MutableSet<TypeElement>>()
    private val membersByType = linkedMapOf<TypeElement, MutableSet<Element>>()
    private val methodsByType = linkedMapOf<TypeElement, MutableSet<ExecutableElement>>()
    private val projectOverrideTargets = linkedMapOf<ExecutableElement, MutableSet<ExecutableElement>>()
    private val projectSuperMethodsByMethod = linkedMapOf<ExecutableElement, MutableSet<ExecutableElement>>()
    private val externalOverrideMethodsByType = linkedMapOf<TypeElement, MutableSet<ExecutableElement>>()
    private val rootElements = linkedSetOf<Element>()
    private val fullSurfaceRootTypes = linkedSetOf<TypeElement>()

    fun deadReasons(): List<String> {
        collectDeclarations()
        collectOverrideRelationships()
        seedBuildRoots()

        val reachable = linkedSetOf<Element>()
        val reachableTypes = linkedSetOf<TypeElement>()
        val fullSurfaceTypes = linkedSetOf<TypeElement>()
        val declarationQueue = ArrayDeque<Element>()
        val typeQueue = ArrayDeque<TypeElement>()
        val processedTypeBehavior = linkedSetOf<TypeElement>()
        val processedTypeSurface = linkedSetOf<TypeElement>()

        fun markReachable(element: Element, fullSurface: Boolean = false) {
            val declarationAdded = reachable.add(element)
            if (element is TypeElement) {
                val typeAdded = reachableTypes.add(element)
                if (typeAdded) {
                    typeQueue.addLast(element)
                }
                if (fullSurface && fullSurfaceTypes.add(element)) {
                    typeQueue.addLast(element)
                }
            } else {
                ownerTypeOf(element)?.let { ownerType -> markReachable(ownerType) }
            }
            if (declarationAdded) {
                declarationQueue.addLast(element)
            }
        }

        rootElements.forEach(::markReachable)
        fullSurfaceRootTypes.forEach { rootType -> markReachable(rootType, fullSurface = true) }

        while (declarationQueue.isNotEmpty() || typeQueue.isNotEmpty()) {
            while (declarationQueue.isNotEmpty()) {
                val declaration = declarationQueue.removeFirst()
                directEdges[declaration].orEmpty().forEach { referenced ->
                    if (referenced is TypeElement) {
                        markReachable(referenced)
                    } else {
                        markReachable(referenced)
                    }
                }
                reflectiveTypeEdges[declaration].orEmpty().forEach { reflectedType ->
                    markReachable(reflectedType, fullSurface = true)
                }
                if (declaration is ExecutableElement) {
                    projectOverrideTargets[declaration].orEmpty().forEach { overridingMethod ->
                        val ownerType = ownerTypeOf(overridingMethod) ?: return@forEach
                        if (ownerType in reachableTypes) {
                            markReachable(overridingMethod)
                        }
                    }
                }
            }

            while (typeQueue.isNotEmpty()) {
                val type = typeQueue.removeFirst()
                if (processedTypeBehavior.add(type)) {
                    externalOverrideMethodsByType[type].orEmpty().forEach(::markReachable)
                    methodsByType[type].orEmpty().forEach { method ->
                        if (projectSuperMethodsByMethod[method].orEmpty().any { superMethod -> superMethod in reachable }) {
                            markReachable(method)
                        }
                    }
                }
                if (type in fullSurfaceTypes && processedTypeSurface.add(type)) {
                    membersByType[type].orEmpty().forEach { member ->
                        if (member is TypeElement) {
                            markReachable(member, fullSurface = true)
                        } else {
                            markReachable(member)
                        }
                    }
                }
            }
        }

        return declarationsByElement.values
            .asSequence()
            .filter { declaration -> declaration.touched }
            .filter { declaration -> declaration.element !in reachable }
            .filterNot { declaration ->
                declaration.ownerType?.let { ownerType ->
                    ownerType != declaration.element && ownerType !in reachable
                } ?: false
            }
            .sortedWith(compareBy({ it.path }, { it.displayName }))
            .map { declaration -> "${declaration.path} :: dead ${declaration.kind.label} ${declaration.displayName}" }
            .toList()
    }

    private fun collectDeclarations() {
        parsedSources.sourcesByPath.values.forEach { parsedSource ->
            DeadDeclarationScanner(parsedSource).scan(parsedSource.compilationUnit, null)
        }
    }

    private fun collectOverrideRelationships() {
        declarationsByElement.values.forEach { declaration ->
            val method = declaration.element as? ExecutableElement ?: return@forEach
            if (method.kind != ElementKind.METHOD) {
                return@forEach
            }
            val ownerType = declaration.ownerType ?: return@forEach
            val overriddenMethods = collectOverriddenMethods(method, ownerType)
            if (overriddenMethods.isEmpty()) {
                return@forEach
            }

            var overridesExternal = false
            overriddenMethods.forEach { overriddenMethod ->
                val overriddenTopLevelTypeName = topLevelTypeElement(overriddenMethod.enclosingElement)
                    ?.qualifiedName
                    ?.toString()
                if (overriddenTopLevelTypeName in projectTopLevelTypeNames && overriddenMethod in declarationsByElement) {
                    projectOverrideTargets.getOrPut(overriddenMethod) { linkedSetOf() } += method
                    projectSuperMethodsByMethod.getOrPut(method) { linkedSetOf() } += overriddenMethod
                } else {
                    overridesExternal = true
                }
            }
            if (overridesExternal) {
                externalOverrideMethodsByType.getOrPut(ownerType) { linkedSetOf() } += method
            }
        }
    }

    private fun collectOverriddenMethods(method: ExecutableElement, ownerType: TypeElement): Set<ExecutableElement> {
        val overriddenMethods = linkedSetOf<ExecutableElement>()
        val visited = linkedSetOf<String>()

        fun visit(typeMirror: TypeMirror?) {
            val declaredType = typeMirror as? DeclaredType ?: return
            val typeElement = declaredType.asElement() as? TypeElement ?: return
            val typeName = typeElement.qualifiedName.toString()
            if (!visited.add(typeName)) {
                return
            }
            typeElement.enclosedElements
                .filterIsInstance<ExecutableElement>()
                .filter { candidate -> candidate.kind == ElementKind.METHOD }
                .filter { candidate -> elements.overrides(method, candidate, ownerType) }
                .forEach(overriddenMethods::add)
            types.directSupertypes(typeMirror).forEach(::visit)
        }

        types.directSupertypes(ownerType.asType()).forEach(::visit)
        return overriddenMethods
    }

    private fun seedBuildRoots() {
        val buildFiles = buildList {
            add(project.layout.projectDirectory.file("build.gradle.kts").asFile)
            addAll(
                project.fileTree("buildSrc/src/main/kotlin") {
                    include("**/*.kt")
                }.files.sortedBy(File::getPath)
            )
        }
        val fqcnPattern = Regex("""(?:[a-z_][A-Za-z0-9_]*\.)+[A-Z][A-Za-z0-9_]*""")
        buildFiles.forEach { buildFile ->
            fqcnPattern.findAll(buildFile.readText()).forEach { match ->
                val typeName = match.value
                if (typeName in projectTopLevelTypeNames) {
                    val typeElement = declarationsByElement.keys
                        .filterIsInstance<TypeElement>()
                        .firstOrNull { candidate -> candidate.qualifiedName.toString() == typeName }
                    if (typeElement != null) {
                        rootElements += typeElement
                        fullSurfaceRootTypes += typeElement
                    }
                }
            }
        }
    }

    private inner class DeadDeclarationScanner(
        private val parsedSource: OwnerConventionParsedJavaSource
    ) : TreePathScanner<Unit, Element?>() {
        override fun visitClass(node: ClassTree, currentDeclaration: Element?) {
            val typeElement = trees.getElement(currentPath) as? TypeElement ?: return
            if (typeElement.simpleName.isEmpty()) {
                return
            }

            val declaration = registerType(typeElement, hasSuppressUnused(node.modifiers.annotations))
            if (declaration.suppressed) {
                rootElements += typeElement
                fullSurfaceRootTypes += typeElement
            }

            scan(node.modifiers, typeElement)
            scan(node.typeParameters, typeElement)
            scan(node.extendsClause, typeElement)
            scan(node.implementsClause, typeElement)
            scan(node.permitsClause, typeElement)

            node.members.forEach { member ->
                when (member) {
                    is ClassTree -> scan(member, null)
                    is MethodTree -> scan(member, null)
                    is VariableTree -> scan(member, null)
                    is BlockTree -> scan(member, typeElement)
                    else -> scan(member, typeElement)
                }
            }
        }

        override fun visitMethod(node: MethodTree, currentDeclaration: Element?) {
            val methodElement = trees.getElement(currentPath) as? ExecutableElement ?: return
            val declaration = registerExecutable(methodElement, hasSuppressUnused(node.modifiers.annotations))
            if (declaration.suppressed || isMainMethod(methodElement)) {
                rootElements += methodElement
            }

            scan(node.modifiers, methodElement)
            scan(node.typeParameters, methodElement)
            scan(node.returnType, methodElement)
            scan(node.parameters, methodElement)
            scan(node.throws, methodElement)
            scan(node.defaultValue, methodElement)
            scan(node.body, methodElement)
        }

        override fun visitVariable(node: VariableTree, currentDeclaration: Element?) {
            val variableElement = trees.getElement(currentPath) as? VariableElement
            if (variableElement != null && isField(variableElement)) {
                val declaration = registerField(variableElement, hasSuppressUnused(node.modifiers.annotations))
                if (declaration.suppressed) {
                    rootElements += variableElement
                }
                scan(node.modifiers, variableElement)
                scan(node.type, variableElement)
                scan(node.initializer, variableElement)
                return
            }
            super.visitVariable(node, currentDeclaration)
        }

        override fun visitIdentifier(node: IdentifierTree, currentDeclaration: Element?) {
            addResolvedEdge(currentDeclaration, trees.getElement(currentPath))
            super.visitIdentifier(node, currentDeclaration)
        }

        override fun visitMemberSelect(node: MemberSelectTree, currentDeclaration: Element?) {
            addResolvedEdge(currentDeclaration, trees.getElement(currentPath))
            if (currentDeclaration != null && node.identifier.contentEquals("class")) {
                val expressionType = trees.getElement(TreePath(currentPath, node.expression)) as? TypeElement
                if (expressionType != null && expressionType in declarationsByElement) {
                    reflectiveTypeEdges.getOrPut(currentDeclaration) { linkedSetOf() } += expressionType
                }
            }
            super.visitMemberSelect(node, currentDeclaration)
        }

        override fun visitMethodInvocation(node: MethodInvocationTree, currentDeclaration: Element?) {
            val methodElement = trees.getElement(currentPath) as? ExecutableElement
            addResolvedEdge(currentDeclaration, methodElement)
            if (currentDeclaration != null && methodElement != null && isClassForName(methodElement)) {
                val literal = node.arguments.firstOrNull() as? LiteralTree
                val typeName = literal?.value as? String
                if (typeName != null) {
                    declarationsByElement.keys
                        .filterIsInstance<TypeElement>()
                        .firstOrNull { candidate -> candidate.qualifiedName.toString() == typeName }
                        ?.let { reflectedType ->
                            reflectiveTypeEdges.getOrPut(currentDeclaration) { linkedSetOf() } += reflectedType
                        }
                }
            }
            super.visitMethodInvocation(node, currentDeclaration)
        }

        override fun visitMemberReference(node: MemberReferenceTree, currentDeclaration: Element?) {
            addResolvedEdge(currentDeclaration, trees.getElement(currentPath))
            super.visitMemberReference(node, currentDeclaration)
        }

        private fun registerType(typeElement: TypeElement, suppressedHere: Boolean): DeadDeclaration {
            val declaration = declarationsByElement.getOrPut(typeElement) {
                DeadDeclaration(
                    element = typeElement,
                    kind = DeadDeclarationKind.TYPE,
                    path = parsedSource.path,
                    ownerType = ownerTypeOf(typeElement),
                    displayName = qualifiedTypeName(typeElement),
                    touched = parsedSource.path in touchedPaths,
                    suppressed = false
                )
            }
            if (declaration.ownerType != null) {
                membersByType.getOrPut(declaration.ownerType) { linkedSetOf() } += typeElement
            }
            return declaration.withSuppressed(declaration.suppressed || suppressedHere)
        }

        private fun registerExecutable(methodElement: ExecutableElement, suppressedHere: Boolean): DeadDeclaration {
            val ownerType = ownerTypeOf(methodElement)
                ?: throw GradleException("Executable without owning type in ${parsedSource.path}: ${methodElement.simpleName}")
            val kind = if (methodElement.kind == ElementKind.CONSTRUCTOR) {
                DeadDeclarationKind.CONSTRUCTOR
            } else {
                DeadDeclarationKind.METHOD
            }
            val declaration = declarationsByElement.getOrPut(methodElement) {
                DeadDeclaration(
                    element = methodElement,
                    kind = kind,
                    path = parsedSource.path,
                    ownerType = ownerType,
                    displayName = executableDisplayName(ownerType, methodElement),
                    touched = parsedSource.path in touchedPaths,
                    suppressed = false
                )
            }
            membersByType.getOrPut(ownerType) { linkedSetOf() } += methodElement
            methodsByType.getOrPut(ownerType) { linkedSetOf() } += methodElement
            return declaration.withSuppressed(declaration.suppressed || suppressedHere)
        }

        private fun registerField(variableElement: VariableElement, suppressedHere: Boolean): DeadDeclaration {
            val ownerType = ownerTypeOf(variableElement)
                ?: throw GradleException("Field without owning type in ${parsedSource.path}: ${variableElement.simpleName}")
            val declaration = declarationsByElement.getOrPut(variableElement) {
                DeadDeclaration(
                    element = variableElement,
                    kind = DeadDeclarationKind.FIELD,
                    path = parsedSource.path,
                    ownerType = ownerType,
                    displayName = "${qualifiedTypeName(ownerType)}.${variableElement.simpleName}",
                    touched = parsedSource.path in touchedPaths,
                    suppressed = false
                )
            }
            membersByType.getOrPut(ownerType) { linkedSetOf() } += variableElement
            return declaration.withSuppressed(declaration.suppressed || suppressedHere)
        }

        private fun DeadDeclaration.withSuppressed(suppressed: Boolean): DeadDeclaration {
            if (!suppressed || this.suppressed) {
                return this
            }
            val updated = copy(suppressed = true)
            declarationsByElement[element] = updated
            return updated
        }
    }

    private fun addResolvedEdge(currentDeclaration: Element?, resolvedElement: Element?) {
        if (currentDeclaration == null || resolvedElement == null) {
            return
        }
        val declarationTarget = declarationTarget(resolvedElement) ?: return
        if (declarationTarget == currentDeclaration) {
            return
        }
        directEdges.getOrPut(currentDeclaration) { linkedSetOf() } += declarationTarget
    }

    private fun declarationTarget(element: Element): Element? {
        return when (element) {
            is TypeElement, is ExecutableElement -> element.takeIf { candidate -> candidate in declarationsByElement }
            is VariableElement -> if (isField(element)) element.takeIf { it in declarationsByElement } else null
            else -> null
        }
    }

    private fun isField(variableElement: VariableElement): Boolean {
        return variableElement.kind == ElementKind.FIELD || variableElement.kind == ElementKind.ENUM_CONSTANT
    }

    private fun ownerTypeOf(element: Element): TypeElement? {
        var current: Element? = element.enclosingElement
        while (current != null) {
            if (current is TypeElement) {
                return current
            }
            current = current.enclosingElement
        }
        return null
    }

    private fun topLevelTypeElement(element: Element?): TypeElement? {
        var current = element
        var topLevel: TypeElement? = null
        while (current != null) {
            if (current is TypeElement) {
                topLevel = current
            }
            current = current.enclosingElement
        }
        return topLevel
    }

    private fun qualifiedTypeName(typeElement: TypeElement): String {
        return typeElement.qualifiedName.toString()
            .takeIf(String::isNotBlank)
            ?: typeElement.simpleName.toString()
    }

    private fun executableDisplayName(ownerType: TypeElement, executableElement: ExecutableElement): String {
        val parameters = executableElement.parameters.joinToString(", ") { parameter ->
            parameter.asType().toString()
        }
        return if (executableElement.kind == ElementKind.CONSTRUCTOR) {
            "${qualifiedTypeName(ownerType)}($parameters)"
        } else {
            "${qualifiedTypeName(ownerType)}#${executableElement.simpleName}($parameters)"
        }
    }

    private fun isMainMethod(methodElement: ExecutableElement): Boolean {
        if (methodElement.kind != ElementKind.METHOD) {
            return false
        }
        if (!methodElement.simpleName.contentEquals("main")) {
            return false
        }
        if (!methodElement.modifiers.containsAll(setOf(Modifier.PUBLIC, Modifier.STATIC))) {
            return false
        }
        if (methodElement.parameters.size != 1) {
            return false
        }
        return methodElement.parameters.single().asType().toString() == "java.lang.String[]"
    }

    private fun isClassForName(methodElement: ExecutableElement): Boolean {
        if (!methodElement.simpleName.contentEquals("forName")) {
            return false
        }
        val enclosingType = methodElement.enclosingElement as? TypeElement ?: return false
        return enclosingType.qualifiedName.contentEquals("java.lang.Class")
    }

    private fun hasSuppressUnused(annotations: List<AnnotationTree>): Boolean {
        return annotations.any { annotation ->
            annotation.annotationType.toString().endsWith("SuppressWarnings") &&
                annotation.arguments.any { argument -> argument.toString().contains("\"unused\"") }
        }
    }
}
