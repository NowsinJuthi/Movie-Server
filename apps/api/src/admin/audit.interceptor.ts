import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, concatMap, throwError } from 'rxjs';
import { Request, Response } from 'express';
import { RequestUser } from '../auth/auth.types';
import { AuditService } from './audit.service';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: RequestUser }>();
    const res = http.getResponse<Response>();
    const path = req.originalUrl || req.url || '';
    if (!MUTATING.has(req.method) || !path.includes('/admin')) {
      return next.handle();
    }
    return next.handle().pipe(
      concatMap(async (value) => {
        await this.write(req, res.statusCode || 200);
        return value;
      }),
      catchError((error: { status?: number; statusCode?: number }) => {
        void this.write(req, error.status ?? error.statusCode ?? 500);
        return throwError(() => error);
      }),
    );
  }

  private async write(req: Request & { user?: RequestUser }, statusCode: number): Promise<void> {
    const user = req.user;
    if (!user) return;
    try {
      await this.audit.record({
        actorUserId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        method: req.method,
        path: (req.originalUrl || req.url || '').split('?')[0],
        statusCode,
        ip: req.ip,
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '',
      });
    } catch {
      // Audit must never fail the original admin action.
    }
  }
}
