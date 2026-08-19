import { getMetadataArgsStorage } from 'typeorm';
import '../src/products/entities/product.entity';

for (const column of getMetadataArgsStorage().columns) {
  if (column.options.type === 'enum') column.options.type = 'simple-enum';
  if (column.options.type === 'timestamp') column.options.type = 'datetime';
}
