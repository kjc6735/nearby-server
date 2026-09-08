

import type { StringValue } from 'ms';

export type JwtConfig = {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessRoate: StringValue;
  refreshRotate: StringValue;
}