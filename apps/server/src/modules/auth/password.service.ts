import { Injectable } from '@nestjs/common';
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const ALGORITHM = 'pbkdf2_sha256';
const ITERATIONS = 120_000;
const KEY_LENGTH = 32;

/**
 * 密码哈希与校验服务。
 *
 * 使用 PBKDF2 + SHA-256，存储格式为：
 * `pbkdf2_sha256$<迭代次数>$<salt>$<hash>`，salt/hash 均为 base64url。
 * 校验时用 `timingSafeEqual` 做常数时间比较，避免计时侧信道攻击。
 */
@Injectable()
export class PasswordService {
  /**
   * 对明文密码生成带 salt 的哈希字符串。
   * @param password 明文密码。
   * @returns 形如 `pbkdf2_sha256$120000$<salt>$<hash>` 的字符串，可直接入库存储。
   */
  hashPassword(password: string): string {
    const salt = randomBytes(16).toString('base64url');
    const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256').toString(
      'base64url'
    );

    return `${ALGORITHM}$${ITERATIONS}$${salt}$${hash}`;
  }

  /**
   * 校验明文密码是否与已存储的哈希匹配。
   * @param password 待校验的明文密码。
   * @param storedHash 已存储的哈希字符串；为 `null`（用户未设密码）时直接返回 `false`。
   * @returns 匹配返回 `true`，否则 `false`。存储格式非法也返回 `false`（不抛错）。
   */
  verifyPassword(password: string, storedHash: string | null): boolean {
    if (!storedHash) {
      return false;
    }

    const [algorithm, iterationsValue, salt, expectedHash] = storedHash.split('$');
    const iterations = Number(iterationsValue);

    if (
      algorithm !== ALGORITHM ||
      !Number.isInteger(iterations) ||
      iterations < 1 ||
      !salt ||
      !expectedHash
    ) {
      return false;
    }

    const actual = pbkdf2Sync(password, salt, iterations, KEY_LENGTH, 'sha256');
    const expected = Buffer.from(expectedHash, 'base64url');

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
