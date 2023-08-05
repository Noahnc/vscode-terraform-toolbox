export interface TerraformBaseResource {
  key: string;
  source: string;
  version: string;
}

export function checkIfAllResourcesInstalled(declaredResources: TerraformBaseResource[], installedResources: TerraformBaseResource[]): boolean {
  let allResourcesInstalled = true;
  for (const declaredResource of declaredResources) {
    const installedResource = installedResources.find(
      (resource) => resource.key === declaredResource.key && resource.source === declaredResource.source && resource.version === declaredResource.version
    );
    if (installedResource === undefined) {
      allResourcesInstalled = false;
      break;
    }
  }
  return allResourcesInstalled;
}
