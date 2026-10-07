// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
export {};
import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const snapshots=sqliteTable('snapshots',{id:text('id').primaryKey(),manifest:text('manifest').notNull(),state:text('state').notNull().default('staging'),expected:integer('expected').notNull(),createdAt:text('created_at').notNull()});
export const players=sqliteTable('players',{snapshotId:text('snapshot_id').notNull().references(()=>snapshots.id),id:text('id').notNull(),sleeperId:text('sleeper_id').notNull(),position:text('position').notNull(),name:text('name').notNull(),payload:text('payload').notNull()},t=>[primaryKey({columns:[t.snapshotId,t.id]}),index('players_snapshot_position').on(t.snapshotId,t.position)]);
export const active=sqliteTable('active_snapshot',{key:text('key').primaryKey(),snapshotId:text('snapshot_id').notNull().references(()=>snapshots.id),previousId:text('previous_id'),updatedAt:text('updated_at').notNull()});
export const cache=sqliteTable('upstream_cache',{key:text('key').primaryKey(),payload:text('payload').notNull(),expires:integer('expires').notNull(),fetchedAt:text('fetched_at').notNull()});
export const audit=sqliteTable('events',{id:text('id').primaryKey(),kind:text('kind').notNull(),detail:text('detail').notNull(),createdAt:text('created_at').notNull()});
export const artifacts=sqliteTable('artifacts',{snapshotId:text('snapshot_id').notNull().references(()=>snapshots.id),key:text('key').notNull(),sha256:text('sha256').notNull()},t=>[primaryKey({columns:[t.snapshotId,t.key]})]);
export const ratingHistory=sqliteTable('rating_history',{snapshotId:text('snapshot_id').notNull().references(()=>snapshots.id),playerId:text('player_id').notNull(),rating:text('rating').notNull(),value:text('value').notNull(),recordedAt:text('recorded_at').notNull()},t=>[primaryKey({columns:[t.snapshotId,t.playerId]}),index('rating_history_player_date').on(t.playerId,t.recordedAt)]);
