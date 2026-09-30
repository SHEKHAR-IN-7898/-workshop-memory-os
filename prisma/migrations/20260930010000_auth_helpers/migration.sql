DROP FUNCTION IF EXISTS public.get_user_memberships(UUID);

CREATE FUNCTION public.get_user_memberships(p_user_id UUID)
RETURNS TABLE(tenant_id UUID, tenant_name TEXT, tenant_slug TEXT, role "MembershipRole")
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT m."tenantId", t."name", t."slug", m."role"
  FROM public."Membership" m
  JOIN public."Tenant" t ON t."id" = m."tenantId"
  WHERE m."userId" = p_user_id
    AND m."status" = 'ACTIVE'
    AND t."status" = 'ACTIVE'
  ORDER BY m."createdAt" ASC;
$$;

REVOKE ALL ON FUNCTION public.get_user_memberships(UUID) FROM PUBLIC;
