import { DecimalPipe } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  LineSeries,
  LineStyle,
  UTCTimestamp,
  createChart,
  createSeriesMarkers,
} from 'lightweight-charts';
import { CoinCandleDto, CoinForecastResponse } from '../../core/models/ai.models';

export type CoinChartMode = 'candle' | 'line';

interface Quote {
  open: number;
  high: number;
  low: number;
  close: number;
}

const INTERVAL_SECONDS: Record<string, number> = {
  '15m': 15 * 60,
  '1h': 60 * 60,
  '4h': 4 * 60 * 60,
  '1d': 24 * 60 * 60,
};

@Component({
  selector: 'app-coin-chart',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './coin-chart.component.html',
  styleUrl: './coin-chart.component.scss',
})
export class CoinChartComponent implements AfterViewInit, OnDestroy {
  readonly forecast = input.required<CoinForecastResponse>();
  readonly mode = input<CoinChartMode>('candle');
  readonly modeChange = output<CoinChartMode>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private chart: IChartApi | null = null;
  private priceSeries: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | null = null;
  private ownedSeries: ISeriesApi<'Candlestick' | 'Area' | 'Histogram' | 'Line'>[] = [];
  private ready = false;

  readonly hover = signal<Quote | null>(null);

  constructor() {
    effect(() => {
      const forecast = this.forecast();
      const mode = this.mode();
      if (!this.ready) {
        return;
      }
      this.paint(forecast, mode);
    });
  }

  ngAfterViewInit(): void {
    const el = this.host().nativeElement;
    this.chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e11' },
        textColor: '#848e9c',
        fontFamily: "Inter, 'Segoe UI', sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: 'rgba(43, 49, 57, 0.55)' },
        horzLines: { color: 'rgba(43, 49, 57, 0.55)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#5e6673', labelBackgroundColor: '#2b3139', width: 1 },
        horzLine: { color: '#5e6673', labelBackgroundColor: '#2b3139', width: 1 },
      },
      rightPriceScale: { borderColor: '#2b3139', scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: {
        borderColor: '#2b3139',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: 8,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    this.chart.subscribeCrosshairMove((param) => {
      const series = this.priceSeries;
      if (!series || param.time == null) {
        this.hover.set(null);
        return;
      }
      const row = param.seriesData.get(series);
      if (!row) {
        this.hover.set(null);
        return;
      }
      if ('close' in row && typeof row.close === 'number') {
        this.hover.set({
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
        });
        return;
      }
      if ('value' in row && typeof row.value === 'number') {
        this.hover.set({
          open: row.value,
          high: row.value,
          low: row.value,
          close: row.value,
        });
      }
    });

    this.ready = true;
    this.paint(this.forecast(), this.mode());
  }

  ngOnDestroy(): void {
    this.chart?.remove();
    this.chart = null;
  }

  quote(): Quote {
    return this.hover() ?? this.lastQuote();
  }

  quoteUp(): boolean {
    const q = this.quote();
    return q.close >= q.open;
  }

  private lastQuote(): Quote {
    const candles = this.forecast().recentCandles ?? [];
    const last = candles[candles.length - 1];
    if (!last) {
      const price = this.forecast().lastClose;
      return { open: price, high: price, low: price, close: price };
    }
    return { open: last.open, high: last.high, low: last.low, close: last.close };
  }

  private paint(forecast: CoinForecastResponse, mode: CoinChartMode): void {
    const chart = this.chart;
    if (!chart) {
      return;
    }

    this.clearSeries();
    const rows = normalizeCandles(forecast.recentCandles ?? []);
    if (rows.length < 2) {
      return;
    }

    const precision = pricePrecision(forecast.lastClose);
    const minMove = Number((10 ** -precision).toFixed(precision));
    const priceFormat = { type: 'price' as const, precision, minMove };
    const last = rows[rows.length - 1];
    const step = INTERVAL_SECONDS[forecast.interval] ?? 60 * 60;
    const nextTime = (last.time + step) as UTCTimestamp;
    const up = forecast.predictedChangePct >= 0;
    const predColor = Math.abs(forecast.predictedChangePct) < 0.15 ? '#f0b90b' : up ? '#0ecb81' : '#f6465d';
    const band = uncertaintyBand(forecast);
    const predHigh = Math.max(forecast.predictedClose, last.close, band.high);
    const predLow = Math.min(forecast.predictedClose, last.close, band.low);

    if (mode === 'line') {
      const area = chart.addSeries(AreaSeries, {
        lineColor: '#f0b90b',
        topColor: 'rgba(240, 185, 11, 0.28)',
        bottomColor: 'rgba(240, 185, 11, 0.02)',
        lineWidth: 2,
        priceFormat,
        priceLineVisible: false,
        lastValueVisible: true,
      });
      area.setData(rows.map((c) => ({ time: c.time, value: c.close })));
      this.priceSeries = area;
      this.ownedSeries.push(area);
    } else {
      const candles = chart.addSeries(CandlestickSeries, {
        upColor: '#0ecb81',
        downColor: '#f6465d',
        borderUpColor: '#0ecb81',
        borderDownColor: '#f6465d',
        wickUpColor: '#0ecb81',
        wickDownColor: '#f6465d',
        priceFormat,
        priceLineVisible: false,
      });
      candles.setData(
        rows.map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
      this.priceSeries = candles;
      this.ownedSeries.push(candles);

      const ghost = chart.addSeries(CandlestickSeries, {
        upColor: 'rgba(240, 185, 11, 0.55)',
        downColor: 'rgba(240, 185, 11, 0.35)',
        borderUpColor: '#f0b90b',
        borderDownColor: '#f0b90b',
        wickUpColor: '#f0b90b',
        wickDownColor: '#f0b90b',
        lastValueVisible: false,
        priceLineVisible: false,
        priceFormat,
      });
      ghost.setData([
        {
          time: nextTime,
          open: last.close,
          close: forecast.predictedClose,
          high: predHigh,
          low: predLow,
        },
      ]);
      this.ownedSeries.push(ghost);
    }

    const projection = chart.addSeries(LineSeries, {
      color: predColor,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      priceFormat,
    });
    projection.setData([
      { time: last.time, value: last.close },
      { time: nextTime, value: forecast.predictedClose },
    ]);
    this.ownedSeries.push(projection);

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volume.setData(
      rows.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(14, 203, 129, 0.45)' : 'rgba(246, 70, 93, 0.45)',
      })),
    );
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    this.priceSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.06, bottom: 0.24 },
    });
    this.ownedSeries.push(volume);

    const anchor = this.priceSeries;
    anchor.createPriceLine({
      price: forecast.lastClose,
      color: '#eaecef',
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: 'Hiện tại',
    });
    anchor.createPriceLine({
      price: forecast.predictedClose,
      color: predColor,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Dự báo',
    });
    anchor.createPriceLine({
      price: forecast.support,
      color: '#0ecb81',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: 'Hỗ trợ',
    });
    anchor.createPriceLine({
      price: forecast.resistance,
      color: '#f6465d',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: 'Kháng cự',
    });

    createSeriesMarkers(projection, [
      {
        time: nextTime,
        position: 'aboveBar',
        color: '#f0b90b',
        shape: 'circle',
        text: 'Dự báo',
      },
    ]);

    chart.timeScale().fitContent();
  }

  private clearSeries(): void {
    const chart = this.chart;
    if (!chart) {
      return;
    }
    for (const series of this.ownedSeries) {
      chart.removeSeries(series);
    }
    this.ownedSeries = [];
    this.priceSeries = null;
    this.hover.set(null);
  }
}

function normalizeCandles(candles: CoinCandleDto[]): Array<CoinCandleDto & { time: UTCTimestamp }> {
  const byTime = new Map<number, CoinCandleDto>();
  for (const candle of candles) {
    const ms = new Date(candle.openTimeUtc).getTime();
    if (!Number.isFinite(ms)) {
      continue;
    }
    byTime.set(Math.floor(ms / 1000), candle);
  }
  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, candle]) => ({ ...candle, time: time as UTCTimestamp }));
}

function pricePrecision(price: number): number {
  if (price >= 1000) {
    return 2;
  }
  if (price >= 1) {
    return 4;
  }
  if (price >= 0.01) {
    return 6;
  }
  return 8;
}

function uncertaintyBand(forecast: CoinForecastResponse): { high: number; low: number } {
  const absChange = Math.abs(forecast.predictedClose - forecast.lastClose);
  const pct = Math.max(
    0.0035,
    (1 - forecast.confidence) * 0.028 + absChange / Math.max(forecast.lastClose, 1e-9) * 0.45,
  );
  return {
    high: forecast.predictedClose * (1 + pct),
    low: forecast.predictedClose * (1 - pct),
  };
}
