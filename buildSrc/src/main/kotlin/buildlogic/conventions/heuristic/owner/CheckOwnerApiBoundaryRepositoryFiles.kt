package buildlogic.conventions.heuristic.owner

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
                support.projectTypePackages(
                    parameter.typeRef,
                    context.packageName,
                    context.typeImports,
                    snapshot.knownTypeNames
                )
            }.distinct()
            val returnPackages = support.projectTypePackages(
                method.returnTypeRef ?: "void",
                context.packageName,
                context.typeImports,
                snapshot.knownTypeNames
            )
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
        }
    return reasons
}
