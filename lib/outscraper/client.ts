const OUTSCRAPER_BASE = "https://api.app.outscraper.com";

function getApiKey(): string {
  const key = process.env.OUTSCRAPER_API_KEY;
  if (!key) throw new Error("Missing OUTSCRAPER_API_KEY environment variable");
  return key;
}

export interface OutscraperTask {
  id: string;
  status: string;
  created: string;
  updated: string;
  results: {
    file_url?: string;
    product_name: string;
    quantity: number;
  }[];
  metadata: {
    categories?: string[];
    locations?: string[];
    tags?: string;
    language?: string;
    organizations_per_query?: number;
    limit?: number;
    drop_duplicates?: boolean;
    enrichments?: string[];
    [key: string]: unknown;
  };
}

export interface OutscraperTasksResponse {
  tasks: OutscraperTask[];
  has_more: boolean;
}

export async function listTasks(): Promise<OutscraperTasksResponse> {
  const res = await fetch(`${OUTSCRAPER_BASE}/tasks`, {
    headers: { "X-API-KEY": getApiKey() },
  });
  if (!res.ok) throw new Error(`Outscraper API error: ${res.status}`);
  return res.json();
}

export async function getTask(taskId: string): Promise<OutscraperTask> {
  const res = await fetch(`${OUTSCRAPER_BASE}/tasks/${taskId}`, {
    headers: { "X-API-KEY": getApiKey() },
  });
  if (!res.ok) throw new Error(`Outscraper API error: ${res.status}`);
  return res.json();
}

export async function downloadTaskFile(fileUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
  return res.arrayBuffer();
}
