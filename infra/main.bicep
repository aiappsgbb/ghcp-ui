targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment (e.g., dev, staging, prod)')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('Name of the existing Azure OpenAI resource (in another resource group)')
param openAiName string

@description('Resource group containing the existing Azure OpenAI resource')
param openAiResourceGroupName string

@description('Name of the Azure OpenAI model deployment')
param aiModelName string = 'gpt-4.1'

@description('Container image name (set by azd during deploy)')
param containerImageName string = ''

@secure()
@description('MCP servers JSON config (set via azd env set MCP_SERVERS_JSON)')
param mcpServersJson string = '{}'

// azd system variable: tells us if the container app already exists
param webAppExists bool = false

var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = {
  'azd-env-name': environmentName
  project: 'ghcp-ui'
  // Azure Files on ACA requires storage account key (Entra ID auth not supported for SMB mounts)
  SecurityControl: 'Ignore'
}
var emptyContainerImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

// Resource Group
resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: '${abbrs.resourceGroup}${environmentName}'
  location: location
  tags: tags
}

// Log Analytics Workspace
module logAnalytics './modules/log-analytics.bicep' = {
  name: 'log-analytics'
  scope: rg
  params: {
    name: '${abbrs.logAnalyticsWorkspace}${resourceToken}'
    location: location
    tags: tags
  }
}

// Container Registry
module containerRegistry './modules/container-registry.bicep' = {
  name: 'container-registry'
  scope: rg
  params: {
    name: '${abbrs.containerRegistry}${resourceToken}'
    location: location
    tags: tags
  }
}

// Managed Identity (UAMI for the whole app)
module managedIdentity './modules/managed-identity.bicep' = {
  name: 'managed-identity'
  scope: rg
  params: {
    name: '${abbrs.managedIdentity}${resourceToken}'
    location: location
    tags: tags
  }
}

// Cross-RG: assign RBAC on the EXISTING Azure OpenAI resource
module openAiRbac './modules/openai-rbac.bicep' = {
  name: 'openai-rbac'
  scope: resourceGroup(openAiResourceGroupName)
  params: {
    openAiName: openAiName
    userAssignedIdentityPrincipalId: managedIdentity.outputs.principalId
  }
}

// Key Vault
module keyVault './modules/key-vault.bicep' = {
  name: 'key-vault'
  scope: rg
  params: {
    name: '${abbrs.keyVault}${resourceToken}'
    location: location
    tags: tags
    managedIdentityPrincipalId: managedIdentity.outputs.principalId
    openAiEndpoint: openAiRbac.outputs.openAiEndpoint
    openAiKey: openAiRbac.outputs.openAiKey
    mcpServersJson: mcpServersJson
  }
}

// Storage Account (workspace files + Azure Files share)
module storageAccount './modules/storage-account.bicep' = {
  name: 'storage-account'
  scope: rg
  params: {
    name: 'st${resourceToken}'
    location: location
    tags: tags
    managedIdentityPrincipalId: managedIdentity.outputs.principalId
  }
}

// Container Apps Environment
module containerAppsEnv './modules/container-apps-environment.bicep' = {
  name: 'container-apps-env'
  scope: rg
  params: {
    name: '${abbrs.containerAppsEnvironment}${resourceToken}'
    location: location
    tags: tags
    logAnalyticsWorkspaceId: logAnalytics.outputs.id
    storageAccountName: storageAccount.outputs.name
    storageAccountKey: storageAccount.outputs.accountKey
    fileShareName: storageAccount.outputs.fileShareName
  }
}

// Fetch existing container image to avoid overwriting during provision
// See: https://johnnyreilly.com/using-azd-for-faster-incremental-azure-container-app-deployments-in-azure-devops
module fetchLatestImage './fetch-container-image.bicep' = {
  name: 'web-app-image'
  scope: rg
  params: {
    exists: webAppExists
    name: '${abbrs.containerApp}${resourceToken}'
  }
}

// Container App
module containerApp './modules/container-app.bicep' = {
  name: 'container-app'
  scope: rg
  params: {
    name: '${abbrs.containerApp}${resourceToken}'
    location: location
    tags: tags
    containerAppsEnvironmentId: containerAppsEnv.outputs.id
    containerRegistryName: containerRegistry.outputs.name
    containerImageName: !empty(containerImageName) ? containerImageName : (webAppExists ? fetchLatestImage.outputs.containers[0].image : emptyContainerImage)
    managedIdentityId: managedIdentity.outputs.id
    managedIdentityClientId: managedIdentity.outputs.clientId
    openAiEndpoint: openAiRbac.outputs.openAiEndpoint
    openAiModelName: aiModelName
    openAiResourceName: openAiName
    openAiResourceGroup: openAiResourceGroupName
    subscriptionId: subscription().subscriptionId
    keyVaultName: keyVault.outputs.name
    storageAccountName: storageAccount.outputs.name
  }
}

// Outputs for azd
output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.outputs.loginServer
output AZURE_CONTAINER_REGISTRY_NAME string = containerRegistry.outputs.name
output AZURE_CONTAINER_APP_NAME string = containerApp.outputs.name
output AZURE_CONTAINER_APP_FQDN string = containerApp.outputs.fqdn
output AZURE_OPENAI_ENDPOINT string = openAiRbac.outputs.openAiEndpoint
output AZURE_OPENAI_MODEL_NAME string = aiModelName
output AZURE_STORAGE_ACCOUNT_NAME string = storageAccount.outputs.name
output SERVICE_WEB_ENDPOINTS array = [containerApp.outputs.uri]
