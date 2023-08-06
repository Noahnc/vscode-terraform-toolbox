import { gql } from "graphql-request";

export const GET_SPACELIFT_STACKS = gql`
  {
    stacks {
      id
      name
      administrative
      createdAt
      state
      description
      branch
      projectRoot
      repository
      vendorConfig {
        ... on StackConfigVendorTerraform {
          workspace
        }
      }
    }
  }
`;

export interface Stack {
  id: string;
  name: string;
  state?: string;
  administrative: boolean;
  createdAt: string;
  description: string;
  branch: string;
  projectRoot: string;
  repository: string;
  vendorConfig: StackConfigVendorTerraform;
}

export interface StackConfigVendorTerraform {
  workspace: string;
}

export class SpaceliftStacks {
  private stacks: Stack[];
  constructor(stacks: Stack[]) {
    this.stacks = stacks;
  }

  get all(): Stack[] {
    return this.stacks;
  }

  get administrative(): Stack[] {
    return this.stacks.filter((stack) => stack.administrative);
  }

  get pendingConfirmation(): Stack[] {
    return this.stacks.filter((stack) => stack.state === "UNCONFIRMED");
  }

  getStacksMatchingProject(repositoryName: string, projectRoot?: string): Stack[] {
    if (projectRoot === undefined) {
      return this.stacks.filter((stack) => stack.repository === repositoryName);
    }
    return this.stacks.filter((stack) => stack.projectRoot === projectRoot && stack.repository === repositoryName);
  }
}
