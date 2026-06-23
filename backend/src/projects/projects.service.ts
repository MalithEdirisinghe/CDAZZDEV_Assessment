import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UserRole, MemberRole } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, userRole: UserRole) {
    // Admins can see all projects
    if (userRole === UserRole.ADMIN) {
      return this.prisma.project.findMany({
        include: {
          owner: {
            select: { id: true, email: true, name: true },
          },
          members: {
            include: {
              user: {
                select: { id: true, email: true, name: true },
              },
            },
          },
        },
      });
    }

    // Managers/Members can only see projects they belong to (either as owner or project member)
    return this.prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            members: {
              some: { userId },
            },
          },
        ],
      },
      include: {
        owner: {
          select: { id: true, email: true, name: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
    });
  }

  async create(userId: string, dto: CreateProjectDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create the project
      const project = await tx.project.create({
        data: {
          name: dto.name,
          description: dto.description,
          ownerId: userId,
        },
      });

      // 2. Automatically add the owner as a Project MANAGER member
      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: userId,
          role: MemberRole.MANAGER,
        },
      });

      return project;
    });
  }
}
