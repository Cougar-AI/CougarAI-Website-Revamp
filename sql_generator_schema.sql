create sequence event_event_id_seq
    as integer;

alter sequence event_event_id_seq owner to postgres;

grant select, usage on sequence event_event_id_seq to "CougarAI";

grant select, usage on sequence event_event_id_seq to cougarai;

create sequence payment_payment_id_seq
    as integer;

alter sequence payment_payment_id_seq owner to postgres;

grant select, usage on sequence payment_payment_id_seq to "CougarAI";

grant select, usage on sequence payment_payment_id_seq to cougarai;

create table discord_config
(
    guild_id             varchar(20) default ''::character varying not null
        primary key,
    announcement_channel varchar(20) default ''::character varying,
    welcome_channel      varchar(20) default ''::character varying,
    member_role          varchar(20) default ''::character varying,
    log_channel          varchar(20) default ''::character varying,
    executive_role       varchar(20) default ''::character varying
);

alter table discord_config
    owner to postgres;

grant select on discord_config to "CougarAI";

grant delete, insert, select, update on discord_config to cougarai;

create table events
(
    event_id    integer      default nextval('event_event_id_seq'::regclass) not null
        constraint event_pkey
            primary key,
    type        integer,
    description varchar(256) default ''::character varying,
    location    varchar(100) default ''::character varying,
    name        varchar(100) default ''::character varying,
    date        timestamp
);

alter table events
    owner to postgres;

alter sequence event_event_id_seq owned by events.event_id;

create table discord_announcements
(
    announcement_id   serial
        primary key,
    guild_id          varchar(19)  default ''::character varying
        references discord_config,
    event_id          bigint
        references events,
    description       varchar(512)                           not null,
    message           varchar(512) default ''::character varying,
    announcement_date timestamp                              not null,
    event_image       varchar,
    created_at        timestamp    default CURRENT_TIMESTAMP not null,
    title             varchar(256)                           not null
);

alter table discord_announcements
    owner to postgres;

grant select, usage on sequence discord_announcements_announcement_id_seq to "CougarAI";

grant select, usage on sequence discord_announcements_announcement_id_seq to cougarai;

grant select on discord_announcements to "CougarAI";

grant delete, insert, select, update on discord_announcements to cougarai;

grant select on events to "CougarAI";

grant delete, insert, select, update on events to cougarai;

create table users
(
    student_id             integer      not null
        primary key,
    first_name             varchar(50),
    last_name              varchar(50),
    email                  varchar(70)
        unique,
    discord_id             varchar,
    major                  integer,
    shirt_size             smallint,
    student_classification smallint,
    gender                 smallint,
    join_source            varchar(50),
    phone_number           varchar(10),
    password_hash          varchar(255) not null
        constraint password_not_empty
            check (length((password_hash)::text) > 0)
);

alter table users
    owner to postgres;

create table officers
(
    student_id integer not null
        primary key
        references users,
    join_date  timestamp,
    end_date   timestamp,
    role       smallint
);

alter table officers
    owner to postgres;

grant select on officers to "CougarAI";

grant delete, insert, select, update on officers to cougarai;

create table payments
(
    payment_id               integer     default nextval('payment_payment_id_seq'::regclass) not null
        constraint payment_pkey
            primary key,
    student_id               integer
        constraint payment_student_id_fkey
            references users,
    date                     timestamp   default CURRENT_TIMESTAMP,
    amount                   integer,
    transaction_id           varchar(100),
    stripe_payment_intent_id varchar(255)
        constraint unique_stripe_payment_intent_id
            unique,
    status                   varchar(50) default 'pending'::character varying
        constraint check_payment_status
            check ((status)::text = ANY
                   ((ARRAY ['pending'::character varying, 'processing'::character varying, 'succeeded'::character varying, 'failed'::character varying, 'cancelled'::character varying, 'refunded'::character varying])::text[])),
    created_at               timestamp   default CURRENT_TIMESTAMP,
    updated_at               timestamp   default CURRENT_TIMESTAMP
);

alter table payments
    owner to postgres;

alter sequence payment_payment_id_seq owned by payments.payment_id;

create index idx_payments_stripe_payment_intent_id
    on payments (stripe_payment_intent_id);

create index idx_payments_status
    on payments (status);

grant select on payments to "CougarAI";

grant delete, insert, select, update on payments to cougarai;

create table points
(
    student_id integer not null
        references users,
    event_id   integer
        references events,
    points     integer,
    date       timestamp default CURRENT_TIMESTAMP,
    points_id  serial
        primary key
);

alter table points
    owner to postgres;

grant select on points to "CougarAI";

grant delete, insert, select, update on points to cougarai;

grant delete, insert, select, update on users to "CougarAI";

grant delete, insert, references, select, trigger, truncate, update on users to cougarai;

create function digest(text, text) returns bytea
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function digest(text, text) owner to postgres;

create function digest(bytea, text) returns bytea
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function digest(bytea, text) owner to postgres;

create function hmac(text, text, text) returns bytea
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function hmac(text, text, text) owner to postgres;

create function hmac(bytea, bytea, text) returns bytea
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function hmac(bytea, bytea, text) owner to postgres;

create function crypt(text, text) returns text
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function crypt(text, text) owner to postgres;

create function gen_salt(text) returns text
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function gen_salt(text) owner to postgres;

create function gen_salt(text, integer) returns text
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function gen_salt(text, integer) owner to postgres;

create function encrypt(bytea, bytea, text) returns bytea
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function encrypt(bytea, bytea, text) owner to postgres;

create function decrypt(bytea, bytea, text) returns bytea
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function decrypt(bytea, bytea, text) owner to postgres;

create function encrypt_iv(bytea, bytea, bytea, text) returns bytea
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function encrypt_iv(bytea, bytea, bytea, text) owner to postgres;

create function decrypt_iv(bytea, bytea, bytea, text) returns bytea
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function decrypt_iv(bytea, bytea, bytea, text) owner to postgres;

create function gen_random_bytes(integer) returns bytea
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function gen_random_bytes(integer) owner to postgres;

create function gen_random_uuid() returns uuid
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function gen_random_uuid() owner to postgres;

create function pgp_sym_encrypt(text, text) returns bytea
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_sym_encrypt(text, text) owner to postgres;

create function pgp_sym_encrypt_bytea(bytea, text) returns bytea
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_sym_encrypt_bytea(bytea, text) owner to postgres;

create function pgp_sym_encrypt(text, text, text) returns bytea
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_sym_encrypt(text, text, text) owner to postgres;

create function pgp_sym_encrypt_bytea(bytea, text, text) returns bytea
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_sym_encrypt_bytea(bytea, text, text) owner to postgres;

create function pgp_sym_decrypt(bytea, text) returns text
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_sym_decrypt(bytea, text) owner to postgres;

create function pgp_sym_decrypt_bytea(bytea, text) returns bytea
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_sym_decrypt_bytea(bytea, text) owner to postgres;

create function pgp_sym_decrypt(bytea, text, text) returns text
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_sym_decrypt(bytea, text, text) owner to postgres;

create function pgp_sym_decrypt_bytea(bytea, text, text) returns bytea
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_sym_decrypt_bytea(bytea, text, text) owner to postgres;

create function pgp_pub_encrypt(text, bytea) returns bytea
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_pub_encrypt(text, bytea) owner to postgres;

create function pgp_pub_encrypt_bytea(bytea, bytea) returns bytea
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_pub_encrypt_bytea(bytea, bytea) owner to postgres;

create function pgp_pub_encrypt(text, bytea, text) returns bytea
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_pub_encrypt(text, bytea, text) owner to postgres;

create function pgp_pub_encrypt_bytea(bytea, bytea, text) returns bytea
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_pub_encrypt_bytea(bytea, bytea, text) owner to postgres;

create function pgp_pub_decrypt(bytea, bytea) returns text
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_pub_decrypt(bytea, bytea) owner to postgres;

create function pgp_pub_decrypt_bytea(bytea, bytea) returns bytea
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_pub_decrypt_bytea(bytea, bytea) owner to postgres;

create function pgp_pub_decrypt(bytea, bytea, text) returns text
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_pub_decrypt(bytea, bytea, text) owner to postgres;

create function pgp_pub_decrypt_bytea(bytea, bytea, text) returns bytea
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_pub_decrypt_bytea(bytea, bytea, text) owner to postgres;

create function pgp_pub_decrypt(bytea, bytea, text, text) returns text
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_pub_decrypt(bytea, bytea, text, text) owner to postgres;

create function pgp_pub_decrypt_bytea(bytea, bytea, text, text) returns bytea
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_pub_decrypt_bytea(bytea, bytea, text, text) owner to postgres;

create function pgp_key_id(bytea) returns text
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function pgp_key_id(bytea) owner to postgres;

create function armor(bytea) returns text
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function armor(bytea) owner to postgres;

create function armor(bytea, text[], text[]) returns text
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function armor(bytea, text[], text[]) owner to postgres;

create function dearmor(text) returns bytea
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;
$$;

alter function dearmor(text) owner to postgres;

create function pgp_armor_headers(text, out key text, out value text) returns setof setof record
    immutable
    strict
    parallel safe
    language c
as
$$
begin
-- missing source code
end;

$$;

alter function pgp_armor_headers(text, out text, out text) owner to postgres;

