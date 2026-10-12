/** Source of truth for permission keys. Seeded into the Permission table. */
export const PERMISSIONS = {
  'catalog.read': 'View products and categories',
  'catalog.write': 'Create and edit products and categories',
  'price.override': 'Override prices at checkout',
  'sales.create': 'Ring up sales',
  'sales.void': 'Void sales',
  'sales.refund': 'Refund sales',
  'discount.apply': 'Apply manual discounts',
  'inventory.read': 'View stock',
  'inventory.write': 'Adjust stock, receive goods, transfer',
  'purchasing.write': 'Create and approve purchase orders',
  'customers.read': 'View customers',
  'customers.write': 'Edit customers and loyalty',
  'reports.read': 'View reports',
  'staff.read': 'View staff',
  'staff.write': 'Manage staff and roles',
  'audit.read': 'View audit log',
  'ai.chat': 'Use the Store Assistant',
  'ai.approve': 'Approve AI-drafted actions',
  'settings.write': 'Change system settings',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionKey[];

export const DEFAULT_ROLES: Record<string, PermissionKey[]> = {
  Owner: ALL_PERMISSIONS,
  Admin: ALL_PERMISSIONS.filter((p) => p !== 'settings.write'),
  Manager: [
    'catalog.read',
    'catalog.write',
    'price.override',
    'sales.create',
    'sales.void',
    'sales.refund',
    'discount.apply',
    'inventory.read',
    'inventory.write',
    'purchasing.write',
    'customers.read',
    'customers.write',
    'reports.read',
    'staff.read',
    'audit.read',
    'ai.chat',
    'ai.approve',
  ],
  Cashier: ['catalog.read', 'sales.create', 'customers.read'],
  'Stock Keeper': ['catalog.read', 'inventory.read', 'inventory.write'],
};
