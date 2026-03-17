targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment (e.g., dev, staging, prod)')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('Name of the Azure OpenAI model deployment')
param aiModelName string = 'gpt-4.1'

@description('Azure OpenAI model version')
param aiModelVersion string = '2025-04-14'

@description('Azure OpenAI SKU capacity (tokens per minute in thousands)')
param aiModelCapacity int = 30

@description('Container image name (set by azd)')
param containerImageName string = ''

@secure()
@description('MCP servers JSON config (set via azd env set MCP_SERVERS_JSON)')
param mcpServersJson string = '{}'

var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = {
  'azd-env-name': environmentName
  project: 'ghcp-ui'
}

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

// Managed Identity
module managedIdentity './modules/managed-identity.bicep' = {
  name: 'managed-identity'
  scope: rg
  params: {
    name: '${abbrs.managedIdentity}${resourceToken}'
    location: location
    tags: tags
  }
}

// Azure OpenAI (AI Foundry)
module openAi './modules/ai-foundry.bicep' = {
  name: 'ai-foundry'
  scope: rg
  params: {
    name: '${abbrs.cognitiveServicesAccount}${resourceToken}'
    location: location
    tags: tags
    modelName: aiModelName
    modelVersion: aiModelVersion
    modelCapacity: aiModelCapacity
    managedIdentityPrincipalId: managedIdentity.outputs.principalId
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
    openAiEndpoint: openAi.outputs.endpoint
    openAiKey: openAi.outputs.key
    mcpServersJson: mcpServersJson
  }
}

// Storage Account (workspace files)
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
    containerImageName: !empty(containerImageName) ? containerImageName : 'ghcp-ui:latest'
    managedIdentityId: managedIdentity.outputs.id
    managedIdentityClientId: managedIdentity.outputs.clientId
    openAiEndpoint: openAi.outputs.endpoint
    openAiModelName: aiModelName
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
output AZURE_OPENAI_ENDPOINT string = openAi.outputs.endpoint
output AZURE_OPENAI_MODEL_NAME string = aiModelName
output AZURE_STORAGE_ACCOUNT_NAME string = storageAccount.outputs.name
output SERVICE_WEB_ENDPOINTS array = [containerApp.outputs.uri]
