import { GraphQLClient, gql } from "graphql-request";
import * as vscode from "vscode";
import { SpaceliftJwt } from "../../models/spacelift/jwt";
import { getLogger } from "../logger";
import { ISpacectl } from "./spacectl";

interface ViewerId {
  viewer: Id;
}

interface Id {
  id: string | undefined;
}

export interface ISpaceliftAuthenticationHandler {
  getToken(): Promise<SpaceliftJwt | null>;
  checkTokenValid(): Promise<boolean>;
  loginInteractive(): Promise<boolean>;
}

export class SpaceliftAuthenticationHandler implements ISpaceliftAuthenticationHandler {
  private _spacectl: ISpacectl;
  private _cli: ISpacectl;
  private _spaceliftJwt: SpaceliftJwt | undefined;
  private _graphQLClient: GraphQLClient;

  constructor(spacectl: ISpacectl, cli: ISpacectl, graphqlClient: GraphQLClient) {
    this._spacectl = spacectl;
    this._cli = cli;
    this._graphQLClient = graphqlClient;
  }

  async checkTokenValid(): Promise<boolean> {
    if (this._spaceliftJwt === undefined) {
      this._spaceliftJwt = await this._cli.getExportedToken();
    }
    if (this._spaceliftJwt.isExpired()) {
      return false;
    }
    return this.checkTokenNotRevoked();
  }

  async checkTokenNotRevoked(): Promise<boolean> {
    if (this._spaceliftJwt === undefined) {
      return false;
    }

    const query = gql`
      {
        viewer {
          id
        }
      }
    `;

    this._graphQLClient.setHeaders({
      authorization: `Bearer ${this._spaceliftJwt.rawToken}`,
    });

    const valid = await this._graphQLClient
      .request<ViewerId>(query)
      .then((data) => {
        if (data === undefined || data === null) {
          return false;
        }
        // Check if data has an viewer.id filed (which is only present if the token is valid
        if (data.viewer === undefined || data.viewer === null || data.viewer.id === undefined || data.viewer.id === null) {
          return false;
        }
        getLogger().debug("Spacelift token is valid and not revoked");
        return true;
      })
      .catch((error) => {
        getLogger().debug(`Failed to validate token: ${error}`);
        return false;
      });
    return valid;
  }

  async loginInteractive(): Promise<boolean> {
    // aks the user if he wants to login with the web browser
    const result = await vscode.window.showWarningMessage("Spacectl not authenticated, do you want to login with the web browser?", "Yes", "No").then(async (selection) => {
      if (selection === "Yes") {
        return true;
      }
      return false;
    });
    if (result === false) {
      return false;
    }

    const loginResult = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Waiting for spacectl login",
        cancellable: true,
      },
      async (progress, token) => {
        token.onCancellationRequested(() => {
          getLogger().debug("User has cancelled spacectl login");
          vscode.window.showWarningMessage("Spacectl login cancelled");
          return false;
        });
        return await this._cli.loginInteractive();
      }
    );
    if (loginResult === false) {
      return false;
    }
    this._spaceliftJwt = await this._cli.getExportedToken();
    return true;
  }

  async getToken(): Promise<SpaceliftJwt | null> {
    if (this._spaceliftJwt === undefined) {
      getLogger().debug("No spacelift token cached, trying export from spacectl");
      this._spaceliftJwt = await this._cli.getExportedToken();
      if (await this.checkTokenValid()) {
        getLogger().debug("Got valid spacelift token from spacectl");
        return this._spaceliftJwt;
      }
      getLogger().warn("Newly exported spacelift token from spacectl is not valid. Retruning null as token.");
      return null;
    }

    if (await this.checkTokenValid()) {
      getLogger().debug("Cached spacelift token is valid, returning it");
      return this._spaceliftJwt;
    }

    getLogger().debug("Cached spacelift token is not valid, trying to get new token from spacectl");
    this._spaceliftJwt = await this._cli.getExportedToken();

    if (await this.checkTokenValid()) {
      getLogger().debug("Got valid spacelift token from spacectl");
      return this._spaceliftJwt;
    }
    getLogger().warn("spacectl token is not valid");
    return null;
  }
}
