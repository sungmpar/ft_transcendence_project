import { ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { oauth42Configured } from './auth-configuration';

@Injectable()
export class FtAuthGuard extends AuthGuard('42') {
  canActivate(context: ExecutionContext) {
    if (!oauth42Configured()) {
      throw new ServiceUnavailableException('42 login is not configured for this deployment');
    }
    return super.canActivate(context);
  }
}
