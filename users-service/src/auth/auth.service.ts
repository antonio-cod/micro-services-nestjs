import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserStatus } from '../users/enums/user-status.enum';
import { RegisterDto } from './dto/register.dto';

export type RegisteredUser = Omit<User, 'password'>;

@Injectable()
export class AuthService {
  private static readonly PASSWORD_SALT_ROUNDS = 10;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async register(registerDto: RegisterDto): Promise<RegisteredUser> {
    const existingUser = await this.usersRepository.findOneBy({
      email: registerDto.email,
    });

    if (existingUser) {
      throw new ConflictException('Email já cadastrado');
    }

    const password = await hash(
      registerDto.password,
      AuthService.PASSWORD_SALT_ROUNDS,
    );
    const user = this.usersRepository.create({
      ...registerDto,
      password,
      status: UserStatus.ACTIVE,
    });

    try {
      const savedUser = await this.usersRepository.save(user);
      return this.toRegisteredUser(savedUser);
    } catch (error: unknown) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException('Email já cadastrado');
      }

      throw error;
    }
  }

  private toRegisteredUser(user: User): RegisteredUser {
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

  private isUniqueConstraintViolation(
    error: unknown,
  ): error is { code: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
