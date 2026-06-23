import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatus, TaskPriority } from '@prisma/client';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: PrismaService;

  const mockPrismaService = {
    task: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findProjectTasks', () => {
    it('should paginate and filter correctly with custom parameters', async () => {
      const projectId = 'proj-123';
      const query = {
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        assigneeId: 'user-456',
        page: 2,
        limit: 5,
        sortBy: 'dueDate' as const,
        sortOrder: 'desc' as const,
      };

      await service.findProjectTasks(projectId, query);

      // Verify that prisma.task.findMany was called with correct filter and pagination params
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith({
        where: {
          projectId,
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.HIGH,
          assigneeId: 'user-456',
        },
        orderBy: {
          dueDate: 'desc',
        },
        skip: 5, // (page 2 - 1) * limit 5 = 5
        take: 5,
        include: {
          assignee: {
            select: { id: true, email: true, name: true },
          },
        },
      });

      // Verify count query is matching same filter where criteria
      expect(mockPrismaService.task.count).toHaveBeenCalledWith({
        where: {
          projectId,
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.HIGH,
          assigneeId: 'user-456',
        },
      });
    });

    it('should apply defaults when page and limit are not specified', async () => {
      const projectId = 'proj-123';
      const query = {};

      await service.findProjectTasks(projectId, query);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith({
        where: { projectId },
        orderBy: {
          dueDate: 'asc',
        },
        skip: 0,
        take: 10,
        include: {
          assignee: {
            select: { id: true, email: true, name: true },
          },
        },
      });
    });
  });
});
