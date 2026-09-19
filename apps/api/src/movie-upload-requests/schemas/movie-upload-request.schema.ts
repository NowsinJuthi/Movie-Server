import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MovieUploadRequestStatus } from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'movie_upload_requests',
})
export class MovieUploadRequest {
  @Prop({ required: true, trim: true, maxlength: 200 })
  title!: string;

  @Prop({ type: Number, default: null })
  year?: number | null;

  @Prop({ type: String, default: null, maxlength: 2000 })
  note?: string | null;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 320 })
  userEmail!: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  userDisplayName!: string;

  @Prop({ type: Types.ObjectId, default: null })
  profileId?: Types.ObjectId | null;

  @Prop({ type: String, default: null, maxlength: 80 })
  profileName?: string | null;

  @Prop({
    type: String,
    enum: Object.values(MovieUploadRequestStatus),
    default: MovieUploadRequestStatus.Pending,
    index: true,
  })
  status!: MovieUploadRequestStatus;

  @Prop({ type: String, default: null, maxlength: 2000 })
  adminNote?: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type MovieUploadRequestDocument = HydratedDocument<MovieUploadRequest>;
export const MovieUploadRequestSchema = SchemaFactory.createForClass(MovieUploadRequest);

MovieUploadRequestSchema.index({ createdAt: -1 });
