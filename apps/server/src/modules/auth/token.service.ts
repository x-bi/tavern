import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type AuthTokenPayload = {
  sub: string;
  username: string;
  mode: 'single_user';
  exp: number;
};

@Injectable()
export class TokenService {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService
  ) {}

  sign(payload: Omit<AuthTokenPayload, 'exp'>): { accessToken: string; expiresAt: Date } {
    const ttlSeconds = this.getTtlSeconds();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const fullPayload: AuthTokenPayload = {
      ...payload,
      exp: Math.floor(expiresAt.getTime() / 1000)
    };
    const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const signature = this.signBody(body);

    return {
      accessToken: `${body}.${signature}`,
      expiresAt
    };
  }

  verify(token: string): AuthTokenPayload {
    const [body, signature] = token.split('.');

    if (!body || !signature || !this.isValidSignature(body, signature)) {
      throw new UnauthorizedException('Invalid auth token.');
    }

    let payload: AuthTokenPayload;

    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AuthTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid auth token.');
    }
    const now = Math.floor(Date.now() / 1000);

    if (!payload.sub || payload.mode !== 'single_user' || payload.exp <= now) {
      throw new UnauthorizedException('Invalid or expired auth token.');
    }

    return payload;
  }

  private signBody(body: string): string {
    return createHmac('sha256', this.getSecret()).update(body).digest('base64url');
  }

  private isValidSignature(body: string, signature: string): boolean {
    const expected = Buffer.from(this.signBody(body), 'base64url');
    const actual = Buffer.from(signature, 'base64url');

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private getSecret(): string {
    return this.configService.get<string>('AUTH_TOKEN_SECRET') ?? 'dev-only-change-me';
  }

  private getTtlSeconds(): number {
    return Number(this.configService.get<string>('AUTH_TOKEN_TTL_SECONDS') ?? 604800);
  }
}
