package buildlogic.conventions.heuristic.owner

import com.sun.source.tree.BlockTree
import com.sun.source.tree.ClassTree
import com.sun.source.tree.MethodInvocationTree
import com.sun.source.tree.NewClassTree
import com.sun.source.util.TreePath
import com.sun.source.util.TreePathScanner
import javax.lang.model.element.ExecutableElement
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
    failureSummary = "Touched repository files must stay stateless static state translators that depend only on their owner's state layer.",
    applicableRoles = setOf(support.repositoryRole)
) { sourceFile, snapshot ->
    analyzeRepositoryFile(sourceFile, snapshot, support).reasons
}

internal fun analyzeRepositoryFile(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): OwnerConventionAnalysis<OwnerConventionStaticApi> {
    val shapeAnalysis = support.analyzeRepositoryShape(sourceFile, snapshot)
    return support.extendShapeAnalysis(sourceFile, shapeAnalysis) { primaryType ->
        repositoryBodyReasons(
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            primaryType = primaryType
        )
    }
}

internal fun repositoryClassShapeReasons(
    path: String,
    primaryType: OwnerConventionParsedJavaType
): List<String> {
    val reasons = mutableListOf<String>()
    val classTree = primaryType.tree
    if (primaryType.fields.isNotEmpty()) {
        reasons += "$path :: repository files must not declare fields"
    }
    if (classTree.members.any { member -> member is BlockTree }) {
        reasons += "$path :: repository files must not declare initializer blocks"
    }
    if (classTree.members.any { member -> member is ClassTree }) {
        reasons += "$path :: repository files must not declare nested types"
    }
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
        return if (isStaticRepositorySelfCall(invocation, sourceFile, snapshot, support)) {
            emptyList()
        } else {
            listOf("${context.path} :: repository bodies must not call same-type instance helpers ($memberName -> $calleeTypeName)")
        }
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
        return listOf("${context.path} :: repository bodies must not instantiate their own repository type ($memberName -> $typeName)")
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

private fun isStaticRepositorySelfCall(
    invocation: MethodInvocationTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): Boolean {
    val methodElement = support.elementFor(invocation, sourceFile.parsedSource, snapshot) as? ExecutableElement
        ?: return false
    return Modifier.STATIC in methodElement.modifiers
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
