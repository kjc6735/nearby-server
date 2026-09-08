import type { AuthPayload } from '../auth/common/auth.payload';

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export { };

