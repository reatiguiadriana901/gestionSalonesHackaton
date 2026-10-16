# Base de datos del sistema: PostgreSQL con el esquema y los catálogos incluidos.
# Los scripts de /docker-entrypoint-initdb.d solo se ejecutan cuando el volumen
# de datos está vacío (primer arranque).
FROM postgres:17-alpine

ENV TZ=America/Bogota \
    PGTZ=America/Bogota

COPY init/ /docker-entrypoint-initdb.d/
