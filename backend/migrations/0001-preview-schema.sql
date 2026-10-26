-- Initial schema for a NEW, EMPTY, isolated ft_transcendence Preview database.
-- Generated from the current TypeORM entities by scripts/export-preview-schema.ts.
-- Additive statements: 33. DDL SHA256: 7fd2eb6065941477eaa9938067516283817061aa2006a81b9d0a7ca8cfd8a392
-- No production data is copied. Existing user relations cause a safe failure.
-- Select the newly created Preview database in the query editor before execution.
-- Execute this ENTIRE file as one prepared statement in the query editor.
-- One DO statement is atomic in PostgreSQL: an error rolls back every DDL change.
-- This is an explicit one-time operation, never an application/build startup step.

DO $ft_empty_preview$
DECLARE
  relation_count bigint;
BEGIN
  PERFORM pg_catalog.set_config('lock_timeout', '10s', true);
  PERFORM pg_catalog.set_config('statement_timeout', '30s', true);
  PERFORM pg_catalog.set_config('search_path', 'public, pg_catalog', true);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('ft:managed-schema'));
  SELECT COUNT(*) INTO relation_count
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname <> 'information_schema' AND namespace.nspname !~ '^pg_'
    AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_depend AS dependency
      WHERE dependency.classid = 'pg_class'::regclass AND dependency.objid = relation.oid
        AND dependency.deptype = 'e'
    );
  IF relation_count <> 0 THEN
    RAISE EXCEPTION 'Refusing to initialize a nonempty database (% existing user relations)', relation_count
      USING ERRCODE = '55000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'public') THEN
    RAISE EXCEPTION 'The new database must have an empty public schema'
      USING ERRCODE = '55000';
  END IF;

CREATE TABLE "message" ("id" SERIAL NOT NULL, "message" character varying NOT NULL, "userId" integer, CONSTRAINT "PK_ba01f0a3e0123651915008bc578" PRIMARY KEY ("id"));

CREATE TABLE "channel" ("id" SERIAL NOT NULL, "name" character varying(12) NOT NULL, "password" text NOT NULL DEFAULT '', "createAt" TIMESTAMP NOT NULL DEFAULT now(), "updateAt" TIMESTAMP NOT NULL DEFAULT now(), "owner" integer, "admins" integer array NOT NULL DEFAULT '{}', "isPrivate" boolean NOT NULL DEFAULT false, "isDM" boolean NOT NULL DEFAULT false, "bans" integer array NOT NULL DEFAULT '{}', "mutes" integer array NOT NULL DEFAULT '{}', CONSTRAINT "PK_590f33ee6ee7d76437acf362e39" PRIMARY KEY ("id"));

CREATE TABLE "Match" ("id" SERIAL NOT NULL, "winnerScore" integer, "loserScore" integer, "winnerId" integer, "loserId" integer, CONSTRAINT "PK_6613246d3949e391f7a62aca368" PRIMARY KEY ("id"));

CREATE TABLE "User" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "email" character varying(60) NOT NULL, "profileUrl" text NOT NULL DEFAULT './profiles/default.jpeg', "nickname" character varying(10), "need2fa" boolean NOT NULL DEFAULT false, "is2fa" boolean NOT NULL DEFAULT false, "isBanned" boolean NOT NULL DEFAULT false, "status" text NOT NULL DEFAULT 'offline', "friends" integer array NOT NULL DEFAULT '{}', "blocks" integer array NOT NULL DEFAULT '{}', "achievement" text array NOT NULL DEFAULT '{}', "ladder" character varying NOT NULL DEFAULT 'Newbie', CONSTRAINT "UQ_99f220333df04d5f74f6db26c07" UNIQUE ("name"), CONSTRAINT "UQ_7e3dc4518ea083c9e124d4bc5c3" UNIQUE ("nickname"), CONSTRAINT "PK_9862f679340fb2388436a5ab3e4" PRIMARY KEY ("id"));

CREATE TABLE "dm_channel" ("id" SERIAL NOT NULL, "createAt" TIMESTAMP NOT NULL DEFAULT now(), "updateAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_440e52343d579424f7f342deb7c" PRIMARY KEY ("id"));

CREATE TABLE "channel_users_user" ("channelId" integer NOT NULL, "userId" integer NOT NULL, CONSTRAINT "PK_9c93687f86a4988a07a4d25aea6" PRIMARY KEY ("channelId", "userId"));

CREATE INDEX "IDX_b1264bc94c62439e51a031b992" ON "channel_users_user" ("channelId");

CREATE INDEX "IDX_abc4f49166d336a1f2493dd6e1" ON "channel_users_user" ("userId");

CREATE TABLE "channel_messages_message" ("channelId" integer NOT NULL, "messageId" integer NOT NULL, CONSTRAINT "PK_8067b9e67498c4a8377d8c98891" PRIMARY KEY ("channelId", "messageId"));

CREATE INDEX "IDX_00af8d655aafe1711f23709e82" ON "channel_messages_message" ("channelId");

CREATE INDEX "IDX_1c3262f6bf945e816b07fba9bb" ON "channel_messages_message" ("messageId");

CREATE TABLE "match_players_user" ("matchId" integer NOT NULL, "userId" integer NOT NULL, CONSTRAINT "PK_8528ba208435da671336b579e1b" PRIMARY KEY ("matchId", "userId"));

CREATE INDEX "IDX_7f98431ff97dd9823c880c4790" ON "match_players_user" ("matchId");

CREATE INDEX "IDX_b8f2a7d2885cdcb74525ded319" ON "match_players_user" ("userId");

CREATE TABLE "dm_channel_users_user" ("dmChannelId" integer NOT NULL, "userId" integer NOT NULL, CONSTRAINT "PK_b2e7cf649aa8d22faffefb9f93a" PRIMARY KEY ("dmChannelId", "userId"));

CREATE INDEX "IDX_d769d9782c2e23b6175bb93dff" ON "dm_channel_users_user" ("dmChannelId");

CREATE INDEX "IDX_725cb06db4dda1d62a20b8e4a0" ON "dm_channel_users_user" ("userId");

CREATE TABLE "dm_channel_messages_message" ("dmChannelId" integer NOT NULL, "messageId" integer NOT NULL, CONSTRAINT "PK_82eef81ba5c776dbe13a51d6e3c" PRIMARY KEY ("dmChannelId", "messageId"));

CREATE INDEX "IDX_ee5e8cdf443ae6343677770615" ON "dm_channel_messages_message" ("dmChannelId");

CREATE INDEX "IDX_26c143f062bc1331b0b4ad139d" ON "dm_channel_messages_message" ("messageId");

ALTER TABLE "message" ADD CONSTRAINT "FK_446251f8ceb2132af01b68eb593" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "Match" ADD CONSTRAINT "FK_40e91be804edabc6cfd6461e3e9" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "Match" ADD CONSTRAINT "FK_b3d0562c701518bef9535edd104" FOREIGN KEY ("loserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "channel_users_user" ADD CONSTRAINT "FK_b1264bc94c62439e51a031b992b" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel_users_user" ADD CONSTRAINT "FK_abc4f49166d336a1f2493dd6e1d" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel_messages_message" ADD CONSTRAINT "FK_00af8d655aafe1711f23709e82f" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel_messages_message" ADD CONSTRAINT "FK_1c3262f6bf945e816b07fba9bb2" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_players_user" ADD CONSTRAINT "FK_7f98431ff97dd9823c880c47906" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_players_user" ADD CONSTRAINT "FK_b8f2a7d2885cdcb74525ded319d" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dm_channel_users_user" ADD CONSTRAINT "FK_d769d9782c2e23b6175bb93dff7" FOREIGN KEY ("dmChannelId") REFERENCES "dm_channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dm_channel_users_user" ADD CONSTRAINT "FK_725cb06db4dda1d62a20b8e4a0a" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dm_channel_messages_message" ADD CONSTRAINT "FK_ee5e8cdf443ae63436777706154" FOREIGN KEY ("dmChannelId") REFERENCES "dm_channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dm_channel_messages_message" ADD CONSTRAINT "FK_26c143f062bc1331b0b4ad139de" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

END;
$ft_empty_preview$;
