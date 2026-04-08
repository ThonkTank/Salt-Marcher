package buildlogic.ownerconvention

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckOwnerApiBoundaryTaskFilesTask(
    support: OwnerConventionSupport
): TaskProvider<Task> = support.registerCheck(
    taskName = "checkOwnerApiBoundaryTaskFiles",
    taskDescription = "Fail when touched owner task files drift away from the canonical <Request>Task rules.",
    failureHeader = "Owner task drift detected.",
    failureSummary = "Touched task files must remain static input-to-input pipelines that align with a real owner public request.",
    applicableRoles = setOf(support.taskRole)
) { sourceFile, snapshot ->
    support.taskFileReasons(
        sourceFile.context,
        sourceFile.sourceText,
        snapshot.knownTypeNames,
        snapshot.requestStemsByOwner
    )
}
