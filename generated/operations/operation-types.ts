/**
 * Generated TypeScript Types for GraphQL Operations
 * This file is auto-generated. Do not edit manually.
 */


export interface GetProjectVariables {
  key: any;
}

export interface GetProjectResponse {
  getProject: any | null;
}


export interface ProjectsVariables {
  scope?: any | undefined;
  filter?: any | undefined;
  sort?: any | undefined;
  paginate?: any | undefined;
}

export interface ProjectsResponse {
  projects: any;
}


export interface GetDocLinkVariables {
  key: any;
}

export interface GetDocLinkResponse {
  getDocLink: any | null;
}


export interface ListDocLinksVariables {
  key: any;
  limit?: any | undefined;
  nextToken?: any | undefined;
}

export interface ListDocLinksResponse {
  listDocLinks: any | null;
}


export interface GetWorkflowVariables {
  key: any;
}

export interface GetWorkflowResponse {
  getWorkflow: any | null;
}


export interface WorkflowsVariables {
  scope?: any | undefined;
  filter?: any | undefined;
  sort?: any | undefined;
  paginate?: any | undefined;
}

export interface WorkflowsResponse {
  workflows: any;
}


export interface GetDashboardVariables {
  key: any;
}

export interface GetDashboardResponse {
  getDashboard: any | null;
}


export interface DashboardsVariables {
  scope?: any | undefined;
  sort?: any | undefined;
  paginate?: any | undefined;
}

export interface DashboardsResponse {
  dashboards: any;
}


export interface GetProductListingVariables {
  key: any;
}

export interface GetProductListingResponse {
  getProductListing: any | null;
}


export interface ListProductListingsVariables {
  limit?: any | undefined;
  nextToken?: any | undefined;
}

export interface ListProductListingsResponse {
  listProductListings: any | null;
}


export interface CreateProjectVariables {
  input: any;
}

export interface CreateProjectResponse {
  createProject: any | null;
}


export interface UpdateProjectVariables {
  key: any;
  input: any;
}

export interface UpdateProjectResponse {
  updateProject: any | null;
}


export interface DeleteProjectVariables {
  key: any;
}

export interface DeleteProjectResponse {
  deleteProject: any | null;
}


export interface RestoreProjectVariables {
  key: any;
}

export interface RestoreProjectResponse {
  restoreProject: any | null;
}


export interface CreateDocLinkVariables {
  parentKey: any;
  input: any;
}

export interface CreateDocLinkResponse {
  createDocLink: any | null;
}


export interface BatchCreateDocLinksVariables {
  parentKey: any;
  inputs: any[];
}

export interface BatchCreateDocLinksResponse {
  batchCreateDocLinks: any | null;
}


export interface UpdateDocLinkVariables {
  key: any;
  input: any;
}

export interface UpdateDocLinkResponse {
  updateDocLink: any | null;
}


export interface DeleteDocLinkVariables {
  key: any;
}

export interface DeleteDocLinkResponse {
  deleteDocLink: any | null;
}


export interface CreateWorkflowVariables {
  input: any;
}

export interface CreateWorkflowResponse {
  createWorkflow: any | null;
}


export interface UpdateWorkflowVariables {
  key: any;
  input: any;
}

export interface UpdateWorkflowResponse {
  updateWorkflow: any | null;
}


export interface DeleteWorkflowVariables {
  key: any;
}

export interface DeleteWorkflowResponse {
  deleteWorkflow: any | null;
}


export interface CreateDashboardVariables {
  input: any;
}

export interface CreateDashboardResponse {
  createDashboard: any | null;
}


export interface UpdateDashboardVariables {
  key: any;
  input: any;
}

export interface UpdateDashboardResponse {
  updateDashboard: any | null;
}


export interface DeleteDashboardVariables {
  key: any;
}

export interface DeleteDashboardResponse {
  deleteDashboard: any | null;
}


export interface ForkEntityVariables {
  input: any;
}

export interface ForkEntityResponse {
  forkEntity: any | null;
}


export interface CreateProductListingVariables {
  title: any;
  priceMonthly?: any | undefined;
  includedItemIds: any[];
}

export interface CreateProductListingResponse {
  createProductListing: any | null;
}


export interface GrantSubscriptionVariables {
  targetUserId: any;
  listingId: any;
  durationDays: any;
}

export interface GrantSubscriptionResponse {
  grantSubscription: any | null;
}


export interface BroadcastPresenceVariables {
  projectId: any;
  action: any;
  cursorX?: any | undefined;
  cursorY?: any | undefined;
}

export interface BroadcastPresenceResponse {
  broadcastPresence: any | null;
}


export interface OnCreateProjectVariables {
  ownerId?: any | undefined;
  tenantId?: any | undefined;
}

export interface OnCreateProjectResponse {
  onCreateProject: any | null;
}


export interface OnUpdateProjectVariables {
  id: any;
}

export interface OnUpdateProjectResponse {
  onUpdateProject: any | null;
}


export interface OnDeleteProjectVariables {
  id: any;
}

export interface OnDeleteProjectResponse {
  onDeleteProject: any | null;
}


export interface OnCreateDocLinkVariables {
  parentId: any;
}

export interface OnCreateDocLinkResponse {
  onCreateDocLink: any | null;
}


export interface OnUpdateDocLinkVariables {
  parentId: any;
}

export interface OnUpdateDocLinkResponse {
  onUpdateDocLink: any | null;
}


export interface OnDeleteDocLinkVariables {
  parentId: any;
}

export interface OnDeleteDocLinkResponse {
  onDeleteDocLink: any | null;
}


export interface OnCreateWorkflowVariables {
  ownerId?: any | undefined;
  tenantId?: any | undefined;
}

export interface OnCreateWorkflowResponse {
  onCreateWorkflow: any | null;
}


export interface OnUpdateWorkflowVariables {
  id: any;
}

export interface OnUpdateWorkflowResponse {
  onUpdateWorkflow: any | null;
}


export interface OnDeleteWorkflowVariables {
  id: any;
}

export interface OnDeleteWorkflowResponse {
  onDeleteWorkflow: any | null;
}


export interface OnCreateDashboardVariables {
  ownerId?: any | undefined;
  tenantId?: any | undefined;
}

export interface OnCreateDashboardResponse {
  onCreateDashboard: any | null;
}


export interface OnUpdateDashboardVariables {
  id: any;
}

export interface OnUpdateDashboardResponse {
  onUpdateDashboard: any | null;
}


export interface OnDeleteDashboardVariables {
  id: any;
}

export interface OnDeleteDashboardResponse {
  onDeleteDashboard: any | null;
}


export interface OnCreateProductListingVariables {
  ownerId: any;
}

export interface OnCreateProductListingResponse {
  onCreateProductListing: any | null;
}


export interface OnGrantSubscriptionVariables {
  targetUserId: any;
}

export interface OnGrantSubscriptionResponse {
  onGrantSubscription: any | null;
}


export interface OnPresenceChangeVariables {
  projectId: any;
}

export interface OnPresenceChangeResponse {
  onPresenceChange: any | null;
}

