function normalizeOrgIds(payload = {}) {
  const direct = payload.org_id || payload.tenant_id;
  const list = payload.org_ids || payload.orgs || payload.organizations || payload.tenants;
  const orgIds = new Set();
  if (direct) orgIds.add(String(direct));
  if (Array.isArray(list)) {
    list.forEach((id) => {
      if (id) orgIds.add(String(id));
    });
  }
  return Array.from(orgIds);
}

function resolveTenant(req, payload) {
  const headerOrg = req.header('x-org-id') || req.header('x-tenant-id');
  const orgIds = normalizeOrgIds(payload);
  if (headerOrg) {
    if (!orgIds.includes(String(headerOrg))) {
      throw new Error('Org header does not match token membership');
    }
    return { orgId: String(headerOrg), orgIds };
  }
  if (orgIds.length === 1) {
    return { orgId: orgIds[0], orgIds };
  }
  if (payload.org_id || payload.tenant_id) {
    return { orgId: String(payload.org_id || payload.tenant_id), orgIds };
  }
  throw new Error('Unable to resolve tenant context');
}

module.exports = {
  resolveTenant,
  normalizeOrgIds
};
