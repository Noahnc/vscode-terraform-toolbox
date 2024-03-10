import * as vscode from "vscode";
import { IspaceliftClient } from "../../utils/spacelift/spacelift_client";
import { StacksTreeDataProvider } from "./spacelift/spacelift_tree_provider";

export function activate(client: IspaceliftClient) {
  const stacksProvider = new StacksTreeDataProvider(client);
  vscode.window.createTreeView("spacelift.stacks", { treeDataProvider: stacksProvider });
}

export function deactivate() {}
