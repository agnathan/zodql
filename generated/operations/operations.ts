/**
 * Generated GraphQL Operations
 * This file is auto-generated. Do not edit manually.
 */

query GetProject($key: String!) {
  getProject(key: $key) {

  }
}

query Projects($scope: String, $filter: String, $sort: String, $paginate: String) {
  projects(scope: $scope, filter: $filter, sort: $sort, paginate: $paginate) {

  }
}

query GetDocLink($key: String!) {
  getDocLink(key: $key) {

  }
}

query ListDocLinks($key: String!, $limit: String, $nextToken: String) {
  listDocLinks(key: $key, limit: $limit, nextToken: $nextToken) {

  }
}

query GetWorkflow($key: String!) {
  getWorkflow(key: $key) {

  }
}

query Workflows($scope: String, $filter: String, $sort: String, $paginate: String) {
  workflows(scope: $scope, filter: $filter, sort: $sort, paginate: $paginate) {

  }
}

query GetDashboard($key: String!) {
  getDashboard(key: $key) {

  }
}

query Dashboards($scope: String, $sort: String, $paginate: String) {
  dashboards(scope: $scope, sort: $sort, paginate: $paginate) {

  }
}

query GetProductListing($key: String!) {
  getProductListing(key: $key) {

  }
}

query ListProductListings($limit: String, $nextToken: String) {
  listProductListings(limit: $limit, nextToken: $nextToken) {

  }
}

mutation CreateProject($input: String!) {
  createProject(input: $input) {

  }
}

mutation UpdateProject($key: String!, $input: String!) {
  updateProject(key: $key, input: $input) {

  }
}

mutation DeleteProject($key: String!) {
  deleteProject(key: $key) {

  }
}

mutation RestoreProject($key: String!) {
  restoreProject(key: $key) {

  }
}

mutation CreateDocLink($parentKey: String!, $input: String!) {
  createDocLink(parentKey: $parentKey, input: $input) {

  }
}

mutation BatchCreateDocLinks($parentKey: String!, $inputs: [String!]!!) {
  batchCreateDocLinks(parentKey: $parentKey, inputs: $inputs) {

  }
}

mutation UpdateDocLink($key: String!, $input: String!) {
  updateDocLink(key: $key, input: $input) {

  }
}

mutation DeleteDocLink($key: String!) {
  deleteDocLink(key: $key) {

  }
}

mutation CreateWorkflow($input: String!) {
  createWorkflow(input: $input) {

  }
}

mutation UpdateWorkflow($key: String!, $input: String!) {
  updateWorkflow(key: $key, input: $input) {

  }
}

mutation DeleteWorkflow($key: String!) {
  deleteWorkflow(key: $key) {

  }
}

mutation CreateDashboard($input: String!) {
  createDashboard(input: $input) {

  }
}

mutation UpdateDashboard($key: String!, $input: String!) {
  updateDashboard(key: $key, input: $input) {

  }
}

mutation DeleteDashboard($key: String!) {
  deleteDashboard(key: $key) {

  }
}

mutation ForkEntity($input: String!) {
  forkEntity(input: $input) {

  }
}

mutation CreateProductListing($title: String!, $priceMonthly: String, $includedItemIds: [String!]!!) {
  createProductListing(title: $title, priceMonthly: $priceMonthly, includedItemIds: $includedItemIds) {

  }
}

mutation GrantSubscription($targetUserId: String!, $listingId: String!, $durationDays: String!) {
  grantSubscription(targetUserId: $targetUserId, listingId: $listingId, durationDays: $durationDays) {

  }
}

mutation BroadcastPresence($projectId: String!, $action: String!, $cursorX: String, $cursorY: String) {
  broadcastPresence(projectId: $projectId, action: $action, cursorX: $cursorX, cursorY: $cursorY) {

  }
}

subscription OnCreateProject($ownerId: String, $tenantId: String) {
  onCreateProject(ownerId: $ownerId, tenantId: $tenantId) {

  }
}

subscription OnUpdateProject($id: String!) {
  onUpdateProject(id: $id) {

  }
}

subscription OnDeleteProject($id: String!) {
  onDeleteProject(id: $id) {

  }
}

subscription OnCreateDocLink($parentId: String!) {
  onCreateDocLink(parentId: $parentId) {

  }
}

subscription OnUpdateDocLink($parentId: String!) {
  onUpdateDocLink(parentId: $parentId) {

  }
}

subscription OnDeleteDocLink($parentId: String!) {
  onDeleteDocLink(parentId: $parentId) {

  }
}

subscription OnCreateWorkflow($ownerId: String, $tenantId: String) {
  onCreateWorkflow(ownerId: $ownerId, tenantId: $tenantId) {

  }
}

subscription OnUpdateWorkflow($id: String!) {
  onUpdateWorkflow(id: $id) {

  }
}

subscription OnDeleteWorkflow($id: String!) {
  onDeleteWorkflow(id: $id) {

  }
}

subscription OnCreateDashboard($ownerId: String, $tenantId: String) {
  onCreateDashboard(ownerId: $ownerId, tenantId: $tenantId) {

  }
}

subscription OnUpdateDashboard($id: String!) {
  onUpdateDashboard(id: $id) {

  }
}

subscription OnDeleteDashboard($id: String!) {
  onDeleteDashboard(id: $id) {

  }
}

subscription OnCreateProductListing($ownerId: String!) {
  onCreateProductListing(ownerId: $ownerId) {

  }
}

subscription OnGrantSubscription($targetUserId: String!) {
  onGrantSubscription(targetUserId: $targetUserId) {

  }
}

subscription OnPresenceChange($projectId: String!) {
  onPresenceChange(projectId: $projectId) {

  }
}