export interface ScraperMetadata {
  id: string;
  name: string;
  baseUrl: string;
  description: string;
}

export interface ScraperModule {
  metadata: ScraperMetadata;
  runCli: (args: string[]) => Promise<void>;
}
