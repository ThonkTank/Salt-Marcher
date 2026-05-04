import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension
import saltmarcher.buildlogic.enforcement.loadEnforcementBundlesExtension

val extension = loadEnforcementBundlesExtension(rootDir)
extensions.add(EnforcementBundlesExtension::class.java, "saltmarcherEnforcementBundles", extension)
