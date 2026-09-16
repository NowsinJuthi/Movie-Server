import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ErrorCode } from '@movie-server/shared';
import { MongoServerError } from 'mongodb';
import { Request, Response } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const mapped = this.mapException(exception);
    const requestId = request.header('x-request-id');

    if (mapped.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${mapped.statusCode}${requestId ? ` [${requestId}]` : ''}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(mapped.statusCode).json({
      statusCode: mapped.statusCode,
      error: mapped.error,
      message: mapped.message,
      ...(mapped.statusCode < 500 && mapped.details !== undefined ? { details: mapped.details } : {}),
      ...(requestId ? { requestId } : {}),
    });
  }

  private mapException(exception: unknown): {
    statusCode: number;
    error: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof ThrottlerException) {
      return {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: ErrorCode.TooManyRequests,
        message: 'Too many requests. Please try again later.',
      };
    }

    if (exception instanceof TokenExpiredError) {
      return {
        statusCode: HttpStatus.UNAUTHORIZED,
        error: ErrorCode.TokenExpired,
        message: 'Access token has expired.',
      };
    }

    if (exception instanceof JsonWebTokenError) {
      return {
        statusCode: HttpStatus.UNAUTHORIZED,
        error: ErrorCode.InvalidToken,
        message: 'Invalid access token.',
      };
    }

    if (this.isMongoDuplicate(exception)) {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: ErrorCode.Conflict,
        message: 'A record with that value already exists.',
      };
    }

    if (
      exception instanceof Error &&
      /request aborted|aborted/i.test(exception.message)
    ) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: ErrorCode.ValidationFailed,
        message:
          'Upload was interrupted before the file finished sending. Keep this page open and try again.',
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : Array.isArray((payload as { message?: unknown }).message)
            ? ((payload as { message: string[] }).message)[0]
            : String((payload as { message?: string }).message ?? exception.message);
      const details =
        typeof payload === 'object' && payload
          ? (payload as { details?: unknown }).details
          : undefined;

      return {
        statusCode: status,
        error: this.errorFromStatus(status, payload),
        message,
        details,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: ErrorCode.Internal,
      message: 'An unexpected error occurred.',
    };
  }

  private errorFromStatus(status: number, payload: unknown): string {
    if (
      typeof payload === 'object' &&
      payload &&
      'error' in payload &&
      typeof (payload as { error: unknown }).error === 'string' &&
      (payload as { error: string }).error === (payload as { error: string }).error.toUpperCase()
    ) {
      const candidate = (payload as { error: string }).error;
      if (candidate.includes('_')) {
        return candidate;
      }
    }

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.ValidationFailed;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.Unauthorized;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.Forbidden;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NotFound;
      case HttpStatus.CONFLICT:
        return ErrorCode.Conflict;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.TooManyRequests;
      default:
        return ErrorCode.Internal;
    }
  }

  private isMongoDuplicate(exception: unknown): boolean {
    return (
      (exception instanceof MongoServerError && exception.code === 11000) ||
      (typeof exception === 'object' &&
        exception !== null &&
        'code' in exception &&
        (exception as { code: number }).code === 11000)
    );
  }
}
