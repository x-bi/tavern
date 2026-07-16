import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token 载荷（即 token 内编码的用户信息）。
 * @property sub 用户 ID（subject）；
 * @property username 用户名；
 * @property mode 认证模式，当前固定 `single_user`；
 * @property exp 过期时间戳（秒级 Unix 时间戳，sign 时写入）。
 */
export type AuthTokenPayload = {
  sub: string;
  username: string;
  mode: 'preset_users';
  exp: number;
};

/**
 * Token 签发与校验服务。
 *
 * 注意：这里不是标准 JWT，而是自定义的 `base64url(payload).HMAC-SHA256(payload)` 格式。
 * 签名密钥来自环境变量 AUTH_TOKEN_SECRET；校验时用 `timingSafeEqual` 做常数时间比较，
 * 防止签名比对被计时侧信道攻击。
 *
 * 相关配置：
 * - AUTH_TOKEN_SECRET：HMAC 密钥，未配置时回退到 `dev-only-change-me`（仅限开发）；
 * - AUTH_TOKEN_TTL_SECONDS：token 有效期（秒），未配置时回退到 604800（7 天）。
 */
@Injectable()
export class TokenService {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService
  ) {}

  /**
   * 签发 token：编码载荷并生成 HMAC 签名。
   * @param payload 载荷，不含 exp（过期时间由本方法按 TTL 自动计算并写入）。
   * @returns `{ accessToken, expiresAt }`：
   *   - accessToken：`base64url(payload).base64url(signature)` 格式的字符串；
   *   - expiresAt：过期时间（Date 对象，供调用方转 ISO 字符串返回给前端）。
   */
  sign(payload: Omit<AuthTokenPayload, 'exp'>): { accessToken: string; expiresAt: Date } {
    const ttlSeconds = this.getTtlSeconds();
    // 过期时间 = 当前时间 + TTL（注意 Date 构造的毫秒，TTL 是秒，要 ×1000）
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    // 拼装完整载荷：调用方传的 sub/username/mode + 自动计算的 exp（秒级时间戳）
    const fullPayload: AuthTokenPayload = {
      ...payload,
      exp: Math.floor(expiresAt.getTime() / 1000)
    };
    // body = payload 的 base64url，作为 token 的明文部分 + 待签名内容
    const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    // 用密钥对 body 做 HMAC-SHA256 得到签名
    const signature = this.signBody(body);

    return {
      accessToken: `${body}.${signature}`,
      expiresAt
    };
  }

  /**
   * 校验 token：验签 + 解码 + 校验过期与关键字段。
   * @param token 待校验的 token 字符串（`body.signature` 格式）。
   * @returns 解码后的载荷 AuthTokenPayload。
   * @throws UnauthorizedException 以下任一情况抛出（→ 401）：
   *   - 格式不合法（缺 body 或 signature）；
   *   - 签名不匹配；
   *   - payload 不是合法 JSON；
   *   - 缺少 sub、mode 不是 single_user、或已过期（exp <= 当前时间）。
   */
  verify(token: string): AuthTokenPayload {
    // token 格式为 "body.signature"，按 . 拆出两部分
    const [body, signature] = token.split('.');

    // 任一缺失或签名不匹配 → 视为伪造/损坏的 token
    if (!body || !signature || !this.isValidSignature(body, signature)) {
      throw new UnauthorizedException('Invalid auth token.');
    }

    let payload: AuthTokenPayload;

    // 解码 body 为 JSON；解析失败说明 body 不是合法的 base64url JSON
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AuthTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid auth token.');
    }
    // 当前时间（秒级，与 exp 单位对齐）
    const now = Math.floor(Date.now() / 1000);

    // 校验关键字段：sub 必须存在、mode 必须是 single_user、且未过期
    if (!payload.sub || payload.mode !== 'preset_users' || payload.exp <= now) {
      throw new UnauthorizedException('Invalid or expired auth token.');
    }

    return payload;
  }

  /**
   * 用密钥对 body 做 HMAC-SHA256 并返回 base64url 签名。
   * @param body 已 base64url 编码的载荷字符串。
   * @returns base64url 编码的签名。
   */
  private signBody(body: string): string {
    return createHmac('sha256', this.getSecret()).update(body).digest('base64url');
  }

  /**
   * 校验签名是否匹配（常数时间比较，防侧信道）。
   * @param body 载荷部分（base64url）。
   * @param signature 待校验的签名（base64url）。
   * @returns 长度一致且内容匹配返回 `true`，否则 `false`。
   */
  private isValidSignature(body: string, signature: string): boolean {
    const expected = Buffer.from(this.signBody(body), 'base64url');
    const actual = Buffer.from(signature, 'base64url');

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  /**
   * 读取 HMAC 密钥。
   * @returns AUTH_TOKEN_SECRET 的值；未配置时回退到 `dev-only-change-me`（仅开发用）。
   */
  private getSecret(): string {
    return this.configService.get<string>('AUTH_TOKEN_SECRET') ?? 'dev-only-change-me';
  }

  /**
   * 读取 token 有效期（秒）。
   * @returns AUTH_TOKEN_TTL_SECONDS 的数值；未配置时回退到 604800（7 天）。
   */
  private getTtlSeconds(): number {
    return Number(this.configService.get<string>('AUTH_TOKEN_TTL_SECONDS') ?? 604800);
  }
}
