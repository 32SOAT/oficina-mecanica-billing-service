#!/usr/bin/env bash
set -Eeuo pipefail

service_name=oficina-billing
namespace=oficina-mecanica
base_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../kubernetes/base" && pwd)"
: "${IMAGE_REF:?IMAGE_REF is required}"
[[ "$IMAGE_REF" =~ ^[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/[a-z0-9/_-]+@sha256:[0-9a-f]{64}$ ]] || { echo 'Invalid ECR image digest' >&2; exit 1; }
[[ "$IMAGE_REF" == */oficina-mecanica-billing-service-"${DEPLOY_ENV:?DEPLOY_ENV is required}"@sha256:* ]] || { echo 'ECR repository does not belong to this service' >&2; exit 1; }
for required in POSTGRES_HOST POSTGRES_PORT POSTGRES_DB SQS_COMMANDS_QUEUE_URL SQS_RESULTS_QUEUE_URL SQS_WORKER_ENABLED MERCADOPAGO_POLL_INTERVAL_MS POSTGRES_USER POSTGRES_PASSWORD SAGA_TOKEN; do
  [[ -n "${!required:-}" ]] || { echo "Missing deployment variable: $required" >&2; exit 1; }
done
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
umask 077
printf 'NODE_ENV=production\nAPP_PORT=3000\n' > "$work_dir/config.env"
for key in POSTGRES_HOST POSTGRES_PORT POSTGRES_DB SQS_COMMANDS_QUEUE_URL SQS_RESULTS_QUEUE_URL SQS_WORKER_ENABLED MERCADOPAGO_POLL_INTERVAL_MS; do printf '%s=%s\n' "$key" "${!key}" >> "$work_dir/config.env"; done
printf 'SQS_REGION=%s\n' "${AWS_REGION}" >> "$work_dir/config.env"
for key in POSTGRES_USER POSTGRES_PASSWORD SAGA_TOKEN MERCADOPAGO_ACCESS_TOKEN MERCADOPAGO_PUBLIC_KEY; do printf '%s=%s\n' "$key" "${!key}" >> "$work_dir/secret.env"; done
kubectl -n "$namespace" create configmap "$service_name-config" --from-env-file="$work_dir/config.env" --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$namespace" create secret generic "$service_name-secret" --from-env-file="$work_dir/secret.env" --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$namespace" apply -f "$base_dir/service-account.yaml"
kubectl -n "$namespace" apply -f "$base_dir/postgres-service.yaml"
kubectl -n "$namespace" apply -f "$base_dir/postgres-statefulset.yaml"
kubectl -n "$namespace" apply -f "$base_dir/postgres-network-policy.yaml"
kubectl -n "$namespace" rollout status "statefulset/oficina-billing-postgres" --timeout=5m
sed "s|image: oficina-billing$|image: $IMAGE_REF|" "$base_dir/deployment.yaml" > "$work_dir/deployment.yaml"
kubectl -n "$namespace" apply -f "$base_dir/service.yaml"
kubectl -n "$namespace" apply -f "$base_dir/checkout-service.yaml"
kubectl -n "$namespace" apply -f "$work_dir/deployment.yaml"
kubectl -n "$namespace" rollout status "deployment/oficina-billing" --timeout=5m
kubectl -n "$namespace" run "oficina-billing-smoke-${GITHUB_RUN_ID:-local}" --image=curlimages/curl:8.11.1 --restart=Never --rm -i --quiet -- \
  curl --fail --silent --show-error "http://oficina-billing/api/v1/health" >/dev/null
hostname=""
for _ in $(seq 1 30); do
  hostname="$(kubectl -n "$namespace" get service oficina-billing-checkout -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')"
  [[ -n "$hostname" ]] && break
  sleep 10
done
[[ "$hostname" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9]$ ]] || { echo 'Billing checkout NLB hostname is unavailable or invalid' >&2; exit 1; }
curl --fail --silent --show-error --retry 12 --retry-delay 5 "http://$hostname/api/v1/health" >/dev/null
aws ssm put-parameter --name "/oficina/$DEPLOY_ENV/services/billing-checkout-nlb-hostname" --type String --value "$hostname" --overwrite >/dev/null
