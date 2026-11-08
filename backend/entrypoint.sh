#!/usr/bin/env python3
import os
import time
import sys
try:
    import psycopg2
except Exception as e:
    print('psycopg2 import failed:', e)
    sys.exit(1)

# Minimal, reversible fallback logic:
# - Prefer DATABASE_URL if provided
# - Try to connect to configured DSN
# - On connection failure that looks like a network timeout, try using the Docker bridge gateway
#   (172.18.0.1) as an alternative host. This is a project-level workaround that avoids host-level changes.

def get_dsn():
    db_url = os.environ.get('DATABASE_URL')
    if db_url:
        return db_url.replace('postgresql+psycopg2://', 'postgresql://')
    user = os.environ.get('POSTGRES_USER')
    pwd = os.environ.get('POSTGRES_PASSWORD')
    db = os.environ.get('POSTGRES_DB')
    if user and pwd and db:
        return f'postgresql://{user}:{pwd}@db:5432/{db}'
    return None

# Try to connect, with an additional fallback to the Docker bridge gateway if needed.
for _ in range(60):
    dsn = get_dsn()
    if not dsn:
        print('no DATABASE_URL or POSTGRES_* vars found; retrying...')
        time.sleep(1)
        continue
    try:
        # attempt primary connect
        psycopg2.connect(dsn, connect_timeout=3)
        print('db is available via configured DSN')
        break
    except Exception as e:
        pgcode = getattr(e, 'pgcode', None)
        err_str = str(e).lower()

        # Abortar inmediatamente si las credenciales fallan o el circuit breaker saltó
        if (
            pgcode in ('28P01', '28000')
            or 'password authentication failed' in err_str
            or 'authentication failed' in err_str
            or '28p01' in err_str
            or 'circuitbreaker' in err_str
            or 'too many authentication failures' in err_str
        ):
            print(f'FATAL: Database authentication or circuit breaker error ({e}). Aborting immediately without retrying to prevent lockout.', file=sys.stderr)
            sys.exit(1)

        # If network-related, try gateway fallback once
        print('waiting for db (primary):', e)
        if 'timeout' in err_str or 'timed out' in err_str or 'could not translate host name' in err_str or 'connection refused' in err_str:
            try:
                # build fallback DSN using Docker bridge gateway
                # Only substitute host portion, keep credentials and db name
                # example: postgresql://user:pwd@db:5432/dbname -> postgresql://user:pwd@172.18.0.1:5432/dbname
                if '@db:' in dsn:
                    alt_dsn = dsn.replace('@db:', '@172.18.0.1:')
                else:
                    # generic replace of host 'db' if present
                    alt_dsn = dsn.replace('@db', '@172.18.0.1')
                print('attempting gateway fallback to 172.18.0.1')
                psycopg2.connect(alt_dsn, connect_timeout=3)
                # if success, set DATABASE_URL for the process and continue
                os.environ['DATABASE_URL'] = alt_dsn
                print('db is available via gateway fallback')
                dsn = alt_dsn
                break
            except Exception as e2:
                print('gateway fallback failed:', e2)
        time.sleep(1)
else:
    print('db did not become available', flush=True)
    sys.exit(1)

# execute uvicorn replacing process
os.execvp('uvicorn', ['uvicorn', 'backend.app.main:app', '--host', '0.0.0.0', '--port', '8000'])
