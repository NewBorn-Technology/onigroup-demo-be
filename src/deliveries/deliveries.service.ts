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
        sla_compliance: '97.8%',
        total_complaints: 6,
        complaint_reduction_vs_last_week: '-33%',
      },
      constraints_applied: [
        {
          type: 'TIME_WINDOW',
          description: 'Delivery must arrive within customer-selected time slot',
          affected_stops: 38,
          violations: 1,
        },
        {
          type: 'VEHICLE_CAPACITY',
          description: 'Max weight/volume per truck not exceeded',
          affected_stops: 45,
          violations: 0,
        },
        {
          type: 'COLD_CHAIN',
          description: 'Perishable goods stay on refrigerated TRUCK-001 only',
          affected_stops: 12,
          violations: 0,
        },
        {
          type: 'DRIVER_HOURS',
          description: 'Max 10-hour shift per driver, mandatory 30-min break',
          affected_stops: 45,
          violations: 0,
        },
        {
          type: 'COMPLAINT_ZONE_AVOIDANCE',
          description: 'Deprioritize drivers with complaints in repeat-complaint areas',
          affected_stops: 8,
          violations: 0,
        },
      ],
      complaints: [
        {
          id: 'CMP-1041',
          type: 'LATE_DELIVERY',
          severity: 'HIGH',
          status: 'RESOLVED',
          stop_address: 'Jl. Kemang Raya No.45, Jakarta Selatan',
          vehicle_id: 'TRUCK-002 (Standard)',
          description: 'Package arrived 2 hours after promised window',
          resolution: 'Route re-optimized — stop moved earlier in sequence',
        },
        {
          id: 'CMP-1038',
          type: 'DAMAGED_GOODS',
          severity: 'CRITICAL',
          status: 'RESOLVED',
          stop_address: 'Jl. Pluit Selatan Raya, Jakarta Utara',
          vehicle_id: 'TRUCK-001 (Cold Chain)',
          description: 'Frozen goods thawed during delivery — cold chain break',
          resolution: 'Added cold-chain constraint — perishables locked to TRUCK-001',
        },
        {
          id: 'CMP-1035',
          type: 'WRONG_ADDRESS',
          severity: 'MEDIUM',
          status: 'OPEN',
          stop_address: 'Jl. Gatot Subroto Kav.18, Jakarta Selatan',
          vehicle_id: 'TRUCK-002 (Standard)',
          description: 'Driver went to Kav.18A instead of Kav.18 — no unit number',
          resolution: 'Pending — flagged for Address Validation API integration',
        },
        {
          id: 'CMP-1033',
          type: 'MISSED_DELIVERY',
          severity: 'HIGH',
          status: 'RESOLVED',
          stop_address: 'BSD City, Tangerang',
          vehicle_id: 'TRUCK-001 (Cold Chain)',
          description: 'Customer not home — no re-attempt same day',
          resolution: 'Added time-window constraint from customer preference',
        },
        {
          id: 'CMP-1029',
          type: 'RUDE_DRIVER',
          severity: 'LOW',
          status: 'RESOLVED',
          stop_address: 'Jl. Kelapa Gading Boulevard, Jakarta Utara',
          vehicle_id: 'TRUCK-003 (Express)',
          description: 'Customer reported unprofessional behavior',
          resolution: 'Driver reassigned from Kelapa Gading zone',
        },
        {
          id: 'CMP-1027',
          type: 'LATE_DELIVERY',
          severity: 'MEDIUM',
          status: 'RESOLVED',
          stop_address: 'Jl. Thamrin No.10, Jakarta Pusat',
          vehicle_id: 'TRUCK-003 (Express)',
          description: 'Express delivery missed 2-hour SLA by 40 minutes',
          resolution: 'Route sequence adjusted — Thamrin stop prioritized',
        },
      ],
      fleet_routes: [
        {
          vehicle_id: 'TRUCK-001 (Cold Chain)',
          color_hex: '#3b82f6',
          stops_count: 12,
          capacity_used: '87%',
          estimated_duration: '4h 20m',
          active_constraints: ['COLD_CHAIN', 'TIME_WINDOW', 'VEHICLE_CAPACITY'],
          route_geometry: [
            { lat: -6.1256, lng: 106.7942 },
            { lat: -6.1150, lng: 106.7450 },
            { lat: -6.1320, lng: 106.7130 },
            { lat: -6.1480, lng: 106.6850 },
            { lat: -6.1700, lng: 106.6350 },
            { lat: -6.1900, lng: 106.6150 },
            { lat: -6.2200, lng: 106.5950 },
          ],
        },
        {
          vehicle_id: 'TRUCK-002 (Standard)',
          color_hex: '#10b981',
          stops_count: 18,
          capacity_used: '92%',
          estimated_duration: '5h 45m',
          active_constraints: ['TIME_WINDOW', 'DRIVER_HOURS', 'VEHICLE_CAPACITY'],
          route_geometry: [
            { lat: -6.2088, lng: 106.8456 },
            { lat: -6.2200, lng: 106.8350 },
            { lat: -6.2350, lng: 106.8260 },
            { lat: -6.2450, lng: 106.8100 },
            { lat: -6.2615, lng: 106.8106 },
            { lat: -6.2750, lng: 106.7850 },
            { lat: -6.2930, lng: 106.7750 },
            { lat: -6.3100, lng: 106.7650 },
          ],
        },
        {
          vehicle_id: 'TRUCK-003 (Express)',
          color_hex: '#8b5cf6',
          stops_count: 15,
          capacity_used: '64%',
          estimated_duration: '3h 10m',
          active_constraints: ['TIME_WINDOW', 'COMPLAINT_ZONE_AVOIDANCE', 'DRIVER_HOURS'],
          route_geometry: [
            { lat: -6.1568, lng: 106.9078 },
            { lat: -6.1650, lng: 106.8900 },
            { lat: -6.1750, lng: 106.8750 },
            { lat: -6.1820, lng: 106.8600 },
            { lat: -6.1880, lng: 106.8480 },
            { lat: -6.1944, lng: 106.8229 },
            { lat: -6.1754, lng: 106.8272 },
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
