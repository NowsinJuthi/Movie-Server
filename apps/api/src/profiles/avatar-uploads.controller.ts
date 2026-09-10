import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { isValidObjectId } from 'mongoose';
import { Public } from '../common/decorators/public.decorator';
import { AvatarsService } from './avatars.service';
import { ErrorCode } from '@movie-server/shared';

@Controller('uploads/avatars')
export class AvatarUploadsController {
  constructor(private readonly avatars: AvatarsService) {}

  @Public()
  @Get(':userId/:fileName')
  async get(
    @Param('userId') userId: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    if (!isValidObjectId(userId) || !/^[a-zA-Z0-9._-]+$/.test(fileName)) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Not found.' });
    }
    const fullPath = this.avatars.resolveFile(userId, fileName);
    try {
      await stat(fullPath);
    } catch {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Not found.' });
    }
    const stream = createReadStream(fullPath);
    if (fileName.endsWith('.png')) {
      res.type('image/png');
    } else if (fileName.endsWith('.webp')) {
      res.type('image/webp');
    } else {
      res.type('image/jpeg');
    }
    stream.pipe(res);
  }
}
