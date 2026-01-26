const ROLE_PERMISSIONS = {
  Owner: [
    'connectors:create', 'connectors:read', 'connectors:update', 'connectors:delete',
    'queries:run',
    'dashboards:create', 'dashboards:read', 'dashboards:update', 'dashboards:share',
    'chat:use',
    'admin:policies/manage'
  ],
  Admin: [
    'connectors:create', 'connectors:read', 'connectors:update', 'connectors:delete',
    'queries:run',
    'dashboards:create', 'dashboards:read', 'dashboards:update', 'dashboards:share',
    'chat:use',
    'admin:policies/manage'
  ],
  Analyst: [
    'connectors:read',
    'queries:run',
    'dashboards:create', 'dashboards:read', 'dashboards:update',
    'chat:use'
  ],
  Viewer: [
    'connectors:read',
    'dashboards:read',
    'chat:use'
  ]
};

function getRoleFromClaims(claims = {}) {
  const role = claims.role || claims.roles?.[0] || claims['https://example.com/roles']?.[0];
  return role || 'Viewer';
}

function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.Viewer;
}

function requirePermission(permission) {
  return (req, res, next) => {
    const role = req.auth?.role || 'Viewer';
    const permissions = getPermissionsForRole(role);
    if (!permissions.includes(permission)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions.' });
    }
    next();
  };
}

module.exports = {
  ROLE_PERMISSIONS,
  getRoleFromClaims,
  getPermissionsForRole,
  requirePermission
};
