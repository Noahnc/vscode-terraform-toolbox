import * as vscode from "vscode";

export const mockExtensionContext: vscode.ExtensionContext = {
  extension: {
    packageJSON: {
      displayName: "Test Extension",
    },
  },
} as vscode.ExtensionContext;
