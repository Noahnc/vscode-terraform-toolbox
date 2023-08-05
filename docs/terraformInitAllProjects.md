# Terraform init all projects

With the command `tftoolbox.terraformInitAllProjects` you can run `terraform init` in all terraform folders present in your open workspaces. A terraform folder has to meet the following requirements to be considered:

1. The folder must contain at least one .tf file.
2. At least one of the terraform files must contain a `module` block or a `terraform.required_providers` block.

The terraform init process is executed asynchronously for each folder. Initializing multiple folders at the same time should therefore not be that much slower than initializing a single folder.
