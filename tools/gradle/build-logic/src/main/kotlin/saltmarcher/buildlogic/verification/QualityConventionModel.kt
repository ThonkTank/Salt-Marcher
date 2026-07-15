package saltmarcher.buildlogic.verification

import java.io.File
import org.gradle.api.Project
import org.gradle.api.file.Directory
import org.gradle.api.provider.Provider
import saltmarcher.buildlogic.tasks.resolveDesktopDirectory

internal data class QualityConventionPackagingMetadata(
    val appDisplayNameProvider: Provider<String>,
    val desktopIconSourceRelativePathProvider: Provider<String>,
    val desktopEntryIconRelativePathProvider: Provider<String>,
    val windowIconRelativePathProvider: Provider<String>,
    val launcherNameProvider: Provider<String>,
    val mainClassNameProvider: Provider<String>,
    val packageVersionProvider: Provider<String>,
    val preloaderClassNameProvider: Provider<String>,
    val startupWmClassProvider: Provider<String>,
    val stylesheetRelativePathProvider: Provider<String>,
    val installedAppDirectory: Provider<Directory>,
    val desktopDirectory: Provider<Directory>,
    val applicationsDirectory: Provider<Directory>
)

internal data class QualityConventionEnvironment(
    val packagingMetadata: QualityConventionPackagingMetadata
)

internal fun Project.createQualityConventionEnvironment(): QualityConventionEnvironment {
    val appDisplayName = providers.gradleProperty("saltMarcherDisplayName").orElse("SaltMarcher")
    val iconSource = providers.gradleProperty("saltMarcherDesktopIconSource").orElse("icons/salt-marcher.svg")
    val launcher = providers.gradleProperty("saltMarcherLauncherName").orElse("saltmarcher")
    return QualityConventionEnvironment(
        QualityConventionPackagingMetadata(
            appDisplayNameProvider = appDisplayName,
            desktopIconSourceRelativePathProvider = iconSource,
            desktopEntryIconRelativePathProvider = providers.gradleProperty("saltMarcherDesktopEntryIcon").orElse(iconSource),
            windowIconRelativePathProvider = providers.gradleProperty("saltMarcherWindowIcon").orElse("icons/salt-marcher.png"),
            launcherNameProvider = launcher,
            mainClassNameProvider = providers.gradleProperty("saltMarcherMainClass").orElse("bootstrap.SaltMarcherApp"),
            packageVersionProvider = providers.gradleProperty("saltMarcherVersion").orElse("0.1.0"),
            preloaderClassNameProvider = providers.gradleProperty("saltMarcherPreloaderClass").orElse("bootstrap.SaltMarcherPreloader"),
            startupWmClassProvider = providers.gradleProperty("saltMarcherStartupWmClass").orElse("bootstrap.SaltMarcherApp"),
            stylesheetRelativePathProvider = providers.gradleProperty("saltMarcherStylesheet").orElse("resources/salt-marcher.css"),
            installedAppDirectory = layout.dir(launcher.map { File(System.getProperty("user.home"), ".local/opt/$it") }),
            desktopDirectory = layout.dir(providers.provider { resolveDesktopDirectory().toFile() }),
            applicationsDirectory = layout.dir(providers.provider { File(System.getProperty("user.home"), ".local/share/applications") })
        )
    )
}
