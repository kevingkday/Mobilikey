import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../src/server/db/schema';

class MockD1PreparedStatement {
  private db: DatabaseSync;
  private sql: string;
  private params: unknown[];

  constructor(db: DatabaseSync, sql: string, params: unknown[] = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...values: unknown[]) {
    return new MockD1PreparedStatement(this.db, this.sql, values);
  }

  async all<T = Record<string, unknown>>() {
    const stmt = this.db.prepare(this.sql);
    const results = stmt.all(...(this.params as any[])) as T[];
    return {
      results,
      success: true,
      meta: {},
    };
  }

  async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...(this.params as any[])) as Record<string, unknown> | undefined;
    if (!row) return null;
    if (colName) return (row[colName] as T) ?? null;
    return row as T;
  }

  async run() {
    const stmt = this.db.prepare(this.sql);
    const info = stmt.run(...(this.params as any[]));
    return {
      results: [],
      success: true,
      meta: {
        changes: Number(info.changes),
        last_row_id: Number(info.lastInsertRowid),
      },
    };
  }

  async raw<T = unknown[]>() {
    const stmt = this.db.prepare(this.sql);
    stmt.setReturnArrays(true);
    const rows = stmt.all(...(this.params as any[]));
    return rows as unknown as T[];
  }
}

export function createTestDb(): {
  d1: D1Database;
  db: DrizzleD1Database<typeof schema>;
  sqlite: DatabaseSync;
} {
  const sqlite = new DatabaseSync(':memory:');
  const migrationSql = readFileSync(
    resolve(process.cwd(), 'drizzle/0000_initial_schema.sql'),
    'utf-8'
  );
  sqlite.exec(migrationSql);

  const d1 = {
    prepare(query: string) {
      return new MockD1PreparedStatement(sqlite, query);
    },
    async batch(statements: MockD1PreparedStatement[]) {
      const out = [];
      for (const s of statements) {
        out.push(await s.all());
      }
      return out;
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    },
    async dump() {
      return new ArrayBuffer(0);
    },
  } as unknown as D1Database;

  return {
    d1,
    db: drizzle(d1, { schema }),
    sqlite,
  };
}
