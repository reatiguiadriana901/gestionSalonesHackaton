# =====================================================================
#  Frontend · nginx sirve la interfaz y reenvía /api/* al backend (n8n)
# =====================================================================
FROM nginx:1.30-alpine

# Dirección interna del backend; se puede cambiar al ejecutar el contenedor
ENV BACKEND_URL=http://backend:5678

# La imagen oficial procesa /etc/nginx/templates/*.template con las variables de entorno
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY index.html /usr/share/nginx/html/index.html
COPY assets/ /usr/share/nginx/html/assets/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
