import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { FtStrategy } from './ft.strategy';
import { forwardRef } from '@nestjs/common';
import { EmailService } from './email.service';
import { UserModule } from '../user/user.module';
import { JwtStrategy } from 'src/auth/jwt.strategy';
import { UserService } from '../user/user.service';
import { ProfileService } from '../user/profile.service';
import { jwtSecret, oauth42Configured } from './auth-configuration';
import { GuestAdmissionService } from './guest-admission.service';


@Module({
	imports: [
		forwardRef(() => UserModule),
		JwtModule.registerAsync({
			useFactory: () => ({ secret: jwtSecret() }),
		}),
  ],
	controllers: [
		AuthController,
	],
	providers: [
		AuthService,
		GuestAdmissionService,
		{
			provide: FtStrategy,
			inject: [AuthService, UserService, ProfileService],
			useFactory: (auth: AuthService, users: UserService, profiles: ProfileService) =>
				oauth42Configured() ? new FtStrategy(auth, users, profiles) : null,
		},
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
