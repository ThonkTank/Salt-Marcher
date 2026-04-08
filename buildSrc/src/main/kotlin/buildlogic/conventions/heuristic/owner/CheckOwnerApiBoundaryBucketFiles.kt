package buildlogic.conventions.heuristic.owner

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckOwnerApiBoundaryBucketFilesTask(
    support: OwnerConventionSupport
): TaskProvider<Task> = support.registerCheck(
    taskName = "checkOwnerApiBoundaryBucketFiles",
    taskDescription = "Fail when touched owner bucket files drift away from the canonical *Bucket rules.",
    failureHeader = "Owner bucket drift detected.",
    failureSummary = "Touched *Bucket directories are organizational only and must remain free of Java files.",
    applicableRoles = setOf(support.bucketRole)
) { sourceFile, _ ->
    support.bucketFileReasons(sourceFile)
}
