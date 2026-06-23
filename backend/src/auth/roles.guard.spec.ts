import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionContext } from '@nestjs/common';
import { UserRole, MemberRole } from '@prisma/client';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let prisma: PrismaService;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const mockPrismaService = {
    projectMember: {
      findFirst: jest.fn(),
    },
    task: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockContext = (request: any): ExecutionContext => {
    return {
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => jest.fn(),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access if no roles or project roles are defined', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined); // neither global nor project

    const context = createMockContext({
      user: { id: 'u1', role: UserRole.MEMBER },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow global ADMIN to bypass all role checks', async () => {
    mockReflector.getAllAndOverride
      .mockReturnValueOnce([UserRole.MANAGER]) // global required
      .mockReturnValueOnce([MemberRole.MANAGER]); // project required

    const context = createMockContext({
      user: { id: 'u1', role: UserRole.ADMIN },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow user with matching global role', async () => {
    mockReflector.getAllAndOverride
      .mockReturnValueOnce([UserRole.MANAGER]) // global required
      .mockReturnValueOnce(undefined); // project required

    const context = createMockContext({
      user: { id: 'u1', role: UserRole.MANAGER },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny user without matching global role', async () => {
    mockReflector.getAllAndOverride
      .mockReturnValueOnce([UserRole.MANAGER]) // global required
      .mockReturnValueOnce(undefined); // project required

    const context = createMockContext({
      user: { id: 'u1', role: UserRole.MEMBER },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });

  describe('Project role checks', () => {
    it('should allow if user has matching project role', async () => {
      mockReflector.getAllAndOverride
        .mockReturnValueOnce(undefined) // global required
        .mockReturnValueOnce([MemberRole.MANAGER]); // project required

      mockPrismaService.projectMember.findFirst.mockResolvedValue({
        id: 'pm-1',
        projectId: 'p-1',
        userId: 'u-member',
        role: MemberRole.MANAGER,
      });

      const context = createMockContext({
        params: { id: 'p-1' },
        user: { id: 'u-member', role: UserRole.MEMBER },
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(mockPrismaService.projectMember.findFirst).toHaveBeenCalledWith({
        where: { projectId: 'p-1', userId: 'u-member' },
      });
    });

    it('should deny if user does not have matching project role', async () => {
      mockReflector.getAllAndOverride
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce([MemberRole.MANAGER]);

      mockPrismaService.projectMember.findFirst.mockResolvedValue({
        id: 'pm-1',
        projectId: 'p-1',
        userId: 'u-member',
        role: MemberRole.MEMBER, // not MANAGER
      });

      const context = createMockContext({
        params: { id: 'p-1' },
        user: { id: 'u-member', role: UserRole.MEMBER },
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(false);
    });

    it('should allow task updates if user is the task assignee', async () => {
      mockReflector.getAllAndOverride
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce([MemberRole.MANAGER]); // requires MANAGER for update

      mockPrismaService.task.findUnique.mockResolvedValue({
        id: 't-1',
        projectId: 'p-1',
        assigneeId: 'u-assignee',
      });

      const context = createMockContext({
        url: '/tasks/t-1',
        params: { id: 't-1' },
        user: { id: 'u-assignee', role: UserRole.MEMBER },
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true); // Assignee allowed even if not project manager
    });
  });
});
