# Terraform-Toolbox VSCode Extension

<img src="Images/terraform_toolbox_icon.png" alt="drawing" width="200" title="Spacelift Stacks Status Bar item"/>

VSCode extension adding a bunch of featurees regarding Terraform / OpenTofu and Spacelift.

- [Terraform-Toolbox VSCode Extension](#terraform-toolbox-vscode-extension)
  - [Motivation](#motivation)
  - [Getting startet](#getting-startet)
    - [Spacelift](#spacelift)
  - [Breaking changes](#breaking-changes)
    - [0.4.0](#040)
  - [Supported platforms](#supported-platforms)
  - [IaC Providers](#iac-providers)
  - [Features](#features)
    - [Terraform / OpenTofu version manager](#terraform--opentofu-version-manager)
    - [Terraform / OpenTofu workspace](#terraform--opentofu-workspace)
    - [Terraform / OpenTofu Init](#terraform--opentofu-init)
      - [Auto-install providers](#auto-install-providers)
      - [Auto-fetch modules](#auto-fetch-modules)
    - [Spacelift](#spacelift-1)
  - [Important Notes](#important-notes)

## Motivation

The main motivation behind building this extension was to improve the IaC workflow at my employer, [CMInformatik](https://www.cmiag.ch). The extension therefore contains some features that are specific to our workflow. However, I think that some of the features might be useful for other people as well. If you have any suggestions or ideas for improvements, feel free to open an issue or a pull request.

## Getting startet

The following features require manual configuration and installation steps:

### Spacelift

To use any spacelift feature of this extension, [spacectl](https://github.com/spacelift-io/spacectlhttps://github.com/spacect) has to be installed and available in your Path. You also have to set a userprofile in spacectl with the command:

```bash
spacectl profile login <profile_name>
```

When creating a new profile, make sure to select the option `Login with a web browser`. This will open a browser window, where you can log-in to your Spacelift account. This method makes sure that the token used by spacectl is the same as the one used by your Webbrowser. Since Spacelift recently changed its token validity (only 1 token per user is now allowed to be active), this is the only way to make sure that the extension gets an valid access token without revoking your web browsers Spacelift token. Once the token used by spacectl has expired or has been revoked, a status item will be shown. By clicking on the status item, you will be prompted to authenticate spacectl again with your browser.

Regarding spacelift, no authentication is required in VSCode. The extension uses the `spacectl profile export-token` command to get an api token for the current userprofile. This token is then used to authenticate the extension with spacelift.

If you don't want to use any spacelift features, you can simply not install the spacectl, this will disable all spacelift features of the extension.

## Breaking changes

### 0.4.0

- All settings with the pattern `tftoolbox.terraform.*` have been renamed to `tftoolbox.iac.*`.
- The setting `tftoolbox.spacelift.showNoTerraformVersionInstalledMsg` has been renamed to `tftoolbox.iac.showNoIacProviderVersionInstalledMsgOnStart`.
- All commands have been renamed to the following pattern: `tftoolbox.<group>.<action>` (e.g. `tftoolbox.iac.setVersion` or `tftoolbox.terraform.setVersion`).

## Supported platforms

The extension supports all three major OS platforms:

- Windows (x64/x86/arm64)
- MacOS (x64/arm64)
- Linux (x64/x86/arm64) (not tested)

MacOS and Windows are regularly used and tested. Linux is not tested, but should work.

## IaC Providers

The extension supports both Terraform and OpenTofu as IaC providers. Terraform will be used per default. To switch to OpenTofu, you can set the `tftoolbox.iac.provider` setting to `opentofu`, this will switch the extension to OpenTofu mode.

## Features

### Terraform / OpenTofu version manager

This extension adds version managers for both Terraform and OpenTofu. They allow you to install and switch between any Terraform or OpenTofu version available, including betas, alphas, and rc.

The following overview shows where the OpenTofu and Terraform binaries are stored on your system:

| Name      | Active binary (Windows)                   | Active binary (Mac)               | Installed binaries (Windows)                 | Installed binaries (Mac)             |
| --------- | ----------------------------------------- | --------------------------------- | -------------------------------------------- | ------------------------------------ |
| Terraform | `%USERPROFILE%\.terraform-toolbox\active` | `$HOME/.terraform-toolbox/active` | `%USERPROFILE%\.terraform-toolbox\terraform` | `$HOME/.terraform-toolbox/terraform` |
| OpenTofu  | `%USERPROFILE%\.terraform-toolbox\active` | `$HOME/.terraform-toolbox/active` | `%USERPROFILE%\.terraform-toolbox\opentofu`  | `$HOME/.terraform-toolbox/opentofu`  |

For all terminals opened by VSCode, the PATH variable is automatically extended. This allows you to use the active Terraform / OpenTofu binary in all terminals opened by VSCode. If you want to use the active Terraform / OpenTofu binary outside VSCode, you have to add the directory to your global PATH variable.

- Command [`tftoolbox.iac.setVersion`]: Select and install a specific version for the active IaC Provider.
  ![terraform-version](Images/examples/terraform_version.gif)
- Command [`tftoolbox.iac.deleteVersion`]: Evaluates the required version for all of your open projects and selects the latest version that matches all the requirements. With the setting `tftoolbox.iac.autoSelectVersion` you can enable to auto-select a version when opening VSCode. More information can be found here: [Auto set IaC Provider version](docs/autoSetIacVersion.md)
- Command [`tftoolbox.iac.autoSetVersion`]: Select and delete installed versions for the configured provider.
- StatusBarItem [`IacActiveVersionItem`]: Shows the active version for the configured IaC Provider in the status bar. Clicking on the status bar item opens the version manager.

The commands above manage versions for the configured IaC Provider. Additionally, the following commands are available to manage versions for Terraform and OpenTofu explicitly regardless of the current configuration:

| Command                      | Terraform                            | OpenTofu                            |
| ---------------------------- | ------------------------------------ | ----------------------------------- |
| Select and install a version | `tftoolbox.terraform.setVersion`     | `tftoolbox.opentofu.setVersion`     |
| Delete installed versions    | `tftoolbox.terraform.deleteVersions` | `tftoolbox.opentofu.deleteVersions` |
| Auto select version          | `tftoolbox.terraform.autoSetVersion` | `tftoolbox.opentofu.autoSetVersion` |

### Terraform / OpenTofu workspace

Tired of switching between workspaces in the terminal? This extension adds a status bar item showing the currently active Terraform / OpenTofu workspace. By clicking on the status bar item, you can select and switch to a different workspace. The extension adds the following features regarding workspaces:

- Command [`tftoolbox.iac.setWorkspace`]: Select and switch to a workspace in the current folder.
  ![terraform-workspace](Images/examples/terraform_workspace.gif)
- Command [`tftoolbox.iac.autoSelectWorkspace`] Auto set the workspace for all project folders when opening vscode. Uses the workspace name from the `.terraform-toolbox.json` file in the root of the workspace. More information can be found here: [Workspace settings](docs/workspaceSettings.md)
- StatusBarItem [`IacActiveWorkspaceItem`]: Shows the currently selected workspace in the status bar if a Terraform / OpenTofu file is open. Clicking on the status bar item opens the workspace manager.

### Terraform / OpenTofu Init

Since the init command is required for many features of the official Hashicorp Terraform extension to work, this extension adds some features to make the terraform init process easier:

- Command [`tftoolbox.iac.initCurrentProject`]: Run terraform / tofu init in the current folder. Similar to the init Command of the official Hashicorp Terraform extension, but it allows you to specify additional init arguments with the setting `tftoolbox.iac.initArg`.
- Command [`tftoolbox.iac.initAllProjects`]: Finds all terraform folders in your open workspaces and runs terraform init in each of them asynchronically. More information can be found here: [Terraform init all projects](docs/initAllProjects.md)
  ![terraform-init](Images/examples/terraform_init.gif)
- Command [`tftoolbox.iac.refreshModules`]: Installs missing modules for the current folder.

#### Auto-install providers

By enabling the setting `tftoolbox.iac.enableAutoProviderInitialization`, the extension will automatically initialize a terraform / opentofu project when a changed .tf file contains a provider version constraint for which no provider is currently installed. The extension will then run terraform / opentofu init in that folder. The folder has to be initialized manually for the first time to be considered for auto-initialization.

> [!IMPORTANT]  
> This feature is experimental and might use lots of system resources when switching branches in git with many provider version changes. It is also not recommended to use in combination with the vscode setting `Auto Save: afterDelay`. Instead, use the setting `Auto Save: onFocusChange` or `Auto Save: onWindowChange`.

#### Auto-fetch modules

With the setting `tftoolbox.iac.enableAutoModuleFetch`, the extension will automatically fetch modules for a terraform / opentofu project when a .tf file with declared modules changes.

### Spacelift

Spacelift is a IaC CI/CD tool. They provide a cli-tool, called spacectl, that allows you to run proposed runs of your local code on Spacelift. However, the cli requires you to specify the Spacelift stack-id and the working directory of the project, for which the proposed run should be created. To make this process easier, this extension adds two commands as wrapper around the spacectl:

- Command [`tftoolbox.spacelift.localPreviewCurrentStack`]: Run a local preview for the current folder. The stack-id is automatically evaluated based on the current Repository and Subfolder.
  ![Spacelift local preview current stack](Images/examples/spacelift_local_preview_current_stack.gif)
- Command [`tftoolbox.spacelift.localPreview`]: Run a local preview of a selected stack on Spacelift. You will be presented with a list of all stacks for the current workspace. The selected stack will be used to run the local preview.
- Command [`tftoolbox.spacelift.login`]: Authenticate spacectl.
- StatusBarItem [`StacksPendingConfirmationCount`]: Shows the number of stacks that have pending confirmation in the status bar. Clicking on the status bar item opens your Spacelift portal.
  ![Spacelift Stacks Status Bar item](Images/examples/pending_stack_confirmation.png)

## Important Notes

This extension is still in early development. We are using it at CMInformatik for our daily work, but there might still be some bugs. If you find any bugs or have any suggestions for improvements, feel free to open an issue or a pull request.
