package buildlogic.packaging

import java.nio.file.Files
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerPackageAppImageFallbackTask(
    support: PackagingSupport,
    stageJpackageInput: TaskProvider<*>,
    prepareRuntimeImage: TaskProvider<*>
): TaskProvider<Task> = tasks.register("packageAppImageFallback") {
    group = "distribution"
    description = "Build a self-contained Linux app image without jpackage when the tool is unavailable."
    dependsOn(stageJpackageInput, prepareRuntimeImage)

    inputs.dir(support.jpackageInputDir)
    inputs.dir(support.preparedRuntimeImageDir)
    inputs.file(support.iconFile())
    outputs.dir(support.packagedAppImageDir)

    onlyIf {
        support.resolveJpackageExecutable() == null
    }

    doLast {
        val appImageDir = support.packagedAppImageDir.get().asFile.toPath()
        val appLibDir = support.packagedAppLibDir.get().asFile.toPath()
        val appRuntimeDir = support.packagedAppRuntimeDir.get().asFile.toPath()
        val appBinDir = appImageDir.resolve("bin")
        val launcherFile = appBinDir.resolve(support.config.launcherName)

        delete(appImageDir.toFile())
        Files.createDirectories(appLibDir)
        Files.createDirectories(appRuntimeDir)
        Files.createDirectories(appBinDir)

        copy {
            from(support.jpackageInputDir)
            into(appLibDir.toFile())
        }
        support.copyRuntimeImage(support.preparedRuntimeImageDir.get().asFile.toPath(), appRuntimeDir)

        val mainClass = extensions.getByType(org.gradle.api.plugins.JavaApplication::class.java).mainClass.get()
        val launcherScript = """
            |#!/usr/bin/env sh
            |set -eu
            |
            |APP_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
            |exec "${'$'}APP_DIR/runtime/bin/java" \
            |  "${support.config.preloaderJvmArg}" \
            |  --module-path "${'$'}APP_DIR/app" \
            |  --add-modules=javafx.controls \
            |  -cp "${'$'}APP_DIR/app/*" \
            |  $mainClass \
            |  "${'$'}@"
            |""".trimMargin()
        Files.writeString(launcherFile, launcherScript)
        support.setExecutableFile(launcherFile)
    }
}
