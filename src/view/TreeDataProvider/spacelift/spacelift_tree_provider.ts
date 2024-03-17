import * as vscode from "vscode";
import { IspaceliftClient } from "../../../utils/spacelift/spacelift_client";
import { StackGroupTreeName, RootTreeItem, StackTreeItem } from "./spacelift_stack_tree_items";
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
      return [new RootTreeItem(this.pendingConfirmationLabel, vscode.TreeItemCollapsibleState.Collapsed), new RootTreeItem(this.allLabel, vscode.TreeItemCollapsibleState.Collapsed)];
    } else if (element instanceof RootTreeItem && element.label === this.pendingConfirmationLabel) {
      const pendingStacks = await this.spaceliftClient.getStacks();
      return pendingStacks.pendingConfirmation.map((stack) => new StackTreeItem(stack));
    } else if (element instanceof RootTreeItem && element.label === this.allLabel) {
      const stacks = await this.spaceliftClient.getStacks();
      const branches = this.groupStacksByRepositoryAndBranch(stacks.all);
      return branches;
    } else if (element instanceof StackGroupTreeName) {
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

  refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }
}

export function activate(client: IspaceliftClient, refreshCommand: string) {
  const stacksProvider = new StacksTreeDataProvider(client);
  vscode.window.createTreeView("spacelift.stacks", { treeDataProvider: stacksProvider });
  vscode.commands.registerCommand(refreshCommand, () => stacksProvider.refresh());
}
