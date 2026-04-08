package buildlogic.conventions.heuristic.owner

import com.sun.source.tree.BlockTree
import com.sun.source.tree.MethodInvocationTree
import com.sun.source.tree.NewClassTree
import com.sun.source.util.TreePath
import com.sun.source.util.TreePathScanner
import javax.lang.model.element.Modifier
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckOwnerApiBoundaryRepositoryFilesTask(
    support: OwnerConventionSupport
): TaskProvider<Task> = support.registerCheck(
    taskName = "checkOwnerApiBoundaryRepositoryFiles",
    taskDescription = "Fail when touched owner repository files drift away from the canonical state-persistence rules.",
    failureHeader = "Owner repository drift detected.",
    failureSummary = "Touched repository files must stay static state translators that depend only on their owner's state layer.",
    applicableRoles = setOf(support.repositoryRole)
) { sourceFile, snapshot ->
    repositoryFileReasons(sourceFile, snapshot, support)
}

private fun repositoryFileReasons(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): List<String> {
    val context = sourceFile.context
    val reasons = mutableListOf<String>()
    val className = context.className.removeSuffix(".java")
    val primaryType = support.parsedPrimaryType(sourceFile)
    if (primaryType == null) {
        reasons += "${context.path} :: repository files must declare a top-level type named $className"
        return reasons
    }
    if (sourceFile.parsedSource.topLevelTypes.size != 1) {
        reasons += "${context.path} :: repository files must contain exactly one top-level type"
    }
    if (primaryType.kind != OwnerConventionParsedJavaTypeKind.CLASS || Modifier.FINAL !in primaryType.modifiers) {
        reasons += "${context.path} :: repository files must declare a final class"
    }
    if (
        primaryType.constructors.none { Modifier.PRIVATE in it.modifiers } ||
        primaryType.constructors.any { Modifier.PUBLIC in it.modifiers }
    ) {
        reasons += "${context.path} :: repository files must hide construction behind a private constructor"
    }
    context.typeImports.importedPackages.forEach { importedPackage ->
        val importedRole = support.roleForDirectoryName(importedPackage.substringAfterLast('.'))
        val allowed = support.sameOwner(context.ownerPackage, importedPackage) && importedRole == support.stateRole
        if (!allowed) {
            reasons += "${context.path} -> $importedPackage :: repository files may import only own state packages from project code"
        }
    }
    val publicMethods = primaryType.methods.filter { Modifier.PUBLIC in it.modifiers }
    if (publicMethods.none { Modifier.STATIC in it.modifiers }) {
        reasons += "${context.path} :: repository files must expose public static persistence methods"
    }
    if (publicMethods.any { Modifier.STATIC !in it.modifiers }) {
        reasons += "${context.path} :: repository files must not expose public instance methods"
    }
    publicMethods
        .filter { Modifier.STATIC in it.modifiers }
        .forEach { method ->
            val parameterPackages = method.parameters.flatMap { parameter ->
                support.projectTypePackages(parameter.tree.type, sourceFile.parsedSource, snapshot)
            }.distinct()
            val returnPackages = support.projectTypePackages(method.tree.returnType, sourceFile.parsedSource, snapshot)
            val stateTypesExposed = (parameterPackages + returnPackages).any { projectPackage ->
                support.sameOwner(context.ownerPackage, projectPackage) &&
                    support.roleForDirectoryName(projectPackage.substringAfterLast('.')) == support.stateRole
            }
            if (parameterPackages.any { projectPackage ->
                    !support.sameOwner(context.ownerPackage, projectPackage) ||
                        support.roleForDirectoryName(projectPackage.substringAfterLast('.')) != support.stateRole
                }
            ) {
                reasons += "${context.path} :: repository methods may accept only own state types from project code"
            }
            if (returnPackages.any { projectPackage ->
                    !support.sameOwner(context.ownerPackage, projectPackage) ||
                        support.roleForDirectoryName(projectPackage.substringAfterLast('.')) != support.stateRole
                }
            ) {
                reasons += "${context.path} :: repository methods may return only own state types from project code"
            }
            if (!stateTypesExposed) {
                reasons += "${context.path} :: repository methods must expose at least one own state type in parameters or return position"
            }
        }
    reasons += repositoryBodyReasons(
        sourceFile = sourceFile,
        snapshot = snapshot,
        support = support,
        primaryType = primaryType
    )
    return reasons
}

private fun repositoryBodyReasons(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    primaryType: OwnerConventionParsedJavaType
): List<String> {
    val currentTypeName = "${sourceFile.context.packageName}.${primaryType.name}"
    val reasons = mutableListOf<String>()
    primaryType.constructors.forEach { constructor ->
        reasons += scanRepositoryBody(
            body = constructor.body,
            memberName = "<init>",
            currentTypeName = currentTypeName,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support
        )
    }
    primaryType.methods.forEach { method ->
        reasons += scanRepositoryBody(
            body = method.body,
            memberName = method.name,
            currentTypeName = currentTypeName,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support
        )
    }
    return reasons.distinct()
}

private fun scanRepositoryBody(
    body: BlockTree?,
    memberName: String,
    currentTypeName: String,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): List<String> {
    if (body == null) {
        return emptyList()
    }
    val reasons = mutableListOf<String>()
    object : TreePathScanner<Unit, Nothing?>() {
        override fun visitMethodInvocation(node: MethodInvocationTree, p: Nothing?) {
            reasons += repositoryInvocationReasons(
                invocation = node,
                memberName = memberName,
                currentTypeName = currentTypeName,
                sourceFile = sourceFile,
                snapshot = snapshot,
                support = support
            )
            super.visitMethodInvocation(node, p)
        }

        override fun visitNewClass(node: NewClassTree, p: Nothing?) {
            reasons += repositoryNewClassReasons(
                expression = node,
                memberName = memberName,
                currentTypeName = currentTypeName,
                sourceFile = sourceFile,
                snapshot = snapshot,
                support = support
            )
            super.visitNewClass(node, p)
        }
    }.scan(TreePath.getPath(sourceFile.parsedSource.compilationUnit, body), null)
    return reasons
}

private fun repositoryInvocationReasons(
    invocation: MethodInvocationTree,
    memberName: String,
    currentTypeName: String,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): List<String> {
    val context = sourceFile.context
    val calleeTypeName = support.topLevelTypeNameForTree(invocation, sourceFile.parsedSource, snapshot) ?: return emptyList()
    if (calleeTypeName == currentTypeName) {
        return emptyList()
    }
    forbiddenRepositoryExternalTypeReason(calleeTypeName)?.let { reason ->
        return listOf("${context.path} :: $reason ($memberName -> $calleeTypeName)")
    }
    if (calleeTypeName !in snapshot.knownTypeNames) {
        return emptyList()
    }
    val calleePackage = calleeTypeName.substringBeforeLast('.')
    val calleeRole = support.roleForDirectoryName(calleePackage.substringAfterLast('.'))
    val calleeOwnerPackage = support.ownerPackageFor(calleePackage, calleeRole)
    return when {
        calleeOwnerPackage == context.ownerPackage && calleeRole == support.stateRole -> emptyList()
        calleeRole == support.ownerRole ->
            listOf("${context.path} :: repository bodies must not orchestrate owner seams ($memberName -> $calleeTypeName)")
        calleeRole == support.taskRole ->
            listOf("${context.path} :: repository bodies must not call task pipelines ($memberName -> $calleeTypeName)")
        calleeRole == support.repositoryRole ->
            listOf("${context.path} :: repository bodies must not call other repository APIs ($memberName -> $calleeTypeName)")
        else ->
            listOf("${context.path} :: repository bodies may depend only on JDBC, DatabaseManager, local helpers, and own state project types ($memberName -> $calleeTypeName)")
    }
}

private fun repositoryNewClassReasons(
    expression: NewClassTree,
    memberName: String,
    currentTypeName: String,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): List<String> {
    val context = sourceFile.context
    if (expression.classBody != null) {
        return listOf("${context.path} :: repository bodies must not allocate anonymous classes ($memberName)")
    }
    val typeName = support.resolveTypeName(expression.identifier, sourceFile.parsedSource, snapshot)
        ?: return emptyList()
    if (typeName == currentTypeName) {
        return emptyList()
    }
    forbiddenRepositoryExternalTypeReason(typeName)?.let { reason ->
        return listOf("${context.path} :: $reason ($memberName -> $typeName)")
    }
    if (typeName !in snapshot.knownTypeNames) {
        return emptyList()
    }
    val typePackage = typeName.substringBeforeLast('.')
    val typeRole = support.roleForDirectoryName(typePackage.substringAfterLast('.'))
    val targetOwnerPackage = support.ownerPackageFor(typePackage, typeRole)
    return if (targetOwnerPackage == context.ownerPackage && typeRole == support.stateRole) {
        emptyList()
    } else {
        listOf("${context.path} :: repository bodies may construct only own state project types ($memberName -> $typeName)")
    }
}

private fun forbiddenRepositoryExternalTypeReason(typeName: String): String? {
    return when {
        typeName == "database.DatabaseManager" || typeName.startsWith("database.") -> null
        typeName.startsWith("java.sql.") || typeName.startsWith("javax.sql.") -> null
        typeName == "java.lang.Thread" ||
            typeName.startsWith("java.util.concurrent.") ||
            typeName.startsWith("javafx.concurrent.") ->
            "repository bodies must not coordinate threads"
        typeName == "ui" || typeName.startsWith("ui.") ->
            "repository bodies must not touch UI types"
        else -> null
    }
}
