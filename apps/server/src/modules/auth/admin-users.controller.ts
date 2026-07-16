import { Body, Controller, Delete, ForbiddenException, Get, Inject, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import { UsersService } from '../users/users.service';
import { AuthGuard } from './auth.guard';
import { PasswordService } from './password.service';
import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { ERROR_CODES } from '../../common/dto/error-codes';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';

/** 管理员成员账号 CRUD；系统不提供公开注册入口。 */
@Controller('admin/users')
@UseGuards(AuthGuard)
export class AdminUsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService, @Inject(PasswordService) private readonly passwords: PasswordService) {}
  @Get()
  async list(@CurrentUser() user: CurrentUserType) {
    if (user.role !== 'admin') throw new ForbiddenException('Admin role is required.');
    return this.usersService.listForAdmin();
  }
  @Get(':id')
  async get(@CurrentUser() user: CurrentUserType, @Param('id') id: string) {
    this.assertAdmin(user); return this.usersService.getForAdmin(id);
  }
  @Post()
  async create(@CurrentUser() user: CurrentUserType, @Body(new DtoValidationPipe(CreateManagedUserDto)) body: CreateManagedUserDto) {
    this.assertAdmin(user); return this.usersService.createManaged(body, (value) => this.passwords.hashPassword(value));
  }
  @Put(':id')
  async update(@CurrentUser() user: CurrentUserType, @Param('id') id: string, @Body(new DtoValidationPipe(UpdateManagedUserDto)) body: UpdateManagedUserDto) {
    this.assertAdmin(user);
    if (id === user.id && body.role === 'member') throw new ForbiddenException({ code: ERROR_CODES.USER_SELF_ROLE_CHANGE_FORBIDDEN, message: '不能取消当前登录账号的管理员角色。' });
    return this.usersService.updateManaged(id, body, (value) => this.passwords.hashPassword(value));
  }
  @Delete(':id')
  async remove(@CurrentUser() user: CurrentUserType, @Param('id') id: string) {
    this.assertAdmin(user);
    if (id === user.id) throw new ForbiddenException({ code: ERROR_CODES.USER_SELF_DELETE_FORBIDDEN, message: '不能删除当前登录账号。' });
    await this.usersService.removeManaged(id); return { deleted: true, id };
  }
  private assertAdmin(user: CurrentUserType) { if (user.role !== 'admin') throw new ForbiddenException({ code: ERROR_CODES.ADMIN_ROLE_REQUIRED, message: '仅管理员可以管理成员账号。' }); }
}
