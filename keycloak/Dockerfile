FROM quay.io/keycloak/keycloak:26.0

# Copy russian providers (включая Yandex IdP)
COPY providers/ /opt/keycloak/providers/

# Собираем Keycloak с новыми провайдерами для production mode
USER root
RUN /opt/keycloak/bin/kc.sh build
USER keycloak

