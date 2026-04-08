package buildlogic.packaging

import java.nio.file.Files
import java.nio.file.Paths
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerInstallDesktopEntriesTask(
    support: PackagingSupport,
    installAppImage: TaskProvider<*>
): TaskProvider<Task> = tasks.register("installDesktopEntries") {
    group = "distribution"
    description = "Install desktop shortcut entries for the packaged Salt Marcher app."
    dependsOn(installAppImage)

    inputs.property("desktopEntryContent", support.desktopEntryContent)
    outputs.files(
        providers.provider {
            val desktopDir = support.resolveDesktopDirectory()
            listOf(
                desktopDir.resolve(support.desktopEntryName).toFile(),
                Paths.get(System.getProperty("user.home"), ".local", "share", "applications", "${support.config.launcherName}.desktop").toFile()
            )
        }
    )

    doLast {
        val desktopDir = support.resolveDesktopDirectory()
        val desktopFile = desktopDir.resolve(support.desktopEntryName)
        val applicationsFile = Paths.get(
            System.getProperty("user.home"),
            ".local",
            "share",
            "applications",
            "${support.config.launcherName}.desktop"
        )

        Files.createDirectories(desktopDir)
        Files.createDirectories(applicationsFile.parent)
        Files.writeString(desktopFile, support.desktopEntryContent.get())
        Files.writeString(applicationsFile, support.desktopEntryContent.get())
        support.setExecutableDesktopFile(desktopFile)
        support.setExecutableDesktopFile(applicationsFile)
    }
}
