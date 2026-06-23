import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'Alpha Project', description: 'The name of the project' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'The core development project for TeamSync.', required: false, description: 'Optional description' })
  @IsString()
  @IsOptional()
  description?: string;
}
