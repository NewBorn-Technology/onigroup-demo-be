import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { OptimizeRouteDto } from './dto/optimize-route.dto';

export interface DeliveryStop {
  id: number;
  address_snippet: string;
  lat: number;
  lng: number;
}

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly httpService: HttpService,
  ) {}

  getDeliveries(): DeliveryStop[] {
    return [
      { id: 1, address_snippet: 'Jl. Sudirman No.1, Jakarta Pusat', lat: -6.2088, lng: 106.8456 },
      { id: 2, address_snippet: 'Jl. Thamrin No.10, Jakarta Pusat', lat: -6.1944, lng: 106.8229 },
      { id: 3, address_snippet: 'Jl. Gatot Subroto Kav.18, Jakarta Selatan', lat: -6.2382, lng: 106.8233 },
      { id: 4, address_snippet: 'Jl. Kemang Raya No.45, Jakarta Selatan', lat: -6.2615, lng: 106.8106 },
      { id: 5, address_snippet: 'Jl. Kelapa Gading Boulevard, Jakarta Utara', lat: -6.1568, lng: 106.9078 },
      { id: 6, address_snippet: 'Jl. Pluit Selatan Raya, Jakarta Utara', lat: -6.1256, lng: 106.7942 },
    ];
  }

  async searchPlaces(query: string) {
    const apiKey = 'AIzaSyCu7d-IJqnqWo-_iZu4OtvDB12ieJMQX3Y';

    const { data } = await firstValueFrom(
      this.httpService.post(
        'https://places.googleapis.com/v1/places:searchText',
        { textQuery: query },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
          },
        },
      ),
    );

    return (data.places ?? []).map((place: { id: string; displayName: { text: string }; formattedAddress: string; location: { latitude: number; longitude: number } }) => ({
      place_id: place.id,
      name: place.displayName.text,
      address: place.formattedAddress,
      lat: place.location.latitude,
      lng: place.location.longitude,
    }));
  }

  async validateAddress(address: string) {
    const apiKey = 'AIzaSyCu7d-IJqnqWo-_iZu4OtvDB12ieJMQX3Y';

    const { data } = await firstValueFrom(
      this.httpService.post(
        `https://addressvalidation.googleapis.com/v1:validateAddress?key=${apiKey}`,
        {
          address: { addressLines: [address] },
        },
      ),
    );

    const result = data.result;
    const verdict = result?.verdict ?? {};
    const addressObj = result?.address ?? {};
    const missingComponents: string[] = (addressObj.missingComponentTypes ?? []) as string[];

    // Calculate delivery confidence score
    let score = 100;
    let level: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    const warnings: string[] = [];

    // Penalize based on verdict granularity
    if (verdict.validationGranularity === 'PREMISE') {
      // Perfect — building-level match
    } else if (verdict.validationGranularity === 'SUB_PREMISE') {
      // Also good — unit-level match
    } else if (verdict.validationGranularity === 'ROUTE') {
      score -= 30;
      warnings.push('Address matched to street level only, not a specific building');
    } else {
      score -= 50;
      warnings.push('Address could not be matched to a specific location');
    }

    // Check for missing subpremise (apartment/suite/unit)
    const hasMissingUnit = missingComponents.some((c: string) =>
      ['subpremise', 'sub_premise'].includes(c.toLowerCase()),
    );
    if (hasMissingUnit) {
      score -= 25;
      warnings.push('Missing apartment/suite/unit number');
    }

    // Check if address was inferred or replaced
    if (verdict.hasInferredComponents) {
      score -= 10;
      warnings.push('Some address components were inferred');
    }
    if (verdict.hasReplacedComponents) {
      score -= 15;
      warnings.push('Some address components were corrected');
    }
    if (verdict.hasUnconfirmedComponents) {
      score -= 20;
      warnings.push('Some address components could not be confirmed');
    }

    score = Math.max(0, score);

    if (score >= 80) level = 'GREEN';
    else if (score >= 50) level = 'YELLOW';
    else level = 'RED';

    // Build badge
    let badge: string;
    if (level === 'GREEN') {
      badge = `✓ ${score}% Deliverable`;
    } else if (level === 'YELLOW') {
      const primary = hasMissingUnit
        ? 'Missing Apartment/Suite - High Risk of Return'
        : warnings[0] ?? 'Review Recommended';
      badge = `⚠️ ${primary}`;
    } else {
      badge = `✗ Undeliverable - Address Not Verified`;
    }

    return {
      score,
      level,
      badge,
      warnings,
      formatted_address: addressObj.formattedAddress ?? address,
      validation_granularity: verdict.validationGranularity ?? 'UNKNOWN',
    };
  }

  /**
   * Mock Enterprise Fleet Optimization (VRP Solver Simulation)
   *
   * Simulates Google's Route Optimization AI by returning a pre-built
   * 3-vehicle fleet plan across Jakarta/Tangerang after a 3-second
   * artificial delay (mimics real solver computation time).
   */
  async optimizeFleet() {
    // Simulate AI computation time — gives frontend a realistic loading state
    await new Promise((resolve) => setTimeout(resolve, 3000));

    return {
      success: true,
      optimization_summary: {
        total_stops_processed: 45,
        vehicles_utilized: 3,
        estimated_fuel_savings_percent: 14,
        sla_compliance: '100%',
      },
      fleet_routes: [
        {
          // Cold-chain truck: Pluit → Pantai Indah Kapuk → Cengkareng → Tangerang corridor
          vehicle_id: 'TRUCK-001 (Cold Chain)',
          color_hex: '#3b82f6',
          route_geometry: [
            { lat: -6.1256, lng: 106.7942 },  // Pluit depot
            { lat: -6.1150, lng: 106.7450 },  // Pantai Indah Kapuk
            { lat: -6.1320, lng: 106.7130 },  // Cengkareng
            { lat: -6.1480, lng: 106.6850 },  // Tangerang Kota
            { lat: -6.1700, lng: 106.6350 },  // BSD City
            { lat: -6.1900, lng: 106.6150 },  // Serpong
            { lat: -6.2200, lng: 106.5950 },  // Alam Sutera
          ],
        },
        {
          // Standard truck: Sudirman → Kuningan → Kemang → Pondok Indah corridor
          vehicle_id: 'TRUCK-002 (Standard)',
          color_hex: '#10b981',
          route_geometry: [
            { lat: -6.2088, lng: 106.8456 },  // Sudirman depot
            { lat: -6.2200, lng: 106.8350 },  // Senayan
            { lat: -6.2350, lng: 106.8260 },  // Blok M
            { lat: -6.2450, lng: 106.8100 },  // Kebayoran Baru
            { lat: -6.2615, lng: 106.8106 },  // Kemang
            { lat: -6.2750, lng: 106.7850 },  // Pondok Indah
            { lat: -6.2930, lng: 106.7750 },  // Cilandak
            { lat: -6.3100, lng: 106.7650 },  // TB Simatupang
          ],
        },
        {
          // Express truck: Kelapa Gading → Sunter → Cempaka Putih → Monas corridor
          vehicle_id: 'TRUCK-003 (Express)',
          color_hex: '#8b5cf6',
          route_geometry: [
            { lat: -6.1568, lng: 106.9078 },  // Kelapa Gading depot
            { lat: -6.1650, lng: 106.8900 },  // Sunter
            { lat: -6.1750, lng: 106.8750 },  // Pademangan
            { lat: -6.1820, lng: 106.8600 },  // Kemayoran
            { lat: -6.1880, lng: 106.8480 },  // Cempaka Putih
            { lat: -6.1944, lng: 106.8229 },  // Thamrin
            { lat: -6.1754, lng: 106.8272 },  // Monas
          ],
        },
      ],
    };
  }

  async optimizeRoute(dto: OptimizeRouteDto) {
    const { stops } = dto;
    const origin = `${stops[0].lat},${stops[0].lng}`;
    const destination = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`;

    const waypoints = stops
      .slice(1, -1)
      .map((s) => `${s.lat},${s.lng}`)
      .join('|');

    const apiKey = 'AIzaSyCu7d-IJqnqWo-_iZu4OtvDB12ieJMQX3Y';

    const { data } = await firstValueFrom(
      this.httpService.get('https://maps.googleapis.com/maps/api/directions/json', {
        params: {
          origin,
          destination,
          waypoints: waypoints ? `optimize:true|${waypoints}` : undefined,
          key: apiKey,
        },
      }),
    );

    const route = data.routes?.[0];
    const legs: Array<{ distance: { value: number }; duration: { value: number } }> = route?.legs ?? [];

    const totalDistanceMeters = legs.reduce((sum: number, leg: { distance: { value: number } }) => sum + leg.distance.value, 0);
    const totalDurationSeconds = legs.reduce((sum: number, leg: { duration: { value: number } }) => sum + leg.duration.value, 0);

    return {
      optimized_waypoint_order: route?.waypoint_order ?? [],
      total_distance: `${(totalDistanceMeters / 1000).toFixed(1)} km`,
      total_duration: `${Math.round(totalDurationSeconds / 60)} mins`,
    };
  }
}
