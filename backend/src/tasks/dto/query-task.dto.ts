import { IsOptional, IsEnum, IsString, IsInt, Min } from 'class-validator';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QueryTaskDto {
  @ApiProperty({ enum: TaskStatus, required: false, description: 'Filter tasks by status' })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiProperty({ enum: TaskPriority, required: false, description: 'Filter tasks by priority' })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiProperty({ required: false, description: 'Filter tasks by assignee User ID' })
  @IsString()
  @IsOptional()
  assigneeId?: string;

  @ApiProperty({ required: false, default: 1, description: 'Page number for pagination' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ required: false, default: 10, description: 'Number of items per page' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @ApiProperty({ enum: ['dueDate', 'priority'], required: false, default: 'dueDate', description: 'Field to sort by' })
  @IsString()
  @IsOptional()
  sortBy?: 'dueDate' | 'priority' = 'dueDate';

  @ApiProperty({ enum: ['asc', 'desc'], required: false, default: 'asc', description: 'Order of sorting' })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'asc';
}
