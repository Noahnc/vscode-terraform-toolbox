import * as vscode from "vscode";
import { Stack } from "../../../models/spacelift/stack";

export class RootTreeItem extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    super(label, collapsibleState);
    this.contextValue = "root";
  }
}

export class StackGroupTreeName extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly children: Stack[]) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = "SpaceliftStackGroup";
    this.iconPath = new vscode.ThemeIcon("repo"); // ToDo: find better icon
  }
}

export class StackTreeItem extends vscode.TreeItem {
  constructor(public readonly stack: Stack) {
    super(stack.name, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${this.stack.id} - ${this.stack.description}`;
    this.contextValue = "SpaceliftStack";
    this.iconPath = new vscode.ThemeIcon("repo"); // ToDo: find better icon
  }
}
