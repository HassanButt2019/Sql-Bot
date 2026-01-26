function requireOrgScope(req) {
  const orgId = req.auth?.tenant?.orgId;
  if (!orgId) {
    throw new Error('Tenant context required');
  }
  return orgId;
}

function withOrgId(data, orgId) {
  return { ...data, org_id: orgId };
}

function assertSameOrg(entityOrgId, req) {
  const orgId = requireOrgScope(req);
  if (String(entityOrgId) !== String(orgId)) {
    throw new Error('Cross-tenant access blocked');
  }
}

module.exports = {
  requireOrgScope,
  withOrgId,
  assertSameOrg
};
