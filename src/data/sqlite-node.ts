/// <reference types="node" />
// Solo para pruebas: SQLite real de Node (node:sqlite) con la misma forma asíncrona que expo-sqlite.

import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

const norm = (args: unknown[]): unknown[] => (args.length === 1 && Array.isArray(args[0]) ? (args[0] as unknown[]) : args);

export function abrirBdPrueba(): SQLiteDatabase {
  const raw = new DatabaseSync(':memory:');
  const db = {
    async execAsync(sql: string) { raw.exec(sql); },
    async runAsync(sql: string, ...args: unknown[]) {
      const r = raw.prepare(sql).run(...(norm(args) as never[]));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async getAllAsync(sql: string, ...args: unknown[]) { return raw.prepare(sql).all(...(norm(args) as never[])); },
    async getFirstAsync(sql: string, ...args: unknown[]) { return raw.prepare(sql).get(...(norm(args) as never[])) ?? null; },
    async withTransactionAsync(fn: () => Promise<void>) {
      // Igual que en el teléfono: una transacción dentro de otra truena (BEGIN dentro de BEGIN).
      raw.exec('BEGIN');
      try { await fn(); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; }
    },
  };
  return db as unknown as SQLiteDatabase;
}
