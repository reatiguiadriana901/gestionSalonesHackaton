# =====================================================================
#  Backend · n8n con los workflows del Sistema Central de Gestión Operativa
#  La versión está fijada para que la instalación sea reproducible.
# =====================================================================
FROM n8nio/n8n:2.43.7

ENV GENERIC_TIMEZONE=America/Bogota \
    TZ=America/Bogota \
    # Los nodos Code leen la configuración de IA (AI_PROVIDER, AI_MODEL...) con $env
    N8N_BLOCK_ENV_ACCESS_IN_NODE=false \
    N8N_RUNNERS_TASK_TIMEOUT=120 \
    N8N_DIAGNOSTICS_ENABLED=false \
    N8N_VERSION_NOTIFICATIONS_ENABLED=false \
    N8N_PERSONALIZATION_ENABLED=false \
    N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true \
    EXECUTIONS_DATA_PRUNE=true \
    EXECUTIONS_DATA_MAX_AGE=168

USER root
COPY docker/entrypoint.sh docker/generar-credenciales.js /opt/campus/
COPY workflows/ /opt/campus/workflows/
# Quita retornos de carro (CRLF) por si los archivos se editaron en Windows
RUN sed -i 's/\r$//' /opt/campus/entrypoint.sh \
    && chmod 755 /opt/campus/entrypoint.sh \
    && chown -R node:node /opt/campus
USER node

EXPOSE 5678

HEALTHCHECK --interval=10s --timeout=5s --start-period=90s --retries=12 \
    CMD wget -qO- http://127.0.0.1:5678/healthz >/dev/null || exit 1

ENTRYPOINT ["tini", "--", "/opt/campus/entrypoint.sh"]
