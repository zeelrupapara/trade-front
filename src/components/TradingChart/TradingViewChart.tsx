import React, { useEffect, useRef } from 'react';
import { useMarketStore } from '../../stores/marketStore';
import datafeed from './datafeed';
import { addEnigmaIndicator } from './enigmaIndicator';

declare global {
  interface Window {
    TradingView: any;
  }
}

export default function TradingViewChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const { selectedSymbol, watchlist } = useMarketStore();

  useEffect(() => {
    if (!containerRef.current) return;

    // Don't recreate widget on symbol change, only on initial mount
    if (widgetRef.current) return;

    // For now, let's create a placeholder
    // In a real implementation, you would load the TradingView library
    const loadTradingView = () => {
      // Check if TradingView library is loaded
      if (window.TradingView) {
        const widget = new window.TradingView.widget({
          container: containerRef.current,
          symbol: selectedSymbol || watchlist[0] || 'BTCUSDT',
          interval: 'D',
          timezone: 'Etc/UTC',
          theme: 'light',
          style: '1',
          locale: 'en',
          toolbar_bg: '#ffffff',
          enable_publishing: false,
          withdateranges: true,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          details: true,
          hotlist: true,
          calendar: true,
          autosize: true,
          library_path: '/tradingview/charting_library/',
          datafeed: datafeed,
          custom_css_url: '/tradingview-chart.css',
          loading_screen: { backgroundColor: "#ffffff", foregroundColor: "#333333" },
          overrides: {
            // Main chart background and grid
            'paneProperties.background': '#ffffff',
            'paneProperties.vertGridProperties.color': '#f0f0f0',
            'paneProperties.horzGridProperties.color': '#f0f0f0',
            'paneProperties.crossHairProperties.color': '#758696',
            
            // Watermark
            'symbolWatermarkProperties.transparency': 90,
            'symbolWatermarkProperties.color': '#e0e0e0',
            
            // Scales
            'scalesProperties.backgroundColor': '#ffffff',
            'scalesProperties.lineColor': '#e0e0e0',
            'scalesProperties.textColor': '#333333',
            'scalesProperties.fontSize': 12,
            
            // Legend
            'paneProperties.legendProperties.showLegend': true,
            'paneProperties.legendProperties.showStudyArguments': true,
            'paneProperties.legendProperties.showStudyTitles': true,
            'paneProperties.legendProperties.showStudyValues': true,
            'paneProperties.legendProperties.showSeriesTitle': true,
            'paneProperties.legendProperties.showSeriesOHLC': true,
            'paneProperties.legendProperties.showBarChange': true,
            'paneProperties.legendProperties.showVolume': true,
            
            // Candle styles
            'mainSeriesProperties.candleStyle.upColor': '#26a69a',
            'mainSeriesProperties.candleStyle.downColor': '#ef5350',
            'mainSeriesProperties.candleStyle.wickUpColor': '#26a69a',
            'mainSeriesProperties.candleStyle.wickDownColor': '#ef5350',
            'mainSeriesProperties.candleStyle.borderUpColor': '#26a69a',
            'mainSeriesProperties.candleStyle.borderDownColor': '#ef5350',
            
            // Hollow candle styles
            'mainSeriesProperties.hollowCandleStyle.upColor': '#26a69a',
            'mainSeriesProperties.hollowCandleStyle.downColor': '#ef5350',
            'mainSeriesProperties.hollowCandleStyle.wickUpColor': '#26a69a',
            'mainSeriesProperties.hollowCandleStyle.wickDownColor': '#ef5350',
            'mainSeriesProperties.hollowCandleStyle.borderUpColor': '#26a69a',
            'mainSeriesProperties.hollowCandleStyle.borderDownColor': '#ef5350',
            
            // Bar styles
            'mainSeriesProperties.barStyle.upColor': '#26a69a',
            'mainSeriesProperties.barStyle.downColor': '#ef5350',
            
            // Line styles
            'mainSeriesProperties.lineStyle.color': '#2962ff',
            'mainSeriesProperties.lineStyle.linewidth': 2,
            
            // Area styles
            'mainSeriesProperties.areaStyle.color1': 'rgba(41, 98, 255, 0.28)',
            'mainSeriesProperties.areaStyle.color2': 'rgba(41, 98, 255, 0.05)',
            'mainSeriesProperties.areaStyle.linecolor': '#2962ff',
            'mainSeriesProperties.areaStyle.linewidth': 2,
            
            // Heikin Ashi styles
            'mainSeriesProperties.haStyle.upColor': '#26a69a',
            'mainSeriesProperties.haStyle.downColor': '#ef5350',
            'mainSeriesProperties.haStyle.wickUpColor': '#26a69a',
            'mainSeriesProperties.haStyle.wickDownColor': '#ef5350',
            'mainSeriesProperties.haStyle.borderUpColor': '#26a69a',
            'mainSeriesProperties.haStyle.borderDownColor': '#ef5350',
            
            // Background gradient
            'paneProperties.backgroundType': 'solid',
            'paneProperties.backgroundGradientStartColor': '#ffffff',
            'paneProperties.backgroundGradientEndColor': '#ffffff',
            
            // Session breaks
            'sessions.vertlines.sessBreaks.color': '#e0e0e0',
            'sessions.vertlines.sessBreaks.style': 'dashed',
            'sessions.vertlines.sessBreaks.width': 1,
          },
        });
        
        widgetRef.current = widget;
        
        // Add Enigma indicator when chart is ready
        widget.onChartReady(() => {
          try {
            const chart = widget.chart();
            const symbol = selectedSymbol || watchlist[0] || 'BTCUSDT';
            // TODO: Enable enigma indicator when TradingView library properly supports custom shapes
            // addEnigmaIndicator(chart, symbol);
          } catch (error) {
            console.error('Error adding Enigma indicator:', error);
          }
        });
      } else {
        // Placeholder when TradingView is not loaded
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div style="height: 100%; display: flex; align-items: center; justify-content: center; background-color: #ffffff; color: #333333;">
              <div style="text-align: center;">
                <h3 style="margin-bottom: 10px; color: #333333;">TradingView Chart</h3>
                <p style="color: #666666;">Symbol: ${selectedSymbol || watchlist[0] || 'BTCUSDT'}</p>
                <p style="font-size: 12px; margin-top: 20px; color: #999999;">
                  To enable charts, add TradingView library to public/charting_library/
                </p>
              </div>
            </div>
          `;
        }
      }
    };

    // Load TradingView after a short delay
    const timer = setTimeout(loadTradingView, 100);

    return () => {
      clearTimeout(timer);
      if (widgetRef.current && widgetRef.current.remove) {
        widgetRef.current.remove();
      }
    };
  }, []); // Only run on mount, not on symbol changes

  // Update symbol when selection changes
  useEffect(() => {
    if (widgetRef.current && selectedSymbol) {
      try {
        // Check if it's a TradingView widget
        if (window.TradingView && widgetRef.current.setSymbol) {
          widgetRef.current.setSymbol(selectedSymbol, widgetRef.current.chart().resolution() || '1D', () => {
            // After symbol change, update enigma indicator
            try {
              const chart = widgetRef.current.chart();
              // TODO: Enable enigma indicator when TradingView library properly supports custom shapes
              // addEnigmaIndicator(chart, selectedSymbol);
            } catch (error) {
              console.error('Error updating Enigma indicator:', error);
            }
          });
        } else if (containerRef.current) {
          // Update placeholder
          const placeholderElement = containerRef.current.querySelector('p');
          if (placeholderElement) {
            placeholderElement.textContent = `Symbol: ${selectedSymbol}`;
          }
        }
      } catch (error) {
        console.error('Error updating chart symbol:', error);
      }
    }
  }, [selectedSymbol]);

  return (
    <div ref={containerRef} className="h-full w-full" />
  );
} 