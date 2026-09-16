-- Rôle PostgreSQL de l'ETL : la frontière entre l'ingestion et les données
-- personnelles est tenue par un droit de base, pas par une phrase dans un
-- document (docs/data.md, « Qui écrit dans sites, et jusqu'où »).
--
-- Créé sans LOGIN et sans mot de passe : un fichier commité ne porte pas de
-- secret, et un rôle qui ne peut pas se connecter est un défaut sûr. C'est
-- le script d'amorçage qui l'active, depuis ETL_DB_PASSWORD.
--
-- Le bloc DO n'est pas une précaution de style : les rôles PostgreSQL sont
-- globaux au cluster, alors que les privilèges sont par base. Cette migration
-- s'exécute donc plusieurs fois contre le même cluster, en test comme sur la
-- machine, et rencontrerait un rôle déjà créé.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'etl') THEN
    CREATE ROLE etl NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO etl;
--> statement-breakpoint
GRANT SELECT, INSERT ON sites TO etl;
--> statement-breakpoint
-- warning_threshold_kw est absente, volontairement : un rechargement ne peut
-- pas effacer un seuil réglé à l'écran, même par erreur de code.
GRANT UPDATE (name, type, location, capacity_kw, status,
              present_in_source, updated_at) ON sites TO etl;
