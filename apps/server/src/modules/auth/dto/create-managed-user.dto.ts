import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateManagedUserDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,64}$/)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  displayName!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(256)
  password!: string;

  @IsIn(['admin', 'member'])
  role!: 'admin' | 'member';
}
