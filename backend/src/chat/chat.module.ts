import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { UserModule } from 'src/user/user.module';
import { Channel } from './entity/channel.entity';
import { Message } from './entity/message.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from 'src/auth/auth.module';
import { JwtService } from '@nestjs/jwt';
import { DMChannel } from './entity/dm-channel.entity';

@Module({
	imports: [
    TypeOrmModule.forFeature([
      Channel,
			DMChannel,
      Message,
    ]),
    UserModule,
		AuthModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, JwtService, ],
})
export class ChatModule {}
