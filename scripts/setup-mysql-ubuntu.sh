#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${DB_NAME:-gan}"
DB_USER="${DB_USER:-gan_user}"
DB_PASSWORD="${DB_PASSWORD:-change_this_password}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-}"
ALLOW_REMOTE="${ALLOW_REMOTE:-false}"

echo "[1/6] Installing MySQL server..."
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server

echo "[2/6] Enabling and starting MySQL..."
sudo systemctl enable mysql
sudo systemctl restart mysql

MYSQL_CMD=(sudo mysql)
if [ -n "$MYSQL_ROOT_PASSWORD" ]; then
  MYSQL_CMD=(mysql -uroot "-p${MYSQL_ROOT_PASSWORD}")
fi

USER_HOST="localhost"
if [ "$ALLOW_REMOTE" = "true" ]; then
  USER_HOST="%"
fi

echo "[3/6] Creating database and user..."
"${MYSQL_CMD[@]}" <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'${USER_HOST}' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'${USER_HOST}';
FLUSH PRIVILEGES;
SQL

if [ "$ALLOW_REMOTE" = "true" ]; then
  echo "[4/6] Allowing remote access in mysqld.cnf..."
  sudo sed -i "s/^[#[:space:]]*bind-address.*/bind-address = 0.0.0.0/" /etc/mysql/mysql.conf.d/mysqld.cnf
  sudo systemctl restart mysql
else
  echo "[4/6] Keeping MySQL bound to localhost"
fi

echo "[5/6] Testing connection..."
mysql -h 127.0.0.1 -u"${DB_USER}" -p"${DB_PASSWORD}" -e "USE \`${DB_NAME}\`; SELECT 'ok' AS status;"

echo "[6/6] Done"
echo ""
echo "DATABASE_URL=mysql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:3306/${DB_NAME}"
