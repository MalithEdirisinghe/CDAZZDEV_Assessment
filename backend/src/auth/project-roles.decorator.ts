import { SetMetadata } from '@nestjs/common';
import { MemberRole } from '@prisma/client';

export const PROJECT_ROLES_KEY = 'projectRoles';
export const ProjectRoles = (...roles: MemberRole[]) => SetMetadata(PROJECT_ROLES_KEY, roles);
