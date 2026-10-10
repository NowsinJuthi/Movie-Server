import { BadRequestException, Injectable } from '@nestjs/common';
import {
  extractEmailDomain,
  normalizeEmailDomainList,
  type EmailDomainPolicy,
  type PublicRegistrationEmailPolicy,
} from '@movie-server/shared';
import { SiteSettingsService } from './site-settings.service';

const REGISTRATION_DOMAIN_MESSAGE =
  'Registration is not allowed for this email domain.';

@Injectable()
export class EmailDomainPolicyService {
  constructor(private readonly settings: SiteSettingsService) {}

  async assertRegistrationAllowed(email: string): Promise<void> {
    const policy = await this.settings.getEmailDomainPolicy();
    const domain = extractEmailDomain(email);
    if (!domain) {
      throw new BadRequestException('Invalid email address');
    }

    const allowSet = new Set(policy.allowlist);
    const blockSet = new Set(policy.blocklist);

    if (blockSet.has(domain)) {
      throw new BadRequestException(REGISTRATION_DOMAIN_MESSAGE);
    }
    if (policy.allowlist.length > 0 && !allowSet.has(domain)) {
      throw new BadRequestException(REGISTRATION_DOMAIN_MESSAGE);
    }
  }

  async getPublicRegistrationPolicy(): Promise<PublicRegistrationEmailPolicy> {
    const policy = await this.settings.getEmailDomainPolicy();
    if (policy.allowlist.length === 0) {
      return { allowlistEnabled: false };
    }
    return {
      allowlistEnabled: true,
      allowedDomains: [...policy.allowlist],
    };
  }

  static toResponse(policy: EmailDomainPolicy) {
    return {
      allowlist: policy.allowlist,
      blocklist: policy.blocklist,
      allowlistEnabled: policy.allowlist.length > 0,
    };
  }
}

export { normalizeEmailDomainList };
