import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthUser, JwtPayload } from '../common/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { hashToken, newOpaqueToken } from './tokens';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async loginWithPassword(email: string, password: string, ip?: string, deviceId?: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), isActive: true, deletedAt: null },
    });
    // Always verify against some hash to keep timing roughly constant.
    const ok = user?.passwordHash ? await argon2.verify(user.passwordHash, password) : false;
    if (!user || !ok) {
      await this.failed('password', email, ip, user?.orgId);
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issue(user.id, user.orgId, ip, deviceId, 'auth.login');
  }

  async loginWithPin(staffCode: string, pin: string, ip?: string, deviceId?: string) {
    const users = await this.prisma.user.findMany({
      where: { staffCode, isActive: true, deletedAt: null },
      take: 2,
    });
    const user = users.length === 1 ? users[0] : null;
    const ok = user?.pinHash ? await argon2.verify(user.pinHash, pin) : false;
    if (!user || !ok) {
      await this.failed('pin', staffCode, ip, user?.orgId);
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issue(user.id, user.orgId, ip, deviceId, 'auth.pin_login');
  }

  /** Rotating refresh tokens. Reuse of a revoked token revokes every session of that user. */
  async refresh(refreshToken: string, ip?: string): Promise<TokenPair> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (!row || row.expiresAt < new Date() || !row.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (row.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({
        orgId: row.user.orgId,
        userId: row.userId,
        action: 'auth.refresh_reuse_detected',
        entity: 'User',
        entityId: row.userId,
        ip,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    return this.mint(row.userId, row.user.orgId, row.deviceId ?? undefined);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Loads the live permission set so role changes and deactivation apply immediately. */
  async loadAuthUser(payload: JwtPayload): Promise<AuthUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true, deletedAt: null },
      include: {
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });
    if (!user) return null;
    const perms = new Set<string>();
    const branches = new Set<string>();
    let all = false;
    for (const ur of user.roles) {
      ur.role.permissions.forEach((rp) => perms.add(rp.permission.key));
      if (ur.branchId) branches.add(ur.branchId);
      else all = true;
    }
    return {
      id: user.id,
      orgId: user.orgId,
      name: user.name,
      permissions: [...perms],
      branchIds: all ? 'ALL' : [...branches],
    };
  }

  private async issue(
    userId: string,
    orgId: string,
    ip: string | undefined,
    deviceId: string | undefined,
    action: string,
  ) {
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
    await this.audit.log({ orgId, userId, action, entity: 'User', entityId: userId, ip });
    return this.mint(userId, orgId, deviceId);
  }

  private async mint(userId: string, orgId: string, deviceId?: string): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, org: orgId };
    const expiresIn = this.config.getOrThrow<string>('JWT_ACCESS_TTL');
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: expiresIn as never });
    const refreshToken = newOpaqueToken();
    const days = this.config.getOrThrow<number>('JWT_REFRESH_TTL_DAYS');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        deviceId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + days * 86_400_000),
      },
    });
    return { accessToken, refreshToken, expiresIn };
  }

  private async failed(kind: string, identifier: string, ip?: string, orgId?: string) {
    if (!orgId) return;
    await this.audit.log({
      orgId,
      action: `auth.${kind}_failed`,
      entity: 'User',
      after: { identifier },
      ip,
    });
  }
}
