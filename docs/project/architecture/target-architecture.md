# Electron target architecture

SaltMarcher is rebuilt in this repository as a local Electron desktop
application. The JavaFX implementation is preserved only by Git tag
`javafx-final-2026-07-27`; it is neither a parallel runtime nor a source
architecture to extend.

## Runtime boundary

```text
React / PixiJS / Babylon.js
          │
          ▼
Zod-validated, narrow preload capability bridge
          │
          ▼
Electron main: windows, permissions, lifecycle, security
          │
          ▼
Utility process: domain, commands, SQLite, generation, background work
```

The renderer runs with sandboxing and context isolation, with Node integration
disabled, a restrictive CSP, and local content only. It cannot access Node.js,
the filesystem, or SQLite. Main and preload expose only explicit capabilities;
they do not become service locators.

## Source shape

```text
src/
├── main/{application-lifecycle,windows,security,core-process}
├── preload/capability-bridge
├── core/{domain,application,persistence/sqlite,generation,workers}
├── renderer/{shell,features,spatial-2d,spatial-3d}
└── shared/{contracts,ids,errors,testing}
```

Electron, React, TypeScript, `electron-vite`, `electron-builder`, PixiJS,
Babylon.js, `better-sqlite3`, Zod, Vitest, Testing Library, WebdriverIO and
axe-core are mandatory parts of the target stack. Electron is pinned to one
stable version at installation time. WebGL 2 is the rendering baseline;
WebGPU is optional acceleration only.

## Data ownership

`installation.sqlite` holds registry, settings, and reusable definitions.
Each campaign owns `campaigns/<id>/campaign.sqlite`. A utility process alone
opens these stores. Until the first accepted real-use release, the application
uses an isolated development data directory and schema changes may recreate
it. That release freezes the SQLite format; only then do forward migrations
begin.

No legacy data migration, compatibility bridge, Java runtime, JDBC layer, or
generic ORM is part of this architecture.
