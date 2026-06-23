import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({ example: 'refresh-token-uuid-or-jwt' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
