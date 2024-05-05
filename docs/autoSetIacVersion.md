# Auto-set IaC version

With the command `tftoolbox.iac.autoSetVersion` you can automatically select the latest stable Terraform / OpenTofu version that matches the requirements of all your open workspaces. The extension evaluates the required version based on the following process:

1. It checks each of your open workspaces for a file called `./Spacelift-Resources/main.tf`. If at least one of your workspaces contains such a file and the file contains a module `module.cmi-spacelift-stacks` with the attribute `terraform_version`, this will be used to filter the available versions. The latest version that matches all the requirements will be selected. This feature is specific to our workflow at CMInformatik, since we define all spacelift stacks of the Repository in this module incl. the required terraform version. If this file is not present in any of your workspaces, the extension will continue with the next step.
2. The extension searches all .tf files in your open workspaces for `terraform.required_version` attributes. All found `required_version` are then combined into a list of unique version constraints. All releases are then filtered against each of the found version constraints. The latest version that matches all the requirements will be selected. If no version matches all the requirements, the next step will be executed.
3. The extension will select the latest stable Terraform / OpenTofu version.

By enabling the setting `tftoolbox.iac.autoSelectVersion` the extension will auto-select a version when opening VSCode.

> **_NOTE:_** This command only selects stable versions of Terraform. RC, betas or alpha versions are not considered.
