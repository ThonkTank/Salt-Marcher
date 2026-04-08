package buildlogic.packaging

import org.gradle.api.Project
import org.gradle.api.tasks.Exec
import org.gradle.api.tasks.TaskProvider
import org.gradle.jvm.tasks.Jar

fun Project.registerPackageAppImageTask(
    support: PackagingSupport,
    stageJpackageInput: TaskProvider<*>,
    prepareRuntimeImage: TaskProvider<*>
): TaskProvider<Exec> = tasks.register("packageAppImage", Exec::class.java) {
    group = "distribution"
    description = "Build a self-contained Linux app image with jpackage."
    dependsOn(stageJpackageInput, prepareRuntimeImage)

    val mainJar = tasks.named("jar", Jar::class.java).flatMap { it.archiveFileName }
    inputs.dir(support.jpackageInputDir)
    inputs.file(support.iconFile())
    inputs.dir(support.preparedRuntimeImageDir)
    outputs.dir(support.packagedAppImageDir)

    onlyIf {
        support.resolveJpackageExecutable() != null
    }

    doFirst {
        delete(support.packagedAppImageDir.get().asFile)
        delete(support.jpackageTempDir.get().asFile)
        support.jpackageOutputDir.get().asFile.mkdirs()
        support.jpackageTempDir.get().asFile.mkdirs()
        val jpackageExecutable = support.resolveJpackageExecutable() ?: error("jpackage executable not found")
        commandLine(
            jpackageExecutable,
            "--type", "app-image",
            "--dest", support.jpackageOutputDir.get().asFile.absolutePath,
            "--temp", support.jpackageTempDir.get().asFile.absolutePath,
            "--input", support.jpackageInputDir.get().asFile.absolutePath,
            "--name", support.config.launcherName,
            "--app-version", support.config.packageVersion.get(),
            "--vendor", "Salt Marcher",
            "--runtime-image", support.preparedRuntimeImageDir.get().asFile.absolutePath,
            "--main-jar", mainJar.get(),
            "--main-class", project.extensions.getByType(org.gradle.api.plugins.JavaApplication::class.java).mainClass.get(),
            "--java-options", support.config.jpackageModulePathArg,
            "--java-options", support.config.jpackageAddModulesArg,
            "--java-options", support.config.preloaderJvmArg
        )
    }
}
