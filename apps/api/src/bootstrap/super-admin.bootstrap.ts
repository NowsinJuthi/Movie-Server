import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@movie-server/shared';
import { UsersService } from '../users/users.service';

@Injectable()
export class SuperAdminBootstrap implements OnModuleInit {
  private readonly logger = new Logger(SuperAdminBootstrap.name);

  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get('NODE_ENV') === 'test') {
      return;
    }

    const email = this.config.get<string>('BOOTSTRAP_SUPERADMIN_EMAIL');
    const password = this.config.get<string>('BOOTSTRAP_SUPERADMIN_PASSWORD');
    if (!email || !password) {
      return;
    }

    const existing = await this.users.countByRole(UserRole.SuperAdmin);
    if (existing > 0) {
      return;
    }

    const current = await this.users.findByEmail(email);
    if (current) {
      current.role = UserRole.SuperAdmin;
      current.emailVerified = true;
      await current.save();
      this.logger.warn(`Promoted ${email} to Super Admin`);
      return;
    }

    await this.users.createUser({
      email,
      password,
      displayName: 'Super Admin',
      role: UserRole.SuperAdmin,
      emailVerified: true,
    });
    this.logger.warn(`Created bootstrap Super Admin ${email}`);
  }
}
