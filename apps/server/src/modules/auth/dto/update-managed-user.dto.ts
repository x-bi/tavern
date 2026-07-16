import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateManagedUserDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,64}$/)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(256)
  password?: string;

  @IsOptional()
  @IsIn(['admin', 'member'])
  role?: 'admin' | 'member';
}
