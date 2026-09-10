import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LibraryItem, LibraryItemSchema } from './schemas/library-item.schema';
import { LibraryExclusion, LibraryExclusionSchema } from './schemas/library-exclusion.schema';
import { LibraryExclusionService } from './library-exclusion.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LibraryItem.name, schema: LibraryItemSchema },
      { name: LibraryExclusion.name, schema: LibraryExclusionSchema },
    ]),
  ],
  providers: [LibraryExclusionService],
  exports: [LibraryExclusionService, MongooseModule],
})
export class LibraryExclusionModule {}
