# 1. Workspace settings (.terraform-toolbox.json)

By creating a `.terraform-toolbox.json` file in the root of a workspace, you can configure some settings for the extension. The following settings are currently available:

## 1.1. Auto set Terraform workspace

With the root key `autoSetWorkspace` you can configure settings regarding the `tftoolbox.autoSetWorkspace` Command. The following settings are available:

- `name`: (required): The name of the workspace that should be selected. If the workspace does not exist in a folder, the folder will be skipped.
- `excludedFoldersRelativePaths`: (optional): A list of relative paths to folders that should be excluded from the workspace selection. The paths are relative to the root of the workspace.

```json
{
  "autoSetWorkspace": {
    "name": "stage",
    "excludedFoldersRelativePaths": ["/ExampleProjects/Test1"]
  }
}
```

> **_NOTE:_** The workspace auto set is only perfomed, if the usersetting `tftoolbox.terraform.autoSelectWorkspace` is true (default) and the `.terraform-toolbox.json` file exists in the workspace root.
