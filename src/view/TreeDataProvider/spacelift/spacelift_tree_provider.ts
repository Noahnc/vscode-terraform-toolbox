import * as vscode from "vscode";
import { IspaceliftClient } from "../../../utils/spacelift/spacelift_client";
import { StackGroupTreeName, RootTreeItem, StackTreeItem } from "./spacelift_stack_tree_item";
import { Stack } from "../../../models/spacelift/stack";

export class StacksTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null> = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null> = this._onDidChangeTreeData.event;

  private readonly pendingConfirmationLabel = "Pending Confirmation";
  private readonly allLabel = "All";

  constructor(private spaceliftClient: IspaceliftClient) {}

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      // Root level: 'Stacks Pending Confirmation' and 'Spacelift Stacks'
      return [new RootTreeItem(this.pendingConfirmationLabel, vscode.TreeItemCollapsibleState.Collapsed), new RootTreeItem(this.allLabel, vscode.TreeItemCollapsibleState.Collapsed)];
    } else if (element instanceof RootTreeItem && element.label === this.pendingConfirmationLabel) {
      // Child stacks under 'Stacks Pending Confirmation'
      const pendingStacks = await this.spaceliftClient.getStacks(); // Implement filtering logic for pending confirmation
      return pendingStacks.pendingConfirmation.map((stack) => new StackTreeItem(stack));
    } else if (element instanceof RootTreeItem && element.label === this.allLabel) {
      // Branches under 'Spacelift Stacks'
      const stacks = await this.spaceliftClient.getStacks();
      const branches = this.groupStacksByRepositoryAndBranch(stacks.all);
      return branches;
    } else if (element instanceof StackGroupTreeName) {
      // Stacks under a specific branch
      return element.children.map((stack) => new StackTreeItem(stack));
    }
    return [];
  }

  private groupStacksByRepositoryAndBranch(stacks: Stack[]): StackGroupTreeName[] {
    const groupedStacks: { [key: string]: Stack[] } = {};
    stacks.forEach((stack) => {
      const stackKey = `${stack.repository}-${stack.branch}`;
      if (!groupedStacks[stackKey]) {
        groupedStacks[stackKey] = [];
      }
      groupedStacks[stackKey].push(stack);
    });
    return Object.keys(groupedStacks).map((stackKey) => new StackGroupTreeName(stackKey, groupedStacks[stackKey]));
  }
}
