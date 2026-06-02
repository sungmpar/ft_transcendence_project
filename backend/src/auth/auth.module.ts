import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { FtStrategy } from './ft.strategy';
import { forwardRef } from '@nestjs/common';
import { EmailService } from './email.service';
import { UserModule } from '../user/user.module';
import { JwtStrategy } from 'src/auth/jwt.strategy';


@Module({
	imports: [
		forwardRef(() => UserModule),
		JwtModule.register({
			secret: "" + process.env.SECRET,
		}),
  ],
	controllers: [
		AuthController,
	],
	providers: [
		AuthService,
		FtStrategy,
		JwtStrategy,
		EmailService,
		JwtModule,
		JwtService,
	],
	exports: [
		AuthService,
	],
})
export class AuthModule {}
