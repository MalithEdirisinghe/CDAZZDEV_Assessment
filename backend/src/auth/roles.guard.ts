import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES_KEY } from './roles.decorator';
import { PROJECT_ROLES_KEY } from './project-roles.decorator';
import { UserRole, MemberRole } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredProjectRoles = this.reflector.getAllAndOverride<MemberRole[]>(PROJECT_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are required, allow access
    if (!requiredRoles && !requiredProjectRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // 1. Global Admin bypasses all checks
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // 2. Check global roles
    if (requiredRoles && requiredRoles.length > 0) {
      const hasGlobalRole = requiredRoles.includes(user.role);
      if (hasGlobalRole) {
        return true;
      }
    }

    // 3. Check project-level roles & assignee rights
    if (requiredProjectRoles && requiredProjectRoles.length > 0) {
      let projectId = request.params.projectId;

      const isTaskRoute = (request.url || '').includes('/tasks/');
      const taskId = isTaskRoute ? request.params.id : null;

      if (isTaskRoute && taskId) {
        const task = await this.prisma.task.findUnique({
          where: { id: taskId },
          select: { projectId: true, assigneeId: true },
        });
        if (task) {
          projectId = task.projectId;

          // Check if updates are restricted to the task's assignee
          // The assignee can bypass project manager check if they are the assignee.
          if (task.assigneeId === user.id) {
            return true;
          }
        }
      } else if (!projectId) {
        projectId = request.params.id;
      }

      if (!projectId) {
        return false;
      }

      // Check if user is a member of the project
      const membership = await this.prisma.projectMember.findFirst({
        where: {
          projectId,
          userId: user.id,
        },
      });

      if (!membership) {
        return false;
      }

      const hasProjectRole = requiredProjectRoles.includes(membership.role);
      if (hasProjectRole) {
        return true;
      }
    }

    return false;
  }
}
