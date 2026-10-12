import { Injectable } from '@nestjs/common';
import { AuditActor, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  orgId: string;
  branchId?: string | null;
  userId?: string | null;
  actor?: AuditActor;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(e: AuditEntry) {
    await this.prisma.auditLog.create({
      data: {
        orgId: e.orgId,
        branchId: e.branchId ?? null,
        userId: e.userId ?? null,
        actor: e.actor ?? AuditActor.USER,
        action: e.action,
        entity: e.entity,
        entityId: e.entityId ?? null,
        before: (e.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (e.after ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: e.ip ?? null,
      },
    });
  }
}
