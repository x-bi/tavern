import { IsBoolean, IsString } from 'class-validator';

/** 导入备份入参。confirmOverwrite 必须为 true 才执行（全量覆盖，需显式确认）。 */
export class ImportBackupDto {
  /** 备份 JSON 文本；大小上限由 REQUEST_BODY_LIMIT 统一控制。 */
  @IsString()
  rawJson!: string;

  /** 是否确认全量覆盖当前用户数据；必须传 true。 */
  @IsBoolean()
  confirmOverwrite!: boolean;
}
