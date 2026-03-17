param name string
param location string
param tags object = {}
param logAnalyticsWorkspaceId string
param storageAccountName string = ''
@secure()
param storageAccountKey string = ''
param fileShareName string = ''

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: reference(logAnalyticsWorkspaceId, '2023-09-01').customerId
        sharedKey: listKeys(logAnalyticsWorkspaceId, '2023-09-01').primarySharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// Register Azure Files storage in the environment (requires account key — Entra ID not supported)
resource envStorage 'Microsoft.App/managedEnvironments/storages@2024-03-01' = if (!empty(storageAccountName) && !empty(storageAccountKey) && !empty(fileShareName)) {
  parent: containerAppsEnvironment
  name: 'workspacestorage'
  properties: {
    azureFile: {
      accountName: storageAccountName
      accountKey: storageAccountKey
      shareName: fileShareName
      accessMode: 'ReadWrite'
    }
  }
}

output id string = containerAppsEnvironment.id
output name string = containerAppsEnvironment.name
output defaultDomain string = containerAppsEnvironment.properties.defaultDomain
