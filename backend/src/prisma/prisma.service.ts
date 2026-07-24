import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

// El driver "mariadb" no acepta cadenas con esquema "mysql://" (solo "mariadb://"),
// por lo que DATABASE_URL (formato estándar mysql://) se parsea a un objeto de configuración.
function buildAdapter(): PrismaMariaDb {
  const dbUrl = new URL(process.env.DATABASE_URL as string);
  return new PrismaMariaDb({
    host: dbUrl.hostname,
    port: Number(dbUrl.port || 3306),
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    database: dbUrl.pathname.replace(/^\//, ''),
    connectTimeout: 10000,
    // MySQL 8 usa caching_sha2_password por defecto; sin esto, el driver no puede
    // obtener la clave RSA del servidor en una conexión sin TLS (local/dev).
    allowPublicKeyRetrieval: true,
  });
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: buildAdapter() });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
