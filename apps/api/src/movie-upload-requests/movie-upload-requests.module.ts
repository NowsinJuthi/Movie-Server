import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProfilesModule } from '../profiles/profiles.module';
import { UsersModule } from '../users/users.module';
import {
  MovieUploadRequest,
  MovieUploadRequestSchema,
} from './schemas/movie-upload-request.schema';
import { MovieUploadRequestsService } from './movie-upload-requests.service';
import { MovieUploadRequestsController } from './movie-upload-requests.controller';
import { AdminMovieUploadRequestsController } from './admin-movie-upload-requests.controller';

@Module({
  imports: [
    UsersModule,
    ProfilesModule,
    MongooseModule.forFeature([
      { name: MovieUploadRequest.name, schema: MovieUploadRequestSchema },
    ]),
  ],
  controllers: [MovieUploadRequestsController, AdminMovieUploadRequestsController],
  providers: [MovieUploadRequestsService],
  exports: [MovieUploadRequestsService],
})
export class MovieUploadRequestsModule {}
