import { IsNotEmpty, IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({ example: 'Implement login page', description: 'The title of the task' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Create a responsive form with validation.', required: false, description: 'Optional description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: TaskStatus, required: false, default: TaskStatus.TODO, description: 'Current status' })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiProperty({ enum: TaskPriority, required: false, default: TaskPriority.MEDIUM, description: 'Priority level' })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiProperty({ example: 'uuid-of-user', required: false, description: 'User ID of assignee' })
  @IsString()
  @IsOptional()
  assigneeId?: string;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z', required: false, description: 'Due date timestamp' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
