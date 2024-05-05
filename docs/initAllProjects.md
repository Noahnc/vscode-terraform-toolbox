# Init all projects

With the command `tftoolbox.iac.initAllProjects` you can run `terraform init` / `tofu init` in all folders present in your open workspaces. A folder has to meet the following requirements to be considered as Terraform / OpenTofu project folder:

1. The folder must contain at least one .tf file.
2. At least one of the terraform files must contain a `module` block or a `terraform.required_providers` block.

The init process is executed asynchronously for each folder. Initializing multiple folders at the same time should therefore not be that much slower than initializing a single folder.
