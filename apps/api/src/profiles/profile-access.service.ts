import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ErrorCode } from '@movie-server/shared';
import { Profile, ProfileDocument } from './schemas/profile.schema';

@Injectable()
export class ProfileAccessService {
  constructor(
    @InjectModel(Profile.name) private readonly profileModel: Model<ProfileDocument>,
  ) {}

  ownedQuery(userId: string, profileId: string) {
    return {
      _id: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
    };
  }

  async getOwned(userId: string, profileId: string, withPin = false): Promise<ProfileDocument> {
    const query = this.profileModel.findOne(this.ownedQuery(userId, profileId));
    if (withPin) {
      query.select('+pinHash');
    }
    const profile = await query.exec();
    if (!profile) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'Profile not found.',
      });
    }
    return profile;
  }
}
