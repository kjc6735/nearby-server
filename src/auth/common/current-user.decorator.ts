import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthPayload } from './auth.payload';


export const CurrentUser = createParamDecorator(
  (data: keyof AuthPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);