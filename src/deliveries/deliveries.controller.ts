import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
import { OptimizeRouteDto } from './dto/optimize-route.dto';

@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Get()
  getDeliveries() {
    return this.deliveriesService.getDeliveries();
  }

  @Get('search')
  searchPlaces(@Query('q') query: string) {
    return this.deliveriesService.searchPlaces(query);
  }

  @Post('validate')
  validateAddress(@Body() body: { address: string }) {
    return this.deliveriesService.validateAddress(body.address);
  }

  @Post('optimize')
  optimizeRoute(@Body() dto: OptimizeRouteDto) {
    return this.deliveriesService.optimizeRoute(dto);
  }

  /** Mock enterprise fleet optimization — simulates VRP solver with 3s AI delay */
  @Post('optimize-fleet')
  optimizeFleet() {
    return this.deliveriesService.optimizeFleet();
  }
}
