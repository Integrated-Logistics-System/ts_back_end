import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _password, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { email: user.email, sub: user._id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        preferences: user.preferences,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const saltRounds =
      this.configService.get<number>('auth.bcryptRounds') || 12;
    const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

    const user = await this.userService.create({
      ...registerDto,
      password: hashedPassword,
    });

    const { password: _password, ...result } = user.toObject();
    const payload = { email: result.email, sub: result._id };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: result._id,
        email: result.email,
        username: result.username,
        preferences: result.preferences,
      },
    };
  }
}
