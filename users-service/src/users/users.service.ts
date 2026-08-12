import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';

export type PublicUser = Omit<User, 'password'>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findProfile(id: string): Promise<PublicUser> {
    const user = await this.usersRepository.findOneBy({ id });

    if (!user) {
      throw new UnauthorizedException('Usuário autenticado não encontrado');
    }

    return this.toPublicUser(user);
  }

  async findActiveSellers(): Promise<PublicUser[]> {
    const users = await this.usersRepository.findBy({
      role: UserRole.SELLER,
      status: UserStatus.ACTIVE,
    });

    return users.map((user) => this.toPublicUser(user));
  }

  async findById(id: string): Promise<PublicUser> {
    const user = await this.usersRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.toPublicUser(user);
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
