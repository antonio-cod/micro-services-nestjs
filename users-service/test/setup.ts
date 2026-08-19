import { getMetadataArgsStorage, Repository } from 'typeorm';
import '../src/users/entities/user.entity';

// Production entities intentionally use PostgreSQL-specific column names. Keep
// those entities unchanged and adapt only their test metadata for SQLite.
for (const column of getMetadataArgsStorage().columns) {
  if (column.options.type === 'enum') column.options.type = 'simple-enum';
  if (column.options.type === 'timestamp') column.options.type = 'datetime';
}

const findOne = Repository.prototype.findOne;
Repository.prototype.findOne = function (options: any) {
  if (this.manager.connection.options.type.includes('sqlite') && options?.lock) {
    options = { ...options };
    delete options.lock;
  }
  return findOne.call(this, options);
};
