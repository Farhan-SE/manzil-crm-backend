export const SCOPES = ['own', 'team', 'all'] as const;
export type Scope = (typeof SCOPES)[number];

type PermissionDef = { key: string; module: string; label: string; scoped: boolean };

/**
 * Everything a role can be allowed to do. Companies build roles from this list; they can't add to it,
 * since only these keys are checked in code. A scoped permission says whose records it reaches:
 * `own` (assigned to the user), `team` (the user and the people they lead) or `all`.
 */
export const PERMISSIONS: PermissionDef[] = [
    { key: 'leads.view', module: 'Leads', label: 'View leads, the pipeline and their tasks', scoped: true },
    { key: 'leads.edit', module: 'Leads', label: 'Work leads: stage, temperature, tasks', scoped: true },
    { key: 'leads.create', module: 'Leads', label: 'Add leads', scoped: false },
    { key: 'leads.assign', module: 'Leads', label: "Reassign leads and change their interest or category", scoped: false },
    { key: 'leads.import', module: 'Leads', label: 'Import leads from a spreadsheet', scoped: false },
    { key: 'leads.delete', module: 'Leads', label: 'Delete leads', scoped: false },
    { key: 'tasks.manage', module: 'Leads', label: 'Schedule and reschedule tasks on any lead', scoped: false },

    { key: 'customers.view', module: 'Clients', label: 'View clients', scoped: true },
    { key: 'customers.edit', module: 'Clients', label: 'Edit clients', scoped: true },
    { key: 'customers.create', module: 'Clients', label: 'Add clients', scoped: false },
    { key: 'customers.assign', module: 'Clients', label: 'Reassign clients', scoped: false },
    { key: 'customers.import', module: 'Clients', label: 'Import clients from a spreadsheet', scoped: false },
    { key: 'customers.delete', module: 'Clients', label: 'Delete clients', scoped: false },

    { key: 'payments.view', module: 'Payments', label: 'View payments', scoped: true },
    { key: 'payments.record', module: 'Payments', label: 'Record money received', scoped: true },
    { key: 'payments.create', module: 'Payments', label: 'Schedule payments', scoped: false },
    { key: 'payments.verify', module: 'Payments', label: 'Verify receipts', scoped: false },

    { key: 'approvals.view', module: 'Approvals', label: 'View approval requests', scoped: true },
    { key: 'approvals.decide', module: 'Approvals', label: 'Approve, reject or return requests', scoped: false },

    { key: 'disputes.view', module: 'Sales disputes', label: 'View sales disputes', scoped: true },
    { key: 'disputes.manage', module: 'Sales disputes', label: "Move any case's status", scoped: false },

    { key: 'inventory.manage', module: 'Inventory', label: 'Manage projects, units, listings and locations', scoped: false },
    { key: 'inventory.approve', module: 'Inventory', label: 'Approve units; units they add go straight on sale', scoped: false },

    { key: 'reports.view', module: 'Reports', label: 'View reports and targets', scoped: false },
    { key: 'targets.manage', module: 'Reports', label: 'Set monthly targets', scoped: false },

    { key: 'staff.manage', module: 'Staff', label: 'Add, edit, suspend and block staff', scoped: false },
    { key: 'teams.manage', module: 'Staff', label: 'Manage teams', scoped: false },
    { key: 'roles.manage', module: 'Staff', label: 'Manage roles and give staff their role', scoped: false },

    { key: 'settings.manage', module: 'Settings', label: 'Manage interests, categories and sources', scoped: false },
];

export const PERMISSION_KEYS = PERMISSIONS.map((permission) => permission.key);
export const SCOPED_KEYS = new Set(PERMISSIONS.filter((permission) => permission.scoped).map((permission) => permission.key));

export type PermissionGrant = { permission: string; scope: Scope | null };

/** The system Admin role: everything, over everyone. */
export const ADMIN_GRANTS: PermissionGrant[] = PERMISSIONS.map(({ key, scoped }) => ({
    permission: key,
    scope: scoped ? 'all' : null,
}));

/** The starter Agent role, matching what an agent could do before roles existed. */
export const AGENT_GRANTS: PermissionGrant[] = [
    { permission: 'leads.view', scope: 'own' },
    { permission: 'leads.edit', scope: 'own' },
    { permission: 'leads.create', scope: null },
    { permission: 'customers.view', scope: 'own' },
    { permission: 'customers.edit', scope: 'own' },
    { permission: 'customers.create', scope: null },
    { permission: 'payments.view', scope: 'own' },
    { permission: 'payments.record', scope: 'own' },
    { permission: 'approvals.view', scope: 'own' },
    { permission: 'disputes.view', scope: 'own' },
];
