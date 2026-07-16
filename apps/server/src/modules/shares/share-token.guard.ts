import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { SharesService } from './shares.service';
import type { ShareRequest } from './share.types';

@Injectable()
export class ShareTokenGuard implements CanActivate {
  constructor(@Inject(SharesService) private readonly shares: SharesService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ShareRequest>();
    const token = request.params.token ?? '';
    request.shareContext = await this.shares.resolvePublicToken(token, request.ip);
    return true;
  }
}
