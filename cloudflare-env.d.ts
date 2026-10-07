declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    FFQUANT_INGEST_TOKEN?: string;
  }
}
