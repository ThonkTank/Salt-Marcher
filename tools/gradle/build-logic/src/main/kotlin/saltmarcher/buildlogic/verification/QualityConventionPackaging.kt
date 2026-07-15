package saltmarcher.buildlogic.verification

import java.io.File
import org.gradle.api.Project
import org.gradle.api.tasks.Sync
import org.gradle.jvm.tasks.Jar
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.language.jvm.tasks.ProcessResources
import saltmarcher.buildlogic.tasks.CheckDesktopAppImageLayoutTask
import saltmarcher.buildlogic.tasks.CheckDesktopPackagingInputsTask
import saltmarcher.buildlogic.tasks.InstallAppImageTask
import saltmarcher.buildlogic.tasks.InstallDesktopEntriesTask
import saltmarcher.buildlogic.tasks.PackageAppImageFallbackTask
import saltmarcher.buildlogic.tasks.PackageAppImageTask
import saltmarcher.buildlogic.tasks.PrepareRuntimeImageTask
import saltmarcher.buildlogic.tasks.RenderDesktopIconTask
import saltmarcher.buildlogic.tasks.isJavafxRuntimeJar
import saltmarcher.buildlogic.tasks.resolveJpackageExecutable

private const val JavafxModuleDirName = "javafx"
private const val JpackageModulePathArg = "--module-path=\$APPDIR/$JavafxModuleDirName"
private const val JpackageAddModulesArg = "--add-modules=javafx.controls"

internal fun Project.registerQualityConventionPackagingTasks(environment: QualityConventionEnvironment) {
    val packaging = environment.packagingMetadata
    val preloaderJvmArgProvider = packaging.preloaderClassNameProvider.map { "-Djavafx.preloader=$it" }
    val jpackageInputDir = layout.buildDirectory.dir("packaging/jpackage-input")
    val jpackageOutputDir = layout.buildDirectory.dir("packaging/jpackage")
    val jpackageTempDir = layout.buildDirectory.dir("packaging/tmp")
    val preparedRuntimeImageDir = layout.buildDirectory.dir("packaging/runtime-image")
    val packagedAppImageDir = packaging.launcherNameProvider.flatMap { launcherName ->
        jpackageOutputDir.map { output -> output.dir(launcherName) }
    }
    val desktopEntryFileName = packaging.launcherNameProvider.map { "$it.desktop" }
    val generatedWindowIconDir = layout.buildDirectory.dir("generated/window-icon")
    val generatedWindowIconFile = packaging.windowIconRelativePathProvider.flatMap { relativePath ->
        generatedWindowIconDir.map { dir -> dir.file(relativePath) }
    }

    val renderDesktopIconPng = tasks.register<RenderDesktopIconTask>("renderDesktopIconPng") {
        group = "distribution"
        description = "Render the generated runtime PNG icon from the canonical SVG source."
        projectRoot.set(layout.projectDirectory)
        sourceFile.set(layout.projectDirectory.file(packaging.desktopIconSourceRelativePathProvider.map { "resources/$it" }))
        outputDirectory.set(generatedWindowIconDir)
        outputRelativePath.set(packaging.windowIconRelativePathProvider)
        commandName.set("magick")
    }

    tasks.named<ProcessResources>("processResources") {
        dependsOn(renderDesktopIconPng)
        from(renderDesktopIconPng.flatMap { task -> task.outputDirectory })
    }

    tasks.register<CheckDesktopPackagingInputsTask>("checkDesktopPackagingInputs") {
        group = "distribution"
        description = "Validate main class, icon, stylesheet, and launcher metadata required for desktop packaging."
        mainClassSourceFile.set(layout.projectDirectory.file(packaging.mainClassNameProvider.map { "${it.replace('.', '/')}.java" }))
        preloaderClassSourceFile.set(layout.projectDirectory.file(packaging.preloaderClassNameProvider.map { "${it.replace('.', '/')}.java" }))
        desktopIconSourceFile.set(layout.projectDirectory.file(packaging.desktopIconSourceRelativePathProvider.map { "resources/$it" }))
        stylesheetFile.set(layout.projectDirectory.file(packaging.stylesheetRelativePathProvider))
        mainClassName.set(packaging.mainClassNameProvider)
        preloaderClassName.set(packaging.preloaderClassNameProvider)
        desktopIconSourceRelativePath.set(packaging.desktopIconSourceRelativePathProvider)
        desktopEntryIconRelativePath.set(packaging.desktopEntryIconRelativePathProvider)
        windowIconRelativePath.set(packaging.windowIconRelativePathProvider)
        stylesheetRelativePath.set(packaging.stylesheetRelativePathProvider)
        launcherName.set(packaging.launcherNameProvider)
        startupWmClass.set(packaging.startupWmClassProvider)
        successMarker.set(layout.buildDirectory.file("verification-markers/checkDesktopPackagingInputs/success.marker"))
    }

    val runtimeClasspath = configurations.named("runtimeClasspath")
    val stageJpackageInput = tasks.register<Sync>("stageJpackageInput") {
        dependsOn(tasks.named("jar"))
        from(tasks.named("jar"))
        from(runtimeClasspath.map { it.filterNot(::isJavafxRuntimeJar) })
        from(runtimeClasspath.map { it.filter(::isJavafxRuntimeJar) }) {
            into(JavafxModuleDirName)
        }
        into(jpackageInputDir)
    }

    val prepareRuntimeImage = tasks.register<PrepareRuntimeImageTask>("prepareRuntimeImage") {
        description = "Create a materialized runtime image for jpackage without external symlink dependencies."
        runtimeImageDirectory.set(layout.dir(providers.provider { File(System.getProperty("java.home")) }))
        outputDirectory.set(preparedRuntimeImageDir)
    }

    val packageAppImage = tasks.register<PackageAppImageTask>("packageAppImage") {
        group = "distribution"
        description = "Build a self-contained Linux app image with jpackage."
        dependsOn(stageJpackageInput, prepareRuntimeImage, renderDesktopIconPng)
        onlyIf { resolveJpackageExecutable() != null }
        destinationRootDirectory.set(jpackageOutputDir)
        tempDirectory.set(jpackageTempDir)
        outputDirectory.set(packagedAppImageDir)
        jpackageInputDirectory.set(jpackageInputDir)
        windowIconFile.set(generatedWindowIconFile)
        runtimeImageDirectory.set(preparedRuntimeImageDir)
        mainJarFileName.set(tasks.named<Jar>("jar").flatMap { it.archiveFileName })
        launcherName.set(packaging.launcherNameProvider)
        packageVersion.set(packaging.packageVersionProvider)
        appDisplayName.set(packaging.appDisplayNameProvider)
        mainClassName.set(packaging.mainClassNameProvider)
        preloaderJvmArg.set(preloaderJvmArgProvider)
        modulePathArg.set(JpackageModulePathArg)
        addModulesArg.set(JpackageAddModulesArg)
    }

    val packageAppImageFallback = tasks.register<PackageAppImageFallbackTask>("packageAppImageFallback") {
        group = "distribution"
        description = "Build a self-contained Linux app image without jpackage when the tool is unavailable."
        dependsOn(stageJpackageInput, prepareRuntimeImage)
        onlyIf { resolveJpackageExecutable() == null }
        inputDirectory.set(jpackageInputDir)
        runtimeImageDirectory.set(preparedRuntimeImageDir)
        outputDirectory.set(packagedAppImageDir)
        launcherName.set(packaging.launcherNameProvider)
        mainClassName.set(packaging.mainClassNameProvider)
        preloaderJvmArg.set(preloaderJvmArgProvider)
        javafxModuleDirName.set(JavafxModuleDirName)
        addModulesArg.set(JpackageAddModulesArg)
    }

    val checkDesktopAppImageLayout = tasks.register<CheckDesktopAppImageLayoutTask>("checkDesktopAppImageLayout") {
        group = "distribution"
        description = "Validate the packaged desktop app image keeps JavaFX on a dedicated module path."
        dependsOn(packageAppImage, packageAppImageFallback)
        appImageDirectory.set(packagedAppImageDir)
        expectedJavafxJarNames.set(
            runtimeClasspath.map { classpath ->
                classpath.map(File::getName).filter { it.startsWith("javafx-") && it.endsWith(".jar") }.sorted()
            }
        )
        launcherName.set(packaging.launcherNameProvider)
        modulePathArg.set(JpackageModulePathArg)
        javafxModuleDirName.set(JavafxModuleDirName)
        successMarker.set(layout.buildDirectory.file("verification-markers/checkDesktopAppImageLayout/success.marker"))
    }

    val installAppImage = tasks.register<InstallAppImageTask>("installAppImage") {
        group = "distribution"
        description = "Install the packaged app image into the user-local application directory."
        dependsOn(checkDesktopAppImageLayout)
        sourceDirectory.set(packagedAppImageDir)
        desktopIconSourceFile.set(layout.projectDirectory.file(packaging.desktopIconSourceRelativePathProvider.map { "resources/$it" }))
        desktopEntryIconRelativePath.set(packaging.desktopEntryIconRelativePathProvider)
        outputDirectory.set(packaging.installedAppDirectory)
    }

    val installDesktopEntries = tasks.register<InstallDesktopEntriesTask>("installDesktopEntries") {
        group = "distribution"
        description = "Install desktop shortcut entries for the packaged SaltMarcher app."
        dependsOn(installAppImage)
        installedAppDirectory.set(packaging.installedAppDirectory)
        launcherName.set(packaging.launcherNameProvider)
        appDisplayName.set(packaging.appDisplayNameProvider)
        desktopEntryIconRelativePath.set(packaging.desktopEntryIconRelativePathProvider)
        startupWmClass.set(packaging.startupWmClassProvider)
        desktopFile.set(packaging.desktopDirectory.flatMap { dir -> desktopEntryFileName.map { fileName -> dir.file(fileName) } })
        applicationsFile.set(packaging.applicationsDirectory.flatMap { dir -> desktopEntryFileName.map { fileName -> dir.file(fileName) } })
    }

    tasks.register("installDesktopApp") {
        group = "distribution"
        description = "Build, install, and register SaltMarcher as a desktop application."
        dependsOn(installDesktopEntries)
    }
}
