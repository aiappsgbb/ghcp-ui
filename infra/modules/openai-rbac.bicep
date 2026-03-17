// Cross-resource-group module: references an EXISTING Azure OpenAI resource
// and assigns Cognitive Services OpenAI User role to our managed identity
targetScope = 'resourceGroup'

param openAiName string
param userAssignedIdentityPrincipalId string

resource openAi 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: openAiName
}

resource cognitiveServicesRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openAi.id, userAssignedIdentityPrincipalId, 'Cognitive Services OpenAI User')
  scope: openAi
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')
    principalId: userAssignedIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output openAiEndpoint string = openAi.properties.endpoint
#disable-next-line outputs-should-not-contain-secrets
output openAiKey string = openAi.listKeys().key1
