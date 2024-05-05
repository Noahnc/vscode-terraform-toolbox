export const SPACECTL_COMMAND_NAME = "spacectl";
export const EXTENSION_BINARY_FOLDER_NAME = ".terraform-toolbox";
export const SPACELIFT_BASE_DOMAIN = ".app.spacelift.io";

// commands

// Spacelift
export const COMMAND_LOCAL_PREVIEW = "tftoolbox.spacelift.localPreview";
export const COMMAND_SPACELIFT_LOGIN = "tftoolbox.spacelift.login";
export const COMMAND_LOCAL_PREVIEW_CURRENT_STACK = "tftoolbox.spacelift.localPreviewCurrentStack";

// Version management
export const COMMAND_SET_TERRAFORM_VERSION = "tftoolbox.terraform.setVersion";
export const COMMAND_DELETE_TERRAFORM_VERSIONS = "tftoolbox.terraform.deleteVersions";
export const COMMAND_AUTO_SET_TERRAFORM_VERSION = "tftoolbox.terraform.autoSetVersion";

export const COMMAND_SET_OPEN_TOFU_VERSION = "tftoolbox.opentofu.setVersion";
export const COMMAND_DELETE_OPEN_TOFU_VERSIONS = "tftoolbox.opentofu.deleteVersions";
export const COMMAND_AUTO_SET_OPEN_TOFU_VERSION = "tftoolbox.opentofu.autoSetVersion";

export const COMMAND_SET_IAC_PROVIDER_VERSION = "tftoolbox.iac.setVersion";
export const COMMAND_DELETE_IAC_PROVIDER_VERSION = "tftoolbox.iac.deleteVersion";
export const COMMAND_AUTO_SET_IAC_PROVIDER_VERSION = "tftoolbox.iac.autoSetVersion";

// Workspace management
export const COMMAND_INIT_ALL_PROJECTS = "tftoolbox.iac.initAllProjects";
export const COMMAND_INIT_CURRENT_PROJECT = "tftoolbox.iac.initCurrentProject";
export const COMMAND_INIT_REFRESH_MODULES = "tftoolbox.iac.refreshModules";
export const COMMAND_SET_WORKSPACE = "tftoolbox.iac.setWorkspace";
export const COMMAND_AUTO_SET_WORKSPACE = "tftoolbox.iac.autoSetWorkspace";
