# Change Log

All notable changes to the terraform-toolbox extension will be documented in this file.

## [0.3.2]

- (fix): Fixed a bug where the spacelift token was not refreshed in the background from spacectl.

## [0.3.1]

- (refac): The extension now checks your internet connection before running commands that require an internet connection. Status bar items that require an internet connection will be hidden if no internet connection is available.
- (feat): Added a new setting to control if a login notification should be shown on startup, if the current spacectl token is not valid.

## [0.3.0]

- (feat): New Spacelift spacectl authentication handling. Since Spacelift has changed its token validity (only 1 token per user is now allowed to be active), the extension now uses the spacectl with web browser login to authenticate the user. If the current token provided by spacectl has expried or is revoked, a status item will be shown. Clicking on the status item will prompt you to authenticate spacectl with your browser.

## [0.2.3]

- Update dependencies.

## [0.2.2]

- (feat): Added a welcome message asking the user if he wants to install a terraform version.

## [0.2.1]

- (tests) Added additional tests.
- (refac) Some internal refactoring.
- (fix) Fixed a bug in the auto set workspace command when no 'excludedFoldersRelativePaths' is set in the '.terraform-toolbox.json' file. file.

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
