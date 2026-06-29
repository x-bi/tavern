import { Injectable } from '@nestjs/common';
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const ALGORITHM = 'pbkdf2_sha256';
const ITERATIONS = 120_000;
const KEY_LENGTH = 32;

@Injectable()
export class PasswordService {
  hashPassword(password: string): string {
    const salt = randomBytes(16).toString('base64url');
    const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256').toString(
      'base64url'
    );

    return `${ALGORITHM}$${ITERATIONS}$${salt}$${hash}`;
  }

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
