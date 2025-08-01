declare module 'charting_library' {
  export interface ChartingLibraryWidgetOptions {
    container: HTMLElement;
    locale: string;
    library_path: string;
    datafeed: any;
    symbol: string;
    interval: string;
    theme: string;
    style: string;
    overrides?: any;
    disabled_features?: string[];
    enabled_features?: string[];
    [key: string]: any;
  }

  export interface IChartingLibraryWidget {
    onChartReady(callback: () => void): void;
    setSymbol(symbol: string, interval: string, callback: () => void): void;
    remove(): void;
    chart(): any;
  }
}