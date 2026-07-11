import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const data = await this.authService.login(loginDto);
    return { success: true, data };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout() {
    // With stateless JWT, logout is primarily handled on the client side 
    // by discarding the token. If token invalidation is required later, 
    // we would implement a Redis blacklist here.
    return { success: true, message: 'Logged out successfully' };
  }
}
