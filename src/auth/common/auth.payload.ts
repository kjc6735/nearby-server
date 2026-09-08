import { User } from "../../generated/prisma/client";

export type AuthPayload = {
  sub: User["id"];
  email: User["email"];
}