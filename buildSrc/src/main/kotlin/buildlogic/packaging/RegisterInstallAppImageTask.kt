package buildlogic.packaging

import java.nio.file.Files
import java.nio.file.StandardCopyOption
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerInstallAppImageTask(
    support: PackagingSupport,
    packageAppImage: TaskProvider<*>,
    packageAppImageFallback: TaskProvider<*>
): TaskProvider<Task> = tasks.register("installAppImage") {
    group = "distribution"
    description = "Install the packaged app image into ~/.local/opt/salt-marcher."
    dependsOn(packageAppImage, packageAppImageFallback)

    inputs.dir(support.packagedAppImageDir)
    inputs.file(support.iconFile())
    outputs.dir(support.installedAppDir)

    doLast {
        val sourceDir = support.packagedAppImageDir.get().asFile.toPath()
        val targetDir = support.installedAppDir.get()
        val stagingDir = targetDir.resolveSibling("${targetDir.fileName}.tmp")

        delete(stagingDir.toFile())
        copy {
            from(sourceDir)
            into(stagingDir)
        }

        val iconTarget = stagingDir.resolve(support.config.desktopIconRelativePath)
        Files.createDirectories(iconTarget.parent)
        Files.copy(
            support.iconFile().asFile.toPath(),
            iconTarget,
            StandardCopyOption.REPLACE_EXISTING
        )

        delete(targetDir.toFile())
        Files.move(stagingDir, targetDir, StandardCopyOption.REPLACE_EXISTING)
    }
}
