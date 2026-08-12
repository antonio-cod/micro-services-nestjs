import { Controller, Get, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PublicUser, UsersService } from './users.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  profile(@Req() request: AuthenticatedRequest): Promise<PublicUser> {
    return this.usersService.findProfile(request.user.id);
  }

  @Get('sellers')
  sellers(): Promise<PublicUser[]> {
    return this.usersService.findActiveSellers();
  }

  @Get(':id')
  findById(@Param('id', new ParseUUIDPipe()) id: string): Promise<PublicUser> {
    return this.usersService.findById(id);
  }
}
