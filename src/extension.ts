import { GraphQLClient } from "graphql-request";
import * as hcl from "hcl2-parser";
import fetch from "node-fetch";
import { Octokit } from "octokit";
import * as vscode from "vscode";
import { IacFetchModulesCurrentProjectCommand, IacInitAllProjectsCommand, IacInitCurrentProjectCommand } from "./commands/IacInitCommand";
import { AutoSetIacWorkspaceCommand, ChoseAndSetIacWorkspaceCommand } from "./commands/IacWorkspaceCommand";
import { ChoseAndDeleteIacVersionsCommand, ChoseAndSetIacVersionCommand, SetIacVersionBasedOnProjectRequirementsCommand } from "./commands/ManageIacVersionCommand";
import { RunSpacectlLocalPreviewCommand, RunSpacectlLocalPreviewCurrentStackCommand } from "./commands/SpaceliftLocalPreviewCommand";
import * as cst from "./constants";
import { IacProvider, Settings } from "./models/settings";
import { Cli } from "./utils/cli";
import * as helpers from "./utils/helperFunctions";
import { IacProjectHelper } from "./utils/IaC/iacProjectHelper";
import { IacVersionProvider } from "./utils/IaC/IacVersionProvider";
import { getLogger, initLogger } from "./utils/logger";
import { ISpacectl, Spacectl } from "./utils/Spacelift/spacectl";
import { IspaceliftClient, SpaceliftClient } from "./utils/Spacelift/spaceliftClient";

import { IversionManager, VersionManager } from "./utils/VersionManager/versionManager";

import { IacInitService } from "./services/iacInitService";
import { IacCli } from "./utils/IaC/iacCli";
import { IacParser } from "./utils/IaC/iacParser";
import { IIaCProvider } from "./utils/IaC/IIaCProvider";
import { OpenTofuProvider } from "./utils/OpenTofu/opentofuIacProvider";
import { SpaceliftAuthenticationHandler } from "./utils/Spacelift/spaceliftAuthenticationHandler";
import { TerraformProvider } from "./utils/Terraform/terraformIacProvider";
import { IacActiveVersionItem } from "./view/statusbar/iacVersionItem";
import { IacActiveWorkspaceItem } from "./view/statusbar/IacWorkspaceItem";
import { SpaceliftApiAuthenticationStatus } from "./view/statusbar/spaceliftAuthStatusItem";
import { SpaceliftPenStackConfCount } from "./view/statusbar/spaceliftStackConfirmationItem";

export async function activate(context: vscode.ExtensionContext) {
  const settings = new Settings();
  await initLogger(context, settings);

  getLogger().info("Activating extension");

  const iacProviderSelection = await helpers.showNotificationWithDecisions(
    `Welcome to Terraform Toolbox. Which IaC provider do you want to use with this extension?`,
    settings.showIacSelection,
    [IacProvider.terraform, IacProvider.opentofu],
    "information"
  );

  switch (iacProviderSelection) {
    case IacProvider.terraform:
      await settings.iacProvider.setValueAsync(IacProvider.terraform);
      await settings.showIacSelection.setValueAsync(false);
      break;
    case IacProvider.opentofu:
      await settings.iacProvider.setValueAsync(IacProvider.opentofu);
      await settings.showIacSelection.setValueAsync(false);
      break;
    default:
      break;
  }

  // We need to wait a few seconds before enabling the restart notification for changed settings in order
  // to avoid showing a change notification for the iac provider change performed above
  setTimeout(() => {
    settings.enableSettingUpdateRestartNotification();
  }, 4000);

  // ToDO: Replace manual dependencie injection with a DI framework
  let iacProvider: IIaCProvider;
  let primaryVersionManager: IversionManager;
  let setVersionCommand: string;
  const terraformIacProvider = new TerraformProvider();
  const opentofuIacProvider = new OpenTofuProvider();

  const terraformVersionManager = new VersionManager(new IacVersionProvider(context, new Octokit({ request: { fetch } }), terraformIacProvider), cst.EXTENSION_BINARY_FOLDER_NAME);
  const opentofuVersionManager = new VersionManager(new IacVersionProvider(context, new Octokit({ request: { fetch } }), opentofuIacProvider), cst.EXTENSION_BINARY_FOLDER_NAME);

  switch (settings.iacProvider.value) {
    case IacProvider.opentofu:
      getLogger().info("Extension is configured to use OpenTofu instead of Terraform");
      iacProvider = opentofuIacProvider;
      primaryVersionManager = opentofuVersionManager;
      setVersionCommand = cst.COMMAND_SET_OPEN_TOFU_VERSION;
      break;

    case IacProvider.terraform:
      getLogger().info("Extension is configured to use Terraform");
      iacProvider = terraformIacProvider;
      primaryVersionManager = terraformVersionManager;
      setVersionCommand = cst.COMMAND_SET_TERRAFORM_VERSION;
      break;
    default:
      throw new Error("IaC provider not supported");
  }

  const iacCli = new IacCli(new Cli(), iacProvider.binaryName);
  const iacParser = new IacParser(hcl);
  const iacProjectHelper = new IacProjectHelper(iacParser, iacCli, settings);

  const iacVersionItem = new IacActiveVersionItem(context, primaryVersionManager, {
    alignment: vscode.StatusBarAlignment.Right,
    priority: 100,
    onClickCommand: setVersionCommand,
    updateOnDidChangeTextEditorSelection: true,
    tooltip: `${iacProvider.name} version currently active`,
  });

  const iacWorkspaceItem = new IacActiveWorkspaceItem(
    context,
    {
      alignment: vscode.StatusBarAlignment.Right,
      priority: 99,
      onClickCommand: cst.COMMAND_SET_WORKSPACE,
      updateOnDidChangeTextEditorSelection: true,
      tooltip: `${iacProvider.name} workspace of the current folder`,
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
        vscode.env.openExternal(vscode.Uri.parse(`https://${tenantID}${cst.SPACELIFT_BASE_DOMAIN}`));
      })
    );
    new SpaceliftPenStackConfCount(
      context,
      {
        alignment: vscode.StatusBarAlignment.Left,
        priority: 99,
        refreshIntervalSetting: settings.spaceliftStatusBarItemRefreshIntervalSeconds,
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
        refreshIntervalSetting: settings.spaceliftStatusBarItemRefreshIntervalSeconds,
        tooltip: "Log-in to Spacelift with spacectl and your Web browser",
        onClickCommand: cst.COMMAND_SPACELIFT_LOGIN,
        checkInternetConnection: true,
      },
      authenticationHandler
    );
    spaceliftAuthStatusItem.refresh();
    context.subscriptions.push(
      vscode.commands.registerCommand(cst.COMMAND_SPACELIFT_LOGIN, async () => {
        if (await authenticationHandler.loginInteractive()) {
          await spaceliftAuthStatusItem.refresh();
        }
      })
    );
    authenticationHandler
      .checkTokenValid()
      .then((valid: boolean) => {
        if (!valid && settings.showSpacectlNotAuthenticatedWarningOnStartup.value) {
          getLogger().info("Spacectl token is not valid, showing notification to log-in to Spacelift");
          vscode.commands.executeCommand(cst.COMMAND_SPACELIFT_LOGIN);
        }
      })
      .catch((error) => {
        getLogger().error(`Failed to initialize spacectl: ${error}`);
        const openSpaceliftDecisionsCommand = "Open spacectl documentation";
        helpers
          .showNotificationWithDecisions(
            "Failed to initialize spacectl. Some features will be disabled until spacectl is configured.",
            settings.showSpaceliftInitErrorOnStart,
            [openSpaceliftDecisionsCommand],
            "warning"
          )
          .then((result) => {
            if (result === openSpaceliftDecisionsCommand) {
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
  const tfInitAllProjectsCommand = new IacInitAllProjectsCommand(context, { command: cst.COMMAND_INIT_ALL_PROJECTS }, iacProjectHelper, iacProvider);
  new IacInitCurrentProjectCommand({ context, settings: { command: cst.COMMAND_INIT_CURRENT_PROJECT }, tfProjectHelper: iacProjectHelper, iacCli: iacCli, iacProvider: iacProvider });
  new IacFetchModulesCurrentProjectCommand(context, { command: cst.COMMAND_INIT_REFRESH_MODULES }, iacProjectHelper, iacProvider);

  // IaC workspace commands
  new ChoseAndSetIacWorkspaceCommand(context, { command: cst.COMMAND_SET_WORKSPACE, successCallback: iacWorkspaceItem.refresh.bind(iacWorkspaceItem) }, iacCli, iacProvider);
  const autoSetWorkspaceCommand = new AutoSetIacWorkspaceCommand(
    context,
    { command: cst.COMMAND_AUTO_SET_WORKSPACE, successCallback: iacWorkspaceItem.refresh.bind(iacWorkspaceItem) },
    iacCli,
    iacProjectHelper,
    iacProvider
  );

  // Create version manager command aliases based on the selected IaC provider
  switch (settings.iacProvider.value) {
    case IacProvider.opentofu:
      createCommandAlias(cst.COMMAND_SET_IAC_PROVIDER_VERSION, cst.COMMAND_SET_OPEN_TOFU_VERSION);
      createCommandAlias(cst.COMMAND_DELETE_IAC_PROVIDER_VERSION, cst.COMMAND_DELETE_OPEN_TOFU_VERSIONS);
      createCommandAlias(cst.COMMAND_AUTO_SET_IAC_PROVIDER_VERSION, cst.COMMAND_AUTO_SET_OPEN_TOFU_VERSION);
      break;

    case IacProvider.terraform:
      createCommandAlias(cst.COMMAND_SET_IAC_PROVIDER_VERSION, cst.COMMAND_SET_TERRAFORM_VERSION);
      createCommandAlias(cst.COMMAND_DELETE_IAC_PROVIDER_VERSION, cst.COMMAND_DELETE_TERRAFORM_VERSIONS);
      createCommandAlias(cst.COMMAND_AUTO_SET_IAC_PROVIDER_VERSION, cst.COMMAND_AUTO_SET_TERRAFORM_VERSION);
      break;
    default:
      throw new Error("IaC provider not supported");
  }

  // Check and install new terraform version if setting is enabled
  if (settings.autoselectVersion.value) {
    switch (settings.iacProvider.value) {
      case IacProvider.opentofu:
        await setOpenTofuVersionBasedOnProjectCommand.run(true).then(() => {
          iacVersionItem.refresh();
        });
        break;
      case IacProvider.terraform:
        await setTFVersionBasedOnProjectCommand.run(true).then(() => {
          iacVersionItem.refresh();
        });
        break;

      default:
        throw new Error("IaC provider not supported");
    }
  }

  if (primaryVersionManager.getActiveVersion() === undefined) {
    const showVersionsSelection = "Show versions";
    const decision = await helpers.showNotificationWithDecisions(
      `No ${iacProvider.name} version installed by this extension yet. Do you want to select a version to install now?`,
      settings.showNoIacVersionInstalledMsg,
      [showVersionsSelection],
      "information"
    );
    if (decision === showVersionsSelection) {
      await vscode.commands.executeCommand(cst.COMMAND_SET_TERRAFORM_VERSION);
    }
  }
  // Init all terraform projects if setting is enabled
  if (settings.autoInitAllProjects.value) {
    getLogger().info("Auto initializing all projects in the currently open workspaces");
    tfInitAllProjectsCommand.run(false, true).then(() => {
      if (settings.autoSelectWorkspace.value) {
        autoSetWorkspaceCommand.run(true);
      }
    });
  }

  if (settings.autoInitAllProjects.value === false && settings.autoSelectWorkspace.value === true) {
    autoSetWorkspaceCommand.run(true);
  }

  new IacInitService(iacProjectHelper, iacCli, iacParser, iacProvider, tfInitAllProjectsCommand, settings);

  // update status bar item once at start
  iacVersionItem.refresh();
}

function createCommandAlias(alias: string, command: string) {
  vscode.commands.registerCommand(alias, () => vscode.commands.executeCommand(command));
}

async function spacectlInit(settings: Settings): Promise<[IspaceliftClient, ISpacectl, string, SpaceliftAuthenticationHandler]> {
  const spacectlProfileName = settings.spacectlProfileName.value;
  const spacectlInstance = new Spacectl(new Cli());
  if (spacectlProfileName !== null && spacectlProfileName !== undefined) {
    spacectlInstance.setUserprofile(spacectlProfileName);
  }
  await spacectlInstance.ensureSpacectlIsInstalled();
  let spaceliftTenantID: string;
  if (settings.spaceliftTenantID.value === null || settings.spaceliftTenantID.value === undefined) {
    spaceliftTenantID = (await spacectlInstance.getExportedToken()).spaceliftTenantID;
    getLogger().info(`No spacelift tenant ID configured, using tenant ID from spacectl token: ${spaceliftTenantID}`);
  } else {
    spaceliftTenantID = settings.spaceliftTenantID.value;
  }
  const spaceliftEndpoint = `https://${spaceliftTenantID}${cst.SPACELIFT_BASE_DOMAIN}/graphql`;
  const authenticationHandler = new SpaceliftAuthenticationHandler(spacectlInstance, spacectlInstance, new GraphQLClient(spaceliftEndpoint));
  const spacelift = new SpaceliftClient(new GraphQLClient(spaceliftEndpoint), authenticationHandler);
  return [spacelift, spacectlInstance, spaceliftTenantID, authenticationHandler];
}
