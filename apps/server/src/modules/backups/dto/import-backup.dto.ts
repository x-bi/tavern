import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class ImportBackupDto {
  @IsString()
  @MaxLength(10_000_000)
  rawJson!: string;

  @IsBoolean()
  confirmOverwrite!: boolean;
}
