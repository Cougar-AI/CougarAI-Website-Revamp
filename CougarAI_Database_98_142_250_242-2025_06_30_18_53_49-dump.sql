--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Ubuntu 16.9-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: discord_announcements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.discord_announcements (
    announcement_id integer NOT NULL,
    guild_id character varying(19) DEFAULT ''::character varying,
    event_id bigint,
    description character varying(512) NOT NULL,
    message character varying(512) DEFAULT ''::character varying,
    announcement_date timestamp without time zone NOT NULL,
    event_image character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    title character varying(256) NOT NULL
);


ALTER TABLE public.discord_announcements OWNER TO postgres;

--
-- Name: discord_announcements_announcement_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.discord_announcements_announcement_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.discord_announcements_announcement_id_seq OWNER TO postgres;

--
-- Name: discord_announcements_announcement_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.discord_announcements_announcement_id_seq OWNED BY public.discord_announcements.announcement_id;


--
-- Name: discord_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.discord_config (
    guild_id character varying(20) DEFAULT ''::character varying NOT NULL,
    announcement_channel character varying(20) DEFAULT ''::character varying,
    welcome_channel character varying(20) DEFAULT ''::character varying,
    member_role character varying(20) DEFAULT ''::character varying,
    log_channel character varying(20) DEFAULT ''::character varying,
    executive_role character varying(20) DEFAULT ''::character varying
);


ALTER TABLE public.discord_config OWNER TO postgres;

--
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.events (
    event_id integer NOT NULL,
    type integer,
    description character varying(256) DEFAULT ''::character varying,
    location character varying(100) DEFAULT ''::character varying,
    name character varying(100) DEFAULT ''::character varying,
    date timestamp without time zone
);


ALTER TABLE public.events OWNER TO postgres;

--
-- Name: event_event_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.event_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.event_event_id_seq OWNER TO postgres;

--
-- Name: event_event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.event_event_id_seq OWNED BY public.events.event_id;


--
-- Name: officers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.officers (
    student_id integer NOT NULL,
    join_date timestamp without time zone,
    end_date timestamp without time zone,
    role smallint
);


ALTER TABLE public.officers OWNER TO postgres;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    payment_id integer NOT NULL,
    student_id integer,
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    amount integer,
    transaction_id character varying(100),
    stripe_payment_intent_id character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_payment_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'succeeded'::character varying, 'failed'::character varying, 'cancelled'::character varying, 'refunded'::character varying])::text[])))
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: payment_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_payment_id_seq OWNER TO postgres;

--
-- Name: payment_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_payment_id_seq OWNED BY public.payments.payment_id;


--
-- Name: points; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.points (
    student_id integer NOT NULL,
    event_id integer,
    points integer,
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    points_id integer NOT NULL
);


ALTER TABLE public.points OWNER TO postgres;

--
-- Name: points_points_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.points_points_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.points_points_id_seq OWNER TO postgres;

--
-- Name: points_points_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.points_points_id_seq OWNED BY public.points.points_id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    student_id integer NOT NULL,
    first_name character varying(50),
    last_name character varying(50),
    email character varying(70),
    discord_id character varying,
    major integer,
    shirt_size smallint,
    student_classification smallint,
    gender smallint,
    join_source character varying(50),
    phone_number character varying(10),
    password_hash character varying(255) NOT NULL,
    CONSTRAINT password_not_empty CHECK ((length((password_hash)::text) > 0))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: discord_announcements announcement_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discord_announcements ALTER COLUMN announcement_id SET DEFAULT nextval('public.discord_announcements_announcement_id_seq'::regclass);


--
-- Name: events event_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events ALTER COLUMN event_id SET DEFAULT nextval('public.event_event_id_seq'::regclass);


--
-- Name: payments payment_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments ALTER COLUMN payment_id SET DEFAULT nextval('public.payment_payment_id_seq'::regclass);


--
-- Name: points points_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.points ALTER COLUMN points_id SET DEFAULT nextval('public.points_points_id_seq'::regclass);


--
-- Name: discord_announcements_announcement_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.discord_announcements_announcement_id_seq', 1, false);


--
-- Name: event_event_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.event_event_id_seq', 10, true);


--
-- Name: payment_payment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_payment_id_seq', 14, true);


--
-- Name: points_points_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.points_points_id_seq', 24, true);


--
-- Name: discord_announcements discord_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discord_announcements
    ADD CONSTRAINT discord_announcements_pkey PRIMARY KEY (announcement_id);


--
-- Name: discord_config discord_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discord_config
    ADD CONSTRAINT discord_config_pkey PRIMARY KEY (guild_id);


--
-- Name: events event_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT event_pkey PRIMARY KEY (event_id);


--
-- Name: officers officers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.officers
    ADD CONSTRAINT officers_pkey PRIMARY KEY (student_id);


--
-- Name: payments payment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payment_pkey PRIMARY KEY (payment_id);


--
-- Name: points points_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.points
    ADD CONSTRAINT points_pkey PRIMARY KEY (points_id);


--
-- Name: payments unique_stripe_payment_intent_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT unique_stripe_payment_intent_id UNIQUE (stripe_payment_intent_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (student_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_payments_stripe_payment_intent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_stripe_payment_intent_id ON public.payments USING btree (stripe_payment_intent_id);


--
-- Name: discord_announcements discord_announcements_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discord_announcements
    ADD CONSTRAINT discord_announcements_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(event_id);


--
-- Name: discord_announcements discord_announcements_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discord_announcements
    ADD CONSTRAINT discord_announcements_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.discord_config(guild_id);


--
-- Name: officers officers_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.officers
    ADD CONSTRAINT officers_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(student_id);


--
-- Name: payments payment_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payment_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(student_id);


--
-- Name: points points_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.points
    ADD CONSTRAINT points_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(event_id);


--
-- Name: points points_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.points
    ADD CONSTRAINT points_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(student_id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO cougarai;


--
-- Name: TABLE discord_announcements; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.discord_announcements TO cougarai;
GRANT SELECT ON TABLE public.discord_announcements TO "CougarAI";


--
-- Name: SEQUENCE discord_announcements_announcement_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.discord_announcements_announcement_id_seq TO cougarai;
GRANT SELECT,USAGE ON SEQUENCE public.discord_announcements_announcement_id_seq TO "CougarAI";


--
-- Name: TABLE discord_config; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.discord_config TO cougarai;
GRANT SELECT ON TABLE public.discord_config TO "CougarAI";


--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.events TO cougarai;
GRANT SELECT ON TABLE public.events TO "CougarAI";


--
-- Name: SEQUENCE event_event_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.event_event_id_seq TO cougarai;
GRANT SELECT,USAGE ON SEQUENCE public.event_event_id_seq TO "CougarAI";


--
-- Name: TABLE officers; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.officers TO cougarai;
GRANT SELECT ON TABLE public.officers TO "CougarAI";


--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payments TO cougarai;
GRANT SELECT ON TABLE public.payments TO "CougarAI";


--
-- Name: SEQUENCE payment_payment_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.payment_payment_id_seq TO cougarai;
GRANT SELECT,USAGE ON SEQUENCE public.payment_payment_id_seq TO "CougarAI";


--
-- Name: TABLE points; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.points TO cougarai;
GRANT SELECT ON TABLE public.points TO "CougarAI";


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.users TO cougarai;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users TO "CougarAI";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "CougarAI";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO cougarai;


--
-- PostgreSQL database dump complete
--

