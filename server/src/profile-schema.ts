import type {ProfileQuery} from "./profile-connection.js";

export const profileTable="planetfall_guest_profiles";
export const receiptTable="planetfall_profile_operations";
export const accountTable="planetfall_account_links";
export const rankingIndex="planetfall_leaderboard_rank_idx";
export const earnedXp="((progress->>'sessionTotalXp')::bigint)";
export const leaderboardOrder=`${earnedXp} DESC, id COLLATE "C" ASC`;
export const leaderboardCheck="leaderboard_name ~ '^[A-Za-z0-9 _-]{1,18}$' AND leaderboard_name=btrim(leaderboard_name)";
const leaderboardConstraint="CHECK (leaderboard_name ~ '^[A-Za-z0-9 _-]{1,18}$'::text AND leaderboard_name = btrim(leaderboard_name))";
const expectedRankDefinition=' USING btree ((((progress ->> \'sessionTotalXp\'::text))::bigint) DESC, id COLLATE "C") WHERE (leaderboard_name IS NOT NULL)';

type Column={type:string;notNull:boolean;default:string|null;select:boolean;insert:boolean;update:boolean};
type Table={name:string;inTargetSchema:boolean;isDurableTable:boolean;rowSecurity:boolean;columns:Record<string,Column>;constraints:string[];publicationChecks:string[]};
type CatalogRow=Table&{exists:boolean;indexExists:boolean;indexUsable:boolean;indexDefinition:string|null;readOnly:boolean};
export type ProfileSchema={tables:Map<string,Table>;indexExists:boolean;indexMatches:boolean;readOnly:boolean};
const foreignKey=`FOREIGN KEY (profile_key) REFERENCES ${profileTable}(id)`;

export async function readProfileSchema(query:ProfileQuery):Promise<ProfileSchema> {
  const {rows}=await query(`WITH required(name) AS (VALUES ($1::text),($2),($3))
    SELECT required.name, t.oid IS NOT NULL AS "exists", current_setting('transaction_read_only')::boolean AS "readOnly",
      n.nspname = current_schema() AS "inTargetSchema",
      t.relkind='r' AND t.relpersistence='p' AS "isDurableTable", t.relrowsecurity AS "rowSecurity",
      COALESCE((SELECT jsonb_object_agg(a.attname, jsonb_build_object(
        'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
        'default',pg_get_expr(d.adbin,d.adrelid,true),
        'select',has_column_privilege(t.oid,a.attnum,'SELECT'),
        'insert',has_column_privilege(t.oid,a.attnum,'INSERT'),
        'update',has_column_privilege(t.oid,a.attnum,'UPDATE')))
        FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
        WHERE a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped),'{}'::jsonb) AS columns,
      ARRAY(SELECT pg_get_constraintdef(c.oid,true) FROM pg_constraint c
        LEFT JOIN pg_index ci ON ci.indexrelid=c.conindid
        WHERE c.conrelid=t.oid AND c.convalidated AND NOT c.condeferrable
          AND (c.contype NOT IN ('p','u','f') OR (ci.indisvalid AND ci.indisready AND ci.indislive))) AS constraints,
      ARRAY(SELECT pg_get_constraintdef(c.oid,true) FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=t.oid
        WHERE c.conrelid=t.oid AND c.contype='c' AND a.attname='leaderboard_name' AND a.attnum=ANY(c.conkey)) AS "publicationChecks",
      ix.oid IS NOT NULL AS "indexExists",
      i.indrelid=t.oid AND i.indisvalid AND i.indisready AND i.indislive AND NOT i.indisunique AS "indexUsable",
      pg_get_indexdef(ix.oid) AS "indexDefinition"
    FROM required
    LEFT JOIN pg_class t ON t.oid=to_regclass(required.name)
    LEFT JOIN pg_namespace n ON n.oid=t.relnamespace
    LEFT JOIN pg_class ix ON required.name=$1 AND ix.oid=to_regclass($4)
    LEFT JOIN pg_index i ON i.indexrelid=ix.oid`,[profileTable,receiptTable,accountTable,rankingIndex]);
  const catalog=rows as CatalogRow[];
  const profiles=catalog.find(row=>row.name===profileTable)!;
  return {
    tables:new Map(catalog.filter(row=>row.exists).map(row=>[row.name,row])),
    indexExists:profiles.indexExists,
    indexMatches:profiles.indexUsable&&Boolean(profiles.indexDefinition?.endsWith(expectedRankDefinition)),
    readOnly:profiles.readOnly,
  };
}

type RequiredColumn=[name:string,type:string,notNull:boolean,permissions:string,defaultValue?:string];
const profileColumns:RequiredColumn[]=[
  ["id","text",true,"si"],["progress","jsonb",true,"siu"],
];
const publicationColumn:RequiredColumn=["leaderboard_name","text",false,"su"];
const receiptColumns:RequiredColumn[]=[
  ["id","uuid",true,"si"],["profile_key","text",true,"si"],["result","jsonb",true,"si"],
];
const accountColumns:RequiredColumn[]=[
  ["issuer","text",true,"si"],["auth_user_id","text",true,"si"],["profile_key","text",true,"si"],
  ["linked_at","timestamp with time zone",true,"","now()"],["preferences","jsonb",false,"su"],
  ["preferences_revision","integer",true,"su","0"],
];
const permissions={s:"SELECT",i:"INSERT",u:"UPDATE"} as const;
const permissionFields={s:"select",i:"insert",u:"update"} as const;
type Permission=keyof typeof permissions;

function verifyTable(table:Table,columns:RequiredColumn[],constraints:string[],runtime:boolean):string[] {
  if(!table.inTargetSchema||!table.isDurableTable||table.rowSecurity)
    return [`${table.name} must be a durable table in the current schema with row security disabled`];
  const problems:string[]=[];
  for(const [name,type,notNull,access,defaultValue]of columns){
    const column=table.columns[name],field=`${table.name}.${name}`;
    if(!column||column.type!==type||column.notNull!==notNull||(column.default??null)!==(defaultValue??null)){
      problems.push(`incompatible or missing column ${field}`);
      continue;
    }
    if(runtime)for(const privilege of access as Iterable<Permission>){
      if(!column[permissionFields[privilege]])problems.push(`missing ${permissions[privilege]} on ${field}`);
    }
  }
  for(const constraint of constraints)if(!table.constraints.includes(constraint))problems.push(`${table.name} lacks valid ${constraint}`);
  return problems;
}

/** Reports catalog drift before DDL, allowing only known additive upgrade steps. */
export function profileSchemaProblems(schema:ProfileSchema,mode:"runtime"|"upgrade"|"migrated"):string[] {
  const runtime=mode==="runtime",complete=mode!=="upgrade",problems:string[]=[];
  if(schema.readOnly)problems.push("connection is read-only; use a writable database endpoint");
  const profiles=schema.tables.get(profileTable),receipts=schema.tables.get(receiptTable),accounts=schema.tables.get(accountTable);
  if(profiles){
    const publication=profiles.columns.leaderboard_name;
    const required=complete||publication?[...profileColumns,publicationColumn]:profileColumns;
    const check=complete||profiles.publicationChecks.length?[leaderboardConstraint]:[];
    problems.push(...verifyTable(profiles,required,["PRIMARY KEY (id)",...check],runtime));
  }else if(complete)problems.push(`missing ${profileTable}`);
  if(receipts)problems.push(...verifyTable(receipts,receiptColumns,["PRIMARY KEY (id)",foreignKey],runtime));
  else if(complete)problems.push(`missing ${receiptTable}`);
  if(accounts)problems.push(...verifyTable(accounts,accountColumns,["PRIMARY KEY (issuer, auth_user_id)","UNIQUE (profile_key)",foreignKey,
    "CHECK (preferences IS NULL OR octet_length(preferences::text) <= 12000)"],runtime));
  else if(complete)problems.push(`missing ${accountTable}`);
  if((schema.indexExists||complete)&&!schema.indexMatches)problems.push(`missing, invalid, or incompatible ${rankingIndex}`);
  return problems;
}

export class ProfileSchemaError extends Error {}

export async function validateProfileSchema(query:ProfileQuery):Promise<void> {
  const problems=profileSchemaProblems(await readProfileSchema(query),"runtime");
  if(problems.length)throw new ProfileSchemaError(`Profile database is not ready: ${problems.join("; ")}. Run npm run db:migrate -w @planetfall/server with the migration role and verify the runtime grants in docs/PLAYER_PROFILES.md.`);
}

/** PostgreSQL errors can contain connection details or data. Log only a code and a known action. */
export function safeProfileDatabaseError(error:unknown,action:string):Error {
  if(error instanceof ProfileSchemaError)return error;
  const candidate=typeof error==="object"&&error!==null&&"code" in error?error.code:null;
  const code=typeof candidate==="string"&&/^[A-Z0-9_]{1,32}$/.test(candidate)?candidate:null;
  const hints:Record<string,string>={
    "42501":"Verify object ownership for the migration role and documented grants for the runtime role.",
    "23514":"Existing data violates a schema check. Inspect the affected rows in a backup or staging copy before retrying.",
    "55P03":"A lock timed out. Confirm the maintenance window and inspect competing sessions before retrying.",
    "57014":"A statement was canceled or timed out. Inspect database availability and lock activity before retrying.",
    "42P01":"A required table is unavailable. Verify the target schema and run the explicit profile migration.",
    "42703":"A required column is unavailable. Verify the target schema and run the explicit profile migration.",
  };
  return new Error(`${action} failed${code?` (${code})`:""}. ${hints[code??""]??"Verify the database endpoint, credentials, permissions, and availability."}`);
}
