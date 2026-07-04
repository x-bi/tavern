import { IsBoolean, IsString, MaxLength } from 'class-validator';

/** 导入备份入参。confirmOverwrite 必须为 true 才执行（全量覆盖，需显式确认）。 */
export class ImportBackupDto {
  /** 备份 JSON 文本，最长 1000 万字符。 */
  @IsString()
  @MaxLength(10_000_000)
  rawJson!: string;

  /** 是否确认全量覆盖当前用户数据；必须传 true。 */
  @IsBoolean()
  confirmOverwrite!: boolean;
}
