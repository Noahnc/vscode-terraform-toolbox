import { GraphQLClient, Variables } from "graphql-request";
import { UserShownError } from "../../custom_errors";
import { SpaceliftJwt } from "../../models/spacelift/jwt";
import { GET_SPACELIFT_STACKS, SpaceliftStacks, Stack } from "../../models/spacelift/stack";
import * as helper from "../helper_functions";
import { getLogger } from "../logger";

export interface IspaceliftClient {
  getStacks(): Promise<SpaceliftStacks>;
  authenticate(): Promise<void>;
}

export class SpaceliftClient implements IspaceliftClient {
  private _spaceliftEndpoint?: string;
  private _client!: GraphQLClient;
  private _tokenRetrieverFunction: () => Promise<SpaceliftJwt>;
  private _token: SpaceliftJwt | undefined;

  constructor($client: GraphQLClient, tokenRetrieverFunction: () => Promise<SpaceliftJwt>) {
    this._tokenRetrieverFunction = tokenRetrieverFunction;
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
    if (this._token !== undefined) {
      if (!this._token.isExpired()) {
        return;
      }
    }
    this._token = await this._tokenRetrieverFunction();
    this._client.setHeaders({
      authorization: `Bearer ${this._token.rawToken}`,
    });
  }

  async getStacks(retryCount?: number): Promise<SpaceliftStacks> {
    const response = await this.sendGraphQLRequest<{ stacks: Stack[] }>(GET_SPACELIFT_STACKS);
    if (response === undefined) {
      throw new UserShownError("Failed to get stacks from spacelift.");
    }
    getLogger().debug("Got " + response.stacks.length + " stacks from spacelift.");
    getLogger().trace("Got stacks from spacelift: " + JSON.stringify(response.stacks));
    return new SpaceliftStacks(response.stacks);
  }
}
