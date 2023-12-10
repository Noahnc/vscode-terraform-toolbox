import { GraphQLClient, Variables } from "graphql-request";
import { UserShownError } from "../../custom_errors";
import { GET_SPACELIFT_STACKS, SpaceliftStacks, Stack } from "../../models/spacelift/stack";
import * as helper from "../helper_functions";
import { getLogger } from "../logger";
import { IspaceliftAuthenticationHandler } from "./spacelift_authentication_handler";

export interface IspaceliftClient {
  getStacks(): Promise<SpaceliftStacks>;
  isAuthenticated(): Promise<boolean>;
}

export class SpaceliftClient implements IspaceliftClient {
  private _spaceliftEndpoint?: string;
  private _client!: GraphQLClient;
  private _auth_handler: IspaceliftAuthenticationHandler;

  constructor($client: GraphQLClient, auth_handler: IspaceliftAuthenticationHandler) {
    this._auth_handler = auth_handler;
    this._client = $client;
  }

  private async sendGraphQLRequest<Type>(query: string, variables?: Variables, retryCount = 5): Promise<Type | undefined> {
    await this.authenticate();
    return await this._client.request<Type>(query, variables).catch(async (error) => {
      if (retryCount > 0) {
        getLogger().error("GraphQL request to Spacelift failed: " + error);
        return undefined;
      }
      await helper.delay(1000);
      return this.sendGraphQLRequest<Type>(query, variables, retryCount - 1);
    });
  }

  async authenticate() {
    const jwt = await this._auth_handler.get_token();
    if (jwt === null) {
      throw new UserShownError("Spacectl not authenticated.");
    }
    this._client.setHeaders({
      authorization: `Bearer ${jwt.rawToken}`,
    });
  }

  async getStacks(retryCount?: number): Promise<SpaceliftStacks> {
    const response = await this.sendGraphQLRequest<{ stacks: Stack[] }>(GET_SPACELIFT_STACKS, undefined, retryCount);
    if (response === undefined) {
      throw new UserShownError("Failed to get stacks from spacelift.");
    }
    getLogger().debug("Got " + response.stacks.length + " stacks from spacelift.");
    getLogger().trace("Got stacks from spacelift: " + JSON.stringify(response.stacks));
    return new SpaceliftStacks(response.stacks);
  }

  async isAuthenticated(): Promise<boolean> {
    return await this._auth_handler.check_token_valid();
  }
}
