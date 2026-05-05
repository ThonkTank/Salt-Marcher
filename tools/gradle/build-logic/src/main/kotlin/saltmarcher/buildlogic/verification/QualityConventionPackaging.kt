package saltmarcher.buildlogic.verification

import java.io.File
import java.nio.file.Path
import org.gradle.api.Project
import org.gradle.api.tasks.Sync
import org.gradle.jvm.tasks.Jar
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.language.base.plugins.LifecycleBasePlugin
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
import saltmarcher.buildlogic.tasks.resolveDesktopDirectory
import saltmarcher.buildlogic.tasks.resolveJpackageExecutable

private const val JavafxModuleDirName = "javafx"
private const val JpackageModulePathArg = "--module-path=\$APPDIR/$JavafxModuleDirName"
private const val JpackageAddModulesArg = "--add-modules=javafx.controls"

internal fun Project.registerQualityConventionPackagingTasks(environment: QualityConventionEnvironment) {
    val preloaderJvmArgProvider = environment.preloaderClassNameProvider.map { "-Djavafx.preloader=$it" }
    val jpackageInputDir = layout.buildDirectory.dir("packaging/jpackage-input")
    val jpackageOutputDir = layout.buildDirectory.dir("packaging/jpackage")
    val jpackageTempDir = layout.buildDirectory.dir("packaging/tmp")
    val preparedRuntimeImageDir = layout.buildDirectory.dir("packaging/runtime-image")
    val packagedAppImageDir = environment.launcherNameProvider.flatMap { launcherName ->
        jpackageOutputDir.map { output -> output.dir(launcherName) }
    }
    val installedAppDir = layout.dir(providers.provider {
        Path.of(System.getProperty("user.home"), ".local", "opt", environment.launcherNameProvider.get()).toFile()
    })
    val desktopDirectory = layout.dir(providers.provider { resolveDesktopDirectory().toFile() })
    val applicationsDirectory = layout.dir(providers.provider {
        Path.of(System.getProperty("user.home"), ".local", "share", "applications").toFile()
    })
    val desktopEntryFileName = environment.launcherNameProvider.map { "$it.desktop" }
    val desktopEntryContentProvider = providers.provider {
        val installDir = installedAppDir.get().asFile.toPath()
        val execPath = installDir.resolve("bin").resolve(environment.launcherNameProvider.get())
        val iconPath = installDir.resolve(environment.desktopEntryIconRelativePathProvider.get())
        """
        [Desktop Entry]
        Version=1.0
        Type=Application
        Name=${environment.appDisplayNameProvider.get()}
        Comment=Launch ${environment.appDisplayNameProvider.get()}
        Exec=${execPath.toAbsolutePath()}
        Icon=${iconPath.toAbsolutePath()}
        Terminal=false
        Categories=Utility;Development;
        StartupNotify=true
        StartupWMClass=${environment.startupWmClassProvider.get()}
        """.trimIndent() + "\n"
    }
    val generatedWindowIconDir = layout.buildDirectory.dir("generated/window-icon")
    val generatedWindowIconFile = environment.windowIconRelativePathProvider.flatMap { relativePath ->
        generatedWindowIconDir.map { dir -> dir.file(relativePath) }
    }

    val renderDesktopIconPng = tasks.register<RenderDesktopIconTask>("renderDesktopIconPng") {
        group = "distribution"
        description = "Render the generated runtime PNG icon from the canonical SVG source."
        projectRoot.set(layout.projectDirectory)
        sourceFile.set(layout.projectDirectory.file(environment.desktopIconSourceRelativePathProvider.map { "resources/$it" }))
        outputDirectory.set(generatedWindowIconDir)
        outputRelativePath.set(environment.windowIconRelativePathProvider)
        commandName.set("magick")
    }

    tasks.named<ProcessResources>("processResources") {
        if (!environment.focusedEnforcementBundleMode) {
            dependsOn(renderDesktopIconPng)
            from(renderDesktopIconPng.flatMap { task -> task.outputDirectory })
        }
    }

    tasks.register<CheckDesktopPackagingInputsTask>("checkDesktopPackagingInputs") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Validate main class, icon, stylesheet, and launcher metadata required for desktop packaging."
        mainClassSourceFile.set(layout.projectDirectory.file(environment.mainClassNameProvider.map { "${it.replace('.', '/')}.java" }))
        preloaderClassSourceFile.set(layout.projectDirectory.file(environment.preloaderClassNameProvider.map { "${it.replace('.', '/')}.java" }))
        desktopIconSourceFile.set(layout.projectDirectory.file(environment.desktopIconSourceRelativePathProvider.map { "resources/$it" }))
        stylesheetFile.set(layout.projectDirectory.file(environment.stylesheetRelativePathProvider))
        mainClassName.set(environment.mainClassNameProvider)
        preloaderClassName.set(environment.preloaderClassNameProvider)
        desktopIconSourceRelativePath.set(environment.desktopIconSourceRelativePathProvider)
        desktopEntryIconRelativePath.set(environment.desktopEntryIconRelativePathProvider)
        windowIconRelativePath.set(environment.windowIconRelativePathProvider)
        stylesheetRelativePath.set(environment.stylesheetRelativePathProvider)
        launcherName.set(environment.launcherNameProvider)
        startupWmClass.set(environment.startupWmClassProvider)
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
        launcherName.set(environment.launcherNameProvider)
        packageVersion.set(environment.packageVersionProvider)
        appDisplayName.set(environment.appDisplayNameProvider)
        mainClassName.set(environment.mainClassNameProvider)
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
        launcherName.set(environment.launcherNameProvider)
        mainClassName.set(environment.mainClassNameProvider)
        preloaderJvmArg.set(preloaderJvmArgProvider)
        javafxModuleDirName.set(JavafxModuleDirName)
        addModulesArg.set(JpackageAddModulesArg)
    }

    val checkDesktopAppImageLayout = tasks.register<CheckDesktopAppImageLayoutTask>("checkDesktopAppImageLayout") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Validate the packaged desktop app image keeps JavaFX on a dedicated module path."
        dependsOn(packageAppImage, packageAppImageFallback)
        appImageDirectory.set(packagedAppImageDir)
        expectedJavafxJarNames.set(
            runtimeClasspath.map { classpath ->
                classpath.map(File::getName).filter { it.startsWith("javafx-") && it.endsWith(".jar") }.sorted()
            }
        )
        launcherName.set(environment.launcherNameProvider)
        modulePathArg.set(JpackageModulePathArg)
        javafxModuleDirName.set(JavafxModuleDirName)
        successMarker.set(layout.buildDirectory.file("verification-markers/checkDesktopAppImageLayout/success.marker"))
    }

    val installAppImage = tasks.register<InstallAppImageTask>("installAppImage") {
        group = "distribution"
        description = "Install the packaged app image into the user-local application directory."
        dependsOn(checkDesktopAppImageLayout)
        sourceDirectory.set(packagedAppImageDir)
        desktopIconSourceFile.set(layout.projectDirectory.file(environment.desktopIconSourceRelativePathProvider.map { "resources/$it" }))
        desktopEntryIconRelativePath.set(environment.desktopEntryIconRelativePathProvider)
        outputDirectory.set(installedAppDir)
    }

    val installDesktopEntries = tasks.register<InstallDesktopEntriesTask>("installDesktopEntries") {
        group = "distribution"
        description = "Install desktop shortcut entries for the packaged SaltMarcher app."
        dependsOn(installAppImage)
        desktopEntryContent.set(desktopEntryContentProvider)
        desktopFile.set(desktopDirectory.flatMap { dir -> desktopEntryFileName.map { fileName -> dir.file(fileName) } })
        applicationsFile.set(applicationsDirectory.flatMap { dir -> desktopEntryFileName.map { fileName -> dir.file(fileName) } })
    }

    tasks.register("installDesktopApp") {
        group = "distribution"
        description = "Build, install, and register SaltMarcher as a desktop application."
        dependsOn(installDesktopEntries)
    }
}
