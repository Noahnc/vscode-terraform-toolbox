# Change Log

All notable changes to the terraform-toolbox extension will be documented in this file.

## [0.2.0]

- (refac) Refactoring terrraform version management (releases are now directly downloaded instead of compiled from source. GO is therefore no longer needed).
- (fix) Fix bug with file paths containing spaces.
- (fix) Fix bug with modules not containing a version attribute.
- (feat) Bundle js files with esbuild.

## [0.1.3]

- (feat) Add a setting to exclude certain files or folders while searching for terraform folders.

## [0.1.2]

- (fix) Add missing fetch for Octokit.

## [0.1.1]

- (refac) Bug fixing and refactoring.
- (doc) Added additional documentation.

## [0.1.0]

- (refac) Refactoring the entire extension.
- (feat) Added commands for terraform init.
- (feat) Added Terraform workspace manager.

## [0.0.5]

- (refac) Security fixes by replacing some libraries.
- (feat) Added vscode workspace support.

## [0.0.4]

- (feat) Implemented logging to output-stream.
- (refac) Refactoring and cleanup.

## [0.0.3]

- (refac) Bug fixing.

## [0.0.2]

- (feat) Impelents a terraform version manager, that allows you to download and switch between terraform versions.

## [0.0.1]

- (feat) Initial version of the extension. Adds commands to run local previews of stacks on Spacelif
