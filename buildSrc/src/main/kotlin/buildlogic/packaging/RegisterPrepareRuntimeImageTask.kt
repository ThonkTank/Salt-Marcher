package buildlogic.packaging

import java.nio.file.Files
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerPrepareRuntimeImageTask(
    support: PackagingSupport
): TaskProvider<Task> = tasks.register("prepareRuntimeImage") {
    description = "Create a materialized runtime image for jpackage without external symlink dependencies."

    inputs.dir(support.localRuntimeImage)
    outputs.dir(support.preparedRuntimeImageDir)

    doLast {
        val sourceDir = support.localRuntimeImage.get().toRealPath()
        val targetDir = support.preparedRuntimeImageDir.get().asFile.toPath()

        delete(targetDir.toFile())
        Files.createDirectories(targetDir)
        support.copyRuntimeImage(sourceDir, targetDir)
    }
}
