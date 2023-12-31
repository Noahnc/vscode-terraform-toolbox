# Auto-set terraform version

With the command `tftoolbox.autoSetTerraformVersion` you can automatically select the latest stable terraform version that matches the requirements of all your open workspaces. The extension evaluates the required terraform version based on the following process:

1. It checks each of your open workspaces for a file called `./Spacelift-Resources/main.tf`. If at least one of your workspaces contains such a file and the file contains a module `module.cmi-spacelift-stacks` with the attribute `terraform_version`, this will be used to filter the terraform versions available on the hashicorp/terraform Github releases page. The latest version that matches all the requirements will be selected. This feature is specific to our workflow at CMInformatik, since we define all spacelift terraform stacks of the Repository in this module incl. the required terraform version. If this file is not present in any of your workspaces, the extension will continue with the next step.
2. The extension searches all .tf files in your open workspaces for `terraform.required_version` attributes. All found `required_version` are then combined into a list of unique version constraints. All releases are then filtered against each of the found version constraints. The latest version that matches all the requirements will be selected. If no version matches all the requirements, the next step will be executed.
3. The extension will select the latest stable terraform version.

By enabling the setting `tftoolbox.terraform.autoSelectVersion` the extension will auto-select a terraform version when opening VSCode.

> **_NOTE:_** This command only selects stable versions of terraform. RC, betas or alpha versions are not considered.
