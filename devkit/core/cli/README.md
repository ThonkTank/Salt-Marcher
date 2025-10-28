# DevKit CLI

Command-line interface for Salt Marcher development.

## Installation

The DevKit CLI is ready to use out of the box:

```bash
./devkit/core/cli/devkit --help
```

### Bash Completion (Optional)

For the best developer experience, enable tab completion:

```bash
# Load for current session
source devkit/core/cli/devkit-completion.bash

# Permanent installation - add to ~/.bashrc
echo "source $(pwd)/devkit/core/cli/devkit-completion.bash" >> ~/.bashrc
source ~/.bashrc
```

After enabling completion, you can use TAB to discover and complete:
- Main commands: `./devkit <TAB>`
- Subcommands: `./devkit test <TAB>`
- Test suites: `./devkit test run <TAB>`
- Migrations: `./devkit migrate <TAB>`
- Entity types: `./devkit ui open <TAB>`
- Validation modes: `./devkit ui validate <TAB>`

## Files

- **devkit** - Main bash wrapper script
- **devkit.mjs** - Node.js CLI implementation
- **devkit-completion.bash** - Bash completion script

## Usage

See `devkit/README.md` for complete documentation.

## Architecture

The CLI uses a two-layer architecture:

1. **Bash wrapper** (`devkit`)
   - Loads configuration from `.devkitrc.json`
   - Expands aliases
   - Routes to Node.js CLI or handles quick actions

2. **Node.js CLI** (`devkit.mjs`)
   - Implements command handlers
   - Communicates with plugin via IPC
   - Executes test runners and migrations

This design allows for:
- Fast alias expansion in bash
- Rich functionality in Node.js
- Clean separation of concerns
- Easy testing and maintenance
