import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ example: 'I will finish this task by tomorrow evening.', description: 'The text content of the comment' })
  @IsString()
  @IsNotEmpty()
  body: string;
}
