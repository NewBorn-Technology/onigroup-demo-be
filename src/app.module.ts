import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DeliveriesModule } from './deliveries/deliveries.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DeliveriesModule,
  ],
})
export class AppModule {}
