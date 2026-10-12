export interface AuthUser {
  id: string;
  orgId: string;
  name: string;
  permissions: string[];
  /** null entry = access to all branches */
  branchIds: string[] | 'ALL';
}

export interface JwtPayload {
  sub: string;
  org: string;
}
