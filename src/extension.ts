import { GraphQLClient } from "graphql-request";
import * as hcl from "hcl2-parser";
import fetch from "node-fetch";
import { Octokit } from "octokit";
import * as vscode from "vscode";
import { ChoseAndDeleteIacVersionsCommand, ChoseAndSetIacVersionCommand, SetIacVersionBasedOnProjectRequirementsCommand } from "./commands/ManageIacVersionCommand";
import { RunSpacectlLocalPreviewCommand, RunSpacectlLocalPreviewCurrentStackCommand } from "./commands/SpaceliftLocalPreviewCommand";
import { TerraformFetchModulesCurrentProjectCommand, TerraformInitAllProjectsCommand, TerraformInitCurrentProjectCommand } from "./commands/IacInitCommand";
import { AutoSetTerraformWorkspaceCommand, ChoseAndSetTerraformWorkspaceCommand } from "./commands/IacWorkspaceCommand";
import * as cst from "./constants";
import { Settings } from "./models/settings";
import { Cli } from "./utils/cli";
import * as helpers from "./utils/helperFunctions";
import { getLogger, initLogger } from "./utils/logger";
import { ISpacectl, Spacectl } from "./utils/Spacelift/spacectl";
import { IspaceliftClient, SpaceliftClient } from "./utils/Spacelift/spaceliftClient";
import { OpenTofuVersionProvider } from "./utils/OpenTofu/opentofuVersionProvider";
import { IacProjectHelper } from "./utils/IaC/iacProjectHelper";

import { IversionManager, VersionManager } from "./utils/VersionManager/versionManager";

import { IacCli } from "./utils/IaC/iacCli";
import { SpaceliftAuthenticationHandler } from "./utils/Spacelift/spaceliftAuthenticationHandler";
import { TerraformVersionProvieder } from "./utils/Terraform/terraformVersionProvider";
import { IacActiveWorkspaceItem } from "./view/statusbar/IacWorkspaceItem";
import { SpaceliftPenStackConfCount } from "./view/statusbar/spaceliftStackConfirmationItem";
import { SpaceliftApiAuthenticationStatus } from "./view/statusbar/spaceliftAuthStatusItem";
import { IacActiveVersionItem } from "./view/statusbar/iacVersionItem";
import { IIaCProvider } from "./utils/IaC/IIaCProvider";
import { OpenTofuProvider } from "./utils/OpenTofu/opentofuIacProvider";
import { TerraformProvider } from "./utils/Terraform/terraformIacProvider";

export async function activate(context: vscode.ExtensionContext) {
  const settings = new Settings();
  await initLogger(context, settings);

  getLogger().info("Activating extension");

  // ToDO: Replace manual dependencie injection with a DI framework
  let iacProvider: IIaCProvider;
  let activeVersionManager: IversionManager;
  let setVersionCommand: string;
  const terraformIacProvider = new TerraformProvider();
  const opentofuIacProvider = new OpenTofuProvider();

  const terraformVersionManager = new VersionManager(new TerraformVersionProvieder(context, new Octokit({ request: { fetch } })), cst.EXTENSION_BINARY_FOLDER_NAME);
  const opentofuVersionManager = new VersionManager(new OpenTofuVersionProvider(context, new Octokit({ request: { fetch } })), cst.EXTENSION_BINARY_FOLDER_NAME);

  if (settings.useOpenTofuInsteadOfTerraform) {
    getLogger().info("Extension is configured to use OpenTofu instead of Terraform");
    iacProvider = opentofuIacProvider;
    activeVersionManager = opentofuVersionManager;
    setVersionCommand = cst.COMMAND_SET_OPEN_TOFU_VERSION;
  } else {
    getLogger().info("Extension is configured to use Terraform");
    iacProvider = terraformIacProvider;
    activeVersionManager = terraformVersionManager;
    setVersionCommand = cst.COMMAND_SET_TERRAFORM_VERSION;
  }

  const iacCli = new IacCli(new Cli(), iacProvider.getBinaryName());
  const iacProjectHelper = new IacProjectHelper(hcl, iacCli, settings);

  const iacVersionItem = new IacActiveVersionItem(context, activeVersionManager, {
    alignment: vscode.StatusBarAlignment.Right,
    priority: 100,
    onClickCommand: setVersionCommand,
    updateOnDidChangeTextEditorSelection: true,
    tooltip: iacProvider.getName() + " version currently active",
  });

  const iacWorkspaceItem = new IacActiveWorkspaceItem(
    context,
    {
      alignment: vscode.StatusBarAlignment.Right,
      priority: 99,
      onClickCommand: cst.COMMAND_SET_WORKSPACE,
      updateOnDidChangeTextEditorSelection: true,
      tooltip: iacProvider.getName() + " workspace of the current folder",
    },
    iacCli,
    iacProjectHelper
  );

  // Init spacelift commands if spacelift is configured
  spacectlInit(settings).then(([spaceliftClient, spacectlInstance, tenantID, authenticationHandler]) => {
    new RunSpacectlLocalPreviewCurrentStackCommand(context, { command: cst.COMMAND_LOCAL_PREVIEW_CURRENT_STACK, checkInternetConnection: true }, spaceliftClient, spacectlInstance);
    new RunSpacectlLocalPreviewCommand(context, { command: cst.COMMAND_LOCAL_PREVIEW, checkInternetConnection: true }, spaceliftClient, spacectlInstance);
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
        checkInternetConnection: true,
      },
      spaceliftClient
    ).refresh();
    const spaceliftAuthStatusItem = new SpaceliftApiAuthenticationStatus(
      context,
      {
        alignment: vscode.StatusBarAlignment.Left,
        priority: 100,
        refreshIntervalSeconds: settings.spaceliftStatusBarItemRefreshIntervalSeconds,
        tooltip: "Log-in to Spacelift with spacectl and your Web browser",
        onClickCommand: cst.COMMAND_SPACELIFT_LOGIN,
        checkInternetConnection: true,
      },
      authenticationHandler
    );
    spaceliftAuthStatusItem.refresh();
    context.subscriptions.push(
      vscode.commands.registerCommand(cst.COMMAND_SPACELIFT_LOGIN, async () => {
        if (await authenticationHandler.login_interactive()) {
          await spaceliftAuthStatusItem.refresh();
        }
      })
    );
    authenticationHandler
      .check_token_valid()
      .then((valid: boolean) => {
        if (!valid && settings.showSpacectlNotAuthenticatedWarningOnStartup) {
          getLogger().info("Spacectl token is not valid, showing notification to log-in to Spacelift");
          vscode.commands.executeCommand(cst.COMMAND_SPACELIFT_LOGIN);
        }
      })
      .catch((error) => {
        getLogger().error("Failed to initialize spacectl: " + error);
        helpers
          .showNotificationWithDecisions(
            "Failed to initialize spacectl. Some features will be disabled until spacectl is configured.",
            "tftoolbox.spacelift.showSpaceliftInitErrorOnStart",
            "Open spacectl documentation",
            "warning"
          )
          .then((result) => {
            if (result) {
              vscode.env.openExternal(vscode.Uri.parse("https://github.com/spacelift-io/spacectl"));
            }
          });
      });
  });

  // Terraform version management commands
  const setTFVersionBasedOnProjectCommand = new SetIacVersionBasedOnProjectRequirementsCommand(
    context,
    { command: cst.COMMAND_AUTO_SET_TERRAFORM_VERSION, successCallback: iacVersionItem.refresh.bind(iacVersionItem), checkInternetConnection: true },
    terraformVersionManager,
    iacProjectHelper,
    terraformIacProvider
  );
  new ChoseAndSetIacVersionCommand(
    context,
    { command: cst.COMMAND_SET_TERRAFORM_VERSION, successCallback: iacVersionItem.refresh.bind(iacVersionItem), checkInternetConnection: true },
    terraformVersionManager,
    terraformIacProvider
  );
  new ChoseAndDeleteIacVersionsCommand(context, { command: cst.COMMAND_DELETE_TERRAFORM_VERSIONS, checkInternetConnection: true }, terraformVersionManager, terraformIacProvider);

  /// OpenTofu version management commands
  const setOpenTofuVersionBasedOnProjectCommand = new SetIacVersionBasedOnProjectRequirementsCommand(
    context,
    { command: cst.COMMAND_AUTO_SET_OPEN_TOFU_VERSION, successCallback: iacVersionItem.refresh.bind(iacVersionItem), checkInternetConnection: true },
    opentofuVersionManager,
    iacProjectHelper,
    opentofuIacProvider
  );
  new ChoseAndSetIacVersionCommand(
    context,
    { command: cst.COMMAND_SET_OPEN_TOFU_VERSION, successCallback: iacVersionItem.refresh.bind(iacVersionItem), checkInternetConnection: true },
    opentofuVersionManager,
    opentofuIacProvider
  );
  new ChoseAndDeleteIacVersionsCommand(context, { command: cst.COMMAND_DELETE_OPEN_TOFU_VERSIONS, checkInternetConnection: true }, opentofuVersionManager, opentofuIacProvider);

  // Terraform init commands
  const tfInitAllProjectsCommand = new TerraformInitAllProjectsCommand(context, { command: cst.COMMAND_INIT_ALL_PROJECTS }, iacProjectHelper);
  new TerraformInitCurrentProjectCommand(context, { command: cst.COMMAND_INIT_CURRENT_PROJECT }, iacProjectHelper, iacCli);
  new TerraformFetchModulesCurrentProjectCommand(context, { command: cst.COMMAND_INIT_REFRESH_MODULES }, iacProjectHelper, iacCli);

  // IaC workspace commands
  new ChoseAndSetTerraformWorkspaceCommand(context, { command: cst.COMMAND_SET_WORKSPACE, successCallback: iacWorkspaceItem.refresh.bind(iacWorkspaceItem) }, iacCli);
  const autoSetWorkspaceCommand = new AutoSetTerraformWorkspaceCommand(
    context,
    { command: cst.COMMAND_AUTO_SET_WORKSPACE, successCallback: iacWorkspaceItem.refresh.bind(iacWorkspaceItem) },
    iacCli,
    iacProjectHelper
  );

  // Check and install new terraform version if setting is enabled
  if (settings.autoselectVersion) {
    if (settings.useOpenTofuInsteadOfTerraform) {
      await setOpenTofuVersionBasedOnProjectCommand.run(true).then(() => {
        iacVersionItem.refresh();
      });
    } else {
      await setTFVersionBasedOnProjectCommand.run(true).then(() => {
        iacVersionItem.refresh();
      });
    }
  }

  if (activeVersionManager.getActiveVersion() === undefined) {
    if (
      await helpers.showNotificationWithDecisions(
        "No " + iacProvider.getName() + " version installed by this extension yet. Do you want to select a version to install now?",
        "tftoolbox.spacelift.showNoTerraformVersionInstalledMsg",
        "Show versions",
        "information"
      )
    ) {
      await vscode.commands.executeCommand(cst.COMMAND_SET_TERRAFORM_VERSION);
    }
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
  iacVersionItem.refresh();
}

async function spacectlInit(settings: Settings): Promise<[IspaceliftClient, ISpacectl, string, SpaceliftAuthenticationHandler]> {
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
  const authenticationHandler = new SpaceliftAuthenticationHandler(spacectlInstance, spacectlInstance, new GraphQLClient(spaceliftEndpoint));
  const spacelift = new SpaceliftClient(new GraphQLClient(spaceliftEndpoint), authenticationHandler);
  return [spacelift, spacectlInstance, spaceliftTenantID, authenticationHandler];
}
