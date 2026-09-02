import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { db } from "./db";

@Injectable()
export class PrismaService implements OnModuleDestroy{
  onModuleDestroy() {
    db.close();
  }
  
}
