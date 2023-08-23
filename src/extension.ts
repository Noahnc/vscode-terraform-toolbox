import { GraphQLClient } from "graphql-request";
import * as hcl from "hcl2-parser";
import fetch from "node-fetch";
import { Octokit } from "octokit";
import * as vscode from "vscode";
import { ChoseAndDeleteTerraformVersionsCommand, ChoseAndSetTerraformVersionCommand, SetTerraformVersionBasedOnProjectRequirementsCommand } from "./commands/manage_terraform_version";
import { RunSpacectlLocalPreviewCommand, RunSpacectlLocalPreviewCurrentStackCommand } from "./commands/spacelift_local_preview";
import { TerraformFetchModulesCurrentProjectCommand, TerraformInitAllProjectsCommand, TerraformInitCurrentProjectCommand } from "./commands/terraform_init";
import { AutoSetTerraformWorkspaceCommand, ChoseAndSetTerraformWorkspaceCommand } from "./commands/terraform_workspace";
import * as cst from "./constants";
import { Settings } from "./models/settings";
import * as helpers from "./utils/helper_functions";
import { getLogger, initLogger } from "./utils/logger";
import { Ispacectl, Spacectl } from "./utils/spacelift/spacectl";
import { IspaceliftClient, SpaceliftClient } from "./utils/spacelift/spacelift_client";
import { TerraformCLI } from "./utils/terraform/terraform_cli";
import { TerraformProjectHelper } from "./utils/terraform/terraform_project_helper";
import { SpaceliftPenStackConfCount } from "./view/statusbar/spacelift_stack_confirmation_item";
import { TfActiveVersionItem } from "./view/statusbar/terraform_version_item";
import { TfActiveWorkspaceItem } from "./view/statusbar/terraform_workspace_item";
import { TerraformVersionProvieder } from "./utils/terraform/terraform_version_provider";
import { VersionManager } from "./utils/version_manager";
import { Cli } from "./utils/cli";

export async function activate(context: vscode.ExtensionContext) {
  const settings = new Settings();
  await initLogger(context, settings);

  getLogger().info("Activating extension");

  // ToDO: Replace manual dependencie injection with a DI framework
  const tfcli = new TerraformCLI(new Cli());
  const tfProjectHelper = new TerraformProjectHelper(hcl, tfcli, settings);
  const tfVersionProvider = new TerraformVersionProvieder(context, new Octokit({ request: { fetch } }));
  const tfVersionManager = new VersionManager(
    {
      baseFolderName: cst.EXTENSION_BINARY_FOLDER_NAME,
      softwareName: "Terraform",
      binaryName: "terraform",
    },
    tfVersionProvider
  );

  const tfVersionItem = new TfActiveVersionItem(context, tfVersionManager, {
    alignment: vscode.StatusBarAlignment.Right,
    priority: 100,
    onClickCommand: cst.COMMAND_SET_TERRAFORM_VERSION,
    updateOnDidChangeTextEditorSelection: true,
    tooltip: "Terraform version currently active",
  });
  const tfWorkspaceItem = new TfActiveWorkspaceItem(
    context,
    {
      alignment: vscode.StatusBarAlignment.Right,
      priority: 99,
      onClickCommand: cst.COMMAND_SET_WORKSPACE,
      updateOnDidChangeTextEditorSelection: true,
      tooltip: "Terraform workspace of the current folder",
    },
    tfcli,
    tfProjectHelper
  );

  // Init spacelift commands if spacelift is configured
  spacectlInit(settings)
    .then(([spaceliftClient, spacectlInstance, tenantID]) => {
      new RunSpacectlLocalPreviewCurrentStackCommand(context, { command: cst.COMMAND_LOCAL_PREVIEW_CURRENT_STACK }, spaceliftClient, spacectlInstance);
      new RunSpacectlLocalPreviewCommand(context, { command: cst.COMMAND_LOCAL_PREVIEW }, spaceliftClient, spacectlInstance);
      const openSpaceliftWebPortalCommand = "openSpaceliftWebPortal";
      context.subscriptions.push(
        vscode.commands.registerCommand(openSpaceliftWebPortalCommand, () => {
          vscode.env.openExternal(vscode.Uri.parse("https://" + tenantID + cst.SPACELIFT_BASE_DOMAIN));
        })
      );
      new SpaceliftPenStackConfCount(
        context,
        {
          alignment: vscode.StatusBarAlignment.Left,
          priority: 99,
          refreshIntervalSeconds: settings.spaceliftStatusBarItemRefreshIntervalSeconds,
          tooltip: "Count of Spacelift Stacks pending confirmation",
          onClickCommand: openSpaceliftWebPortalCommand,
        },
        spaceliftClient
      ).refresh();
    })
    .catch((error) => {
      getLogger().error("Failed to initialize spacectl: " + error);
      if (vscode.workspace.getConfiguration().get("tftoolbox.spacelift.showSpaceliftInitErrorOnStart")) {
        vscode.window
          .showWarningMessage(
            "Failed to initialize spacectl. Please make sure spacectl is installed and a profile is configured. Somme features will be disabled until spacectl is configured.",
            "Open spacectl documentation",
            "Don't show again"
          )
          .then((selection) => {
            if (selection === "Open spacectl documentation") {
              vscode.env.openExternal(vscode.Uri.parse("https://github.com/spacelift-io/spacectl"));
            } else if (selection === "Don't show again") {
              vscode.workspace.getConfiguration().update("tftoolbox.spacelift.showSpaceliftInitErrorOnStart", false, vscode.ConfigurationTarget.Global);
            }
          });
      }
    });
  // Terraform version management commands
  const setTFVersionBasedOnProjectCommand = new SetTerraformVersionBasedOnProjectRequirementsCommand(
    context,
    { command: cst.COMMAND_AUTO_SET_TERRAFORM_VERSION, successCallback: tfVersionItem.refresh.bind(tfVersionItem) },
    tfVersionManager,
    tfProjectHelper
  );
  new ChoseAndSetTerraformVersionCommand(context, { command: cst.COMMAND_SET_TERRAFORM_VERSION, successCallback: tfVersionItem.refresh.bind(tfVersionItem) }, tfVersionManager);
  new ChoseAndDeleteTerraformVersionsCommand(context, { command: cst.COMMAND_DELETE_TERRAFORM_VERSIONS }, tfVersionManager);

  // Terraform init commands
  const tfInitAllProjectsCommand = new TerraformInitAllProjectsCommand(context, { command: cst.COMMAND_INIT_ALL_PROJECTS }, tfProjectHelper);
  new TerraformInitCurrentProjectCommand(context, { command: cst.COMMAND_INIT_CURRENT_PROJECT }, tfProjectHelper, tfcli);
  new TerraformFetchModulesCurrentProjectCommand(context, { command: cst.COMMAND_INIT_REFRESH_MODULES }, tfProjectHelper, tfcli);

  // Terraform workspace commands
  new ChoseAndSetTerraformWorkspaceCommand(context, { command: cst.COMMAND_SET_WORKSPACE, successCallback: tfWorkspaceItem.refresh.bind(tfWorkspaceItem) }, tfcli);
  const autoSetWorkspaceCommand = new AutoSetTerraformWorkspaceCommand(
    context,
    { command: cst.COMMAND_AUTO_SET_WORKSPACE, successCallback: tfWorkspaceItem.refresh.bind(tfWorkspaceItem) },
    tfcli,
    tfProjectHelper
  );

  // Check and install new terraform version if setting is enabled
  if (settings.autoselectVersion) {
    await setTFVersionBasedOnProjectCommand.run(true).then(() => {
      tfVersionItem.refresh();
    });
  }

  // Init all terraform projects if setting is enabled
  if (settings.autoInitAllProjects) {
    getLogger().info("Auto initializing all projects in the currently open workspaces");
    tfInitAllProjectsCommand.run(false, true).then(() => {
      settings.autoSelectWorkspace ? autoSetWorkspaceCommand.run(true) : null;
    });
  } else {
    settings.autoSelectWorkspace ? autoSetWorkspaceCommand.run(true) : null;
  }

  // update status bar item once at start
  tfVersionItem.refresh();
}

async function spacectlInit(settings: Settings): Promise<[IspaceliftClient, Ispacectl, string]> {
  const spacectlProfileName = settings.spacectlProfileName;
  const spacectlInstance = new Spacectl(new Cli());
  if (spacectlProfileName !== null && spacectlProfileName !== undefined) {
    spacectlInstance.setUserprofile(spacectlProfileName);
  }
  await spacectlInstance.ensureSpacectlIsInstalled();
  let spaceliftTenantID: string;
  if (settings.spaceliftTenantID === null || settings.spaceliftTenantID === undefined) {
    spaceliftTenantID = (await spacectlInstance.getExportedToken()).spaceliftTenantID;
    getLogger().info("No spacelift tenant ID configured, using tenant ID from spacectl token: " + spaceliftTenantID);
  } else {
    spaceliftTenantID = settings.spaceliftTenantID;
  }
  const spaceliftEndpoint = "https://" + spaceliftTenantID + cst.SPACELIFT_BASE_DOMAIN + "/graphql";
  const spacelift = new SpaceliftClient(new GraphQLClient(spaceliftEndpoint), spacectlInstance.getExportedToken.bind(spacectlInstance));
  await spacelift.authenticate();
  return [spacelift, spacectlInstance, spaceliftTenantID];
}
