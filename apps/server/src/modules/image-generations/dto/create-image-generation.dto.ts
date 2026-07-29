import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateImageGenerationDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  requestId!: string;
}
