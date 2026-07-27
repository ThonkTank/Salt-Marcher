import org.gradle.api.tasks.JavaExec
import org.gradle.jvm.application.tasks.CreateStartScripts

plugins {
    java
    application
    id("org.openjfx.javafxplugin") version "0.1.0"
}

val launcherName = providers.gradleProperty("saltMarcherLauncherName").orElse("saltmarcher")
val mainClassName = providers.gradleProperty("saltMarcherMainClass").orElse("app.SaltMarcherApp")
val preloaderClassName = providers.gradleProperty("saltMarcherPreloaderClass")
    .orElse("app.SaltMarcherPreloader")

repositories {
    mavenCentral()
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

javafx {
    version = "21.0.2"
    modules = listOf("javafx.controls")
}

sourceSets {
    main {
        java {
            setSrcDirs(listOf("app", "shell", "platform", "features"))
        }
        resources {
            setSrcDirs(listOf("resources"))
        }
    }
}

dependencies {
    implementation("org.jspecify:jspecify:1.0.0")
    implementation("org.xerial:sqlite-jdbc:3.53.2.0")
}

application {
    mainClass.set(mainClassName)
    applicationDefaultJvmArgs = listOf(preloaderClassName.map { "-Djavafx.preloader=$it" }.get())
}

tasks.withType<CreateStartScripts>().configureEach {
    applicationName = launcherName.get()
}

tasks.register<JavaExec>("importSrdItems") {
    group = "application"
    description = "Replace the local Items catalog from the public D&D 5e 2014 SRD API."
    dependsOn(tasks.named("classes"))
    classpath = sourceSets["main"].runtimeClasspath
    mainClass.set("app.ItemsImportCommand")
}
