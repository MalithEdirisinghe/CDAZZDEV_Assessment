import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ProjectRoles } from '../auth/project-roles.decorator';
import { MemberRole } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Get('projects/:id/tasks')
  @ApiOperation({ summary: 'Get tasks for a project with filtering, sorting, and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of project tasks.' })
  findProjectTasks(@Param('id') projectId: string, @Query() query: QueryTaskDto) {
    return this.tasksService.findProjectTasks(projectId, query);
  }

  @Post('projects/:id/tasks')
  @ProjectRoles(MemberRole.MANAGER)
  @ApiOperation({ summary: 'Create a new task in a project (Project Manager / Admin only)' })
  @ApiResponse({ status: 201, description: 'Task successfully created.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  createTask(@Param('id') projectId: string, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(projectId, dto);
  }

  @Patch('tasks/:id')
  @ProjectRoles(MemberRole.MANAGER) // RolesGuard allows assignee or manager or admin
  @ApiOperation({ summary: 'Update an existing task (Assignee, Project Manager, or Admin only)' })
  @ApiResponse({ status: 200, description: 'Task successfully updated.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  updateTask(@Param('id') taskId: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(taskId, dto);
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Get details of a single task, including assignee and comment thread' })
  @ApiResponse({ status: 200, description: 'Task details with assignee and comments.' })
  @ApiResponse({ status: 404, description: 'Task not found.' })
  findOne(@Param('id') taskId: string) {
    return this.tasksService.findOne(taskId);
  }
}
