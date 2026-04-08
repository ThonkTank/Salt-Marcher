package buildlogic.conventions.heuristic.owner

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
    support.repositoryFileReasons(sourceFile.context, sourceFile.sourceText, snapshot.knownTypeNames)
}
