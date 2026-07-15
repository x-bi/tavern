import { IsString, MaxLength } from 'class-validator';
export class UpdateCompanionMessageDto {
  @IsString() @MaxLength(12000) content!: string;
}
