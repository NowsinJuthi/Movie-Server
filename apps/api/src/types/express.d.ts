import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    cookies: Record<string, string>;
    user?: import('../auth/auth.types').RequestUser;
    entitlement?: import('@movie-server/shared').SubscriptionEntitlement;
  }
}
