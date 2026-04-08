package buildlogic.ownerconvention

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckOwnerApiBoundaryOwnerFilesTask(
    support: OwnerConventionSupport
): TaskProvider<Task> = support.registerCheck(
    taskName = "checkOwnerApiBoundaryOwnerFiles",
    taskDescription = "Fail when touched owner entrypoint files drift away from the canonical *Object seam rules.",
    failureHeader = "Owner entrypoint drift detected.",
    failureSummary = "Touched owner files must remain single-file public *Object seams that expose only project input types.",
    applicableRoles = setOf(support.ownerRole)
) { sourceFile, snapshot ->
    support.ownerFileReasons(sourceFile.context, sourceFile.sourceText, snapshot.knownTypeNames)
}
