import { Injectable } from '@nestjs/common';
import { Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  constructor() {
    this.registry.setDefaultLabels({ app: 'nearby-server' });

    collectDefaultMetrics({
      register: this.registry,
      eventLoopMonitoringPrecision: 10,
    });
  }

  async render() {
    return this.registry.metrics();
  }
}
